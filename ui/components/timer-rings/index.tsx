import style from "./style.module.css"

import { polarToCartesian } from "@common/utilities/coords"
import { useEffect, useId, useMemo, useRef } from "react"
import { useRotation } from "./hooks/useRotation"
import { getElapsedFromBaselines } from "@data/state/timer"
import { TimerPhase, TimerStatus, useTimer } from "@data/state/timer"
import type {
  TimerPhase as TimerPhaseType,
  TimerStatus as TimerStatusType,
} from "@data/state/timer"

/**
 * TimerRings
 * ---
 * The fanciest of pants for this timer. These are the visual representations of
 * elapsed time
 *
 * - TimerRing — The running indicator that spins around the timer
 * - TimeElapsed — The progress ring that shows how much time has elapsed
 * - TimeTickMarks — Tick marks around the ring to show passage of time (optional)
 *
 * This is a convenience wrapper to separate fancy from boring.  We DO NOT pass
 * state into this from props to avoid render thrashing. Rendering every MS tick
 * even when throttled can be expensive, and we don't want unnecessary renders
 * like the TimeTickMarks ... very sure those aren't gonna change once rendered
 */
export function TimerRings() {
  return (
    <div className={style.base} data-testid="timer-rings">
      <TimerSpinner />
      <TimeElapsed />
      <TimeTickMarks />
    </div>
  )
}

/**
 * TimerSpinner
 * ---
 * Smooth “working” ring that:
 * - animates via rAF (not store ticks) for buttery visuals
 * - stays deterministic across tabs by anchoring to persisted baselines:
 *   startedAtMs + accumulatedMs
 * - reads directly from the timer store (no prop plumbing)
 *
 * Also:
 * - uses unique SVG ids to avoid mask/gradient collisions if rendered multiple times
 */
export function TimerSpinner() {
  const status = useTimer((s) => s.shared.data.status)
  const phase = useTimer((s) => s.shared.data.phase)
  const startedAtMs = useTimer((s) => s.shared.data.startedAtMs)
  const accumulatedMs = useTimer((s) => s.shared.data.accumulatedMs)

  const isRunning = status === TimerStatus.Running

  const secondsToRotate = 5

  return (
    <TimerSpinnerDisplay
      phase={phase}
      isRunning={isRunning}
      startedAtMs={startedAtMs}
      accumulatedMs={accumulatedMs}
      periodMs={secondsToRotate * 1000}
    />
  )
}

/**
 * TimerSpinnerDisplay
 * ---
 * Visual + motion for the "working" ring.
 *
 * Responsibilities:
 * - Render the SVG shapes/gradients/masks.
 * - Drive rotation animation (rAF) via useRotation.
 * - Remain deterministic across tabs by anchoring animation to baselines:
 *   startedAtMs + accumulatedMs
 *
 * What this component intentionally does NOT do:
 * - No store access.
 * - No domain decisions (it does not decide what "running" means).
 *
 * This component exists as a "storeless visual primitive" so Storybook can
 * render the ring without any timer state bootstrapping.
 */
export function TimerSpinnerDisplay({
  phase,
  isRunning,
  startedAtMs,
  accumulatedMs,
  periodMs,
}: {
  phase: TimerPhaseType
  isRunning: boolean
  startedAtMs: number | null
  accumulatedMs: number
  periodMs: number
}) {
  const { attach } = useRotation({
    isRunning,
    startedAtMs,
    accumulatedMs,
    periodMs,
  })

  const uid = useId()
  const maskId = useMemo(() => `timer-ring-inside-${uid}`, [uid])
  const gradientId = useMemo(() => `timer-ring-gradient-${uid}`, [uid])

  const ringClass = [
    isRunning && style.running,
    phase === TimerPhase.Break && style.break,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <svg
      className={ringClass}
      viewBox="0 0 162 162"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <circle cx="81" cy="81" r="77.4" className={style.ring} strokeWidth="7" />

      <g ref={attach} style={{ willChange: "transform" }}>
        <mask id={maskId} fill="white">
          <path d="M136.128 136.128C137.314 137.314 137.318 139.242 136.088 140.383C124.236 151.378 109.344 158.592 93.3193 161.058C76.2924 163.678 58.8737 160.801 43.5934 152.845C28.3132 144.89 15.9675 132.269 8.34963 116.818C0.7318 101.367 -1.7613 83.8887 1.2325 66.9236C4.2263 49.9585 12.5511 34.3897 24.9974 22.4789C37.4438 10.5682 53.3635 2.9359 70.4438 0.690799C87.5242 -1.5543 104.875 1.70473 119.977 9.99446C134.19 17.7962 145.713 29.6713 153.086 44.059C153.851 45.5521 153.188 47.3624 151.667 48.0711C150.146 48.7797 148.344 48.118 147.575 46.6273C140.751 33.4098 130.133 22.5002 117.054 15.3203C103.085 7.6524 87.0348 4.63782 71.2356 6.71452C55.4364 8.79123 40.7108 15.8511 29.198 26.8684C17.6852 37.8858 9.98484 52.2868 7.21559 67.9794C4.44634 83.672 6.75245 99.8389 13.7989 114.131C20.8453 128.424 32.2651 140.097 46.3992 147.456C60.5333 154.815 76.6455 157.476 92.3952 155.053C107.143 152.784 120.853 146.167 131.789 136.084C133.022 134.946 134.941 134.941 136.128 136.128Z" />
        </mask>

        <path
          className={style.spinner}
          d="M136.128 136.128C137.314 137.314 137.318 139.242 136.088 140.383C124.236 151.378 109.344 158.592 93.3193 161.058C76.2924 163.678 58.8737 160.801 43.5934 152.845C28.3132 144.89 15.9675 132.269 8.34963 116.818C0.7318 101.367 -1.7613 83.8887 1.2325 66.9236C4.2263 49.9585 12.5511 34.3897 24.9974 22.4789C37.4438 10.5682 53.3635 2.9359 70.4438 0.690799C87.5242 -1.5543 104.875 1.70473 119.977 9.99446C134.19 17.7962 145.713 29.6713 153.086 44.059C153.851 45.5521 153.188 47.3624 151.667 48.0711C150.146 48.7797 148.344 48.118 147.575 46.6273C140.751 33.4098 130.133 22.5002 117.054 15.3203C103.085 7.6524 87.0348 4.63782 71.2356 6.71452C55.4364 8.79123 40.7108 15.8511 29.198 26.8684C17.6852 37.8858 9.98484 52.2868 7.21559 67.9794C4.44634 83.672 6.75245 99.8389 13.7989 114.131C20.8453 128.424 32.2651 140.097 46.3992 147.456C60.5333 154.815 76.6455 157.476 92.3952 155.053C107.143 152.784 120.853 146.167 131.789 136.084C133.022 134.946 134.941 134.941 136.128 136.128Z"
          stroke={`url(#${gradientId})`}
          strokeWidth="16"
          mask={`url(#${maskId})`}
        />

        <defs>
          <linearGradient
            className={style.runner}
            id={gradientId}
            x1="80"
            y1="-18"
            x2="28.8"
            y2="102.6"
            gradientUnits="userSpaceOnUse">
            <stop className={style.stopLight} offset="0.111763" />
            <stop className={style.stopMed} offset="0.551516" />
            <stop className={style.stopDark} offset="0.903846" />
          </linearGradient>
        </defs>
      </g>
    </svg>
  )
}

/**
 * TimeElapsed
 * ---
 * Visual progress ring representing how much of the current timer phase
 * has elapsed.
 *
 * Responsibilities:
 * - Renders a circular progress arc from 0 → 100%.
 * - Progress is purely visual; it does not drive timing or state.
 *
 * Design notes:
 * - The arc uses `strokeDasharray` with a normalized 0–100 scale so it
 *   remains resolution-independent and easy to reason about.
 * - The path starts at the top of the circle (-90°) to match conventional
 *   clock / timer orientation.
 * - Any easing or smoothing of progress should be applied *before*
 *   passing `percentageElapsed` to this component.
 *
 * What this component intentionally does NOT do:
 * - No animation timing.
 * - No easing logic.
 * - No awareness of timer phase, status, or completion.
 *
 * It is a pure, deterministic visual mapping of a percentage to an arc.
 */
export function TimeElapsed() {
  // Baselines (persisted + cross-tab)
  const phase = useTimer((s) => s.shared.data.phase)
  const status = useTimer((s) => s.shared.data.status)
  const startedAtMs = useTimer((s) => s.shared.data.startedAtMs)
  const accumulatedMs = useTimer((s) => s.shared.data.accumulatedMs)

  // Durations come from preferences (also persisted).
  const focusDurationMs = useTimer((s) => s.shared.data.preferences.focusDurationMs) //prettier-ignore
  const breakDurationMs = useTimer((s) => s.shared.data.preferences.breakDurationMs) //prettier-ignore

  const isRunning = status === TimerStatus.Running

  return (
    <TimeElapsedDisplay
      phase={phase}
      status={status}
      isRunning={isRunning}
      startedAtMs={startedAtMs}
      accumulatedMs={accumulatedMs}
      focusDurationMs={focusDurationMs}
      breakDurationMs={breakDurationMs}
    />
  )
}

/**
 * TimeElapsedDisplay
 * ---
 * Visual + motion for the progress arc.
 *
 * Responsibilities:
 * - Render the SVG path geometry for the arc.
 * - Drive the arc visually via rAF by mapping elapsedMs → strokeDasharray.
 * - Remain deterministic across tabs by anchoring progress to persisted baselines:
 *   startedAtMs + accumulatedMs
 *
 * What this component intentionally does NOT do:
 * - No store access.
 * - No domain decisions about phase/status; it consumes those as inputs.
 *
 * This component exists as a "store-less visual primitive" so Storybook can
 * render the arc without any timer state bootstrapping.
 */
export function TimeElapsedDisplay({
  phase,
  status,
  isRunning,
  startedAtMs,
  accumulatedMs,
  focusDurationMs,
  breakDurationMs,
}: {
  phase: TimerPhaseType
  status: TimerStatusType
  isRunning: boolean
  startedAtMs: number | null
  accumulatedMs: number
  focusDurationMs: number
  breakDurationMs: number
}) {
  const totalMs = useMemo(() => {
    return phase === TimerPhase.Focus ? focusDurationMs : breakDurationMs
  }, [phase, focusDurationMs, breakDurationMs])

  // Ref to the path we will mutate imperatively.
  const pathRef = useRef<SVGPathElement | null>(null)

  useEffect(() => {
    const node = pathRef.current
    if (!node) return

    let raf = 0

    const tick = () => {
      const wallNowMs = Date.now()
      const elapsedMs = getElapsedFromBaselines({
        status,
        startedAtMs,
        accumulatedMs,
        nowMs: wallNowMs,
      })

      // Progress in [0,1]. If total is 0, treat as complete.
      const progress = totalMs <= 0 ? 1 : Math.min(1, elapsedMs / totalMs)

      // SVG uses 0–100 normalized dash units.
      const dash = `${progress * 100}, 100`
      node.setAttribute("stroke-dasharray", dash)

      // Keep animating only while running. When paused/idle, we set once and stop.
      if (isRunning) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // Important: include baselines + totalMs + status so we "rebase" on changes.
  }, [isRunning, status, startedAtMs, accumulatedMs, totalMs])

  return (
    <svg viewBox="0 0 36 36">
      <path
        ref={pathRef}
        className={style.elapsed}
        d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0 -31.831"
        fill="none"
        strokeWidth="1.4"
        strokeDasharray="0, 100"
      />
    </svg>
  )
}

/**
 * TimeTickMarks
 * ---
 * Static tick marks rendered around the timer ring to provide
 * visual structure and temporal reference.
 *
 * Tick layout:
 * - Minor ticks: 24 evenly spaced markers (e.g. ~minutes or segments)
 * - Major ticks: 4 markers (quarter divisions)
 *
 * Design notes:
 * - Ticks are rendered as simple SVG lines using polar coordinates,
 *   converted to cartesian space.
 * - Minor and major ticks differ only in length and styling; their
 *   angular math is identical.
 * - The start angle is -90° so the first tick aligns with the top
 *   of the ring, matching the progress arc and timer semantics.
 *
 * Rendering considerations:
 * - Uses `vectorEffect="non-scaling-stroke"` so stroke widths remain
 *   visually consistent regardless of SVG scaling.
 * - Tick geometry is intentionally static; ticks do not animate
 *   or respond to timer state.
 *
 * What this component intentionally does NOT do:
 * - No knowledge of progress, phase, or status.
 * - No highlighting or dynamic behavior.
 *
 * This component exists purely to provide spatial context for the
 * animated elements layered above it.
 */
export function TimeTickMarks() {
  const cx = 18
  const cy = 18
  const r = 15.9155
  const startAngle = -Math.PI / 2

  const minorInset = 0.7
  const minorOutset = 0.5
  const majorInset = 1.5
  const majorOutset = 0.5

  const minorAngles = Array.from(
    { length: 24 },
    (_, i) => startAngle + (i * (2 * Math.PI)) / 24,
  )
  const majorAngles = Array.from(
    { length: 4 },
    (_, i) => startAngle + (i * (2 * Math.PI)) / 4,
  )

  return (
    <svg viewBox="0 0 36 36">
      <g className={style.elapsedTicks} vectorEffect="non-scaling-stroke">
        {minorAngles.map((a, i) => {
          const p1 = polarToCartesian(cx, cy, r - minorInset, a)
          const p2 = polarToCartesian(cx, cy, r + minorOutset, a)
          return (
            <line
              key={`minor-${i}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              className={style.elapsedTickMinor}
            />
          )
        })}

        {majorAngles.map((a, i) => {
          const p1 = polarToCartesian(cx, cy, r - majorInset, a)
          const p2 = polarToCartesian(cx, cy, r + majorOutset, a)
          return (
            <line
              key={`major-${i}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              className={style.elapsedTickMajor}
            />
          )
        })}
      </g>
    </svg>
  )
}
