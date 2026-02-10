/**
 * SyncFrame Helpers - Helpers for creating test sync frames
 *
 * Provides utilities for creating well-formed SyncFrame objects
 * for testing the cross-tab sync system.
 */

import type { SyncFrame, SyncMeta } from "../../data/state/_system/types"

/**
 * Create a mock sync frame with sensible defaults
 *
 * Generates a complete SyncFrame<TData> with valid sync metadata.
 * Useful for creating test fixtures without boilerplate.
 *
 * @param data - The domain data to wrap in a sync frame
 * @param overrides - Optional sync metadata overrides
 *
 * Usage:
 * ```typescript
 * const frame = createMockSyncFrame(
 *   { count: 42 },
 *   { rev: 5, updatedBy: 'tab-a' }
 * )
 * ```
 */
export function createMockSyncFrame<TData>(
  data: TData,
  overrides?: Partial<SyncMeta>,
): SyncFrame<TData> {
  const defaultMeta: SyncMeta = {
    rev: 1,
    updatedAtMs: Date.now(),
    updatedBy: "test-tab",
  }

  return {
    sync: {
      ...defaultMeta,
      ...overrides,
    },
    data,
    schemaVersion: 1,
  }
}

/**
 * Create a sequence of sync frames with incrementing revisions
 *
 * Useful for testing conflict resolution and revision ordering.
 * Each sync frame has rev incremented by 1 from the previous.
 *
 * @param baseData - Base data to use for all sync frames
 * @param count - Number of sync frames to generate
 * @param startRev - Starting revision number (default: 1)
 *
 * Usage:
 * ```typescript
 * const snaps = createSyncFrameSequence({ count: 0 }, 5)
 * // Returns 5 sync frames with rev: 1, 2, 3, 4, 5
 * ```
 */
export function createSyncFrameSequence<TData>(
  baseData: TData,
  count: number,
  startRev = 1,
): SyncFrame<TData>[] {
  const frames: SyncFrame<TData>[] = []

  for (let i = 0; i < count; i++) {
    frames.push(
      createMockSyncFrame(baseData, {
        rev: startRev + i,
        updatedAtMs: Date.now() + i, // Increment timestamp too
      }),
    )
  }

  return frames
}

/**
 * Create sync frames for simulating concurrent edits
 *
 * Generates multiple sync frames with the SAME revision number but
 * different timestamps and tabIds. Useful for testing tie-breaking logic.
 *
 * @param dataVariants - Array of data variants (one per sync frame)
 * @param rev - The revision number all sync frames share
 * @param baseTime - Base timestamp (default: Date.now())
 *
 * Usage:
 * ```typescript
 * const concurrent = createConcurrentSyncFrames(
 *   [{ theme: 'light' }, { theme: 'dark' }],
 *   5,  // Same rev
 *   1000
 * )
 * // Both sync frames have rev=5 but different timestamps/tabIds
 * ```
 */
export function createConcurrentSyncFrames<TData>(
  dataVariants: TData[],
  rev: number,
  baseTime = Date.now(),
): SyncFrame<TData>[] {
  return dataVariants.map((data, index) => {
    return createMockSyncFrame(data, {
      rev,
      updatedAtMs: baseTime + index, // Slightly different timestamps
      updatedBy: `tab-${String.fromCharCode(97 + index)}`, // tab-a, tab-b, ...
    })
  })
}
