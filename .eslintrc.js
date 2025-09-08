/**
 * ESLint config (CommonJS)
 *
 * This file provides a compact, sensible default for a Next.js + React +
 * TypeScript project. It keeps `eslint:recommended` and adds React-related
 * settings. If you want stricter TypeScript linting, install
 * @typescript-eslint/parser and @typescript-eslint/eslint-plugin and enable
 * the corresponding rules.
 *
 * Optional plugins you may want to install:
 *   npm install -D eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y
 *   npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
 */

module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  // Base rules. `eslint:recommended` is always useful; Next's flat config
  // (eslint.config.mjs) is also present and will be used in newer setups.
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      // Let eslint-plugin-react detect the React version if installed
      version: "detect",
    },
  },
  rules: {
    // Common stylistic and safety rules (adjust to taste)
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    "eqeqeq": ["error", "smart"],
    "curly": ["error", "all"],

    // React-specific reminders (these require eslint-plugin-react to be installed)
    "react/react-in-jsx-scope": "off", // not needed with modern React
    "react/jsx-uses-react": "off",
  },
  overrides: [
    {
      // TypeScript files: if you install @typescript-eslint, switch parser
      files: ["**/*.ts", "**/*.tsx"],
      rules: {
        // Example: allow unused vars that start with _ (useful for placeholders)
        "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      },
    },
    {
      files: ["**/*.md"],
      rules: {
        // Docs often contain code blocks; relax some rules there
        "no-unused-expressions": "off",
      },
    },
  ],
};