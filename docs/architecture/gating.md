# Gating <Badge type="warning" text="work in progress" />

This document describes where the gates are in the system, what each one checks, and what trust model they create.

Gates are how the system enforces correctness and controls exposure. They exist at different stages, serve different purposes, and create different downstream guarantees.

## Two kinds of gates

The system has two fundamentally different kinds of gates:

- **Validation gates** — "is this artifact correct?"
- **Exposure gates** — "should this user see this artifact?"

These are not the same concern. A snapshot can be valid but not appropriate for a given user. Understanding this distinction is essential to reasoning about the system.

|                  | Validation gates           | Exposure gates                                    |
| ---------------- | -------------------------- | ------------------------------------------------- |
| **When**         | Before runtime             | At runtime                                        |
| **Question**     | Is this correct?           | Is this appropriate for this user?                |
| **Failure mode** | Reject the artifact        | Fall back or withhold                             |
| **Owner**        | Build and publish pipeline | Coordinator (snapshot) + Renderer (feature)       |
| **Determinism**  | Fully deterministic        | Context-dependent                                 |

## Validation gates

Validation gates enforce correctness before artifacts reach runtime.

Their purpose is to push validation as early as possible so that runtime can stay simple. Each validation gate creates a trust boundary — downstream systems do not re-validate what upstream already checked.

### Build gate

The build system is the first gate.

It validates:

- structural completeness (required artifacts present — JS entry + CSS + baseline FTL, always)
- identity derivation (deterministic, from contract-relevant inputs only)
- policy compliance (artifact roles correct, conditional artifacts present when required)

If the build gate rejects a snapshot, nothing downstream ever sees it.

This gate enables: the publish pipeline can trust that build output is valid.

### Publish gate

The publish pipeline is the second gate.

It validates:

- the build succeeded and produced expected artifacts
- the snapshot is ready for delivery

The publish gate does not re-validate at build level. It confirms the build gate did its job, then delivers via a PR to the remote-settings repository. The PR itself serves as a final human review point.

This gate enables: the coordinator can trust that published snapshots are complete and valid.

### Runtime trust (the intentional absence of a gate)

The coordinator does not validate snapshots at runtime.

This is by design, not an oversight.

Because validation gates enforce correctness before publish, the coordinator operates on a trust model:

::: info Core trust invariant
If a snapshot is published, it is safe to consume.
:::

This keeps runtime:

- simple (no validation logic)
- predictable (no conditional repair or interpretation)
- fast (no re-checking what was already verified)

If a published snapshot is somehow invalid, that represents a failure in the validation gates — not a missing runtime check.

## Exposure gates

Exposure gates control which valid snapshots reach which users.

A snapshot that passes all validation gates is correct — but correctness alone does not determine whether a specific user should see it. Exposure gates answer a different question:

> Given this user's context, should they receive this snapshot?

Exposure decisions are made at runtime — by the coordinator at the snapshot level, and by the renderer at the feature level.

### Categories of exposure gates

The system anticipates several categories of exposure concern:

#### Locale availability

Whether translations exist for the user's locale.

A snapshot is always valid and available in en-US — the baseline FTL is baked into the snapshot as a universally required artifact. For any other locale, availability depends on whether a translation exists in the translations collection for the snapshot's `l10nHash`.

Availability states for a given (snapshot, locale) pair:

| State       | Meaning                                                    | Coordinator behavior                                        |
| ----------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| **Full**    | Translation exists for this `l10nHash` and covers all keys | Serve snapshot with this locale's translation                |
| **Partial** | Translation exists but does not yet cover all keys (expected during carry-forward) | Serve snapshot with translation; Fluent falls back to en-US per missing key |
| **None**    | No translation exists for this locale + `l10nHash`         | Serve snapshot with en-US fallback                           |

Partial translations are expected during the [carry-forward window](./l10n.md#carry-forward) after a key-set change. Fluent handles per-key fallback natively — en-US is always the terminal fallback. The renderer receives availability state and completeness metadata in the gating payload's locale facet for feature-level decisions.

::: warning Locale straddles both gate types
Baseline FTL presence and key completeness are **validation** concerns (build-time, structural). Translation availability for a specific locale is an **exposure** concern (runtime, contextual). The same system — localization — participates in both, but at different stages with different questions. See [Localization](./l10n.md) for the full pipeline.
:::

#### Feature flags

Whether a feature or experience variant is enabled for this user.

Feature flags control gradual rollout, experimentation, and conditional behavior. They determine whether a user is eligible for a specific experience.

#### Market targeting

Whether the snapshot is intended for the user's market or region.

Some experiences may be market-specific — available only in certain geographies or under certain conditions.

#### Gradual rollout

Whether this user falls within the rollout percentage.

Even when a snapshot is valid and the user is eligible by locale, flags, and market, the system may choose to expose it gradually to manage risk.

### Exposure gate properties

Exposure gates share some common properties that distinguish them from validation gates:

- **Context-dependent** — the answer depends on who the user is, not just what the artifact contains
- **Fallback-oriented** — failure means "show something else," not "reject"
- **Reversible** — exposure decisions can change without rebuilding artifacts
- **Composable** — multiple exposure gates may apply simultaneously (a user must pass locale + feature flag + market + rollout)

### Snapshot-level failure mode

When a snapshot-level exposure gate withholds a snapshot, the system needs a fallback strategy.

The exact mechanism is not yet defined, but the principle is:

- the user should see a valid experience (not a blank page)
- the fallback should be a previously valid snapshot, not a degraded or partial state
- the coordinator decides the fallback, not the renderer

Feature-level failure is a different concern. When the renderer withholds a feature based on its gating context, it handles degradation internally — the snapshot is still loaded, the renderer just chooses not to show certain capabilities. This is ordinary renderer business logic, not a system-level fallback.

### Two-level exposure model

::: info Not yet in code
The two-level exposure model and gating payload are defined here but not yet implemented. The current coordinator does not pass a gating payload through `init()`.
:::

Exposure gates operate at two levels.

**Snapshot-level exposure** is the coordinator's decision. Before loading a snapshot, the coordinator evaluates whether this user should receive it at all. This is the gate described above — locale availability, feature flags, market targeting, and gradual rollout all participate here.

**Feature-level exposure** is the renderer's decision. Once loaded, the renderer may need to make finer-grained exposure decisions within the snapshot — showing or hiding features, selecting experience variants, adapting content based on user context.

The coordinator cannot make feature-level decisions because it does not know the renderer's internal structure. The renderer cannot make snapshot-level decisions because it does not control its own loading. Each level has the right owner.

This is the same validate/expose paradigm — exposure just extends into the renderer.

#### The gating payload

The bridge between these two levels is the **gating payload** — a single structured object the coordinator passes to the renderer through [`init()`](../spec/lifecycle-contract.md).

The gating payload carries raw context, not pre-evaluated results. The renderer receives the inputs and makes its own decisions. This aligns with the system's core principle: business logic lives in the renderer.

The payload is a single object with distinct facets for each gating concern:

- **flags** — feature flag state
- **locale** — locale, fallback chain, availability state (Full/Partial/None), and completeness
- **market** — market and region context
- **rollout** — rollout cohort state
- **ab** — A/B test assignments

One object at the coordinator/renderer seam. Distinct concerns within it, so the renderer can be surgical about which context it uses for feature-level decisions.

#### Why raw context, not evaluated results

The coordinator could evaluate flags and pass booleans. But that would move business logic into the coordinator — exactly what the system's architecture avoids.

By passing raw context:

- the renderer owns its own exposure decisions
- the coordinator prepares context without interpreting it
- feature-level logic can change without coordinator changes
- the same renderer can interpret context differently across versions

The coordinator decides *whether* to load the renderer. The renderer decides *what* to show.

## The gate chain

Putting it together, the full gate chain looks like:

```mermaid
flowchart TD
    source@{label: "Source Code", shape: rect}

    subgraph build["Build Gate — validation"]
        direction TB
        b1@{label: "Structure", shape: hexagon}
        b2@{label: "Identity", shape: hexagon}
        b3@{label: "Artifacts", shape: hexagon}
    end

    subgraph publish["Publish Gate — validation"]
        direction TB
        p1@{label: "Build OK", shape: hexagon}
        p2@{label: "Delivery Ready", shape: hexagon}
        p3@{label: "PR Review", shape: hexagon}
    end

    subgraph snapshot_exp["Snapshot Exposure — coordinator"]
        direction TB
        e1@{label: "Locale", shape: diamond}
        e2@{label: "Flags", shape: diamond}
        e3@{label: "Market", shape: diamond}
        e4@{label: "Rollout", shape: diamond}
    end

    subgraph feature_exp["Feature Exposure — renderer"]
        direction TB
        f1@{label: "Flags", shape: diamond}
        f2@{label: "Locale", shape: diamond}
        f3@{label: "A/B", shape: diamond}
    end

    user@{label: "User Experience", shape: stadium}

    source --> build --> publish --> snapshot_exp
    snapshot_exp -- "gating payload via init()" --> feature_exp --> user

    classDef deepest fill:#2e1c51,stroke:#190d30,color:#f5f0eb
    classDef deep fill:#3d2c70,stroke:#211643,color:#f5f0eb
    classDef mid fill:#4a408e,stroke:#282155,color:#f5f0eb
    classDef light fill:#5656ad,stroke:#2e2e68,color:#f5f0eb
    classDef accent fill:#6b4eab,stroke:#3d2c70,color:#f5f0eb

    class source deepest
    class b1,b2,b3 deep
    class p1,p2,p3 deep
    class e1,e2,e3,e4 mid
    class f1,f2,f3 accent
    class user light
```

Each stage trusts the ones before it. The coordinator does not re-validate what build checked. Snapshot-level exposure gates do not question whether the snapshot is valid — only whether this user should see it. Feature-level exposure gates use the gating payload to make finer-grained decisions within the loaded snapshot.

## What this model protects

This gating model protects the system from:

- **invalid artifacts reaching runtime** — validation gates reject before publish
- **runtime complexity** — no validation logic in the coordinator
- **inappropriate exposure** — valid snapshots can still be withheld from users who shouldn't see them
- **conflating correctness with eligibility** — a snapshot can be valid but not ready for a given audience

::: details Open edges

**Resolved:**

- Validation gates are build and publish. Runtime does not validate.
- CSS is universally required at the build gate.
- Two-level exposure model: coordinator gates at snapshot level, renderer gates at feature level.
- Gating payload: single structured object with distinct facets, passed through `init()`.
- Locale exposure: Full/None availability states defined. Renderer receives locale context for granular decisions.

**To be designed:**

The gating payload defines the architectural model. The individual facets still need detailed design:

- Feature flag facet — how flags are defined, structured, and evaluated by the renderer
- Market facet — how geographic/market constraints are expressed
- Rollout facet — how rollout cohort state is represented
- A/B facet — how test assignments are structured
- Snapshot-level fallback strategy — when coordinator exposure gates withhold, what does the user see?
- Exposure gate composition — when multiple snapshot-level gates apply, how they interact
:::

## Related documentation

- [Build system](./build-system.md) — first validation gate
- [Publish pipeline](./publish-pipeline.md) — second validation gate
- [Coordinator](./coordinator.md) — snapshot-level exposure gate owner
- [Renderer](./renderer.md) — feature-level exposure gate owner
- [Lifecycle contract](../spec/lifecycle-contract.md) — gating payload flows through init()
- [Validation rules](../spec/validation-rules.md) — what the build gate enforces
- [Snapshot contract](../spec/snapshot-contract.md) — what validation gates protect
- [Localization](./l10n.md) — straddles both gate types
