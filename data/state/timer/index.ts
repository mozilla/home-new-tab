import { getRunningDelta } from "@common/utilities/time"
import { createSyncedStore } from "../_system"
import { completeIfNeeded, switchPhaseInternal, nowMsDefault } from "./helpers"
import { TimerPhase, TimerStatus } from "./types"

import type { SyncedStoreConfig } from "../_system/types" //prettier-ignore
import type { TimerActions, TimerData, TimerPreferences } from "./types"

const DEFAULT_TIMER_PREFERENCES: TimerPreferences = {
  focusDurationMs: 25 * 60_000,
  breakDurationMs: 5 * 60_000,
  autoSwitchEnabled: true,
  autoStartNextPhase: false,
}

export const DEFAULT_TIMER_DATA: TimerData = {
  preferences: DEFAULT_TIMER_PREFERENCES,
  phase: "focus",
  status: "paused",
  startedAtMs: null,
  accumulatedMs: 0,
  eventId: 0,
}

const TIMER_STORE_CONFIG: SyncedStoreConfig<TimerData> = {
  syncKey: "app:timer",
  schemaVersion: 1,
  initialData: DEFAULT_TIMER_DATA,
  restore: "session",
  onVisible: "refresh",
}

/**
 * Timer (Pomodoro-ish)
 * ---------------------------------------------------------
 * Shared baseline state + actions.
 * Time progression is derived (we don’t tick the store).
 * Cross-tab sync + restore handled by the _system.
 */
export const timer = createSyncedStore<{
  data: TimerData
  actions: TimerActions
}>(TIMER_STORE_CONFIG, ({ commit }) => {
  return {
    start: () => {
      return commit((state) => {
        if (state.status === TimerStatus.Running) return state

        const nowMs = nowMsDefault()

        // Starting from Complete restarts the same phase cleanly.
        const restarting = state.status === TimerStatus.Complete

        return {
          ...state,
          status: TimerStatus.Running,
          startedAtMs: nowMs,
          accumulatedMs: restarting ? 0 : state.accumulatedMs,
          eventId: state.eventId + 1,
        }
      })
    },

    pause: () => {
      return commit((state) => {
        if (state.status !== TimerStatus.Running) return state
        if (state.startedAtMs == null) return state

        const nowMs = nowMsDefault()

        // Freeze running time into accumulatedMs, then clear startedAtMs.
        const accumulatedMs = getRunningDelta({
          isRunning: state.status === TimerStatus.Running,
          startedAtMs: state.startedAtMs,
          accumulatedMs: state.accumulatedMs,
          nowMs,
        })

        return {
          ...state,
          status: TimerStatus.Paused,
          startedAtMs: null,
          accumulatedMs,
          eventId: state.eventId + 1,
        }
      })
    },

    resetPhase: () => {
      return commit((state) => ({
        ...state,
        status: TimerStatus.Idle,
        startedAtMs: null,
        accumulatedMs: 0,
        eventId: state.eventId + 1,
      }))
    },

    reset: () => {
      // Full reset is allowed to be blunt: preferences + baselines.
      return commit(() => DEFAULT_TIMER_DATA)
    },

    advance: (nowMs: number) => {
      return commit((state) => {
        if (state.status !== TimerStatus.Running) return state

        // Step 1: attempt to stamp completion
        const completed = completeIfNeeded(state, nowMs)

        // Not at boundary (or already complete) → no-op.
        // Explicitly an identity check here, not a value check
        if (completed === state) return state

        // Step 2: optional phase transition
        if (!completed.preferences.autoSwitchEnabled) return completed

        const nextPhase =
          completed.phase === TimerPhase.Focus
            ? TimerPhase.Break
            : TimerPhase.Focus

        // autoStart only applies when leaving Focus → Break (keeps "break auto-run" intentional)
        const shouldAutoStart =
          Boolean(completed.preferences.autoStartNextPhase) &&
          completed.phase === TimerPhase.Focus

        return switchPhaseInternal(completed, nextPhase, nowMs, shouldAutoStart)
      })
    },

    switchPhase: (nextPhase) => {
      // Manual switch is deliberately boring: reset and go Idle.
      return commit((state) =>
        switchPhaseInternal(state, nextPhase, nowMsDefault(), false),
      )
    },

    setPreferences: (patch) => {
      return commit((state) => {
        const nextPrefs = { ...state.preferences, ...patch }

        const same =
          nextPrefs.focusDurationMs === state.preferences.focusDurationMs &&
          nextPrefs.breakDurationMs === state.preferences.breakDurationMs &&
          nextPrefs.autoSwitchEnabled === state.preferences.autoSwitchEnabled &&
          nextPrefs.autoStartNextPhase === state.preferences.autoStartNextPhase

        if (same) return state

        return {
          ...state,
          preferences: nextPrefs,
          eventId: state.eventId + 1,
        }
      })
    },

    setPhaseDurationMs: (phase, durationMs) => {
      return commit((state) => {
        // Clamp for sanity: avoids 0/negatives and keeps "slider spam" stable.
        const nextMs = Math.max(1_000, Math.floor(durationMs))

        const isFocus = phase === TimerPhase.Focus
        const prevMs = isFocus
          ? state.preferences.focusDurationMs
          : state.preferences.breakDurationMs

        if (prevMs === nextMs) return state

        const nextPrefs = {
          ...state.preferences,
          ...(isFocus
            ? { focusDurationMs: nextMs }
            : { breakDurationMs: nextMs }),
        }

        // If we're editing a non-active phase, do a prefs-only write.
        if (state.phase !== phase) {
          return {
            ...state,
            preferences: nextPrefs,
            eventId: state.eventId + 1,
          }
        }

        // Active phase: update prefs, then let completeIfNeeded decide
        // if we must stamp completion.
        const nowMs = nowMsDefault()

        const withPrefs: TimerData = {
          ...state,
          preferences: nextPrefs,
          // NOTE: don't bump eventId yet; completion stamping would do its own bump.
        }

        const completedOrSame = completeIfNeeded(withPrefs, nowMs)

        // `completeIfNeeded` increments eventId when it stamps completion.
        if (completedOrSame !== withPrefs) return completedOrSame

        // Not complete: keep baselines intact to avoid visual jumps.
        const normalizedAccumulated =
          state.status === TimerStatus.Running
            ? state.accumulatedMs
            : Math.min(state.accumulatedMs, nextMs)

        return {
          ...state,
          preferences: nextPrefs,
          accumulatedMs: normalizedAccumulated,
          eventId: state.eventId + 1,
        }
      })
    },
  }
})

/**
 * useTimer
 * ---------------------------------------------------------
 * Main UI hook for the timer domain.
 *
 * Exposes only:
 * - data (authoritative shared timer state)
 * - actions (domain + base system actions)
 *
 * Use selectors whenever possible for performance:
 *
 *   useTimer(s => s.data.status)
 *   useTimer(s => s.data.preferences.focusDurationMs)
 */
export const useTimer = timer.use

/** TESTS/DEBUG ONLY: raw Zustand store (includes _internal). */
export const useTimerStore = timer.debug._unsafe_useStore

export { deriveTimerView } from "./helpers"

export type { TimerData, TimerView } from "./types"
export { TimerStatus, TimerPhase } from "./types"
