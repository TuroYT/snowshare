import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { storageFileExists } from "@/lib/storage";
import { ErrorCode } from "@/lib/api-errors";

export const getFileShare = async (slug: string, password?: string) => {
  const share = await prisma.share.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      type: true,
      filePath: true,
      password: true,
      note: true,
      expiresAt: true,
      isBulk: true,
      maxViews: true,
      viewCount: true,
    },
  });

  if (!share || share.type !== "FILE") {
    return { errorCode: ErrorCode.SHARE_NOT_FOUND };
  }

  if (share.expiresAt && new Date(share.expiresAt) <= new Date()) {
    return { errorCode: ErrorCode.SHARE_EXPIRED };
  }

  if (share.maxViews !== null && share.viewCount >= share.maxViews) {
    return { errorCode: ErrorCode.SHARE_EXPIRED };
  }

  if (share.password) {
    if (!password) {
      return { errorCode: ErrorCode.PASSWORD_REQUIRED, requiresPassword: true };
    }

    const passwordValid = await bcrypt.compare(password, share.password);
    if (!passwordValid) {
      return { errorCode: ErrorCode.PASSWORD_INCORRECT };
    }
  }

  if (share.isBulk) {
    const files = await prisma.shareFile.findMany({
      where: { shareId: share.id },
      select: {
        originalName: true,
        relativePath: true,
        size: true,
      },
    });

    return {
      share: { ...share, files },
      isBulk: true,
    };
  }

  if (!share.filePath) {
    return { errorCode: ErrorCode.FILE_NOT_FOUND };
  }

  if (!(await storageFileExists(share.filePath))) {
    return { errorCode: ErrorCode.FILE_NOT_FOUND };
  }

  return {
    share,
    // storageKey is the relative filename used by storage.ts (local or S3)
    storageKey: share.filePath,
    originalFilename: share.filePath.split("_").slice(1).join("_"),
  };
};
