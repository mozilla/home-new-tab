# State Management

State in this project lives in `data/state/`, not in components.

Components consume state. They don't own it, shape it, or decide how it persists. That separation is intentional — it keeps components presentational and keeps state logic testable without rendering anything.

## The two-tier system

Not every piece of state has the same needs.

Some state matters across tabs. If you change a setting in one tab, the other tab should know about it. If you reload, it should still be there. That kind of state needs sync and persistence.

Other state is ephemeral. A fetched feed, a loading flag, a list of items from the network. It lives for the lifetime of the tab and gets thrown away. No sync, no restore.

This project handles both, but doesn't pretend they're the same thing.

### Synced stores

For state that matters across tabs and sessions, the project provides `createSyncedStore` — a factory built on top of Zustand that adds:

- **Cross-tab sync** via BroadcastChannel
- **Restore** via localStorage (with configurable lifetime)
- **Deterministic merge** via last-write-wins (LWW)
- **Schema versioning** (mismatch wipes the snapshot — localStorage is a cache, not critical storage)
- **Auto-start** on first subscribe or first commit

The factory lives in `data/state/_system/index.ts`.

### Plain stores

For state that doesn't need sync or persistence, the project uses plain Zustand with devtools:

```typescript
export const useDiscover = create<DiscoverState>()(
  devtools(
    (set, get) => ({
      // fetch-driven, local to this tab
    }),
    { name: "Discover" },
  ),
)
```

No sync, no restore. The store fetches what it needs and discards it when the tab closes. That's fine. That's the right tool for this job.

## commit() vs set()

This is the most important distinction in the synced store system.

**`commit(mutate)`**, a shared write. When you commit:

- The mutation is applied to the store
- Sync metadata is bumped (`rev`, `updatedAtMs`, `updatedBy`)
- The new frame is broadcast to other tabs via BroadcastChannel
- The new frame is written to localStorage (if restore is enabled)

**`set(mutate)`**, a local-only write. When you set:

- The mutation is applied to the store
- Nothing else happens. No broadcast, no persistence, no metadata bump.

Both return `boolean`: `true` if a change was applied, `false` if the mutation was a no-op (same reference returned).

The mental model: if this change matters beyond this tab, use `commit`. If it's ephemeral UI state that only this tab cares about, use `set`.

```typescript
// Shared. other tabs should see this
commit((state) => ({ ...state, status: "running", eventId: state.eventId + 1 }))

// Local only. no one else cares about a loading spinner
set((state) => ({ ...state, isExpanded: true }))
```

## The public model: `{ data, actions }`

Every synced store exposes its state through a clean surface:

```typescript
{
  data: TData          // the domain payload
  actions: {
    set: (mutate) => boolean      // local-only
    commit: (mutate) => boolean   // shared
    ...domainActions              // feature-specific actions
  }
}
```

Internal metadata (`_internal`, sync ordering, schema version) is hidden from feature code. Components see `{ data, actions }` and nothing else.

Access state via selectors:

```typescript
// Select what you need, not the whole store
const status = useTimer((s) => s.data.status)
const start = useTimer((s) => s.actions.start)
```

Narrow selectors keep components fast. Selecting the whole store means re-rendering on every change, which adds up.

## Creating a synced store

Here's the pattern, from the timer store:

```typescript
const TIMER_STORE_CONFIG: SyncedStoreConfig<TimerData> = {
  syncKey: "app:timer",
  schemaVersion: 1,
  initialData: DEFAULT_TIMER_DATA,
  restore: "session",
  onVisible: "refresh",
}

export const timer = createSyncedStore<{
  data: TimerData
  actions: TimerActions
}>(TIMER_STORE_CONFIG, ({ commit, get, set }) => {
  return {
    start: () =>
      commit((state) => {
        if (state.status === "running") return state // no-op
        return { ...state, status: "running", startedAtMs: Date.now() }
      }),
    // ... more domain actions
  }
})

export const useTimer = timer.use
```

The config is explicit and top-level. The action builder receives `{ get, set, commit }`. Get reads the public model, set is local-only, commit is shared.

### Configuration options

| Option          | Type            | Default    | Purpose                                                 |
| --------------- | --------------- | ---------- | ------------------------------------------------------- |
| `syncKey`       | `string`        | required   | Domain identifier for BroadcastChannel and storage keys |
| `schemaVersion` | `number`        | required   | Version for stored frames — mismatch wipes restore      |
| `initialData`   | `TData`         | required   | Fallback when no restore snapshot exists                |
| `sync`          | `boolean`       | `true`     | Enable cross-tab sync                                   |
| `restore`       | `RestoreMode`   | `"device"` | Persistence strategy                                    |
| `onVisible`     | `OnVisibleMode` | `"none"`   | What to do when the tab becomes visible                 |
| `nowMs`         | `() => number`  | `Date.now` | Clock injection for testing                             |
| `onError`       | `(err) => void` | optional   | Error routing for telemetry                             |

## Stores in the codebase

| Store       | Type   | Restore | Sync | Domain                      |
| ----------- | ------ | ------- | ---- | --------------------------- |
| `timer`     | synced | session | yes  | Pomodoro timer state        |
| `discover`  | plain  | N/A    | N/A  | Content feed (fetch-driven) |
| `sponsored` | plain  | N/A    | N/A  | Sponsored content           |

## Cross-tab sync mechanics

For the curious, this is how tabs stay in sync.

### BroadcastChannel transport

Each synced store opens a BroadcastChannel named `app:sync:{syncKey}`. Three message types flow through it:

- **SYNC_FRAME** — a tab committed a change, here's the new frame
- **SYNC_REQUEST** — a new tab just opened, asking for current state
- **SYNC_SNAPSHOT** — an existing tab replies with its current frame

Tabs ignore their own messages (echo guard via `tabId` match). If BroadcastChannel isn't available, sync silently becomes a no-op.

### Startup sequence

1. Try to restore from localStorage (synchronous, best-effort)
2. If no restore, fall back to `initialData`
3. Open BroadcastChannel on microtask (async)
4. New tab sends `SYNC_REQUEST`
5. Existing tabs reply with `SYNC_SNAPSHOT`
6. Incoming snapshot is merged with local state using LWW

### LWW merge

When two frames compete, the winner is deterministic:

1. Higher `rev` wins
2. If tied → higher `updatedAtMs` wins
3. If still tied → lexicographic `updatedBy` (tab ID) wins

Every tab applies the same rules, so all tabs converge to the same state regardless of message arrival order. That's intentional.

## Restore behavior

| Mode        | Reload   | New tab (other open) | Full close + reopen |
| ----------- | -------- | -------------------- | ------------------- |
| `"never"`   | fresh    | fresh                | fresh               |
| `"session"` | restores | restores             | fresh               |
| `"device"`  | restores | restores             | restores            |

Storage keys follow a predictable pattern:

- Device: `app:restore:device:{syncKey}`
- Session: `app:restore:session:{sessionId}:{syncKey}`

Session IDs are discovered via BroadcastChannel. A new tab asks existing tabs for the current session ID. If no answer arrives within 32ms, a new session is created.

## Schema versioning

If the stored `schemaVersion` doesn't match the config `schemaVersion`, the snapshot is wiped.

This is a deliberate choice. localStorage is treated as a cache, not critical persistence. Migration hooks exist in the type system (`migrate`) but are reserved. The current stance is that wiping is simpler and safer than maintaining migration paths for cached state.

## The `_system/` directory

All of the sync infrastructure lives in `data/state/_system/`:

| Module           | Purpose                                 |
| ---------------- | --------------------------------------- |
| `index.ts`       | `createSyncedStore` factory             |
| `types.ts`       | All type definitions                    |
| `transport.ts`   | BroadcastChannel implementation         |
| `restore.ts`     | localStorage read/write                 |
| `merge.ts`       | LWW merge logic                         |
| `session.ts`     | App session ID discovery                |
| `guards.ts`      | Runtime lifecycle (auto-start, cleanup) |
| `system.test.ts` | Comprehensive test suite                |

The underscore prefix signals "infrastructure, not domain." Feature code consumes stores through their `.use` hook. The `_system/` internals are there if you're curious, but the public surface is where the action is.

## Things worth noticing

- **Full-store destructuring** — `const { data, actions } = useTimer()` re-renders on any change. Selectors are the way to keep things tight.
- **commit vs set for the right job** — loading spinners and expanded/collapsed toggles don't need to sync across tabs. `set` keeps those local and lightweight.
- **The debug surface** — `_unsafe_useStore`, `getSyncFrame`, `getTabId` are there for system-level work and testing. Feature code gets everything it needs from `.use`.
- **Error routing consistency** — the synced stores route errors through `onError` callbacks. The `discover` store currently uses `console.log`. Converging on the `onError` pattern is on the roadmap.

::: tip How to reason about state

- Does this data need to survive a page reload? → choose a restore mode
- Does this data need to be shared across tabs? → use a synced store
- Is this a shared mutation or a local UI update? → commit vs set
- Am I selecting only what I need? → selector pattern
- Would a plain Zustand store be enough? → not everything needs sync
  :::

## Related documentation

- [Coordinator deep-dive](../architecture/coordinator.md) — SWR pattern, data flow
- [Data flow](../architecture/data-flow.md) — where state fits in the system
- [Mental model](../architecture/mental-model.md) — separation of concerns
- [Error handling](./error-handling.md) — onError callbacks, schema mismatch
- [Building components](../guide/building-components.md) — component consumption of stores
- [Glossary](../spec/glossary.md) — SyncFrame, LWW, Restore Mode definitions
- [File map](../spec/file-map.md) — where state code lives
