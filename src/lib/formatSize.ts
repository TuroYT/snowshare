/** Binary units (KiB, MiB...) when `useBinary`, decimal (KB, MB...) otherwise. */
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

const MIB_PER_GIB = 1024;

function mibToGiB(mebibytes: number): number {
  return Math.round((mebibytes / MIB_PER_GIB) * 100) / 100;
}

/** Throughout the app "MB" means MiB (1024² bytes), not decimal MB. */
export function convertFromMB(megabytes: number, useGiB: boolean): number {
  return useGiB ? mibToGiB(megabytes) : megabytes;
}

/** Inverse of convertFromMB: value in MiB or GiB back to MiB. */
export function convertToMB(value: number, useGiB: boolean): number {
  // 1024 for GiB, 1 for MiB (1024 ** 0)
  return Math.round(value * MIB_PER_GIB ** Number(useGiB));
}

export function isUsingGiB(
  isAuthenticated: boolean,
  useGiBForAnon: boolean,
  useGiBForAuth: boolean
): boolean {
  return isAuthenticated ? useGiBForAuth : useGiBForAnon;
}

export function getUnitLabel(useGiB: boolean): string {
  return useGiB ? "GiB" : "MiB";
}
