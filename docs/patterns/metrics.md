# Metrics

::: info Not yet in code
This contract is defined but not yet implemented. Current code does not report metrics. The `reportMetric` capability does not yet exist in `init()`.
:::

Metrics measure runtime behavior: timing, counts, cache utilization, translation completeness. They answer "how is the system performing?" rather than "what went wrong?"

Metric reporting is a host-provided capability received through [`init()`](../spec/lifecycle-contract.md). The renderer reports measurements. The host decides where they go. In development, that might be console output. In production, the coordinator routes to its metrics system.

## `reportMetric`

```typescript
reportMetric({
  source: "coordinator",              // subsystem: "state", "coordinator", "renderer", "l10n"
  name: "background_fetch_duration",  // what's being measured
  value: 142,                         // the measurement
  unit: "ms",                         // "ms", "count", "ratio"
  dimensions: {                       // slicing context (optional)
    key: "weather",
    cacheHit: "false",
  },
})
```

Fire-and-forget — the renderer does not wait for a response.

## MetricReport shape

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `source` | `string` | Yes | Subsystem: `"state"`, `"coordinator"`, `"renderer"`, `"l10n"` |
| `name` | `string` | Yes | What's being measured: `"time_to_first_paint"`, `"cache_hit"` |
| `value` | `number` | Yes | The measurement |
| `unit` | `string` | Yes | `"ms"`, `"count"`, `"ratio"` |
| `dimensions` | `Record<string, string>` | No | Slicing context: `{ locale: "fr", availability: "partial" }` |

## What to measure

Metrics should answer questions the system needs answered. Not everything that can be counted should be.

**Timing** — how long did something take?
- Time to first paint
- Background fetch duration
- Translation load time (getMessages)
- init() → mount() duration

**Counts** — how often does something happen?
- Cache hits vs misses
- SWR refresh cycles

**Ratios** — what's the proportion?
- Translation completeness for a locale
- Cache utilization

## Dimensions

Dimensions slice metrics for analysis. They answer "for what?", not just "background fetch took 142ms" but "background fetch for weather, cache miss, took 142ms."

Keep dimensions to what's useful for filtering:
- `key` — which data key (weather, topics, etc.)
- `locale` — which locale
- `availability` — Full/Partial/None
- `cacheHit` — whether the cache was used

Avoid high-cardinality dimensions (user IDs, timestamps, unique values). They explode storage without adding analytical value.

## Boundary convention

Measure at boundaries, not inside business logic.

Good boundaries for metrics:
- **Fetch completion** — timing and success/failure
- **Cache operations** — hit, miss, eviction
- **Lifecycle hooks** — init duration, mount duration
- **Translation loading** — getMessages timing per locale

Not boundaries:
- Inside render functions
- Per-component timing (unless you're profiling a specific problem)
- State derivation

If you find yourself adding `reportMetric` inside a loop or a computed selector, the measurement should probably be at the boundary that drives the loop.

## Related documentation

- [Lifecycle contract](../spec/lifecycle-contract.md) — `reportMetric` as an init() capability
- [Gating](../architecture/gating.md) — exposure gates use metrics context (locale completeness)
