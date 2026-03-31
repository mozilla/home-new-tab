import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { computeL10nHash } from "./fluent-utils"
import { buildTranslationManifest } from "./translation-manifest"

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "translation-manifest-"))
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, "utf8")
}

function removeDir(dirPath: string): void {
  fs.rmSync(dirPath, { force: true, recursive: true })
}

const SNAPSHOT_HASH = "abc123"
const L10N_HASH = "def456"

describe("buildTranslationManifest", () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      removeDir(dir)
    }
  })

  it("returns empty manifest when no component.ftl files exist", async () => {
    const root = makeTempDir()
    tempDirs.push(root)

    const manifest = await buildTranslationManifest({
      snapshotHash: SNAPSHOT_HASH,
      l10nHash: L10N_HASH,
      uiComponentsDir: root,
    })

    expect(manifest.keys).toEqual([])
    expect(manifest.keyCount).toBe(0)
    expect(manifest.components).toEqual([])
  })

  it("builds manifest for a single component with multiple keys", async () => {
    const root = makeTempDir()
    tempDirs.push(root)

    writeFile(
      path.join(root, "button", "component.ftl"),
      "btn-submit = Submit\nbtn-cancel = Cancel\nbtn-reset = Reset\n",
    )

    const manifest = await buildTranslationManifest({
      snapshotHash: SNAPSHOT_HASH,
      l10nHash: L10N_HASH,
      uiComponentsDir: root,
    })

    expect(manifest.components).toHaveLength(1)
    expect(manifest.components[0].path).toBe("button")
    expect(manifest.components[0].keys).toEqual(["btn-cancel", "btn-reset", "btn-submit"])
    expect(manifest.keyCount).toBe(3)
    expect(manifest.keys).toEqual(["btn-cancel", "btn-reset", "btn-submit"])
  })

  it("builds manifest for multiple components with globally sorted keys", async () => {
    const root = makeTempDir()
    tempDirs.push(root)

    writeFile(
      path.join(root, "todo", "component.ftl"),
      "todo-title = Tasks\ntodo-empty = No tasks\n",
    )
    writeFile(
      path.join(root, "header", "component.ftl"),
      "header-nav = Navigation\n",
    )

    const manifest = await buildTranslationManifest({
      snapshotHash: SNAPSHOT_HASH,
      l10nHash: L10N_HASH,
      uiComponentsDir: root,
    })

    expect(manifest.components).toHaveLength(2)
    expect(manifest.keyCount).toBe(3)
    expect(manifest.keys).toEqual(["header-nav", "todo-empty", "todo-title"])
  })

  it("uses relative path for nested component", async () => {
    const root = makeTempDir()
    tempDirs.push(root)

    writeFile(
      path.join(root, "sub", "nested", "component.ftl"),
      "nested-key = Nested\n",
    )

    const manifest = await buildTranslationManifest({
      snapshotHash: SNAPSHOT_HASH,
      l10nHash: L10N_HASH,
      uiComponentsDir: root,
    })

    expect(manifest.components[0].path).toBe(path.join("sub", "nested"))
  })

  it("passes snapshotHash and l10nHash through unchanged", async () => {
    const root = makeTempDir()
    tempDirs.push(root)

    const manifest = await buildTranslationManifest({
      snapshotHash: "snap-xyz",
      l10nHash: "l10n-abc",
      uiComponentsDir: root,
    })

    expect(manifest.snapshotHash).toBe("snap-xyz")
    expect(manifest.l10nHash).toBe("l10n-abc")
  })

  it("always sets baselineLocale to en-US", async () => {
    const root = makeTempDir()
    tempDirs.push(root)

    const manifest = await buildTranslationManifest({
      snapshotHash: SNAPSHOT_HASH,
      l10nHash: L10N_HASH,
      uiComponentsDir: root,
    })

    expect(manifest.baselineLocale).toBe("en-US")
  })

  it("returns components in alphabetical path order", async () => {
    const root = makeTempDir()
    tempDirs.push(root)

    writeFile(path.join(root, "zebra", "component.ftl"), "z-key = Z\n")
    writeFile(path.join(root, "alpha", "component.ftl"), "a-key = A\n")
    writeFile(path.join(root, "middle", "component.ftl"), "m-key = M\n")

    const manifest = await buildTranslationManifest({
      snapshotHash: SNAPSHOT_HASH,
      l10nHash: L10N_HASH,
      uiComponentsDir: root,
    })

    expect(manifest.components.map((c) => c.path)).toEqual(["alpha", "middle", "zebra"])
  })

  it("produces a globally sorted union of keys across components", async () => {
    const root = makeTempDir()
    tempDirs.push(root)

    writeFile(
      path.join(root, "comp-b", "component.ftl"),
      "b-key = B\n",
    )
    writeFile(
      path.join(root, "comp-a", "component.ftl"),
      "a-key = A\nc-key = C\n",
    )

    const manifest = await buildTranslationManifest({
      snapshotHash: SNAPSHOT_HASH,
      l10nHash: L10N_HASH,
      uiComponentsDir: root,
    })

    expect(manifest.keys).toEqual(["a-key", "b-key", "c-key"])
    expect(manifest.keyCount).toBe(3)
  })

  it("manifest keys are consistent with computeL10nHash round-trip", async () => {
    const root = makeTempDir()
    tempDirs.push(root)

    writeFile(
      path.join(root, "widget", "component.ftl"),
      "widget-title = Widget\nwidget-close = Close\n",
    )

    const expectedHash = computeL10nHash(["widget-close", "widget-title"])

    const manifest = await buildTranslationManifest({
      snapshotHash: SNAPSHOT_HASH,
      l10nHash: expectedHash,
      uiComponentsDir: root,
    })

    expect(computeL10nHash(manifest.keys)).toBe(manifest.l10nHash)
  })
})
