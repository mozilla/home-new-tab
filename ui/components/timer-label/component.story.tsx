import { msToSeconds } from "@common/utilities/time"
import { useState } from "react"
import { TimerLabel as Component } from "."
import { inCenter } from "../_base/decorators"
import { TimerPhase } from "@data/state/timer"
import type { TimerPhase as TimerPhaseType } from "@data/state/timer"

import type { Meta, StoryObj } from "@storybook/react-vite"

const meta: Meta<typeof Component> = {
  title: "Timer / Label",
  component: Component,
  parameters: { layout: "centered" },
}
export default meta

// Stories
export const Label: StoryObj<typeof Component> = {
  decorators: [inCenter],
  render: () => {
    const [totalMs, setTotalMs] = useState(25 * 60_000)
    const [isRunning, setIsRunning] = useState(false)

    const pause = () => setIsRunning(false)

    const setPhaseDurationMs = (_phase: TimerPhaseType, durationMs: number) => {
      setTotalMs(durationMs)
    }

    const remainingSeconds = msToSeconds(totalMs)

    return (
      <Component
        phase={TimerPhase.Focus}
        isRunning={isRunning}
        totalMs={totalMs}
        remainingSeconds={remainingSeconds}
        pause={pause}
        setPhaseDurationMs={setPhaseDurationMs}
      />
    )
  },
}
