/**
 * Validation utilities for share operations
 */

/**
 * Validates an OAuth provider display name
 */
export function isValidDisplayName(
  displayName: string,
  maxLength = 100
): { valid: boolean; error?: string } {
  if (typeof displayName !== "string") {
    return { valid: false, error: "displayName must be a string" };
  }
  const trimmed = displayName.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "displayName is required" };
  }
  if (trimmed.length > maxLength) {
    return { valid: false, error: `displayName must be at most ${maxLength} characters` };
  }
  return { valid: true };
}
