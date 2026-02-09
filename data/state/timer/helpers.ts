import {
  clamp,
  getElapsedFromBaselines,
  getRunningDelta,
} from "@common/utilities/time"
import { TimerPhase, TimerStatus } from "./types"

import type {
  TimerPhase as TimerPhaseType,
  TimerState,
  TimerView,
} from "./types"

/**
 * nowMsDefault
 * ---------------------------------------------------------
 * Small indirection around Date.now().
 *
 * Why it can be useful:
 * - Centralizes the "what time is it" call site.
 * - Makes it easier to swap in a deterministic clock later (tests, replays).
 *
 */
export const nowMsDefault = () => Date.now()

/**
 * getPhaseDurationMs
 * ---------------------------------------------------------
 * Returns the total duration for a given phase, based on user preferences.
 *
 * Notes:
 * - Kept as a helper to avoid scattering "phase ? focus : break" logic.
 */
export const getPhaseDurationMs = (phase: TimerPhaseType, s: TimerState) => {
  return phase === TimerPhase.Focus
    ? s.preferences.focusDurationMs
    : s.preferences.breakDurationMs
}

/**
 * computeElapsedMs
 * ---------------------------------------------------------
 * Computes elapsed time for the current phase from persisted baselines.
 *
 * Timing model:
 * - accumulatedMs: time already banked (e.g., after pauses)
 * - startedAtMs: baseline set on Start when Running
 *
 * When Running:
 *   elapsed = accumulatedMs + (nowMs - startedAtMs)
 *
 * When not Running:
 *   elapsed = accumulatedMs
 *
 * Safety:
 * - Clamps to non-negative to avoid weirdness if clocks skew or inputs drift.
 *
 * Implementation note:
 * - This is a small adapter over `getElapsedFromBaselines` so callers that
 *   already have a `TimerState` can stay ergonomic.
 * - The baseline helper is the canonical implementation to prevent drift
 *   between stateful domain code and visual-only consumers.
 */
export const getElapsedMs = (s: TimerState, nowMs: number) => {
  return getElapsedFromBaselines({
    isRunning: s.status === TimerStatus.Running,
    startedAtMs: s.startedAtMs,
    accumulatedMs: s.accumulatedMs,
    nowMs,
  })
}

/**
 * completeIfNeeded
 * ---------------------------------------------------------
 * Stamps authoritative completion if the phase boundary is reached.
 *
 * Idempotency:
 * - If already Complete, returns the state unchanged.
 * - If boundary not reached, returns the state unchanged.
 *
 * What it does on completion:
 * - Sets status = Complete
 * - Clears startedAtMs (freezes baselines; no longer "running")
 * - Updates accumulatedMs to include any final running delta
 * - Increments eventId for domain-level transition tracking
 *
 * Why this exists:
 * - Keeps "completion stamping" logic consistent across actions and policy.
 * - Prevents repeated or partial completion transitions across tabs.
 */
export const completeIfNeeded = (s: TimerState, nowMs: number): TimerState => {
  if (s.status === TimerStatus.Complete) return s

  const totalMs = getPhaseDurationMs(s.phase, s)
  const elapsedMs = getElapsedMs(s, nowMs)

  // Not yet at boundary → no-op.
  if (elapsedMs < totalMs) return s

  // Freeze timing baselines:
  // If we were Running, bank the final delta into accumulatedMs and clear startedAtMs.
  const accumulatedMs = getRunningDelta({
    isRunning: s.status === TimerStatus.Running,
    startedAtMs: s.startedAtMs,
    accumulatedMs: s.accumulatedMs,
    nowMs,
  })

  return {
    ...s,
    status: TimerStatus.Complete,
    startedAtMs: null,
    accumulatedMs,
    eventId: s.eventId + 1,
  }
}

/**
 * switchPhaseInternal
 * ---------------------------------------------------------
 * Performs the core "phase switch" transition.
 *
 * Design choice:
 * - Switching phases always resets the phase timer (accumulatedMs = 0).
 * - The caller chooses whether the new phase starts immediately (shouldStart).
 * - The caller does NOT get to choose dinner ... that is on rotation and we should work together
 *
 * This helper is intentionally boring (like me):
 * - No preference logic (autoSwitch/autoStart) lives here.
 * - No completion logic lives here.
 * - It only applies the mechanical state transition.
 *
 * Why it exists:
 * - Keeps all phase transitions consistent (manual switch, auto-switch, etc).
 * - Avoids duplicating the same "reset + maybe start" logic in multiple actions.
 */
export const switchPhaseInternal = (
  s: TimerState,
  nextPhase: TimerPhaseType,
  nowMs: number,
  shouldStart: boolean,
): TimerState => {
  return {
    ...s,
    phase: nextPhase,
    status: shouldStart ? TimerStatus.Running : TimerStatus.Idle,
    startedAtMs: shouldStart ? nowMs : null,
    accumulatedMs: 0,
    eventId: s.eventId + 1,
  }
}

/**
 * deriveTimerView
 * ---------------------------------------------------------
 * Pure derivation:
 * - deterministic given (TimerState + nowMs)
 * - no side effects
 * - does NOT mutate or "fix" shared truth
 *
 * Timing model:
 * - elapsed = accumulatedMs + (Running ? nowMs - startedAtMs : 0)
 */
export function deriveTimerView(state: TimerState, nowMs: number): TimerView {
  const totalMs = getPhaseDurationMs(state.phase, state)

  // Baseline-based elapsed. We clamp to keep things boring even if inputs go weird.
  const elapsedMs = getElapsedMs(state, nowMs)

  // Remaining is derived, but we clamp so it never goes negative.
  const remainingMs = Math.max(0, totalMs - elapsedMs)

  // Progress is always derived.
  // If total is 0, treat as fully progressed (and boundary reached).
  const progress = totalMs === 0 ? 1 : clamp(elapsedMs / totalMs, 0, 1)

  // Option B: completion is an authoritative status.
  const isComplete = state.status === TimerStatus.Complete

  // Pure boundary signal: "we've reached the end of the phase time"
  const shouldComplete = elapsedMs >= totalMs

  return {
    phase: state.phase,
    status: state.status,
    totalMs,
    elapsedMs,
    remainingMs,
    progress,
    isComplete,
    shouldComplete,
  }
}
