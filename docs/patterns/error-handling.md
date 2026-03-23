# Error Handling

Error handling is a first-class concern — not because the system expects a lot of errors, but because how errors are handled defines how cleanly everything else can be reasoned about.

The system pushes validation as early as possible — into build gates and publish pipelines — so that runtime has less to worry about. When errors do happen at runtime, the response is deliberate: report with context, continue gracefully, let the user see something.

## Philosophy

Three principles guide how this project handles errors:

**Best-effort, never crash.** The system prefers showing stale or partial data over showing nothing. A background refresh that fails is a report, not a broken page.

**Report at boundaries, not inside business logic.** Errors are caught and reported at system boundaries — catch blocks, fetch responses, lifecycle hooks. Business logic stays clean. Telemetry that grows like fungus through the codebase is worse than no telemetry.

**Build-time catches structural problems.** If a snapshot is incomplete, if an artifact is missing, if identity can't be derived — that should be caught by the delivery pipeline before it ever reaches the browser. Runtime doesn't try to repair what should have been rejected earlier. See [Gating](../architecture/gating.md).

## Error reporting contract

::: info Not yet in code
This contract is defined but not yet implemented. Current code uses `console.log` and `createBufferedLogger` for error output, and ad-hoc `onError` callbacks in synced stores.
:::

The renderer reports errors and metrics through two host-provided capabilities, received via [`init()`](../spec/lifecycle-contract.md):

- **`reportError`** — for failures and unexpected conditions (defined below)
- **`reportMetric`** — for measurements and telemetry (see [Telemetry](./telemetry.md))

The renderer does not know where reports go — in development the host logs to console, in production the coordinator routes to its telemetry system. This follows the same pattern as [message loading for l10n](../architecture/l10n.md#message-loading-capability): the renderer has a capability, the host provides the implementation.

### `reportError`

For unexpected conditions — something failed, something is missing, something is wrong.

```typescript
reportError({
  source: "state",                    // subsystem: "state", "coordinator", "renderer", "l10n"
  context: "readStoredSyncFrame",     // specific operation
  reason: "schema_mismatch",          // machine-readable reason
  severity: "warning",                // "warning" | "error" | "fatal"
  detail: {                           // diagnostic context (optional)
    storageKey: "weather-v2",
    expected: 3,
    found: 2,
  },
})
```

### Shape

`reportError` is fire-and-forget — the renderer does not wait for a response.

**ErrorReport:**

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `source` | `string` | Yes | Subsystem: `"state"`, `"coordinator"`, `"renderer"`, `"l10n"` |
| `context` | `string` | Yes | Specific operation: `"readStoredSyncFrame"`, `"backgroundFetch"` |
| `reason` | `string` | Yes | Machine-readable: `"parse_failed"`, `"schema_mismatch"`, `"network_error"` |
| `severity` | `"warning" \| "error" \| "fatal"` | Yes | See severity model below |
| `detail` | `unknown` | No | Diagnostic context — status codes, caught errors, relevant state |

## Severity model

Three levels, matching the system's error philosophy:

| Severity | Meaning | Example |
|----------|---------|---------|
| `warning` | Degraded but functional. The system keeps running. | Background fetch failed, using cached data |
| `error` | Broken at the feature level. Something the user might notice. | Store couldn't restore state, fell back to defaults |
| `fatal` | Unrecoverable. The renderer can't continue. | Mount target doesn't exist, critical dependency missing |

Warnings are the most common. The system is designed to keep going. Fatal should be rare — if validation gates are working, the conditions for fatal errors shouldn't reach runtime.

## Bridge pattern

::: info Not yet in code
Subsystems currently use ad-hoc `onError` callbacks (synced stores) or `console.log` (discover store, coordinator). The bridge pattern standardizes wiring without changing call sites.
:::

Subsystems like stores don't have direct access to `init()` capabilities. The renderer bridges them during initialization:

```typescript
// Renderer creates a bridge for a subsystem
function errorBridge(source: string) {
  return (err: { context: string; reason: string; severity?: string; detail?: unknown }) =>
    reportError({ source, severity: "warning", ...err })
}

// Stores receive the bridge as their onError callback
const weatherStore = createWeatherStore({
  onError: errorBridge("state"),
})
```

The store's call site doesn't change — it still calls `onError({ context, reason, detail })`. The bridge adds `source` and routes to `reportError`. Stores stay decoupled from the host.

## Boundary convention

Report at system boundaries. Not inside business logic.

Good boundaries for error reporting:

- **Catch blocks** — the natural place to report what went wrong
- **Fetch responses** — non-200 status, network failures
- **Lifecycle hooks** — init, mount, unmount failures
- **Storage reads** — parse failures, schema mismatches, missing data
- **Module loads** — renderer script failed to load, structural validation failed

Not boundaries:

- Inside render functions
- Inside state derivation logic
- Conditional branches in business logic
- Computed values

If you find yourself adding `reportError` inside a `map()` or a computed selector, step back — the error should be caught at the boundary that produced the bad input, not inside the logic that consumes it.

## Current patterns

These patterns exist in the codebase today and form the foundation the reporting contract builds on.

### Data fetching

The coordinator fetches data with try/check/report/continue:

```typescript
async function refreshDataInBackground(key: string): Promise<void> {
  try {
    const res = await fetch(url, { cache: "no-store" })

    if (!res.ok) {
      // Today: logger.warn("background fetch failed", res.status)
      // Contract: reportError({ source: "coordinator", context: "backgroundFetch", reason: "http_error", severity: "warning", detail: { status: res.status, key } })
      return
    }

    // ... cache the result
  } catch (e) {
    // Today: logger.warn("background refresh threw", e)
    // Contract: reportError({ source: "coordinator", context: "backgroundFetch", reason: "network_error", severity: "warning", detail: { error: e, key } })
  }
}
```

The SWR pattern: serve what you have, refresh in the background, report failures without breaking the serving path.

### State sync errors

The synced store system already routes errors through `onError` callbacks:

```typescript
onError?.({
  context: "readStoredSyncFrame",
  storageKey,
  reason: "schema_mismatch",
  expectedSchemaVersion,
  foundSchemaVersion: frame.schemaVersion,
})
```

This is already close to the `ErrorReport` shape. The bridge pattern adds `source` and `severity`, then routes to `reportError`.

Failure modes handled this way:
- Parse failures (`reason: "parse_failed"`)
- Schema mismatches (`reason: "schema_mismatch"`)
- Invalid metadata (`reason: "invalid_metadata"`)
- Storage exceptions (`reason: "storage_error"`)

The store always returns `null` and falls back to `initialData`. BroadcastChannel transport follows the same pattern — errors routed to `onError`, sync degrades to a no-op if the channel isn't available.

### Cache validation

The coordinator validates cached renderers before using them:

- **Manifest consistency** — if the manifest's `file` field doesn't contain its `hash`, the manifest is considered corrupt and is deleted from the cache
- **Orphaned manifests** — if a manifest exists in cache but its referenced JS file doesn't, the manifest is cleaned up
- **Load validation** — renderer modules are loaded and structurally checked before being mounted

Pattern: check, report, clean up, fall back to the bundled renderer.

### Utility patterns

**safeJsonParse** — returns `null` instead of throwing on malformed input:

```typescript
export function safeJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}
```

**Numeric safety** — math operations guard against `NaN` and `Infinity` at the boundary:

```typescript
const updatedAt = Date.parse(payload.updatedAt)
if (Number.isNaN(updatedAt)) return true
```

## React Error Boundaries

::: info Not yet in code
Error boundaries are not in place yet. The data and coordinator layers handle most error paths today.
:::

React Error Boundaries provide a declarative catch at the component level — the last safety net before the user sees a broken page. They feed into the same `reportError` surface:

- Placement: route or feature boundaries, not per-component
- On catch: `reportError({ source: "renderer", context: "ErrorBoundary", reason: "component_error", severity: "error", detail: { error, componentStack } })`
- Fallback: a degraded but functional UI, not a blank page

Error boundaries are the React-level equivalent of the try/catch boundaries in the data and coordinator layers.

## Things worth noticing

- **Context in every catch.** A bare `catch {}` makes debugging harder later. Including the what, where, and why pays for itself.
- **Null returns over throws.** For read operations, returning null on failure and letting the caller decide is usually the right call. Throwing is reserved for the rare case where continuing would be dangerous.
- **Assertions at boundaries, not in loops.** Runtime guards (`if (!el) throw`) make sense at initialization. In render loops, they're noise.
- **Consistent source values.** Use the same `source` strings everywhere: `"state"`, `"coordinator"`, `"renderer"`, `"l10n"`. This is how the host routes and filters.

::: tip How to think about errors
- Could this have been caught at build time? → check [Gating](../architecture/gating.md)
- Can the system keep running if this fails? → graceful degradation is the default
- Is this a boundary? → report here
- Is this inside business logic? → the error should have been caught upstream
:::

## Related documentation

- [Telemetry](./telemetry.md) — `reportMetric` capability, what to measure, dimensions
- [Lifecycle contract](../spec/lifecycle-contract.md) — `reportError` and `reportMetric` as init() capabilities
- [Gating](../architecture/gating.md) — build-time validation as the primary error prevention strategy
- [Mental model](../architecture/mental-model.md) — "runtime as a consumer" — does not repair
- [State management](./state-management.md) — onError callbacks, schema mismatch handling
- [Coordinator deep-dive](../architecture/coordinator.md) — SWR failure modes, cache validation
