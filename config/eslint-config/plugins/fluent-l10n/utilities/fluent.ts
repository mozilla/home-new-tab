import fs from "node:fs"
import path from "node:path"
import { parse, type Resource, type Entry } from "@fluent/syntax"

type CachedFtl = {
  mtimeMs: number
  ids: Set<string>
}

const ftlCache = new Map<string, CachedFtl>()

function isMessageEntry(
  entry: Entry,
): entry is Entry & { id: { name: string } } {
  return entry.type === "Message"
}

function collectMessageIds(ast: Resource): Set<string> {
  const ids = new Set<string>()

  for (const entry of ast.body) {
    if (isMessageEntry(entry)) {
      ids.add(entry.id.name)
    }
  }

  return ids
}

/**
 * Read and parse a colocated component.ftl file.
 *
 * Returns:
 * - Set of message ids when present and parsed
 * - null when the file does not exist
 * - empty set when parsing fails
 */
export function getLocalMessageIds(sourceFilePath: string): Set<string> | null {
  const dir = path.dirname(sourceFilePath)
  const ftlPath = path.join(dir, "component.ftl")

  if (!fs.existsSync(ftlPath)) {
    return null
  }

  const stat = fs.statSync(ftlPath)
  const cached = ftlCache.get(ftlPath)

  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.ids
  }

  try {
    const raw = fs.readFileSync(ftlPath, "utf8")
    const ast = parse(raw, {})
    const ids = collectMessageIds(ast)

    ftlCache.set(ftlPath, {
      mtimeMs: stat.mtimeMs,
      ids,
    })

    return ids
  } catch {
    const ids = new Set<string>()

    ftlCache.set(ftlPath, {
      mtimeMs: stat.mtimeMs,
      ids,
    })

    return ids
  }
}

export function getLocalStringsPath(sourceFilePath: string): string {
  return path.join(path.dirname(sourceFilePath), "component.ftl")
}

export function clearFtlCache() {
  ftlCache.clear()
}
