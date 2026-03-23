# Build System

The build system produces validated snapshot artifacts from source code.

It is the first checkpoint in the delivery pipeline. When the build system works correctly, runtime can assume that every artifact it encounters is complete, correctly structured, and identifiable.

## Role

The build system is responsible for:

- assembling snapshot artifacts from source code
- producing a manifest that declares what the snapshot contains
- deriving a deterministic snapshot identity from contract-relevant inputs
- validating that the snapshot meets structural, identity, and policy rules
- rejecting invalid snapshots before they can reach the publish pipeline

It is not responsible for:

- delivering artifacts to production (that task belongs to the [publish pipeline](./publish-pipeline.md))
- runtime coordination or caching (that task belongs to the [coordinator](./coordinator.md))
- defining the user experience (that task belongs to the [renderer](./renderer.md))

## Inputs

The build system consumes:

- renderer source code (TypeScript, React components)
- stylesheets (CSS, PostCSS)
- localization resources (Fluent .ftl files, colocated with components)
- build configuration

## Outputs

The build system produces a **snapshot**: a set of declared artifacts that together form a complete, validated delivery unit.

A snapshot includes:

### Artifacts

| Artifact | Category | Required | Notes |
| -------- | -------- | -------- | ----- |
| JavaScript entry | Execution | Always | The renderer cannot load without this artifact. |
| CSS | Presentation | Always | Universally required. Every valid snapshot includes CSS. |
| Baseline FTL (en-US) | Content | Always | Universally required. Aggregated from colocated `component.ftl` files. See [Localization](./l10n.md). |

### Manifest

The build system produces a manifest that declares:

- which artifacts are included in the snapshot
- the role of each artifact (execution, presentation, content)
- the snapshot identity

The manifest format is not prescribed. It must satisfy these constraints:

- every declared artifact has an explicit role
- the snapshot identity is present and derivable from contract-relevant inputs only
- the manifest distinguishes contract-relevant artifacts from incidental build output
- the manifest provides enough information for the coordinator to load the snapshot without interpretation or guessing

The manifest also includes localization metadata produced by the FTL build pipeline:

- `l10nDir` — path to the locale directory containing the baseline FTL
- `l10nHash` — hash of the baseline FTL key set (feeds into snapshot identity and independently keys translations). Derived from sorted message IDs, not full content — stable across English text changes.

For the full FTL build pipeline, see [Localization](./l10n.md#build-pipeline).

### Build output structure

```
dist/
  entry.<js-hash>.js                   — execution artifact
  styles.<css-hash>.css                — presentation artifact
  locales/<l10n-hash>/en-US.ftl        — content artifact (baseline)
  manifest.json                        — declares all artifacts
```

### Identity

The build system derives a snapshot identity that is:

- deterministic (same inputs produce the same identity)
- independent of build timing, file ordering, or environment
- derived only from contract-relevant inputs (execution, presentation, and baseline localization artifacts are always identity-bearing)

## Validation layers

::: info Not yet in code
Validation layers are defined here but not yet implemented as explicit build steps. The current build produces artifacts via `clients/renderer/vite.config.ts` without running structural, identity, or policy validation.
:::

The build system validates snapshots before they can proceed to the publish pipeline.

Validation operates in three layers:

### Structural validation

- all universally required artifacts are present (JS entry + CSS + baseline FTL)
- all conditionally required artifacts are present when their condition applies
- artifact declarations are internally consistent

### Identity validation

- a stable identity can be derived
- all identity-bearing artifacts are included in the identity computation
- non-contract artifacts do not affect identity

### Policy validation

- artifact roles are correct (execution artifacts are executable, presentation as presentation)
- localization policy rules are satisfied: all `data-l10n-id` references resolve to baseline FTL keys (see [l10n](./l10n.md))

A snapshot that fails any validation layer must be rejected. It must not reach the publish pipeline.

## Validation failure behavior

When validation fails, the build system must produce clear errors that answer:

- what failed
- why it failed
- which contract rule was violated

Failures must be deterministic — the same inputs must produce the same validation result.

## Boundaries

The build system checks correctness at build time, so runtime doesn't have to.

It's designed to:

- enforce correctness early — catch problems before they ship
- produce artifacts that are ready to consume without further assembly
- reject incomplete or invalid snapshots rather than emitting them with warnings

These concerns belong elsewhere:

- repairing invalid source inputs → that's a human problem
- emitting partially valid snapshots → the system prefers clear rejection
- deferring validation to runtime → the whole point is catching things early
- embedding runtime-specific logic (environment detection, feature flags) → [coordinator](./coordinator.md)

## Relationship to the publish pipeline

The build system hands validated output to the publish pipeline.

The handoff point is:

- build produces artifacts + manifest + identity
- publish consumes validated output and delivers it to production

The publish pipeline does not re-validate at build level. It validates that the build succeeded and produced the expected artifacts, then delivers them.

For more detail:

- [Publish pipeline (how validated artifacts reach production)](./publish-pipeline.md)

## Current state

The current build implementation lives in `clients/renderer/vite.config.ts`. As the build system becomes a first-class gatekeeper, validation steps described in this document will be wired into the build pipeline.

## Related documentation

- [Snapshot contract](../spec/snapshot-contract.md) — what makes a snapshot valid
- [Artifact model](../spec/artifact-model.md) — how snapshots are composed
- [Identity model](../spec/identity-model.md) — how snapshot identity is derived
- [Validation rules](../spec/validation-rules.md) — how contract compliance is enforced
- [Publish pipeline](./publish-pipeline.md) — how validated artifacts reach production
- [Renderer](./renderer.md) — the artifact the build system produces
