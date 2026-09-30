const tsJestOptions = {
  tsconfig: {
    jsx: "react-jsx",
    esModuleInterop: true,
    module: "commonjs",
    moduleResolution: "node",
    allowJs: true,
    skipLibCheck: true,
    strict: true,
    noEmit: true,
    isolatedModules: true,
    resolveJsonModule: true,
    paths: {
      "@/*": ["./src/*"],
    },
  },
};

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/", "<rootDir>/.worktrees/"],
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", tsJestOptions],
    // ESM-only dependencies (see transformIgnorePatterns) are transpiled to CommonJS
    "^.+\\.js$": ["ts-jest", tsJestOptions],
  },
  // htmlparser2 (used by sanitize-html) and its dependencies ship ESM only
  transformIgnorePatterns: [
    "/node_modules/(?!(?:.*/node_modules/)?(htmlparser2|domhandler|domutils|dom-serializer|domelementtype|entities)/)",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  // The default babel provider writes malformed lcov paths with ts-jest ("dir/file:/abs/path"), which SonarQube cannot match
  coverageProvider: "v8",
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts", "!src/generated/**"],
};

module.exports = config;
