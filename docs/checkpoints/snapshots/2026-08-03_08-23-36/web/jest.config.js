const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  moduleDirectories: ["node_modules", "<rootDir>/"],
  testEnvironment: "jest-environment-node",
  // API route tests need a database URL and JWT secrets before any module imports
  // PrismaClient or lib/auth, so this runs before the test framework is installed.
  setupFiles: ["<rootDir>/jest.setup.api.js"],
  // __tests__/helpers holds shared fixtures, not specs.
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/__tests__/helpers/"],
  testTimeout: 30000,
  // API suites truncate and rebuild the shared test database, so parallel workers
  // would race each other's fixtures. The whole suite runs in ~15s serially.
  maxWorkers: 1,
};

module.exports = createJestConfig(customJestConfig);
