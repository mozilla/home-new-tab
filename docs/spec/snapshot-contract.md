# Snapshot Contract

This document defines the high-level contract for a renderer snapshot.

A snapshot is the unit the system relies on when delivering a renderer to runtime.

It is not a loose collection of assets. It is a complete, validated, and identifiable unit that the coordinator can safely consume.

## Why this contract exists

The system depends on a clear separation of responsibilities:

- the delivery pipeline is responsible for producing valid snapshots
- the coordinator is responsible for consuming valid snapshots
- the renderer is responsible for executing as a valid snapshot

That only works if “valid snapshot” has a precise meaning.

This contract defines that meaning.

## What a snapshot is

A snapshot is a complete renderer delivery unit.

At a minimum, it represents:

- a specific renderer build
- the artifacts required to execute that renderer
- a stable identity that distinguishes it from other snapshots
- a shape that can be consumed predictably by runtime

A snapshot is treated as a single unit for delivery and consumption.

If part of it changes in a way that matters to runtime, the snapshot itself has changed.

## What a snapshot is not

A snapshot is not:

- a best-effort collection of assets
- a partially valid bundle
- a runtime-assembled structure
- a thing the coordinator is expected to repair or complete

If a snapshot is incomplete or invalid, it should be rejected before it reaches runtime.

## Core guarantees

For a snapshot to be considered valid, it must satisfy a small set of core guarantees.

### 1. Completeness

A snapshot must include all artifacts required for runtime use.

Runtime should not need to infer missing pieces or tolerate absent required assets.

### 2. Validity

A snapshot must satisfy all structural and policy rules defined by the delivery pipeline.

It must not be published in a partially valid state.

### 3. Stable identity

A snapshot must have a deterministic identity derived from meaningful inputs.

That identity allows the system to distinguish:

- the same snapshot seen again
- a genuinely new snapshot
- a change that requires runtime action

### 4. Predictable consumption

A snapshot must be shaped so the coordinator can consume it without interpretation, repair, or guesswork.

If runtime behavior depends on a property, that property should be explicit in the snapshot contract.

## Responsibility boundaries

The snapshot contract exists across multiple parts of the system.

### Delivery pipeline responsibilities

The delivery pipeline is responsible for:

- assembling snapshot artifacts
- validating the snapshot
- rejecting invalid snapshots
- publishing only snapshots that satisfy contract rules

### Coordinator responsibilities

The coordinator is responsible for:

- retrieving published snapshots
- determining whether a snapshot is new or unchanged
- loading a valid snapshot for runtime use

The coordinator is not responsible for validating snapshot correctness beyond the assumptions the contract gives it.

### Renderer responsibilities

The renderer is responsible for being executable as a valid snapshot once loaded.

It does not define the contract, but it must conform to it.

## Snapshot change model

A snapshot should be treated as changed when contract-relevant inputs change.

That includes changes to:

- required runtime artifacts
- identity-bearing inputs
- any property that affects safe runtime consumption

This matters because the system depends on being able to answer a simple question clearly:

> Is this the same snapshot, or a different one?

The answer must be deterministic.

## Contract shape vs implementation detail

This document defines the high-level contract, not the exact implementation model.

More specific contract details are defined in companion documents:

- [Artifact model (what artifacts a snapshot contains)](./artifact-model.md)
- [Identity model (how snapshot identity is derived)](./identity-model.md)
- [Validation rules (how contract compliance is enforced)](./validation-rules.md)

## Relationship to build and publish systems

The snapshot contract tells build and publish systems what must be true.

It does not describe every step of how they achieve that.

Those implementation details belong in:

- [Build system (how snapshots are assembled)](../architecture/build-system.md)
- [Publish pipeline (how valid snapshots are exposed to runtime)](../architecture/publish-pipeline.md)

## Relationship to runtime

Runtime depends on the snapshot contract, but does not define it.

The coordinator should be able to assume that any published snapshot:

- is complete
- is valid
- has a stable identity
- is ready to load

That is the central payoff of the contract.

It keeps runtime small, predictable, and boring.

::: details Open edges to refine

This high-level contract intentionally leaves some details to be tightened in supporting docs.

These include:

- which artifacts are required vs optional
- how localization resources participate in snapshot completeness
- which inputs contribute to snapshot identity
- which validation failures are structural vs policy-driven

Those details should refine this contract, not contradict it.
:::

## Related documentation

- [Mental model (how the system thinks)](../architecture/mental-model.md)
- [Architecture overview (how the pieces fit together)](../architecture/overview.md)
- [Data flow (how information moves through the system)](../architecture/data-flow.md)
- [Coordinator (integration, caching, and control)](../architecture/coordinator.md)
- [Renderer (how the user experience is built and delivered)](../architecture/renderer.md)
