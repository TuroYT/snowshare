import type { Prisma } from "@/generated/prisma";

/**
 * Fields selected for a share listed in the owner's profile.
 * The password hash and storage key are read only to derive safe fields.
 */
export const USER_SHARE_SELECT = {
  id: true,
  type: true,
  slug: true,
  filePath: true,
  isBulk: true,
  paste: true,
  pastelanguage: true,
  urlOriginal: true,
  password: true,
  createdAt: true,
  expiresAt: true,
  maxViews: true,
  viewCount: true,
  _count: {
    select: { accessLogs: true },
  },
} satisfies Prisma.ShareSelect;

type UserShareRow = Prisma.ShareGetPayload<{ select: typeof USER_SHARE_SELECT }>;

/**
 * Shape returned to the profile page: never exposes the password hash or the storage key.
 * - `hasPassword` replaces `password`
 * - `fileName` replaces `filePath` (storage key is `<shareId>_<originalName>`)
 * - `urlOriginal` is null for password-protected links (it is stored encrypted)
 */
export function toUserShare({ _count, password, filePath, urlOriginal, ...share }: UserShareRow) {
  return {
    ...share,
    hasPassword: !!password,
    fileName: filePath ? filePath.split("_").slice(1).join("_") : null,
    urlOriginal: password ? null : urlOriginal,
    accessCount: _count.accessLogs,
  };
}

export type UserShare = ReturnType<typeof toUserShare>;
