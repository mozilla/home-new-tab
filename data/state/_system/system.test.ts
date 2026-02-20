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
    })

    const b = createBroadcastChannelTransport({
      syncKey: "k",
      tabId: "tab-b",
      onFrame: onFrameB,
    })

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
    const unsubA = storeA.useStore.subscribe(() => {})
    const unsubB = storeB.useStore.subscribe(() => {})

    // commit in A should broadcast to B
    storeA.useStore.getState().actions.inc()

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
    const unsub = store.useStore.subscribe(() => {})

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
})
