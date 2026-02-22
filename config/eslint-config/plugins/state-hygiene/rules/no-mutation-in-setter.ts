import type { TSESTree } from "@typescript-eslint/types"
import { ESLintUtils } from "@typescript-eslint/utils"

type Options = []
type MessageIds = "noMutation" | "noMutatingMethod"

const createRule = ESLintUtils.RuleCreator(
  () => "internal://state-hygiene/no-mutation-in-setter",
)

const MUTATING_METHODS = new Set([
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "copyWithin",
  "fill",
])

function isMemberRootedInIdent(node: TSESTree.Node, ident: string): boolean {
  if (node.type !== "MemberExpression") return false
  let obj: TSESTree.Expression = node.object
  while (obj.type === "MemberExpression") obj = obj.object
  return obj.type === "Identifier" && obj.name === ident
}

function isMutatingCall(node: TSESTree.CallExpression, paramName: string) {
  const callee = node.callee
  if (callee.type !== "MemberExpression" || callee.computed) return false
  if (callee.property.type !== "Identifier") return false
  if (!MUTATING_METHODS.has(callee.property.name)) return false
  return isMemberRootedInIdent(callee, paramName)
}

export default createRule<Options, MessageIds>({
  name: "no-mutation-in-setter",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow in-place mutation inside set((state) => ...) updaters (keeps referential updates predictable).",
    },
    schema: [],
    messages: {
      noMutation:
        "Do not mutate Zustand state inside set() updater. Return a new object/partial instead.",
      noMutatingMethod:
        "Do not call mutating methods on Zustand state inside set() updater (push/splice/sort/etc). Return new arrays/objects instead.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node: TSESTree.CallExpression) {
        // Match `set(...)`
        if (node.callee.type !== "Identifier") return
        if (node.callee.name !== "set") return

        const updater = node.arguments[0]
        if (!updater) return
        if (
          updater.type !== "ArrowFunctionExpression" &&
          updater.type !== "FunctionExpression"
        ) {
          return
        }

        const p0 = updater.params[0]
        if (!p0 || p0.type !== "Identifier") return
        const paramName = p0.name

        // Only scan block bodies: `set(s => ({...}))` is already immutable by shape
        if (updater.body.type !== "BlockStatement") return

        // Walk the block looking for mutation
        const stack: TSESTree.Node[] = [...updater.body.body]
        while (stack.length) {
          const n = stack.pop()!

          if (n.type === "ExpressionStatement") {
            const e = n.expression

            // assignments: state.x = ...
            if (
              e.type === "AssignmentExpression" &&
              isMemberRootedInIdent(e.left, paramName)
            ) {
              context.report({ node: n, messageId: "noMutation" })
              continue
            }

            // update: ++state.x
            if (
              e.type === "UpdateExpression" &&
              isMemberRootedInIdent(e.argument, paramName)
            ) {
              context.report({ node: n, messageId: "noMutation" })
              continue
            }

            // delete state.x
            if (
              e.type === "UnaryExpression" &&
              e.operator === "delete" &&
              isMemberRootedInIdent(e.argument, paramName)
            ) {
              context.report({ node: n, messageId: "noMutation" })
              continue
            }

            // mutating calls: state.arr.push(...)
            if (e.type === "CallExpression" && isMutatingCall(e, paramName)) {
              context.report({ node: n, messageId: "noMutatingMethod" })
              continue
            }
          }

          // descend
          for (const key of Object.keys(n) as Array<keyof typeof n>) {
            const v = (n as any)[key]
            if (!v) continue
            if (Array.isArray(v)) {
              for (const item of v)
                if (item && typeof item.type === "string") stack.push(item)
            } else if (v && typeof v.type === "string") {
              stack.push(v)
            }
          }
        }
      },
    }
  },
})
