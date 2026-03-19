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

- snapshot artifacts (JS, CSS, and any conditional artifacts)
- manifest declaring artifact roles and snapshot identity
- build validation results confirming the snapshot passed all validation layers

## Steps

1. **Build** — run the build system, which produces and validates the snapshot
2. **Verify** — confirm the build succeeded and the expected artifacts are present
3. **Deliver** — craft a PR to the external remote-settings repository with the validated snapshot
4. **Production gate** — the remote-settings PR serves as a final review point before the snapshot reaches production

## Outputs

The pipeline produces:

- a PR to the remote-settings repository containing the validated snapshot
- the snapshot is available to the production coordinator once the PR is merged

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

## Relationship to the build system

The build system and publish pipeline form a two-stage delivery process:

1. **Build** — produce and validate
2. **Publish** — deliver to production

The handoff is clean: build outputs validated artifacts, publish delivers them. Publish does not need to understand how artifacts were assembled — only that they are complete and valid.

## Related documentation

- [Build system (how artifacts are produced and validated)](./build-system.md)
- [Snapshot contract (what makes a snapshot valid)](../spec/snapshot-contract.md)
- [Coordinator (how artifacts are consumed at runtime)](./coordinator.md)
