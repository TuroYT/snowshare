import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { isValidEmail, isValidPassword, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "@/lib/constants";
import bcryptjs from "bcryptjs";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return apiError(request, ErrorCode.UNAUTHORIZED);
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.isAdmin) {
    return apiError(request, ErrorCode.ADMIN_ONLY);
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        createdAt: true,
        _count: {
          select: { shares: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return internalError(request);
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return apiError(request, ErrorCode.UNAUTHORIZED);
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.isAdmin) {
    return apiError(request, ErrorCode.ADMIN_ONLY);
  }

  try {
    const { userId, action } = await request.json();

    if (!userId || !action) {
      return apiError(request, ErrorCode.MISSING_DATA);
    }

    // Prevent self-modification
    if (userId === session.user.id && action !== "view") {
      return apiError(request, ErrorCode.FORBIDDEN);
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

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return apiError(request, ErrorCode.UNAUTHORIZED);
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.isAdmin) {
    return apiError(request, ErrorCode.ADMIN_ONLY);
  }

  try {
    const { email, name, password, isAdmin: makeAdmin } = await request.json();

    // Validate input
    if (!email || typeof email !== "string") {
      return apiError(request, ErrorCode.EMAIL_PASSWORD_REQUIRED);
    }

    if (!isValidEmail(email)) {
      return apiError(request, ErrorCode.INVALID_EMAIL_FORMAT);
    }

    if (!password || typeof password !== "string") {
      return apiError(request, ErrorCode.EMAIL_PASSWORD_REQUIRED);
    }

    if (!isValidPassword(password)) {
      return apiError(request, ErrorCode.PASSWORD_LENGTH, {
        min: PASSWORD_MIN_LENGTH,
        max: PASSWORD_MAX_LENGTH
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return apiError(request, ErrorCode.USER_ALREADY_EXISTS);
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 12);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        name: name || undefined,
        password: hashedPassword,
        isAdmin: makeAdmin || false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        createdAt: true,
        _count: {
          select: { shares: true },
        },
      },
    });

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return internalError(request);
  }
}