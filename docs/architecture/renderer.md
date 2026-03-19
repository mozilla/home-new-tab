# Renderer

The renderer is the user experience layer of the system.

It is responsible for taking prepared data and producing a complete, self-contained UI.

If the coordinator is the control plane at runtime, the renderer is the output.

## What the renderer does

At a high level, the renderer is responsible for:

- rendering the user interface
- consuming coordinated data
- presenting a complete experience to the user

It is the part of the system that directly affects what the user sees and interacts with.

## What the renderer is

The renderer is not assembled at runtime.

It is:

- built ahead of time
- validated through the delivery pipeline
- packaged as a deployable artifact
- loaded by the coordinator at runtime

This allows the renderer to evolve independently of the coordinator and the browser release cycle.

## Where it lives

In this repository, the renderer is:

- developed as a standalone application
- bundled and prepared for delivery
- exercised locally through the coordinator

In production, the renderer is:

- delivered through a remote configuration system
- consumed by the browser-side coordinator
- updated independently of browser releases

The implementation here represents the source of truth for the renderer artifact.

## The renderer as a boundary

The renderer sits on the other side of the coordinator boundary.

It receives:

- prepared data from the coordinator
- a runtime environment that is expected to be valid

It does not control:

- how data is fetched
- when data is updated
- which renderer is selected

This separation allows the renderer to remain focused on the user experience.

## Data expectations

The renderer assumes that:

- required data is available when rendering begins
- data has been passed through from upstream (the coordinator is a passthrough, not a transformation layer)
- privacy-sensitive data has been sanitized by the coordinator before handoff
- data contracts are stable and explicit

The renderer is where all business logic lives. It interprets, transforms, and applies domain-specific rules to the data it receives. The coordinator delivers data; the renderer decides what it means.

That focus works because:

- data is expected to be complete when it arrives — reaching back upstream would blur boundaries
- invalid data represents a gap earlier in the system, not something the renderer repairs
- data contracts are explicit, so the renderer doesn't need to guess at shape

## Runtime expectations

The renderer assumes that:

- it is being loaded intentionally by the coordinator
- its artifacts are complete and valid
- required assets (JS, CSS, localization) are present

Validating delivery artifacts, handling partial bundle states, and inferring missing runtime guarantees — those are the delivery pipeline's and coordinator's jobs. The renderer gets to assume its artifacts are ready.

## What belongs elsewhere

A few concerns that live outside the renderer, by design:

- data fetching and caching logic → [coordinator](./coordinator.md)
- update strategies like stale-while-revalidate → [coordinator](./coordinator.md)
- environment-specific logic → host
- implicit contracts or hidden behavior → explicit contracts in [spec/](../spec/snapshot-contract.md)

If these start appearing in the renderer, that's a useful signal that boundaries may be drifting.

## Renderer lifecycle (at a glance)

At runtime, the renderer lifecycle is simple:

1. The coordinator selects a renderer
2. The renderer is loaded
3. Coordinated data is provided
4. The renderer renders the experience

This simplicity is intentional.

Complexity is handled earlier in the system so that rendering can remain predictable.

For the full API-level lifecycle — including the `init`, `mount`, `update`, and `unmount` contract, the three-actor responsibility model, and guardrails for each actor — see:

→ [Lifecycle contract (renderer API, host responsibilities, and guardrails)](../spec/lifecycle-contract.md)

## Relationship to the delivery pipeline

The renderer is produced by the delivery pipeline.

That pipeline is responsible for:

- assembling artifacts
- validating correctness
- producing deployable outputs

By the time the renderer reaches runtime, it is expected to be:

- complete
- valid
- ready to execute

For more detail:

- [Build system (how renderer artifacts are assembled)](./build-system.md)
- [Publish pipeline (how renderer artifacts are delivered)](./publish-pipeline.md)

## Relationship to the coordinator

The renderer depends on the coordinator for:

- data
- lifecycle control (when it is loaded or replaced)

The coordinator depends on the renderer for:

- producing the user experience

This relationship is intentionally asymmetric.

The renderer consumes. The coordinator controls.

## Local development vs production

The renderer is the primary production artifact shipped from this repo. Locally it is loaded by the reference coordinator; in production it is delivered via the publish pipeline and loaded by browser core. The contract remains the same. For the full ownership map, see [Architecture overview](./overview.md#local-vs-production-ownership).

::: tip How to reason about the renderer
- Is this purely about the user experience?
- Does this rely on data being prepared upstream?
- Is this introducing coordination logic that belongs elsewhere?
- Is this behavior explicit and predictable?

If those answers are clear, the renderer is likely staying within its intended role.
:::

## Related documentation

- [Mental model (how the system thinks)](./mental-model.md)
- [Architecture overview (how the pieces fit together)](./overview.md)
- [Data flow (how information moves through the system)](./data-flow.md)
- [Coordinator (integration, caching, and control)](./coordinator.md)
- Contracts:
  - [Snapshot contract](../spec/snapshot-contract.md)
  - [Artifact model](../spec/artifact-model.md)
  - [Identity model](../spec/identity-model.md)
  - [Validation rules](../spec/validation-rules.md)
  - [Lifecycle contract](../spec/lifecycle-contract.md)
