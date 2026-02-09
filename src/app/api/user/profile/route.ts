import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
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
    const { name, email, currentPassword, newPassword } = data;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return apiError(request, ErrorCode.USER_NOT_FOUND);
    }

    const updateData: {
      name?: string;
      email?: string;
      password?: string;
    } = {};

    // Mise à jour du nom
    if (name !== undefined) {
      updateData.name = name;
    }

    // Mise à jour de l'email
    if (email !== undefined && email !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return apiError(request, ErrorCode.USER_ALREADY_EXISTS);
      }

      updateData.email = email;
    }

    // Mise à jour du mot de passe
    if (newPassword) {
      if (!currentPassword) {
        return apiError(request, ErrorCode.CURRENT_PASSWORD_REQUIRED);
      }

      if (!user.password) {
        return apiError(request, ErrorCode.FORBIDDEN);
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

      if (!isPasswordValid) {
        return apiError(request, ErrorCode.INCORRECT_CURRENT_PASSWORD);
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      updateData.password = hashedPassword;
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
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return internalError(request);
  }
}
