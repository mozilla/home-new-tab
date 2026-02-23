import noMutationInSetter from "./rules/no-mutation-in-setter.ts"
import noSelectorAllocations from "./rules/no-selector-allocations.ts"

import type { ESLint } from "eslint"

const plugin: ESLint.Plugin = {
  rules: {
    "no-selector-allocations": noSelectorAllocations as any,
    "no-mutation-in-setter": noMutationInSetter as any,
  },
}

export default plugin
