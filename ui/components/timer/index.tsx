import style from "./style.module.css"

import { useEffect } from "react"
import { TimerLabel } from "../timer-label"
import { TimerMenu } from "../timer-menu"
import { TimerRings } from "../timer-rings"
import { useThrottledNowMs } from "./hooks/useThrottledNowMs"
import { useTimerLifecycle } from "./hooks/useTimerLifecycle"
import { initTimerCrossTabSync, useTimer } from "@data/state/timer"
import { TimerStatus } from "@data/state/timer/types"

/**
 * Timer
 * ---
 * Single pomodoro-style timer:
 * - authoritative state in zustand + persisted across tabs
 * - derived view based on shared nowMs so text + rings stay locked
 * - cross-tab sync installed once
 *
 * UI note:
 * - Preferences editing is handled by a UI hook (`useTimerPreferencesUi`)
 *   so the main Timer render stays small and readable.
 */
export function Timer() {
  // One throttled clock per mounted timer tree.
  const throttledNowMs = useThrottledNowMs({ maxFps: 30, minIntervalMs: 250 })

  // Display formatting and reconcile completion boundary if needed.
  const { phase, status, remainingSeconds, totalMs } =
    useTimerLifecycle(throttledNowMs)

  // Domain actions: authoritative mutations (persisted + cross-tab).
  const start = useTimer((s) => s.actions.start)
  const pause = useTimer((s) => s.actions.pause)
  const reset = useTimer((s) => s.actions.resetPhase)
  const switchPhase = useTimer((s) => s.actions.switchPhase)
  const setPhaseDurationMs = useTimer((s) => s.actions.setPhaseDurationMs)

  // Install cross-tab + visibility syncing once.
  useEffect(() => initTimerCrossTabSync(), [])

  /**
   * Some projects return TimerStatus as a string from `useTimerDisplay`.
   * If yours already returns the enum, you can delete this.
   */
  const isRunning =
    status === TimerStatus.Running ||
    status === ("running" as unknown as TimerStatus)

  const activeClass = phase === "focus" ? style.focusActive : style.breakActive

  const onFocus = () => switchPhase("focus")
  const onBreak = () => switchPhase("break")

  return (
    <div className={style.base} data-testid="timer">
      <div className={`${style.inner} ${activeClass}`}>
        <header>
          <div>Timer</div>
          <TimerMenu />
        </header>
        <div className={style.tabs}>
          <button
            type="button"
            onClick={onFocus}
            aria-pressed={phase === "focus"}>
            Focus
          </button>

          <button
            type="button"
            onClick={onBreak}
            aria-pressed={phase === "break"}>
            Break
          </button>
        </div>
        <div className={style.timerFace}>
          <TimerLabel
            remainingSeconds={remainingSeconds}
            phase={phase}
            isRunning={isRunning}
            totalMs={totalMs}
            pause={pause}
            setPhaseDurationMs={setPhaseDurationMs}
          />
          <TimerRings />
        </div>
        <div className={style.actions}>
          {isRunning ? (
            <button type="button" onClick={pause} aria-label="Pause">
              <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                <path d="M4.5 14h1A1.5 1.5 0 0 0 7 12.5v-9A1.5 1.5 0 0 0 5.5 2h-1A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14zM10.5 14h1a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 11.5 2h-1A1.5 1.5 0 0 0 9 3.5v9a1.5 1.5 0 0 0 1.5 1.5z" />
              </svg>
            </button>
          ) : (
            <button type="button" onClick={start} aria-label="Start">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                <path d="m2.992 13.498 0-10.996a1.5 1.5 0 0 1 2.245-1.303l9.621 5.498a1.5 1.5 0 0 1 0 2.605L5.237 14.8a1.5 1.5 0 0 1-2.245-1.302z" />
              </svg>
            </button>
          )}

          <button onClick={reset}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path
                d="M7.5 0.5C10.0599 0.5 12.3193 1.79042 13.6709 3.75391L14.8037 2.62109C15.1007 2.32409 15.6094 2.5341 15.6094 2.9541V6.5293C15.6092 6.78916 15.3976 7 15.1377 7H11.5635C11.1435 7 10.9335 6.49229 11.2305 6.19629L12.5889 4.83594C11.5304 3.13507 9.6472 2 7.5 2C4.191 2 1.5 4.691 1.5 8C1.5 11.309 4.191 14 7.5 14C10.468 14 12.9322 11.833 13.4102 9H14.9248C14.4338 12.663 11.296 15.5 7.5 15.5C3.364 15.5 0 12.136 0 8C0 3.864 3.364 0.5 7.5 0.5Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
