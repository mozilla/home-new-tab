import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import type { Mock } from "vitest"

import {
  mockCrypto,
  removeCrypto,
  MockStorage,
  MockBroadcastChannel,
} from "@common/testing"
import { createSyncedStore } from "."
import { mergeLWW, isIncomingNewer } from "./merge"
import {
  deviceRestoreKey,
  readStoredSyncFrame,
  readRestoreFrameSyncBestEffort,
  writeRestoreFrame,
} from "./restore"
import {
  __resetSessionCache,
  getOrCreateAppSessionId,
  getOrCreateTabId,
} from "./session"
import { createBroadcastChannelTransport } from "./transport"

import type { SyncFrame } from "./types"

/* -------------------------------------------------------------------------------------------------
 * Local test helpers (intentionally not exported)
 * ------------------------------------------------------------------------------------------------- */

/**
 * Install deterministic storages for each test.
 * Note: both localStorage and sessionStorage are used by the system.
 */
function installMockStorages() {
  const local = new MockStorage()
  const session = new MockStorage()

  Object.defineProperty(window, "localStorage", {
    value: local,
    configurable: true,
  })
  Object.defineProperty(window, "sessionStorage", {
    value: session,
    configurable: true,
  })

  return { local, session }
}

export function installMockBroadcastChannel(): () => void {
  const original = globalThis.BroadcastChannel

  Object.defineProperty(globalThis, "BroadcastChannel", {
    value: MockBroadcastChannel,
    writable: true,
    configurable: true,
  })

  return () => {
    Object.defineProperty(globalThis, "BroadcastChannel", {
      value: original,
      writable: true,
      configurable: true,
    })
    MockBroadcastChannel.reset()
  }
}

function setVisibilityState(state: "visible" | "hidden"): void {
  // jsdom's document.visibilityState is read-only; we can override it.
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  })
}

function dispatchVisibilityChange(): void {
  document.dispatchEvent(new Event("visibilitychange"))
}

function frame<T>(
  data: T,
  meta: { rev: number; updatedAtMs: number; updatedBy: string },
  schemaVersion = 1,
): SyncFrame<T> {
  return { schemaVersion, data, sync: meta }
}

/* -------------------------------------------------------------------------------------------------
 * Suite setup
 * ------------------------------------------------------------------------------------------------- */

let cleanupCrypto: (() => void) | null = null
let cleanupBC: (() => void) | null = null

beforeEach(() => {
  installMockStorages()
  cleanupBC = installMockBroadcastChannel()
  __resetSessionCache()
  setVisibilityState("visible")
})

afterEach(() => {
  cleanupCrypto?.()
  cleanupCrypto = null

  cleanupBC?.()
  cleanupBC = null

  __resetSessionCache()
})

/* -------------------------------------------------------------------------------------------------
 * merge
 * ------------------------------------------------------------------------------------------------- */

describe("merge", () => {
  it("orders by rev first, then updatedAtMs, then updatedBy", () => {
    const current = { rev: 1, updatedAtMs: 100, updatedBy: "tab-a" }
    const newerRev = { rev: 2, updatedAtMs: 0, updatedBy: "tab-a" }
    expect(isIncomingNewer(newerRev, current)).toBe(true)

    const tieRevNewerTime = { rev: 1, updatedAtMs: 101, updatedBy: "tab-a" }
    expect(isIncomingNewer(tieRevNewerTime, current)).toBe(true)

    const tieRevTieTimeLexWins = {
      rev: 1,
      updatedAtMs: 100,
      updatedBy: "tab-b",
    }
    expect(isIncomingNewer(tieRevTieTimeLexWins, current)).toBe(true)
  })

  it("mergeLWW returns incoming only when it is newer", () => {
    const local = frame(
      { v: 1 },
      { rev: 1, updatedAtMs: 100, updatedBy: "tab-a" },
    )
    const incomingOlder = frame(
      { v: 2 },
      { rev: 1, updatedAtMs: 99, updatedBy: "tab-z" },
    )
    const incomingNewer = frame(
      { v: 3 },
      { rev: 2, updatedAtMs: 0, updatedBy: "tab-a" },
    )

    expect(mergeLWW(local, incomingOlder)).toBe(local)
    expect(mergeLWW(local, incomingNewer)).toBe(incomingNewer)
  })

  it("applyIncoming ignores older/equal frames (no churn)", () => {
    const store = createSyncedStore(
      {
        syncKey: "incoming",
        schemaVersion: 1,
        initialData: { n: 0 },
        sync: false,
        restore: "never",
      },
      (api) => ({
        inc: () => api.commit((d) => ({ ...d, n: d.n + 1 })),
      }),
    )

    // Create one authoritative update.
    store._unsafe_useStore.getState().actions.inc()
    const current = store.getSyncFrame()

    // Equal frame should be ignored.
    const equalApplied = store._unsafe_useStore
      .getState()
      .actions.applyIncoming(current)
    expect(equalApplied).toBe(false)
    expect(store.getSyncFrame()).toEqual(current)

    // Older frame should be ignored.
    const older = {
      ...current,
      sync: { ...current.sync, rev: current.sync.rev - 1 },
      data: { n: -123 },
    }

    const olderApplied = store._unsafe_useStore
      .getState()
      .actions.applyIncoming(older)
    expect(olderApplied).toBe(false)
    expect(store.getSyncFrame()).toEqual(current)
  })
})

/* -------------------------------------------------------------------------------------------------
 * restore
 * ------------------------------------------------------------------------------------------------- */

describe("restore", () => {
  it("wipes stored snapshot on schema mismatch and returns null", () => {
    const key = deviceRestoreKey("k")
    window.localStorage.setItem(
      key,
      JSON.stringify(
        frame({ ok: true }, { rev: 1, updatedAtMs: 1, updatedBy: "t" }, 123),
      ),
    )

    const got = readStoredSyncFrame(key, 999)
    expect(got).toBe(null)
    expect(window.localStorage.getItem(key)).toBe(null)
  })

  it("best-effort session restore returns null when sessionId is not cached", () => {
    const got = readRestoreFrameSyncBestEffort({
      restore: "session",
      syncKey: "k",
      schemaVersion: 1,
    })
    expect(got).toBe(null)
  })

  it("writeRestoreFrame session mode is a no-op when sessionId is unknown", () => {
    const ok = writeRestoreFrame({
      restore: "session",
      syncKey: "k",
      frame: frame({ v: 1 }, { rev: 1, updatedAtMs: 1, updatedBy: "t" }),
    })
    expect(ok).toBe(true)
    // no key written (since no sessionId)
    expect(window.localStorage.length).toBe(0)
  })

  it("restore:'never' does not write snapshots on commit", () => {
    const store = createSyncedStore(
      {
        syncKey: "no-restore",
        schemaVersion: 1,
        initialData: { n: 0 },
        sync: false,
        restore: "never",
      },
      (api) => ({
        inc: () => api.commit((d) => ({ ...d, n: d.n + 1 })),
      }),
    )

    store._unsafe_useStore.getState().actions.inc()

    expect(window.localStorage.length).toBe(0)
  })
})

/* -------------------------------------------------------------------------------------------------
 * session
 * ------------------------------------------------------------------------------------------------- */

describe("session", () => {
  it("uses crypto.randomUUID when available for ids", async () => {
    cleanupCrypto = mockCrypto(["uuid-tab", "uuid-session"])

    const tabId = getOrCreateTabId()
    expect(tabId).toBe("tab_uuid-tab")

    const sessionId = await getOrCreateAppSessionId()
    expect(sessionId).toBe("session_uuid-session")
  })

  it("falls back when crypto is unavailable", async () => {
    cleanupCrypto = removeCrypto()

    const tabId = getOrCreateTabId()
    expect(tabId.startsWith("tab_")).toBe(true)

    const sessionId = await getOrCreateAppSessionId()
    expect(sessionId.startsWith("session_")).toBe(true)
  })

  it("new tab discovers existing sessionId via BroadcastChannel", async () => {
    cleanupCrypto = mockCrypto(["uuid-tab-a", "uuid-session-a", "uuid-tab-b"])

    // Tab A: create a session
    const sessionA = await getOrCreateAppSessionId()
    expect(sessionA).toBe("session_uuid-session-a")

    // Simulate "new tab" by clearing module cache (test-only helper)
    __resetSessionCache()

    // Tab B: discover it
    const sessionB = await getOrCreateAppSessionId()
    expect(sessionB).toBe(sessionA)
  })
})

/* -------------------------------------------------------------------------------------------------
 * transport
 * ------------------------------------------------------------------------------------------------- */

describe("transport", () => {
  it("delivers frames to other tabs and ignores own echoes", () => {
    const onFrameA = vi.fn() as Mock
    const onFrameB = vi.fn() as Mock

    const a = createBroadcastChannelTransport({
      syncKey: "k",
      tabId: "tab-a",
      onFrame: onFrameA,
      getFrame: () =>
        frame({ v: 0 }, { rev: 0, updatedAtMs: 0, updatedBy: "tab-a" }),
    })

    const b = createBroadcastChannelTransport({
      syncKey: "k",
      tabId: "tab-b",
      onFrame: onFrameB,
      getFrame: () =>
        frame({ v: 0 }, { rev: 0, updatedAtMs: 0, updatedBy: "tab-b" }),
    })

    onFrameA.mockClear()
    onFrameB.mockClear()

    const f = frame({ v: 1 }, { rev: 1, updatedAtMs: 1, updatedBy: "tab-a" })
    a.post(f)

    expect(onFrameA).toHaveBeenCalledTimes(0)
    expect(onFrameB).toHaveBeenCalledTimes(1)

    a.cleanup()
    b.cleanup()
  })
})

/* -------------------------------------------------------------------------------------------------
 * createSyncedStore + onVisible refresh
 * ------------------------------------------------------------------------------------------------- */

describe("createSyncedStore", () => {
  it("auto-starts sync on first subscribe and converges across stores", () => {
    cleanupCrypto = mockCrypto(["uuid-tab-a", "uuid-tab-b"])

    const storeA = createSyncedStore(
      { syncKey: "counter", schemaVersion: 1, initialData: { n: 0 } },
      (api) => ({
        inc: () => api.commit((d) => ({ ...d, n: d.n + 1 })),
      }),
    )

    // We need to pretend these are different tabs.
    window.sessionStorage.removeItem("app:tabId")
    __resetSessionCache()
    const storeB = createSyncedStore(
      { syncKey: "counter", schemaVersion: 1, initialData: { n: 0 } },
      (api) => ({
        inc: () => api.commit((d) => ({ ...d, n: d.n + 1 })),
      }),
    )

    // subscribe triggers ensureTransport
    const unsubA = storeA._unsafe_useStore.subscribe(() => {})
    const unsubB = storeB._unsafe_useStore.subscribe(() => {})

    // commit in A should broadcast to B
    storeA._unsafe_useStore.getState().actions.inc()

    expect(storeB.getSyncFrame().data.n).toBe(1)

    unsubA()
    unsubB()
  })

  it("onVisible:'refresh' re-reads restore and applies it if newer", () => {
    const store = createSyncedStore(
      {
        syncKey: "prefs",
        schemaVersion: 1,
        initialData: { theme: "light" },
        restore: "device",
        onVisible: "refresh",
        sync: false, // keep the test focused on restore
      },
      (api) => ({
        setTheme: (theme: string) => api.commit((d) => ({ ...d, theme })),
      }),
    )

    // First subscribe installs visibility listener.
    const unsub = store._unsafe_useStore.subscribe(() => {})

    // Write a newer snapshot into storage directly.
    window.localStorage.setItem(
      deviceRestoreKey("prefs"),
      JSON.stringify(
        frame(
          { theme: "dark" },
          { rev: 99, updatedAtMs: 999, updatedBy: "someone-else" },
          1,
        ),
      ),
    )

    // Hide -> show triggers refresh
    setVisibilityState("hidden")
    dispatchVisibilityChange()

    setVisibilityState("visible")
    dispatchVisibilityChange()

    expect(store.getSyncFrame().data.theme).toBe("dark")

    unsub()
  })

  it("onVisible:'refresh' notifies subscribers when it applies a newer snapshot", () => {
    const store = createSyncedStore(
      {
        syncKey: "prefs2",
        schemaVersion: 1,
        initialData: { theme: "light" },
        restore: "device",
        onVisible: "refresh",
        sync: false,
      },
      () => ({}),
    )

    const onChange = vi.fn()
    const unsub = store._unsafe_useStore.subscribe(onChange)

    window.localStorage.setItem(
      deviceRestoreKey("prefs2"),
      JSON.stringify(
        frame(
          { theme: "dark" },
          { rev: 2, updatedAtMs: 999, updatedBy: "someone-else" },
          1,
        ),
      ),
    )

    setVisibilityState("hidden")
    dispatchVisibilityChange()
    setVisibilityState("visible")
    dispatchVisibilityChange()

    expect(store.getSyncFrame().data.theme).toBe("dark")
    expect(onChange).toHaveBeenCalled()

    unsub()
  })

  it("new tab converges on subscribe without requiring a local commit", () => {
    cleanupCrypto = mockCrypto(["uuid-tab-a", "uuid-tab-b"])

    const storeA = createSyncedStore(
      { syncKey: "handshake", schemaVersion: 1, initialData: { n: 0 } },
      (api) => ({
        inc: () => api.commit((d) => ({ ...d, n: d.n + 1 })),
      }),
    )

    // Start A first so it can reply to snapshot requests.
    const unsubA = storeA._unsafe_useStore.subscribe(() => {})

    // Make A authoritative.
    storeA._unsafe_useStore.getState().actions.inc()
    expect(storeA.getSyncFrame().data.n).toBe(1)

    // Simulate "new tab" identity for B.
    window.sessionStorage.removeItem("app:tabId")
    __resetSessionCache()

    const storeB = createSyncedStore(
      { syncKey: "handshake", schemaVersion: 1, initialData: { n: 0 } },
      () => ({}),
    )

    // Subscribe starts transport; transport requests snapshot; A replies synchronously.
    const unsubB = storeB._unsafe_useStore.subscribe(() => {})

    // No commit in B — it should still converge.
    expect(storeB.getSyncFrame().data.n).toBe(1)

    unsubA()
    unsubB()
  })

  it("eager-start sync converges and continues receiving updates without subscribe or local commits", async () => {
    cleanupCrypto = mockCrypto(["uuid-tab-a", "uuid-tab-b"])

    const storeA = createSyncedStore(
      { syncKey: "eager", schemaVersion: 1, initialData: { n: 0 } },
      (api) => ({
        inc: () => api.commit((d) => ({ ...d, n: d.n + 1 })),
      }),
    )

    // A must be actively listening so it can reply to snapshot requests.
    const unsubA = storeA._unsafe_useStore.subscribe(() => {})

    // Make A authoritative (n=1)
    storeA._unsafe_useStore.getState().actions.inc()
    expect(storeA.getSyncFrame().data.n).toBe(1)

    // New tab identity for B.
    window.sessionStorage.removeItem("app:tabId")
    __resetSessionCache()

    const storeB = createSyncedStore(
      { syncKey: "eager", schemaVersion: 1, initialData: { n: 0 } },
      () => ({}),
    )

    // Let B's eager-start microtask run (starts transport + requests snapshot).
    await Promise.resolve()

    // B converges without subscribe/commit.
    expect(storeB.getSyncFrame().data.n).toBe(1)

    // Future updates from A should also arrive in B (still no subscribe/commit in B).
    storeA._unsafe_useStore.getState().actions.inc()
    expect(storeA.getSyncFrame().data.n).toBe(2)

    // BroadcastChannel mock delivers synchronously.
    expect(storeB.getSyncFrame().data.n).toBe(2)

    unsubA()
  })
})
