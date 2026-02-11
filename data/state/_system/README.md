# State System

> ⚠️ **LOW-LEVEL INFRASTRUCTURE** ⚠️
> This is plumbing that **most developers should never modify**.
> It's consumed by domain stores, not edited directly.
>
> **When to modify:** Rarely. Only when changing core sync behavior, adding transport options, or fixing fundamental bugs.
> **Most of the time:** Just use the store factory to create enhanced domain state.
> **Frequently:** Take some time off to just reconnect with nature.

This folder contains the default plumbing for app state that:

- converges across tabs (cross-tab coherence)
- optionally persists across sessions
- keeps UI state separate from shared truth

Most developers should only need **`createCrossTabStore`** from **`index.ts`**.
Everything else is plumbing.

> NOTE: We do not use Zustand persist or subscribe. Persistence and synchronization are explicit and deterministic.

---

## Mental model

There are **three tiers of state**. Always use the _simplest_ tier that solves your problem.

### 1) React component state (default)

Use for UI that only matters to one component:

- hover
- open/closed dropdown
- input focus
- local form typing

This state is ephemeral and should not be shared.

---

### 2) Store `local` (same-tab UI state)

Use for UI state that multiple components in the _same tab_ need to agree on:

- selected row id
- sidebar expanded/collapsed
- active panel
- UI version nudges

This state is **per-tab**. Different tabs may legitimately diverge.

---

### 3) Store `shared` (authoritative truth)

Use when state must **converge across tabs**:

- settings
- tasks / todos
- timer truth
- app mode that should match everywhere

This state is authoritative and is what we synchronize.

---

## What gets stored in `localStorage`?

A single **raw JSON sync frame** at `localStorage[storageKey]`:

```typescript
{
  "sync": {
    "rev": 12,
    "updatedAtMs": 1700000000000,
    "updatedBy": "tab-uuid"
  },
  "data": {
    "...domain data..."
  },
  "schemaVersion": 1
}
```

This is intentionally **raw** (not wrapped in a Zustand-persist envelope).

**What is a SyncFrame?**

A SyncFrame is the fundamental unit of synchronization. It wraps your domain data with sync metadata:

```typescript
type SyncFrame<TData> = {
  sync: {
    rev: number // Revision number (monotonically increasing)
    updatedAtMs: number // Timestamp (for tie-breaking)
    updatedBy: string // Tab ID (for echo prevention)
  }
  data: TData // Your actual application state
  schemaVersion?: number // Optional schema version for migrations
}
```

**Why wrap data?** Because cross-tab sync needs to answer: "Which version is newer?" You can't determine that from domain data alone - you need revision numbers, timestamps, and tab identity.

---

## Conflict resolution

Default policy: **newer snapshot wins** (LWW for the entire snapshot).
LWW you ask?? You're soaking in it ... man I am old ... Last-Write-Wins. This
is simple, but also we are not anticipating things like offline merges, multiple
sessions happening at once.

"Newer" is derived deterministically ...

> The outcome is inevitable, predictable, and entirely dependent on
> initial conditions or prior causes, with no room for chance or randomness

**Tie-breaking order:**

1. higher `rev` wins
2. if tied, higher `updatedAtMs` wins
3. if still tied, lexicographic `updatedBy` comparison (deterministic final arbiter)

This guarantees convergence without oscillation.

> Three combatants enter ... only one emerges. Are you not entertained!

Domains can override this with `config.merge` if needed.

---

## Cross-tab sync mechanics

We use browser **`storage` events**:

- When Tab A writes `localStorage[storageKey]`
- Tab B receives a `storage` event
- Tab B parses the sync frame and applies it (if newer)
- Tab B ignores sync frames authored by itself (`updatedBy === tabId`)

This prevents echo / ping-pong loops.

**Why tabs need IDs**: Echo prevention. Tabs must recognize their own writes to avoid infinite ping-pong loops. Each browser tab gets a unique `tabId` stored in `sessionStorage`. Domain authors never need to think about it - the wrapper owns this.

---

## Visibility support

Some domains (_cough_ timers) need to "snap correctness" when a tab becomes visible again.

Enable:

- `features.visibility = true`
- `features.refreshOnVisible = true` (default)

On `visibilitychange`, the store refreshes from storage and bumps UI if needed.

---

## When **NOT** to use this system

Do **not** use this for:

- component-only UI state (hover, focus, transient input)
- state that would surprise users if it syncs across tabs
- real collaborative editing (use server-side sync / CRDTs)

This system is for **single-user, multi-tab coherence**.

---

## Basic usage example

```typescript
import { createCrossTabStore } from "@data/state/_system"

type SettingsData = {
  theme: "light" | "dark"
  showSeconds: boolean
}

export const settings = createCrossTabStore(
  {
    storageKey: "app:settings",
    schemaVersion: 1,
    initialData: { theme: "dark", showSeconds: true },
    features: { persist: true, crossTab: true },
  },
  ({ commitShared }) => ({
    setTheme: (theme: SettingsData["theme"]) =>
      commitShared((d) => ({ ...d, theme })),

    setShowSeconds: (showSeconds: boolean) =>
      commitShared((d) => ({ ...d, showSeconds })),
  }),
)
```

App startup:

This one is vital and also should be only initiated once. We don't want this privy
to any sort of render thrashing. That's why we do the whole useEffect with [].

```typescript
useEffect(() => settings.initSync(), [])
```

---

## Error Handling & Recovery

### Quota Exceeded Errors

If localStorage quota is exceeded (5-10MB browser limit), the system gracefully degrades:

1. **Write fails:** `writeRawSyncFrame` catches error, calls `onError` hook
2. **Store continues:** In-memory state updates successfully
3. **Persistence disabled:** Flag set to prevent repeated errors
4. **Cross-tab sync degrades:** Tabs work independently until refresh
5. **Recovery:** Automatic on next page load (when user might have cleared storage)

```typescript
const store = createCrossTabStore(
  {
    storageKey: "app:data",
    initialData: { ... },
    onError: (err) => {
      // Log for monitoring/telemetry
      if (err.context === "writeRawSyncFrame" && err.isQuotaError) {
        console.error("Storage quota exceeded:", err.storageKey)
        // Optional: Show user notification
      }
    },
  },
  ({ commitShared }) => ({ ... })
)
```

### Corrupted Data

If localStorage contains corrupted data (invalid JSON, wrong schema):

1. **Read fails:** `readRawSyncFrame` returns null, calls `onError` hook
2. **Fallback:** Store uses `initialData` as starting state
3. **Fresh start:** Next write will overwrite corrupted data

### Migration Pattern

Use the `migrate` callback to validate and transform persisted data:

```typescript
const store = createCrossTabStore(
  {
    storageKey: "app:data",
    schemaVersion: 2,
    initialData: { ... },
    migrate: (incoming: unknown) => {
      const frame = incoming as { schemaVersion?: number }

      // Reject if too old - "brick wall" approach
      if (!frame.schemaVersion || frame.schemaVersion < 1) {
        return null // Start fresh with initialData
      }

      // Transform if needed (optional)
      if (frame.schemaVersion === 1) {
        return {
          ...frame,
          data: transformV1toV2(frame.data),
          schemaVersion: 2,
        } as SyncFrame<YourData>
      }

      return incoming as SyncFrame<YourData>
    },
    onError: (err) => {
      if (err.reason === "migration_rejected") {
        console.warn("Old data rejected, starting fresh")
      }
    },
  },
  ({ commitShared }) => ({ ... })
)
```

**Pattern:** Return `null` from `migrate` to reject and start fresh. Don't over-engineer migrations for single-user scenarios - if schema is too old or unrecognizable, starting fresh with defaults is usually fine.

---

## The Sync Subsystem (`sync/`)

_IMPORTANT_

The cross-tab synchronization plumbing lives in its own namespace (`sync/`) because it's a large, complex subsystem that deserves discrete boundaries.

ALSO

You probably don't need to ever deal with this stuff. It is 100% plumbing that allows us to make sure multiple tabs stay in sync. The actual way you will interface with this is through the state `_system` store wrapper. So why not just roll it all into the `_system`? Well, it is framework agnostic, and the wrapper is very Zustand. This is core functionality and we want to keep it discrete.

### Why It Deserves Its Own Folder

**1. Size & Complexity**

The sync subsystem is ~300 lines of tightly interconnected logic handling:

- Tab identity generation and caching
- Storage event wiring and cleanup
- Echo prevention (critical for avoiding infinite loops)
- Sync frame parsing and validation
- Conflict resolution and merge policies
- localStorage I/O with SSR safety

This is **not** a simple helper function. It's a complete subsystem with its own responsibilities, edge cases, and test surface area.

**2. Single Responsibility**

Everything in `sync/` has one job: **enable multiple browser tabs to stay in sync**.

The sync folder is the **transport layer** for cross-tab state:

- `_system/index.ts` = High-level store factory (business logic) based on a framework
- `sync/` = Low-level plumbing (how tabs communicate) close to the metal

This separation makes the codebase easier to navigate and reason about.

**3. Stable Interface, Rare Modifications**

Most developers will **never** need to edit these files. The sync subsystem is:

- Well-tested
- Deliberately designed to be "boring" infrastructure
- Changes here should be rare and carefully considered

Isolating this to indicated: **"This is plumbing. You probably don't need to touch this ... no really"**

### When to Modify Sync Code

NEVAH!!

Just kidding .. but ... you should **rarely** need to edit sync subsystem files. Valid reasons include:

✅ **Do modify if:**

- Adding a new transport (e.g., BroadcastChannel instead of storage events)
- Fixing a bug in echo prevention or conflict resolution
- Adding performance optimizations (e.g., debouncing)

❌ **Don't modify for:**

- Adding domain-specific actions → Use `buildDomainActions` in store factory
- Changing stored data shape → Use `migrate` hook in store config
- Debugging state issues → Check higher-level store logic first

### What's Inside `sync/`

**Core Functions:**

- **Tab Identity**: `getOrCreateTabId()`, `fallbackId()`, `__resetTabIdCache()`
- **Event Wiring**: `initCrossTabSync()` - Wire up storage + visibility event listeners
- **Frame Parsing**: `readIncomingSyncFrame()` - Parse and validate incoming sync frames
- **Conflict Resolution**: `isIncomingNewer()`, `mergeLww()` - Deterministic comparison and merge
- **Storage I/O**: `readRawSyncFrame()`, `writeRawSyncFrame()` - localStorage read/write with SSR safety

**Testing Strategy:**

The sync subsystem has comprehensive test coverage (`sync/sync.test.ts`):

- Tab identification (8 tests)
- Storage event parsing (4 tests)
- Event listener setup (4 tests)
- Echo prevention (4 tests)

**Test utilities used:**

- `MockStorage` - Isolated localStorage test double
- `mockCrypto()` - Deterministic UUID generation
- `createMockSyncFrame()` - Test fixture factory
- `createStorageEvent()` - Simulate cross-tab events

### Architecture Principles

**1. Plumbing, Not Policy**

The sync subsystem provides _mechanisms_, not _policies_:

- ✅ Provides: Event wiring, echo prevention, merge comparison
- ❌ Doesn't: Define what data to store, when to sync, business rules

Policy decisions live in the store factory (`_system/index.ts`).

**2. Deterministic Conflict Resolution**

All merge logic is **deterministic** to ensure convergence:

- Two tabs with the same sync frames will _always_ reach the same conclusion
- No randomness, no timestamp-only comparisons (risk of ties)
- Three-level tie-breaking eliminates oscillation

**3. Fail Loudly in Development**

The sync subsystem prefers crashes over silent corruption:

- `writeRawSyncFrame()` **intentionally allows** JSON.stringify to throw
- Non-serializable data surfaces bugs early
- In production, this should never happen (guarded by TypeScript)

**4. SSR-Safe by Default**

Every function handles `window === undefined`:

- `getOrCreateTabId()` → returns `"ssr"`
- `readRawSyncFrame()` → returns `null`
- `writeRawSyncFrame()` → no-op
- `initCrossTabSync()` → returns no-op cleanup

This allows stores to initialize on the server without crashing.

### File Structure

```
data/state/_system/
├── index.ts              ← Store factory (high-level API)
├── types.ts              ← Shared type definitions
├── sync/                 ← Here be DRAGONS
│   ├── index.ts          ← Sync subsystem (low-level plumbing)
│   └── sync.test.ts      ← Comprehensive test coverage
└── README.md             ← You are here
```

**Import flow:**

- `_system/index.ts` imports from `sync/`
- `sync/` imports types from `_system/types.ts`
- External code imports from `_system/index.ts` (never directly from `sync/`)

**Public API:**
The sync subsystem is an **internal implementation detail**. Consumers should only use the store factory exported from `_system/index.ts`.

---

## Extending the system

> 🚫 **STOP**: Do you _really_ need to edit these files?

**99% of the time, the answer is no.** This is LOW-LEVEL infrastructure that:

- Powers all domain stores
- Is thoroughly tested
- Should be treated as "boring" plumbing

**Valid reasons to modify:**

- ✅ Adding a new transport mechanism (e.g., BroadcastChannel)
- ✅ Fixing a bug in echo prevention or conflict resolution
- ✅ Performance optimizations (debouncing, throttling)

**Invalid reasons:**

- ❌ Adding domain-specific actions → Use store factory in your domain store
- ❌ Changing data shape → Use `migrate` hook in your store config
- ❌ Debugging state → Check domain store logic first

If you _must_ extend:

- **`sync/index.ts`** → event wiring, tabId, transport (RARE)
- **`index.ts`** → store factory, domain actions (UNCOMMON)
- **`types.ts`** → contracts (UNCOMMON)

Keep extensions small and deterministic.

Avoid introducing "magic" or hidden state

... it's all just javascript _he said without a hint of irony_

---

## FAQ

### Why `sync/` instead of `helpers/`?

The `sync/` folder is a **stateful subsystem**, not just helper functions:

- Manages event listeners (storage events, visibility changes)
- Maintains tab ID cache across function calls
- Has initialization and cleanup lifecycle

By contrast, `timer/helpers/` contains **pure functions** (no state, no side effects). The naming reflects this architectural difference.

### Why not just keep everything in one file?

**Cognitive load.** A single 500+ line file mixing high-level store creation with low-level event wiring is hard to navigate. Separation by abstraction level makes the codebase more maintainable. We shall forever call this `The Nathan Rule`... we aim for around 300 lines to make sure people don't get bored/overwhelmed

### When would you split sync/ further?

**If it grows significantly.** If we add multiple transport options (BroadcastChannel, WebRTC, etc.) or multiple merge strategies (CRDTs, OT), we might split:

```
sync/
├── transports/
│   ├── storage-events.ts
│   └── broadcast-channel.ts
├── merge-policies/
│   ├── lww.ts
│   ├── nwa.ts
│   ├── wwf.ts
│   ├── abc.ts
│   ├── easyAs.ts
│   ├── 123.ts
│   ├── DoReMe.ts
│   └── crdt.ts
└── index.ts
```

But for now, ~300 lines in one well-organized file is optimal. Thanks Nathan!
