/** A share as returned by GET /api/user/shares (see src/lib/user-shares.ts). */
export type UserShare = {
  id: string;
  type: "FILE" | "PASTE" | "URL";
  slug: string;
  /** Original file name (single-file shares) */
  fileName?: string | null;
  isBulk?: boolean;
  paste?: string | null;
  pastelanguage?: string | null;
  /** Destination URL; null for password-protected links (stored encrypted) */
  urlOriginal?: string | null;
  hasPassword: boolean;
  createdAt: string;
  expiresAt?: string | null;
  maxViews?: number | null;
  viewCount: number;
  accessCount?: number;
};

/**
 * Body of PATCH /api/user/shares/:id.
 * `password`: omitted keeps it, null removes it, a string sets a new one.
 */
export type UserShareUpdate = {
  paste?: string;
  pastelanguage?: string;
  urlOriginal?: string;
  password?: string | null;
  expiresAt?: string | null;
};
