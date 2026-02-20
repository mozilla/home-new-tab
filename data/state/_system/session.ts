/**
 * App session discovery (for restore:"session")
 * ---------------------------------------------------------
 * We maintain a single "app session" id shared across all open tabs.
 *
 * Why:
 * - Reload should restore (same tab keeps its session id)
 * - Opening a new tab while another is open should restore (new tab discovers session id)
 * - Closing ALL tabs should end the session (sessionStorage clears; no one can answer discovery)
 *
 * How it works:
 * - Each tab stores its current sessionId in sessionStorage (survives reload, dies when tab closes).
 * - If a tab doesn't have a sessionId yet, it asks other tabs over BroadcastChannel.
 * - If a tab hears an answer, it adopts that sessionId.
 * - If nobody answers quickly, it creates a new sessionId and announces it.
 *
 * No heartbeats. No "last tab closed" detection. Just: if someone can answer, the session exists.
 */

const TAB_ID_KEY = "app:tabId"
const SESSION_ID_KEY = "app:sessionId"
const SESSION_CHANNEL = "app:session"

const MSG_DISCOVER = "SESSION_DISCOVER"
const MSG_ANNOUNCE = "SESSION_ANNOUNCE"

// Small on purpose: we only need to catch tabs that are already open.
// If nobody answers quickly, we assume we're the first tab.
const DISCOVER_TIMEOUT_MS = 32

/**
 * BaseMsg
 * ---------------------------------------------------------
 * Shared utility for BroadcastChannel session protocol messages.
 *
 * Why:
 * - All session messages carry a discriminant `type` field
 * - All messages include the originating tabId for observability/debugging
 * - Using a base type keeps message shapes consistent and readable
 *
 * The generic `T` represents the literal message type string
 * (e.g. "SESSION_DISCOVER", "SESSION_ANNOUNCE").
 *
 * Example:
 * type DiscoverMsg = BaseMsg<typeof MSG_DISCOVER>
 */
export type BaseMsg<T extends string> = { type: T; fromTabId: string }
type DiscoverMsg = BaseMsg<typeof MSG_DISCOVER>
type AnnounceMsg = BaseMsg<typeof MSG_ANNOUNCE> & { sessionId: string }
type SessionMsg = DiscoverMsg | AnnounceMsg

let cachedTabId: string | null = null
let cachedSessionId: string | null = null
let sessionIdPromise: Promise<string> | null = null
let channel: BroadcastChannel | null = null
let listening = false

function nowMs(): number {
  return Date.now()
}

// Not cryptographic; just needs to avoid collisions for our local runtime identities.
function randomId(prefix: string): string {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined
  if (typeof c?.randomUUID === "function") {
    return `${prefix}_${c.randomUUID()}`
  }

  return `${prefix}_${nowMs()}_${Math.random().toString(16).slice(2)}`
}

export function getOrCreateTabId(): string {
  if (cachedTabId) return cachedTabId
  if (typeof window === "undefined") return "ssr"

  try {
    const existing = window.sessionStorage.getItem(TAB_ID_KEY)
    if (existing) {
      cachedTabId = existing
      return existing
    }

    const id = randomId("tab")

    window.sessionStorage.setItem(TAB_ID_KEY, id)
    cachedTabId = id
    return id
  } catch {
    cachedTabId = cachedTabId ?? randomId("tab")
    return cachedTabId
  }
}

function getSessionIdFromSessionStorage(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.sessionStorage.getItem(SESSION_ID_KEY)
  } catch {
    return null
  }
}

function setSessionIdInSessionStorage(sessionId: string): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(SESSION_ID_KEY, sessionId)
  } catch {
    // If storage is blocked, we still keep it in-memory for this tab.
  }
}

function ensureChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null
  if (channel) return channel

  try {
    if (typeof BroadcastChannel === "undefined") return null
    channel = new BroadcastChannel(SESSION_CHANNEL)
    return channel
  } catch {
    return null
  }
}

function ensureListening(): void {
  if (listening) return
  const bc = ensureChannel()
  if (!bc) return

  listening = true
  bc.addEventListener("message", (evt: MessageEvent) => {
    const msg = evt.data as SessionMsg | null
    if (!msg || typeof msg !== "object") return

    // If another tab asks for the session, and we know it, tell them.
    if (msg.type === MSG_DISCOVER) {
      if (!cachedSessionId) return
      bc.postMessage({
        type: MSG_ANNOUNCE,
        fromTabId: getOrCreateTabId(),
        sessionId: cachedSessionId,
      } satisfies AnnounceMsg)
      return
    }

    // If another tab announces a sessionId, adopt it if we don't have one yet.
    if (msg.type === MSG_ANNOUNCE) {
      if (cachedSessionId) return
      cachedSessionId = msg.sessionId
      setSessionIdInSessionStorage(msg.sessionId)
    }
  })
}

/**
 * getOrCreateAppSessionId
 * ---
 * Returns the current app session id, discovering it from other tabs if needed.
 *
 * Guarantees:
 * - Reload restores (sessionId is stored in sessionStorage)
 * - New tab restores while other tabs are open (discover via BroadcastChannel)
 * - Full close/reopen does NOT restore (sessionStorage clears and nobody answers)
 */
export function getOrCreateAppSessionId(): Promise<string> {
  if (cachedSessionId) return Promise.resolve(cachedSessionId)
  if (sessionIdPromise) return sessionIdPromise

  sessionIdPromise = (async () => {
    if (typeof window === "undefined") return "ssr"

    // 1) If this tab already has a sessionId (reload), use it immediately.
    const existing = getSessionIdFromSessionStorage()
    if (existing) {
      cachedSessionId = existing
      ensureListening()

      // Friendly: announce so freshly-opened tabs can adopt quickly.
      const bc = ensureChannel()
      if (bc) {
        bc.postMessage({
          type: MSG_ANNOUNCE,
          fromTabId: getOrCreateTabId(),
          sessionId: existing,
        } satisfies AnnounceMsg)
      }

      return existing
    }

    // 2) Try to discover an active session from other tabs.
    ensureListening()
    const bc = ensureChannel()

    if (bc) {
      const discovered = await discoverSessionId(bc)
      if (discovered) {
        cachedSessionId = discovered
        setSessionIdInSessionStorage(discovered)
        return discovered
      }
    }

    // 3) Nobody answered (or BroadcastChannel unavailable) -> new session.
    const generatedId = randomId("session")

    cachedSessionId = generatedId
    setSessionIdInSessionStorage(generatedId)

    // Announce so other near-simultaneous tabs converge quickly.
    if (bc) {
      bc.postMessage({
        type: MSG_ANNOUNCE,
        fromTabId: getOrCreateTabId(),
        sessionId: generatedId,
      } satisfies AnnounceMsg)
    }

    return generatedId
  })()

  return sessionIdPromise
}

function discoverSessionId(bc: BroadcastChannel): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false

    const finish = (value: string | null) => {
      if (done) return
      done = true
      cleanup()
      resolve(value)
    }

    const onMessage = (evt: MessageEvent) => {
      const msg = evt.data as SessionMsg | null
      if (!msg || typeof msg !== "object") return
      if (msg.type !== MSG_ANNOUNCE) return
      finish(msg.sessionId)
    }

    const cleanup = () => {
      bc.removeEventListener("message", onMessage)
      clearTimeout(timer)
    }

    bc.addEventListener("message", onMessage)

    // Ask other tabs what session they’re in.
    bc.postMessage({
      type: MSG_DISCOVER,
      fromTabId: getOrCreateTabId(),
    } satisfies DiscoverMsg)

    const timer = window.setTimeout(() => finish(null), DISCOVER_TIMEOUT_MS)
  })
}

/**
 * __resetSessionCache (TEST ONLY)
 * ---
 * Resets module caches for test isolation.
 */
export function __resetSessionCache(): void {
  cachedSessionId = null
  sessionIdPromise = null
  cachedTabId = null
}
