export const TimerPhase = {Focus: "focus",Break: "break" } as const //prettier-ignore
export type TimerPhase = (typeof TimerPhase)[keyof typeof TimerPhase]

export const TimerStatus = { Idle: "idle", Running: "running", Paused: "paused", Complete: "complete" } as const //prettier-ignore
export type TimerStatus = (typeof TimerStatus)[keyof typeof TimerStatus]

export type TimerPreferences = {
  focusDurationMs: number
  breakDurationMs: number
  autoSwitchEnabled: boolean
  autoStartNextPhase: boolean
}

/**
 * Authoritative timer state.
 * - Shared across tabs
 * - Persisted via the state system
 * - Never contains per-tick or derived values
 */
export type TimerState = {
  /**
   * User-configurable preferences.
   * Synced + persisted across tabs.
   */
  preferences: TimerPreferences

  /**
   * Current timer phase + status.
   */
  phase: TimerPhase
  status: TimerStatus

  /**
   * Baseline timing model:
   * - accumulatedMs: elapsed time carried forward while paused
   * - startedAtMs: wall-clock start when running
   */
  startedAtMs: number | null
  accumulatedMs: number

  /**
   * Monotonic domain event counter.
   * Useful for boundary reconciliation (completion, phase switch).
   */
  eventId: number
}

export type TimerActions = {
  /**
   * start()
   * ---
   * Transition the timer into `Running`.
   *
   * Behavior:
   * - If already running → no-op.
   * - If status is `Complete`, restart the same phase cleanly.
   *
   * Effects:
   * - Sets `startedAtMs` to "now".
   * - Resets `accumulatedMs` only when restarting from `Complete`.
   * - Increments `eventId` on state change.
   *
   * Invariants:
   * - Does not change phase.
   * - Does not modify preferences.
   */
  start: () => boolean

  /**
   * pause()
   * ---
   * Transition the timer into `Paused`.
   *
   * Behavior:
   * - If not currently `Running` → no-op.
   * - Computes authoritative elapsed time before pausing.
   *
   * Effects:
   * - Folds running delta into `accumulatedMs`.
   * - Clears `startedAtMs` (freezes progression).
   * - Increments `eventId` on state change.
   *
   * Invariants:
   * - Phase remains unchanged.
   * - Elapsed time is always derived from baselines.
   */
  pause: () => boolean

  /**
   * resetPhase()
   * ---
   * Reset the current phase back to `Idle`.
   *
   * Behavior:
   * - Clears timing baselines.
   * - Leaves preferences untouched.
   *
   * Effects:
   * - `status` → `Idle`
   * - `startedAtMs` → null
   * - `accumulatedMs` → 0
   * - Increments `eventId`
   *
   * Invariants:
   * - Phase does not change.
   */
  resetPhase: () => boolean

  /**
   * reset()
   * ---
   * Restore the entire timer to its default state.
   *
   * Behavior:
   * - Replaces state with `DEFAULT_TIMER_STATE`.
   *
   * Effects:
   * - Resets phase, status, baselines, and preferences.
   *
   * Notes:
   * - Intended as a full domain reset (not just lifecycle reset).
   */
  reset: () => boolean
  /**
   * advance(nowMs)
   * ---
   * Policy action triggered by the UI when derived physics reaches a boundary.
   *
   * Requirements:
   * - Idempotent: safe if called repeatedly (including across tabs)
   * - Authoritative: stamps completion in shared state (no UI-side guessing)
   *
   * Flow:
   * 1) Attempt to stamp completion via `completeIfNeeded`.
   * 2) If enabled, optionally transition to the next phase.
   */
  advance: (nowMs: number) => boolean
  /**
   * switchPhase(nextPhase)
   * ---
   * Manually switch to a specific phase.
   *
   * Behavior:
   * - Delegates to `switchPhaseInternal`.
   * - Always resets baselines.
   * - Does NOT auto-start.
   *
   * Effects:
   * - `phase` → nextPhase
   * - `status` → Idle
   * - Baselines cleared
   * - Increments `eventId`
   *
   * Invariants:
   * - Explicit and boring by design.
   * - Automatic policy transitions belong in `advance`.
   */
  switchPhase: (next: TimerPhase) => boolean
  /**
   * setPreferences(patch)
   * ---
   * Merge partial preference updates into state.
   *
   * Behavior:
   * - Shallow merges provided fields.
   * - No-op if values are unchanged.
   *
   * Effects:
   * - Updates `preferences`.
   * - Increments `eventId` only if something changed.
   *
   * Invariants:
   * - Does not modify timing baselines.
   * - Does not start, pause, or reset the timer.
   */
  setPreferences: (patch: Partial<TimerPreferences>) => boolean
  /**
   * setPhaseDurationMs(phase, durationMs)
   * ---
   * Authoritative update of a phase’s total duration.
   *
   * This action is **duration-centric**, not UI-centric:
   * - Store owns baselines + invariants
   * - UI may debounce/optimistically edit, but correctness does not depend on it
   *
   * Responsibilities:
   * 1) Update the appropriate preference:
   *    - focus → `preferences.focusDurationMs`
   *    - break → `preferences.breakDurationMs`
   *
   * 2) Preserve invariants for the *active* phase:
   *    - Elapsed is derived from baselines
   *    - Duration edits must not create negative remaining time
   *
   * Active phase behavior:
   * - Compute boundary as of "now"
   * - If elapsed >= new duration:
   *   - Stamp `Complete` (authoritative boundary)
   *   - Clamp accumulated/baselines to freeze progression
   * - Otherwise:
   *   - Keep baselines stable (avoid visual jumps)
   *   - If not running, clamp `accumulatedMs` to the new duration
   *
   * Notes:
   * - Safe to call repeatedly (idempotent for same inputs)
   * - Does not start/pause/reset the timer
   *
   * Typical UI usage:
   * - Pause once when editing begins (if running)
   * - Debounce while typing
   * - Commit final value on blur / Enter
   */
  setPhaseDurationMs: (phase: TimerPhase, durationMs: number) => boolean
}

export type TimerView = {
  phase: TimerPhase
  status: TimerStatus

  totalMs: number
  elapsedMs: number
  remainingMs: number
  progress: number

  /**
   * Real completion state (Option B).
   * This reflects authoritative shared truth.
   */
  isComplete: boolean

  /**
   * Pure derived boundary signal:
   * - true when elapsed >= total
   * - used by policy/reconciliation (mark complete, auto-switch, etc.)
   */
  shouldComplete: boolean
}
