# Publish Pipeline <Badge type="warning" text="work in progress" />

The publish pipeline delivers validated snapshot artifacts to production.

It is a production-only concern. In local development, the coordinator reads build output directly — there is no publish step.

## Role

The publish pipeline is responsible for:

- consuming validated build output (artifacts + manifest + identity)
- confirming the build succeeded and produced expected artifacts
- delivering the snapshot to the remote settings system
- making the snapshot available for the production coordinator to consume

It is not responsible for:

- assembling artifacts (that belongs to the [build system](./build-system.md))
- re-validating at build level (that was already done)
- runtime behavior (that belongs to the [coordinator](./coordinator.md))

## Trigger

The publish pipeline runs as a **GitHub Actions workflow**.

It may be triggered:

- automatically on merge to the release branch
- manually for production deployments

## Inputs

The pipeline receives the output of a successful build:

- snapshot artifacts (JS, CSS, baseline FTL — all universally required)
- manifest declaring artifact roles and snapshot identity
- build validation results confirming the snapshot passed all validation layers

## Steps

::: info Not yet in code
The publish pipeline is defined here but not yet implemented as a GitHub Actions workflow. No automated delivery to remote-settings or translation repo handoff exists yet.
:::

1. **Build** — run the build system, which produces and validates the snapshot
2. **Verify** — confirm the build succeeded and the expected artifacts are present
3. **Deliver snapshot** — craft a PR to the external remote-settings repository with the validated snapshot
4. **Deliver translation handoff** — aggregate the baseline FTL and a translation manifest, then push to the translation repository
5. **Production gate** — the remote-settings PR serves as a final review point before the snapshot reaches production

Steps 3 and 4 are independent. The snapshot ships immediately. The translation handoff enables downstream translation work but does not block the snapshot.

## Outputs

The pipeline produces two deliverables through independent channels:

- **Snapshot PR** — a PR to the remote-settings repository containing the validated snapshot. Available to the production coordinator once merged.
- **Translation handoff** — baseline FTL + translation manifest pushed to the translation repository. This is where our ownership ends — translation, validation, and delivery to the translations collection is a separate workflow.

## Boundaries

The publish pipeline is intentionally narrow.

It should:

- trust the build system's validation (not duplicate it)
- deliver exactly what the build produced (not modify artifacts)
- fail clearly if the build did not produce expected output

It should not:

- transform, repackage, or modify artifacts
- apply additional business logic
- deploy directly without review (the remote-settings PR is the review gate)

## Local development

The publish pipeline does not exist in local development.

Locally, the coordinator reads Vite build output directly. This is sufficient for development and testing because:

- the build system still validates artifacts
- the coordinator still consumes them through the same contract
- only the delivery mechanism differs

## Two-channel delivery

The publish pipeline is where the snapshot and translation delivery paths diverge.

### Snapshot channel (owned end-to-end)

Build output → PR to remote-settings snapshot collection → merge → coordinator consumes.

This channel is fully owned by this repository's pipeline. The production gate (PR review) is the final checkpoint before the snapshot reaches users.

### Translation channel (handoff only)

Per-component `component.ftl` files + translation manifest → push to translation repository.

Every snapshot publish establishes (or re-establishes) the translation target. The `l10nHash` is the anchor that translations accumulate against over time. When the key set hasn't changed, the same hash is re-published and existing translations remain valid.

We own the handoff. We do not own what happens after — translation, [carry-forward](./l10n.md#carry-forward), aggregation, and delivery to the translations collection is a separate workflow in the translation repository.

What we provide at the handoff:

- individual `component.ftl` files (not the aggregated baseline) — enables granular translation tracking per component
- a translation manifest identifying the `l10nHash`, baseline locale, and key set

The translation pipeline uses per-component files to identify which components changed and target work accordingly. It aggregates per-locale translations before publishing to the translations collection.

For the full two-channel model and carry-forward mechanics, see [Localization](./l10n.md#two-channel-delivery).

## Relationship to the build system

The build system and publish pipeline form a two-stage delivery process:

1. **Build** — produce and validate
2. **Publish** — deliver to production

The handoff is clean: build outputs validated artifacts, publish delivers them. Publish does not need to understand how artifacts were assembled — only that they are complete and valid.

## Related documentation

- [Build system](./build-system.md) — how artifacts are produced and validated
- [Localization](./l10n.md) — two-channel delivery and translation pipeline
- [Gating](./gating.md) — validation and exposure gates
- [Snapshot contract](../spec/snapshot-contract.md) — what makes a snapshot valid
- [Coordinator](./coordinator.md) — how artifacts are consumed at runtime
