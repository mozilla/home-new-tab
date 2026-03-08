import fs from "node:fs"
import os from "node:os"
import path from "node:path"

type FixtureArgs = {
  code: string
  ftl?: string
  fileName?: string
}

const tempDirs = new Set<string>()

export function makeL10nFixture(args: FixtureArgs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluent-l10n-"))
  tempDirs.add(dir)

  const filePath = path.join(dir, args.fileName ?? "Todo.tsx")

  fs.writeFileSync(filePath, args.code, "utf8")

  if (typeof args.ftl === "string") {
    fs.writeFileSync(path.join(dir, "strings.ftl"), args.ftl, "utf8")
  }

  return {
    code: args.code,
    filename: filePath,
  }
}

export function cleanupL10nFixtures() {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true })
  }

  tempDirs.clear()
}
