import type { StoreApi, UseBoundStore } from "zustand"

/* -------------------------------------------------------------------------------------------------
 * Synced Store: types
 * -------------------------------------------------------------------------------------------------
 *
 * This module defines the public configuration surface and the core internal
 * types used by the synced-store factory.
 *
 * Semantic Shaped API
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
 * - ~dance (deprecated): apparently it's footloose around here~
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
 * System-owned (internal metadata):
 * - _internal: schema + sync ordering metadata
 * - All runtime bookkeeping lives in closure scope (guards/runtime).
 */
export type SyncedStoreState<TData> = {
  data: TData
  _internal: {
    schemaVersion: number
    sync: SyncMeta
  }
}
/* -------------------------------------------------------------------------------------------------
 * Public model + domain/system action split
 * ------------------------------------------------------------------------------------------------- */

/**
 * SyncedStoreShape
 * ---
 * Canonical model shape used throughout the synced-store system.
 *
 * Used for:
 * - public hook surface (`use()` returns this shape)
 * - action builder mental model (`{ data, actions }`)
 */
export type SyncedStoreShape<TData, TActions extends object> = {
  data: TData
  actions: TActions
}

/**
 * SyncedStoreDomainBaseActions
 * ---
 * Base actions intended for feature/domain code.
 *
 * Mental model:
 * - set    -> local-only update (no persistence, no broadcast)
 * - commit -> shared update (sync + restore + meta bump)
 */
export type SyncedStoreDomainBaseActions<TData> = {
  /**
   * Local-only update.
   *
   * Notes:
   * - Intended for ephemeral/UI-ish state that should not sync/restore.
   * - Returns `true` if a change was applied, else `false`.
   */
  set: (mutate: (data: TData) => TData, actionName?: string) => boolean

  /**
   * Shared write gate for sync'd state.
   *
   * Notes:
   * - Treat `data` as immutable
   * - Return the same reference for no-op
   * - Return a new object when changed
   *
   * Returns `true` when a change was applied/emitted, else `false`.
   */
  commit: (mutate: (data: TData) => TData, actionName?: string) => boolean
}

/**
 * SyncedStoreSystemActions
 * ---
 * Plumbing/system actions.
 *
 * Not intended for feature code.
 * Prefer calling these via the returned handle (`initSync`, etc) rather than
 * reaching into store actions.
 */
export type SyncedStoreSystemActions<TData> = {
  /** Apply an incoming frame (from restore or live sync). */
  applyIncoming: (incoming: SyncFrame<TData>) => boolean

  /** Re-read restore snapshot and apply it (if newer). */
  refreshFromStorage: () => boolean

  /** Start live sync listeners (idempotent). Returns cleanup. */
  initSync: () => () => void
}

/**
 * Action context passed to the domain action builder.
 *
 * Team-facing mental model:
 * - get()        -> read {data, actions}
 * - set(mutate)  -> local-only update
 * - commit(...)  -> shared update (sync/restore)
 *
 * Notes:
 * - `get()` returns the public model shape (so actions can read other actions if desired).
 * - No raw Zustand getState/setState exposure here (avoid API mixing).
 */
export type SyncedActionCtx<TData, TDomainActions extends object> = {
  get: () => SyncedStorePublicModel<TData, TDomainActions>
  set: SyncedStoreDomainBaseActions<TData>["set"]
  commit: SyncedStoreDomainBaseActions<TData>["commit"]
}

/**
 * SyncedDomainActionBuilder
 * ---
 * Factory for domain actions for a given store.
 */
export type SyncedDomainActionBuilder<TData, TDomainActions extends object> = (
  ctx: SyncedActionCtx<TData, TDomainActions>,
) => TDomainActions

/**
 * SyncedStorePublicModel
 * ---
 * The **only** model shape feature code should consume.
 *
 * Why it exists:
 * - Prevents accidental coupling to `_internal` (schema + sync metadata).
 * - Keeps the public surface stable even if internal bookkeeping evolves.
 *
 * Notes:
 * - `actions` includes domain-safe base actions + domain actions.
 * - System/plumbing actions are intentionally excluded from this surface.
 */
export type SyncedStorePublicModel<
  TData,
  TDomainActions extends object,
> = SyncedStoreShape<
  TData,
  SyncedStoreDomainBaseActions<TData> & TDomainActions
>

/**
 * StoreHook
 * ---
 * Small, Zustand-like hook overload:
 * - `use()` returns the whole model
 * - `use(selector)` returns a selected value
 * - `use(selector, equalityFn)` allows stable object/array selectors
 *
 * Notes:
 * - If your selector returns an object/array literal, pass an equality fn
 *   (e.g. Zustand's `shallow`) to avoid unnecessary rerenders.
 */
export type StoreHook<TModel> = {
  (): TModel
  <U>(selector: (state: TModel) => U, equalityFn?: (a: U, b: U) => boolean): U
}

/**
 * SyncedStoreUsePublic
 * ---
 * Public-facing hook type for a synced store.
 *
 * Equivalent to:
 *   StoreHook<SyncedStorePublicModel<...>>
 *
 * Kept as a named alias so call sites and error messages stay readable.
 */
export type SyncedStoreUsePublic<
  TData,
  TDomainActions extends object,
> = StoreHook<SyncedStorePublicModel<TData, TDomainActions>>

/**
 * SyncedStoreInternalState
 * ---
 * Full internal store state shape used by the raw Zustand hook.
 *
 * Contains:
 * - `data` — the shared domain payload
 * - `_internal` — schema + sync ordering metadata
 * - `actions` — domain actions + all base/system actions
 *
 * Important:
 * - This type is for `_unsafe_useStore` only.
 * - Feature code should never depend on this shape.
 * - The supported public surface is `SyncedStorePublicModel`
 *   (i.e. `{ data, actions }` via `use`).
 *
 * If this type changes, the public contract should remain stable.
 */
export type SyncedStoreInternalState<
  TData,
  TDomainActions extends object,
> = SyncedStoreState<TData> & {
  actions: SyncedStoreDomainBaseActions<TData> &
    SyncedStoreSystemActions<TData> &
    TDomainActions
}

/**
 * Store factory return type.
 * - use: public hook (only {data, actions})
 * - _unsafe_useStore: full internal Zustand hook (includes _internal, etc.)
 */
export type SyncedStoreHandle<TData, TDomainActions extends object> = {
  /** Public domain hook: { data, actions } */
  use: SyncedStoreUsePublic<TData, TDomainActions>

  debug: {
    /**
     * System-level init (idempotent). Returns cleanup.
     * Prefer this over reaching into internal actions.
     */
    initSync: () => () => void

    /** Snapshot getter for testing/debugging/telemetry. */
    getSyncFrame: () => SyncFrame<TData>

    /** Tab identifier for testing/debugging/telemetry. */
    getTabId: () => string

    /** Internal escape hatch (tests + system-level debugging only). */
    _unsafe_useStore: UseBoundStore<
      StoreApi<SyncedStoreInternalState<TData, TDomainActions>>
    >
  }
}
