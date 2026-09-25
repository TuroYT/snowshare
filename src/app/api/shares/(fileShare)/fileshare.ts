import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { storageFileExists } from "@/lib/storage";
import { ErrorCode } from "@/lib/api-errors";
import { getClientIp } from "@/lib/getClientIp";
import {
  checkShareAvailability,
  verifyDownloadToken,
  verifySharePassword,
  type DownloadTokenPurpose,
} from "@/lib/share-access";

export interface GetFileShareOptions {
  /** Incoming request, used to rate limit wrong passwords per client IP */
  request?: NextRequest;
  /** Signed token from createDownloadToken(); replaces the password when valid */
  token?: string | null;
}

export interface FileShareResult {
  errorCode?: ErrorCode;
  requiresPassword?: boolean;
  retryAfter?: number;
  share?: {
    id: string;
    slug: string;
    type: string;
    filePath: string | null;
    password: string | null;
    note: string | null;
    expiresAt: Date | null;
    isBulk: boolean;
    maxViews: number | null;
    viewCount: number;
    files?: { originalName: string; relativePath: string | null; size: bigint }[];
  };
  isBulk?: boolean;
  /** Purpose of a valid download token passed in options, if any */
  tokenPurpose?: DownloadTokenPurpose | null;
  storageKey?: string;
  originalFilename?: string;
}

export const getFileShare = async (
  slug: string,
  password?: string,
  { request, token }: GetFileShareOptions = {}
): Promise<FileShareResult> => {
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

  const tokenPurpose: DownloadTokenPurpose | null =
    token && request ? verifyDownloadToken(token, share.id, getClientIp(request)) : null;

  // A "download" token is issued after the view was counted, so the view limit is already settled
  const unavailable = checkShareAvailability(share, {
    ignoreViewLimit: tokenPurpose === "download",
  });
  if (unavailable) return unavailable;

  if (!tokenPurpose) {
    const denied = await verifySharePassword(request, share, password);
    if (denied) return denied;
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
      tokenPurpose,
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
    tokenPurpose,
    // storageKey is the relative filename used by storage.ts (local or S3)
    storageKey: share.filePath,
    originalFilename: share.filePath.split("_").slice(1).join("_"),
  };
};
