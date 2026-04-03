# Coordinator

The coordinator is the integration layer of the system.

It sits between upstream data and the renderer, and is responsible for bringing them together into a usable experience.

If the system has a “control plane” at runtime, this is it.

## What the coordinator does

At a high level, the coordinator is responsible for:

- retrieving data from upstream sources
- managing cached data
- determining when and how to update that data
- selecting and loading a renderer
- providing data to the renderer in a predictable way

It does not define the user interface itself.

Instead, it creates the conditions under which the user interface can be rendered safely and consistently.

## Where it lives

In this repository, the coordinator is implemented as a reference system.

Its purpose here is to:

- define expected behavior
- exercise integration patterns
- validate contracts between data and rendering

In production, coordinator behavior will live within browser core.

What matters is not where it is implemented, but that it fulfills the same responsibilities and contracts.

## The coordinator as a boundary

The coordinator is an important boundary in the system.

It connects two distinct worlds:

- upstream data sources
- renderer artifacts

These inputs arrive independently:

- data is retrieved at runtime
- renderers are delivered through the pipeline as pre-built artifacts

The coordinator is responsible for combining them into a coherent experience.

This separation allows:

- data systems to evolve independently
- renderers to be updated without redeploying the coordinator
- runtime behavior to remain stable and predictable

## Data responsibilities

The coordinator owns runtime data handling.

This includes:

- fetching data from upstream sources
- sanitizing privacy-sensitive data before handoff to the renderer
- passing through safe endpoints as-is
- deciding when cached data can be used
- updating stale data in the background

What the coordinator does with data depends on the source. Some data passes through as-is, some is sanitized for privacy, and some is combined from multiple inputs. The coordinator prepares data for the renderer, but domain-specific interpretation and business logic live in the renderer.

Some sources return pre-shaped responses that already conform to the contract type. The coordinator casts and passes them through without reshaping. Others return raw records that need field mapping and URL preparation at the coordinator boundary. That shaping is a trust-boundary concern, not a business rule.

Some `CoordinatedData` fields draw from multiple independent sources. When they do, each source is fetched separately and surfaced as its own named field. The coordinator does not pre-combine, rank, or deduplicate them. Assembly belongs to the renderer. This is the [sub-source](../spec/glossary.md#behaviors-and-patterns) pattern.

The primary update pattern is stale-while-revalidate (SWR):

- use cached data immediately when available
- fetch updated data in the background
- provide fresh data on next render cycle

Caching operates at two levels. Each source maintains its own cache with its own TTL, which controls how often that source is re-fetched. The assembled `CoordinatedData` payload has a separate cache that SWR operates against for the renderer handoff. Sources backed by Remote Settings rely on RS's own caching and carry no coordinator-level TTL.

The coordinator determines when these transitions occur.

The lifecycle `update()` method exists specifically for deferred or fragmented data that arrives after initial render. It is not the primary data path. Core data arrives via SWR at mount time.

## Data source model

Each data source is an independent module responsible for fetching from one upstream system, managing its own cache, and returning a typed result or null on failure.

Sources do not share cache state or coordinate with each other. The coordinator assembles them in parallel and writes the combined result as the coordinated payload. If one source fails, the rest proceed unaffected.

## Renderer responsibilities

The coordinator does not build renderers.

It consumes them.

Specifically, it is responsible for:

- determining which renderer to use
- loading the renderer artifact
- coordinating when to switch to a newer renderer
- calling `init()` before `mount()`, providing the renderer's full runtime context

Renderers are assumed to be valid by the time they reach the coordinator.

Validation and correctness are handled earlier in the delivery pipeline.

### Providing runtime context

Before mounting, the coordinator calls `init()` with a `RendererInitArgs` that carries two things: data in and callbacks out.

**Data in** is the [gating payload](./gating.md#the-gating-payload): locale context and resolved feature flag state. The coordinator assembles this from the locale resolution and external flag service, then passes it through. It does not evaluate flags or make feature-level decisions.

**Callbacks out** are the [coordinator interface](../spec/lifecycle-contract.md#coordinator-interface): every function the renderer can call back to the coordinator. This includes l10n message loading, error and metric reporting, content actions (block, bookmark, delete history, open link), top sites management, search handoff, and [message lifecycle events](./messaging.md#lifecycle-events). The coordinator routes each callback to the appropriate platform API.

The coordinator provides these capabilities. It does not dictate how the renderer uses them. See the [lifecycle contract](../spec/lifecycle-contract.md) for the full responsibility model.

## Runtime behavior

At runtime, the coordinator is expected to be predictable and minimal.

It should:

- avoid complex inference
- avoid repairing invalid inputs
- rely on upstream guarantees where possible

If something is invalid, it should have been caught before reaching this layer.

This keeps runtime behavior:

- easier to reason about
- easier to test
- less prone to edge-case failures

## Relationship to the delivery pipeline

The coordinator depends on the output of the renderer delivery pipeline.

It does not:

- assemble renderer artifacts
- validate artifact correctness
- interpret partially valid states

Instead, it consumes artifacts that are already:

- complete
- validated
- ready for use

For more detail:

- [Build system (how artifacts are assembled)](./build-system.md)
- [Publish pipeline (how artifacts are delivered to runtime)](./publish-pipeline.md)

## Local development vs production

In this repository, the coordinator is a TypeScript reference implementation. In production, this behavior moves to browser core. The contracts remain the same. For the full ownership map, see [Architecture overview](./overview.md#local-vs-production-ownership).

## How to reason about the coordinator

The coordinator ships with browser core. Any logic placed there can only change when browser core ships. That's a slow release cycle, not owned by this repo.

Two questions help decide what belongs in the coordinator versus the renderer:

- **Is this logic stable?** Fetch, cache, and transport concerns change rarely and warrant that cost. Business rules, ranking, and display logic evolve as the product does — they belong in the renderer, where they can ship independently.
- **Does this encode an upstream shape?** Logic that encodes specific field names or response structures from external APIs creates a ship-to-fix dependency when those APIs drift. Coordinator logic should work to contracts, not to shapes.

If either answer is "no," it probably belongs in the renderer.

::: tip What belongs elsewhere

A few concerns that live outside the coordinator, by design:

- UI logic → [renderer](./renderer.md)
- business rules, ranking, display logic → [renderer](./renderer.md)
- multi-source assembly (dedup, scoring, ordering) → [renderer](./renderer.md)
- implicit data contracts → explicit contracts in [spec/](../spec/snapshot-contract.md)
- build-time or publish-time validation → [build system](./build-system.md), [publish pipeline](./publish-pipeline.md)

If these start appearing in the coordinator, that's a useful signal that boundaries may be drifting.
:::

## Related documentation

- [Mental model](./mental-model.md) — how the system thinks
- [Architecture overview](./overview.md) — how the pieces fit together
- [Data flow](./data-flow.md) — how information moves through the system
- [Renderer](./renderer.md) — how the user experience is built and delivered
- Contracts:
  - [Snapshot contract](../spec/snapshot-contract.md)
  - [Artifact model](../spec/artifact-model.md)
  - [Identity model](../spec/identity-model.md)
  - [Validation rules](../spec/validation-rules.md)
  - [Lifecycle contract](../spec/lifecycle-contract.md)
