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

export type SyncMsgType = "SYNC_FRAME" | "SYNC_REQUEST" | "SYNC_SNAPSHOT"

export type SyncMsgBase<TType extends SyncMsgType> = {
  type: TType
  fromTabId: string
}

/** Normal live update message (authored on commit). */
export type SyncFrameMsg<TData> = SyncMsgBase<"SYNC_FRAME"> & {
  frame: SyncFrame<TData>
}

/**
 * Catch-up request message.
 * Sent once when a transport starts so existing tabs can reply with their current frame.
 */
export type SyncRequestSnapshotMsg = SyncMsgBase<"SYNC_REQUEST">

/** Catch-up response message containing the responder's current frame. */
export type SyncSnapshotMsg<TData> = SyncMsgBase<"SYNC_SNAPSHOT"> & {
  frame: SyncFrame<TData>
}

export type SyncMsg<TData> =
  | SyncFrameMsg<TData>
  | SyncRequestSnapshotMsg
  | SyncSnapshotMsg<TData>

function channelName(syncKey: string): string {
  return `${CHANNEL_PREFIX}${syncKey}`
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object"
}

function isSyncMsgType(value: unknown): value is SyncMsgType {
  return (
    value === "SYNC_FRAME" ||
    value === "SYNC_REQUEST" ||
    value === "SYNC_SNAPSHOT"
  )
}

function parseSyncMsg<TData>(data: unknown): SyncMsg<TData> | null {
  if (!isObject(data)) return null
  const type = data.type
  const fromTabId = data.fromTabId
  if (!isSyncMsgType(type)) return null
  if (typeof fromTabId !== "string") return null

  // For frame-bearing messages, we require a `frame` field (light structural guard).
  if (type === "SYNC_FRAME" || type === "SYNC_SNAPSHOT") {
    if (!("frame" in data)) return null
    const f = (data as Record<string, unknown>).frame
    if (!isObject(f)) return null
  }

  return data as SyncMsg<TData>
}

/**
 * createBroadcastChannelTransport
 * ---
 * Creates a BroadcastChannel transport for a specific syncKey.
 *
 * Notes:
 * - We ignore messages authored by this tab (echo guard).
 * - Caller supplies onFrame so the store can apply/merge as it sees fit.
 * - On creation, we request a best-effort snapshot from other tabs so a
 *   brand-new tab can converge without requiring a local commit.
 */
export function createBroadcastChannelTransport<TData>(args: {
  syncKey: string
  tabId: string
  onFrame: (frame: SyncFrame<TData>) => void
  onError?: (err: unknown) => void

  /**
   * getFrame
   * ---
   * Read the current local frame WITHOUT committing.
   * Used to reply to snapshot requests.
   */
  getFrame: () => SyncFrame<TData>
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
      const msg = parseSyncMsg<TData>(evt.data)
      if (!msg) return

      // Echo guard: ignore our own messages.
      if (msg.fromTabId === args.tabId) return

      if (msg.type === "SYNC_FRAME") {
        args.onFrame(msg.frame)
        return
      }

      if (msg.type === "SYNC_SNAPSHOT") {
        // Treat snapshots as normal incoming frames.
        args.onFrame(msg.frame)
        return
      }

      if (msg.type === "SYNC_REQUEST") {
        // Best-effort: reply with our current frame.
        const reply: SyncSnapshotMsg<TData> = {
          type: "SYNC_SNAPSHOT",
          fromTabId: args.tabId,
          frame: args.getFrame(),
        }
        bc.postMessage(reply)
        return
      }
    } catch (err) {
      args.onError?.({
        context: "broadcastChannel/onMessage",
        syncKey: args.syncKey,
        error: err,
      })
    }
  }

  bc.addEventListener("message", onMessage)

  // One-shot catch-up request on startup.
  try {
    const hello: SyncRequestSnapshotMsg = {
      type: "SYNC_REQUEST",
      fromTabId: args.tabId,
    }
    bc.postMessage(hello)
  } catch (err) {
    args.onError?.({
      context: "broadcastChannel/postSnapshotRequest",
      syncKey: args.syncKey,
      error: err,
    })
  }

  return {
    post: (frame) => {
      try {
        const msg: SyncFrameMsg<TData> = {
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
