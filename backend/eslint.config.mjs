import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier";

const commonGlobals = {
  console: "readonly",
  process: "readonly",
  module: "readonly",
  require: "readonly",
  fetch: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
};

export default defineConfig([
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: commonGlobals,
    },
    rules: {
      "no-console": "off",
    },
  },
  prettier,
]);

