import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  // Ignore patterns first
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      "build/**",
      "coverage/**",
      ".git/**",
      "uploads/**",
      "src/generated/**",
      "prisma/migrations/**",
      "**/.*",
    ],
  },

  // Base ESLint recommended rules
  js.configs.recommended,

  // Next.js and TypeScript configs via FlatCompat
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // Custom rules for all files
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
      eqeqeq: ["error", "smart"],
    },
  },

  // Forbid relative parent imports (../) within src — project convention is the @/ alias.
  // Scoped to components/hooks/lib/app: some src files (e.g. tests under src/__tests__)
  // legitimately reach outside src/ (no @/ mapping exists for that), so they are excluded.
  {
    files: [
      "src/components/**/*.{js,jsx,ts,tsx}",
      "src/hooks/**/*.{js,jsx,ts,tsx}",
      "src/lib/**/*.{js,jsx,ts,tsx}",
      "src/app/**/*.{js,jsx,ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["../*"],
        },
      ],
    },
  },
]);
