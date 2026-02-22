import type { TSESTree } from "@typescript-eslint/types"
import type { TSESLint } from "@typescript-eslint/utils"
import { ESLintUtils } from "@typescript-eslint/utils"
import {
  collectTargetsFromImport,
  createTargetBindings,
} from "../utilities/import-bindings.js"

type Options = []
type MessageIds =
  | "noObjectLiteral"
  | "noArrayLiteral"
  | "noNew"
  | "noAllocCall"
  | "noAllocMethod"
  | "noMutatingMethod"

const createRule = ESLintUtils.RuleCreator(
  () => "internal://state-hygiene/no-selector-allocations",
)

const ALLOC_CALLS = new Set([
  "Object.values",
  "Object.entries",
  "Object.fromEntries",
  "Array.from",
])

// Methods that allocate a new value (identity churn)
const ALLOC_METHODS = new Set(["map", "filter", "slice", "flatMap", "reduce"])

// Methods that mutate the receiver (even worse inside selectors)
const MUTATING_METHODS = new Set([
  "sort",
  "reverse",
  "splice",
  "copyWithin",
  "fill",
])

function memberCalleeName(
  node: TSESTree.CallExpression["callee"],
): string | null {
  if (node.type === "Identifier") return node.name

  if (node.type === "MemberExpression" && !node.computed) {
    const obj = node.object
    const prop = node.property

    // We only care about Object.* / Array.* static helpers,
    // so require Identifier.Identifier (e.g. Object.values).
    if (obj.type === "Identifier" && prop.type === "Identifier") {
      return `${obj.name}.${prop.name}`
    }
  }

  return null
}

function getReturns(
  fn: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
): TSESTree.Expression[] {
  // `() => expr`
  if (fn.type === "ArrowFunctionExpression" && fn.expression) {
    return [fn.body as TSESTree.Expression]
  }

  // `{ return expr }`
  if (fn.body.type !== "BlockStatement") return []
  const out: TSESTree.Expression[] = []
  for (const stmt of fn.body.body) {
    if (stmt.type === "ReturnStatement" && stmt.argument)
      out.push(stmt.argument)
  }
  return out
}

function inspectReturn(
  context: TSESLint.RuleContext<MessageIds, Options>,
  expr: TSESTree.Expression,
) {
  if (expr.type === "ObjectExpression") {
    context.report({ node: expr, messageId: "noObjectLiteral" })
    return
  }
  if (expr.type === "ArrayExpression") {
    context.report({ node: expr, messageId: "noArrayLiteral" })
    return
  }
  if (expr.type === "NewExpression") {
    context.report({ node: expr, messageId: "noNew" })
    return
  }

  // Object.values(x), Array.from(x)
  if (expr.type === "CallExpression") {
    const name = memberCalleeName(expr.callee)
    if (name && ALLOC_CALLS.has(name)) {
      context.report({ node: expr, messageId: "noAllocCall" })
      return
    }

    // something.map(...) / something.sort(...) etc
    if (expr.callee.type === "MemberExpression" && !expr.callee.computed) {
      const prop = expr.callee.property
      if (prop.type === "Identifier") {
        if (ALLOC_METHODS.has(prop.name)) {
          context.report({ node: expr, messageId: "noAllocMethod" })
          return
        }
        if (MUTATING_METHODS.has(prop.name)) {
          context.report({ node: expr, messageId: "noMutatingMethod" })
          return
        }
      }
    }
  }

  // Strict-by-design: we only care about allocations/mutations in *return position*.
  // If someone does `useX(s => pick(s))` and pick allocates, that’s a separate concern.
}

export default createRule<Options, MessageIds>({
  name: "no-selector-allocations",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow returning newly allocated objects/arrays from Zustand selectors (prevents identity churn and rerender loops).",
    },
    schema: [],
    messages: {
      noObjectLiteral:
        "Selector returns a new object literal. Select a stable reference or leaf value instead.",
      noArrayLiteral:
        "Selector returns a new array literal. Select a stable reference or leaf value instead.",
      noNew:
        "Selector returns a newly constructed value (`new`). Derive outside the selector instead.",
      noAllocCall:
        "Selector returns a newly allocated value from an allocating call (Object/Array helpers). Derive outside the selector instead.",
      noAllocMethod:
        "Selector returns a newly allocated value from an array method (map/filter/etc). Derive outside the selector instead.",
      noMutatingMethod:
        "Selector calls a mutating array method (sort/reverse/splice/etc). Select a stable reference and derive outside the selector instead.",
    },
  },
  defaultOptions: [],
  create(context) {
    const bindings = createTargetBindings()

    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        collectTargetsFromImport(bindings, node)
      },

      CallExpression(node: TSESTree.CallExpression) {
        if (node.callee.type !== "Identifier") return
        if (!bindings.selectorHooks.has(node.callee.name)) return

        const selectorArg = node.arguments[0]
        if (!selectorArg) return
        if (
          selectorArg.type !== "ArrowFunctionExpression" &&
          selectorArg.type !== "FunctionExpression"
        ) {
          return
        }

        for (const ret of getReturns(selectorArg)) inspectReturn(context, ret)
      },
    }
  },
})
