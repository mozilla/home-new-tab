# Glossary

A quick reference for terms that carry specific meaning in this project.

Most of these words exist in general software engineering, but here they mean something precise. When the docs use them, this is what they mean.

## System Roles

- **Coordinator**
  The integration layer that sits between upstream data and the renderer. Retrieves data, manages caching, selects and loads renderers, and provides data to the renderer in a predictable way. In production, this behavior lives within browser core. See [Coordinator deep-dive](../architecture/coordinator.md).

- **Renderer**
  The user experience layer. Built ahead of time, bundled as a snapshot, validated through the delivery pipeline, and loaded by the coordinator at runtime. Owns UI and state. Does not self-bootstrap. See [Renderer deep-dive](../architecture/renderer.md).

- **API**
  A development-only layer that models the shape of upstream data. Proxies or simulates external data sources for local development. Does not exist as a single production service. See [Architecture overview](../architecture/overview.md).

- **Host**
  Any environment that drives the renderer through its lifecycle: `init` → `mount` → `update` → `unmount`. In production the coordinator is the host, but Storybook, test harnesses, and local dev can also act as hosts. See [Lifecycle contract](./lifecycle-contract.md).

- **Artifact Loader**
  Prepares renderer artifacts for execution (ensures assets are available) without running the renderer itself. Supports portability across environments. See [Lifecycle contract](./lifecycle-contract.md).

## Core Concepts

- **Snapshot**
  A complete, validated, and identifiable renderer delivery unit. Not a loose collection of assets, but a single atomic package the system trusts to be valid and ready. If any contract-relevant part changes, the snapshot itself has changed. See [Snapshot contract](./snapshot-contract.md).

- **Artifact**
  A concrete asset that composes a snapshot. Each artifact has a role (execution, presentation, or content), a defined place in the snapshot, and a participation boundary in validation and identity. See [Artifact model](./artifact-model.md).

- **Manifest**
  Metadata that describes a renderer build: version, build time, file path, hash, data schema version, CSS file, assets base, and cache status. Used for compatibility checking and snapshot identification. Defined as `AppRenderManifest` in `common/types`.

- **Identity**
  Deterministic snapshot identification derived from contract-relevant artifacts (JS, CSS, baseline FTL). Answers: "is this the same snapshot or a different one?" See [Identity model](./identity-model.md).

- **Data Schema Version**
  A version identifier for the coordinated data format. Used for compatibility checking between the coordinator and the renderer. Soft sanity check, validated with range comparison, not strict equality.

- **Baseline FTL**
  The English (en-US) localization resource, aggregated from colocated `component.ftl` files at build time. Defines the content layer and key set for translations. Universally required in every snapshot. See [L10n system](../architecture/l10n.md).

- **l10nHash**
  A hash of the baseline FTL key set (sorted message IDs). Translations are keyed to this hash, not to snapshot identity. Stable across JS/CSS changes and English text edits. Only key additions or removals produce a new hash. See [Localization](../architecture/l10n.md#why-key-set-hashing).

## Behaviors and Patterns

- **SWR (Stale-While-Revalidate)**
  The coordinator's primary data update pattern. Use cached data immediately, fetch fresh data in the background, and provide it on the next render cycle. The user sees something fast, and the system catches up quietly. See [Coordinator deep-dive](../architecture/coordinator.md).

- **Passthrough**
  Coordinator behavior where data from a given source is transferred as-is to the renderer. Not all data is passthrough — some sources require sanitization, combination, or derivation. Passthrough describes the simplest case, where the coordinator adds no processing beyond caching. See [Coordinator deep-dive](../architecture/coordinator.md).

- **Lifecycle Contract**
  The API contract defining how a renderer is initialized, mounted, updated, and unmounted. Intentionally separates runtime configuration (`init`) from render payload (`mount`/`update`). See [Lifecycle contract](./lifecycle-contract.md).

- **Gating**
  Enforcement at system boundaries. Two kinds: validation gates ("is this artifact correct?") and exposure gates ("should this user see it?"). Validation gates run before runtime. Exposure gates run at runtime: locale at the snapshot level, flags at the feature level. See [Gating](../architecture/gating.md).

- **Gating Payload**
  A single structured object the coordinator passes to the renderer through `init()`. Has two facets: locale (translation context) and flags (feature flag state). Carries raw context, not pre-evaluated results. The renderer uses the payload to make feature-level exposure decisions. See [Gating](../architecture/gating.md#the-gating-payload).

- **Flags Facet**
  The feature flag portion of the gating payload. A map of flag names to resolved state (`enabled`, `variant`, experiment metadata). Encompasses rollout, market targeting, and experimentation — all resolved by an external flag service. The renderer consumes flag state for conditional rendering. See [Feature flags](../architecture/feature-flags.md).

## State System

- **Synced Store**
  A Zustand store created via `createSyncedStore` that supports cross-tab synchronization, persistence, and deterministic merge. Each synced store wraps domain data in a SyncFrame, chooses a restore mode, and exposes `commit()` / `set()` mutation paths. See [State management](../patterns/state-management.md).

- **SyncFrame**
  The internal envelope that wraps domain data in the synced store system. Carries sync metadata (`rev`, `updatedAtMs`, `updatedBy`) alongside the domain data. Used for cross-tab merge decisions. See [State management](../patterns/state-management.md).

- **commit() vs set()**
  The two mutation paths in synced stores. `commit()` is a shared write, persisting to storage, broadcasting to other tabs, and bumping sync metadata. `set()` is a local-only write with no persistence and no broadcast. Choose based on whether the mutation matters beyond this tab. See [State management](../patterns/state-management.md).

- **Restore Mode**
  Controls how a synced store recovers state. Three modes: `"never"` (always fresh), `"session"` (survives reload and new tabs while the session is open, but resets when all tabs close), `"device"` (survives everything via localStorage). See [State management](../patterns/state-management.md).

- **LWW (Last Write Wins)**
  The deterministic merge strategy for cross-tab sync. When two tabs have diverged, the system picks the winner by comparing: revision number → timestamp → tab ID (lexicographic tiebreaker). All tabs make the same decision regardless of message arrival order. See [State management](../patterns/state-management.md).

## Infrastructure

- **Delivery Pipeline**
  The build system + publish pipeline. Assembles artifacts, validates correctness, and produces deployable outputs. Acts as gatekeeper, rejecting incomplete or invalid snapshots before they can reach runtime. See [Build system](../architecture/build-system.md) and [Publish pipeline](../architecture/publish-pipeline.md).

- **Determinism**
  A system property where the same inputs produce the same outputs. Especially important in build outputs, published artifacts, and coordination between systems. If behavior is surprising, it's probably not deterministic enough. See [Mental model](../architecture/mental-model.md).

- **Entropy**
  System degradation over time: logic appearing in the wrong layer, responsibilities becoming unclear, "temporary" shortcuts becoming permanent. The docs and contracts exist to counter this. See [Mental model](../architecture/mental-model.md).

## Related documentation

- [Snapshot contract](./snapshot-contract.md)
- [Artifact model](./artifact-model.md)
- [Identity model](./identity-model.md)
- [Lifecycle contract](./lifecycle-contract.md)
- [Validation rules](./validation-rules.md)
- [Architecture overview](../architecture/overview.md)
- [State management](../patterns/state-management.md)
