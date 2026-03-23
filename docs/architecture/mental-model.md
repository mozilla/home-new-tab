# Mental Model

This project exists to decouple the new tab experience from the browser's release cycle.

The new tab is a high-impact surface, but when it ships as part of the browser monolith, every change is tied to that cadence. Iteration slows down, coupling creeps in, and the cost of change goes up quietly over time.

The response is structural: draw clear seams, separate concerns, define explicit contracts. Not because separation is a virtue on its own, but because it's how you keep things easy to reason about and easy to maintain as the system grows.

For the full context on why this project exists and what it provides, see [Welcome](../guide/welcome.md).

## A system of distinct roles

The system defines three roles:

- **API** — represents the upstream data side of the system in local development and contract exploration
- **Coordinator** — represents the integration layer responsible for data flow, caching, and update behavior
- **Renderer** — represents the user experience layer and is the part most directly built and shipped from this repo

These roles are conceptual boundaries first. They exist so each concern can evolve independently without blocking or breaking the others.

In production, the final implementation and ownership of each role may differ from the local development setup in this repository. What matters is that the contracts between them remain explicit and stable.

## Separation as a tool, not a constraint

When everything ships together, a change in one area can block or break another. Separation lets each concern move at its own pace.

When responsibilities are clear:

- changes are easier to reason about
- failures are easier to isolate
- systems are easier to evolve independently

When responsibilities blur:

- logic leaks across boundaries
- assumptions become implicit
- complexity grows quietly over time

This project prefers explicit boundaries over convenience.

## Build systems as gatekeepers

Correctness should not be a runtime concern.

Instead, it should be enforced before anything is shipped.

That responsibility lives in:

- build systems
- validation steps
- publish pipelines

These systems act as gatekeepers.

They ensure that what reaches the runtime is already valid.

## Runtime as a consumer

Because correctness is enforced early, the runtime can stay simple.

It:

- consumes data
- loads renderers
- renders the experience

It does not:

- attempt to repair invalid state
- infer missing information
- make best-effort guesses

If something is wrong, it should have been caught earlier.

## Clarity over convenience

This system favors:

- explicit contracts over implicit behavior
- structure over "just make it work"
- predictability over flexibility

The alternative is worse. Implicit behavior becomes hidden coupling. "Just make it work" becomes a shortcut that someone else has to untangle. Flexibility without contracts becomes unpredictability.

## Determinism where it matters

Where possible, the system aims for:

- the same inputs producing the same outputs
- predictable behavior across environments
- stable artifacts that can be reasoned about

Determinism is especially important in:

- build outputs
- published artifacts
- coordination between systems

## Guarding against entropy

Entropy in a system usually looks like:

- logic appearing in the wrong layer
- responsibilities becoming unclear
- "temporary" shortcuts becoming permanent

Clear seams make entropy visible. When something is in the wrong place, the structure makes it obvious. When a shortcut becomes permanent, the contracts surface the drift.

This repo counters entropy by:

- making structure explicit
- documenting intent
- keeping maintenance easy through separation of concerns

If something feels off, it probably is.

::: tip How to use this mental model
As you work in the repo, a few questions can help:

- Does this responsibility belong in this layer?
- Should this be enforced earlier (build/publish)?
- Is this behavior defined explicitly, or assumed?
- Will this be predictable over time?

If those questions have clear answers, the system is on solid ground.
:::
