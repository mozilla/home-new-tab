import {
  Hover,
  HoverProvider,
  MarkdownString,
  Position,
  TextDocument,
} from "vscode"

import { getRawLocalMessage, hasLocalFtl } from "@config/l10n-config"

const DATA_L10N_RE = /\bdata-l10n-id\s*=\s*"([^"]+)"/g

export class FluentHoverProvider implements HoverProvider {
  provideHover(document: TextDocument, position: Position) {
    if (!isReactDocument(document.languageId)) {
      return
    }

    if (!hasLocalFtl(document.uri.fsPath)) {
      return
    }

    const line = document.lineAt(position.line).text

    const match = [...line.matchAll(DATA_L10N_RE)].find((m) => {
      const start = m.index ?? 0
      const end = start + m[0].length
      return position.character >= start && position.character <= end
    })

    if (!match) {
      return
    }

    const messageId = match[1]

    const raw = getRawLocalMessage(document.uri.fsPath, messageId)

    if (!raw) {
      return
    }

    const md = new MarkdownString()

    md.appendMarkdown(`**ID:** \`${messageId}\`\n\n`)
    md.appendCodeblock(raw, "fluent")

    return new Hover(md)

    return new Hover(md)
  }
}

function isReactDocument(languageId: string): boolean {
  return languageId === "javascriptreact" || languageId === "typescriptreact"
}
