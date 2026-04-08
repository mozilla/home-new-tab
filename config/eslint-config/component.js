import baseConfig from "./base.js"
import jsxA11y from "eslint-plugin-jsx-a11y"
import stateHygiene from "./plugins/state-hygiene/index.ts"
import noMissingMessage from "./plugins/fluent-l10n/index.ts"

export const componentConfig = [
  ...baseConfig,
  {
    plugins: { "state-hygiene": stateHygiene },
    rules: {
      "state-hygiene/no-selector-allocations": "error",
      "state-hygiene/no-mutation-in-setter": "error",
    },
  },
  {
    files: ["**/*.tsx"],
    plugins: {
      "fluent-l10n": noMissingMessage,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      "fluent-l10n/no-missing-message": "warn",
      ...jsxA11y.configs.recommended.rules,
      // Fluent injects heading content at runtime via data-l10n-id. The rule
      // cannot see that and fires on every localized heading. The
      // fluent-l10n/no-missing-message rule is the enforcement mechanism here.
      "jsx-a11y/heading-has-content": "off",
    },
  },
]

export default componentConfig
