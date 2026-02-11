import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

import {
  MockStorage,
  mockCrypto,
  removeCrypto,
  createStorageEvent,
  createMockSyncFrame,
} from "@common/testing"
import {
  getOrCreateTabId,
  initCrossTabSync,
  readIncomingSyncFrame,
  __resetTabIdCache,
  isIncomingNewer,
  mergeLww,
  readRawSyncFrame,
  writeRawSyncFrame,
} from "."

import type { SyncMeta, SyncFrame } from "../types"

describe("getOrCreateTabId() - Tab Identity", () => {
  let mockSessionStorage: MockStorage
  let originalWindow: typeof globalThis.window
  let originalCrypto: typeof globalThis.crypto

  /**
   * Setup: Minimal mock environment for tab ID generation
   *
   * Mocks:
   * - sessionStorage (where tab IDs are persisted)
   * - crypto.randomUUID (for deterministic UUID generation)
   *
   * Why: Tab ID generation depends on sessionStorage and crypto APIs.
   * We mock them to test ID creation, caching, persistence, and
   * fallback behavior in isolation.
   *
   * Critical: __resetTabIdCache() clears the module-level cache to
   * prevent cross-test contamination (otherwise tests would reuse
   * cached IDs from previous tests).
   */
  beforeEach(() => {
    mockSessionStorage = new MockStorage()
    originalWindow = globalThis.window
    originalCrypto = globalThis.crypto

    // Reset the module-level cached tabId for test isolation
    __resetTabIdCache()

    globalThis.window = { sessionStorage: mockSessionStorage } as any
  })

  /**
   * Teardown: Restore original globals
   */
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

  /**
   * Setup: Minimal mock for event listener testing
   *
   * Why: initCrossTabSync() wires up window and document event listeners.
   * We capture references to original globals so we can safely mock them
   * per-test and restore afterward.
   *
   * Note: Individual tests create their own mock window/document with
   * spies, so this setup just handles backup/restore.
   */
  beforeEach(() => {
    originalWindow = globalThis.window
    originalDocument = globalThis.document
  })

  /**
   * Teardown: Restore original globals
   */
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

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "storage",
      expect.any(Function),
    )
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

  /**
   * Setup: Mock window with listener capture
   *
   * Creates a mock window.addEventListener that captures the storage
   * event listener so tests can directly invoke it with synthetic events.
   *
   * Why: Echo prevention tests need to simulate storage events and
   * verify that the handler correctly ignores echoes (events authored
   * by the same tab) while applying events from other tabs.
   *
   * Pattern: Instead of using spies to verify addEventListener was called,
   * we capture the actual listener function so we can trigger it with
   * test-specific storage events.
   */
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

  /**
   * Teardown: Restore original window
   */
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

describe("isIncomingNewer() - Deterministic Conflict Resolution", () => {
  it("returns true when incoming rev is higher", () => {
    // Why: Primary comparison level - rev counter is authoritative
    const current: SyncMeta = { rev: 5, updatedAtMs: 1000, updatedBy: "tab-a" }
    const incoming: SyncMeta = { rev: 6, updatedAtMs: 1000, updatedBy: "tab-a" }

    expect(isIncomingNewer(incoming, current)).toBe(true)
  })

  it("returns false when incoming rev is lower", () => {
    const current: SyncMeta = { rev: 5, updatedAtMs: 1000, updatedBy: "tab-a" }
    const incoming: SyncMeta = { rev: 4, updatedAtMs: 2000, updatedBy: "tab-b" }

    // Why: Higher timestamp doesn't matter if rev is lower
    expect(isIncomingNewer(incoming, current)).toBe(false)
  })

  it("uses timestamp as tie-breaker when revs are equal", () => {
    // Why: Handles race condition when two tabs write with same rev
    const current: SyncMeta = { rev: 5, updatedAtMs: 1000, updatedBy: "tab-a" }
    const incoming: SyncMeta = { rev: 5, updatedAtMs: 1001, updatedBy: "tab-b" }

    expect(isIncomingNewer(incoming, current)).toBe(true)
  })

  it("uses lexicographic tabId as final tie-breaker", () => {
    // Why: Deterministic final resolution prevents oscillation
    const current: SyncMeta = { rev: 5, updatedAtMs: 1000, updatedBy: "tab-a" }
    const incoming: SyncMeta = { rev: 5, updatedAtMs: 1000, updatedBy: "tab-b" }

    expect(isIncomingNewer(incoming, current)).toBe(true) // 'tab-b' > 'tab-a'
  })

  it("returns false when everything is exactly equal", () => {
    // Why: Idempotency - same snapshot should not replace itself
    const meta: SyncMeta = { rev: 5, updatedAtMs: 1000, updatedBy: "tab-a" }

    expect(isIncomingNewer(meta, meta)).toBe(false)
  })

  it("handles extreme timestamp values without overflow", () => {
    // Why: Defense against clock skew or corrupted data
    const current: SyncMeta = {
      rev: 5,
      updatedAtMs: Number.MAX_SAFE_INTEGER,
      updatedBy: "a",
    }
    const incoming: SyncMeta = { rev: 5, updatedAtMs: 0, updatedBy: "b" }

    expect(isIncomingNewer(incoming, current)).toBe(false)
  })

  it("lexicographic comparison is case-sensitive", () => {
    // Why: Ensures deterministic sorting
    const current: SyncMeta = { rev: 5, updatedAtMs: 1000, updatedBy: "A" }
    const incoming: SyncMeta = { rev: 5, updatedAtMs: 1000, updatedBy: "a" }

    // 'a' (lowercase) > 'A' (uppercase) in lexicographic comparison
    expect(isIncomingNewer(incoming, current)).toBe(true)
  })
})

describe("mergeLww() - Last-Write-Wins Merge Policy", () => {
  it("returns incoming snapshot when it is newer", () => {
    const local = createMockSyncFrame({ count: 1 }, { rev: 5 })
    const incoming = createMockSyncFrame({ count: 2 }, { rev: 6 })

    const result = mergeLww(local, incoming)

    expect(result).toBe(incoming) // Object identity check
    expect(result.data.count).toBe(2)
  })

  it("returns local snapshot when incoming is older", () => {
    const local = createMockSyncFrame({ count: 1 }, { rev: 6 })
    const incoming = createMockSyncFrame({ count: 2 }, { rev: 5 })

    const result = mergeLww(local, incoming)

    expect(result).toBe(local)
    expect(result.data.count).toBe(1)
  })

  it("is deterministic given same inputs", () => {
    // Why: Multiple tabs must converge to same state
    const local = createMockSyncFrame(
      { count: 1 },
      { rev: 5, updatedAtMs: 1000, updatedBy: "a" },
    )
    const incoming = createMockSyncFrame(
      { count: 2 },
      { rev: 5, updatedAtMs: 1000, updatedBy: "b" },
    )

    const result1 = mergeLww(local, incoming)
    const result2 = mergeLww(local, incoming)

    expect(result1).toBe(result2)
    expect(result1.data.count).toBe(2) // 'b' > 'a' in lexicographic comparison
  })

  it("handles tie-breaking with timestamp differences", () => {
    const local = createMockSyncFrame(
      { value: "old" },
      { rev: 10, updatedAtMs: 1000, updatedBy: "tab-a" },
    )
    const incoming = createMockSyncFrame(
      { value: "new" },
      { rev: 10, updatedAtMs: 1005, updatedBy: "tab-b" },
    )

    const result = mergeLww(local, incoming)

    expect(result).toBe(incoming)
    expect(result.data.value).toBe("new")
  })
})

describe("readRawSyncFrame() - Deserialization & Migration", () => {
  let mockStorage: MockStorage
  let originalWindow: typeof globalThis.window

  /**
   * Setup: Mock localStorage for read operations
   *
   * Why: readRawSyncFrame() reads from window.localStorage, parses JSON,
   * and optionally applies migration hooks. We need isolated storage
   * to control what's persisted and test deserialization/migration logic.
   */
  beforeEach(() => {
    mockStorage = new MockStorage()
    originalWindow = globalThis.window
    globalThis.window = { localStorage: mockStorage } as any
  })

  /**
   * Teardown: Restore original window
   */
  afterEach(() => {
    globalThis.window = originalWindow
  })

  it("returns null when storage key does not exist", () => {
    const result = readRawSyncFrame("nonexistent", undefined)
    expect(result).toBeNull()
  })

  it("returns null when JSON is malformed", () => {
    mockStorage.setItem("test:key", "{invalid json")

    const result = readRawSyncFrame("test:key", undefined)

    // Why: Graceful degradation instead of throwing
    expect(result).toBeNull()
  })

  it("returns null when sync metadata is missing", () => {
    mockStorage.setItem("test:key", JSON.stringify({ data: { count: 1 } }))

    const result = readRawSyncFrame("test:key", undefined)

    // Why: Structural validation - snapshots must have sync metadata
    expect(result).toBeNull()
  })

  it("returns parsed sync frame when valid", () => {
    const frame = createMockSyncFrame({ count: 5 })
    mockStorage.setItem("test:key", JSON.stringify(frame))

    const result = readRawSyncFrame("test:key", undefined)

    expect(result).toEqual(frame)
  })

  it("calls migrate hook when provided", () => {
    const rawData = { oldFormat: true }
    mockStorage.setItem("test:key", JSON.stringify(rawData))

    const migrate = (_incoming: unknown) => {
      return createMockSyncFrame({ newFormat: true })
    }

    const result = readRawSyncFrame("test:key", migrate)

    expect(result?.data).toEqual({ newFormat: true })
  })

  it("returns null when migrate rejects snapshot", () => {
    mockStorage.setItem("test:key", JSON.stringify({ invalid: "schema" }))

    const migrate = () => null // Reject

    const result = readRawSyncFrame("test:key", migrate)

    // Why: Migration can choose to ignore incompatible versions
    expect(result).toBeNull()
  })

  it("is SSR-safe (returns null when window is undefined)", () => {
    globalThis.window = undefined as any

    const result = readRawSyncFrame("test:key", undefined)

    expect(result).toBeNull()
  })

  it("catches migrate hook errors and reports via onError", () => {
    mockStorage.setItem("test:key", JSON.stringify({ data: "test" }))

    const migrate = () => {
      throw new Error("Migration failed")
    }

    const onError = vi.fn()

    // Why: Migration errors are now caught and reported for observability
    const result = readRawSyncFrame("test:key", migrate, onError)

    expect(result).toBeNull()
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: "readRawSyncFrame",
        storageKey: "test:key",
      }),
    )
  })
})

describe("writeRawSyncFrame() - Serialization", () => {
  let mockStorage: MockStorage
  let originalWindow: typeof globalThis.window

  /**
   * Setup: Mock localStorage for write operations
   *
   * Why: writeRawSyncFrame() serializes sync frames to window.localStorage.
   * We need isolated storage to verify JSON serialization, error handling
   * (circular references, quota exceeded), and SSR safety.
   */
  beforeEach(() => {
    mockStorage = new MockStorage()
    originalWindow = globalThis.window
    globalThis.window = { localStorage: mockStorage } as any
  })

  /**
   * Teardown: Restore original window
   */
  afterEach(() => {
    globalThis.window = originalWindow
  })

  it("writes sync frame to localStorage as JSON", () => {
    const frame = createMockSyncFrame({ count: 42 })

    writeRawSyncFrame("test:key", frame)

    const stored = mockStorage.getItem("test:key")
    expect(JSON.parse(stored!)).toEqual(frame)
  })

  it("catches circular reference errors and reports via onError", () => {
    const circular: any = { a: 1 }
    circular.self = circular

    const frame = createMockSyncFrame(circular)
    const onError = vi.fn()

    const success = writeRawSyncFrame("test:key", frame, onError)

    expect(success).toBe(false)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: "writeRawSyncFrame",
        storageKey: "test:key",
      }),
    )
  })

  it("is SSR-safe (no-op when window is undefined)", () => {
    globalThis.window = undefined as any

    const frame = createMockSyncFrame({ count: 1 })

    // Should not throw
    expect(() => writeRawSyncFrame("test:key", frame)).not.toThrow()
  })

  it("handles objects with toJSON method correctly", () => {
    const objWithToJSON = {
      value: 42,
      toJSON() {
        return { serialized: this.value }
      },
    }

    const frame = createMockSyncFrame({ data: objWithToJSON })

    writeRawSyncFrame("test:key", frame)

    const stored = mockStorage.getItem("test:key")
    const parsed = JSON.parse(stored!)

    // toJSON should have been called during serialization
    expect(parsed.data.data).toEqual({ serialized: 42 })
  })

  it("preserves all sync frame fields", () => {
    const frame: SyncFrame<{ count: number }> = {
      sync: {
        rev: 10,
        updatedAtMs: 123456789,
        updatedBy: "test-tab",
      },
      data: { count: 99 },
      schemaVersion: 2,
    }

    writeRawSyncFrame("test:key", frame)

    const stored = mockStorage.getItem("test:key")
    const parsed = JSON.parse(stored!)

    expect(parsed.sync.rev).toBe(10)
    expect(parsed.sync.updatedAtMs).toBe(123456789)
    expect(parsed.sync.updatedBy).toBe("test-tab")
    expect(parsed.data.count).toBe(99)
    expect(parsed.schemaVersion).toBe(2)
  })
})
