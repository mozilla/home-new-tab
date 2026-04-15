# API Surfaces

A catalog of the exported interfaces across the monorepo.

Use this to find function signatures, type definitions, and understand what each package exposes. For the deeper "why" behind each surface, follow the links to the relevant system docs.

## API Client (`clients/api`)

Local development proxy built on Hono. Not a production service — it models the shape of upstream data.

| Route | Method | Purpose |
|-------|--------|---------|
| `/mock` | GET | Mock data with simulated 2s latency |
| `/discover` | GET → POST proxy | Curated content feed from external discover service |
| `/weather/weather-report` | GET → GET proxy | Weather conditions from external weather service |

**Environment variables:** `DISCOVER_ENDPOINT`, `WEATHER_ENDPOINT` (configured in `clients/api/.env`).

See [Architecture overview](../architecture/overview.md) for why this isn't a production service.

## Coordinator (`clients/coordinator`)

Reference implementation of the coordinator role. In production, this behavior moves to browser core.

### Boot flow (`main.ts`)

| Function | Purpose |
|----------|---------|
| `boot()` | Entry point — resolves renderer + data, mounts renderer |

### Renderer cache (`renderer-cache.ts`)

| Function | Purpose |
|----------|---------|
| `resolveRenderers()` | Returns `{ cached?, bundled }` — best available renderer and bundled fallback |
| `mountRendererFromUrl(url, options)` | Loads renderer JS and mounts into DOM |
| `fetchRemoteManifest()` | Fetches latest manifest from remote (no-store) |
| `validateRendererModule(url)` | Loads renderer without mounting — structural validation |
| `cacheRenderer(manifest, assetsBase)` | Writes manifest + JS + CSS to Cache API |
| `getCachedRenderer()` | Reads and validates cached renderer from Cache API |

### Data cache (`data-cache.ts`)

| Function | Purpose |
|----------|---------|
| `getOrFetchSchema(manifest)` | Fetches and caches the renderer's data-schema artifact |
| `getDataPayload()` | Reads cached `CoordinatedPayload` from Cache API |
| `shouldDataUpdate(payload)` | Returns `true` if age > `DATA_TTL_MS` (background refresh threshold) |
| `assembleBlockingData(schema, browserCore)` | Fetches all blocking sources; returns initial data + source statuses |
| `deliverDeferredSources(schema, keys, deliver)` | Fires deferred (Merino) fetches post-mount; calls `deliver` as each resolves |
| `warmStaleCaches(schema, keys)` | Silently refetches stale sources in the background; no update pushed |
| `refreshCacheForNextSession(schema, browserCore)` | SWR refresh — writes fresh snapshot to cache for next load |

See [Coordinator deep-dive](../architecture/coordinator.md) for the full SWR lifecycle.

## Renderer (`clients/renderer`)

The production artifact. Registers itself on `globalThis.AppRenderer` as an IIFE bundle.

### RendererModule contract

```typescript
type RendererModule = {
  init?: (args: RendererInitArgs) => void | Promise<void>
  mount: (container: HTMLElement, props: AppProps) => void
  update?: (data: AppProps) => void
  unmount?: (container: HTMLElement) => void
  version?: string
}
```


| Method | Required | Purpose |
|--------|----------|---------|
| `init` | no | Runtime bootstrap: receives gating payload, message loading, error/metric reporting |
| `mount` | yes | Initial render into a DOM container |
| `update` | no | Re-render with new props (safe no-op if not mounted) |
| `unmount` | no | Teardown and cleanup |
| `version` | no | Build hash, replaced at build time |

### RendererInitArgs

```typescript
type RendererInitArgs = {
  gatingPayload: GatingPayload
} & RendererAdapters
```

Two concerns in one flat type: **data in** (`gatingPayload`) and **adapters out** (everything from `RendererAdapters`). The gating payload has two facets: **locale** (translation context) and **flags** (resolved feature flag state). See [Gating](../architecture/gating.md#the-gating-payload) and [Feature flags](../architecture/feature-flags.md).

`RendererAdapters` provides four host-provided capabilities: `getMessages` (Fluent message loading), `browserCore` (`BrowserCoreAdapter` — data reads and link/content actions), `storage` (`StorageAdapter` — persistent key-value), and `telemetry` (`TelemetryAdapter` — error and metric reporting). See [Lifecycle contract](./lifecycle-contract.md) for the full shape.

The renderer is loaded via classic `<script>` (IIFE). After evaluation, `globalThis.AppRenderer` must exist. Loading a newer renderer intentionally overwrites the previous one.

## Common Types (`@common/types`)

Shared type definitions used across all packages. Defined in `common/types/index.ts`.

### System types

| Type | Purpose |
|------|---------|
| `AppRenderManifest` | Renderer build metadata: version, buildTime, file, hash, dataSchemaVersion, cssFile, assetsBase, isCached |
| `AppProps` | Data passed to renderer mount/update: manifest, renderUpdate, isCached, isStaleData, nextHash, timeToStaleData, initialState |
| `RendererModule` | Renderer API contract: mount, update?, unmount?, version? |
| `BaselineRenderer` | Resolved renderer reference: manifest + jsUrl |
| `RendererMeta` | Cache metadata: active/latest with hash, version, savedAt |
| `CoordinatedData` | Per-source data struct: topSites, discovery, sponsored, weather, wallpapers, messages, widgets (all optional) |
| `CoordinatedPayload` | Envelope: schemaVersion, updatedAt, data? |
| `GatingPayload` | Two facets: locale (translation context) + flags (feature flag state) |
| `LocaleFacet` | Locale, availability (full/partial/none), completeness, l10nHash |
| `FlagsFacet` / `FlagState` | Resolved feature flag state with experiment metadata |
| `CoordinatorInterface` | Typed coordinator action interface: content, top sites, search, message lifecycle |
| `LinkTarget` | Link open target: current, new-tab, new-window, private |
| `ErrorReport` | Structured error: source, context, reason, severity, detail |
| `MetricReport` | Structured metric: source, name, value, unit, dimensions |
| `ReportSource` | Shared source union for error/metric reporting |
| `ValidationFailure` | Build gate failure: layer, rule, message, artifact, detail |
| `Message` / `MessageSurface` | Messaging data shape: id, surface, content |

### Content types

| Type | Purpose |
|------|---------|
| `DiscoverFeed` | Feed response: data, feeds, recommendedAt, surfaceId |
| `DiscoveryItem` | Individual content item: url, title, excerpt, publisher, imageUrl, topic |
| `FeedMeta` | Feed metadata: layout, recommendations, follow state |
| `Layout` / `ResponsiveLayout` / `Tile` | Grid layout definitions |
| `SponsoredData` / `SponsoredItem` | Sponsored content: domain, title, url, image, ranking, caps |

### Enum-style constants

| Constant | Values |
|----------|--------|
| `GridType` | `FLUID` |
| `TileSize` | `SMALL`, `MEDIUM`, `LARGE` |
| `PriorityType` | `LOW`, `MEDIUM`, `HIGH` |
| `TemperatureView` | `Simple`, `Detailed`, `Extreme` |
| `TemperatureUnit` | `Celsius`, `Fahrenheit`, `Kelvin` |

### Weather types

| Type | Purpose |
|------|---------|
| `WeatherData` | Weather response: cityName, currentConditions, forecast, provider |
| `Conditions` | Current weather: summary, iconId, temperature |
| `Forecast` | Future weather: summary, high/low temperatures |
| `Temperature` | `{ c: number, f: number }` |

## Common Utilities (`@common/utilities`)

Small, focused, framework-agnostic helpers. Each lives in its own subdirectory.

### Logger (`logger/`)

```typescript
createBufferedLogger(opts): Logger
```

| Option | Type | Purpose |
|--------|------|---------|
| `prefix` | `string` | Log line prefix |
| `groupLabel` | `string` | Console group label |
| `shouldBuffer` | `boolean` | Buffer output until `display()` is called |
| `colors` | `object` | Per-level console colors |
| `exposeGlobalAs` | `string` | Optional global reference for debugging |

Methods: `log()`, `info()`, `warn()`, `error()`, `display()`

### Values (`values/`)

| Function | Purpose |
|----------|---------|
| `safeJsonParse(raw)` | Returns parsed JSON or `null` — never throws |
| `isJsModulePath(path)` | Weak regex check for `.js` module paths |

### Versions (`versions/`)

| Function | Purpose |
|----------|---------|
| `compareVersions(a, b)` | Semver comparison: returns -1, 0, or 1 |
| `inRange(version, target)` | Checks major.minor compatibility |

### Time (`time/`)

| Function | Purpose |
|----------|---------|
| `getElapsedFromBaselines(...)` | Timer elapsed calculation from baseline timestamps |
| `formatMMSS(ms)` | Formats milliseconds as `MM:SS` |
| `safeRatio(a, b)` | Division with `isFinite` guard |
| `toISOCalendarDate(date)` | Formats as `YYYY-MM-DD` |

### Arrays (`arrays/`)

| Function | Purpose |
|----------|---------|
| `arrayToObject(arr, keyFn)` | Transforms array to keyed object |

### Coords (`coords/`)

| Function | Purpose |
|----------|---------|
| `polarToCartesian(cx, cy, r, angle)` | Polar to cartesian conversion (for ring rendering) |

## State System (`@data/state`)

| Export | Module | Purpose |
|--------|--------|---------|
| `createSyncedStore` | `_system/` | Cross-tab synced store factory |
| `useTimer` | `timer/` | Public hook for timer domain |
| `useDiscover` | `discover/` | Zustand hook for discover feed |
| `useSponsored` | `sponsored/` | Zustand hook for sponsored content |

See [State management](../patterns/state-management.md) for the full pattern documentation.

## Related documentation

- [Lifecycle contract](./lifecycle-contract.md) — renderer lifecycle details
- [Coordinator deep-dive](../architecture/coordinator.md) — coordinator behavior
- [Renderer deep-dive](../architecture/renderer.md) — renderer role
- [Glossary](./glossary.md) — term definitions
- [State management](../patterns/state-management.md) — store patterns
- [File map](./file-map.md) — where code lives
