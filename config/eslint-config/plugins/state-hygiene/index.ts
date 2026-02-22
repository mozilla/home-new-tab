import noMutationInSetter from "./rules/no-mutation-in-setter.js"
import noSelectorAllocations from "./rules/no-selector-allocations.js"

import type { ESLint } from "eslint"

const plugin: ESLint.Plugin = {
  rules: {
    "no-selector-allocations": noSelectorAllocations as any,
    "no-mutation-in-setter": noMutationInSetter as any,
  },
}

export default plugin
