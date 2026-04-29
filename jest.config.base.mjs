export default {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  testTimeout: 30000,
  globalSetup: "./tests/setup/globalSetup.mjs",
  globalTeardown: "./tests/setup/globalTeardown.mjs",
  collectCoverageFrom: [
    "src/**/*.{js,mjs}",
    "!src/**/*.config.{js,mjs}",
    "!src/**/dist/**"
  ],
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html", "json"],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/tests/",
    "/dist/"
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
