import type { SyncFrame } from "./types"

/**
 * Live sync transport
 * ---------------------------------------------------------
 * Live sync is responsible for one thing:
 *   "Deliver frames to other open tabs immediately."
 *
 * This file intentionally does NOT:
 * - read/write restore storage
 * - merge frames
 * - know about store state
 *
 * We use BroadcastChannel as the primary transport.
 * If BroadcastChannel is unavailable, sync becomes a no-op.
 */

const CHANNEL_PREFIX = "app:sync:"

export type SyncTransportHandle<TData> = {
  /**
   * Publish a frame to other tabs.
   * Implementations may choose to drop messages if transport is unavailable.
   */
  post: (frame: SyncFrame<TData>) => void

  /** Unsubscribe/cleanup any listeners. */
  cleanup: () => void
}

type SyncMsg<TData> = {
  type: "SYNC_FRAME"
  fromTabId: string
  frame: SyncFrame<TData>
}

function channelName(syncKey: string): string {
  return `${CHANNEL_PREFIX}${syncKey}`
}

/**
 * createBroadcastChannelTransport
 * ---
 * Creates a BroadcastChannel transport for a specific syncKey.
 *
 * Notes:
 * - We ignore messages authored by this tab (echo guard).
 * - Caller supplies onFrame so the store can apply/merge as it sees fit.
 */
export function createBroadcastChannelTransport<TData>(args: {
  syncKey: string
  tabId: string
  onFrame: (frame: SyncFrame<TData>) => void
  onError?: (err: unknown) => void
}): SyncTransportHandle<TData> {
  if (typeof window === "undefined") {
    return { post: () => {}, cleanup: () => {} }
  }

  if (typeof BroadcastChannel === "undefined") {
    return { post: () => {}, cleanup: () => {} }
  }

  const name = channelName(args.syncKey)

  let bc: BroadcastChannel
  try {
    bc = new BroadcastChannel(name)
  } catch (err) {
    args.onError?.({
      context: "createBroadcastChannelTransport",
      syncKey: args.syncKey,
      error: err,
    })
    return { post: () => {}, cleanup: () => {} }
  }

  const onMessage = (evt: MessageEvent) => {
    try {
      const msg = evt.data as SyncMsg<TData> | null
      if (!msg || typeof msg !== "object") return
      if (msg.type !== "SYNC_FRAME") return

      // Echo guard: ignore our own messages.
      if (msg.fromTabId === args.tabId) return

      args.onFrame(msg.frame)
    } catch (err) {
      args.onError?.({
        context: "broadcastChannel/onMessage",
        syncKey: args.syncKey,
        error: err,
      })
    }
  }

  bc.addEventListener("message", onMessage)

  return {
    post: (frame) => {
      try {
        const msg: SyncMsg<TData> = {
          type: "SYNC_FRAME",
          fromTabId: args.tabId,
          frame,
        }
        bc.postMessage(msg)
      } catch (err) {
        args.onError?.({
          context: "broadcastChannel/post",
          syncKey: args.syncKey,
          error: err,
        })
      }
    },

    cleanup: () => {
      try {
        bc.removeEventListener("message", onMessage)
        bc.close()
      } catch (err) {
        args.onError?.({
          context: "broadcastChannel/cleanup",
          syncKey: args.syncKey,
          error: err,
        })
      }
    },
  }
}
