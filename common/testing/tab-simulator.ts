/**
 * TabSimulator - Multi-tab scenario testing
 *
 * Simulates multiple browser tabs in a single test process.
 * Each "tab" has its own storage and can dispatch storage events
 * to other tabs, mimicking cross-tab communication.
 *
 * This is conceptually accurate even though all tabs run in the same
 * process: storage events only fire in OTHER tabs, not the originating tab.
 */

import { MockStorage } from "./mock-storage"
import { createStorageEvent } from "./storage-events"
import type { SyncFrame } from "../../data/state/_system/types"

/**
 * Context for a simulated browser tab
 */
export interface TabContext {
  tabId: string
  storage: MockStorage
  eventListeners: Array<{
    type: string
    listener: EventListenerOrEventListenerObject
  }>
}

/**
 * TabSimulator - Orchestrates multi-tab test scenarios
 *
 * Usage:
 * ```typescript
 * const simulator = new TabSimulator()
 * const tabA = simulator.createTab('tab-a')
 * const tabB = simulator.createTab('tab-b')
 *
 * // Simulate Tab A writes to localStorage
 * const frame = createMockSyncFrame({ count: 1 })
 * simulator.simulateWrite('tab-a', 'app:store', frame)
 *
 * // Tab B receives storage event and can read the value
 * expect(tabB.storage.getItem('app:store')).toBe(JSON.stringify(frame))
 * ```
 */
export class TabSimulator {
  private tabs: Map<string, TabContext> = new Map()
  private sharedStorage: MockStorage = new MockStorage()

  /**
   * Create a new simulated tab
   *
   * @param tabId - Unique identifier for this tab
   * @returns TabContext with storage and event management
   */
  createTab(tabId: string): TabContext {
    if (this.tabs.has(tabId)) {
      throw new Error(`Tab ${tabId} already exists`)
    }

    const context: TabContext = {
      tabId,
      storage: this.sharedStorage, // All tabs share the same storage
      eventListeners: [],
    }

    this.tabs.set(tabId, context)
    return context
  }

  /**
   * Remove a tab (simulates closing the tab)
   *
   * @param tabId - The tab to remove
   */
  removeTab(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return

    // Clean up event listeners
    tab.eventListeners.forEach(({ type, listener }) => {
      window.removeEventListener(type, listener)
    })

    this.tabs.delete(tabId)
  }

  /**
   * Simulate a write to localStorage from a specific tab
   *
   * This will:
   * 1. Write the value to the shared storage
   * 2. Fire storage events to ALL OTHER tabs (not the originating tab)
   *
   * This accurately mimics browser behavior where storage events
   * only fire in other tabs, not the tab that made the change.
   *
   * @param fromTabId - The tab that's writing
   * @param key - The storage key
   * @param frame - The sync frame to write
   */
  simulateWrite<TData>(
    fromTabId: string,
    key: string,
    frame: SyncFrame<TData>,
  ): void {
    const fromTab = this.tabs.get(fromTabId)
    if (!fromTab) {
      throw new Error(`Tab ${fromTabId} does not exist`)
    }

    // Write to shared storage
    const value = JSON.stringify(frame)
    const oldValue = this.sharedStorage.getItem(key)
    this.sharedStorage.setItem(key, value)

    // Fire storage events to ALL OTHER tabs
    for (const [otherTabId, otherTab] of this.tabs.entries()) {
      if (otherTabId === fromTabId) continue // Skip originating tab

      const event = createStorageEvent(key, value, oldValue, this.sharedStorage)

      // Dispatch to that tab's listeners
      otherTab.eventListeners.forEach(({ type, listener }) => {
        if (type === "storage") {
          if (typeof listener === "function") {
            listener(event)
          } else {
            listener.handleEvent(event)
          }
        }
      })
    }
  }

  /**
   * Register an event listener for a specific tab
   *
   * This is used internally by stores when they call window.addEventListener.
   * The simulator needs to track these to properly dispatch events.
   *
   * @param tabId - The tab registering the listener
   * @param type - Event type (e.g., 'storage')
   * @param listener - The event listener function
   */
  registerEventListener(
    tabId: string,
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    const tab = this.tabs.get(tabId)
    if (!tab) {
      throw new Error(`Tab ${tabId} does not exist`)
    }

    tab.eventListeners.push({ type, listener })
  }

  /**
   * Get the current state from a specific tab's perspective
   *
   * @param tabId - The tab to read from
   * @param key - The storage key
   * @returns The parsed sync frame, or null if not found
   */
  getSyncFrame<TData>(tabId: string, key: string): SyncFrame<TData> | null {
    const tab = this.tabs.get(tabId)
    if (!tab) {
      throw new Error(`Tab ${tabId} does not exist`)
    }

    const raw = tab.storage.getItem(key)
    if (!raw) return null

    try {
      return JSON.parse(raw) as SyncFrame<TData>
    } catch {
      return null
    }
  }

  /**
   * Assert that all tabs have converged to the same state
   *
   * This is a key invariant: after propagation settles, all tabs
   * should see the same sync frame in localStorage.
   *
   * @param storageKey - The key to check
   * @throws Error if tabs have different values
   */
  assertConvergence(storageKey: string): void {
    if (this.tabs.size === 0) {
      throw new Error("No tabs to check for convergence")
    }

    const frames: Array<{ tabId: string; frame: string | null }> = []

    for (const [tabId, tab] of this.tabs.entries()) {
      const value = tab.storage.getItem(storageKey)
      frames.push({ tabId, frame: value })
    }

    // All tabs should have the same value
    const firstValue = frames[0]?.frame
    const divergent = frames.filter((f) => f.frame !== firstValue)

    if (divergent.length > 0) {
      const details = frames
        .map((f) => `  ${f.tabId}: ${f.frame}`)
        .join("\n")
      throw new Error(
        `Tabs did not converge for key "${storageKey}":\n${details}`,
      )
    }
  }

  /**
   * Clear all tabs and reset simulator
   */
  reset(): void {
    for (const tabId of Array.from(this.tabs.keys())) {
      this.removeTab(tabId)
    }
    this.sharedStorage.clear()
  }

  /**
   * Get all tab IDs currently in the simulator
   */
  getTabIds(): string[] {
    return Array.from(this.tabs.keys())
  }
}
