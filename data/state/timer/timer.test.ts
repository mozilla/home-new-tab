import { describe, it, expect } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTimer } from "./index"
import { TimerStatus } from "./types"

describe("Timer Store POC", () => {
  it("starts timer from paused state", () => {
    const { result } = renderHook(() => useTimer())

    // Timer starts in Paused state by default
    const initialState = result.current.shared.data
    expect(initialState.status).toBe(TimerStatus.Paused)
    expect(initialState.startedAtMs).toBe(null)

    // Start the timer
    act(() => {
      result.current.actions.start()
    })

    // Verify transition to Running
    const runningState = result.current.shared.data
    expect(runningState.status).toBe(TimerStatus.Running)
    expect(runningState.startedAtMs).toBeGreaterThan(0)
  })
})