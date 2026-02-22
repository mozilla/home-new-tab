import type { TSESTree } from "@typescript-eslint/types"

const DATA_STATE_RE = /^@data\/state\/.+/
const HOOK_RE = /^use[A-Z]/

export type TargetBindings = {
  selectorHooks: Set<string> // call sites we lint (e.g. useTimer)
  setterFns: Set<string> // names that behave like set(...) inside stores (optional)
}

export function createTargetBindings(): TargetBindings {
  return {
    selectorHooks: new Set<string>(),
    setterFns: new Set<string>(),
  }
}

export function collectTargetsFromImport(
  bindings: TargetBindings,
  node: TSESTree.ImportDeclaration,
) {
  const source = node.source.value
  if (typeof source !== "string") return

  // 1) Any hook imported from @data/state/*
  if (DATA_STATE_RE.test(source)) {
    for (const spec of node.specifiers) {
      if (spec.type !== "ImportSpecifier") continue
      const local = spec.local.name
      if (HOOK_RE.test(local)) bindings.selectorHooks.add(local)
    }
    return
  }

  // 2) Optional: if a file imports these, treat them as selector-hook call sites too
  // (useful for infra / tests / non-standard code)
  if (source === "zustand" || source === "zustand/react") {
    for (const spec of node.specifiers) {
      if (spec.type !== "ImportSpecifier") continue
      const imported =
        spec.imported.type === "Identifier" ? spec.imported.name : null
      const local = spec.local.name

      if (imported === "useStore" || imported === "useBoundStore") {
        bindings.selectorHooks.add(local) // alias-safe
      }
    }
  }
}
