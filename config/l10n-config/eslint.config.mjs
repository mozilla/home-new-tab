/**
 * Local ESLint config for @config/l10n-config
 *
 * IMPORTANT
 * ---------
 * This package intentionally does NOT import the repo's shared ESLint config.
 *
 * Why:
 * This package provides shared localization helpers that are consumed by
 * tooling such as:
 *
 * - ESLint plugins
 * - VS Code extensions
 * - build tooling
 *
 * Importing the shared ESLint config here would create a circular dependency:
 *
 *   eslint-plugin-fluent → @config/l10n-config
 *   eslint-config → eslint-plugin-fluent
 *   @config/l10n-config → eslint-config   ❌
 *
 * So this file uses a very small standalone config instead.
 */

import js from "@eslint/js"
import globals from "globals"

export default [
  js.configs.recommended,

  {
    files: ["**/*.ts"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",

      globals: {
        ...globals.node,
      },
    },

    rules: {
      // keep this intentionally light
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
]
