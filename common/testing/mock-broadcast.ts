/**
 * BroadcastChannel mock
 * ---
 * Minimal in-memory bus that matches what our system needs:
 * - per-channel fanout
 * - "message" event listeners
 * - close()
 *
 * Behavior:
 * - postMessage delivers to OTHER instances on same channel (not self)
 */
type MockMessageHandler = (evt: MessageEvent) => void

export class MockBroadcastChannel {
  static channels = new Map<string, Set<MockBroadcastChannel>>()

  public name: string
  private closed = false
  private listeners = new Set<MockMessageHandler>()

  constructor(name: string) {
    this.name = name
    const set = MockBroadcastChannel.channels.get(name) ?? new Set()
    set.add(this)
    MockBroadcastChannel.channels.set(name, set)
  }

  postMessage(data: unknown): void {
    if (this.closed) return
    const set = MockBroadcastChannel.channels.get(this.name)
    if (!set) return

    for (const peer of set) {
      if (peer === this) continue
      if (peer.closed) continue
      for (const handler of peer.listeners) {
        handler({ data } as MessageEvent)
      }
    }
  }

  addEventListener(type: "message", handler: MockMessageHandler): void {
    if (this.closed) return
    if (type !== "message") return
    this.listeners.add(handler)
  }

  removeEventListener(type: "message", handler: MockMessageHandler): void {
    if (type !== "message") return
    this.listeners.delete(handler)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    const set = MockBroadcastChannel.channels.get(this.name)
    set?.delete(this)
    if (set && set.size === 0) MockBroadcastChannel.channels.delete(this.name)
    this.listeners.clear()
  }

  static reset(): void {
    MockBroadcastChannel.channels.clear()
  }
}
