import style from "./style.module.css"

import { useTimers, TimerStatus } from "@data/state/timer"
import { useEffect, useState } from "react"
import { useTimerActions, useTimerMaybe } from "./utilities"

/**
 * Timer
 * ---
 * A basic timer to time things basically while time elapses in a basic timeline
 * ... basically
 */
export function Timers() {
  const [activeTimer, setActiveTimer] = useState<string>("focus")
  const makeFocusActive = () => setActiveTimer("focus")
  const makeBreakActive = () => setActiveTimer("break")

  const activeClass =
    activeTimer === "focus" ? style.focusActive : style.breakActive
  return (
    <div className={style.base} data-testid="timer">
      <div className={style.inner}>
        <div className={`${style.tabs} ${activeClass}`}>
          <button onClick={makeFocusActive}>Focus</button>
          <button onClick={makeBreakActive}>Break</button>
        </div>
        {activeTimer === "focus" ? (
          <TimerBlock id="focus" initialTime={25} />
        ) : (
          <TimerBlock id="break" initialTime={5} />
        )}
      </div>
    </div>
  )
}

export function TimerBlock({
  id,
  initialTime,
}: {
  id: string
  initialTime: number
}) {
  useEffect(() => {
    const st = useTimers.getState()
    if (st.has(id)) st.bind(id).start()
    if (!st.has(id)) st.create(id, initialTime)

    return () => st.bind(id).pause()
  }, [id])

  const data = useTimerMaybe(id) // may be null on first render
  const actions = useTimerActions(id) // safe no-ops until exists

  if (!data) return <div>Loading Timer…</div>

  const { elapsedMs, status, totalTime } = data
  const isRunning = status === TimerStatus.Running

  const elapsedTime = Math.round(totalTime * 60) - Math.round(elapsedMs / 1000)
  const minutes = Math.floor(elapsedTime / 60)
  const seconds = elapsedTime % 60
  const timeDisplay = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  const countdownClass = isRunning ? style.running : ""
  const percentageElapsed =
    Math.round(elapsedMs / 1000) / Math.round(totalTime * 60)

  if (elapsedTime <= 0) actions.reset()

  return (
    <div className={`${style.timerContainer} ${style[id]}`}>
      <div className={`${style.countdown} ${countdownClass}`}>
        {timeDisplay}
        <TimerRing />
        <TimeElapsed percentageElapsed={percentageElapsed} />
      </div>
      <div className={style.actions}>
        {isRunning ? (
          <button onClick={actions.pause}>
            <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
              <path d="M4.5 14h1A1.5 1.5 0 0 0 7 12.5v-9A1.5 1.5 0 0 0 5.5 2h-1A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14zM10.5 14h1a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 11.5 2h-1A1.5 1.5 0 0 0 9 3.5v9a1.5 1.5 0 0 0 1.5 1.5z" />
            </svg>
          </button>
        ) : (
          <button onClick={actions.start}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
              <path d="m2.992 13.498 0-10.996a1.5 1.5 0 0 1 2.245-1.303l9.621 5.498a1.5 1.5 0 0 1 0 2.605L5.237 14.8a1.5 1.5 0 0 1-2.245-1.302z" />
            </svg>
          </button>
        )}
        <button onClick={actions.reset}>
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
  )
}

export function TimerRing() {
  return (
    <svg
      className={style.activeRing}
      viewBox="0 0 162 162"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <circle
        cx="81"
        cy="81"
        r="77.4"
        className={style.ring}
        strokeWidth="7.2"
      />
      <mask id="path-3-inside-1_2661_125608" fill="white">
        <path d="M136.128 136.128C137.314 137.314 137.318 139.242 136.088 140.383C124.236 151.378 109.344 158.592 93.3193 161.058C76.2924 163.678 58.8737 160.801 43.5934 152.845C28.3132 144.89 15.9675 132.269 8.34963 116.818C0.7318 101.367 -1.7613 83.8887 1.2325 66.9236C4.2263 49.9585 12.5511 34.3897 24.9974 22.4789C37.4438 10.5682 53.3635 2.9359 70.4438 0.690799C87.5242 -1.5543 104.875 1.70473 119.977 9.99446C134.19 17.7962 145.713 29.6713 153.086 44.059C153.851 45.5521 153.188 47.3624 151.667 48.0711C150.146 48.7797 148.344 48.118 147.575 46.6273C140.751 33.4098 130.133 22.5002 117.054 15.3203C103.085 7.6524 87.0348 4.63782 71.2356 6.71452C55.4364 8.79123 40.7108 15.8511 29.198 26.8684C17.6852 37.8858 9.98484 52.2868 7.21559 67.9794C4.44634 83.672 6.75245 99.8389 13.7989 114.131C20.8453 128.424 32.2651 140.097 46.3992 147.456C60.5333 154.815 76.6455 157.476 92.3952 155.053C107.143 152.784 120.853 146.167 131.789 136.084C133.022 134.946 134.941 134.941 136.128 136.128Z" />
      </mask>
      <path
        className={style.pulse}
        d="M136.128 136.128C137.314 137.314 137.318 139.242 136.088 140.383C124.236 151.378 109.344 158.592 93.3193 161.058C76.2924 163.678 58.8737 160.801 43.5934 152.845C28.3132 144.89 15.9675 132.269 8.34963 116.818C0.7318 101.367 -1.7613 83.8887 1.2325 66.9236C4.2263 49.9585 12.5511 34.3897 24.9974 22.4789C37.4438 10.5682 53.3635 2.9359 70.4438 0.690799C87.5242 -1.5543 104.875 1.70473 119.977 9.99446C134.19 17.7962 145.713 29.6713 153.086 44.059C153.851 45.5521 153.188 47.3624 151.667 48.0711C150.146 48.7797 148.344 48.118 147.575 46.6273C140.751 33.4098 130.133 22.5002 117.054 15.3203C103.085 7.6524 87.0348 4.63782 71.2356 6.71452C55.4364 8.79123 40.7108 15.8511 29.198 26.8684C17.6852 37.8858 9.98484 52.2868 7.21559 67.9794C4.44634 83.672 6.75245 99.8389 13.7989 114.131C20.8453 128.424 32.2651 140.097 46.3992 147.456C60.5333 154.815 76.6455 157.476 92.3952 155.053C107.143 152.784 120.853 146.167 131.789 136.084C133.022 134.946 134.941 134.941 136.128 136.128Z"
        stroke="url(#paint0_linear_2661_125608)"
        strokeWidth="14.4"
        mask="url(#path-3-inside-1_2661_125608)"
      />
      <defs>
        <linearGradient
          className={style.runner}
          id="paint0_linear_2661_125608"
          x1="75.9375"
          y1="-17.3571"
          x2="28.8"
          y2="102.6"
          gradientUnits="userSpaceOnUse">
          <stop className={style.stopLight} offset="0.111763" />
          <stop className={style.stopMed} offset="0.551516" />
          <stop className={style.stopDark} offset="0.903846" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function TimeElapsed({
  percentageElapsed,
}: {
  percentageElapsed: number
}) {
  const strokeDash = `${percentageElapsed * 100}, 100`
  return (
    <svg viewBox="0 0 36 36">
      <path
        className={style.elapsedGutter}
        d="M18 2.0845
      a 15.9155 15.9155 0 0 1 0 31.831
      a 15.9155 15.9155 0 0 1 0 -31.831"
        fill="none"
        strokeWidth="1"
      />
      <path
        className={style.elapsed}
        d="M18 2.0845
      a 15.9155 15.9155 0 0 1 0 31.831
      a 15.9155 15.9155 0 0 1 0 -31.831"
        fill="none"
        strokeWidth="1"
        strokeDasharray={strokeDash}
      />
    </svg>
  )
}
