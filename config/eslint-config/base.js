import js from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import turboPlugin from "eslint-plugin-turbo"
import tseslint from "typescript-eslint"
import onlyWarn from "eslint-plugin-only-warn"
import perfectionist from "eslint-plugin-perfectionist"

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const baseConfig = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    plugins: {
      onlyWarn,
    },
  },
  {
    ignores: ["dist/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    plugins: {
      perfectionist,
    },
    rules: {
      "perfectionist/sort-exports": "off",
      "perfectionist/sort-named-exports": "off",
      "perfectionist/sort-jsx-props": "off",
      "perfectionist/sort-objects": "off",
      "perfectionist/sort-union-types": "off",
      "perfectionist/sort-object-types": "off",
      "perfectionist/sort-imports": [
        "error",
        {
          type: "natural",
          order: "asc",
          groups: [
            "ui-styles",
            { newlinesBetween: "never" },
            "testing",
            ["frameworks", "builtin", "external"],
            { newlinesBetween: "never" },
            ["internal"],
            { newlinesBetween: "never" },
            ["parent", "sibling", "index"],
            "object",
            [
              "type",
              "internal-type",
              "parent-type",
              "sibling-type",
              "index-type",
              "storybook-type",
            ],
            "unknown",
          ],
          customGroups: {
            value: {
              "ui-styles": [
                "style",
                "@ui/styles",
                "./style.module.css",
                "../style.module.css",
              ],
              frameworks: ["react", "react-*"],
              testing: [
                "@testing-library",
                "../__setup__",
                "../__mocks__",
                "json",
              ],
            },
            type: {
              "storybook-type": "@storybook/*",
            },
          },
          newlinesBetween: "always",
          partitionByComment: true,
          internalPattern: ["@ui/components", "@ui/styles"],
        },
      ],
    },
  },
]
