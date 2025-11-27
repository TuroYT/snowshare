/**
 * Valid paste language types - must match the pasteType enum in the Prisma schema
 */
export const VALID_PASTE_LANGUAGES = [
  'PLAINTEXT',
  'JAVASCRIPT',
  'TYPESCRIPT',
  'PYTHON',
  'JAVA',
  'PHP',
  'GO',
  'HTML',
  'CSS',
  'SQL',
  'JSON',
  'MARKDOWN',
] as const;

export type PasteLanguage = (typeof VALID_PASTE_LANGUAGES)[number];

/**
 * Validate if a string is a valid paste language
 */
export function isValidPasteLanguage(language: string): language is PasteLanguage {
  return VALID_PASTE_LANGUAGES.includes(language as PasteLanguage);
}
