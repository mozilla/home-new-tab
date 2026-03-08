import baseConfig from "./base.js"
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
    },
    rules: {
      "fluent-l10n/no-missing-message": "warn",
    },
  },
]

export default componentConfig
