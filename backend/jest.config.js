module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/?(*.)+(spec|test).js"],
  collectCoverageFrom: ["src/**/*.js", "!src/server.js"],
  verbose: true,
};
