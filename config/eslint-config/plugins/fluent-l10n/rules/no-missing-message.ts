import type { Rule } from "eslint"
import {
  findClosestMessageId,
  getLocalMessages,
} from "../utilities/fluent"

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

function getStaticStringValue(value: unknown): null | string {
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
      missingComponentFtl:
        "Component uses data-l10n-id but no component.ftl was found in this folder",

      missingMessage:
        'Message "{{messageId}}" does not exist in ./component.ftl',

      missingMessageSuggestion:
        'Message "{{messageId}}" does not exist in ./component.ftl. Did you mean "{{suggestion}}"?',
    },
  },

  create(context) {
    const filename = context.filename
    const result = getLocalMessages(filename)

    let reportedMissingFile = false

    return {
      JSXAttribute(node: unknown) {
        if (!isDataL10nIdAttribute(node)) return

        const messageId = getStaticStringValue(node.value)
        if (!messageId) return

        if (!result.exists) {
          if (!reportedMissingFile) {
            reportedMissingFile = true

            context.report({
              node,
              messageId: "missingComponentFtl",
            })
          }

          return
        }

        if (!result.ids.has(messageId)) {
          const suggestion = findClosestMessageId(messageId, result.ids)

          if (suggestion) {
            context.report({
              node,
              messageId: "missingMessageSuggestion",
              data: {
                messageId,
                suggestion,
              },
            })
          } else {
            context.report({
              node,
              messageId: "missingMessage",
              data: {
                messageId,
              },
            })
          }
        }
      },
    }
  },
}

export default rule
