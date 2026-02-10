import crypto from "crypto"

/**
 * Special sentinel value to indicate a masked secret
 * Using a unique string that's unlikely to be an actual password
 */
export const MASKED_SECRET_SENTINEL = "__MASKED_SECRET_DO_NOT_CHANGE__"

/**
 * Hash a secret for comparison purposes
 * Uses SHA-256 for deterministic hashing
 */
function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex")
}

/**
 * Store of secret hashes for comparison
 * Maps field names to their hashed values
 */
const secretHashStore = new Map<string, string>()

/**
 * Mask a secret value for API responses
 * Returns sentinel value if secret exists, null otherwise
 * 
 * @param secret - The secret to mask
 * @param fieldName - Unique identifier for this secret field
 * @returns Masked value or null
 */
export function maskSecret(secret: string | null, fieldName: string): string | null {
  if (!secret) {
    return null
  }

  // Store hash of the original secret
  const hash = hashSecret(secret)
  secretHashStore.set(fieldName, hash)

  return MASKED_SECRET_SENTINEL
}

/**
 * Check if a value is the masked sentinel
 */
export function isMaskedSecret(value: string | null | undefined): boolean {
  return value === MASKED_SECRET_SENTINEL
}

/**
 * Unmask a secret value for database updates
 * Returns the new value if changed, or retrieves original if masked
 * 
 * @param newValue - The value from the update request
 * @param fieldName - Unique identifier for this secret field
 * @param originalValue - The original secret from database
 * @returns The value to use for update
 */
export function unmaskSecret(
  newValue: string | null | undefined,
  fieldName: string,
  originalValue: string | null
): string | null {
  // If new value is null/undefined, clear the secret
  if (newValue === null || newValue === undefined) {
    secretHashStore.delete(fieldName)
    return null
  }

  // If new value is the sentinel, keep original value
  if (isMaskedSecret(newValue)) {
    return originalValue
  }

  // New value provided, update hash
  const hash = hashSecret(newValue)
  secretHashStore.set(fieldName, hash)

  return newValue
}

/**
 * Verify if a secret has been modified by comparing hashes
 * 
 * @param secret - The secret to verify
 * @param fieldName - Unique identifier for this secret field
 * @returns True if secret matches stored hash
 */
export function verifySecretUnchanged(secret: string, fieldName: string): boolean {
  const storedHash = secretHashStore.get(fieldName)
  if (!storedHash) {
    return false
  }

  const currentHash = hashSecret(secret)
  return currentHash === storedHash
}

/**
 * Clear stored hash for a secret field
 * Useful when deleting settings or during cleanup
 */
export function clearSecretHash(fieldName: string): void {
  secretHashStore.delete(fieldName)
}

/**
 * Clear all stored secret hashes
 * Useful for tests or when restarting the application
 */
export function clearAllSecretHashes(): void {
  secretHashStore.clear()
}
