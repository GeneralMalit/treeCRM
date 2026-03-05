import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

const commonGlobals = {
  console: "readonly",
  process: "readonly",
  fetch: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
};

export default defineConfig([
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "src/**/*.d.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: commonGlobals,
    },
    rules: {
      "no-console": "off",
    },
  },
  prettier,
]);
