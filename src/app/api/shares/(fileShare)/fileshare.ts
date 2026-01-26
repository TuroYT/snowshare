import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

import path from "path";

import { getUploadDir } from "@/lib/constants";
import { existsSync } from "fs";



export const getFileShare = async (slug: string, password?: string) => {
  const share = await prisma.share.findUnique({ 
    where: { slug },
    include: {
      files: true,
    }
  });
  
  if (!share || share.type !== "FILE") {
    return { error: "File share not found." };
  }

  if (share.expiresAt && new Date(share.expiresAt) <= new Date()) {
    return { error: "This share has expired." };
  }

  if (share.password) {
    if (!password) {
      return { error: "Password required.", requiresPassword: true };
    }
    
    const passwordValid = await bcrypt.compare(password, share.password);
    if (!passwordValid) {
      return { error: "Incorrect password." };
    }
  }

  if (share.isBulk) {
    return { 
      share,
      isBulk: true,
    };
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
    originalFilename: share.filePath.split('_').slice(1).join('_')
  };
};