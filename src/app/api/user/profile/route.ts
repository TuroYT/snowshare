import { NextRequest, NextResponse } from "next/server";
import { getSettingsCached } from "@/lib/settings";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/security";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import {
  isValidEmail,
  isValidPassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "@/lib/constants";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

const MAX_NAME_LENGTH = 100;

// GET - Get User informations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError(request, ErrorCode.UNAUTHORIZED);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        isAdmin: true,
        defaultTab: true,
      },
    });

    if (!user) {
      return apiError(request, ErrorCode.USER_NOT_FOUND);
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return internalError(request);
  }
}

// PATCH - Update the current user's profile
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError(request, ErrorCode.UNAUTHORIZED);
    }

    const data = await request.json();
    const { name, email, currentPassword, newPassword, defaultTab } = data;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return apiError(request, ErrorCode.USER_NOT_FOUND);
    }

    const VALID_TABS = ["linkshare", "pasteshare", "fileshare"];
    const updateData: {
      name?: string;
      email?: string;
      emailVerified?: Date | null;
      password?: string;
      defaultTab?: "linkshare" | "pasteshare" | "fileshare";
    } = {};

    if (name !== undefined) {
      if (name !== null && typeof name !== "string") {
        return apiError(request, ErrorCode.INVALID_REQUEST);
      }
      if (typeof name === "string" && name.length > MAX_NAME_LENGTH) {
        return apiError(request, ErrorCode.DISPLAY_NAME_TOO_LONG);
      }
      updateData.name = name;
    }

    if (defaultTab !== undefined) {
      if (!VALID_TABS.includes(defaultTab)) {
        return apiError(request, ErrorCode.INVALID_REQUEST);
      }
      updateData.defaultTab = defaultTab;
    }

    // Password-based accounts must re-authenticate before changing email or password
    const emailChanged = email !== undefined && email !== user.email;
    if ((emailChanged || newPassword) && user.password) {
      if (!currentPassword) {
        return apiError(request, ErrorCode.CURRENT_PASSWORD_REQUIRED);
      }
      const isPasswordValid = await verifyPassword(currentPassword, user.password);
      if (!isPasswordValid) {
        return apiError(request, ErrorCode.INCORRECT_CURRENT_PASSWORD);
      }
    }

    let needsEmailVerification = false;

    // Email update
    if (emailChanged) {
      if (typeof email !== "string" || !isValidEmail(email)) {
        return apiError(request, ErrorCode.INVALID_EMAIL_FORMAT);
      }

      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser) {
        return apiError(request, ErrorCode.USER_ALREADY_EXISTS);
      }

      const settings = await getSettingsCached();
      needsEmailVerification = !!(settings?.emailVerificationRequired && settings.smtpEnabled);

      updateData.email = email;
      // A new address is unverified until proven otherwise
      updateData.emailVerified = needsEmailVerification ? null : new Date();
    }

    // Password update
    if (newPassword) {
      if (!user.password) {
        return apiError(request, ErrorCode.FORBIDDEN);
      }

      if (typeof newPassword !== "string" || !isValidPassword(newPassword)) {
        return apiError(request, ErrorCode.PASSWORD_LENGTH, {
          min: PASSWORD_MIN_LENGTH,
          max: PASSWORD_MAX_LENGTH,
        });
      }

      updateData.password = await hashPassword(newPassword);
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        defaultTab: true,
      },
    });

    if (needsEmailVerification && updateData.email) {
      const token = crypto.randomBytes(32).toString("hex");
      await prisma.verificationToken.create({
        data: {
          identifier: `email-verify:${updateData.email}`,
          token,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      try {
        await sendVerificationEmail(updateData.email, token);
      } catch (emailError) {
        console.error("Failed to send verification email after email change:", emailError);
      }
    }

    return NextResponse.json({
      user: updatedUser,
      ...(needsEmailVerification && { requiresVerification: true }),
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return internalError(request);
  }
}
