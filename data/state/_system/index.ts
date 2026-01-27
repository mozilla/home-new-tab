import { create } from "zustand"
import { devtools } from "zustand/middleware"
import {
  getOrCreateTabId,
  initCrossTabSync,
  readIncomingSnapshot,
} from "./sync"
import { mergeLww, readRawSnapshot, writeRawSnapshot } from "./utilities"

import type {
  CrossTabActionApi,
  CrossTabStoreBaseActions,
  CrossTabStoreConfig,
  CrossTabStoreState,
  MergeFn,
  Snapshot,
  StateSystemFeatures,
  SyncMeta,
} from "./types"

/**
 * State System (public entrypoint)
 * ---------------------------------------------------------
 *
 * Most devs should only import from THIS file.
 *
 * This system standardizes how we build state that:
 * - converges across tabs ("shared truth")
 * - optionally persists across sessions
 * - keeps UI state separate (per-tab "local" state, plus React state)
 *
 * Practical guidance (the ladder):
 * 1) Component-only UI state ➜ React state (useState/useReducer)
 * 2) App-wide UI state (same tab only) ➜ store.local (Zustand)
 * 3) Must converge across tabs ➜ store.shared (this system)
 *
 * We do NOT use Zustand persist/subscribe middleware.
 * Persistence and cross-tab sync are explicit and deterministic:
 * - shared truth is stored as one raw snapshot in localStorage[storageKey]
 * - cross-tab updates arrive via storage events
 * - conflict resolution is deterministic (default: newer snapshot wins)
 *
 * ---
 *
 * createCrossTabStore
 * ---
 * Factory that creates a Zustand store with built-in cross-tab sync.
 *
 * Parameters:
 * - config: storage key, initial data, features (persist/crossTab/visibility)
 * - buildDomainActions: callback that receives { commitShared, getState, setState }
 *   and returns your custom action functions
 *
 * Returns an object with:
 * - useStore: React hook to access state and actions in components
 * - initSync(): call once in useEffect to wire up cross-tab listeners
 * - refreshFromStorage(): manually sync from localStorage (rarely needed)
 * - getSnapshot(), getTabId(): debug helpers
 *
 * ---
 * @example
 * ```typescript
 *
 * const store = createCrossTabStore({ ... }, ({ commitShared }) => ({
 *   myAction: () => commitShared((data) => ({ ...data, updated: true }))
 * }))
 *
 * // In your app root:
 * useEffect(() => store.initSync(), [])
 *
 * // In components:
 * const data = store.useStore((s) => s.shared.data)
 * const myAction = store.useStore((s) => s.actions.myAction)
 *
 * ```
 * ---
 * See README.md for complete examples and features guide.
 */
export function createCrossTabStore<TData, TDomainActions extends object>(
  config: CrossTabStoreConfig<TData>,
  buildDomainActions: (
    api: CrossTabActionApi<TData, TDomainActions>,
  ) => TDomainActions,
) {
  const features: Required<StateSystemFeatures> = {
    persist: true,
    crossTab: true,
    visibility: false,
    refreshOnVisible: true,
    ...(config.features ?? {}),
  }

  const nowMs = config.nowMs ?? (() => Date.now())
  const onError = config.onError ?? (() => {})
  const tabId = getOrCreateTabId()

  const merge = config.merge ?? mergeLww<TData>

  const initialSnapshot: Snapshot<TData> = {
    sync: { rev: 0, updatedAtMs: nowMs(), updatedBy: tabId },
    data: config.initialData,
    schemaVersion: config.schemaVersion,
  }

  // Startup hydration:
  // - If persist enabled: try reading raw snapshot from localStorage
  // - If migrate provided: use it to validate/transform snapshot
  const loaded = features.persist
    ? readRawSnapshot<TData>(config.storageKey, config.migrate)
    : null

  const startSnapshot = loaded ?? initialSnapshot

  type Store = CrossTabStoreState<TData> & {
    actions: CrossTabStoreBaseActions<TData> & TDomainActions
  }

  type StateUpdater = (state: Store) => Store

  const useStore = create<Store>()(
    devtools((set, get) => {
      const getState = (): Store => get() as Store

      const setState = (updater: StateUpdater, actionName?: string) => {
        // Updater-only + replace=false always.
        // This avoids Zustand overload confusion and prevents "replace" footguns.
        set(updater, false, actionName)
      }

      const bumpUi: CrossTabStoreBaseActions<TData>["bumpUi"] = () => {
        setState(
          (s) => ({
            ...s,
            local: { ...s.local, uiVersion: s.local.uiVersion + 1 },
          }),
          "stateSystem/bumpUi",
        )
      }

      const commitShared: CrossTabStoreBaseActions<TData>["commitShared"] = (
        mutate,
      ) => {
        let applied = false

        setState((s) => {
          const nextData = mutate(s.shared.data)

          // Encourage immutable updates:
          // if the same object is returned, treat it as a no-op.
          if (nextData === s.shared.data) return s

          applied = true

          const nextSnap: Snapshot<TData> = {
            ...s.shared,
            data: nextData,
            sync: {
              rev: s.shared.sync.rev + 1,
              updatedAtMs: nowMs(),
              updatedBy: tabId,
            },
            schemaVersion: config.schemaVersion ?? s.shared.schemaVersion,
          }

          if (features.persist) {
            writeRawSnapshot(config.storageKey, nextSnap)
          }

          return { ...s, shared: nextSnap }
        }, "stateSystem/commitShared")

        return applied
      }

      const applyIncoming: CrossTabStoreBaseActions<TData>["applyIncoming"] = (
        incoming,
      ) => {
        let applied = false

        setState((s) => {
          const next = merge(s.shared, incoming)
          if (next === s.shared) return s
          applied = true
          return { ...s, shared: next }
        }, "stateSystem/applyIncoming")

        return applied
      }

      const refreshFromStorage: CrossTabStoreBaseActions<TData>["refreshFromStorage"] =
        () => {
          if (!features.persist) return false

          const snap = readRawSnapshot<TData>(config.storageKey, config.migrate)
          if (!snap) return false

          const changed = applyIncoming(snap)
          if (changed) bumpUi()
          return changed
        }

      const initSync: CrossTabStoreBaseActions<TData>["initSync"] = () => {
        // With the current transport, cross-tab sync depends on localStorage writes.
        // So if persist is off, cross-tab doesn't make sense.
        if (!features.persist || !features.crossTab) return () => {}

        const cleanup = initCrossTabSync<TData>({
          storageKey: config.storageKey,
          tabId,
          nowMs,
          onError,

          readIncoming: (raw) => readIncomingSnapshot<TData>(raw),

          applyIncoming: (incomingSnap) => applyIncoming(incomingSnap),

          bumpUi,

          onVisibilityChange: features.visibility
            ? (isVisible) => {
                if (isVisible && features.refreshOnVisible) {
                  return refreshFromStorage()
                }
                return false
              }
            : undefined,
        })

        // Catch up once immediately (covers "updates happened before initSync ran").
        refreshFromStorage()

        return cleanup
      }

      const domainActions = buildDomainActions({
        commitShared,
        getState,
        setState,
      })

      return {
        shared: startSnapshot,
        local: { uiVersion: 0 },
        actions: {
          bumpUi,
          commitShared,
          applyIncoming,
          refreshFromStorage,
          initSync,
          ...domainActions,
        },
      }
    }),
  )

  return {
    useStore,

    /**
     * Convenience helpers (nice for app bootstrap).
     * Example:
     *   useEffect(() => timer.initSync(), [])
     */
    initSync: () => useStore.getState().actions.initSync(),
    refreshFromStorage: () => useStore.getState().actions.refreshFromStorage(),

    /**
     * Debug helpers (occasionally handy).
     */
    getSnapshot: () => useStore.getState().shared,
    getTabId: () => tabId,
  }
}

export type {
  CrossTabActionApi,
  CrossTabStoreBaseActions,
  CrossTabStoreConfig,
  CrossTabStoreState,
  MergeFn,
  Snapshot,
  StateSystemFeatures,
  SyncMeta,
}
