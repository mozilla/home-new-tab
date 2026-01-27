/**
 * State System Types
 * ---------------------------------------------------------
 * These types support a small, explicit "shared truth + cross-tab coherence" system.
 *
 * Vocabulary:
 * - shared: authoritative truth intended to converge across tabs
 * - local: per-tab UI/session state (does not converge across tabs)
 *
 * Note:
 * - Keep types boring and stable.
 * - Most devs should not need to touch this file.
 */

/**
 * SyncMeta
 * ---
 * Metadata attached to every snapshot to enable deterministic conflict resolution.
 *
 * When two tabs modify state simultaneously, these fields determine which change wins.
 * This prevents tabs from fighting over state and ensures eventual consistency.
 *
 * See utilities.ts > isIncomingNewer() for the comparison logic.
 */
export type SyncMeta = {
  /**
   * Monotonic revision counter.
   * Invariant: every local commit increments this by 1.
   */
  rev: number

  /**
   * Wall-clock time (Date.now()) when the snapshot was authored.
   * Used as a tie-breaker when rev ties (rare).
   */
  updatedAtMs: number

  /**
   * Per-tab unique identifier (NOT shared across tabs).
   * Used to ignore self-authored events and prevent ping-pong.
   */
  updatedBy: string
}

/**
 * Snapshot
 * ---
 * The complete state snapshot format stored in localStorage.
 *
 * This is what gets serialized to localStorage[storageKey] and shared across tabs.
 * Intentionally framework-agnostic - just plain JSON that any system could read.
 *
 * Structure:
 * - sync: metadata for conflict resolution
 * - data: your actual domain data
 * - schemaVersion: optional, for future migrations
 */
export type Snapshot<TData> = {
  sync: SyncMeta
  data: TData
  schemaVersion?: number
}

/**
 * MergeFn
 * ---
 * Function that resolves conflicts when multiple tabs write simultaneously.
 *
 * Default behavior (mergeLww): newer snapshot replaces older one completely.
 * Override this if you need field-level merging or custom conflict resolution.
 *
 * Most use cases don't need a custom merge function - LWW is simple and reliable.
 */
export type MergeFn<TData> = (
  local: Snapshot<TData>,
  incoming: Snapshot<TData>,
) => Snapshot<TData>

/**
 * StateSystemFeatures
 * ---
 * Feature flags that control how the state system behaves.
 *
 * All features default to sensible values and are optional.
 * Most stores will just use the defaults (persist + crossTab enabled).
 */
export type StateSystemFeatures = {
  /**
   * Persist shared truth to localStorage as a raw snapshot.
   * If false, shared truth is in-memory only.
   */
  persist?: boolean

  /**
   * Apply instant cross-tab updates.
   * Note: With the current transport (storage events), crossTab requires persist.
   */
  crossTab?: boolean

  /**
   * If true, the store will react to "visibilitychange" events.
   * Useful for timer-like systems to "snap" correctness when returning to a tab.
   */
  visibility?: boolean

  /**
   * If visibility is enabled, refresh from localStorage when tab becomes visible.
   * Helps prevent editing stale data.
   */
  refreshOnVisible?: boolean
}

/**
 * CrossTabStoreConfig
 * ---
 * Configuration object passed to createCrossTabStore().
 *
 * Required fields:
 * - storageKey: unique key for localStorage (e.g., "app:settings")
 * - initialData: default state when nothing is persisted yet
 *
 * Optional fields let you customize merging, migrations, and features.
 * See README.md for complete examples.
 */
export type CrossTabStoreConfig<TData> = {
  storageKey: string
  schemaVersion?: number
  initialData: TData

  /**
   * Optional merge policy override. Defaults to LWW full snapshot replacement.
   */
  merge?: MergeFn<TData>

  /**
   * Optional migration hook if you later change snapshot shape/version.
   * Called when reading from storage. Return null to ignore/unload.
   */
  migrate?: (incoming: unknown) => Snapshot<TData> | null

  features?: StateSystemFeatures

  /**
   * For tests / deterministic behavior.
   */
  nowMs?: () => number

  /**
   * Optional error hook. Defaults to silent.
   */
  onError?: (err: unknown) => void
}

/**
 * CrossTabStoreState
 * ---
 * The shape of the Zustand store returned by createCrossTabStore().
 *
 * Two partitions:
 * - shared: authoritative truth that syncs across tabs (your domain data)
 * - local: per-tab UI state that does NOT sync (e.g., uiVersion for rerenders)
 *
 * Access in components via: `const data = store.useStore((s) => s.shared.data)`
 */
export type CrossTabStoreState<TData> = {
  shared: Snapshot<TData>
  local: {
    /**
     * Local rerender nudge. Derived UI can depend on time/visibility/external events.
     */
    uiVersion: number
  }
}

/**
 * CrossTabStoreBaseActions
 * ---
 * Core actions available on every store created by createCrossTabStore().
 *
 * These are the system-provided actions. Your custom domain actions
 * (defined in buildDomainActions callback) are merged with these.
 *
 * Most of the time you'll only use commitShared() and initSync().
 * The others are for advanced scenarios or internal system use.
 */
export type CrossTabStoreBaseActions<TData> = {
  /**
   * Local-only rerender nudge. Useful after external events.
   */
  bumpUi: () => void

  /**
   * The ONE blessed way to change shared truth.
   * - stamps sync metadata (rev/updatedAtMs/updatedBy)
   * - writes raw snapshot to localStorage (if persist enabled)
   */
  commitShared: (mutate: (data: TData) => TData) => boolean

  /**
   * Apply incoming snapshot (storage/refresh).
   * Returns true if shared truth changed.
   */
  applyIncoming: (incoming: Snapshot<TData>) => boolean

  /**
   * Read from localStorage and apply if newer.
   */
  refreshFromStorage: () => boolean

  /**
   * Initialize cross-tab listeners (storage + optional visibility).
   * Returns cleanup function.
   */
  initSync: () => () => void
}

/**
 * CrossTabActionApi
 * ---
 * API object passed to your buildDomainActions callback.
 *
 * This is what you receive as the first parameter when defining custom actions:
 * ```typescript
 * createCrossTabStore(config, ({ commitShared, getState, setState }) => ({
 *   myAction: () => commitShared((data) => ({ ...data, updated: true }))
 * }))
 * ```
 *
 * Intentionally small so you don't need to know Zustand internals.
 * Use commitShared for 99% of state changes.
 */
export type CrossTabActionApi<TData, TDomainActions extends object> = {
  /**
   * Prefer this for all shared truth changes.
   */
  commitShared: CrossTabStoreBaseActions<TData>["commitShared"]

  /**
   * Escape hatches (use sparingly):
   * - getState(): read current store state
   * - setState(): updater-only write (always replace=false)
   */
  getState: () => CrossTabStoreState<TData> & {
    actions: CrossTabStoreBaseActions<TData> & TDomainActions
  }

  setState: (
    updater: (
      state: CrossTabStoreState<TData> & {
        actions: CrossTabStoreBaseActions<TData> & TDomainActions
      },
    ) => CrossTabStoreState<TData> & {
      actions: CrossTabStoreBaseActions<TData> & TDomainActions
    },
    actionName?: string,
  ) => void
}
