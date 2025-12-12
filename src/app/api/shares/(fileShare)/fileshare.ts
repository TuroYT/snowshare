import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { NextRequest } from "next/server";
import { checkUploadQuota } from "@/lib/quota";
import { getClientIp } from "@/lib/getClientIp";
import crypto from "crypto";
import { getUploadDir } from "@/lib/constants";

// Utility function to validate file
async function validateFile(file: File, isAuthenticated: boolean) {
  // Get settings from database for max file size
  const settings = await prisma.settings.findFirst();
  const maxSize = isAuthenticated
    ? (settings?.authMaxUpload || 51200) * 1024 * 1024 // Convert MB to bytes
    : (settings?.anoMaxUpload || 2048) * 1024 * 1024;

  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    return { error: `File size exceeds the allowed limit of ${maxSizeMB}MB.` };
  }


  // Check filename length and characters
  if (file.name.length > 255) {
    return { error: "Filename is too long (maximum 255 characters)." };
  }

  // Basic filename validation (prevent path traversal)
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return { error: "Invalid filename." };
  }

  return { valid: true };
}

// Generate safe filename
function generateSafeFilename(originalName: string, shareId: string): string {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${shareId}_${baseName}${ext}`;
}

export const createFileShare = async (
  file: File,
  request: NextRequest,
  expiresAt?: Date,
  slug?: string,
  password?: string
) => {
  const session = await getServerSession(authOptions);
  const isAuthenticated = !!session;

  // Get client IP for quota tracking
  const clientIp = getClientIp(request);

  // Convert file size to MB
  const fileSizeMB = file.size / (1024 * 1024);

  // Check upload quota
  const quotaCheck = await checkUploadQuota(request, fileSizeMB);
  if (!quotaCheck.allowed) {
    return { error: quotaCheck.reason || "Quota d'upload dépassé." };
  }

  // Validate file
  const validation = await validateFile(file, isAuthenticated);
  if (validation.error) {
    return { error: validation.error };
  }

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
    // Create the file share in database first
    const fileShare = await prisma.share.create({
      data: {
        type: "FILE",
        slug,
        password: hashedPassword,
        expiresAt,
        ownerId: session?.user?.id || null,
        filePath: null, // Will be updated after file save
        ipSource: clientIp, // Store IP for quota tracking
      },
    });

    // Create uploads directory if it doesn't exist
    const uploadsDir = getUploadDir();
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate safe filename and save file
    const safeFilename = generateSafeFilename(file.name, fileShare.id);
    const filePath = path.join(uploadsDir, safeFilename);
    
    // Convert File to Buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Update the share with the file path
    const updatedFileShare = await prisma.share.update({
      where: { id: fileShare.id },
      data: { 
        filePath: safeFilename,
        // Store original filename and size as metadata (we'll add these fields later if needed)
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