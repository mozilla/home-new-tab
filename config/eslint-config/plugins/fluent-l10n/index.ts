import noMissingMessage from "./rules/no-missing-message.ts"

const plugin = {
  meta: {
    name: "eslint-plugin-fluent-l10n",
  },
  rules: {
    "no-missing-message": noMissingMessage,
  },
}

export default plugin
