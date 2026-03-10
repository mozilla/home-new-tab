import {
  languages,
  window,
  workspace,
  commands,
  StatusBarAlignment,
} from "vscode"
import { clearFtlCache } from "@config/l10n-config"
import { FluentL10nInlayHintsProvider } from "./inlay-hints"
import { FluentHoverProvider } from "./hover-provider"
import type { ExtensionContext, Uri, StatusBarItem } from "vscode"

const INLAY_HINTS_SETTING = "inlayHints.enabled"
const CONFIG_SECTION = "hnt.fluentL10n"
const TOGGLE_COMMAND = "hnt.fluentL10n.toggleInlayHints"

function getInlayHintsEnabled(): boolean {
  return workspace
    .getConfiguration(CONFIG_SECTION)
    .get<boolean>(INLAY_HINTS_SETTING, true)
}

async function setInlayHintsEnabled(enabled: boolean): Promise<void> {
  await workspace
    .getConfiguration(CONFIG_SECTION)
    .update(INLAY_HINTS_SETTING, enabled, true)
}

function updateStatusBar(statusBar: StatusBarItem): void {
  const enabled = getInlayHintsEnabled()

  statusBar.text = enabled ? "$(check) L10n" : "$(circle-slash) L10n"

  statusBar.tooltip = enabled
    ? "Disable Fluent localization inlay hints"
    : "Enable Fluent localization inlay hints"

  statusBar.command = TOGGLE_COMMAND
}

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

  const statusBar = window.createStatusBarItem(StatusBarAlignment.Right, 100)
  updateStatusBar(statusBar)
  statusBar.show()

  const toggleDisposable = commands.registerCommand(
    TOGGLE_COMMAND,
    async () => {
      const nextValue = !getInlayHintsEnabled()
      await setInlayHintsEnabled(nextValue)
    },
  )

  const configDisposable = workspace.onDidChangeConfiguration((event) => {
    if (
      event.affectsConfiguration(`${CONFIG_SECTION}.${INLAY_HINTS_SETTING}`)
    ) {
      updateStatusBar(statusBar)
      provider.refresh()
    }
  })

  context.subscriptions.push(statusBar, toggleDisposable, configDisposable)
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
