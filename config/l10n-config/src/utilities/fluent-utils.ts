import fs from "node:fs"
import path from "node:path"

import { parse } from "@fluent/syntax"

/**
 * File name expected to exist next to a component source file.
 *
 * Example:
 *
 *   Button.tsx
 *   component.ftl
 */
const COMPONENT_FTL_FILE = "component.ftl"

/**
 * Parser options for Fluent syntax parsing.
 *
 * The parser typings require an options object even when no custom options
 * are needed.
 */
const PARSER_OPTIONS = {}

/**
 * Map of message id → flattened text value.
 *
 * Example:
 *   "todo-title" → "My Todo List"
 */
export type LocalMessages = Map<string, string>

/**
 * Map of message id → raw Fluent source block.
 *
 * Example:
 *   "todo-title" → "todo-title = My Todo List"
 */
export type RawLocalMessages = Map<string, string>

/**
 * Parsed data for one colocated `component.ftl` file.
 */
type LocalFtlData = {
  messages: LocalMessages
  rawMessages: RawLocalMessages
}

/**
 * Sentinel used to remember that a colocated FTL file does not exist.
 *
 * This avoids repeated disk reads for missing files.
 */
const MISSING_FILE = Symbol("missing-file")

/**
 * Cached result for a colocated FTL lookup.
 *
 * - `LocalFtlData` for existing files
 * - `MISSING_FILE` when no sibling `component.ftl` exists
 */
type CachedFtlData = LocalFtlData | typeof MISSING_FILE

/**
 * Minimal AST shapes used by this module.
 *
 * We keep these intentionally narrow so the rest of the file stays typed
 * without depending on a large Fluent-specific surface area.
 */
type FluentResource = {
  body: unknown[]
}

type MessageNode = {
  id?: { name?: string }
  span?: { end: number; start: number }
  type: "Message"
  value?: PatternNode | null
}

type PatternNode = {
  elements: unknown[]
}

type TextElementNode = {
  type: "TextElement"
  value: string
}

type PlaceableNode = {
  expression: ExpressionNode
  type: "Placeable"
}

type ExpressionNode = SelectExpressionNode | { type: string }

type SelectExpressionNode = {
  type: "SelectExpression"
  variants: VariantNode[]
}

type VariantNode = {
  default?: boolean
  value: PatternNode
}

/**
 * In-memory cache of parsed `component.ftl` files.
 *
 * Keyed by absolute FTL path.
 *
 * ESLint and editor tooling may request the same file repeatedly,
 * so caching avoids re-reading and re-parsing on every lookup.
 *
 * This cache does not attempt automatic file invalidation.
 * Consumers are expected to call `clearFtlCache()` when freshness matters.
 */
const FTL_CACHE = new Map<string, CachedFtlData>()

/**
 * Clear the internal FTL parse cache.
 *
 * Useful in tests where files may be created or modified between runs.
 * Editor tooling can also call this when `component.ftl` changes on disk.
 */
export function clearFtlCache(): void {
  FTL_CACHE.clear()
}

/**
 * Resolve the expected colocated `component.ftl` path for a source file.
 *
 * Example:
 *
 *   /repo/components/todo/Todo.tsx
 *   → /repo/components/todo/component.ftl
 */
export function getLocalFtlPath(sourceFilePath: string): string {
  return path.join(path.dirname(sourceFilePath), COMPONENT_FTL_FILE)
}

/**
 * Return true when a colocated `component.ftl` exists for a source file.
 */
export function hasLocalFtl(sourceFilePath: string): boolean {
  return fs.existsSync(getLocalFtlPath(sourceFilePath))
}

/**
 * Load flattened message text from the colocated `component.ftl`.
 *
 * Example:
 *
 *   "todo-title" → "My Todo List"
 */
export function getLocalMessages(sourceFilePath: string): LocalMessages {
  const data = getLocalFtlData(sourceFilePath)
  return data === MISSING_FILE ? new Map() : data.messages
}

/**
 * Load raw Fluent message blocks from the colocated `component.ftl`.
 *
 * Example:
 *
 *   "todo-title" → "todo-title = My Todo List"
 */
export function getRawLocalMessages(sourceFilePath: string): RawLocalMessages {
  const data = getLocalFtlData(sourceFilePath)
  return data === MISSING_FILE ? new Map() : data.rawMessages
}

/**
 * Load one flattened message value from the colocated `component.ftl`.
 */
export function getLocalMessage(
  sourceFilePath: string,
  messageId: string,
): null | string {
  return getLocalMessages(sourceFilePath).get(messageId) ?? null
}

/**
 * Load one raw Fluent message block from the colocated `component.ftl`.
 */
export function getRawLocalMessage(
  sourceFilePath: string,
  messageId: string,
): null | string {
  return getRawLocalMessages(sourceFilePath).get(messageId) ?? null
}

/**
 * Attempt to find the closest message id to a missing id.
 *
 * Used for suggestions in lint diagnostics and editor hints.
 *
 * Example:
 *
 *   "todo-titel" → "todo-title"
 */
export function findClosestMessageId(
  messages: Iterable<string> | LocalMessages,
  target: string,
): null | string {
  const candidates =
    messages instanceof Map ? [...messages.keys()] : [...messages]

  if (candidates.length === 0) {
    return null
  }

  let bestId: null | string = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    const score = levenshtein(candidate, target)

    if (score < bestScore) {
      bestScore = score
      bestId = candidate
    }
  }

  if (!bestId) {
    return null
  }

  const maxDistance = getMaxAllowedDistance(target, bestId)
  return bestScore <= maxDistance ? bestId : null
}

/**
 * Load and parse the `component.ftl` file colocated with a source file.
 *
 * Behavior:
 *
 * - Reads the sibling `component.ftl`
 * - Parses messages using `@fluent/syntax`
 * - Extracts both flattened text and raw Fluent source
 * - Caches both hits and misses by absolute FTL path
 *
 * If the file does not exist, the missing-file sentinel is cached.
 *
 * This function is intentionally synchronous because ESLint rules
 * execute in a synchronous analysis pipeline.
 */
function getLocalFtlData(sourceFilePath: string): CachedFtlData {
  const ftlPath = getLocalFtlPath(sourceFilePath)
  const cached = FTL_CACHE.get(ftlPath)

  if (cached) {
    return cached
  }

  let rawFile: string
  try {
    rawFile = fs.readFileSync(ftlPath, "utf8")
  } catch {
    FTL_CACHE.set(ftlPath, MISSING_FILE)
    return MISSING_FILE
  }

  const resource = parse(rawFile, PARSER_OPTIONS) as FluentResource
  const data = collectFtlData(resource, rawFile)

  FTL_CACHE.set(ftlPath, data)

  return data
}

/**
 * Extract flattened and raw messages from a Fluent AST.
 */
function collectFtlData(
  resource: FluentResource,
  rawFile: string,
): LocalFtlData {
  const messages: LocalMessages = new Map()
  const rawMessages: RawLocalMessages = new Map()

  for (const entry of resource.body) {
    if (!isMessageNode(entry)) {
      continue
    }

    const id = entry.id?.name
    if (!id) {
      continue
    }

    const value = entry.value ? patternToText(entry.value) : ""
    messages.set(id, collapseWhitespace(value))
    rawMessages.set(id, getRawMessageText(rawFile, entry))
  }

  return { messages, rawMessages }
}

/**
 * Slice the original file text for a message using Fluent span data.
 *
 * Falls back to a minimal synthetic line when span data is unavailable.
 */
function getRawMessageText(rawFile: string, message: MessageNode): string {
  const start = message.span?.start
  const end = message.span?.end

  if (typeof start === "number" && typeof end === "number" && end > start) {
    return rawFile.slice(start, end).trim()
  }

  const id = message.id?.name ?? "unknown-message"
  const value = message.value ? patternToText(message.value) : ""

  return `${id} = ${value}`.trim()
}

/**
 * Convert a Fluent Pattern to best-effort plain text.
 *
 * Dynamic expressions are replaced with placeholder markers or
 * best-effort default-variant text for select expressions.
 */
function patternToText(pattern: PatternNode): string {
  let out = ""

  for (const element of pattern.elements) {
    if (isTextElementNode(element)) {
      out += element.value
      continue
    }

    if (isPlaceableNode(element)) {
      out += expressionToPlaceholderText(element.expression)
    }
  }

  return out
}

/**
 * Convert a Fluent expression into placeholder text.
 */
function expressionToPlaceholderText(expression: ExpressionNode): string {
  if (isSelectExpressionNode(expression)) {
    const defaultVariant =
      expression.variants.find((variant) => variant.default) ??
      expression.variants[0]

    return defaultVariant ? patternToText(defaultVariant.value) : "{…}"
  }

  return "{…}"
}

/**
 * Collapse whitespace to keep inline hint text compact.
 */
function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

/**
 * Return true when a parsed node is a Fluent message.
 */
function isMessageNode(value: unknown): value is MessageNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "Message"
  )
}

/**
 * Return true when a parsed node is a text element.
 */
function isTextElementNode(value: unknown): value is TextElementNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "TextElement" &&
    "value" in value &&
    typeof value.value === "string"
  )
}

/**
 * Return true when a parsed node is a placeable expression wrapper.
 */
function isPlaceableNode(value: unknown): value is PlaceableNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "Placeable" &&
    "expression" in value
  )
}

/**
 * Return true when a parsed expression is a select expression.
 */
function isSelectExpressionNode(value: unknown): value is SelectExpressionNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "SelectExpression" &&
    "variants" in value &&
    Array.isArray(value.variants)
  )
}

/**
 * Compute Levenshtein (Oh Nice...) distance between two strings.
 *
 * Used to power message id suggestions. It's a good idea, and I stand by it.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const prev = new Array<number>(b.length + 1)
  const next = new Array<number>(b.length + 1)

  for (let j = 0; j <= b.length; j++) {
    prev[j] = j
  }

  for (let i = 1; i <= a.length; i++) {
    next[0] = i

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      next[j] = Math.min(next[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }

    for (let j = 0; j <= b.length; j++) {
      prev[j] = next[j]
    }
  }

  return prev[b.length]
}

/**
 * Heuristic threshold for suggestion acceptance.
 *
 * Prevents wildly incorrect suggestions.
 */
function getMaxAllowedDistance(a: string, b: string): number {
  const longest = Math.max(a.length, b.length)

  if (longest <= 6) return 2
  if (longest <= 12) return 3

  return 4
}
