import { languages, window, workspace } from "vscode"
import { clearFtlCache } from "@config/l10n-config"
import { FluentL10nInlayHintsProvider } from "./inlay-hints"
import { FluentHoverProvider } from "./hover-provider"
import type { ExtensionContext, Uri } from "vscode"

const REACT_SELECTOR = [
  { language: "javascriptreact", scheme: "file" },
  { language: "typescriptreact", scheme: "file" },
]

export function activate(context: ExtensionContext) {
  const provider = new FluentL10nInlayHintsProvider()

  context.subscriptions.push(
    languages.registerInlayHintsProvider(REACT_SELECTOR, provider),
  )

  const watcher = workspace.createFileSystemWatcher("**/component.ftl")

  const refreshForFtl = (ftlUri: Uri) => {
    clearFtlCache()

    const activeDocument = window.activeTextEditor?.document
    if (!activeDocument || !isReactDocument(activeDocument.languageId)) {
      return
    }

    if (isLocalFtlForDocument(activeDocument.uri, ftlUri)) {
      provider.refresh()
    }
  }

  watcher.onDidChange(refreshForFtl)
  watcher.onDidCreate(refreshForFtl)
  watcher.onDidDelete(refreshForFtl)

  context.subscriptions.push(watcher)

  context.subscriptions.push(
    window.onDidChangeActiveTextEditor((editor) => {
      if (!editor) {
        return
      }

      if (isReactDocument(editor.document.languageId)) {
        provider.refresh()
      }
    }),
  )

  context.subscriptions.push(
    languages.registerHoverProvider(REACT_SELECTOR, new FluentHoverProvider()),
  )
}

export function deactivate() {}

function isReactDocument(languageId: string): boolean {
  return languageId === "javascriptreact" || languageId === "typescriptreact"
}

function isLocalFtlForDocument(documentUri: Uri, ftlUri: Uri): boolean {
  const documentPath = documentUri.fsPath.replace(/\\/g, "/")
  const ftlPath = ftlUri.fsPath.replace(/\\/g, "/")

  const documentDir = documentPath.slice(0, documentPath.lastIndexOf("/"))

  return ftlPath === `${documentDir}/component.ftl`
}
