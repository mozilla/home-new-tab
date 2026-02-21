/* -------------------------------------------------------------------------------------------------
 * Synced Store: types
 * -------------------------------------------------------------------------------------------------
 *
 * This module defines the public configuration surface and the core internal
 * types used by the synced-store factory.
 *
 * Legacy flags we are intentionally dropping (no backwards compatibility):
 * - persist
 * - crossTab
 * - visibility
 * - refreshOnVisible
 *
 * The new API is semantics-shaped:
 * - sync     -> live updates across open tabs
 * - restore  -> what to load on startup (never/session/device)
 * - onVisible-> optional catch-up when a tab becomes visible
 */

/** RestoreMode
 * ---
 * How should data be persisted?
 * - never - Always start from initialData; do not read or write restore snapshots.
 * - session - Restore while the app is "still open somewhere"
 *    - Reload: restores
 *    -  New tab while another tab is open: restores
 *    -  Full browser close + later reopen: does NOT restore
 * - device - Restore across browser restarts.
 *    - Reload: restores
 *    - New tab: restores
 *    - Full browser close + later reopen: restores
 */
export type RestoreMode = "never" | "session" | "device"

/** OnVisibleMode
 * ---
 * What shall we do when the tab becomes visible
 * - none: Do nothing special when the tab becomes visible
 * - refresh: Re-read restore snapshot when the tab becomes visible
 * - ~dance (depreciated): apparently it's footloose around here~
 */
export type OnVisibleMode = "none" | "refresh"

/**
 * SyncMeta
 * ---
 * Metadata used to order frames. Last Write Wins.
 * There can be only one Highlander style.
 * 1) Higher rev wins
 * 2) If rev tied, higher updatedAtMs wins
 * 3) If still tied, lexicographic updatedBy wins (what a fun word...)
 */
export type SyncMeta = {
  rev: number
  updatedAtMs: number
  updatedBy: string
}

/**
 * SyncFrame
 * ---
 * Metadata for internal sync. Used for:
 * - restore snapshots (storage)
 * - live sync messages (transport)
 */
export type SyncFrame<TData> = {
  schemaVersion: number
  sync: SyncMeta
  data: TData
}

/**
 * MergeFn
 * ---
 * Plumbing-level conflict resolution for incoming frames...
 *
 * OR
 *
 * A merge function... Not for the faint of heart.
 *
 * Reserved:
 * - Not exposed via store config.
 * - If we add another merge policy, it should be implemented in merge.ts and
 *   surfaced via a config selector (enum), not as a per-store callback.
 */
export type MergeFn<TData> = (
  local: SyncFrame<TData>,
  incoming: SyncFrame<TData>,
) => SyncFrame<TData>

/**
 * Public config for createSyncedStore.
 */
export type SyncedStoreConfig<TData> = {
  /**
   * Domain identifier.
   *
   * Used for:
   * - BroadcastChannel name (live sync)
   * - storage keys (restore)
   */
  syncKey: string

  /** Schema version for stored frames (restore only). */
  schemaVersion: number

  /** Used when no restore snapshot exists (or restore is "never"). */
  initialData: TData

  /** Live updates across open tabs. Default: true */
  sync?: boolean

  /**
   * Restore behavior. Default: "device"
   * - "session": survives reload + new tab while app is open, but not full close/reopen
   * - "device": survives full close/reopen
   * - "never": always start fresh and do not write snapshots
   */
  restore?: RestoreMode

  /** What to do when this tab becomes visible. Default: "none" */
  onVisible?: OnVisibleMode

  /**
   * migrate (reserved)
   * ---
   * Optional hook to transform a stored snapshot into the current schema.
   *
   * Current stance:
   * - We prefer wiping restore data when schemaVersion changes.
   * - localStorage is treated as a cache, not critical persistence.
   *
   * This hook exists for future flexibility, but is intentionally not
   * part of normal store configuration. If you believe you need migration,
   * that is a systems-level decision — not a per-feature tweak.
   */
  // migrate?: (incoming: unknown) => SyncFrame<TData> | null

  /**
   * merge (reserved)
   * ---
   * Not exposed via config.
   *
   * If you think you need a different policy than LWW, add it in `merge.ts`
   * and wire it in `createSyncedStore` as a selector.
   */
  // merge?: MergeFn<TData>

  /** Optional clock injection (tests). Default: Date.now */
  nowMs?: () => number

  /** Optional error hook (telemetry / dev logging). */
  onError?: (err: unknown) => void
}

/**
 * Resolved options (internal).
 */
export type SyncedStoreOptions = {
  sync: boolean
  restore: RestoreMode
  onVisible: OnVisibleMode
}

/**
 * Store state shape.
 *
 * Public / domain-facing:
 * - data: the actual domain payload
 *
 * System-owned:
 * - _sync: metadata for ordering + schema
 * - local: per-tab UI-only flags/counters
 */
export type SyncedStoreState<TData> = {
  data: TData
  _sync: {
    schemaVersion: number
    sync: SyncMeta
  }
  local: {
    uiVersion: number
    persistenceDisabled: boolean
  }
}

/**
 * Base actions provided by the core system.
 * Domain actions are built on top of these.
 */
export type SyncedStoreBaseActions<TData> = {
  bumpUi: () => void

  /** The only supported write path for shared state. */
  commit: (mutate: (data: TData) => TData) => boolean

  /** Apply an incoming frame (from restore or live sync). */
  applyIncoming: (incoming: SyncFrame<TData>) => boolean

  /** Re-read restore snapshot and apply it (if newer). */
  refreshFromStorage: () => boolean

  /** Start live sync listeners (idempotent). Returns cleanup. */
  initSync: () => () => void
}

/**
 * Action API passed to the domain action builder.
 *
 * NOTE:
 * - commit stays as the "write gate" for shared state.
 * - getState/setState are provided for advanced cases, but most domains
 *   should only need commit.
 */
export type SyncedActionApi<TData> = {
  commit: SyncedStoreBaseActions<TData>["commit"]

  /**
   * Escape hatch for plumbing-level cases.
   * Intentionally exposes ONLY base actions (domain actions are built on top).
   */
  getState: () => SyncedStoreState<TData> & {
    actions: SyncedStoreBaseActions<TData>
  }

  /**
   * Escape hatch for plumbing-level cases.
   * Intentionally cannot reference domain actions.
   */
  setState: (
    updater: (
      state: SyncedStoreState<TData> & {actions: SyncedStoreBaseActions<TData>}, //prettier-ignore
    ) => SyncedStoreState<TData> & {actions: SyncedStoreBaseActions<TData>}, //prettier-ignore
    actionName?: string,
  ) => void
}
