import { getRunningDelta } from "@common/utilities/time"
import { createSyncedStore } from "../_system"
import { completeIfNeeded, switchPhaseInternal, nowMsDefault } from "./helpers"
import { TimerPhase, TimerStatus } from "./types"

import type { SyncedStoreConfig } from "../_system/types"
import type { TimerActions, TimerState, TimerPreferences } from "./types"

export const DEFAULT_TIMER_PREFERENCES: TimerPreferences = {
  focusDurationMs: 25 * 60_000,
  breakDurationMs: 5 * 60_000,
  autoSwitchEnabled: true,
  autoStartNextPhase: false,
}

const DEFAULT_TIMER_STATE: TimerState = {
  preferences: DEFAULT_TIMER_PREFERENCES,
  phase: "focus",
  status: "paused",
  startedAtMs: null,
  accumulatedMs: 0,
  eventId: 0,
}

const TIMER_STORE_CONFIG: SyncedStoreConfig<TimerState> = {
  syncKey: "app:timer",
  schemaVersion: 1,
  initialData: DEFAULT_TIMER_STATE,
  restore: "session",
  onVisible: "refresh",
}

/**
 * timerStore
 * ---
 * Timer domain store (Pomodoro-style) that converges across tabs.
 *
 * Built on `createSyncedStore`:
 * - One shared `TimerState` across tabs (LWW / cross-tab convergence)
 * - Restore snapshots (localStorage, session-scoped)
 * - Best-effort refresh on visibility ("welcome back" catch-up)
 *
 * Data model philosophy:
 * - Shared state stores baselines + intent (no ticking writes)
 * - UI derives progression from `nowMs` + pure helpers
 * - All shared mutations flow through explicit domain actions
 *
 * Responsibilities:
 * - Persist and sync: phase, status, preferences, baselines
 * - Stamp authoritative lifecycle transitions (start / pause / complete / switch)
 * - Provide idempotent policy actions safe across tabs (e.g. `advance`)
 *
 * Non-goals:
 * - No intervals / ticking inside the store
 * - No UI formatting or view derivation
 * - No implicit completion inferred by UI; boundaries are stamped explicitly
 * - Does not wash dishes (tragically)
 *
 * Related:
 * - `deriveTimerView` — pure derivation from state + nowMs
 * - `useNow` — visibility-aware clock signal for UI updates
 * - `useTimerDisplay` — UI-facing hook built on derivation + policy
 * - `advance(nowMs)` — UI-triggered policy action for boundary stamping
 *
 * Odds of inner peace:
 * - non-zero, but not guaranteed ... working on it.
 */
export const timer = createSyncedStore<TimerState, TimerActions>(
  TIMER_STORE_CONFIG,
  ({ commit }) => {
    return {
      start: () => {
        return commit((s) => {
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
        return commit((s) => {
          if (s.status !== TimerStatus.Running) return s
          if (s.startedAtMs == null) return s

          const nowMs = nowMsDefault()
          const accumulatedMs = getRunningDelta({
            isRunning: s.status === TimerStatus.Running,
            startedAtMs: s.startedAtMs,
            accumulatedMs: s.accumulatedMs,
            nowMs,
          })

          return {
            ...s,
            status: TimerStatus.Paused,
            startedAtMs: null,
            accumulatedMs,
            eventId: s.eventId + 1,
          }
        })
      },

      resetPhase: () => {
        return commit((s) => ({
          ...s,
          status: TimerStatus.Idle,
          startedAtMs: null,
          accumulatedMs: 0,
          eventId: s.eventId + 1,
        }))
      },

      reset: () => {
        return commit(() => DEFAULT_TIMER_STATE)
      },

      advance: (nowMs: number) => {
        return commit((s) => {
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

      switchPhase: (nextPhase) => {
        // Manual switch is deliberately boring: reset and go Idle.
        return commit((s) =>
          switchPhaseInternal(s, nextPhase, nowMsDefault(), false),
        )
      },

      setPreferences: (patch) => {
        return commit((s) => {
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

      setPhaseDurationMs: (phase, durationMs) => {
        return commit((s) => {
          const nextMs = Math.max(1_000, Math.floor(durationMs))

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

          // `completeIfNeeded` increments eventId when it stamps completion.
          if (completedOrSame !== withPrefs) return completedOrSame

          // Not complete: keep baselines intact to avoid visual jumps.
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
export const useTimer = timer.useStore // keep things
export { deriveTimerView } from "./helpers"

export type { TimerState, TimerView } from "./types"
export { TimerStatus, TimerPhase } from "./types"
