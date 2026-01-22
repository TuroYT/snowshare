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
 * @param megabytes - Size in megabytes (MB)
 * @param useGiB - If true, convert to GiB, else keep as MiB
 * @returns Size in requested unit
 */
export function convertFromMB(megabytes: number, useGiB: boolean): number {
  if (useGiB) {
    // 1 GiB = 1024 MiB
    return Math.round((megabytes / 1024) * 100) / 100;
  } else {
    // MiB = MB (roughly, 1 MB = 1 MiB for practical purposes)
    return megabytes;
  }
}

/**
 * Convert from appropriate unit back to megabytes
 * @param value - Size in units (MiB or GiB)
 * @param useGiB - If true, value is in GiB, else MiB
 * @returns Size in megabytes
 */
export function convertToMB(value: number, useGiB: boolean): number {
  if (useGiB) {
    // GiB to MB: multiply by 1024
    return Math.round(value * 1024);
  } else {
    // MiB to MB: 1:1 ratio
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
 * Convert MB to display unit (MiB or GiB)
 */
export function convertFromMBForDisplay(megabytes: number, useGiB: boolean): number {
  if (useGiB) {
    // 1 GiB = 1024 MiB
    return Math.round((megabytes / 1024) * 100) / 100;
  } else {
    // Return as MiB (treated as 1:1 with MB for display simplification)
    // Note: Technically 1 MiB = 1.048576 MB, but we simplify for display
    return megabytes;
  }
}

/**
 * Get display unit label
 */
export function getUnitLabel(useGiB: boolean): string {
  return useGiB ? "GiB" : "MiB";
}
