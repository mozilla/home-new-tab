# @common/testing

Reusable test utilities for mocking browser APIs and simulating complex scenarios.

## Overview

This package provides testing infrastructure used across the monorepo, with a focus on:
- **Storage API mocking** - localStorage and sessionStorage test doubles
- **Time control** - Deterministic clock for time-dependent logic
- **Cross-tab simulation** - Multi-tab scenarios for state sync testing
- **Snapshot factories** - Helpers for creating test fixtures

## Core Utilities

### MockStorage

Test double for `localStorage` and `sessionStorage` with inspection capabilities.

```typescript
import { MockStorage } from '@common/testing'

const mockStorage = new MockStorage()
globalThis.window = { localStorage: mockStorage } as any

// Use like normal storage
mockStorage.setItem('key', 'value')
expect(mockStorage.getItem('key')).toBe('value')

// Inspect writes
expect(mockStorage.writeLog).toHaveLength(1)
expect(mockStorage.writeLog[0].key).toBe('key')

// Simulate quota errors
mockStorage.simulateQuotaExceeded()
expect(() => mockStorage.setItem('key', 'value')).toThrow('QuotaExceededError')
```

**Why MockStorage?**
- Isolated instances per test (no global state pollution)
- Inspection capabilities (writeLog for debugging)
- Easy quota simulation
- No need to actually fill up storage

---

### MockClock

Deterministic time control for testing time-dependent logic.

```typescript
import { MockClock } from '@common/testing'

const clock = new MockClock(1000) // Start at timestamp 1000

expect(clock.now()).toBe(1000)

clock.advance(500)
expect(clock.now()).toBe(1500)

clock.set(5000)
expect(clock.now()).toBe(5000)
```

**Why MockClock?**
- Works with injectable `nowMs()` functions (how our stores handle time)
- No need to fight with Vitest's fake timers
- More explicit in tests
- Simpler mental model

---

### Storage Events

Helpers for creating and dispatching storage events in tests.

```typescript
import { createStorageEvent, dispatchStorageEvent } from '@common/testing'

// Create a storage event
const event = createStorageEvent('app:timer', JSON.stringify(snapshot))
window.dispatchEvent(event)

// Or use the convenience wrapper
dispatchStorageEvent('app:timer', JSON.stringify(snapshot))
```

**Why?**
- Storage events are how tabs communicate
- These helpers create events that match browser behavior
- Essential for testing cross-tab sync

---

### Crypto Mocking

Mock `crypto.randomUUID()` for deterministic tab IDs.

```typescript
import { mockCrypto, removeCrypto } from '@common/testing'

// Provide a deterministic sequence of UUIDs
const cleanup = mockCrypto(['uuid-1', 'uuid-2', 'uuid-3'])

// Now crypto.randomUUID() returns 'uuid-1', then 'uuid-2', etc.
expect(crypto.randomUUID()).toBe('uuid-1')
expect(crypto.randomUUID()).toBe('uuid-2')

cleanup() // Restore original crypto

// Test fallback behavior when crypto is unavailable
const cleanupRemove = removeCrypto()
expect(globalThis.crypto).toBeUndefined()
cleanupRemove()
```

**Why?**
- Tab identity is critical for echo prevention
- Deterministic UUIDs make multi-tab tests predictable
- Can test fallback behavior for older browsers

---

### Snapshot Factories

Helpers for creating well-formed Snapshot objects for state system tests.

```typescript
import { createMockSnapshot, createSnapshotSequence, createConcurrentSnapshots } from '@common/testing'

// Create a single snapshot
const snap = createMockSnapshot(
  { count: 42 },
  { rev: 5, updatedBy: 'tab-a' }
)

// Create a sequence with incrementing revisions
const sequence = createSnapshotSequence({ count: 0 }, 5)
// Returns 5 snapshots with rev: 1, 2, 3, 4, 5

// Create concurrent snapshots (same rev, different timestamps)
const concurrent = createConcurrentSnapshots(
  [{ theme: 'light' }, { theme: 'dark' }],
  5  // Same rev number
)
// Both have rev=5 but different timestamps/tabIds
```

**Why?**
- Reduces test boilerplate
- Ensures snapshots have valid sync metadata
- Specialized factories for testing conflict resolution

---

### TabSimulator

Multi-tab scenario simulator for testing cross-tab synchronization.

```typescript
import { TabSimulator } from '@common/testing'

const simulator = new TabSimulator()

// Create two tabs
const tabA = simulator.createTab('tab-a')
const tabB = simulator.createTab('tab-b')

// Simulate Tab A writes to localStorage
const snapshot = createMockSnapshot({ count: 1 })
simulator.simulateWrite('tab-a', 'app:store', snapshot)

// Tab B receives storage event and can read the value
expect(tabB.storage.getItem('app:store')).toBe(JSON.stringify(snapshot))

// Verify all tabs converged to same state
simulator.assertConvergence('app:store')
```

**Why?**
- Encodes the mental model: tabs communicate via storage events
- Each tab gets storage events from OTHER tabs (not itself)
- Makes multi-tab tests readable and maintainable
- Conceptually accurate even though it runs in single process

---

## Testing Patterns

### Pattern 1: Setup/Teardown

```typescript
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
```

### Pattern 2: Storage Mocking

```typescript
const mockStorage = new MockStorage()
Object.defineProperty(window, 'localStorage', {
  value: mockStorage,
  writable: true,
  configurable: true
})
```

### Pattern 3: Clock Injection

```typescript
const clock = new MockClock()

const store = createCrossTabStore({
  nowMs: () => clock.now() // Inject mock clock
}, ...)

clock.advance(1000) // Move time forward
```

### Pattern 4: Multi-Tab Testing

```typescript
const simulator = new TabSimulator()

// Create tabs
const tabA = simulator.createTab('tab-a')
const tabB = simulator.createTab('tab-b')

// Create stores with tab-specific contexts
const storeA = createCrossTabStore({ /* ... */ }, ...)
const storeB = createCrossTabStore({ /* ... */ }, ...)

// Simulate cross-tab write
act(() => storeA.actions.increment())
simulator.simulateWrite('tab-a', 'app:store', storeA.getSnapshot())

// Verify Tab B received update
expect(storeB.getSnapshot().data.count).toBe(1)
```

---

## When to Use These Utilities

### Use MockStorage when:
- Testing code that reads/writes localStorage or sessionStorage
- You need to inspect what was written
- You need to simulate quota errors
- You want isolated test instances

### Use MockClock when:
- Testing time-dependent logic (timers, timestamps)
- Your code accepts injectable `nowMs()` functions
- You need deterministic time control

### Use TabSimulator when:
- Testing cross-tab synchronization
- Verifying multi-tab convergence
- Testing storage event handling

### Use Snapshot Factories when:
- Writing tests for the state system
- Testing conflict resolution logic
- Creating test fixtures quickly

---

## Architecture Notes

### Why Not Use Vitest's vi.mock()?

1. **Inspection** - MockStorage provides writeLog for debugging
2. **Isolation** - Each test gets its own instance, no global pollution
3. **Simplicity** - Direct control, no magic
4. **Quota simulation** - Easy to trigger specific errors

### Why TabSimulator Instead of Real Tabs?

You can't actually open multiple browser tabs in a test. TabSimulator encodes
the mental model accurately:
- Each "tab" has its own context
- Storage events fire in OTHER tabs only (echo prevention)
- All tabs share the same localStorage

This is conceptually correct even though it runs in one process.

---

## Contributing

When adding new test utilities:
1. Keep them simple and focused
2. Document with examples
3. Add to index.ts exports
4. Update this README

**Principle**: Make the common case easy, make the hard cases possible.
