# Validation Rules

This document defines how snapshot contract compliance is enforced.

If the snapshot contract defines what must be true, validation defines how the system determines whether those truths have been satisfied.

Validation exists to prevent invalid snapshots from reaching runtime.

## Why validation matters

The coordinator and renderer both depend on a simple runtime assumption:

> if a snapshot is published, it is safe to consume

That assumption is only trustworthy if invalid snapshots are rejected earlier.

Validation is the mechanism that makes that possible.

It ensures that:

- required artifacts are present
- artifact roles are correct
- identity can be derived from stable inputs
- policy requirements are satisfied before publish

## Core principle

Validation should happen before runtime, not during runtime.

The system should prefer:

- explicit rejection
- deterministic failure
- clear reporting

over:

- runtime repair
- hidden fallback behavior
- best-effort interpretation of invalid snapshots

If a snapshot fails validation, it should not be published.

## Validation layers

Not all validation rules operate at the same level.

At a high level, snapshot validation can be understood in three layers:

### Structural validation

Structural validation answers:

- does the snapshot have the required shape?
- are required artifacts present?
- are artifact declarations internally consistent?

These are the minimum rules required for a snapshot to exist as a valid delivery unit.

### Identity validation

Identity validation answers:

- can a stable identity be derived?
- are all identity-bearing inputs present and well-formed?
- is identity computation based only on contract-relevant inputs?

These rules ensure the system can reason about snapshot change deterministically.

### Policy validation

Policy validation answers:

- does the snapshot satisfy system-specific rules beyond bare structure?
- do localization artifacts satisfy required locale expectations?
- do artifact declarations match allowed contract rules?

These rules are still contract-relevant, but they express policy rather than raw shape.

## Minimum validation expectations

A snapshot must fail validation if any of the following are true.

### Missing required artifacts

If a required artifact is absent, the snapshot is incomplete and must be rejected.

Examples include:

- no execution artifact is present
- a required presentation artifact is missing
- a required localization artifact is missing

### Invalid artifact declarations

If an artifact is declared in a way that does not match the artifact model, the snapshot must be rejected.

Examples include:

- an artifact has no meaningful role
- a required artifact is declared ambiguously
- locale-bound artifacts are missing required locale information

### Identity cannot be derived

If the system cannot derive stable identity from the snapshot, the snapshot must be rejected.

Runtime should never receive a snapshot whose identity is missing, unstable, or dependent on non-deterministic inputs.

### Contract-required policy is not satisfied

If the snapshot violates a contract rule that the system considers mandatory, it must be rejected.

Examples include:

- required baseline locale not present
- unsupported artifact kind included as contract-relevant
- identity-bearing artifact omitted from identity input set

## Required artifact validation

Validation must enforce artifact requiredness explicitly.

This means the system must know, for a given snapshot:

- which artifact categories are universally required
- which artifact categories are conditionally required
- why a conditional artifact is required in that case

This is important because conditional artifacts are still mandatory when their condition applies.

“Optional” must never become shorthand for “validation does not care.”

## Artifact role validation

Validation must enforce artifact role correctness.

An artifact should not merely exist. It should exist in the correct role.

Examples:

- execution artifacts must be recognizable as execution artifacts
- presentation artifacts must be declared as presentation artifacts
- localization artifacts must be declared in a way that preserves locale semantics

This protects the system from vague or flattened artifact modeling.

## Identity participation validation

Validation must enforce that identity-bearing artifacts are represented correctly in identity derivation.

This means:

- all required identity-bearing artifacts must be included
- non-contract artifacts should not affect snapshot identity
- identity inputs must be stable and deterministic

This layer is critical because bad identity often looks “valid enough” until runtime behavior becomes inconsistent.

## Localization validation

Localization is a first-class validation concern. The baseline FTL (en-US) is universally required.

### Structural validation

The baseline FTL artifact must be present in every snapshot. A snapshot missing the baseline FTL fails structural validation and is rejected, the same as a missing JS entry or CSS artifact.

### Policy validation

All `data-l10n-id` references in the renderer source must resolve to keys in the baseline FTL.

This is enforced at two levels:

- **Edit time** — the ESLint `no-missing-message` rule provides immediate feedback
- **CI** — ESLint runs in the CI pipeline as a hard gate before build

A `data-l10n-id` that references a nonexistent key means the renderer will show missing content at runtime. This is a build-gate failure.

### Identity validation

The baseline FTL content hash (`l10nHash`) must be included in the snapshot identity derivation. A snapshot whose identity does not account for its baseline FTL content fails identity validation.

### What localization validation does not cover

Non-baseline translations are not validated at the build gate. They are delivered through a separate channel and governed by the exposure gate at runtime. Translation completeness is a translation pipeline concern, not a snapshot validation concern.

For the full localization pipeline, see [Localization (system deep-dive)](../architecture/l10n.md).

## Validation failure behavior

Validation failures should be:

- explicit
- deterministic
- easy to diagnose

A failing snapshot should not move forward in the pipeline.

Validation should produce errors that help answer:

- what failed
- why it failed
- what contract rule was violated

This is important both for human debugging and for maintaining confidence in the system.

## Validation and publish boundaries

Validation should be a publish gate.

That means:

- build systems may assemble candidate snapshots
- validation determines whether candidates satisfy the contract
- publish systems should expose only validated snapshots

This boundary is important because it keeps runtime assumptions clean.

If publish can expose unvalidated snapshots, the contract has already broken down.

## Validation and runtime boundaries

Runtime should not repeat build-time validation.

It may still perform lightweight sanity checks where necessary, but it should not be responsible for deciding whether a snapshot is contract-valid.

That question should already be settled.

This keeps runtime:

- smaller
- more predictable
- easier to reason about

## What validation should protect

A good validation model protects the system from:

- incomplete snapshots reaching runtime
- invalid artifact declarations being treated as acceptable
- unstable identity corrupting update behavior
- policy violations slipping through because “it mostly works”

If validation is doing its job, runtime should rarely need to ask whether a snapshot is trustworthy.

## Related documentation

- [Snapshot contract (what makes a snapshot valid)](./snapshot-contract.md)
- [Artifact model (how snapshots are composed)](./artifact-model.md)
- [Identity model (how snapshot identity is derived)](./identity-model.md)
- [Build system (how snapshots are assembled)](../architecture/build-system.md)
- [Publish pipeline (how valid snapshots are exposed to runtime)](../architecture/publish-pipeline.md)
