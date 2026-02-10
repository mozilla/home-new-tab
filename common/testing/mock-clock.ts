/**
 * MockClock - Deterministic time control for testing
 *
 * Provides a controllable clock for testing time-dependent logic.
 * Unlike vi.useFakeTimers(), this works with injectable `nowMs()` functions,
 * which is how the cross-tab sync system handles time.
 *
 * Usage:
 * ```typescript
 * const clock = new MockClock()
 * clock.set(1000) // Set to specific timestamp
 *
 * const store = createCrossTabStore({
 *   nowMs: () => clock.now() // Inject mock clock
 * }, ...)
 *
 * clock.advance(500) // Move forward 500ms
 * ```
 */
export class MockClock {
  private currentTime: number

  /**
   * Create a new MockClock
   * @param initialTime - Starting timestamp (default: 1700000000000, a fixed epoch)
   */
  constructor(initialTime = 1700000000000) {
    this.currentTime = initialTime
  }

  /**
   * Get the current mocked time in milliseconds
   */
  now(): number {
    return this.currentTime
  }

  /**
   * Advance the clock forward by the specified duration
   * @param ms - Milliseconds to advance
   */
  advance(ms: number): void {
    if (ms < 0) {
      throw new Error("Cannot advance clock backwards")
    }
    this.currentTime += ms
  }

  /**
   * Set the clock to a specific timestamp
   * @param ms - Absolute timestamp in milliseconds
   */
  set(ms: number): void {
    this.currentTime = ms
  }

  /**
   * Reset the clock to the initial time
   */
  reset(initialTime = 1700000000000): void {
    this.currentTime = initialTime
  }
}
