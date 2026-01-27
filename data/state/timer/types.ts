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
  start: () => boolean
  pause: () => boolean
  resetPhase: () => boolean
  switchPhase: (next: TimerPhase) => boolean
  setPreferences: (patch: Partial<TimerPreferences>) => boolean
  maybeAutoAdvance: (nowMs: number) => boolean
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

export const DEFAULT_TIMER_PREFERENCES: TimerPreferences = {
  focusDurationMs: 25 * 60_000,
  breakDurationMs: 5 * 60_000,
  autoSwitchEnabled: true,
  autoStartNextPhase: false,
}

export const DEFAULT_TIMER_STATE: TimerState = {
  preferences: DEFAULT_TIMER_PREFERENCES,

  phase: "focus",
  status: "paused",

  startedAtMs: null,
  accumulatedMs: 0,

  eventId: 0,
}
