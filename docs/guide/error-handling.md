# Error Handling

Error handling in this project is usually the least interesting thing that happens.

That's by design. The system pushes validation as early as possible — into build gates and publish pipelines — so that runtime has less to worry about. When errors do happen at runtime, the response is almost always the same: log it, continue, let the user see something.

## Philosophy

Three principles guide how this project handles errors:

**Best-effort, never crash.** The system prefers showing stale or partial data over showing nothing. A background refresh that fails is a log line, not a broken page.

**Contextual logging over throwing.** Most errors are caught, logged with enough context to diagnose later, and swallowed. Throwing is reserved for situations where continuing would produce dangerous behavior — like mounting a renderer into a missing DOM element.

**Build-time catches structural problems.** If a snapshot is incomplete, if an artifact is missing, if identity can't be derived — that should be caught by the delivery pipeline before it ever reaches the browser. Runtime doesn't try to repair what should have been rejected earlier. See [Gating](../architecture/gating.md).

## Data fetching

The coordinator fetches data with a simple pattern: try, check status, log failures, move on.

```typescript
async function refreshDataInBackground(key: string): Promise<void> {
  try {
    const res = await fetch(url, { cache: "no-store" })

    if (!res.ok) {
      logger.warn("background fetch failed", res.status)
      return
    }

    // ... cache the result
  } catch (e) {
    logger.warn("background refresh threw", e)
  }
}
```

Key patterns:

- HTTP status is checked explicitly — no throwing on non-200
- Network exceptions are caught at the boundary
- Failures are logged as warnings, not errors — the system keeps running
- The current page load is unaffected; only the cache for future loads misses the update

This is the SWR pattern in action: serve what you have, refresh in the background, and don't let the refresh path break the serving path.

## State sync errors

The synced store system routes errors through an `onError` callback rather than throwing:

```typescript
const frame = readStoredSyncFrame(storageKey, expectedSchemaVersion, onError)
```

Inside `readStoredSyncFrame`, every failure path calls `onError` with a context object:

```typescript
onError?.({
  context: "readStoredSyncFrame",
  storageKey,
  reason: "schema_mismatch",
  expectedSchemaVersion,
  foundSchemaVersion: frame.schemaVersion,
})
```

This means:

- **Parse failures** — `safeJsonParse` returns null, `onError` is called with `reason: "parse_failed"`
- **Schema mismatches** — stored version ≠ expected version, snapshot is wiped, `onError` is called
- **Invalid metadata** — structural guard fails, `onError` is called
- **Storage exceptions** — caught at the outer boundary, `onError` is called

The store always returns `null` and falls back to `initialData`. The caller decides what to do with the error — usually telemetry or dev logging.

BroadcastChannel transport follows the same pattern: try-catch around every boundary, errors routed to `onError`, sync degrades to a no-op if the channel isn't available.

## Cache validation

The coordinator validates cached renderers before using them:

- **Manifest consistency** — if the manifest's `file` field doesn't contain its `hash`, the manifest is considered corrupt and is deleted from the cache
- **Orphaned manifests** — if a manifest exists in cache but its referenced JS file doesn't, the manifest is cleaned up
- **Load validation** — renderer modules are loaded and structurally checked before being mounted

These checks are defensive. They catch corruption that shouldn't exist if the delivery pipeline did its job, but caches can be cleared or corrupted by the browser. The pattern is: check, log, clean up, fall back to the bundled renderer.

## Utility patterns

### safeJsonParse

Returns `null` instead of throwing on malformed input:

```typescript
export function safeJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}
```

Used wherever localStorage values are read — because localStorage content can be corrupted, manually edited, or left over from a previous schema version.

### Numeric safety

Math operations guard against `NaN` and `Infinity`:

```typescript
const updatedAt = Date.parse(payload.updatedAt)
if (Number.isNaN(updatedAt)) return true
```

Division operations use `Number.isFinite()` checks before proceeding. The pattern is: validate inputs at the boundary, don't assume downstream math is safe.

### Buffered logger

`createBufferedLogger` provides leveled, colored console output with optional buffering:

```typescript
const logger = createBufferedLogger({
  prefix: "Coordinator: Data",
  groupLabel: "HNT Data Lifecycle",
  shouldBuffer: false,
})

logger.warn("background fetch failed", res.status)
```

Logging is the primary error-handling output. When something goes wrong, the system logs enough context to diagnose the issue without blocking the user experience.

## Where we're headed

The foundation is solid — `onError` callbacks, contextual logging, graceful degradation. But there's more to build on top of it. Here's what we're working through:

- **React Error Boundaries.** Not in place yet. The data and coordinator layers handle most error paths today, but a declarative catch at the React level would add a safety net for component-level failures. We're evaluating where boundaries make the most sense — probably at route or feature boundaries, not per-component.
- **Structured error types.** Right now errors are plain objects or native `Error` instances. A lightweight error type system (codes, categories, structured context) would make the `onError` hooks more useful, especially once telemetry plugs in.
- **Telemetry pipeline.** The `onError` callback surface was designed with exactly this in mind — it's the integration point. The hooks exist; a production telemetry consumer is the next step.

## Things worth noticing

As the error handling story evolves, these are the patterns that keep things clean:

- **Context in every catch.** A bare `catch {}` makes debugging harder later. Including the what, where, and why in log output pays for itself.
- **Null returns over throws.** For read operations, returning null on failure and letting the caller decide is usually the right call. Throwing is reserved for the rare case where continuing would be dangerous.
- **Assertions at boundaries, not in loops.** Runtime guards (`if (!el) throw`) make sense at initialization. In render loops, they're noise.
- **Error routing consistency.** The synced stores route through `onError` callbacks. The plain stores (like `discover`) currently use `console.log`. Aligning these is on the list — the `onError` pattern is where we want everything to converge.

::: tip How to think about errors
- Could this have been caught at build time? → check [Gating](../architecture/gating.md)
- Can the system keep running if this fails? → graceful degradation is the default
- Is there enough context in the log to diagnose this later?
- Would a null return be cleaner than a throw here?
:::

## Related documentation

- [Gating](../architecture/gating.md) — build-time validation as the primary error prevention strategy
- [Mental model](../architecture/mental-model.md) — "runtime as a consumer" — does not repair
- [State management](./state-management.md) — onError callbacks, schema mismatch handling
- [Coordinator deep-dive](../architecture/coordinator.md) — SWR failure modes, cache validation
- [Glossary](../spec/glossary.md) — Gating, Determinism, SWR definitions
