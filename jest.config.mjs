export default {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.mjs"],
  testTimeout: 30000,
  globalSetup: "./tests/setup/globalSetup.js",
  globalTeardown: "./tests/setup/globalTeardown.js",
};
