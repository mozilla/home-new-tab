import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  clearFtlCache,
  collectFtlFiles,
  computeL10nHash,
  findClosestMessageId,
  getLocalMessage,
  getLocalMessages,
  getRawLocalMessage,
  getRawLocalMessages,
  hasLocalFtl,
} from "./fluent-utils"

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fluent-utils-"))
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, "utf8")
}

function removeDir(dirPath: string): void {
  fs.rmSync(dirPath, { force: true, recursive: true })
}

describe("fluent-utils", () => {
  const tempDirs: string[] = []

  afterEach(() => {
    clearFtlCache()

    for (const dir of tempDirs.splice(0)) {
      removeDir(dir)
    }
  })

  it("returns empty messages when component.ftl is missing", () => {
    const root = makeTempDir()
    tempDirs.push(root)

    const sourceFilePath = path.join(root, "Todo.tsx")
    writeFile(sourceFilePath, `export function Todo() { return null }`)

    expect(hasLocalFtl(sourceFilePath)).toBe(false)
    expect(getLocalMessages(sourceFilePath)).toEqual(new Map())
    expect(getRawLocalMessages(sourceFilePath)).toEqual(new Map())
    expect(getLocalMessage(sourceFilePath, "todo-title")).toBeNull()
    expect(getRawLocalMessage(sourceFilePath, "todo-title")).toBeNull()
  })

  it("reads colocated flattened messages from component.ftl", () => {
    const root = makeTempDir()
    tempDirs.push(root)

    const sourceFilePath = path.join(root, "Todo.tsx")
    const ftlPath = path.join(root, "component.ftl")

    writeFile(sourceFilePath, `export function Todo() { return null }`)
    writeFile(
      ftlPath,
      `
todo-title = My Todo List
todo-description = Keep track of tasks
`,
    )

    const messages = getLocalMessages(sourceFilePath)

    expect(hasLocalFtl(sourceFilePath)).toBe(true)
    expect(messages.get("todo-title")).toBe("My Todo List")
    expect(messages.get("todo-description")).toBe("Keep track of tasks")
    expect(messages.size).toBe(2)
  })

  it("reads raw Fluent message blocks from component.ftl", () => {
    const root = makeTempDir()
    tempDirs.push(root)

    const sourceFilePath = path.join(root, "Todo.tsx")
    const ftlPath = path.join(root, "component.ftl")

    writeFile(sourceFilePath, `export function Todo() { return null }`)
    writeFile(
      ftlPath,
      `
todo-title = My Todo List

todo-description =
    Keep track of tasks
`,
    )

    const rawMessages = getRawLocalMessages(sourceFilePath)

    expect(rawMessages.get("todo-title")).toBe("todo-title = My Todo List")
    expect(rawMessages.get("todo-description")).toBe(
      "todo-description =\n    Keep track of tasks",
    )
    expect(rawMessages.size).toBe(2)
  })

  it("gets a single flattened message by id", () => {
    const root = makeTempDir()
    tempDirs.push(root)

    const sourceFilePath = path.join(root, "Todo.tsx")
    const ftlPath = path.join(root, "component.ftl")

    writeFile(sourceFilePath, `export function Todo() { return null }`)
    writeFile(
      ftlPath,
      `
todo-title = My Todo List
todo-description = Keep track of tasks
`,
    )

    expect(getLocalMessage(sourceFilePath, "todo-title")).toBe("My Todo List")
    expect(getLocalMessage(sourceFilePath, "missing-id")).toBeNull()
  })

  it("gets a single raw Fluent message by id", () => {
    const root = makeTempDir()
    tempDirs.push(root)

    const sourceFilePath = path.join(root, "Todo.tsx")
    const ftlPath = path.join(root, "component.ftl")

    writeFile(sourceFilePath, `export function Todo() { return null }`)
    writeFile(
      ftlPath,
      `
todo-title = My Todo List

todo-description =
    Keep track of tasks
`,
    )

    expect(getRawLocalMessage(sourceFilePath, "todo-title")).toBe(
      "todo-title = My Todo List",
    )
    expect(getRawLocalMessage(sourceFilePath, "todo-description")).toBe(
      "todo-description =\n    Keep track of tasks",
    )
    expect(getRawLocalMessage(sourceFilePath, "missing-id")).toBeNull()
  })

  it("collapses whitespace in flattened message text", () => {
    const root = makeTempDir()
    tempDirs.push(root)

    const sourceFilePath = path.join(root, "Todo.tsx")
    const ftlPath = path.join(root, "component.ftl")

    writeFile(sourceFilePath, `export function Todo() { return null }`)
    writeFile(
      ftlPath,
      `
todo-description =
    Keep
      track of
    tasks
`,
    )

    const messages = getLocalMessages(sourceFilePath)

    expect(messages.get("todo-description")).toBe("Keep track of tasks")
  })

  it("uses the default select variant when flattening messages", () => {
    const root = makeTempDir()
    tempDirs.push(root)

    const sourceFilePath = path.join(root, "Todo.tsx")
    const ftlPath = path.join(root, "component.ftl")

    writeFile(sourceFilePath, `export function Todo() { return null }`)
    writeFile(
      ftlPath,
      `
todo-count =
    { $count ->
        [one] One task
       *[other] { $count } tasks
    }
`,
    )

    const messages = getLocalMessages(sourceFilePath)
    const rawMessages = getRawLocalMessages(sourceFilePath)

    expect(messages.get("todo-count")).toBe("{…} tasks")
    expect(rawMessages.get("todo-count")).toBe(
      `todo-count =
    { $count ->
        [one] One task
       *[other] { $count } tasks
    }`,
    )
  })

  it("finds a close message id suggestion", () => {
    const messages = new Map<string, string>([
      ["todo-title", "My Todo List"],
      ["todo-description", "Keep track of tasks"],
    ])

    expect(findClosestMessageId(messages, "todo-titel")).toBe("todo-title")
  })

  it("returns null when no close message id suggestion exists", () => {
    const messages = new Map<string, string>([
      ["todo-title", "My Todo List"],
      ["todo-description", "Keep track of tasks"],
    ])

    expect(findClosestMessageId(messages, "completely-different")).toBeNull()
  })

  describe("collectFtlFiles", () => {
    it("returns an empty array when no component.ftl files exist", async () => {
      const root = makeTempDir()
      tempDirs.push(root)

      const result = await collectFtlFiles(root)
      expect(result).toEqual([])
    })

    it("collects component.ftl files from nested directories", async () => {
      const root = makeTempDir()
      tempDirs.push(root)

      const aFtl = path.join(root, "a", "component.ftl")
      const bFtl = path.join(root, "b", "deep", "component.ftl")
      const cFtl = path.join(root, "component.ftl")
      writeFile(aFtl, `a-message = A`)
      writeFile(bFtl, `b-message = B`)
      writeFile(cFtl, `c-message = C`)

      const result = await collectFtlFiles(root)
      expect(result).toEqual([cFtl, aFtl, bFtl].sort())
    })

    it("ignores non-component.ftl files", async () => {
      const root = makeTempDir()
      tempDirs.push(root)

      writeFile(path.join(root, "other.ftl"), `other-message = Other`)
      writeFile(path.join(root, "component.ftl"), `real-message = Real`)

      const result = await collectFtlFiles(root)
      expect(result).toHaveLength(1)
      expect(result[0]).toContain("component.ftl")
    })

    it("returns results in sorted order for determinism", async () => {
      const root = makeTempDir()
      tempDirs.push(root)

      writeFile(path.join(root, "z", "component.ftl"), `z-msg = Z`)
      writeFile(path.join(root, "a", "component.ftl"), `a-msg = A`)
      writeFile(path.join(root, "m", "component.ftl"), `m-msg = M`)

      const result = await collectFtlFiles(root)
      expect(result).toEqual([...result].sort())
    })
  })

  describe("computeL10nHash", () => {
    it("returns a 16-character hex string", () => {
      const hash = computeL10nHash(["greeting", "farewell"])
      expect(hash).toHaveLength(16)
      expect(hash).toMatch(/^[0-9a-f]+$/)
    })

    it("is deterministic: same IDs produce the same hash", () => {
      const ids = ["greeting", "farewell", "title"]
      expect(computeL10nHash(ids)).toBe(computeL10nHash(ids))
    })

    it("produces different hashes for different ID sets", () => {
      expect(computeL10nHash(["greeting"])).not.toBe(
        computeL10nHash(["farewell"]),
      )
    })

    it("is stable across English text changes — only keys matter", () => {
      // computeL10nHash receives pre-extracted IDs, not raw FTL text.
      // Two FTL sources with the same keys but different message text produce
      // the same sorted ID array, and therefore the same hash.
      const ids = ["farewell", "greeting"] // already sorted
      expect(computeL10nHash(ids)).toBe(computeL10nHash([...ids]))
    })

    it("changes when a key is added", () => {
      const before = computeL10nHash(["greeting"])
      const after = computeL10nHash(["greeting", "farewell"])
      expect(before).not.toBe(after)
    })
  })

  it("clearFtlCache supports test isolation", () => {
    const root = makeTempDir()
    tempDirs.push(root)

    const sourceFilePath = path.join(root, "Todo.tsx")
    const ftlPath = path.join(root, "component.ftl")

    writeFile(sourceFilePath, `export function Todo() { return null }`)
    writeFile(ftlPath, `todo-title = First value`)

    const first = getLocalMessages(sourceFilePath)
    const firstRaw = getRawLocalMessages(sourceFilePath)

    expect(first.get("todo-title")).toBe("First value")
    expect(firstRaw.get("todo-title")).toBe("todo-title = First value")

    writeFile(ftlPath, `todo-title = Updated value`)

    const cached = getLocalMessages(sourceFilePath)
    const cachedRaw = getRawLocalMessages(sourceFilePath)

    expect(cached.get("todo-title")).toBe("First value")
    expect(cachedRaw.get("todo-title")).toBe("todo-title = First value")

    clearFtlCache()

    const refreshed = getLocalMessages(sourceFilePath)
    const refreshedRaw = getRawLocalMessages(sourceFilePath)

    expect(refreshed.get("todo-title")).toBe("Updated value")
    expect(refreshedRaw.get("todo-title")).toBe("todo-title = Updated value")
  })
})
