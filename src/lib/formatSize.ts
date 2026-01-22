/**
 * Format bytes to a readable size string using either Binary (MiB/GiB) or Decimal (MB/GB) units
 * @param bytes - Size in bytes
 * @param useBinary - If true, use binary units (MiB/GiB), else use decimal (MB/GB)
 * @returns Formatted size string
 */
export function formatBytes(bytes: number, useBinary: boolean = false): string {
  if (bytes === 0) return "0 Bytes";

  const k = useBinary ? 1024 : 1000;
  const sizes = useBinary
    ? ["Bytes", "KiB", "MiB", "GiB", "TiB"]
    : ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = Math.round((bytes / Math.pow(k, i)) * 100) / 100;

  return `${value} ${sizes[i]}`;
}

/**
 * Convert megabytes to appropriate unit value based on settings
 * 
 * NOTE: Throughout this system, "MB" refers to MiB (binary megabytes = 1024² bytes),
 * NOT decimal MB (1,000,000 bytes). This is a common convention in file systems and
 * storage applications. All quota calculations use binary units internally.
 * 
 * @param megabytes - Size in MiB (mebibytes, 1024² bytes)
 * @param useGiB - If true, convert to GiB, else keep as MiB
 * @returns Size in requested unit
 */
export function convertFromMB(megabytes: number, useGiB: boolean): number {
  if (useGiB) {
    // 1 GiB = 1024 MiB
    return Math.round((megabytes / 1024) * 100) / 100;
  } else {
    // Return as MiB (no conversion needed since input is already MiB)
    return megabytes;
  }
}

/**
 * Convert from appropriate unit back to megabytes (MiB)
 * 
 * @param value - Size in units (MiB or GiB)
 * @param useGiB - If true, value is in GiB, else MiB
 * @returns Size in MiB (mebibytes, 1024² bytes)
 */
export function convertToMB(value: number, useGiB: boolean): number {
  if (useGiB) {
    // GiB to MiB: multiply by 1024
    return Math.round(value * 1024);
  } else {
    // Already in MiB, no conversion needed
    return Math.round(value);
  }
}

/**
 * Check if a value is in GiB units based on current settings
 */
export function isUsingGiB(
  isAuthenticated: boolean,
  useGiBForAnon: boolean,
  useGiBForAuth: boolean
): boolean {
  return isAuthenticated ? useGiBForAuth : useGiBForAnon;
}

/**
 * Get display unit label
 */
export function getUnitLabel(useGiB: boolean): string {
  return useGiB ? "GiB" : "MiB";
}
