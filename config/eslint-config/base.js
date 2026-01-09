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
          sortSideEffects: true,

          // v5: boolean / regexp config (not a number)
          partitionByComment: true,

          // v5: regexp patterns
          internalPattern: ["^@ui/", "^@common/", "^@config/"],

          // Global default between major groups
          newlinesBetween: 1,

          groups: [
            "styles",
            { newlinesBetween: 1 },

            "testing",
            { newlinesBetween: 1 },

            //All value imports (sorted within their sub-groups)
            ["value-builtin", "value-external", "value-internal"],
            { newlinesBetween: 0 },
            ["value-parent", "value-sibling", "value-index"],
            { newlinesBetween: 0 },
            "data", //Explicit data entries (state and the line)
            { newlinesBetween: 1 },

            //All type imports last
            ["type-builtin", "type-external", "type-internal"],
            { newlinesBetween: 0 },
            ["type-parent", "type-sibling", "type-index"],
            "unknown",
          ],

          customGroups: [
            {
              groupName: "styles",
              elementNamePattern: "\\.(css|scss|sass|less|styl)$",
            },
            {
              groupName: "testing",
              newlinesInside: 0,
              elementNamePattern: [
                "^@testing-library(?:/.+)?$",
                "^vitest$",
                "^\\.\\./__setup__(?:/.+)?$",
                "^\\.\\./__mocks__(?:/.+)?$",
                "^.+\\.json$",
              ],
            },
            {
              groupName: "data",
              elementNamePattern: ["^@data/"],
            },
          ],
        },
      ],
    },
  },
]
