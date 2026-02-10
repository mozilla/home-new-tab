import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  getOrCreateTabId,
  initCrossTabSync,
  readIncomingSyncFrame,
  __resetTabIdCache,
} from "./sync"
import {
  MockStorage,
  mockCrypto,
  removeCrypto,
  createStorageEvent,
  createMockSyncFrame,
} from "@common/testing"

describe("getOrCreateTabId() - Tab Identity", () => {
  let mockSessionStorage: MockStorage
  let originalWindow: typeof globalThis.window
  let originalCrypto: typeof globalThis.crypto

  beforeEach(() => {
    mockSessionStorage = new MockStorage()
    originalWindow = globalThis.window
    originalCrypto = globalThis.crypto

    // Reset the module-level cached tabId for test isolation
    __resetTabIdCache()

    globalThis.window = { sessionStorage: mockSessionStorage } as any
  })

  afterEach(() => {
    globalThis.window = originalWindow
    globalThis.crypto = originalCrypto
  })

  it("creates new tabId when none exists", () => {
    // Why: First call should generate a unique ID
    const cleanup = mockCrypto(["test-uuid-1"])

    const tabId = getOrCreateTabId()

    expect(tabId).toBe("test-uuid-1")
    cleanup()
  })

  it("persists tabId to sessionStorage", () => {
    // Why: TabId must persist across page reloads within same tab
    const cleanup = mockCrypto(["test-uuid-2"])

    getOrCreateTabId()

    expect(mockSessionStorage.getItem("app:tabId")).toBe("test-uuid-2")
    cleanup()
  })

  it("reuses existing tabId from sessionStorage", () => {
    // Why: Multiple calls in same tab should return same ID
    mockSessionStorage.setItem("app:tabId", "existing-tab-id")

    const tabId = getOrCreateTabId()

    expect(tabId).toBe("existing-tab-id")
  })

  it("caches tabId in memory for performance", () => {
    // Why: Avoid hitting sessionStorage on every call
    const cleanup = mockCrypto(["cached-uuid"])

    const tabId1 = getOrCreateTabId()
    mockSessionStorage.clear() // Clear storage between calls
    const tabId2 = getOrCreateTabId()

    // Should return cached value even though storage was cleared
    expect(tabId1).toBe("cached-uuid")
    expect(tabId2).toBe("cached-uuid")
    cleanup()
  })

  it("uses crypto.randomUUID when available", () => {
    // Why: crypto.randomUUID provides cryptographically strong IDs
    const cleanup = mockCrypto(["crypto-uuid"])

    const tabId = getOrCreateTabId()

    expect(tabId).toBe("crypto-uuid")
    cleanup()
  })

  it("falls back to timestamp-based ID when crypto unavailable", () => {
    // Why: Older browsers might not support crypto.randomUUID
    const cleanup = removeCrypto()

    const tabId = getOrCreateTabId()

    // Should start with "tab_" prefix
    expect(tabId).toMatch(/^tab_\d+_[0-9a-f]+$/)
    cleanup()
  })

  it("handles sessionStorage quota errors gracefully", () => {
    // Why: Prevent app crashes when storage is full
    mockSessionStorage.simulateQuotaExceeded()

    const tabId = getOrCreateTabId()

    // Should still return a valid tabId (uses fallback when storage fails)
    expect(tabId).toMatch(/^tab_\d+_[0-9a-f]+$/)
    expect(() => getOrCreateTabId()).not.toThrow()

    // Second call should return the cached value
    const tabId2 = getOrCreateTabId()
    expect(tabId2).toBe(tabId)
  })

  it("returns 'ssr' in SSR context", () => {
    // Why: SSR-safe fallback prevents crashes during server-side rendering
    globalThis.window = undefined as any

    const tabId = getOrCreateTabId()

    expect(tabId).toBe("ssr")
  })
})

describe("readIncomingSyncFrame() - Parse Storage Events", () => {
  it("returns parsed frame and updatedBy when valid", () => {
    // Why: Normal case - well-formed sync frame from storage event
    const frame = createMockSyncFrame({ count: 42 }, { updatedBy: "tab-a" })
    const raw = JSON.stringify(frame)

    const result = readIncomingSyncFrame(raw)

    expect(result).not.toBeNull()
    expect(result?.incoming).toEqual(frame)
    expect(result?.updatedBy).toBe("tab-a")
  })

  it("returns null when JSON is malformed", () => {
    // Why: Graceful degradation instead of throwing
    const malformed = "{invalid json"

    const result = readIncomingSyncFrame(malformed)

    expect(result).toBeNull()
  })

  it("returns null when sync metadata is missing", () => {
    // Why: Structural validation - sync frames must have sync metadata
    const noMetadata = JSON.stringify({ data: { count: 1 } })

    const result = readIncomingSyncFrame(noMetadata)

    expect(result).toBeNull()
  })

  it("returns null when updatedBy field is missing", () => {
    // Why: updatedBy is critical for echo prevention
    const noUpdatedBy = JSON.stringify({
      sync: { rev: 1, updatedAtMs: Date.now() },
      data: { count: 1 },
    })

    const result = readIncomingSyncFrame(noUpdatedBy)

    expect(result).toBeNull()
  })
})

describe("initCrossTabSync() - Event Listener Setup", () => {
  let originalWindow: typeof globalThis.window
  let originalDocument: typeof globalThis.document

  beforeEach(() => {
    originalWindow = globalThis.window
    originalDocument = globalThis.document
  })

  afterEach(() => {
    globalThis.window = originalWindow
    globalThis.document = originalDocument
  })

  it("sets up storage event listener", () => {
    // Why: Storage events are how tabs communicate
    const addEventListenerSpy = vi.fn()
    globalThis.window = {
      addEventListener: addEventListenerSpy,
      removeEventListener: vi.fn(),
    } as any

    initCrossTabSync({
      storageKey: "test:key",
      tabId: "tab-a",
      nowMs: () => Date.now(),
      onError: vi.fn(),
      readIncoming: vi.fn(),
      applyIncoming: vi.fn(),
      bumpUi: vi.fn(),
    })

    expect(addEventListenerSpy).toHaveBeenCalledWith("storage", expect.any(Function))
  })

  it("sets up visibility event listener when enabled", () => {
    // Why: Visibility feature allows refreshing on tab switch
    const windowAddSpy = vi.fn()
    const documentAddSpy = vi.fn()
    globalThis.window = {
      addEventListener: windowAddSpy,
      removeEventListener: vi.fn(),
    } as any
    globalThis.document = {
      addEventListener: documentAddSpy,
      removeEventListener: vi.fn(),
      hidden: false,
    } as any

    initCrossTabSync({
      storageKey: "test:key",
      tabId: "tab-a",
      nowMs: () => Date.now(),
      onError: vi.fn(),
      readIncoming: vi.fn(),
      applyIncoming: vi.fn(),
      bumpUi: vi.fn(),
      onVisibilityChange: vi.fn(),
    })

    expect(documentAddSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    )
  })

  it("returns cleanup function that removes listeners", () => {
    // Why: Prevent memory leaks when unmounting
    const removeEventListenerSpy = vi.fn()
    globalThis.window = {
      addEventListener: vi.fn(),
      removeEventListener: removeEventListenerSpy,
    } as any

    const cleanup = initCrossTabSync({
      storageKey: "test:key",
      tabId: "tab-a",
      nowMs: () => Date.now(),
      onError: vi.fn(),
      readIncoming: vi.fn(),
      applyIncoming: vi.fn(),
      bumpUi: vi.fn(),
    })

    cleanup()

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "storage",
      expect.any(Function),
    )
  })

  it("is SSR-safe (returns no-op cleanup)", () => {
    // Why: Server-side rendering should not crash
    globalThis.window = undefined as any

    const cleanup = initCrossTabSync({
      storageKey: "test:key",
      tabId: "tab-a",
      nowMs: () => Date.now(),
      onError: vi.fn(),
      readIncoming: vi.fn(),
      applyIncoming: vi.fn(),
      bumpUi: vi.fn(),
    })

    expect(() => cleanup()).not.toThrow()
  })
})

describe("initCrossTabSync() - Echo Prevention", () => {
  let originalWindow: typeof globalThis.window
  let storageListener: ((event: StorageEvent) => void) | null = null

  beforeEach(() => {
    originalWindow = globalThis.window
    storageListener = null

    // Capture the storage listener
    globalThis.window = {
      addEventListener: vi.fn((type, listener) => {
        if (type === "storage") {
          storageListener = listener as (event: StorageEvent) => void
        }
      }),
      removeEventListener: vi.fn(),
      location: { href: "http://localhost" } as any,
    } as any
  })

  afterEach(() => {
    globalThis.window = originalWindow
  })

  it("ignores storage events authored by same tab", () => {
    // Why: Critical for echo prevention - tabs should not react to their own writes
    const applyIncomingSpy = vi.fn()
    const bumpUiSpy = vi.fn()

    initCrossTabSync({
      storageKey: "test:key",
      tabId: "tab-a",
      nowMs: () => Date.now(),
      onError: vi.fn(),
      readIncoming: () => ({
        incoming: createMockSyncFrame({ count: 1 }),
        updatedBy: "tab-a", // Same tab!
      }),
      applyIncoming: applyIncomingSpy,
      bumpUi: bumpUiSpy,
    })

    // Simulate storage event
    const event = createStorageEvent("test:key", "dummy-value")
    storageListener?.(event)

    // Should NOT apply or bump UI
    expect(applyIncomingSpy).not.toHaveBeenCalled()
    expect(bumpUiSpy).not.toHaveBeenCalled()
  })

  it("applies storage events from other tabs", () => {
    // Why: This is the core cross-tab sync behavior
    const applyIncomingSpy = vi.fn().mockReturnValue(true) // Changed
    const bumpUiSpy = vi.fn()

    initCrossTabSync({
      storageKey: "test:key",
      tabId: "tab-a",
      nowMs: () => Date.now(),
      onError: vi.fn(),
      readIncoming: () => ({
        incoming: createMockSyncFrame({ count: 1 }),
        updatedBy: "tab-b", // Different tab!
      }),
      applyIncoming: applyIncomingSpy,
      bumpUi: bumpUiSpy,
    })

    // Simulate storage event from tab-b
    const event = createStorageEvent("test:key", "dummy-value")
    storageListener?.(event)

    // Should apply and bump UI
    expect(applyIncomingSpy).toHaveBeenCalled()
    expect(bumpUiSpy).toHaveBeenCalled()
  })

  it("does not bump UI when frame did not change", () => {
    // Why: Avoid unnecessary rerenders
    const applyIncomingSpy = vi.fn().mockReturnValue(false) // No change
    const bumpUiSpy = vi.fn()

    initCrossTabSync({
      storageKey: "test:key",
      tabId: "tab-a",
      nowMs: () => Date.now(),
      onError: vi.fn(),
      readIncoming: () => ({
        incoming: createMockSyncFrame({ count: 1 }),
        updatedBy: "tab-b",
      }),
      applyIncoming: applyIncomingSpy,
      bumpUi: bumpUiSpy,
    })

    // Simulate storage event
    const event = createStorageEvent("test:key", "dummy-value")
    storageListener?.(event)

    // Should apply but NOT bump UI (no change)
    expect(applyIncomingSpy).toHaveBeenCalled()
    expect(bumpUiSpy).not.toHaveBeenCalled()
  })

  it("calls onError when storage event parsing fails", () => {
    // Why: Graceful error handling prevents app crashes
    const onErrorSpy = vi.fn()

    initCrossTabSync({
      storageKey: "test:key",
      tabId: "tab-a",
      nowMs: () => Date.now(),
      onError: onErrorSpy,
      readIncoming: () => {
        throw new Error("Parse error")
      },
      applyIncoming: vi.fn(),
      bumpUi: vi.fn(),
    })

    // Simulate storage event
    const event = createStorageEvent("test:key", "invalid-data")
    storageListener?.(event)

    expect(onErrorSpy).toHaveBeenCalledWith(expect.any(Error))
  })
})
