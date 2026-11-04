// Flat ESLint configuration for the evaluation suite.
// Every source file runs under Bun (Node-compatible runtime): browser globals
// must not leak in, and generated run artifacts are never linted.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/**", "runs/**", "reports/**", "dist/**", "coverage/**"] },
  {
    files: ["scripts/**/*.ts", "tests/**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node, Bun: "readonly" },
    },
  },
  {
    files: ["eslint.config.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node },
    },
  },
);
