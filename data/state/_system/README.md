# Synced Store System

A small, deterministic state foundation for:

- Live cross-tab synchronization
- Controlled restore behavior
- Boring, predictable convergence
- SWR-style immediate display

This system intentionally separates:

- **Sync** → real-time updates across open tabs
- **Restore** → what happens on startup
- **Domain logic** → implemented by feature authors

The goal: feature code stays simple; plumbing stays explicit.

# Quick Mental Model

Each synced store wraps your domain data inside a `SyncFrame`:

```typescript
{
  schemaVersion: number
  sync: {
    rev: number
    updatedAtMs: number
    updatedBy: string
  }
  data: TData
}
```

- `schemaVersion` → wipe-on-change policy
- `sync` → deterministic ordering metadata
- `data` → your actual domain state

We use a strict Last-Write-Wins (LWW) merge policy because this system is designed for single-device, multi-tab scenarios.

If we ever need more sophisticated conflict resolution, that would be a deliberate architectural shift — not an incremental tweak.

# Core Invariants (Important)

These are system-level guarantees:

1. **Deterministic convergence**  
   All tabs will eventually settle on the same `SyncFrame`.

2. **No import-time side effects**  
   Sync does not start until first subscribe or first commit.

3. **Restore is cache, not persistence**  
   `localStorage` is treated as disposable.

4. **Schema changes wipe state**  
   We do not migrate by default.

5. **Domain code writes via `commitShared` only**  
   This is the single write gate.

If you feel tempted to bypass one of these, pause. That’s usually a plumbing decision, not a feature decision.

# Sync vs Restore

These are intentionally separate.

## Sync (live updates)

- Uses `BroadcastChannel`
- Only affects open tabs
- No storage events
- No polling
- No heartbeats

When enabled, a mutation:

1. Commits locally
2. Emits a frame
3. Other tabs merge deterministically

That’s it.

## Restore (startup behavior)

Restore controls how the store seeds its initial state.

Modes:

- `never`
- `session`
- `device`

### `never`

- Always start from `initialData`
- Never write restore snapshots
- Pure in-memory

Use this for ephemeral state.

### `device`

- Restore from localStorage
- Survives reload
- Survives new tab
- Survives full browser close + reopen

This is traditional persistence behavior.

### `session`

Restores while the app is still open somewhere.

Does **not** resurrect state after all tabs close.

Intended UX:

- Reload restores
- New tab while another is open restores
- Closing all tabs ends the session
- Reopening later starts fresh

This feels like “soft persistence”.

# How Session Restore Works

Session restore is coordinated using `BroadcastChannel`.

### 1. Global App Session

The app maintains a single `sessionId` shared across open tabs.

When a tab starts:

1. It asks other tabs which session is active.
2. If a tab answers → it adopts that `sessionId`.
3. If nobody answers quickly → it creates a new `sessionId`.

No heartbeats.  
No “last tab closed” detection.  
No timers running forever.

A session exists only while at least one tab is alive to answer.

...like a reverse Highlander situation.

### 2. Storage Keys

Snapshots are written to `localStorage` using:

- **Device restore** → `device + syncKey`
- **Session restore** → `sessionId + syncKey`

If no tab answers during discovery:

- A new sessionId is created
- Old session keys become orphaned
- Orphaned keys are harmless

We do not clean them aggressively because they are cache.

# Merge Strategy

We use deterministic LWW (Last Write Wins):

Order priority:

1. Higher `rev`
2. Higher `updatedAtMs`
3. Lexicographic `updatedBy`

The third tie-breaker is purely to guarantee convergence.

It does not mean “more correct”.  
It means “every tab makes the same choice.”

If you _think_ you need a custom merge strategy ... you probably don't

If you _know_ you need a custom merge strategy that is a systems-level decision. It in `merge.ts`, not in feature code.

# Why This Design

This approach intentionally avoids:

- Storage-event live sync
- Heartbeat timers
- “Last tab closed” race conditions
- Flicker on first paint
- Hidden global initializers
- Clever-but-fragile magic
- HotDog based misunderstandings

It aligns with SWR-style behavior:

- If cached → show immediately
- If not → use `initialData`
- Live sync happens independently

# For Feature Authors

You only need to think about:

- Your state shape
- Your domain actions

Example:

```typescript
const initialData = { current: 0 }
const storeConfig = { syncKey: "counter", schemaVersion: 1, initialData }

createSyncedStore(storeConfig, ({ commitShared: commit }) => ({
  /** This is how we increment the counter **/
  increment: () => {
    return commit((state) => ({
      ...state,
      current: state.current + 1,
    }))
  },
}))
```

Do not:

- Mutate `shared` directly
- Rely on storage side effects
- Assume sync is multi-device
- Add custom merge logic

If you feel the urge to do one of those, we probably need to call a plumber.

# Dragons (Read Before Extending)

- `localStorage` is not reliable persistence.
- This system is not CRDT-based (Conflict-Free Replicated Data Types).
- We assume a single-device context.
- Sync is best-effort (BroadcastChannel).
- Session restore depends on active tabs answering quickly.

If you need:

- Cross-device sync
- Offline reconciliation
- Conflict-free merges
- Guaranteed durable storage

This system is not that ... it can consume some of those things, but it's concern is solely based in keeping things working in harmony without being too much.

It is intentionally small.

# Why not just keep everything in one file?

**Cognitive load.** A single 500+ line file mixing high-level store creation with low-level event wiring is hard to navigate. Separation by abstraction level makes the codebase more maintainable. We shall forever call this `The Nathan Rule`... we aim for around 300 lines to make sure people don't get bored/overwhelmed

# Final Mental Model

Think of it as:

- **Restore** = cache policy
- **Sync** = revalidation across tabs
- **Merge** = convergence rule

Everything else is plumbing.

And the plumbing should be boring. Like me!
