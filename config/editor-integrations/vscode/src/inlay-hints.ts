import { EventEmitter, InlayHint, InlayHintKind, workspace } from "vscode"

import { getLocalMessages, hasLocalFtl } from "@config/l10n-config"

import type { InlayHintsProvider, Range, TextDocument } from "vscode"

const STATIC_DATA_L10N_ID_RE = /\bdata-l10n-id\s*=\s*"([^"]+)"/g

export class FluentL10nInlayHintsProvider implements InlayHintsProvider {
  private readonly emitter = new EventEmitter<void>()
  readonly onDidChangeInlayHints = this.emitter.event

  refresh() {
    this.emitter.fire()
  }

  provideInlayHints(document: TextDocument, range: Range): InlayHint[] {
    if (!areInlayHintsEnabled()) {
      return []
    }

    if (!isSupportedDocument(document)) {
      return []
    }

    if (!hasLocalFtl(document.uri.fsPath)) {
      return []
    }

    const messages = getLocalMessages(document.uri.fsPath)
    if (messages.size === 0) {
      return []
    }

    const text = document.getText(range)
    const baseOffset = document.offsetAt(range.start)
    const hints: InlayHint[] = []

    for (const match of text.matchAll(STATIC_DATA_L10N_ID_RE)) {
      const fullMatch = match[0]
      const messageId = match[1]
      const message = messages.get(messageId)

      if (!message) {
        continue
      }

      const absoluteOffset = baseOffset + (match.index ?? 0) + fullMatch.length
      const position = document.positionAt(absoluteOffset)

      const hint = new InlayHint(
        position,
        ` → "${message.replace(/\s+/g, " ").trim()}"`,
        InlayHintKind.Type,
      )

      hint.paddingLeft = true
      hints.push(hint)
    }

    return hints
  }
}

function isSupportedDocument(document: TextDocument): boolean {
  return (
    document.uri.scheme === "file" &&
    (document.languageId === "javascriptreact" ||
      document.languageId === "typescriptreact")
  )
}

function areInlayHintsEnabled(): boolean {
  return workspace
    .getConfiguration("hnt.fluentL10n")
    .get<boolean>("inlayHints.enabled", true)
}
