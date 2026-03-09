import fs from "node:fs"
import os from "node:os"
import path from "node:path"

type FixtureArgs = {
  code: string
  ftl?: string
  fileName?: string
}

const tempDirs = new Set<string>()

function trimIndent(value: string): string {
  const lines = value
    .replace(/^\n/, "")
    .replace(/\n\s*$/, "")
    .split("\n")

  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^(\s*)/)?.[1].length ?? 0)

  const minIndent = indents.length > 0 ? Math.min(...indents) : 0

  return lines.map((line) => line.slice(minIndent)).join("\n")
}

export function makeL10nFixture(args: FixtureArgs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluent-l10n-"))
  tempDirs.add(dir)

  const filePath = path.join(dir, args.fileName ?? "Todo.tsx")

  fs.writeFileSync(filePath, trimIndent(args.code), "utf8")

  if (typeof args.ftl === "string") {
    fs.writeFileSync(
      path.join(dir, "component.ftl"),
      trimIndent(args.ftl),
      "utf8",
    )
  }

  return {
    code: trimIndent(args.code),
    filename: filePath,
  }
}

export function cleanupL10nFixtures() {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true })
  }

  tempDirs.clear()
}
