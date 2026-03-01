import { describe, it, expect } from "vitest"

import { TimerStatus, TimerPhase } from "../types"
import { deriveTimerView } from "./index"

import type { TimerData } from "../types"

/**
 * createTestState
 * ---------------------------------------------------------
 * Test fixture helper to create minimal TimerData objects.
 *
 * Why: Reduces boilerplate and keeps tests focused on what varies.
 */
const createTestState = (overrides?: Partial<TimerData>): TimerData => ({
  phase: TimerPhase.Focus,
  status: TimerStatus.Idle,
  startedAtMs: null,
  accumulatedMs: 0,
  eventId: 0,
  preferences: {
    focusDurationMs: 25 * 60_000,
    breakDurationMs: 5 * 60_000,
    autoSwitchEnabled: false,
    autoStartNextPhase: false,
  },
  ...overrides,
})

describe("deriveTimerView - Core Calculations", () => {
  it("derives correct values for a running timer", () => {
    // Arrange: Running timer with 5 seconds elapsed
    const state = createTestState({
      status: TimerStatus.Running,
      startedAtMs: 1000,
      accumulatedMs: 0,
      preferences: {
        focusDurationMs: 10_000,
        breakDurationMs: 5_000,
        autoSwitchEnabled: false,
        autoStartNextPhase: false,
      },
    })
    const nowMs = 6000 // 5 seconds elapsed

    // Act: Derive view
    const view = deriveTimerView(state, nowMs)

    // Assert: All values should be correctly calculated
    // Why this matters: Core functionality - powers the entire timer UI
    expect(view.phase).toBe(TimerPhase.Focus)
    expect(view.status).toBe(TimerStatus.Running)
    expect(view.totalMs).toBe(10_000)
    expect(view.elapsedMs).toBe(5_000)
    expect(view.remainingMs).toBe(5_000)
    expect(view.progress).toBe(0.5) // 50% through
    expect(view.shouldComplete).toBe(false)
    expect(view.isComplete).toBe(false)
  })

  it("derives correctly from accumulated time when paused", () => {
    // Arrange: Paused timer with 3 seconds banked
    const state = createTestState({
      status: TimerStatus.Paused,
      startedAtMs: null, // Not running
      accumulatedMs: 3_000, // 3 seconds banked
      preferences: {
        focusDurationMs: 10_000,
        breakDurationMs: 5_000,
        autoSwitchEnabled: false,
        autoStartNextPhase: false,
      },
    })
    const nowMs = 999_999 // Arbitrary - shouldn't affect paused state

    // Act: Derive view
    const view = deriveTimerView(state, nowMs)

    // Assert: Should use only accumulated time
    // Why this matters: When paused, timer "freezes" at accumulated time
    expect(view.elapsedMs).toBe(3_000) // Only accumulated, no running delta
    expect(view.remainingMs).toBe(7_000)
    expect(view.progress).toBe(0.3) // 30% through
    expect(view.shouldComplete).toBe(false)
  })

  it("derives correctly for fresh Idle state", () => {
    // Arrange: Fresh timer, never started
    const state = createTestState({
      status: TimerStatus.Idle,
      startedAtMs: null,
      accumulatedMs: 0,
      preferences: {
        focusDurationMs: 25 * 60_000,
        breakDurationMs: 5 * 60_000,
        autoSwitchEnabled: false,
        autoStartNextPhase: false,
      },
    })
    const nowMs = Date.now()

    // Act: Derive view
    const view = deriveTimerView(state, nowMs)

    // Assert: Should show full duration remaining
    // Why this matters: Initial UI state must be correct
    expect(view.elapsedMs).toBe(0)
    expect(view.remainingMs).toBe(25 * 60_000)
    expect(view.progress).toBe(0)
    expect(view.shouldComplete).toBe(false)
    expect(view.isComplete).toBe(false)
  })
})

describe("deriveTimerView - Edge Cases", () => {
  it("handles totalMs = 0 without crashing (division by zero)", () => {
    // Arrange: Timer with zero duration (edge case / invalid config)
    const state = createTestState({
      status: TimerStatus.Running,
      startedAtMs: 1000,
      accumulatedMs: 0,
      preferences: {
        focusDurationMs: 0, // Zero duration!
        breakDurationMs: 5_000,
        autoSwitchEnabled: false,
        autoStartNextPhase: false,
      },
    })
    const nowMs = 2000

    // Act: Derive view
    const view = deriveTimerView(state, nowMs)

    // Assert: Should treat as fully progressed without crashing
    // Why this matters: Protects against division by zero in progress calculation
    expect(view.totalMs).toBe(0)
    expect(view.progress).toBe(1) // Explicitly set to 1 (fully progressed)
    expect(view.shouldComplete).toBe(true) // Boundary immediately reached
  })

  it("clamps progress when elapsed exceeds total (overflow)", () => {
    // Arrange: Timer running way past its duration
    const state = createTestState({
      status: TimerStatus.Running,
      startedAtMs: 1000,
      accumulatedMs: 0,
      preferences: {
        focusDurationMs: 5_000,
        breakDurationMs: 5_000,
        autoSwitchEnabled: false,
        autoStartNextPhase: false,
      },
    })
    const nowMs = 10_000 // 9 seconds elapsed, but total is only 5 seconds

    // Act: Derive view
    const view = deriveTimerView(state, nowMs)

    // Assert: Progress and remainingMs should be clamped
    // Why this matters: Prevents negative time or progress > 100% in UI
    expect(view.elapsedMs).toBeGreaterThan(view.totalMs)
    expect(view.remainingMs).toBe(0) // Clamped to 0
    expect(view.progress).toBe(1) // Clamped to 1.0 (100%)
    expect(view.shouldComplete).toBe(true)
  })

  it("correctly detects completion at exact boundary", () => {
    // Arrange: Timer exactly at duration boundary
    const state = createTestState({
      status: TimerStatus.Running,
      startedAtMs: 1000,
      accumulatedMs: 0,
      preferences: {
        focusDurationMs: 5_000,
        breakDurationMs: 5_000,
        autoSwitchEnabled: false,
        autoStartNextPhase: false,
      },
    })
    const nowMs = 6000 // Exactly 5 seconds elapsed

    // Act: Derive view
    const view = deriveTimerView(state, nowMs)

    // Assert: Should detect boundary exactly (no off-by-one)
    // Why this matters: Ensures timer completes precisely when expected
    expect(view.elapsedMs).toBe(5_000)
    expect(view.totalMs).toBe(5_000)
    expect(view.remainingMs).toBe(0)
    expect(view.progress).toBe(1)
    expect(view.shouldComplete).toBe(true) // elapsedMs >= totalMs
  })
})

describe("deriveTimerView - Status Semantics", () => {
  it("reflects Complete status from state, not just elapsed time", () => {
    // Arrange: State is authoritatively Complete, but elapsed < total
    const state = createTestState({
      status: TimerStatus.Complete, // Authoritatively complete
      startedAtMs: null,
      accumulatedMs: 5_000, // Only 5s accumulated
      preferences: {
        focusDurationMs: 10_000, // But total is 10s
        breakDurationMs: 5_000,
        autoSwitchEnabled: false,
        autoStartNextPhase: false,
      },
    })
    const nowMs = 999_999

    // Act: Derive view
    const view = deriveTimerView(state, nowMs)

    // Assert: isComplete and shouldComplete have different semantics
    // Why this matters: isComplete = authoritative status, shouldComplete = derived boundary
    expect(view.isComplete).toBe(true) // Comes from status (authoritative)
    expect(view.shouldComplete).toBe(false) // Derived from elapsed/total (only 5s of 10s)
  })

  it("distinguishes Running status even when complete", () => {
    // Arrange: Running timer that has exceeded duration
    // (This can happen if completion stamping hasn't run yet)
    const state = createTestState({
      status: TimerStatus.Running, // Still Running (not yet stamped Complete)
      startedAtMs: 1000,
      accumulatedMs: 0,
      preferences: {
        focusDurationMs: 5_000,
        breakDurationMs: 5_000,
        autoSwitchEnabled: false,
        autoStartNextPhase: false,
      },
    })
    const nowMs = 10_000 // Way past boundary

    // Act: Derive view
    const view = deriveTimerView(state, nowMs)

    // Assert: shouldComplete is true, but isComplete follows status
    // Why this matters: Shows when completion stamping is needed
    expect(view.isComplete).toBe(false) // Status not yet Complete
    expect(view.shouldComplete).toBe(true) // But boundary reached
    expect(view.status).toBe(TimerStatus.Running) // Still Running
  })
})

describe("deriveTimerView - Phase-Specific Behavior", () => {
  it("uses correct duration for Focus phase", () => {
    // Arrange: Timer in Focus phase
    const state = createTestState({
      phase: TimerPhase.Focus,
      preferences: {
        focusDurationMs: 25 * 60_000,
        breakDurationMs: 5 * 60_000,
        autoSwitchEnabled: false,
        autoStartNextPhase: false,
      },
    })

    // Act: Derive view
    const view = deriveTimerView(state, Date.now())

    // Assert: Should use focusDurationMs
    // Why this matters: Each phase has independent duration settings
    expect(view.phase).toBe(TimerPhase.Focus)
    expect(view.totalMs).toBe(25 * 60_000) // Focus duration (25 minutes)
  })

  it("uses correct duration for Break phase", () => {
    // Arrange: Timer in Break phase
    const state = createTestState({
      phase: TimerPhase.Break,
      preferences: {
        focusDurationMs: 25 * 60_000,
        breakDurationMs: 5 * 60_000,
        autoSwitchEnabled: false,
        autoStartNextPhase: false,
      },
    })

    // Act: Derive view
    const view = deriveTimerView(state, Date.now())

    // Assert: Should use breakDurationMs
    // Why this matters: Phase determines which duration to use
    expect(view.phase).toBe(TimerPhase.Break)
    expect(view.totalMs).toBe(5 * 60_000) // Break duration (5 minutes)
  })

  it("calculates progress relative to current phase duration", () => {
    // Arrange: Timer in Break phase with 2.5s elapsed of 5s total
    const state = createTestState({
      phase: TimerPhase.Break,
      status: TimerStatus.Running,
      startedAtMs: 1000,
      accumulatedMs: 0,
      preferences: {
        focusDurationMs: 25 * 60_000, // 25 minutes (not used)
        breakDurationMs: 5_000, // 5 seconds (used)
        autoSwitchEnabled: false,
        autoStartNextPhase: false,
      },
    })
    const nowMs = 3500 // 2.5 seconds elapsed

    // Act: Derive view
    const view = deriveTimerView(state, nowMs)

    // Assert: Progress should be relative to Break duration, not Focus
    // Why this matters: Progress bar should be accurate for current phase
    expect(view.totalMs).toBe(5_000)
    expect(view.elapsedMs).toBe(2_500)
    expect(view.progress).toBe(0.5) // 50% through Break (not 0.16% of Focus)
  })
})
