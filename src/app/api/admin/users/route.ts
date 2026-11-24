import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import {
  isValidEmail,
  isValidPassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "@/lib/constants";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { hashPassword } from "@/lib/security";
import { revokePasswordResetTokens } from "@/lib/password-reset";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return apiError(request, ErrorCode.UNAUTHORIZED);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.isAdmin) {
    return apiError(request, ErrorCode.ADMIN_ONLY);
  }

  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");

    let take: number | undefined;
    if (limitParam !== null) {
      const parsedLimit = Number.parseInt(limitParam, 10);
      if (!Number.isNaN(parsedLimit)) {
        take = Math.min(100, Math.max(1, parsedLimit));
      }
    }

    let skip: number | undefined;
    if (offsetParam !== null) {
      const parsedOffset = Number.parseInt(offsetParam, 10);
      if (!Number.isNaN(parsedOffset) && parsedOffset >= 0) {
        skip = parsedOffset;
      }
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        ssoAutoLink: true,
        mustChangePassword: true,
        createdAt: true,
        _count: {
          select: { shares: true },
        },
      },
      orderBy: { createdAt: "desc" },
      ...(take !== undefined ? { take } : {}),
      ...(skip !== undefined ? { skip } : {}),
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return internalError(request);
  }
}

/** Sets a user's password (lost password), optionally forcing them to pick their own at sign-in. */
async function setUserPassword(
  request: NextRequest,
  userId: unknown,
  password: unknown,
  mustChangePassword: unknown
): Promise<NextResponse> {
  if (typeof userId !== "string") {
    return apiError(request, ErrorCode.INVALID_REQUEST);
  }
  if (mustChangePassword !== undefined && typeof mustChangePassword !== "boolean") {
    return apiError(request, ErrorCode.INVALID_REQUEST);
  }
  if (typeof password !== "string" || !isValidPassword(password)) {
    return apiError(request, ErrorCode.PASSWORD_LENGTH, {
      min: PASSWORD_MIN_LENGTH,
      max: PASSWORD_MAX_LENGTH,
    });
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) {
    return apiError(request, ErrorCode.USER_NOT_FOUND);
  }

  const hashedPassword = await hashPassword(password);
  // One transaction: a reset link requested before the admin stepped in cannot be used between
  // the two writes to undo the new password
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        mustChangePassword: mustChangePassword === true,
        // Sessions opened with the old password (a compromised account, say) stop working
        sessionsValidFrom: new Date(),
      },
    }),
    revokePasswordResetTokens(userId),
  ]);
  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return apiError(request, ErrorCode.UNAUTHORIZED);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.isAdmin) {
    return apiError(request, ErrorCode.ADMIN_ONLY);
  }

  try {
    const { userId, action, password, mustChangePassword } = await request.json();

    if (!userId || !action) {
      return apiError(request, ErrorCode.MISSING_DATA);
    }

    // Arm or cancel the one-time SSO auto-link (allowed on self: it only affects the next SSO sign-in)
    if (action === "enableSsoAutoLink" || action === "disableSsoAutoLink") {
      await prisma.user.update({
        where: { id: userId },
        data: { ssoAutoLink: action === "enableSsoAutoLink" },
      });
      return NextResponse.json({ success: true });
    }

    if (userId === session.user.id && action !== "view") {
      return apiError(request, ErrorCode.FORBIDDEN);
    }

    if (action === "setPassword") {
      return await setUserPassword(request, userId, password, mustChangePassword);
    }

    if (action === "promote") {
      await prisma.user.update({
        where: { id: userId },
        data: { isAdmin: true },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "demote") {
      await prisma.user.update({
        where: { id: userId },
        data: { isAdmin: false },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      await prisma.user.delete({
        where: { id: userId },
      });
      return NextResponse.json({ success: true });
    }

    return apiError(request, ErrorCode.INVALID_REQUEST);
  } catch (error) {
    console.error("Error updating user:", error);
    return internalError(request);
  }
}

/** Validates the new-user payload, returning an error response if invalid. */
function validateNewUser(
  request: NextRequest,
  email: unknown,
  password: unknown,
  ssoAutoLink: unknown,
  mustChangePassword: unknown
): NextResponse | null {
  if (!email || typeof email !== "string") {
    return apiError(request, ErrorCode.EMAIL_PASSWORD_REQUIRED);
  }

  if (!isValidEmail(email)) {
    return apiError(request, ErrorCode.INVALID_EMAIL_FORMAT);
  }

  // Explicit boolean validation — reject non-boolean values (e.g. "true" as a string) with a 400
  if (ssoAutoLink !== undefined && typeof ssoAutoLink !== "boolean") {
    return apiError(request, ErrorCode.INVALID_REQUEST);
  }

  if (mustChangePassword !== undefined && typeof mustChangePassword !== "boolean") {
    return apiError(request, ErrorCode.INVALID_REQUEST);
  }

  // Password is required unless this is an SSO-only user
  if (ssoAutoLink !== true && (!password || typeof password !== "string")) {
    return apiError(request, ErrorCode.EMAIL_PASSWORD_REQUIRED);
  }

  // Validate password length whenever a password is provided, even for SSO users
  const hasPassword = password !== undefined && password !== null && password !== "";
  if (hasPassword && (typeof password !== "string" || !isValidPassword(password))) {
    return apiError(request, ErrorCode.PASSWORD_LENGTH, {
      min: PASSWORD_MIN_LENGTH,
      max: PASSWORD_MAX_LENGTH,
    });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return apiError(request, ErrorCode.UNAUTHORIZED);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.isAdmin) {
    return apiError(request, ErrorCode.ADMIN_ONLY);
  }

  try {
    const {
      email,
      name,
      password,
      isAdmin: makeAdmin,
      ssoAutoLink,
      mustChangePassword,
    } = await request.json();

    const validationError = validateNewUser(
      request,
      email,
      password,
      ssoAutoLink,
      mustChangePassword
    );
    if (validationError) return validationError;
    const ssoAutoLinkBool = ssoAutoLink === true;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return apiError(request, ErrorCode.USER_ALREADY_EXISTS);
    }

    const hashedPassword = password ? await hashPassword(password) : undefined;

    const newUser = await prisma.user.create({
      data: {
        email,
        name: name || undefined,
        password: hashedPassword,
        isAdmin: makeAdmin || false,
        ssoAutoLink: ssoAutoLinkBool,
        // Meaningless without a password to replace
        mustChangePassword: mustChangePassword === true && !!hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        ssoAutoLink: true,
        mustChangePassword: true,
        createdAt: true,
        _count: { select: { shares: true } },
      },
    });

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return internalError(request);
  }
}
