import { createBufferedLogger } from "@common/utilities/logger"
import { postEvent } from "./_post"
import { readJson, writeJson } from "./_storage"

import type { Message, MessageLifecycleState } from "@common/types"

const logger = createBufferedLogger({
  prefix: "Bridge:Message-state",
  shouldBuffer: false,
  colors: { log: "#ff6c11" },
})

// Storage key for message lifecycle state. Defined here so browser core knows
// where to write when this stub is replaced with a real integration.
const STORAGE_KEY = "coordinator:message-state"

/**
 * Per-message lifecycle record persisted to coordinator storage.
 *
 * Coordinator-internal. Not part of the renderer-facing contract.
 */
type StoredMessageState = {
  impressions: number
  dismissedAt?: number
  completedAt?: number
  blocked?: boolean
}

/**
 * getMessageState
 * ---
 * Returns the terminal lifecycle state for a message, derived from its stored
 * record. Used by the eligibility resolver to skip messages the user has already
 * dismissed or blocked.
 *
 * Priority: blocked > completed > dismissed > impressed > null.
 */
export function getMessageState(id: string): MessageLifecycleState | null {
  const all = readJson<Record<string, StoredMessageState>>(STORAGE_KEY, {})
  const state = all[id]
  if (!state) return null
  if (state.blocked) return "blocked"
  if (state.completedAt !== undefined) return "completed"
  if (state.dismissedAt !== undefined) return "dismissed"
  if (state.impressions > 0) return "impressed"
  return null
}

/**
 * resolveMessages
 * ---
 * Filters a message definition set to the active (eligible) subset.
 *
 * Current rule: blocked messages are excluded. All others are eligible,
 * regardless of impression count or dismissal state. Impression-based caps
 * are deferred — the tracking infrastructure is in place; cap policy comes later.
 */
export function resolveMessages(definitions: Message[]): Message[] {
  const states = readJson<Record<string, StoredMessageState>>(STORAGE_KEY, {})
  return definitions.filter((msg) => !states[msg.id]?.blocked)
}

// --- Lifecycle handlers ---

function updateMessageState(
  id: string,
  updater: (current: StoredMessageState) => StoredMessageState,
): void {
  const all = readJson<Record<string, StoredMessageState>>(STORAGE_KEY, {})
  all[id] = updater(all[id] ?? { impressions: 0 })
  writeJson(STORAGE_KEY, all)
}

/**
 * onMessageImpressed
 * ---
 * Dev stub for the `messageImpressed` host callback. Records the impression
 * count for this message in coordinator storage.
 */
export function onMessageImpressed(id: string): void {
  logger.info("messageImpressed", { id })
  updateMessageState(id, (s) => ({ ...s, impressions: s.impressions + 1 }))
  postEvent("messageImpressed", { id })
}

/**
 * onMessageDismissed
 * ---
 * Dev stub for the `messageDismissed` host callback. Records the dismissal
 * timestamp for this message in coordinator storage.
 */
export function onMessageDismissed(id: string): void {
  logger.info("messageDismissed", { id })
  updateMessageState(id, (s) => ({ ...s, dismissedAt: Date.now() }))
  postEvent("messageDismissed", { id })
}

/**
 * onMessageCompleted
 * ---
 * Dev stub for the `messageCompleted` host callback. Records the completion
 * timestamp for this message in coordinator storage.
 */
export function onMessageCompleted(id: string): void {
  logger.info("messageCompleted", { id })
  updateMessageState(id, (s) => ({ ...s, completedAt: Date.now() }))
  postEvent("messageCompleted", { id })
}

/**
 * onMessageBlocked
 * ---
 * Dev stub for the `messageBlocked` host callback. Permanently blocks this
 * message from future delivery by setting its blocked flag in coordinator storage.
 */
export function onMessageBlocked(id: string): void {
  logger.info("messageBlocked", { id })
  updateMessageState(id, (s) => ({ ...s, blocked: true }))
  postEvent("messageBlocked", { id })
}
