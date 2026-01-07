/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/packages"],
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: {
    "^@medli/spec$": "<rootDir>/packages/spec/src",
    "^@medli/generator-procedural$":
      "<rootDir>/packages/generators/procedural/src",
    "^@medli/generator-object$": "<rootDir>/packages/generators/object/src",
    "^@medli/renderer-common$": "<rootDir>/packages/renderers/common/src",
    "^@medli/renderer-svg$": "<rootDir>/packages/renderers/svg/src",
    "^@medli/renderer-canvas$": "<rootDir>/packages/renderers/canvas/src",
  },
  collectCoverageFrom: ["packages/**/src/**/*.ts", "!packages/**/src/**/*.d.ts"],
};
