// NEXT_PUBLIC_* vars are inlined at build time — changing this requires a rebuild.
export function resolveDefaultLocale(supported: readonly string[]): string {
  const env = process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "en";
  return supported.includes(env) ? env : "en";
}
