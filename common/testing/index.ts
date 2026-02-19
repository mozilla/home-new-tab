/**
 * @common/testing - Reusable test utilities
 *
 * Provides mock implementations and testing helpers for:
 * - Browser Storage API (localStorage, sessionStorage)
 * - Time control (MockClock)
 * - Storage events (cross-tab communication)
 * - Crypto mocking (deterministic UUIDs)
 * - Multi-tab simulation (TabSimulator)
 * - SyncFrame helpers (for state system tests)
 *
 * Usage:
 * ```typescript
 * import { MockStorage, MockClock, TabSimulator } from '@common/testing'
 * ```
 */

// Core mocks
export { MockStorage } from "./mock-storage"
export { MockClock } from "./mock-clock"

// Storage event utilities
export { createStorageEvent, dispatchStorageEvent } from "./storage-events"

// Crypto mocking
export { mockCrypto, removeCrypto } from "./mock-crypto"

// SyncFrame helpers (for state system tests)
export {
  createMockSyncFrame,
  createSyncFrameSequence,
  createConcurrentSyncFrames,
} from "./syncframe-helpers"

// Multi-tab simulation
export { TabSimulator, type TabContext } from "./tab-simulator"

// Mock Broadcast Channel
export { MockBroadcastChannel } from "./mock-broadcast"
