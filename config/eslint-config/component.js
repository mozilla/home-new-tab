import baseConfig from "./base.js"
import stateHygiene from "./plugins/state-hygiene/index.ts"

export const componentConfig = [
  ...baseConfig,
  {
    plugins: { "state-hygiene": stateHygiene },
    rules: {
      "state-hygiene/no-selector-allocations": "error",
      "state-hygiene/no-mutation-in-setter": "error",
    },
  },
]

export default componentConfig
