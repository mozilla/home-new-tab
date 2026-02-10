import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  isIncomingNewer,
  mergeLww,
  readRawSyncFrame,
  writeRawSyncFrame,
} from "./helpers"
import { MockStorage, createMockSyncFrame } from "@common/testing"
import type { SyncMeta, SyncFrame } from "./types"

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

  beforeEach(() => {
    mockStorage = new MockStorage()
    originalWindow = globalThis.window
    globalThis.window = { localStorage: mockStorage } as any
  })

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

    const migrate = (incoming: unknown) => {
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

  it("allows migrate hook errors to propagate", () => {
    mockStorage.setItem("test:key", JSON.stringify({ data: "test" }))

    const migrate = () => {
      throw new Error("Migration failed")
    }

    // Why: Migration errors propagate - caller can handle them
    expect(() => readRawSyncFrame("test:key", migrate)).toThrow("Migration failed")
  })
})

describe("writeRawSyncFrame() - Serialization", () => {
  let mockStorage: MockStorage
  let originalWindow: typeof globalThis.window

  beforeEach(() => {
    mockStorage = new MockStorage()
    originalWindow = globalThis.window
    globalThis.window = { localStorage: mockStorage } as any
  })

  afterEach(() => {
    globalThis.window = originalWindow
  })

  it("writes sync frame to localStorage as JSON", () => {
    const frame = createMockSyncFrame({ count: 42 })

    writeRawSyncFrame("test:key", frame)

    const stored = mockStorage.getItem("test:key")
    expect(JSON.parse(stored!)).toEqual(frame)
  })

  it("throws when data has circular references", () => {
    const circular: any = { a: 1 }
    circular.self = circular

    const frame = createMockSyncFrame(circular)

    expect(() => writeRawSyncFrame("test:key", frame)).toThrow()
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
