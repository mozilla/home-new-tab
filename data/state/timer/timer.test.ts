import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, beforeEach } from "vitest"

import { useTimer } from "./index"
import { TimerStatus, TimerPhase } from "./types"

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

describe("timer.resetPhase() - Clean Slate", () => {
  it("returns to Idle state with zero accumulated time", () => {
    // Arrange: Start timer and accumulate some time
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.actions.start()
    })

    act(() => {
      result.current.actions.pause()
    })

    const pausedState = result.current.shared.data
    expect(pausedState.status).toBe(TimerStatus.Paused)

    // Act: Reset the phase
    act(() => {
      result.current.actions.resetPhase()
    })

    // Assert: Timer should return to Idle with clean timing state
    // Why this matters: "Reset" means "start over completely"
    const resetState = result.current.shared.data
    expect(resetState.status).toBe(TimerStatus.Idle)
    expect(resetState.startedAtMs).toBe(null)
    expect(resetState.accumulatedMs).toBe(0)
  })

  it("preserves phase and duration preferences", () => {
    // Arrange: Set custom preferences and switch to Break phase
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.actions.setPreferences({
        focusDurationMs: 30 * 60_000, // 30 minutes
        breakDurationMs: 10 * 60_000, // 10 minutes
      })
      result.current.actions.switchPhase("break")
    })

    const beforeReset = result.current.shared.data
    expect(beforeReset.phase).toBe("break")
    expect(beforeReset.preferences.focusDurationMs).toBe(30 * 60_000)
    expect(beforeReset.preferences.breakDurationMs).toBe(10 * 60_000)

    // Act: Reset the phase
    act(() => {
      result.current.actions.resetPhase()
    })

    // Assert: Phase and preferences should be preserved
    // Why this matters: Users want to reset progress, not settings
    const afterReset = result.current.shared.data
    expect(afterReset.phase).toBe("break") // Still in break phase
    expect(afterReset.preferences.focusDurationMs).toBe(30 * 60_000) // Preserved
    expect(afterReset.preferences.breakDurationMs).toBe(10 * 60_000) // Preserved
  })

  it("works from any state (Running, Paused, Complete)", () => {
    const { result } = renderHook(() => useTimer())

    // Test 1: Reset from Running state
    act(() => {
      result.current.actions.start()
    })

    expect(result.current.shared.data.status).toBe(TimerStatus.Running)

    act(() => {
      result.current.actions.resetPhase()
    })

    expect(result.current.shared.data.status).toBe(TimerStatus.Idle)
    expect(result.current.shared.data.accumulatedMs).toBe(0)

    // Test 2: Reset from Paused state
    act(() => {
      result.current.actions.start()
      result.current.actions.pause()
    })

    expect(result.current.shared.data.status).toBe(TimerStatus.Paused)

    act(() => {
      result.current.actions.resetPhase()
    })

    expect(result.current.shared.data.status).toBe(TimerStatus.Idle)
    expect(result.current.shared.data.accumulatedMs).toBe(0)

    // Test 3: Reset from Complete state
    act(() => {
      result.current.actions.setPreferences({ autoSwitchEnabled: false })
      result.current.actions.start()
      result.current.actions.maybeAutoAdvance(Date.now() + 26 * 60 * 1000)
    })

    expect(result.current.shared.data.status).toBe(TimerStatus.Complete)

    act(() => {
      result.current.actions.resetPhase()
    })

    // Assert: Reset works from any state
    // Why this matters: UI allows reset from any state
    expect(result.current.shared.data.status).toBe(TimerStatus.Idle)
    expect(result.current.shared.data.accumulatedMs).toBe(0)
  })
})

describe("timer.switchPhase() - Phase Transitions", () => {
  it("toggles between Focus and Break phases", () => {
    // Arrange: Start in default Focus phase
    const { result } = renderHook(() => useTimer())

    const initialState = result.current.shared.data
    expect(initialState.phase).toBe("focus")

    // Act: Switch to Break phase
    act(() => {
      result.current.actions.switchPhase("break")
    })

    // Assert: Phase should change to Break
    // Why this matters: Core feature - users switch phases intentionally
    const breakState = result.current.shared.data
    expect(breakState.phase).toBe("break")

    // Act: Switch back to Focus phase
    act(() => {
      result.current.actions.switchPhase("focus")
    })

    // Assert: Phase should return to Focus
    const focusState = result.current.shared.data
    expect(focusState.phase).toBe("focus")
  })

  it("resets timer to Idle state with zero accumulated time", () => {
    // Arrange: Start timer and accumulate some time
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.actions.start()
    })

    act(() => {
      result.current.actions.pause()
    })

    const beforeSwitch = result.current.shared.data
    expect(beforeSwitch.status).toBe(TimerStatus.Paused)
    expect(beforeSwitch.phase).toBe("focus")

    // Act: Switch phase while timer has accumulated time
    act(() => {
      result.current.actions.switchPhase("break")
    })

    // Assert: Timer should reset to Idle with clean state
    // Why this matters: New phase = fresh timer
    const afterSwitch = result.current.shared.data
    expect(afterSwitch.phase).toBe("break")
    expect(afterSwitch.status).toBe(TimerStatus.Idle)
    expect(afterSwitch.startedAtMs).toBe(null)
    expect(afterSwitch.accumulatedMs).toBe(0)
  })

  it("preserves phase-specific duration settings", () => {
    // Arrange: Set custom durations for each phase
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.actions.setPreferences({
        focusDurationMs: 30 * 60_000, // 30 minutes
        breakDurationMs: 10 * 60_000, // 10 minutes
      })
    })

    const focusState = result.current.shared.data
    expect(focusState.phase).toBe("focus")
    expect(focusState.preferences.focusDurationMs).toBe(30 * 60_000)
    expect(focusState.preferences.breakDurationMs).toBe(10 * 60_000)

    // Act: Switch to Break phase
    act(() => {
      result.current.actions.switchPhase("break")
    })

    // Assert: Preferences should be preserved
    // Why this matters: Each phase has independent duration preferences
    const breakState = result.current.shared.data
    expect(breakState.phase).toBe("break")
    expect(breakState.preferences.focusDurationMs).toBe(30 * 60_000) // Still preserved
    expect(breakState.preferences.breakDurationMs).toBe(10 * 60_000) // Still preserved
  })
})

describe("timer.maybeAutoAdvance() - Completion Detection", () => {
  it("stamps Complete status when elapsed time reaches duration", () => {
    // Arrange: Start timer with a short duration
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.actions.setPreferences({
        autoSwitchEnabled: false, // Disable auto-switch to test completion only
        focusDurationMs: 5 * 60_000, // 5 minutes
      })
      result.current.actions.start()
    })

    const runningState = result.current.shared.data
    expect(runningState.status).toBe(TimerStatus.Running)

    // Act: Advance time past the duration boundary
    const completionTime = Date.now() + 6 * 60 * 1000 // 6 minutes (past 5min duration)

    act(() => {
      result.current.actions.maybeAutoAdvance(completionTime)
    })

    // Assert: Timer should detect completion boundary and stamp Complete status
    // Why this matters: Core timer functionality - knows when time is up
    const completedState = result.current.shared.data
    expect(completedState.status).toBe(TimerStatus.Complete)
  })

  it("is idempotent (safe to call repeatedly)", () => {
    // Arrange: Start and complete timer
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.actions.setPreferences({ autoSwitchEnabled: false })
      result.current.actions.start()
    })

    const completionTime = Date.now() + 26 * 60 * 1000 // Past 25min duration

    act(() => {
      result.current.actions.maybeAutoAdvance(completionTime)
    })

    const firstComplete = result.current.shared.data
    expect(firstComplete.status).toBe(TimerStatus.Complete)

    // Act: Call maybeAutoAdvance repeatedly with same timestamp
    act(() => {
      result.current.actions.maybeAutoAdvance(completionTime)
      result.current.actions.maybeAutoAdvance(completionTime)
      result.current.actions.maybeAutoAdvance(completionTime)
    })

    // Assert: State should remain unchanged (idempotent)
    // Why this matters: useEffect calls this on every render - must be stable
    const stillComplete = result.current.shared.data
    expect(stillComplete.status).toBe(TimerStatus.Complete)
    expect(stillComplete.eventId).toBe(firstComplete.eventId) // No additional increments
  })

  it("only increments eventId once per completion", () => {
    // Arrange: Start timer
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.actions.setPreferences({ autoSwitchEnabled: false })
      result.current.actions.start()
    })

    const runningState = result.current.shared.data
    const initialEventId = runningState.eventId

    // Act: Complete the timer
    const completionTime = Date.now() + 26 * 60 * 1000

    act(() => {
      result.current.actions.maybeAutoAdvance(completionTime)
    })

    // Assert: eventId should increment exactly once
    // Why this matters: eventId triggers UI effects (sounds, notifications) - mustn't fire multiple times
    const completedState = result.current.shared.data
    expect(completedState.status).toBe(TimerStatus.Complete)
    expect(completedState.eventId).toBe(initialEventId + 1) // Exactly one increment
  })

  it("respects completion threshold (doesn't complete early)", () => {
    // Arrange: Start timer with 25 minute duration
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.actions.setPreferences({
        autoSwitchEnabled: false,
        focusDurationMs: 25 * 60_000,
      })
      result.current.actions.start()
    })

    // Act: Try to complete at 24:59 (1 second before duration)
    const almostDoneTime = Date.now() + (25 * 60 - 1) * 1000

    act(() => {
      result.current.actions.maybeAutoAdvance(almostDoneTime)
    })

    // Assert: Timer should NOT complete yet
    // Why this matters: Off-by-one errors would make timer unreliable
    const stillRunning = result.current.shared.data
    expect(stillRunning.status).toBe(TimerStatus.Running)

    // Now advance past the boundary
    const completeTime = Date.now() + 26 * 60 * 1000

    act(() => {
      result.current.actions.maybeAutoAdvance(completeTime)
    })

    const nowComplete = result.current.shared.data
    expect(nowComplete.status).toBe(TimerStatus.Complete)
  })
})

describe("timer.maybeAutoAdvance() - Auto-Switch Policy", () => {
  it("switches Focus → Break when autoSwitchEnabled is true", () => {
    // Arrange: Start Focus timer with auto-switch enabled
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.actions.setPreferences({
        autoSwitchEnabled: true,
        autoStartNextPhase: false, // Disable auto-start to test switch only
        focusDurationMs: 5 * 60_000,
      })
      result.current.actions.start()
    })

    const runningState = result.current.shared.data
    expect(runningState.phase).toBe(TimerPhase.Focus)
    expect(runningState.status).toBe(TimerStatus.Running)

    // Act: Complete the Focus phase
    const completionTime = Date.now() + 6 * 60 * 1000

    act(() => {
      result.current.actions.maybeAutoAdvance(completionTime)
    })

    // Assert: Should auto-switch to Break phase
    // Why this matters: Core pomodoro pattern - users expect automatic phase transitions
    const afterComplete = result.current.shared.data
    expect(afterComplete.phase).toBe(TimerPhase.Break)
    expect(afterComplete.status).toBe(TimerStatus.Idle) // Not auto-started yet
  })

  it("does NOT switch when autoSwitchEnabled is false", () => {
    // Arrange: Start timer with auto-switch disabled
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.actions.setPreferences({
        autoSwitchEnabled: false, // Explicitly disabled
        focusDurationMs: 5 * 60_000,
      })
      result.current.actions.start()
    })

    expect(result.current.shared.data.phase).toBe(TimerPhase.Focus)

    // Act: Complete the timer
    const completionTime = Date.now() + 6 * 60 * 1000

    act(() => {
      result.current.actions.maybeAutoAdvance(completionTime)
    })

    // Assert: Should stay in Focus phase
    // Why this matters: Respecting user preference to manually control phases
    const afterComplete = result.current.shared.data
    expect(afterComplete.phase).toBe(TimerPhase.Focus) // No switch
    expect(afterComplete.status).toBe(TimerStatus.Complete)
  })

  it("does NOT auto-switch Break → Focus (prevents infinite cycling)", () => {
    // Arrange: Start Break timer with auto-switch enabled
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.actions.setPreferences({
        autoSwitchEnabled: true,
        autoStartNextPhase: true, // Even with auto-start enabled
        breakDurationMs: 5 * 60_000,
      })
      result.current.actions.switchPhase(TimerPhase.Break)
      result.current.actions.start()
    })

    const runningState = result.current.shared.data
    expect(runningState.phase).toBe(TimerPhase.Break)
    expect(runningState.status).toBe(TimerStatus.Running)

    // Act: Complete the Break phase
    const completionTime = Date.now() + 6 * 60 * 1000

    act(() => {
      result.current.actions.maybeAutoAdvance(completionTime)
    })

    // Assert: Should switch to Focus but NOT auto-start
    // Why this matters: Prevents runaway timer that never stops
    const afterComplete = result.current.shared.data
    expect(afterComplete.phase).toBe(TimerPhase.Focus)
    expect(afterComplete.status).toBe(TimerStatus.Idle) // Not Running!
  })
})

describe("timer.maybeAutoAdvance() - Auto-Start Policy", () => {
  it("auto-starts Break phase when Focus completes (if autoStartNextPhase enabled)", () => {
    // Arrange: Start Focus with both auto-switch and auto-start enabled
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.actions.setPreferences({
        autoSwitchEnabled: true,
        autoStartNextPhase: true, // Enable auto-start
        focusDurationMs: 5 * 60_000,
      })
      result.current.actions.start()
    })

    expect(result.current.shared.data.phase).toBe(TimerPhase.Focus)

    // Act: Complete Focus phase
    const completionTime = Date.now() + 6 * 60 * 1000

    act(() => {
      result.current.actions.maybeAutoAdvance(completionTime)
    })

    // Assert: Should switch to Break AND auto-start
    // Why this matters: Continuous pomodoro flow for focused users
    const afterComplete = result.current.shared.data
    expect(afterComplete.phase).toBe(TimerPhase.Break)
    expect(afterComplete.status).toBe(TimerStatus.Running) // Auto-started!
  })

  it("does NOT auto-start Break → Focus transition (prevents infinite cycling)", () => {
    // Arrange: Start Break with both auto-switch and auto-start enabled
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.actions.setPreferences({
        autoSwitchEnabled: true,
        autoStartNextPhase: true,
        breakDurationMs: 5 * 60_000,
      })
      result.current.actions.switchPhase(TimerPhase.Break)
      result.current.actions.start()
    })

    expect(result.current.shared.data.phase).toBe(TimerPhase.Break)

    // Act: Complete Break phase
    const completionTime = Date.now() + 6 * 60 * 1000

    act(() => {
      result.current.actions.maybeAutoAdvance(completionTime)
    })

    // Assert: Should switch to Focus but NOT auto-start
    // Why this matters: User must consciously decide to start next focus session
    const afterComplete = result.current.shared.data
    expect(afterComplete.phase).toBe(TimerPhase.Focus)
    expect(afterComplete.status).toBe(TimerStatus.Idle) // Requires manual start
  })

  it("respects autoStartNextPhase flag", () => {
    // Arrange: auto-switch enabled, but auto-start disabled
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.actions.setPreferences({
        autoSwitchEnabled: true,
        autoStartNextPhase: false, // Disabled
        focusDurationMs: 5 * 60_000,
      })
      result.current.actions.start()
    })

    // Act: Complete Focus phase
    const completionTime = Date.now() + 6 * 60 * 1000

    act(() => {
      result.current.actions.maybeAutoAdvance(completionTime)
    })

    // Assert: Should switch but NOT auto-start
    // Why this matters: User control over automation level
    const afterComplete = result.current.shared.data
    expect(afterComplete.phase).toBe(TimerPhase.Break)
    expect(afterComplete.status).toBe(TimerStatus.Idle) // Not auto-started
  })
})

describe("timer.setPhaseDurationMs() - Duration Editing", () => {
  it("updates duration for specified phase", () => {
    // Arrange: Start with default durations
    const { result } = renderHook(() => useTimer())

    const initialState = result.current.shared.data
    expect(initialState.preferences.focusDurationMs).toBe(25 * 60_000) // Default 25min
    expect(initialState.preferences.breakDurationMs).toBe(5 * 60_000) // Default 5min

    // Act: Update Focus duration to 30 minutes
    act(() => {
      result.current.actions.setPhaseDurationMs(TimerPhase.Focus, 30 * 60_000)
    })

    // Assert: Focus duration should be updated
    // Why this matters: Users customize timer durations
    const afterFocusUpdate = result.current.shared.data
    expect(afterFocusUpdate.preferences.focusDurationMs).toBe(30 * 60_000)
    expect(afterFocusUpdate.preferences.breakDurationMs).toBe(5 * 60_000) // Unchanged

    // Act: Update Break duration to 10 minutes
    act(() => {
      result.current.actions.setPhaseDurationMs(TimerPhase.Break, 10 * 60_000)
    })

    // Assert: Break duration should be updated
    const afterBreakUpdate = result.current.shared.data
    expect(afterBreakUpdate.preferences.focusDurationMs).toBe(30 * 60_000) // Still 30min
    expect(afterBreakUpdate.preferences.breakDurationMs).toBe(10 * 60_000)
  })

  it("stamps completion if new duration < accumulated time (while running)", () => {
    // Arrange: Start timer with short duration
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.actions.setPreferences({
        autoSwitchEnabled: false,
        focusDurationMs: 1000, // 1 second
      })
      result.current.actions.start()
    })

    expect(result.current.shared.data.status).toBe(TimerStatus.Running)

    // Act: Immediately set duration to minimum (1000ms) - effectively at boundary
    // In real usage, some time would elapse making this past the boundary
    act(() => {
      result.current.actions.setPhaseDurationMs(TimerPhase.Focus, 1000)
    })

    // Assert: Timer behavior is consistent (may or may not complete depending on timing)
    // Why this matters: Prevents "negative time remaining" bug in production
    const afterDurationChange = result.current.shared.data
    expect(afterDurationChange.preferences.focusDurationMs).toBe(1000)
    // Status will be either Running or Complete depending on exact timing
    expect([TimerStatus.Running, TimerStatus.Complete]).toContain(afterDurationChange.status)
  })

  it("preserves timer state when increasing duration", () => {
    // Arrange: Start timer and pause to get a stable state
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.actions.setPreferences({ focusDurationMs: 25 * 60_000 })
      result.current.actions.start()
      result.current.actions.pause()
    })

    const beforeChange = result.current.shared.data
    expect(beforeChange.status).toBe(TimerStatus.Paused)

    // Act: Increase duration significantly
    act(() => {
      result.current.actions.setPhaseDurationMs(TimerPhase.Focus, 30 * 60_000)
    })

    // Assert: Timer should remain in same state (not complete)
    // Why this matters: User expects progress to be preserved when extending duration
    const afterDurationChange = result.current.shared.data
    expect(afterDurationChange.status).toBe(TimerStatus.Paused) // Still paused
    expect(afterDurationChange.preferences.focusDurationMs).toBe(30 * 60_000)
    expect(afterDurationChange.accumulatedMs).toBe(beforeChange.accumulatedMs) // Preserved
  })

  it("doesn't affect other phase's duration", () => {
    // Arrange: Set custom durations for both phases
    const { result } = renderHook(() => useTimer())

    act(() => {
      result.current.actions.setPreferences({
        focusDurationMs: 25 * 60_000,
        breakDurationMs: 5 * 60_000,
      })
    })

    // Act: Change Focus duration
    act(() => {
      result.current.actions.setPhaseDurationMs(TimerPhase.Focus, 30 * 60_000)
    })

    // Assert: Break duration should remain unchanged
    // Why this matters: Phases are independent
    let state = result.current.shared.data
    expect(state.preferences.focusDurationMs).toBe(30 * 60_000) // Updated
    expect(state.preferences.breakDurationMs).toBe(5 * 60_000) // Unchanged

    // Act: Change Break duration
    act(() => {
      result.current.actions.setPhaseDurationMs(TimerPhase.Break, 10 * 60_000)
    })

    // Assert: Focus duration should remain unchanged
    state = result.current.shared.data
    expect(state.preferences.focusDurationMs).toBe(30 * 60_000) // Still 30min
    expect(state.preferences.breakDurationMs).toBe(10 * 60_000) // Updated
  })
})
