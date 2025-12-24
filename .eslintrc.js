module.exports = {
  extends: ["next/core-web-vitals", "next/typescript"],
  rules: {
    // Disable the base rule as it causes false positives with TS types
    "no-unused-vars": "off",

    // Enable the TypeScript specific rule
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }
    ],

    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    "eqeqeq": ["error", "smart"],
  }
};