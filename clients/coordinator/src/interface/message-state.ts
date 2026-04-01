import { createBufferedLogger } from "@common/utilities/logger"
import { postEvent } from "./_post"
import { readJson } from "./_storage"

import type { MessageLifecycleState } from "@common/types"

const logger = createBufferedLogger({
  prefix: "Bridge:Message-state",
  shouldBuffer: false,
  colors: { log: "#ff6c11" },
})

// Storage key for message lifecycle state. Defined here so browser core knows
// where to write when this stub is replaced with a real integration.
const STORAGE_KEY = "coordinator:message-state"

/**
 * getMessageState
 * ---
 * Returns the current lifecycle state for a message, or null if no state
 * has been recorded yet. Used by messaging eligibility to skip messages
 * the user has already dismissed or blocked.
 *
 * In dev, this always returns null — nothing writes message state until
 * browser core provides a real implementation.
 */
export function getMessageState(id: string): MessageLifecycleState | null {
  const all = readJson<Record<string, MessageLifecycleState>>(STORAGE_KEY, {})
  return all[id] ?? null
}

/**
 * onMessageImpressed
 * ---
 * Dev stub for the `messageImpressed` host callback. Logs the action so
 * it's visible during development.
 */
export function onMessageImpressed(id: string): void {
  logger.info("messageImpressed", { id })
  postEvent("messageImpressed", { id })
}

/**
 * onMessageDismissed
 * ---
 * Dev stub for the `messageDismissed` host callback. Logs the action so
 * it's visible during development.
 */
export function onMessageDismissed(id: string): void {
  logger.info("messageDismissed", { id })
  postEvent("messageDismissed", { id })
}

/**
 * onMessageCompleted
 * ---
 * Dev stub for the `messageCompleted` host callback. Logs the action so
 * it's visible during development.
 */
export function onMessageCompleted(id: string): void {
  logger.info("messageCompleted", { id })
  postEvent("messageCompleted", { id })
}

/**
 * onMessageBlocked
 * ---
 * Dev stub for the `messageBlocked` host callback. Logs the action so
 * it's visible during development.
 */
export function onMessageBlocked(id: string): void {
  logger.info("messageBlocked", { id })
  postEvent("messageBlocked", { id })
}
