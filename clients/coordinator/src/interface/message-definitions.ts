import { readJson } from "./_storage"

import type { Message } from "@common/types"

// Storage key for dev overrides. Write a JSON array here to replace the
// default fixture without changing code.
const STORAGE_KEY = "coordinator:message-definitions"

// Static dev fixture. In production, ASRouter/Nimbus (browser core) provides
// the message definition set. The fixture covers all four surfaces so each
// can be exercised during development.
const DEV_MESSAGES: Message[] = [
  { id: "msg-onboarding-modal", surface: "modal", content: {} },
  { id: "msg-wallpaper-highlight", surface: "feature-highlight", content: {} },
  { id: "msg-topic-prompt", surface: "inline-prompt", content: {} },
  { id: "msg-report-toast", surface: "toast", content: {} },
]

/**
 * getMessageDefinitions
 * ---
 * Returns the full message definition set for eligibility resolution.
 *
 * In production, the coordinator receives message definitions from ASRouter
 * or Nimbus (browser core). The dev reference uses a static fixture covering
 * all four surfaces, with an optional localStorage override for targeted testing.
 */
export function getMessageDefinitions(): Message[] {
  return readJson<Message[]>(STORAGE_KEY, DEV_MESSAGES)
}
