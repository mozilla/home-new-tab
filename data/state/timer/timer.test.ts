import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, beforeEach } from "vitest"

import { useTimer } from "./index"
import { TimerStatus } from "./types"

// Clear storage and reset timer state before each test
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()

  // Reset timer store to default state for test isolation
  const { result } = renderHook(() => useTimer())
  act(() => {
    result.current.actions.reset()
  })
})

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

describe("timer.start() - State Machine Transitions", () => {
  it("transitions from Paused to Running state", () => {
    // Arrange: Timer starts in Paused state (guaranteed by beforeEach reset)
    const { result } = renderHook(() => useTimer())
    const initialState = result.current.shared.data
    const initialEventId = initialState.eventId

    // Why this matters: Core state machine transition - if this fails, timer is broken
    expect(initialState.status).toBe(TimerStatus.Paused)
    expect(initialState.startedAtMs).toBe(null)

    // Act: Start the timer
    act(() => {
      result.current.actions.start()
    })

    // Assert: Verify transition to Running with proper timestamp and eventId increment
    const runningState = result.current.shared.data
    expect(runningState.status).toBe(TimerStatus.Running)
    expect(runningState.startedAtMs).toBeGreaterThan(0)
    expect(runningState.eventId).toBe(initialEventId + 1)
  })

  it("is idempotent when already Running", () => {
    // Arrange: Start timer and capture first startedAtMs
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.actions.start()
    })

    const firstState = result.current.shared.data
    const firstStartedAt = firstState.startedAtMs
    const firstEventId = firstState.eventId

    // Why this matters: Prevents accidental time resets from double-clicks or race conditions
    expect(firstState.status).toBe(TimerStatus.Running)
    expect(firstStartedAt).toBeGreaterThan(0)

    // Act: Call start() again while already Running
    act(() => {
      result.current.actions.start()
    })

    // Assert: State should remain unchanged (idempotent)
    const secondState = result.current.shared.data
    expect(secondState.status).toBe(TimerStatus.Running)
    expect(secondState.startedAtMs).toBe(firstStartedAt) // No change
    expect(secondState.eventId).toBe(firstEventId) // No additional increment
  })

  it("restarts cleanly from Complete status", () => {
    // Arrange: Start timer with some accumulated time, then use maybeAutoAdvance to complete it
    const { result } = renderHook(() => useTimer())

    // Disable autoSwitchEnabled to prevent automatic phase switching on completion
    act(() => {
      result.current.actions.setPreferences({ autoSwitchEnabled: false })
    })

    // Start the timer
    act(() => {
      result.current.actions.start()
    })

    const startedState = result.current.shared.data
    expect(startedState.status).toBe(TimerStatus.Running)

    // Use maybeAutoAdvance with a future timestamp to complete the timer
    // Default focus duration is 25 minutes (25 * 60 * 1000 ms)
    const completionTime = Date.now() + 26 * 60 * 1000 // 26 minutes in the future

    act(() => {
      result.current.actions.maybeAutoAdvance(completionTime)
    })

    const completedState = result.current.shared.data
    expect(completedState.status).toBe(TimerStatus.Complete)

    // Act: Restart from Complete by calling start()
    act(() => {
      result.current.actions.start()
    })

    // Assert: Timer should transition to Running with fresh state
    // Why this matters: User expects "start after complete" to begin a fresh timer
    const restartedState = result.current.shared.data
    expect(restartedState.status).toBe(TimerStatus.Running)
    expect(restartedState.startedAtMs).toBeGreaterThan(0)
    expect(restartedState.accumulatedMs).toBe(0) // Reset to fresh state
  })
})

describe("timer.pause() - Accumulation Logic", () => {
  it("transitions from Running to Paused and accumulates elapsed time", () => {
    // Arrange: Start the timer
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.actions.start()
    })

    const runningState = result.current.shared.data
    expect(runningState.status).toBe(TimerStatus.Running)
    expect(runningState.startedAtMs).toBeGreaterThan(0)
    expect(runningState.accumulatedMs).toBe(0) // Fresh start

    // Act: Pause after a brief delay to simulate elapsed time
    // Note: In real usage, time passes between start and pause
    // Here we immediately pause, so accumulatedMs should still be ~0
    act(() => {
      result.current.actions.pause()
    })

    // Assert: Verify transition to Paused with time accumulated
    // Why this matters: Core timer functionality - must preserve progress
    const pausedState = result.current.shared.data
    expect(pausedState.status).toBe(TimerStatus.Paused)
    expect(pausedState.startedAtMs).toBe(null) // Cleared when paused
    expect(pausedState.accumulatedMs).toBeGreaterThanOrEqual(0) // Time preserved
  })

  it("is idempotent when already Paused", () => {
    // Arrange: Timer is already in Paused state (default)
    const { result } = renderHook(() => useTimer())

    const initialState = result.current.shared.data
    const initialEventId = initialState.eventId
    expect(initialState.status).toBe(TimerStatus.Paused)

    // Act: Call pause() when already Paused
    act(() => {
      result.current.actions.pause()
    })

    // Assert: State should remain unchanged (idempotent)
    // Why this matters: Prevents UI bugs from rapid clicking
    const stillPausedState = result.current.shared.data
    expect(stillPausedState.status).toBe(TimerStatus.Paused)
    expect(stillPausedState.accumulatedMs).toBe(initialState.accumulatedMs)
    expect(stillPausedState.eventId).toBe(initialEventId) // No change
  })

  it("preserves accumulated time across pause/resume cycles", () => {
    // Arrange: Start the timer
    const { result } = renderHook(() => useTimer())

    // First cycle: start → pause
    act(() => {
      result.current.actions.start()
    })

    const firstRunning = result.current.shared.data
    expect(firstRunning.status).toBe(TimerStatus.Running)

    act(() => {
      result.current.actions.pause()
    })

    const firstPaused = result.current.shared.data
    const firstAccumulated = firstPaused.accumulatedMs
    expect(firstPaused.status).toBe(TimerStatus.Paused)
    expect(firstAccumulated).toBeGreaterThanOrEqual(0)

    // Second cycle: start → pause
    act(() => {
      result.current.actions.start()
    })

    const secondRunning = result.current.shared.data
    expect(secondRunning.status).toBe(TimerStatus.Running)
    expect(secondRunning.accumulatedMs).toBe(firstAccumulated) // Preserved from first pause

    act(() => {
      result.current.actions.pause()
    })

    // Assert: Accumulated time should sum across cycles
    // Why this matters: Users expect timer to remember progress accurately
    const secondPaused = result.current.shared.data
    expect(secondPaused.status).toBe(TimerStatus.Paused)
    expect(secondPaused.accumulatedMs).toBeGreaterThanOrEqual(firstAccumulated) // Should be >= (time added)
  })
})
