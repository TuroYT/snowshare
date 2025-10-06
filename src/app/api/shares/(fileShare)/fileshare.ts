import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";


// File size limits (in bytes)
const MAX_FILE_SIZE_ANON = 0; // ANON disabled
const MAX_FILE_SIZE_AUTH = 50 * 1024 * 1024 * 1024; // 50GB for authenticated users

// Utility function to validate file
function validateFile(file: File, isAuthenticated: boolean) {
  // Check file size
  const maxSize = isAuthenticated ? MAX_FILE_SIZE_AUTH : MAX_FILE_SIZE_ANON;
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    return { error: `La taille du fichier dépasse la limite autorisée de ${maxSizeMB}MB.` };
  }


  // Check filename length and characters
  if (file.name.length > 255) {
    return { error: "Le nom du fichier est trop long (maximum 255 caractères)." };
  }

  // Basic filename validation (prevent path traversal)
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return { error: "Nom de fichier invalide." };
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
  expiresAt?: Date,
  slug?: string,
  password?: string
) => {
  const session = await getServerSession(authOptions);
  const isAuthenticated = !!session;

  // Validate file
  const validation = validateFile(file, isAuthenticated);
  if (validation.error) {
    return { error: validation.error };
  }

  // Validate slug if provided
  if (slug && !/^[a-zA-Z0-9_-]{3,30}$/.test(slug)) {
    return { error: "Slug invalide. Il doit contenir entre 3 et 30 caractères alphanumériques, des tirets ou des underscores." };
  }

  // Validate expiration date if provided
  if (expiresAt && new Date(expiresAt) <= new Date()) {
    return { error: "La date d'expiration doit être dans le futur." };
  }

  // Validate password if provided
  if (password) {
    if (password.length < 6 || password.length > 100) {
      return { error: "Le mot de passe doit contenir entre 6 et 100 caractères." };
    }
  }

  // Check anonymous user restrictions
  if (!session) {
    if (expiresAt) {
      const maxExpiry = new Date();
      maxExpiry.setDate(maxExpiry.getDate() + 7);
      if (new Date(expiresAt) > maxExpiry) {
        return { error: "Les utilisateurs non authentifiés ne peuvent pas créer de partages expirant au-delà de 7 jours." };
      }
    } else {
      return { error: "Les utilisateurs non authentifiés doivent fournir une date d'expiration." };
    }
  }

  // Hash password if provided
  let hashedPassword = null;
  if (password) {
    hashedPassword = await bcrypt.hash(password, 12);
  }

  // Generate unique slug if not provided
  if (!slug) {
    const generateSlug = () => {
      return Math.random().toString(36).substring(2, 8);
    };
    do {
      slug = generateSlug();
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
      },
    });

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads');
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
    return { error: "Erreur lors de la création du partage de fichier." };
  }
};

export const getFileShare = async (slug: string, password?: string) => {
  const share = await prisma.share.findUnique({ where: { slug } });
  
  if (!share || share.type !== "FILE") {
    return { error: "Partage de fichier introuvable." };
  }

  if (share.expiresAt && new Date(share.expiresAt) <= new Date()) {
    return { error: "Ce partage a expiré." };
  }

  // Check password if required
  if (share.password) {
    if (!password) {
      return { error: "Mot de passe requis.", requiresPassword: true };
    }
    
    const passwordValid = await bcrypt.compare(password, share.password);
    if (!passwordValid) {
      return { error: "Mot de passe incorrect." };
    }
  }

  if (!share.filePath) {
    return { error: "Fichier introuvable." };
  }

  const filePath = path.join(process.cwd(), 'uploads', share.filePath);
  if (!existsSync(filePath)) {
    return { error: "Fichier physique introuvable." };
  }

  return { 
    share,
    filePath,
    originalFilename: share.filePath.split('_').slice(1).join('_') // Extract original name
  };
};