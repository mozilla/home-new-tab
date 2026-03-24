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

## Delivery collections

The pipeline delivers to two independent remote-settings collections. Each serves a different consumer and follows a different cadence.

**Iterative collection.** Updated on every qualifying merge to main. The production coordinator fetches from this collection at runtime. This is the "live" delivery path, where snapshots land as soon as they pass validation.

**Stable collection.** Updated on manual promotion only. Remote-settings collections can be bundled automatically with the browser at build time, so the stable collection is included in the browser binary as a shipped fallback renderer. Not fetched at runtime. This is the safety net, a known-good snapshot the browser can fall back to if the iterative collection is unreachable.

The iterative and stable collections are separate. Promotion to stable is a deliberate act, not an automatic consequence of publishing to iterative.

## Trigger

The iterative publish pipeline runs as a **GitHub Actions workflow**, triggered automatically on merge to main.

Stable promotion is a separate workflow, covered in [Stable promotion](#stable-promotion) below.

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

The iterative pipeline produces two deliverables through independent channels:

- **Snapshot PR** — a PR to the iterative remote-settings collection containing the validated snapshot. Available to the production coordinator once merged.
- **Translation handoff** — baseline FTL + translation manifest pushed to the translation repository. This is where our ownership ends. Translation, validation, and delivery to the translations collection is a separate workflow.

Stable promotion produces a separate deliverable on its own cadence. See [Stable promotion](#stable-promotion).

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

Two-channel delivery applies to iterative releases. The snapshot and translation delivery paths diverge at publish time.

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

Stable promotion does not use two-channel delivery. Because translation completeness is a prerequisite for promotion, translations are bundled with the snapshot. See [Stable promotion](#stable-promotion).

## Stable promotion

Stable promotion publishes a pinned snapshot to the stable remote-settings collection. This snapshot is bundled with the browser monolith as a shipped fallback renderer. This saves us from needing to commit minified code _(h/t Scott Downe for surfacing this capability)_

### What stable means

The stable snapshot is not the "live" version. The production coordinator fetches from the iterative collection at runtime. Stable exists so the browser always has a known-good renderer available, even if the iterative collection is unreachable.

Remote-settings supports automatic bundling of collection contents into the browser at build time. The stable collection uses this mechanism. When a snapshot is promoted to stable, the browser's next build automatically picks it up as the shipped fallback. No manual packaging step is required.

Stable is a manually promoted version. It represents a deliberate decision that a specific snapshot is ready to ship as the fallback baked into the browser binary.

### Trigger

Stable promotion is triggered by a tag on main (e.g., `stable/x.y.z`). A GitHub Actions workflow runs on tag push.

::: tip Open edges
The tag naming convention is not yet decided. The trigger mechanism (tag push vs manual workflow dispatch) may also evolve. What matters is that promotion is deliberate, not automatic.
:::

### Prerequisites

A snapshot is eligible for stable promotion when:

- it has already been published to the iterative collection (stable is always a subset of iterative)
- translations are complete for all supported locales against the snapshot's `l10nHash`

The second prerequisite is what distinguishes stable from iterative. Iterative snapshots ship immediately with baseline FTL, and translations follow asynchronously. Stable snapshots only ship once translations are done.

::: tip Open edge
How translation completeness is verified before promotion (manual check vs automated gate) is not yet decided.
:::

### What it produces

The stable pipeline delivers a single bundle to the stable remote-settings collection:

- validated snapshot artifacts (JS, CSS, baseline FTL)
- manifest and identity
- bundled translations for all supported locales

This is single-channel delivery. There is no separate translation handoff because translations are already complete and included.

::: tip Open edge
Whether the stable collection schema differs from the iterative collection (to accommodate bundled translations) is not yet decided.
:::

### Cadence

Stable promotion is slower than iterative. It is tied to the browser release schedule, not to merge frequency. A stable tag may represent weeks or months of iterative releases.

### Relationship to iterative

Every stable snapshot started as an iterative one. The tag points to a commit on main that has already passed through the full iterative pipeline: build, validation, publish. Stable promotion does not re-build or re-validate. The artifacts are already proven.

The difference is what gets bundled. Iterative publishes the snapshot and hands off translation work. Stable waits for that translation work to finish, then bundles everything together.

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
