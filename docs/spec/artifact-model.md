# Artifact Model

This document defines how a snapshot is composed.

A snapshot is a single delivery unit, but it is made up of multiple artifacts that serve different runtime purposes.

The artifact model exists to make those parts explicit.

## Why this model exists

The system does not deliver “a renderer” in the abstract.

It delivers a concrete set of artifacts that runtime depends on.

Those artifacts need to be understood clearly so the system can answer questions like:

- What is required for a snapshot to be complete?
- Which artifacts are runtime-critical?
- Which artifact changes should be treated as snapshot changes?
- What can the coordinator safely assume is present?

Without an explicit artifact model, these answers become implicit and fragile.

## Core idea

A snapshot is composed of declared artifacts.

Each artifact has:

- a role in runtime
- a defined place in the snapshot
- a participation boundary in validation and identity

Artifacts are not interchangeable.

A JavaScript entry artifact, a stylesheet artifact, and a localization artifact may all belong to the same snapshot, but they serve different purposes and should be modeled accordingly.

## Artifact categories

At a high level, snapshot artifacts fall into a small number of categories.

### Runtime execution artifacts

These are required to execute the renderer.

Examples include:

- JavaScript entry artifacts

Without these, the renderer cannot load.

### Runtime presentation artifacts

These are always required.

Examples include:

- CSS artifacts

Without these, the renderer may technically execute, but it is not considered complete for contract purposes. CSS is universally required for every valid snapshot.

### Runtime content artifacts

These are required when the renderer depends on externalized content resources.

Examples include:

- localization artifacts such as Fluent resources

These participate in snapshot completeness when the renderer contract requires them.

## A snapshot is not just a JS bundle

This is an important rule.

A snapshot should not be modeled as “JavaScript plus some optional extras.”

Instead, it should be modeled as:

- a set of artifacts with distinct roles
- a completeness rule that defines which of those roles are required

This keeps the contract honest.

If CSS or localization is required for the renderer to be considered valid, that requirement should be explicit in the artifact model rather than treated as an implementation detail.

## Required and optional artifacts

Requiredness is defined by contract.

Every valid snapshot must include all three artifact categories:

- at least one runtime execution artifact (JavaScript entry)
- at least one runtime presentation artifact (CSS)
- at least one runtime content artifact (baseline FTL, en-US)

All three are universally required. There is no valid snapshot without execution, presentation, and content artifacts.

The baseline FTL is the en-US Fluent source aggregated from colocated `component.ftl` files at build time. It defines the renderer's content layer and the key set that downstream translations are produced against.

Non-baseline translations (other locales) are not part of the snapshot. They are delivered through a separate channel. See [Localization (system deep-dive)](../architecture/l10n.md) for the full pipeline.

## Declared artifacts vs emitted artifacts

The system should distinguish between:

- artifacts the snapshot contract expects
- artifacts the build system emits

This distinction is important because build systems may produce extra files that are not contract-relevant.

For the purposes of the snapshot contract, the artifact model should focus on declared artifacts:

- the artifacts runtime depends on
- the artifacts validation enforces
- the artifacts identity derives from when relevant

This prevents the contract from becoming a mirror of bundler output.

## Artifact roles

Each artifact in a snapshot should have a clearly defined role.

At a minimum, the system should be able to answer:

- Is this artifact required for execution?
- Is this artifact required for presentation?
- Is this artifact required for content completeness?
- Is this artifact part of identity-bearing change detection?
- Is this artifact localizable or locale-bound?

If those questions cannot be answered clearly, the artifact model is probably too implicit.

## Artifact boundaries

Artifacts should be modeled in a way that preserves their role boundaries.

That means:

- execution artifacts should not be treated as presentation artifacts
- presentation artifacts should not be collapsed into generic attachments
- localization artifacts should not be treated as incidental metadata

This does not require every artifact category to have a completely separate implementation path, but it does require the contract to distinguish them meaningfully.

## Localization as an artifact concern

Localization is part of the artifact model. It affects:

- runtime completeness
- delivery shape
- identity decisions
- compatibility between renderer code and content resources

### What is in the snapshot

The **baseline FTL** (en-US) is a universally required snapshot artifact. It is authored in this repository, colocated with components, and built alongside JS and CSS. It defines the renderer's content and the key set that translations target.

### What is not in the snapshot

**Non-baseline translations** (other locales) are produced externally and delivered through a separate remote-settings collection. They are keyed to the baseline's key-set hash (`l10nHash`), not the snapshot identity. This means:

- translations survive JS/CSS-only snapshot changes (same `l10nHash`)
- translations survive English text changes to existing keys (same `l10nHash`)
- when the key set changes (keys added or removed), new translations are needed (new `l10nHash`)
- translation completion does not change the snapshot

### Two-channel delivery

Snapshots and translations ship through independent channels — snapshots immediately, translations asynchronously. For the full two-channel model and delivery pipeline, see [Localization](../architecture/l10n.md#two-channel-delivery).

## Artifact participation in identity

Not every emitted file must participate equally in snapshot identity.

However, contract-relevant artifacts should be modeled in a way that allows the identity system to reason about them.

At a high level:

- some artifacts are identity-bearing by default
- some artifacts may participate in identity conditionally
- non-contract artifacts should not affect snapshot identity

This document does not define the exact identity algorithm.

That belongs in:

- [Identity model (how snapshot identity is derived)](./identity-model.md)

What matters here is that artifact modeling and identity cannot be separated completely. If an artifact matters to runtime, the identity model must be able to account for it appropriately.

## Artifact participation in validation

Artifacts also participate in validation differently.

Examples:

- some validations are structural  
  such as “a required execution artifact is missing”
- some validations are policy-based  
  such as “a localization artifact exists but does not satisfy baseline locale requirements”

This means the artifact model must give validation enough information to enforce:

- presence
- shape
- role correctness
- policy expectations

Exact rules belong in:

- [Validation rules (how contract compliance is enforced)](./validation-rules.md)

## What this model should protect

A good artifact model protects the system from a few common failures:

- treating non-essential build output as contract-critical
- treating required artifacts as optional implementation details
- collapsing execution, presentation, and localization into one vague concept
- forcing runtime to guess whether a snapshot is actually complete

If the artifact model is doing its job, the system should be able to answer a simple question clearly:

> What must exist for this snapshot to be considered complete and safe to consume?

## Related documentation

- [Snapshot contract (what makes a snapshot valid)](./snapshot-contract.md)
- [Identity model (how snapshot identity is derived)](./identity-model.md)
- [Validation rules (how contract compliance is enforced)](./validation-rules.md)
- [Build system (how artifacts are assembled)](../architecture/build-system.md)
- [Publish pipeline (how artifacts become available to runtime)](../architecture/publish-pipeline.md)
- [Renderer (how the user experience is built and delivered)](../architecture/renderer.md)
