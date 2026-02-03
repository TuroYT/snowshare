import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

import path from "path";

import { getUploadDir } from "@/lib/constants";
import { existsSync } from "fs";
import { ErrorCode } from "@/lib/api-errors";

export const getFileShare = async (slug: string, password?: string) => {
  const share = await prisma.share.findUnique({ where: { slug } });

  if (!share || share.type !== "FILE") {
    return { errorCode: ErrorCode.SHARE_NOT_FOUND };
  }

  if (share.expiresAt && new Date(share.expiresAt) <= new Date()) {
    return { errorCode: ErrorCode.SHARE_EXPIRED };
  }

  // Check password if required
  if (share.password) {
    if (!password) {
      return { errorCode: ErrorCode.PASSWORD_REQUIRED, requiresPassword: true };
    }

    const passwordValid = await bcrypt.compare(password, share.password);
    if (!passwordValid) {
      return { errorCode: ErrorCode.PASSWORD_INCORRECT };
    }
  }

  if (!share.filePath) {
    return { errorCode: ErrorCode.FILE_NOT_FOUND };
  }

  const filePath = path.join(getUploadDir(), share.filePath);
  if (!existsSync(filePath)) {
    return { errorCode: ErrorCode.FILE_NOT_FOUND };
  }

  return {
    share,
    filePath,
    originalFilename: share.filePath.split('_').slice(1).join('_') // Extract original name
  };
};
