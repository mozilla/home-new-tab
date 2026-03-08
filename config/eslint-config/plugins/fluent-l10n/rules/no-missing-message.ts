import type { Rule } from "eslint"
import { getLocalMessageIds, getLocalStringsPath } from "../utilities/fluent.ts"

function isDataL10nIdAttribute(node: unknown): node is {
  type: "JSXAttribute"
  name: { type: "JSXIdentifier"; name: string }
  value: null | {
    type: "Literal"
    value: unknown
  }
} {
  if (!node || typeof node !== "object") {
    return false
  }

  const candidate = node as {
    type?: unknown
    name?: { type?: unknown; name?: unknown }
  }

  return (
    candidate.type === "JSXAttribute" &&
    candidate.name?.type === "JSXIdentifier" &&
    candidate.name.name === "data-l10n-id"
  )
}

function getStaticStringValue(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const candidate = value as {
    type?: unknown
    value?: unknown
  }

  if (candidate.type === "Literal" && typeof candidate.value === "string") {
    return candidate.value
  }

  return null
}

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Validate that data-l10n-id exists in local component.ftl",
    },
    schema: [],
    messages: {
      missingMessage:
        'Message "{{messageId}}" does not exist in ./component.ftl',
    },
  },

  create(context) {
    const filename = context.filename
    const ids = getLocalMessageIds(filename)

    if (ids === null) {
      return {}
    }

    return {
      JSXAttribute(node: unknown) {
        if (!isDataL10nIdAttribute(node)) return

        const messageId = getStaticStringValue(node.value)
        if (!messageId) return

        if (!ids.has(messageId)) {
          context.report({
            node,
            messageId: "missingMessage",
            data: { messageId },
          })
        }
      },
    }
  },
}

export default rule
