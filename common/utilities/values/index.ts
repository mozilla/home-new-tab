/**
 * Returns true if the given path string looks like a JavaScript module URL.
 * Used to avoid accidentally importing non-JS assets (e.g. JSON) as modules.
 * This is a weak check, like leaving a rake across the path, but it will
 * contribute to err on the side of caution
 */
export function isJsModulePath(path: string): boolean {
  return /\.js($|\?)/.test(path)
}

/**
 * safeJsonParse
 * ---
 * Parse JSON with graceful fallback.
 *
 * Returns null instead of throwing if input is malformed.
 * Useful for reading potentially corrupted localStorage values.
 */
export function safeJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}
