import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  clearFtlCache,
  findClosestMessageId,
  getLocalMessages,
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
  })

  it("reads colocated message ids from component.ftl", () => {
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

  it("finds a close message id suggestion", () => {
    const messages = new Map<string, string>([
      ["todo-title", "My Todo List"],
      ["todo-description", "Keep track of tasks"],
    ])

    expect(findClosestMessageId(messages, "todo-titel")).toBe("todo-title")
  })

  it("clearFtlCache supports test isolation", () => {
    const root = makeTempDir()
    tempDirs.push(root)

    const sourceFilePath = path.join(root, "Todo.tsx")
    const ftlPath = path.join(root, "component.ftl")

    writeFile(sourceFilePath, `export function Todo() { return null }`)
    writeFile(ftlPath, `todo-title = First value`)

    const first = getLocalMessages(sourceFilePath)
    expect(first.get("todo-title")).toBe("First value")

    writeFile(ftlPath, `todo-title = Updated value`)

    const cached = getLocalMessages(sourceFilePath)
    expect(cached.get("todo-title")).toBe("First value")

    clearFtlCache()

    const refreshed = getLocalMessages(sourceFilePath)
    expect(refreshed.get("todo-title")).toBe("Updated value")
  })
})
