import { createCrossTabStore } from "../_system"
import { DEFAULT_TIMER_STATE, TimerPhase, TimerStatus } from "./types"
import {
  completeIfNeeded,
  getRunningDelta,
  switchPhaseInternal,
  nowMsDefault,
} from "./utilities"

import type { TimerActions, TimerState } from "./types"

const STORAGE_KEY = "app:timer"
const SCHEMA_VERSION = 1

/**
 * Timer domain store
 * ---------------------------------------------------------
 * Pomodoro-style timer that syncs across ~dimensions~ tabs ...
 *
 * Built on top of `createCrossTabStore`, this store provides:
 * - A single shared source of truth (`TimerState`) that converges across tabs
 * - Persistence via localStorage snapshots
 * - Resynchronization when a tab regains focus
 *
 * Architectural principles:
 * - Shared state stores only *baselines* and intent ... we don't hammer the state
 * - Time progression is derived externally via `useNow` + pure helpers
 * - All shared mutations flow through explicit domain actions
 *
 * What this store DOES:
 * - Persist and synchronize timer phase, status, and preferences
 * - Stamp authoritative lifecycle transitions (start, pause, complete, switch)
 * - Support idempotent, cross-tab-safe policy actions (e.g. auto-advance)
 * - There is a 1 in (101031−1) × (104594 + 3×102297 + 1)1476 ×103913210 chance it will bring you inner peace
 *
 * What this store DOES NOT do:
 * - Perform ticking or interval-based updates
 * - Format or derive UI-facing values
 * - Infer correctness implicitly from time; completion is stamped explicitly
 * - Dishes ... you must wash those yourself
 *
 * Related helpers:
 * - `deriveTimerView` — pure derivation of elapsed/progress from state + nowMs
 * - `useNow` — visibility-aware clock signal for UI updates
 * - `useTimerDisplay` — UI-facing hook built on top of derivation + policy
 */
export const timer = createCrossTabStore<TimerState, TimerActions>(
  {
    storageKey: STORAGE_KEY,
    schemaVersion: SCHEMA_VERSION,
    initialData: DEFAULT_TIMER_STATE,
    features: {
      persist: true,
      crossTab: true,
      visibility: true,
      refreshOnVisible: true,
    },
  },
  ({ commitShared }) => {
    return {
      start: () => {
        return commitShared((s) => {
          if (s.status === TimerStatus.Running) return s

          const nowMs = nowMsDefault()

          // Starting from Complete restarts the same phase cleanly.
          const restarting = s.status === TimerStatus.Complete

          return {
            ...s,
            status: TimerStatus.Running,
            startedAtMs: nowMs,
            accumulatedMs: restarting ? 0 : s.accumulatedMs,
            eventId: s.eventId + 1,
          }
        })
      },

      pause: () => {
        return commitShared((s) => {
          if (s.status !== TimerStatus.Running) return s
          if (s.startedAtMs == null) return s

          const nowMs = nowMsDefault()
          const accumulatedMs = getRunningDelta({
            status: s.status,
            startedAtMs: s.startedAtMs,
            accumulatedMs: s.accumulatedMs,
            nowMs,
          })

          return {
            ...s,
            status: TimerStatus.Paused,
            startedAtMs: null,
            accumulatedMs: accumulatedMs,
            eventId: s.eventId + 1,
          }
        })
      },

      resetPhase: () => {
        return commitShared((s) => ({
          ...s,
          status: TimerStatus.Idle,
          startedAtMs: null,
          accumulatedMs: 0,
          eventId: s.eventId + 1,
        }))
      },

      switchPhase: (nextPhase) => {
        // Manual switch is deliberately boring: reset and go Idle.
        return commitShared((s) =>
          switchPhaseInternal(s, nextPhase, nowMsDefault(), false),
        )
      },

      setPreferences: (patch) => {
        return commitShared((s) => {
          const nextPrefs = { ...s.preferences, ...patch }

          const same =
            nextPrefs.focusDurationMs === s.preferences.focusDurationMs &&
            nextPrefs.breakDurationMs === s.preferences.breakDurationMs &&
            nextPrefs.autoSwitchEnabled === s.preferences.autoSwitchEnabled &&
            nextPrefs.autoStartNextPhase === s.preferences.autoStartNextPhase

          if (same) return s

          return {
            ...s,
            preferences: nextPrefs,
            eventId: s.eventId + 1,
          }
        })
      },

      /**
       * maybeAutoAdvance(nowMs)
       * -----------------------------------------------------
       * Policy action triggered by the UI when physics says we hit the boundary.
       * Must be idempotent (safe if called repeatedly).
       *
       * Behavior:
       * 1) If not Running, no-op
       * 2) If not at boundary yet, no-op
       * 3) Stamp Complete (authoritative)
       * 4) If autoSwitchEnabled: switch phase
       *    - Always transitions to the next phase (Focus ↔ Break)
       *    - Auto-start is only allowed for Focus → Break (prevents infinite cycling)
       *    - Break → Focus will switch but remain Idle (ready for next cycle)
       */
      maybeAutoAdvance: (nowMs) => {
        return commitShared((s) => {
          if (s.status !== TimerStatus.Running) return s

          // Step 1: attempt to stamp completion
          const completed = completeIfNeeded(s, nowMs)

          // Not at boundary (or already complete) → no-op.
          if (completed === s) return s

          // Step 2: optional phase transition
          if (!completed.preferences.autoSwitchEnabled) return completed

          const nextPhase =
            completed.phase === TimerPhase.Focus
              ? TimerPhase.Break
              : TimerPhase.Focus

          const shouldAutoStart =
            Boolean(completed.preferences.autoStartNextPhase) &&
            completed.phase === TimerPhase.Focus

          return switchPhaseInternal(
            completed,
            nextPhase,
            nowMs,
            shouldAutoStart,
          )
        })
      },

      /**
       * setPhaseDurationMs(phase, durationMs)
       * -----------------------------------------------------
       * Authoritative update of a phase’s total duration.
       *
       * This action is intentionally **duration-centric**, not UI-centric:
       * - The store owns time baselines and invariants
       * - The UI is free to debounce, pause, and edit optimistically
       *
       * Responsibilities:
       * 1) Update the appropriate preference field
       *    - focus → preferences.focusDurationMs
       *    - break → preferences.breakDurationMs
       *
       * 2) Preserve timing invariants for the *active* phase
       *    - Elapsed time is derived from baselines, never stored directly
       *    - Duration edits must not create negative remaining time
       *
       * Active-phase behavior:
       * - If the edited phase is currently active:
       *   - Compute elapsed time as of "now"
       *   - If elapsed >= new duration:
       *       • Stamp the timer as Complete (authoritative boundary)
       *       • Clamp accumulatedMs to the new duration
       *       • Clear startedAtMs to freeze time progression
       *   - Otherwise:
       *       • Keep existing baselines (no visual jump)
       *       • Optionally clamp accumulatedMs when not running
       *
       * Design notes:
       * - This action is safe to call repeatedly (idempotent for same inputs)
       * - It does NOT start, pause, or reset the timer
       * - Completion is stamped explicitly here to avoid UI-side edge cases
       * - UI code is expected to pause + debounce edits for better UX,
       *   but correctness does not depend on it
       *
       * Typical UI usage:
       * - Pause once when editing begins (if running)
       * - Debounce calls while typing
       * - Commit final value on blur / Enter
       */
      setPhaseDurationMs: (phase, durationMs) => {
        return commitShared((s) => {
          const nextMs = Math.max(1_000, Math.floor(durationMs)) // pick your min/max policy

          const isFocus = phase === TimerPhase.Focus
          const prevMs = isFocus
            ? s.preferences.focusDurationMs
            : s.preferences.breakDurationMs

          if (prevMs === nextMs) return s

          const nextPrefs = {
            ...s.preferences,
            ...(isFocus
              ? { focusDurationMs: nextMs }
              : { breakDurationMs: nextMs }),
          }

          // If we're editing a non-active phase, do a prefs-only write.
          if (s.phase !== phase) {
            return {
              ...s,
              preferences: nextPrefs,
              eventId: s.eventId + 1,
            }
          }

          // Active phase: update prefs, then let completeIfNeeded decide
          // if we must stamp completion.
          const nowMs = nowMsDefault()

          const withPrefs: TimerState = {
            ...s,
            preferences: nextPrefs,
            // NOTE: don't bump eventId yet; completion stamping would do its own bump.
          }

          const completedOrSame = completeIfNeeded(withPrefs, nowMs)

          // If completion was stamped (or state otherwise changed by the helper), return that.
          // `completeIfNeeded` increments eventId when it stamps completion.
          if (completedOrSame !== withPrefs) return completedOrSame

          // Not complete: keep baselines intact to avoid visual jumps.
          // Optional normalization when not running:
          // - If someone shrank duration but we haven't reached it (elapsed < total),
          //   accumulatedMs should already be < total. This clamp is purely defensive.
          const normalizedAccumulated =
            s.status === TimerStatus.Running
              ? s.accumulatedMs
              : Math.min(s.accumulatedMs, nextMs)

          return {
            ...s,
            preferences: nextPrefs,
            accumulatedMs: normalizedAccumulated,
            eventId: s.eventId + 1,
          }
        })
      },
    }
  },
)

// Convenience exports
export const useTimer = timer.useStore
export const initTimerCrossTabSync = timer.initSync
export const refreshTimerFromStorage = timer.refreshFromStorage
export const getTimerSnapshot = timer.getSnapshot
export const getTimerTabId = timer.getTabId

export { deriveTimerView } from "./utilities"
export { getElapsedFromBaselines } from "./utilities"

export type { TimerState, TimerView } from "./types"
export { TimerStatus, TimerPhase } from "./types"
