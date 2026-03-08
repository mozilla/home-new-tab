import { createRequire } from "node:module"
import { RuleTester } from "eslint"
import { describe, it } from "vitest"

const require = createRequire(import.meta.url)
const tsParser: any = require("@typescript-eslint/parser")

// Wire ESLint RuleTester to Vitest (avoids needing globals: true)
RuleTester.describe = describe
RuleTester.it = it

export const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
})
