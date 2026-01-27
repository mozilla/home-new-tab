import style from "./style.module.css"

import { inCenter } from "../_base/decorators"
import { TimeElapsedDisplay, TimeTickMarks, TimerSpinnerDisplay } from "./"
import { TimerPhase, TimerStatus } from "@data/state/timer"

import type { Meta, StoryObj } from "@storybook/react-vite"

type Args = {
  phase: (typeof TimerPhase)[keyof typeof TimerPhase]
  progress: number // 0..1
  spinnerOffset: number // 0..1 (where the spinner sits within its loop)
  isRunning: boolean
  showTicks: boolean
  secondsToRotate: number
  focusMinutes: number
  breakMinutes: number
}

// Storybook Meta
const meta: Meta<Args> = {
  title: "Timer / Rings",
  decorators: [inCenter],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    phase: {
      control: "inline-radio",
      options: [TimerPhase.Focus, TimerPhase.Break],
    },
    progress: {
      control: { type: "range", min: 0, max: 1, step: 0.01 },
    },
    spinnerOffset: {
      control: { type: "range", min: 0, max: 1, step: 0.01 },
    },
    isRunning: { control: "boolean" },
    showTicks: { control: "boolean" },
    secondsToRotate: {
      control: { type: "range", min: 1, max: 8, step: 0.1 },
    },
  },
  args: {
    isRunning: false,
    phase: TimerPhase.Focus,
    progress: 0.35,
    spinnerOffset: 0.2,
    secondsToRotate: 4.8,
    showTicks: true,
  },
  render: (args) => <RingsHarness {...args} />,
}

export default meta

export const Rings: StoryObj<Args> = {}

function RingsHarness({
  phase,
  progress,
  spinnerOffset,
  isRunning,
  showTicks,
  secondsToRotate,
}: Args) {
  const periodMs = secondsToRotate * 1000
  const nowMs = Date.now()

  const focusMinutes = 25
  const breakMinutes = 5
  const focusDurationMs = Math.round(focusMinutes * 60 * 1000)
  const breakDurationMs = Math.round(breakMinutes * 60 * 1000)
  const totalMs = phase === TimerPhase.Focus ? focusDurationMs : breakDurationMs

  // STATUS:
  // - If running, we let rAF keep updating.
  // - If not running, we still set a consistent visual snapshot based on baselines.
  const status = isRunning ? TimerStatus.Running : TimerStatus.Paused

  // Elapsed baselines:
  // - For scrubbing, we want "elapsed right now" to equal progress * totalMs.
  // - That means: accumulatedMs = progress * totalMs, startedAtMs = null (paused)
  // - If running, we keep accumulated fixed and set startedAtMs so it will advance from there.
  const clampedProgress = clampValue(progress)
  const accumulatedElapsedMs = Math.round(clampedProgress * totalMs)

  const elapsedStartedAtMs = isRunning ? nowMs : null
  const elapsedAccumulatedMs = accumulatedElapsedMs

  // Spinner baselines:
  // - spinnerOffset represents where we are within one rotation period.
  // - That means: accumulatedMs = spinnerOffset * periodMs (paused snapshot)
  // - If running, we set startedAtMs so it runs from "now" forward.
  const clampedOffset = clampValue(spinnerOffset)
  const spinnerAccumulatedMs = Math.round(clampedOffset * periodMs)

  const spinnerStartedAtMs = isRunning ? nowMs : null

  return (
    <div
      className={style.base}
      // Helpful for visual QA: enforce a stable size (adjust as you like).
      style={{ width: 220, height: 220, position: "relative" }}>
      {/* Spinner */}
      <TimerSpinnerDisplay
        phase={phase}
        isRunning={isRunning}
        startedAtMs={spinnerStartedAtMs}
        accumulatedMs={spinnerAccumulatedMs}
        periodMs={periodMs}
      />

      {/* Elapsed arc */}
      <TimeElapsedDisplay
        phase={phase}
        status={status}
        isRunning={isRunning}
        startedAtMs={elapsedStartedAtMs}
        accumulatedMs={elapsedAccumulatedMs}
        focusDurationMs={focusDurationMs}
        breakDurationMs={breakDurationMs}
      />

      {/* Ticks */}
      {showTicks ? <TimeTickMarks /> : null}
    </div>
  )
}

function clampValue(n: number) {
  if (Number.isNaN(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}
