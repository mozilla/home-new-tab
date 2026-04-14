import type { ErrorReport, MetricReport } from "./reporting"

/**
 * Target context for opening a link.
 */
export type LinkTarget = "current" | "new-tab" | "new-window" | "private"

/**
 * BrowserCoreAdapter
 * ---
 * Thin conduit to browser-native capabilities.
 *
 * Data side: getData() is called by the coordinator for `transport: "core"` schema
 * sources. The key maps to a CoordinatedData field; the return value is placed
 * there as-is. The coordinator has no knowledge of what any key means.
 *
 * Action side: navigation, Places, search, and reporting methods are called by
 * the renderer via RendererInitArgs. In production both sides delegate to
 * browser core APIs.
 */
export type BrowserCoreAdapter = {
  // --- Data side (coordinator-internal, driven by data-schema.json) ---

  /** Returns raw data for a core schema key, or null if unavailable. */
  getData: (key: string) => Promise<unknown>

  // --- Action side (renderer-facing, provided via RendererInitArgs) ---

  /** Opens a URL in the specified target context. */
  openLink: (url: string, target?: LinkTarget) => void
  /** Bookmarks the given URL in the browser's Places system. */
  bookmarkUrl: (url: string, title: string) => void
  /** Removes a bookmark by its identifier. */
  deleteBookmark: (id: string) => void
  /** Removes a URL from browsing history. */
  deleteHistory: (url: string) => void
  /** Hands off a search query to the browser's search system. */
  handoffSearch: (query: string) => void
  /** Reports a content item for policy review. */
  reportContent: (url: string) => void
  /** Signals that the user disabled ad surfaces and data should be deleted. */
  deleteUserData: () => void
}

/**
 * StorageAdapter
 * ---
 * Thin conduit to persistent key-value storage (localStorage).
 * No schema knowledge — the renderer owns storage key names and value shapes.
 */
export type StorageAdapter = {
  /** Returns the raw string value for a key, or null if absent. */
  read: (key: string) => string | null
  /** Writes a raw string value for a key. */
  write: (key: string, value: string) => void
  /** Removes a key from storage. */
  delete: (key: string) => void
}

/**
 * TelemetryAdapter
 * ---
 * Thin conduit to the platform telemetry channel.
 */
export type TelemetryAdapter = {
  /** Reports an error to the platform telemetry system. */
  reportError: (report: ErrorReport) => void
  /** Reports a metric measurement to the platform telemetry system. */
  reportMetric: (report: MetricReport) => void
}
