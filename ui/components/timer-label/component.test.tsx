import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { TimerLabel } from "."

describe("TimerLabel", () => {
  it("renders MM:SS", () => {
    render(
      <TimerLabel
        phase="focus"
        isRunning={false}
        remainingSeconds={90}
        totalMs={25 * 60_000}
        pause={() => {}}
        setPhaseDurationMs={() => {}}
      />,
    )

    expect(screen.getByTestId("timer-label")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Edit focus duration" }),
    ).toBeInTheDocument()

    // 90s => 01:30
    expect(screen.getByText("01")).toBeInTheDocument()
    expect(screen.getByText("30")).toBeInTheDocument()
  })

  it("pauses on click when running and commits minutes on Enter", () => {
    const pause = vi.fn()
    const setPhaseDurationMs = vi.fn()

    const rendered = render(
      <TimerLabel
        phase="focus"
        isRunning={true}
        remainingSeconds={90}
        totalMs={25 * 60_000}
        pause={pause}
        setPhaseDurationMs={setPhaseDurationMs}
      />,
    )

    const ui = within(rendered.container)

    fireEvent.click(ui.getByRole("button", { name: "Edit focus duration" }))

    expect(pause).toHaveBeenCalledTimes(1)

    const input = ui.getByRole("textbox", { name: "Set focus minutes" })
    fireEvent.change(input, { target: { value: "30" } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(setPhaseDurationMs).toHaveBeenCalledWith("focus", 30 * 60_000)
  })

  it("matches snapshot in non-editing state (optional)", () => {
    const rendered = render(
      <TimerLabel
        phase="break"
        isRunning={false}
        remainingSeconds={5}
        totalMs={5 * 60_000}
        pause={() => {}}
        setPhaseDurationMs={() => {}}
      />,
    )

    expect(rendered.container).toMatchSnapshot()
  })
})
