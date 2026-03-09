import fs from "node:fs"
import path from "node:path"
import { parse, type Resource, type Entry } from "@fluent/syntax"

/**
 * Cached representation of a parsed Fluent file.
 */
type CachedFtl = {
  mtimeMs: number
  ids: Set<string>
}

/**
 * Result of resolving the colocated component.ftl file.
 *
 * exists: false → no component.ftl present
 * exists: true  → file present and parsed (ids may be empty if parsing failed)
 */
export type LocalMessages =
  | { exists: false }
  | { exists: true; ids: Set<string> }

const ftlCache = new Map<string, CachedFtl>()

/**
 * Type guard for Fluent message entries.
 */
function isMessageEntry(
  entry: Entry,
): entry is Entry & { id: { name: string } } {
  return entry.type === "Message"
}

/**
 * Extract all message ids from a Fluent AST.
 */
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
 * Resolve and parse the colocated component.ftl file.
 *
 * This function handles:
 * - path resolution
 * - parsing
 * - caching based on mtime
 *
 * Returns an object describing whether the file exists
 * and the parsed message ids when present.
 */
export function getLocalMessages(sourceFilePath: string): LocalMessages {
  const dir = path.dirname(sourceFilePath)
  const ftlPath = path.join(dir, "component.ftl")

  if (!fs.existsSync(ftlPath)) {
    return { exists: false }
  }

  const stat = fs.statSync(ftlPath)
  const cached = ftlCache.get(ftlPath)

  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return { exists: true, ids: cached.ids }
  }

  try {
    const raw = fs.readFileSync(ftlPath, "utf8")
    const ast = parse(raw, {})
    const ids = collectMessageIds(ast)

    ftlCache.set(ftlPath, {
      mtimeMs: stat.mtimeMs,
      ids,
    })

    return { exists: true, ids }
  } catch {
    // If parsing fails we still cache an empty set
    const ids = new Set<string>()

    ftlCache.set(ftlPath, {
      mtimeMs: stat.mtimeMs,
      ids,
    })

    return { exists: true, ids }
  }
}

/**
 * Resolve the expected component.ftl path for a source file.
 */
export function getLocalStringsPath(sourceFilePath: string): string {
  return path.join(path.dirname(sourceFilePath), "component.ftl")
}

/**
 * Clear the in-memory Fluent cache.
 *
 * Used by tests to avoid cross-test contamination.
 */
export function clearFtlCache() {
  ftlCache.clear()
}

/**
 * Compute the ~Fancy Pants~ Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const matrix = Array.from(
    { length: a.length + 1 },
    () => new Array<number>(b.length + 1),
  )

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }

  return matrix[a.length][b.length]
}

/**
 * Find the closest matching message id for a missing key.
 *
 * Only returns a suggestion when the edit distance is small
 * enough to likely represent a typo.
 */
export function findClosestMessageId(
  id: string,
  ids: Set<string>,
): string | null {
  let best: string | null = null
  let bestScore = Infinity

  for (const candidate of ids) {
    const score = levenshtein(id, candidate)

    if (score < bestScore) {
      bestScore = score
      best = candidate
    }
  }

  // Prevent obviously incorrect suggestions
  if (bestScore > 3) return null

  return best
}
