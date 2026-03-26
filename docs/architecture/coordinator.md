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

The primary update pattern is stale-while-revalidate (SWR):

- use cached data immediately when available
- fetch updated data in the background
- provide fresh data on next render cycle

The coordinator determines when these transitions occur.

The lifecycle `update()` method exists specifically for deferred or fragmented data that arrives after initial render — it is not the primary data path. Core data arrives via SWR at mount time.

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

**Callbacks out** are the [host callbacks](../spec/lifecycle-contract.md#host-callbacks): every function the renderer can call back to the host. This includes l10n message loading, error and metric reporting, content actions (block, bookmark, delete history, open link), top sites management, search handoff, and [message lifecycle events](./messaging.md#lifecycle-events). The coordinator routes each callback to the appropriate platform API.

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

In this repository, the coordinator is a TypeScript reference implementation. In production, this behavior moves to browser core — but the contracts remain the same. For the full ownership map, see [Architecture overview](./overview.md#local-vs-production-ownership).

## What belongs elsewhere

A few concerns that live outside the coordinator, by design:

- UI logic → [renderer](./renderer.md)
- renderer-specific behavior → [renderer](./renderer.md)
- implicit data contracts → explicit contracts in [spec/](../spec/snapshot-contract.md)
- build-time or publish-time validation → [build system](./build-system.md), [publish pipeline](./publish-pipeline.md)
- business logic → [renderer](./renderer.md)

If these start appearing in the coordinator, that's a useful signal that boundaries may be drifting.

::: tip How to reason about the coordinator

- Is this responsibility clearly part of runtime coordination?
- Should this be enforced earlier in the pipeline?
- Is this behavior predictable and explicit?
- Does this introduce coupling between data and rendering?

If those questions have clear answers, the coordinator is likely staying within its intended role.
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
