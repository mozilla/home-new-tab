/**
 * MockStorage - Test double for localStorage/sessionStorage
 *
 * Implements the Storage interface with additional inspection capabilities
 * for testing. Provides a writeLog to track all setItem calls for debugging
 * and verification.
 *
 * Usage:
 * ```typescript
 * const mockStorage = new MockStorage()
 * globalThis.window = { localStorage: mockStorage } as any
 * ```
 */
export class MockStorage implements Storage {
  private data: Map<string, string> = new Map()

  /**
   * Log of all write operations for test inspection.
   * Useful for verifying that specific writes occurred.
   */
  public writeLog: Array<{
    key: string
    value: string
    timestamp: number
  }> = []

  get length(): number {
    return this.data.size
  }

  key(index: number): string | null {
    const keys = Array.from(this.data.keys())
    return keys[index] ?? null
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
    this.writeLog.push({
      key,
      value,
      timestamp: Date.now(),
    })
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  clear(): void {
    this.data.clear()
    this.writeLog = []
  }

  /**
   * Test helper: get all stored keys
   */
  keys(): string[] {
    return Array.from(this.data.keys())
  }

  /**
   * Test helper: get all stored entries
   */
  entries(): Array<[string, string]> {
    return Array.from(this.data.entries())
  }

  /**
   * Test helper: simulate quota exceeded error
   * Call this to make the next setItem throw
   */
  simulateQuotaExceeded(): void {
    const originalSetItem = this.setItem.bind(this)
    this.setItem = () => {
      // Restore original after throwing once
      this.setItem = originalSetItem
      const err = new Error("QuotaExceededError")
      err.name = "QuotaExceededError"
      throw err
    }
  }
}
