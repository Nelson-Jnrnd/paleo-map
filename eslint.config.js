// ESLint flat config (SPEC-002 REQ-009, NFR-002). TypeScript + React with
// eslint-plugin-jsx-a11y as the lint-time accessibility gate (axe covers runtime).
// Prettier owns formatting, so eslint-config-prettier disables stylistic rules.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  // `tools/spec-pdf` is a standalone CommonJS build helper, not product code.
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "public/**",
      "tools/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // App + browser (React) sources.
  {
    files: ["src/app/**/*.{ts,tsx}"],
    plugins: { react, "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
  // Node scripts + pipeline + tests use node globals.
  {
    files: ["scripts/**/*.ts", "src/pipeline/**/*.ts", "test/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
);
