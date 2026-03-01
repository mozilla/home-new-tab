import { create } from "zustand"
import { devtools } from "zustand/middleware"
import {
  cleanupRuntime as cleanupRuntimeGuard,
  createEnsureRuntime,
  createGuardRuntime,
} from "./guards"
import { mergeLWW } from "./merge"
import {
  readRestoreFrameSyncBestEffort,
  writeRestoreFrame,
  deviceRestoreKey,
  sessionRestoreKey,
  getCachedAppSessionId,
  readStoredSyncFrame,
} from "./restore"
import { getOrCreateTabId, getOrCreateAppSessionId } from "./session"
import { createBroadcastChannelTransport } from "./transport"

import type { EnsureRuntimeMode } from "./guards"
import type {
  SyncedStoreConfig,
  SyncedStoreHandle,
  SyncedStoreState,
  SyncedStoreDomainBaseActions,
  SyncedStoreSystemActions,
  SyncedDomainActionBuilder,
  SyncFrame,
  RestoreMode,
  OnVisibleMode,
  SyncedStorePublicModel,
} from "./types"

// Overloads (type-only)
// - Allows a single generic shaped as `{ data, actions }`
// - Keeps the two-generic form available for explicit typing
export function createSyncedStore<
  TStore extends { data: unknown; actions: object },
>(
  config: SyncedStoreConfig<TStore["data"]>,
  buildDomainActions: SyncedDomainActionBuilder<
    TStore["data"],
    TStore["actions"]
  >,
): SyncedStoreHandle<TStore["data"], TStore["actions"]>

export function createSyncedStore<TData, TDomainActions extends object>(
  config: SyncedStoreConfig<TData>,
  buildDomainActions: SyncedDomainActionBuilder<TData, TDomainActions>,
): SyncedStoreHandle<TData, TDomainActions>

/**
 * createSyncedStore
 * ---
 * Creates a Zustand store with optional:
 * - Live cross-tab sync (BroadcastChannel)
 * - Restore persistence (localStorage)
 *
 * Key behaviors:
 * - Deterministic convergence: all tabs should settle on the same data.
 * - SWR-style startup: seed from restore if available; otherwise fall back to initialData.
 * - Automatic runtime wiring: sync listeners are started in the browser as soon as possible
 *   (microtask) so a "silent" tab can still receive updates without requiring a subscribe or
 *   a local commit.
 *
 * Mental model:
 * - `data` is the domain payload (what feature code reads/writes).
 * - `_internal` is system metadata used for deterministic ordering.
 *
 * Wire format:
 * - `SyncFrame` is used only for restore snapshots + transport messages.
 *
 * Notes:
 * - Live sync startup is idempotent and best-effort. If BroadcastChannel is unavailable,
 *   sync becomes a no-op for that store instance.
 */
export function createSyncedStore<TData, TDomainActions extends object>(
  config: SyncedStoreConfig<TData>,
  buildDomainActions: SyncedDomainActionBuilder<TData, TDomainActions>,
): SyncedStoreHandle<TData, TDomainActions> {
  /**
   * Options
   * ---
   * Defaults are intentionally boring:
   * - sync: enabled
   * - restore: device (persists across browser restarts)
   * - onVisible: none (opt-in refresh behavior)
   *
   * Note:
   * - We cast these defaults to the config unions to avoid TS widening.
   */
  const options = {
    sync: true,
    restore: "device" as RestoreMode,
    onVisible: "none" as OnVisibleMode,
    ...config,
  }

  /**
   * Injections / hooks
   * ---
   * These are overridable for tests or app-level concerns.
   */
  const nowMs = config.nowMs ?? (() => Date.now())
  const onError = config.onError ?? (() => {})

  // For now we always use LWW to keep the system boring and deterministic.
  // Last Write Wins — 60% of the time it works every time
  const merge = mergeLWW

  /**
   * Stable tab identity
   * ---
   * Used for:
   * - sync metadata (updatedBy)
   * - echo suppression in BroadcastChannel transport
   */
  const tabId = getOrCreateTabId()

  /**
   * Seed frame (SWR-style)
   * ---
   * Try restore first (best-effort, sync read).
   * If absent or invalid, fall back to initialData.
   *
   * Important:
   * - This should never throw; errors should route to onError.
   * - Migration (if provided) happens inside restore read.
   */
  const seededFrame = readRestoreFrameSyncBestEffort<TData>({
    restore: options.restore,
    syncKey: config.syncKey,
    schemaVersion: config.schemaVersion,
    onError,
  }) ?? {
    schemaVersion: config.schemaVersion,
    data: config.initialData,
    sync: { rev: 0, updatedAtMs: nowMs(), updatedBy: tabId },
  }

  const toFrame = (
    state: Pick<SyncedStoreState<TData>, "data" | "_internal">,
  ): SyncFrame<TData> => ({
    schemaVersion: state._internal.schemaVersion,
    sync: state._internal.sync,
    data: state.data,
  })

  /**
   * applyFrameToState
   * ---
   * Applies a SyncFrame onto the store state.
   *
   * Important:
   * - Preserves any extra fields on the state (e.g. actions) via spread.
   * - Always updates both `data` and `_internal` so schemaVersion/meta never drift.
   */
  const applyFrameToState = <State extends SyncedStoreState<TData> & object>(
    state: State,
    frame: SyncFrame<TData>,
  ): State => ({
    ...state,
    data: frame.data,
    _internal: { schemaVersion: frame.schemaVersion, sync: frame.sync },
  })

  /**
   * Guard runtime (factory closure)
   * ---
   * Holds idempotency flags + teardown callbacks for runtime guards.
   */
  const guardRuntime = createGuardRuntime<TData>()

  /**
   * cleanupRuntime
   * ---
   * Tears down any runtime listeners owned by this store instance.
   * Safe to call multiple times.
   */
  const cleanupRuntime = () =>
    cleanupRuntimeGuard({ runtime: guardRuntime, onError })

  /**
   * Incoming-frame handler indirection
   * ---
   * Transport may be created before store actions exist.
   * This variable is set once the store initializer defines applyIncoming
   */
  let onIncomingFrame: (incoming: SyncFrame<TData>) => void = () => {}

  /**
   * Single ensureRuntime instance (lazy created).
   *
   * We intentionally defer creation until first use so that:
   * - `useStore` exists
   * - `useStore.getState().actions` is valid
   *
   * After creation, this function is reused for the store lifetime.
   */
  let ensureRuntimeImpl: ((mode: EnsureRuntimeMode) => void) | null = null

  /**
   * getEnsureRuntime
   * ---
   * Lazily creates the runtime ensure function once per store instance.
   *
   * This is used by:
   * - subscribe auto-start
   * - commit belt+suspenders
   * - initSync escape hatch
   */
  const getEnsureRuntime = (useStore: {
    getState: () => SyncedStoreState<TData> & {
      actions: { refreshFromStorage: () => boolean }
    }
  }) => {
    if (ensureRuntimeImpl) return ensureRuntimeImpl

    ensureRuntimeImpl = createEnsureRuntime<TData>({
      runtime: guardRuntime,

      sync: options.sync,
      restore: options.restore,
      onVisible: options.onVisible,

      syncKey: config.syncKey,
      tabId,

      onError,

      getActions: () => useStore.getState().actions,

      getFrame: () => {
        const s = useStore.getState()
        return toFrame(s)
      },

      getCachedAppSessionId,
      getOrCreateAppSessionId,

      onFrame: (incoming) => onIncomingFrame(incoming),
      createTransport: (args) => createBroadcastChannelTransport<TData>(args),
    })

    return ensureRuntimeImpl
  }

  /**
   * Store (internal)
   * ---
   * Full Zustand state shape for this synced store instance.
   *
   * Contains:
   * - domain data
   * - internal sync metadata
   * - ALL actions (domain + system)
   *
   * Important:
   * - This is NOT the public model.
   * - `use()` projects a domain-safe surface and hides system actions.
   */
  type Store = SyncedStoreState<TData> & {
    actions: SyncedStoreDomainBaseActions<TData> &
      SyncedStoreSystemActions<TData> &
      TDomainActions
  }

  /**
   * publicActionsRef
   * ---
   * Domain-safe action surface exposed by `use()`.
   *
   * Internal state stores BOTH domain and system actions.
   * Feature code must only see:
   *   { set, commit, ...domainActions }
   *
   * We therefore:
   * - Build `publicActions` inside the store initializer.
   * - Capture it here.
   * - Have `use()` return this object instead of `s.actions`.
   *
   * Bootstrapping note:
   * - Temporarily null during action construction.
   * - Guaranteed non-null after initializer completes.
   */
  let publicActionsRef:
    | (SyncedStoreDomainBaseActions<TData> & TDomainActions)
    | null = null

  /**
   * useStore (internal Zustand hook)
   * ---
   * Raw Zustand store backing this synced store instance.
   *
   * Responsibilities:
   * - Holds full internal state (including system actions).
   * - Performs deterministic merge + frame application.
   * - Executes local writes (`set`) and shared writes (`commit`).
   *
   * Not for feature code.
   * Public access must go through `use()` below.
   */
  const useStore = create<Store>()(
    devtools((set, get) => {
      const setState = (updater: (s: Store) => Store, name?: string) =>
        set(updater, false, name)

      /**
       * applyIncoming
       * ---
       * Applies an incoming SyncFrame using a deterministic merge.
       */
      const applyIncoming: SyncedStoreSystemActions<TData>["applyIncoming"] = (
        incoming,
      ) => {
        let applied = false

        setState((state) => {
          const localFrame = toFrame(state)
          const nextFrame = merge(localFrame, incoming)
          if (nextFrame === localFrame) return state

          applied = true
          return applyFrameToState(state, nextFrame)
        }, "syncedStore/applyIncoming")

        return applied
      }

      /**
       * Wire transport -> store
       * ---
       * Safely define the transport callback.
       */
      onIncomingFrame = (incoming) => {
        applyIncoming(incoming)
      }

      /**
       * refreshFromStorage
       * ---
       * Re-read the latest restore snapshot (best-effort) and apply it if newer.
       *
       * Semantics:
       * - Reads the configured restore key (device/session).
       * - Treats the stored snapshot as an "incoming frame" and applies it via merge.
       * - returns true if data/_internal changed
       *
       * Notes:
       * - If restore is "never", this is a no-op (returns false).
       * - For session restore, returns false if we don't yet know sessionId.
       */
      const refreshFromStorage: SyncedStoreSystemActions<TData>["refreshFromStorage"] =
        () => {
          if (options.restore === "never") return false

          let storageKey: string | null = null

          if (options.restore === "device") {
            storageKey = deviceRestoreKey(config.syncKey)
          } else {
            const sessionId = getCachedAppSessionId()
            if (!sessionId) return false
            storageKey = sessionRestoreKey(sessionId, config.syncKey)
          }

          const stored = readStoredSyncFrame<TData>(
            storageKey,
            config.schemaVersion,
            onError,
          )
          if (!stored) return false

          return applyIncoming(stored)
        }

      const setLocal: SyncedStoreDomainBaseActions<TData>["set"] = (mutate) => {
        let applied = false

        setState((s) => {
          const nextData = mutate(s.data)
          if (nextData === s.data) return s

          applied = true
          return { ...s, data: nextData }
        }, "syncedStore/set")

        return applied
      }

      /**
       * commit
       * ---
       * Shared write gate for synced state.
       *
       * What it does:
       * - Applies `mutate` to the current `data`.
       * - If `data` changes, bumps sync metadata and produces a new SyncFrame.
       *
       * Guarantees:
       * - No-op friendly: if `mutate` returns the same `data` reference, nothing happens.
       * - Deterministic ordering: when applied, sync meta is bumped:
       *   - rev increments
       *   - updatedAtMs set from `nowMs()`
       *   - updatedBy set to this tabId
       *
       * Side effects (best-effort, only when a change was applied):
       * - Live sync: broadcast the new frame (when sync enabled / transport available).
       * - Restore: persist the new frame (when restore !== "never").
       *
       * Ordering:
       * - State is committed first.
       * - Side effects run after the commit (keeps the updater pure and UI responsive).
       *
       * Returns:
       * - true if a change was applied (and therefore a frame was emitted),
       * - false if the mutation was a no-op.
       *
       * Related:
       * - `set` performs a local-only update (no meta bump, no broadcast, no restore).
       */
      const commit: SyncedStoreDomainBaseActions<TData>["commit"] = (
        mutate,
      ) => {
        getEnsureRuntime(useStore)("commit")

        let applied = false
        let nextFrame: SyncFrame<TData> | null = null

        setState((s) => {
          const nextData = mutate(s.data)
          if (nextData === s.data) return s

          applied = true

          nextFrame = {
            schemaVersion: config.schemaVersion,
            data: nextData,
            sync: {
              rev: s._internal.sync.rev + 1,
              updatedAtMs: nowMs(),
              updatedBy: tabId,
            },
          }

          return applyFrameToState(s, nextFrame)
        }, "syncedStore/commit")

        if (applied && nextFrame) {
          // 1) Live sync (best-effort)
          try {
            guardRuntime.transport?.post(nextFrame)
          } catch (err) {
            onError(err)
          }

          // 2) Restore persistence (best-effort)
          if (options.restore !== "never") {
            if (options.restore === "device") {
              writeRestoreFrame({
                restore: options.restore,
                syncKey: config.syncKey,
                frame: nextFrame,
                onError,
              })
            } else {
              getOrCreateAppSessionId()
                .then((sessionId) =>
                  writeRestoreFrame({
                    restore: options.restore,
                    syncKey: config.syncKey,
                    frame: nextFrame!,
                    sessionId,
                    onError,
                  }),
                )
                .catch(onError)
            }
          }
        }

        return applied
      }
      /**
       * initSync
       * ---
       * Optional manual escape hatch. Safe and idempotent.
       *
       * Most callers should never need this because we auto-start on:
       * - first subscribe, and
       * - first commit
       */
      const initSync = () => {
        getEnsureRuntime(useStore)("manual")
        return () => cleanupRuntime()
      }

      const getPublic = (): SyncedStorePublicModel<TData, TDomainActions> => {
        const s = get() as Store

        // During action construction, domain actions may not exist yet.
        // We still provide a valid public surface (base actions), then
        // "upgrade" to the full publicActions object after domainActions are built.
        const actions =
          publicActionsRef ??
          ({
            set: setLocal,
            commit,
          } as unknown as SyncedStoreDomainBaseActions<TData> & TDomainActions)

        return { data: s.data, actions }
      }

      const domainActions = buildDomainActions({
        get: getPublic,
        set: setLocal,
        commit,
      })

      const publicActions = {
        set: setLocal,
        commit,
        ...domainActions,
      } satisfies SyncedStoreDomainBaseActions<TData> & TDomainActions

      // upgrade getPublic() to return the real deal from now on
      publicActionsRef = publicActions

      const internalActions = {
        ...publicActions,
        applyIncoming,
        refreshFromStorage,
        initSync,
      } satisfies SyncedStoreDomainBaseActions<TData> &
        SyncedStoreSystemActions<TData> &
        TDomainActions

      return {
        data: seededFrame.data,
        _internal: {
          schemaVersion: seededFrame.schemaVersion,
          sync: seededFrame.sync,
        },
        actions: internalActions,
      }
    }),
  )

  /**
   * Auto-start sync on first subscribe (non-React-specific).
   * ---
   * This avoids an app-level init call footgun.
   *
   * Belt+suspenders:
   * - commit also calls ensureRuntime in case the store is used without subscribers.
   */
  const originalSubscribe = useStore.subscribe
  useStore.subscribe = ((...args) => {
    getEnsureRuntime(useStore)("subscribe")
    return originalSubscribe(...args)
  }) as typeof useStore.subscribe

  if (typeof window !== "undefined" && options.sync) {
    queueMicrotask(() => {
      // Best-effort: starts transport even if nobody subscribes yet.
      // Still idempotent due to guard runtime.
      getEnsureRuntime(useStore)("manual")
    })
  }

  type PublicModel = SyncedStorePublicModel<TData, TDomainActions>
  /**
   * use
   * ---
   * Public hook for the store.
   *
   * Behavior:
   * - With selector: projects `{data, actions}` and runs selector against it.
   * - Without selector: returns `{data, actions}`.
   *
   * Important:
   * - This intentionally does NOT expose `_internal`.
   * - This is the hook domains should export (e.g. `export const useTimer = timer.use`).
   */
  function use(): PublicModel
  function use<U>(selector: (state: PublicModel) => U): U
  function use<U>(selector?: (state: PublicModel) => U) {
    if (!publicActionsRef) {
      // Should never happen: initializer runs before anyone can call use().
      // But this keeps the invariant explicit.
      throw new Error("SyncedStore: public actions not initialized")
    }

    if (selector) {
      return useStore((s) =>
        selector({ data: s.data, actions: publicActionsRef! }),
      )
    }
    return useStore((s) => ({ data: s.data, actions: publicActionsRef! }))
  }

  return {
    /** Public domain hook: { data, actions } */
    use,

    debug: {
      /** Internal escape hatch (tests + system-level debugging only). */
      _unsafe_useStore: useStore,

      /** Manual escape hatch. Usually unnecessary due to auto-start. */
      initSync: () => useStore.getState().actions.initSync(),

      /** Read the current SyncFrame (useful for debugging/tests). */
      getSyncFrame: () => {
        const s = useStore.getState()
        const frame: SyncFrame<TData> = toFrame(s)
        return frame
      },

      /** Stable ID for this tab (useful for debugging/tests). */
      getTabId: () => tabId,
    },
  }
}
