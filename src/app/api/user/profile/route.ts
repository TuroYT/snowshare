import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/security";
import { isValidEmail } from "@/lib/constants";
import { isValidDisplayName } from "@/lib/validation";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";

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

// PATCH - Modifier les informations de l'utilisateur
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
      if (typeof name !== "string") {
        return apiError(request, ErrorCode.INVALID_REQUEST);
      }
      const { valid } = isValidDisplayName(name, 100);
      if (!valid) return apiError(request, ErrorCode.INVALID_REQUEST);
      updateData.name = name.trim();
    }

    if (defaultTab !== undefined) {
      if (!VALID_TABS.includes(defaultTab)) {
        return apiError(request, ErrorCode.INVALID_REQUEST);
      }
      updateData.defaultTab = defaultTab;
    }

    // Mise à jour de l'email
    if (email !== undefined && email !== user.email) {
      if (typeof email !== "string" || !isValidEmail(email)) {
        return apiError(request, ErrorCode.INVALID_REQUEST);
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return apiError(request, ErrorCode.USER_ALREADY_EXISTS);
      }

      updateData.email = email;
      // Require re-verification when email changes
      updateData.emailVerified = null;
    }

    // Mise à jour du mot de passe
    if (newPassword) {
      if (!currentPassword) {
        return apiError(request, ErrorCode.CURRENT_PASSWORD_REQUIRED);
      }

      if (!user.password) {
        return apiError(request, ErrorCode.FORBIDDEN);
      }

      const isPasswordValid = await verifyPassword(currentPassword, user.password);

      if (!isPasswordValid) {
        return apiError(request, ErrorCode.INCORRECT_CURRENT_PASSWORD);
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

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return internalError(request);
  }
}
