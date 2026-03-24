# Lifecycle Contract

This document defines the lifecycle and responsibility boundaries between the **renderer**, the **artifact loader**, and the **host** that runs the renderer.

The goal is to make the renderer a **managed UI payload** that can run under multiple environments while maintaining a stable and predictable contract.

Environments such as local development, coordinators, Storybook, and test harnesses can all act as **hosts** as long as they satisfy the same lifecycle. In production, the coordinator is the host.


## Core Principle

::: danger Renderer receives — it does not construct
The renderer **receives its runtime configuration from the host via `init(...)`**.

It does not:

- invent runtime configuration
- fetch bootstrap dependencies on its own
- assume environment defaults

The host supplies everything the renderer needs to run.
:::

This is what makes the renderer portable, deterministic, and testable across environments.


## Lifecycle Model

::: info Not yet in code
The `init()` method is defined in this contract but does not yet exist in code. The `RendererModule` type needs `init`, and `RendererInitArgs` needs to be defined with gating payload, message loading, and error/metric reporting capabilities.
:::

All hosts follow the same lifecycle when running the renderer.

1. Obtain a renderer module
2. Prepare runtime/bootstrap configuration
3. Call `init(...)`
4. Call `mount(...)`
5. Call `update(...)` as render payload changes
6. Call `unmount(...)` on teardown

This lifecycle intentionally separates:

- **runtime/bootstrap configuration** (long-lived, provided via `init`)
- **render payload** (per-render data, provided via `mount` and `update`)


## Runtime vs Render Inputs

Hosts supply two categories of input.

### Runtime / Bootstrap Input

Provided through `init(...)`.

Examples:

- **gating payload** — a single structured object with two facets, passed through from the coordinator. The **locale** facet provides translation context (availability state Full/Partial/None, completeness metadata). The **flags** facet provides resolved feature flag state for feature-level exposure decisions, encompassing rollout, market targeting, and experiment metadata. See [Gating](../architecture/gating.md#the-gating-payload) and [Feature flags](../architecture/feature-flags.md).
- **message loading** — `getMessages` function for loading FTL translations. See [Localization](../architecture/l10n.md#message-loading-capability).
- **error reporting** — `reportError` function for reporting failures with structured context (source, reason, severity). See [Error handling](../patterns/error-handling.md#error-reporting-contract).
- **metric reporting** — `reportMetric` function for reporting measurements (timing, counts, ratios). See [Metrics](../patterns/metrics.md).

These values define the **runtime environment** of the renderer and are expected to remain relatively stable during the lifetime of the renderer instance.

### Render Payload Input

Provided through `mount(...)` and `update(...)`.

Examples:

- application state
- coordinated data payloads
- view-level data

These values represent the **current UI state** that the renderer should display.


## Responsibility Map

### Renderer Module

The renderer is a **managed UI payload** responsible only for rendering UI using host-provided inputs.

#### Owns

- Public lifecycle surface:
  - `init(...)`
  - `mount(...)`
  - `update(...)`
  - `unmount(...)`
- Internal runtime state created from `init(...)`
- Internal instance state created from `mount(...)`
- Rendering UI from runtime state and render payload

#### Responsibilities

- Accept runtime configuration from the host
- Prepare internal runtime services (for example localization)
- Render UI from runtime state and payload
- Re-render when the host provides updated payload

#### Does Not Own

- Network requests
- Cache API usage
- Renderer artifact discovery
- Public URL construction
- Environment detection
- Manifest resolution
- Runtime defaults

#### Design Boundaries

- `mount(...)` works with the runtime configuration it was given — it doesn't construct what's missing.
- `update(...)` handles render payload changes — it doesn't perform bootstrap initialization.
- The UI layer stays focused on rendering — it doesn't become a bootstrap assembly point.


### Artifact Loader

The artifact loader prepares renderer artifacts for execution.

It is responsible for ensuring renderer code and assets are available but does **not** run the renderer.

This role exists to support renderer portability: environments without a full coordinator (dev servers, Storybook, test harnesses) can use the artifact loader to prepare renderer artifacts without taking on host orchestration concerns.

#### Owns

- Renderer JS loading
- Renderer CSS insertion
- Script loading deduplication
- Basic renderer module validation

#### Responsibilities

- Load renderer script
- Ensure renderer CSS is available
- Validate renderer module contract
- Return a usable renderer module reference

#### Does Not Own

- Runtime bootstrap configuration
- Coordinated data resolution
- Lifecycle orchestration
- Render payload construction

#### Boundary

The artifact loader stops at:

> "The renderer module is available and ready to be driven."

It does **not** mount the renderer.


### Host

A host is responsible for providing the runtime environment and orchestrating the renderer lifecycle.

Different environments may implement this role. In production, the coordinator is the host. In local development and Storybook, a development harness serves this role.

#### Owns

- Selecting a renderer artifact
- Providing runtime bootstrap configuration
- Providing initial render payload
- Driving the renderer lifecycle

#### Responsibilities

- Obtain a renderer module via the artifact loader
- Build runtime configuration (`RendererInitArgs`)
- Call `init(...)`
- Call `mount(...)`
- Call `update(...)` when payload changes
- Call `unmount(...)` when the renderer should be removed

#### Does Not Own

- Renderer internal logic
- UI rendering behavior
- Internal runtime service implementations

#### Mental Model

The host **orchestrates** the renderer but does not implement the renderer.


## Guardrails

These boundaries keep each actor focused on what it does well.

### Renderer

The renderer stays focused on rendering. These concerns belong to the host:

- fetching runtime dependencies from network endpoints
- reading manifest URLs
- accessing cache storage
- detecting environment modes
- constructing fallback runtime configuration

The host supplies everything the renderer needs. That's the deal.

### Artifact Loader

The artifact loader prepares artifacts — it stops there. These concerns belong elsewhere:

- resolving coordinated application data
- constructing runtime bootstrap configuration
- controlling renderer lifecycle
- deciding when the renderer should mount or update

### Host

The host is responsible for:

- providing runtime configuration explicitly
- driving the renderer lifecycle
- deciding when to reload, patch, or update the renderer
- supplying environment-specific defaults

Bootstrap responsibilities stay with the host. The renderer receives them — it doesn't construct them.


## Optional Runtime Capabilities

Some runtime capabilities may be optional.

Examples include:

- `reportError` and `reportMetric` (a test harness may not supply them — the renderer handles absence gracefully)
- individual facets of the gating payload (a host may not supply all facets)

When optional capabilities are omitted:

- the renderer handles their absence gracefully
- the renderer doesn't fabricate fallback implementations on its own

Optional means:

> the host chose not to supply this capability

not:

> the renderer should silently invent one


## Design Goal

The renderer contract should allow **any host** to run the renderer consistently.

As long as a host can provide:

- runtime/bootstrap configuration
- render payload
- lifecycle orchestration

the renderer should operate correctly without modification.


## Guiding Principle

The renderer is a **pure rendering payload**.

The artifact loader provides the executable renderer.

The host defines the runtime environment and lifecycle.

Keeping these responsibilities separate ensures the system remains portable, predictable, and easy to reason about.


## Related Documentation

- [Snapshot contract](./snapshot-contract.md) — what a renderer delivery unit must satisfy
- [Renderer](../architecture/renderer.md) — how the user experience is built and delivered
- [Coordinator](../architecture/coordinator.md) — integration, caching, and control
- [Architecture overview](../architecture/overview.md) — how the pieces fit together
