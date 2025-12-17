import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import path from "path";
import { existsSync, renameSync } from "fs";
import { NextRequest } from "next/server";
import { getClientIp } from "@/lib/getClientIp";
import crypto from "crypto";
import { getUploadDir } from "@/lib/constants";
import type { ParsedFile } from "@/lib/multipart-parser";


// Generate safe filename
function generateSafeFilename(originalName: string, shareId: string): string {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${shareId}_${baseName}${ext}`;
}

/**
 * Create a file share from a streamed file (already saved to temp location)
 * This version doesn't load the file into memory
 * Note: File size, filename validation, and IP quota are already checked in multipart-parser.ts
 */
export const createFileShareFromStream = async (
  file: ParsedFile,
  request: NextRequest,
  expiresAt?: Date,
  slug?: string,
  password?: string
) => {
  const session = await getServerSession(authOptions);

  // Get client IP for storing with the share
  const clientIp = getClientIp(request);
  // Validate slug if provided
  if (slug && !/^[a-zA-Z0-9_-]{3,30}$/.test(slug)) {
    return { error: "Invalid slug. It must contain between 3 and 30 alphanumeric characters, dashes or underscores." };
  }

  // Validate expiration date if provided
  if (expiresAt && new Date(expiresAt) <= new Date()) {
    return { error: "Expiration date must be in the future." };
  }

  // Validate password if provided
  if (password) {
    if (password.length < 6 || password.length > 100) {
      return { error: "Password must be between 6 and 100 characters." };
    }
  }

  // Check anonymous user restrictions
  if (!session) {
    if (expiresAt) {
      const maxExpiry = new Date();
      maxExpiry.setDate(maxExpiry.getDate() + 7);
      if (new Date(expiresAt) > maxExpiry) {
        return { error: "Unauthenticated users cannot create shares that expire beyond 7 days." };
      }
    } else {
      return { error: "Unauthenticated users must provide an expiration date." };
    }
  }

  // Hash password if provided
  let hashedPassword = null;
  if (password) {
    hashedPassword = await bcrypt.hash(password, 12);
  }

  // Generate unique slug if not provided using cryptographically secure random
  if (!slug) {
    const generateSecureSlug = () => {
      return crypto.randomBytes(6).toString('base64url');
    };
    do {
      slug = generateSecureSlug();
    } while (await prisma.share.findUnique({ where: { slug } }));
  }

  try {
    // Create the file share in database
    const fileShare = await prisma.share.create({
      data: {
        type: "FILE",
        slug,
        password: hashedPassword,
        expiresAt,
        ownerId: session?.user?.id || null,
        filePath: null, // Will be updated after file rename
        ipSource: clientIp, // Store IP for quota tracking
      },
    });

    // Generate safe filename and rename temp file to final location
    const uploadsDir = getUploadDir();
    const safeFilename = generateSafeFilename(file.originalName, fileShare.id);
    const finalPath = path.join(uploadsDir, safeFilename);
    
    // Rename temp file to final location (atomic operation, no memory usage)
    renameSync(file.tempPath, finalPath);

    // Update the share with the file path
    const updatedFileShare = await prisma.share.update({
      where: { id: fileShare.id },
      data: { 
        filePath: safeFilename,
      },
    });

    return { fileShare: updatedFileShare };
  } catch (error) {
    console.error("Error creating file share:", error);
    return { error: "Error creating file share." };
  }
};

export const getFileShare = async (slug: string, password?: string) => {
  const share = await prisma.share.findUnique({ where: { slug } });
  
  if (!share || share.type !== "FILE") {
    return { error: "File share not found." };
  }

  if (share.expiresAt && new Date(share.expiresAt) <= new Date()) {
    return { error: "This share has expired." };
  }

  // Check password if required
  if (share.password) {
    if (!password) {
      return { error: "Password required.", requiresPassword: true };
    }
    
    const passwordValid = await bcrypt.compare(password, share.password);
    if (!passwordValid) {
      return { error: "Incorrect password." };
    }
  }

  if (!share.filePath) {
    return { error: "File not found." };
  }

  const filePath = path.join(getUploadDir(), share.filePath);
  if (!existsSync(filePath)) {
    return { error: "Physical file not found." };
  }

  return { 
    share,
    filePath,
    originalFilename: share.filePath.split('_').slice(1).join('_') // Extract original name
  };
};