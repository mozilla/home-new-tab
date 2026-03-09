import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  clearFtlCache,
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
