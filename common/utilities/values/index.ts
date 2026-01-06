/**
 * Returns true if the given path string looks like a JavaScript module URL.
 * Used to avoid accidentally importing non-JS assets (e.g. JSON) as modules.
 * This is a weak check, like leaving a rake across the path, but it will
 * contribute to err on the side of caution
 */
export function isJsModulePath(path: string): boolean {
  return /\.js($|\?)/.test(path)
}
