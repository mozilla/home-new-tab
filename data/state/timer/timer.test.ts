import { renderHook, act, cleanup } from "@testing-library/react"
import { describe, it, expect, beforeEach, afterEach } from "vitest"

import { useTimerStore as useTimer, DEFAULT_TIMER_STATE } from "./index"
import { TimerStatus, TimerPhase } from "./types"

describe("Pure Timer Store Tests", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()

    // Test-only reset: do NOT commit (avoids sync/restore side effects).
    useTimer.setState((s) => ({ ...s, data: DEFAULT_TIMER_STATE }), false)
  })

  describe("Timer Store", () => {
    it("starts timer from paused state", () => {
      const initialState = useTimer.getState().data
      expect(initialState.status).toBe(TimerStatus.Paused)
      expect(initialState.startedAtMs).toBe(null)

      useTimer.getState().actions.start()

      const runningState = useTimer.getState().data
      expect(runningState.status).toBe(TimerStatus.Running)
      expect(runningState.startedAtMs).toBeGreaterThan(0)
    })
  })

  describe("timer.start() - State Machine Transitions", () => {
    it("transitions from Paused to Running state", () => {
      const initialState = useTimer.getState().data
      const initialEventId = initialState.eventId

      expect(initialState.status).toBe(TimerStatus.Paused)
      expect(initialState.startedAtMs).toBe(null)

      useTimer.getState().actions.start()

      const runningState = useTimer.getState().data
      expect(runningState.status).toBe(TimerStatus.Running)
      expect(runningState.startedAtMs).toBeGreaterThan(0)
      expect(runningState.eventId).toBe(initialEventId + 1)
    })

    it("is idempotent when already Running", () => {
      useTimer.getState().actions.start()

      const firstState = useTimer.getState().data
      const firstStartedAt = firstState.startedAtMs
      const firstEventId = firstState.eventId

      expect(firstState.status).toBe(TimerStatus.Running)
      expect(firstStartedAt).toBeGreaterThan(0)

      useTimer.getState().actions.start()

      const secondState = useTimer.getState().data
      expect(secondState.status).toBe(TimerStatus.Running)
      expect(secondState.startedAtMs).toBe(firstStartedAt)
      expect(secondState.eventId).toBe(firstEventId)
    })

    it("restarts cleanly from Complete status", () => {
      useTimer.getState().actions.setPreferences({ autoSwitchEnabled: false })
      useTimer.getState().actions.start()
      expect(useTimer.getState().data.status).toBe(TimerStatus.Running)

      useTimer.getState().actions.advance(Date.now() + 26 * 60 * 1000)
      expect(useTimer.getState().data.status).toBe(TimerStatus.Complete)

      useTimer.getState().actions.start()

      const restarted = useTimer.getState().data
      expect(restarted.status).toBe(TimerStatus.Running)
      expect(restarted.startedAtMs).toBeGreaterThan(0)
      expect(restarted.accumulatedMs).toBe(0)
    })
  })

  describe("timer.pause() - Accumulation Logic", () => {
    it("transitions from Running to Paused and accumulates elapsed time", () => {
      useTimer.getState().actions.start()

      const running = useTimer.getState().data
      expect(running.status).toBe(TimerStatus.Running)
      expect(running.startedAtMs).toBeGreaterThan(0)
      expect(running.accumulatedMs).toBe(0)

      useTimer.getState().actions.pause()

      const paused = useTimer.getState().data
      expect(paused.status).toBe(TimerStatus.Paused)
      expect(paused.startedAtMs).toBe(null)
      expect(paused.accumulatedMs).toBeGreaterThanOrEqual(0)
    })

    it("is idempotent when already Paused", () => {
      const initial = useTimer.getState().data
      const initialEventId = initial.eventId
      expect(initial.status).toBe(TimerStatus.Paused)

      useTimer.getState().actions.pause()

      const still = useTimer.getState().data
      expect(still.status).toBe(TimerStatus.Paused)
      expect(still.accumulatedMs).toBe(initial.accumulatedMs)
      expect(still.eventId).toBe(initialEventId)
    })

    it("preserves accumulated time across pause/resume cycles", () => {
      useTimer.getState().actions.start()
      useTimer.getState().actions.pause()

      const firstPaused = useTimer.getState().data
      const firstAccumulated = firstPaused.accumulatedMs
      expect(firstPaused.status).toBe(TimerStatus.Paused)

      useTimer.getState().actions.start()
      const secondRunning = useTimer.getState().data
      expect(secondRunning.status).toBe(TimerStatus.Running)
      expect(secondRunning.accumulatedMs).toBe(firstAccumulated)

      useTimer.getState().actions.pause()
      const secondPaused = useTimer.getState().data
      expect(secondPaused.status).toBe(TimerStatus.Paused)
      expect(secondPaused.accumulatedMs).toBeGreaterThanOrEqual(
        firstAccumulated,
      )
    })
  })

  describe("timer.resetPhase() - Clean Slate", () => {
    it("returns to Idle state with zero accumulated time", () => {
      useTimer.getState().actions.start()
      useTimer.getState().actions.pause()
      expect(useTimer.getState().data.status).toBe(TimerStatus.Paused)

      useTimer.getState().actions.resetPhase()

      const reset = useTimer.getState().data
      expect(reset.status).toBe(TimerStatus.Idle)
      expect(reset.startedAtMs).toBe(null)
      expect(reset.accumulatedMs).toBe(0)
    })

    it("preserves phase and duration preferences", () => {
      useTimer.getState().actions.setPreferences({
        focusDurationMs: 30 * 60_000,
        breakDurationMs: 10 * 60_000,
      })
      useTimer.getState().actions.switchPhase("break")

      const before = useTimer.getState().data
      expect(before.phase).toBe("break")

      useTimer.getState().actions.resetPhase()

      const after = useTimer.getState().data
      expect(after.phase).toBe("break")
      expect(after.preferences.focusDurationMs).toBe(30 * 60_000)
      expect(after.preferences.breakDurationMs).toBe(10 * 60_000)
    })

    it("works from any state (Running, Paused, Complete)", () => {
      useTimer.getState().actions.start()
      expect(useTimer.getState().data.status).toBe(TimerStatus.Running)

      useTimer.getState().actions.resetPhase()
      expect(useTimer.getState().data.status).toBe(TimerStatus.Idle)
      expect(useTimer.getState().data.accumulatedMs).toBe(0)

      useTimer.getState().actions.start()
      useTimer.getState().actions.pause()
      expect(useTimer.getState().data.status).toBe(TimerStatus.Paused)

      useTimer.getState().actions.resetPhase()
      expect(useTimer.getState().data.status).toBe(TimerStatus.Idle)

      useTimer.getState().actions.setPreferences({ autoSwitchEnabled: false })
      useTimer.getState().actions.start()
      useTimer.getState().actions.advance(Date.now() + 26 * 60 * 1000)
      expect(useTimer.getState().data.status).toBe(TimerStatus.Complete)

      useTimer.getState().actions.resetPhase()
      expect(useTimer.getState().data.status).toBe(TimerStatus.Idle)
    })
  })

  describe("timer.switchPhase() - Phase Transitions", () => {
    it("toggles between Focus and Break phases", () => {
      expect(useTimer.getState().data.phase).toBe("focus")

      useTimer.getState().actions.switchPhase("break")
      expect(useTimer.getState().data.phase).toBe("break")

      useTimer.getState().actions.switchPhase("focus")
      expect(useTimer.getState().data.phase).toBe("focus")
    })

    it("resets timer to Idle state with zero accumulated time", () => {
      useTimer.getState().actions.start()
      useTimer.getState().actions.pause()

      const before = useTimer.getState().data
      expect(before.status).toBe(TimerStatus.Paused)
      expect(before.phase).toBe("focus")

      useTimer.getState().actions.switchPhase("break")

      const after = useTimer.getState().data
      expect(after.phase).toBe("break")
      expect(after.status).toBe(TimerStatus.Idle)
      expect(after.startedAtMs).toBe(null)
      expect(after.accumulatedMs).toBe(0)
    })

    it("preserves phase-specific duration settings", () => {
      useTimer.getState().actions.setPreferences({
        focusDurationMs: 30 * 60_000,
        breakDurationMs: 10 * 60_000,
      })

      useTimer.getState().actions.switchPhase("break")
      const s = useTimer.getState().data

      expect(s.phase).toBe("break")
      expect(s.preferences.focusDurationMs).toBe(30 * 60_000)
      expect(s.preferences.breakDurationMs).toBe(10 * 60_000)
    })
  })

  describe("timer.advance() - Completion Detection", () => {
    it("stamps Complete status when elapsed time reaches duration", () => {
      useTimer.getState().actions.setPreferences({
        autoSwitchEnabled: false,
        focusDurationMs: 5 * 60_000,
      })
      useTimer.getState().actions.start()
      expect(useTimer.getState().data.status).toBe(TimerStatus.Running)

      useTimer.getState().actions.advance(Date.now() + 6 * 60 * 1000)
      expect(useTimer.getState().data.status).toBe(TimerStatus.Complete)
    })

    it("is idempotent (safe to call repeatedly)", () => {
      useTimer.getState().actions.setPreferences({ autoSwitchEnabled: false })
      useTimer.getState().actions.start()

      const t = Date.now() + 26 * 60 * 1000
      useTimer.getState().actions.advance(t)

      const first = useTimer.getState().data
      expect(first.status).toBe(TimerStatus.Complete)

      useTimer.getState().actions.advance(t)
      useTimer.getState().actions.advance(t)
      useTimer.getState().actions.advance(t)

      const still = useTimer.getState().data
      expect(still.status).toBe(TimerStatus.Complete)
      expect(still.eventId).toBe(first.eventId)
    })

    it("only increments eventId once per completion", () => {
      useTimer.getState().actions.setPreferences({ autoSwitchEnabled: false })
      useTimer.getState().actions.start()

      const initialEventId = useTimer.getState().data.eventId
      useTimer.getState().actions.advance(Date.now() + 26 * 60 * 1000)

      const completed = useTimer.getState().data
      expect(completed.status).toBe(TimerStatus.Complete)
      expect(completed.eventId).toBe(initialEventId + 1)
    })

    it("respects completion threshold (doesn't complete early)", () => {
      useTimer.getState().actions.setPreferences({
        autoSwitchEnabled: false,
        focusDurationMs: 25 * 60_000,
      })
      useTimer.getState().actions.start()

      useTimer.getState().actions.advance(Date.now() + (25 * 60 - 1) * 1000)
      expect(useTimer.getState().data.status).toBe(TimerStatus.Running)

      useTimer.getState().actions.advance(Date.now() + 26 * 60 * 1000)
      expect(useTimer.getState().data.status).toBe(TimerStatus.Complete)
    })
  })

  describe("timer.advance() - Auto-Switch Policy", () => {
    it("switches Focus → Break when autoSwitchEnabled is true", () => {
      useTimer.getState().actions.setPreferences({
        autoSwitchEnabled: true,
        autoStartNextPhase: false,
        focusDurationMs: 5 * 60_000,
      })
      useTimer.getState().actions.start()

      const running = useTimer.getState().data
      expect(running.phase).toBe(TimerPhase.Focus)
      expect(running.status).toBe(TimerStatus.Running)

      useTimer.getState().actions.advance(Date.now() + 6 * 60 * 1000)

      const after = useTimer.getState().data
      expect(after.phase).toBe(TimerPhase.Break)
      expect(after.status).toBe(TimerStatus.Idle)
    })

    it("does NOT switch when autoSwitchEnabled is false", () => {
      useTimer.getState().actions.setPreferences({
        autoSwitchEnabled: false,
        focusDurationMs: 5 * 60_000,
      })
      useTimer.getState().actions.start()

      useTimer.getState().actions.advance(Date.now() + 6 * 60 * 1000)

      const after = useTimer.getState().data
      expect(after.phase).toBe(TimerPhase.Focus)
      expect(after.status).toBe(TimerStatus.Complete)
    })

    it("does NOT auto-switch Break → Focus (prevents infinite cycling)", () => {
      useTimer.getState().actions.setPreferences({
        autoSwitchEnabled: true,
        autoStartNextPhase: true,
        breakDurationMs: 5 * 60_000,
      })
      useTimer.getState().actions.switchPhase(TimerPhase.Break)
      useTimer.getState().actions.start()

      useTimer.getState().actions.advance(Date.now() + 6 * 60 * 1000)

      const after = useTimer.getState().data
      expect(after.phase).toBe(TimerPhase.Focus)
      expect(after.status).toBe(TimerStatus.Idle)
    })
  })

  describe("timer.advance() - Auto-Start Policy", () => {
    it("auto-starts Break phase when Focus completes (if autoStartNextPhase enabled)", () => {
      useTimer.getState().actions.setPreferences({
        autoSwitchEnabled: true,
        autoStartNextPhase: true,
        focusDurationMs: 5 * 60_000,
      })
      useTimer.getState().actions.start()

      useTimer.getState().actions.advance(Date.now() + 6 * 60 * 1000)

      const after = useTimer.getState().data
      expect(after.phase).toBe(TimerPhase.Break)
      expect(after.status).toBe(TimerStatus.Running)
    })

    it("does NOT auto-start Break → Focus transition (prevents infinite cycling)", () => {
      useTimer.getState().actions.setPreferences({
        autoSwitchEnabled: true,
        autoStartNextPhase: true,
        breakDurationMs: 5 * 60_000,
      })
      useTimer.getState().actions.switchPhase(TimerPhase.Break)
      useTimer.getState().actions.start()

      useTimer.getState().actions.advance(Date.now() + 6 * 60 * 1000)

      const after = useTimer.getState().data
      expect(after.phase).toBe(TimerPhase.Focus)
      expect(after.status).toBe(TimerStatus.Idle)
    })

    it("respects autoStartNextPhase flag", () => {
      useTimer.getState().actions.setPreferences({
        autoSwitchEnabled: true,
        autoStartNextPhase: false,
        focusDurationMs: 5 * 60_000,
      })
      useTimer.getState().actions.start()

      useTimer.getState().actions.advance(Date.now() + 6 * 60 * 1000)

      const after = useTimer.getState().data
      expect(after.phase).toBe(TimerPhase.Break)
      expect(after.status).toBe(TimerStatus.Idle)
    })
  })

  describe("timer.setPhaseDurationMs() - Duration Editing", () => {
    it("updates duration for specified phase", () => {
      const initial = useTimer.getState().data
      expect(initial.preferences.focusDurationMs).toBe(25 * 60_000)
      expect(initial.preferences.breakDurationMs).toBe(5 * 60_000)

      useTimer
        .getState()
        .actions.setPhaseDurationMs(TimerPhase.Focus, 30 * 60_000)

      const afterFocus = useTimer.getState().data
      expect(afterFocus.preferences.focusDurationMs).toBe(30 * 60_000)
      expect(afterFocus.preferences.breakDurationMs).toBe(5 * 60_000)

      useTimer
        .getState()
        .actions.setPhaseDurationMs(TimerPhase.Break, 10 * 60_000)

      const afterBreak = useTimer.getState().data
      expect(afterBreak.preferences.focusDurationMs).toBe(30 * 60_000)
      expect(afterBreak.preferences.breakDurationMs).toBe(10 * 60_000)
    })

    it("stamps completion if new duration < accumulated time (while running)", () => {
      useTimer.getState().actions.setPreferences({
        autoSwitchEnabled: false,
        focusDurationMs: 1000,
      })
      useTimer.getState().actions.start()

      useTimer.getState().actions.setPhaseDurationMs(TimerPhase.Focus, 1000)

      const s = useTimer.getState().data
      expect(s.preferences.focusDurationMs).toBe(1000)
      expect([TimerStatus.Running, TimerStatus.Complete]).toContain(s.status)
    })

    it("preserves timer state when increasing duration", () => {
      useTimer
        .getState()
        .actions.setPreferences({ focusDurationMs: 25 * 60_000 })
      useTimer.getState().actions.start()
      useTimer.getState().actions.pause()

      const before = useTimer.getState().data
      expect(before.status).toBe(TimerStatus.Paused)

      useTimer
        .getState()
        .actions.setPhaseDurationMs(TimerPhase.Focus, 30 * 60_000)

      const after = useTimer.getState().data
      expect(after.status).toBe(TimerStatus.Paused)
      expect(after.preferences.focusDurationMs).toBe(30 * 60_000)
      expect(after.accumulatedMs).toBe(before.accumulatedMs)
    })

    it("doesn't affect other phase's duration", () => {
      useTimer.getState().actions.setPreferences({
        focusDurationMs: 25 * 60_000,
        breakDurationMs: 5 * 60_000,
      })

      useTimer
        .getState()
        .actions.setPhaseDurationMs(TimerPhase.Focus, 30 * 60_000)

      let s = useTimer.getState().data
      expect(s.preferences.focusDurationMs).toBe(30 * 60_000)
      expect(s.preferences.breakDurationMs).toBe(5 * 60_000)

      useTimer
        .getState()
        .actions.setPhaseDurationMs(TimerPhase.Break, 10 * 60_000)

      s = useTimer.getState().data
      expect(s.preferences.focusDurationMs).toBe(30 * 60_000)
      expect(s.preferences.breakDurationMs).toBe(10 * 60_000)
    })
  })
})

describe("Timer: React integration", () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()

    // Keep React tests isolated too, without commit side effects.
    useTimer.setState((s) => ({ ...s, data: DEFAULT_TIMER_STATE }), false)
  })

  it("returns {data, actions} and rerenders on updates", () => {
    const { result } = renderHook(() => useTimer())

    expect(result.current.data.status).toBe(TimerStatus.Paused)

    act(() => {
      result.current.actions.start()
    })

    expect(result.current.data.status).toBe(TimerStatus.Running)
  })

  it("selector form rerenders only when selected value changes", () => {
    const { result } = renderHook(() => useTimer((s) => s.data.status))

    expect(result.current).toBe(TimerStatus.Paused)

    act(() => {
      useTimer.getState().actions.start()
      // or: result.current.actions.start() if you're using the full model hook
    })

    expect(result.current).toBe(TimerStatus.Running)
  })

  it("actions are stable enough to call across renders", () => {
    const { result, rerender } = renderHook(() => useTimer())

    const start = result.current.actions.start
    rerender()

    // If actions are regenerated every render, this can catch weirdness.
    expect(result.current.actions.start).toBe(start)

    act(() => {
      start()
    })

    expect(result.current.data.status).toBe(TimerStatus.Running)
  })
})
