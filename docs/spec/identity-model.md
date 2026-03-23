# Identity Model

This document defines how snapshot identity is derived and used.

Identity is how the system determines whether two snapshots are the same or different.

This decision directly affects:

- whether the coordinator reloads a renderer
- whether cached artifacts can be reused
- how updates are applied at runtime

Because of this, identity must be deterministic and meaningful.

## Why identity matters

At runtime, the system needs to answer a simple question:

> Is this the same snapshot, or a different one?

If that answer is ambiguous, the system becomes unpredictable.

- Updates may not apply when they should
- Unnecessary reloads may occur
- Compatibility issues may go undetected

A clear identity model avoids these problems.

## Core principle

Snapshot identity must be derived from contract-relevant inputs.

If something affects how a snapshot behaves at runtime, it should be reflected in identity.

If something does not affect runtime behavior, it should not.

This keeps identity aligned with what actually matters.

## Deterministic identity

Identity must be deterministic.

Given the same inputs, identity must always resolve to the same value.

This means identity must not depend on:

- build timing
- file ordering
- non-deterministic metadata
- environment-specific differences

If two snapshots are functionally identical, they must have the same identity.

## Identity as a snapshot-level concept

Identity is defined at the snapshot level.

A snapshot has a single identity that represents the entire unit.

Even though a snapshot is composed of multiple artifacts, runtime decisions are made at the snapshot level:

- load or do not load
- update or do not update

This keeps runtime logic simple.

## Identity inputs

Identity should be derived from a stable set of inputs.

At a high level, these include:

- execution artifacts (e.g. JavaScript)
- presentation artifacts when they affect runtime behavior (e.g. CSS)
- content artifacts when they affect runtime behavior (e.g. localization resources)

If a change to an artifact would require the coordinator to treat the snapshot as different, that artifact should participate in identity.

## Identity and artifact roles

Not all artifacts need to participate equally in identity.

The artifact model defines which artifacts are:

- contract-relevant
- required for completeness

The identity model builds on that by defining which of those artifacts:

- must contribute to identity
- may contribute to identity conditionally

The current rules:

- execution artifacts are always identity-bearing
- presentation artifacts are always identity-bearing (CSS is universally required)
- baseline localization artifacts (en-US FTL) are always identity-bearing

These rules should be explicit and consistent.

## Identity and localization

Baseline FTL (en-US) is identity-bearing. Non-baseline translations are not.

Snapshot identity is derived from three inputs:

- JavaScript content hash
- CSS content hash
- Baseline FTL key-set hash (`l10nHash`)

A change to any of these produces a new snapshot identity. Note that `l10nHash` is derived from the sorted set of message IDs, not the full FTL content. English text changes to existing keys do not produce a new identity. See [Localization](../architecture/l10n.md#why-key-set-hashing) for the rationale.

### Why baseline is identity-bearing

Baseline FTL changes are semantically meaningful to the snapshot:

- a new key means the renderer now says something it did not before
- a removed key means content no longer exists
- a text change means the default content is different

If baseline FTL changed but identity did not, the coordinator might reuse a cached snapshot whose content no longer matches. This would silently break content correctness.

### Why translations are not identity-bearing

Non-baseline translations are produced externally and delivered through a separate channel. They do not change what the renderer is — they change what is available for users of a specific locale. Including them in identity would mean the snapshot changes every time a translation completes, which defeats the purpose of snapshot-level identity.

### `l10nHash` as a sub-identity

`l10nHash` serves a dual purpose:

1. It feeds into the snapshot-level identity (alongside JS and CSS hashes)
2. It independently identifies the key set that translations are produced against

Translations are keyed to `l10nHash`, not `snapshotHash`. This means existing translations remain valid across JS/CSS-only snapshot changes, and only require re-translation when baseline FTL content changes.

For the full localization pipeline, see [Localization (system deep-dive)](../architecture/l10n.md).

## Identity and compatibility

Identity and compatibility are related but not identical.

- identity answers: “is this the same snapshot?”
- compatibility answers: “can this snapshot safely run in this environment?”

A system may choose to:

- treat incompatible changes as identity changes
- or track compatibility separately from identity

What matters is that identity alone should not hide incompatible changes.

## Identity and versioning

Identity may be represented as:

- a hash derived from inputs
- a version identifier
- or a combination of both

The exact representation is less important than the guarantees:

- it is stable
- it is deterministic
- it reflects meaningful change

Versioning can be layered on top of identity, but identity should not depend on manually assigned version numbers.

## Identity and runtime behavior

The coordinator uses identity to make decisions such as:

- whether to load a new renderer
- whether a cached renderer can be reused
- whether a change should trigger an update

This means identity must be:

- cheap to compare
- easy to reason about
- consistent across environments

The coordinator should not need to inspect artifact contents directly to determine whether something changed.

## What identity should not do

To keep identity useful and predictable, it should avoid:

- including non-contract artifacts
- depending on unstable inputs
- encoding implementation-specific details
- hiding meaningful changes behind “compatible” assumptions

If identity becomes difficult to reason about, it will introduce subtle bugs.

## Relationship to artifact model

The artifact model defines what a snapshot contains.

The identity model defines how those contents contribute to change detection.

If an artifact is:

- required for completeness
- relevant to runtime behavior

then it should be considered when defining identity.

For more detail:

- [Artifact model (how snapshots are composed)](./artifact-model.md)

## Relationship to validation

Validation ensures that a snapshot is valid.

Identity ensures that a snapshot is distinguishable.

These concerns are related but separate.

A snapshot can be:

- valid but identical to a previous snapshot
- valid and different from a previous snapshot
- invalid and rejected before identity is even relevant

Validation should occur before identity is used in runtime decisions.

For more detail:

- [Validation rules (how contract compliance is enforced)](./validation-rules.md)

## What this model should protect

A good identity model protects the system from:

- unnecessary renderer reloads
- missed updates when meaningful changes occur
- hidden incompatibilities between artifacts
- non-deterministic behavior across environments

If identity is correct, runtime decisions become simple.

## Related documentation

- [Snapshot contract](./snapshot-contract.md) — what makes a snapshot valid
- [Artifact model](./artifact-model.md) — how snapshots are composed
- [Validation rules](./validation-rules.md) — how contract compliance is enforced
- [Coordinator](../architecture/coordinator.md) — integration, caching, and control
