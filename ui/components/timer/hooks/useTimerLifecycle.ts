import { useEffect, useMemo } from "react"
import { timer, deriveTimerView } from "@data/state/timer"
import { TimerStatus } from "@data/state/timer/types"
import type {
  TimerPhase,
  TimerStatus as TimerStatusT,
} from "@data/state/timer/types"

export interface TimerDisplay {
  remainingSeconds: number
  progress: number
  elapsedMs: number
  remainingMs: number
  totalMs: number
  phase: TimerPhase
  status: TimerStatusT
  isComplete: boolean
}

/**
 * useTimerLifecycle
 * ---------------------------------------------------------
 * Timer lifecycle coordinator driven by a throttled UI clock.
 *
 * Responsibilities:
 * - Interpret shared timer baselines against a sampled time (`throttledThrottledNowMs`).
 * - Reconcile authoritative lifecycle transitions when phase boundaries are reached
 *   (e.g. completion, auto-switch, auto-start).
 * - Produce minimal UI-facing values needed by the timer shell
 *   (e.g. formatted label, phase, status).
 *
 * Inputs:
 * - `throttledThrottledNowMs` is a UI sampling signal (typically from `useThrottledNowMs`).
 *   It is NOT an animation clock and does not advance shared truth by itself.
 *
 * Timing model:
 * - All elapsed / remaining math is delegated to `deriveTimerView`, which is
 *   pure and deterministic given (TimerState + nowMs).
 * - The store remains the single source of truth for timing baselines and intent.
 *
 * Policy reconciliation:
 * - When Running and the phase boundary is reached, this hook triggers
 *   idempotent, cross-tab-safe domain actions (e.g. `maybeAutoAdvance`).
 * - This hook is the *only* place where time-based lifecycle stamping occurs.
 *
 * What this hook intentionally does NOT do:
 * - No animation or high-frequency updates (SVG/rAF visuals handle that).
 * - No ticking or scheduling (delegated to `useThrottledNowMs`).
 * - No direct mutation of shared state outside explicit domain actions.
 *
 * Design intent:
 * - Centralize time-based lifecycle decisions.
 * - Keep React renders coarse and intentional.
 * - Separate lifecycle policy from visual animation concerns.
 */
export function useTimerLifecycle(throttledNowMs: number): TimerDisplay {
  const state = timer.useStore((s) => s.shared.data)
  const maybeAutoAdvance = timer.useStore((s) => s.actions.maybeAutoAdvance)

  const view = useMemo(
    () => deriveTimerView(state, throttledNowMs),
    [state, throttledNowMs],
  )

  useEffect(() => {
    if (view.status !== TimerStatus.Running) return
    if (!view.shouldComplete) return
    maybeAutoAdvance(throttledNowMs)
  }, [view.status, view.shouldComplete, throttledNowMs, maybeAutoAdvance])

  const remainingSeconds = Math.max(0, Math.ceil(view.remainingMs / 1000))

  return {
    remainingSeconds,
    progress: view.progress,
    elapsedMs: view.elapsedMs,
    remainingMs: view.remainingMs,
    totalMs: view.totalMs,
    phase: view.phase,
    status: view.status,
    isComplete: view.isComplete,
  }
}
