# State System

This folder contains the default plumbing for app state that:

- converges across tabs (cross-tab coherence)
- optionally persists across sessions
- keeps UI state separate from shared truth

Most developers should only need **`index.ts`** and the store factory.  
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

A single **raw JSON snapshot** at `localStorage[storageKey]`:

```
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

---

## Conflict resolution

Default policy: **newer snapshot wins** (LWW for the entire snapshot).
LLW you ask?? You're soaking in it ... man I am old ... Last-Write-Wins. This
is simple, but also we are not anticipating things like offline merges, multiple
sessions happening at once.

“Newer” is derived deterministically ...

> The outcome is inevitable, predictable, and entirely dependent on
> initial conditions or prior causes, with no room for chance or randomness

1. higher `rev` wins
2. if tied, higher `updatedAtMs` wins
3. if tied, `updatedBy` string tie-breaker wins

This guarantees convergence without oscillation.

Domains can override this with `config.merge` if needed.

---

## Cross-tab sync mechanics

We use browser **`storage` events**:

- When Tab A writes `localStorage[storageKey]`
- Tab B receives a `storage` event
- Tab B parses the snapshot and applies it (if newer)
- Tab B ignores snapshots authored by itself (`updatedBy === tabId`)

This prevents echo / ping-pong loops.

---

## Visibility support

Some domains (_cough_ timers) need to “snap correctness” when a tab becomes visible again.

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

```
import { createCrossTabStore } from "@/state/_stateSystem"

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

```
useEffect(() => settings.initSync(), [])
```

---

## Why the wrapper owns `tabId`

Each browser tab gets a unique `tabId` stored in `sessionStorage`.

Domain authors never need to think about it.
This reduces cognitive load and prevents inconsistent implementations.

---

## Extending the system

If you need to extend behavior:

- **`sync.ts`** → event wiring, tabId, transport
- **`utilities.ts`** → snapshot read/write, merge logic
- **`types.ts`** → contracts

Keep extensions small and deterministic.

Avoid introducing “magic” or hidden state

... it's all just javascript _he said without a hint of irony_
