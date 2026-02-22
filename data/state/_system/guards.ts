import type { OnVisibleMode, RestoreMode, SyncFrame } from "./types"

/**
 * TransportHandle
 * ---
 * Small wrapper around the live-sync transport.
 *
 * Note:
 * - In evergreen browsers this is BroadcastChannel-backed.
 * - When unavailable, the transport is expected to be a no-op.
 */
export type TransportHandle<TData> = {
  /** Broadcast an updated SyncFrame to other tabs. */
  post: (frame: SyncFrame<TData>) => void

  /** Cleanup any listeners/resources held by the transport. */
  cleanup: () => void
}

export type GuardRuntime<TData> = {
  transport: TransportHandle<TData> | null
  transportStarted: boolean

  onVisibleStarted: boolean
  onVisibleCleanup: (() => void) | null

  sessionCatchUpStarted: boolean
}

export function createGuardRuntime<TData>(): GuardRuntime<TData> {
  return {
    transport: null,
    transportStarted: false,
    onVisibleStarted: false,
    onVisibleCleanup: null,
    sessionCatchUpStarted: false,
  }
}

/**
 * cleanupRuntime
 * ---
 * Tears down any runtime listeners owned by this store instance:
 * - BroadcastChannel transport
 * - visibilitychange refresh (onVisible:"refresh")
 *
 * Safe to call multiple times.
 */
export function cleanupRuntime<TData>(args: {
  runtime: GuardRuntime<TData>
  onError: (err: unknown) => void
}) {
  const { runtime, onError } = args

  try {
    runtime.transport?.cleanup()
  } catch (err) {
    onError(err)
  } finally {
    runtime.transport = null
    runtime.transportStarted = false
  }

  try {
    runtime.onVisibleCleanup?.()
  } catch (err) {
    onError(err)
  } finally {
    runtime.onVisibleCleanup = null
    runtime.onVisibleStarted = false
  }
}

/**
 * ensureTransport
 * ---
 * Idempotently starts live sync.
 *
 * Start triggers:
 * - first subscribe (normal path)
 * - first commit (belt+suspenders for non-subscribed usage)
 */
function ensureTransport<TData>(args: {
  runtime: GuardRuntime<TData>
  sync: boolean
  syncKey: string
  tabId: string
  onError: (err: unknown) => void
  onFrame: (incoming: SyncFrame<TData>) => void

  /** Read the current local frame WITHOUT committing.*/
  getFrame: () => SyncFrame<TData>

  createTransport: (args: {
    syncKey: string
    tabId: string
    onFrame: (incoming: SyncFrame<TData>) => void
    onError: (err: unknown) => void
    getFrame: () => SyncFrame<TData>
  }) => TransportHandle<TData>
}) {
  const {
    runtime,
    sync,
    syncKey,
    tabId,
    onError,
    onFrame,
    getFrame,
    createTransport,
  } = args

  if (!sync || runtime.transportStarted) return
  runtime.transportStarted = true

  try {
    runtime.transport = createTransport({
      syncKey,
      tabId,
      onFrame,
      onError,
      getFrame,
    })
  } catch (err) {
    // If transport creation fails, treat sync as disabled for this instance.
    runtime.transportStarted = false
    runtime.transport = null
    onError(err)
  }
}

/**
 * ensureOnVisibleRefresh
 * ---
 * onVisible:"refresh" is a best-effort catch-up mechanism:
 * when the tab becomes visible, re-read restore and apply it if newer.
 *
 * This is intentionally:
 * - not a storage-event listener
 * - not a replacement sync channel
 * - just a "welcome back" refresh for tabs that may have fallen behind
 */
function ensureOnVisibleRefresh<TData>(args: {
  runtime: GuardRuntime<TData>
  onVisible: OnVisibleMode
  restore: RestoreMode
  onError: (err: unknown) => void
  getActions: () => {
    refreshFromStorage: () => boolean
  }
}) {
  const { runtime, onVisible, restore, onError, getActions } = args

  if (onVisible !== "refresh") return
  if (restore === "never") return
  if (runtime.onVisibleStarted) return
  runtime.onVisibleStarted = true

  if (typeof window === "undefined") return

  const onVisibilityChange = () => {
    if (document.visibilityState !== "visible") return

    try {
      const { refreshFromStorage } = getActions()
      refreshFromStorage()
    } catch (err) {
      onError(err)
    }
  }

  document.addEventListener("visibilitychange", onVisibilityChange)
  runtime.onVisibleCleanup = () =>
    document.removeEventListener("visibilitychange", onVisibilityChange)
}

/**
 * ensureSessionCatchUp
 * ---
 * One-time restore reconciliation for restore:"session".
 *
 * Purpose:
 * - Handles the "brand new tab" case where no sessionId is known yet.
 * - Once a sessionId is discovered (via BroadcastChannel),
 *   we immediately perform a best-effort restore read.
 *
 * In short:
 *   sessionCatchUp = session identity reconciliation.
 *   onVisibleRefresh = restore freshness reconciliation.
 */
function ensureSessionCatchUp<TData>(args: {
  runtime: GuardRuntime<TData>
  restore: RestoreMode
  onError: (err: unknown) => void
  getCachedAppSessionId: () => string | null
  getOrCreateAppSessionId: () => Promise<string>
  getActions: () => {
    refreshFromStorage: () => boolean
  }
}) {
  const {
    runtime,
    restore,
    onError,
    getCachedAppSessionId,
    getOrCreateAppSessionId,
    getActions,
  } = args

  if (runtime.sessionCatchUpStarted) return
  if (restore !== "session") return
  if (typeof window === "undefined") return

  if (getCachedAppSessionId()) return

  runtime.sessionCatchUpStarted = true

  getOrCreateAppSessionId()
    .then(() => {
      try {
        const { refreshFromStorage } = getActions()
        refreshFromStorage()
      } catch (err) {
        onError(err)
      }
    })
    .catch(onError)
}

export type EnsureRuntimeMode = "subscribe" | "commit" | "manual"

/**
 * createEnsureRuntime
 * ---
 * Builds a single semantic entrypoint for "start runtime guards".
 *
 * Call sites should prefer this over invoking individual ensure* functions.
 * This keeps the system boring and prevents guard drift across call sites.
 */
export function createEnsureRuntime<TData>(args: {
  runtime: GuardRuntime<TData>

  sync: boolean
  restore: RestoreMode
  onVisible: OnVisibleMode

  syncKey: string
  tabId: string

  onError: (err: unknown) => void

  // store bridge
  getActions: () => {
    refreshFromStorage: () => boolean
  }

  // state bridge (read-only, no commit)
  getFrame: () => SyncFrame<TData>

  // session bridge (only used for restore:"session")
  getCachedAppSessionId: () => string | null
  getOrCreateAppSessionId: () => Promise<string>

  // transport bridge
  onFrame: (incoming: SyncFrame<TData>) => void
  createTransport: (args: {
    syncKey: string
    tabId: string
    onFrame: (incoming: SyncFrame<TData>) => void
    onError: (err: unknown) => void
    getFrame: () => SyncFrame<TData>
  }) => TransportHandle<TData>
}) {
  const {
    runtime,
    sync,
    restore,
    onVisible,
    syncKey,
    tabId,
    onError,
    getActions,
    getFrame,
    getCachedAppSessionId,
    getOrCreateAppSessionId,
    onFrame,
    createTransport,
  } = args

  return (mode: EnsureRuntimeMode) => {
    // Today: mode is semantic only (all call sites do the same thing).
    // Tomorrow: mode gives us a clean place to diverge without touching call sites.
    void mode

    ensureTransport<TData>({
      runtime,
      sync,
      syncKey,
      tabId,
      onError,
      onFrame,
      getFrame,
      createTransport,
    })

    ensureOnVisibleRefresh<TData>({
      runtime,
      onVisible,
      restore,
      onError,
      getActions,
    })

    ensureSessionCatchUp<TData>({
      runtime,
      restore,
      onError,
      getCachedAppSessionId,
      getOrCreateAppSessionId,
      getActions,
    })
  }
}
