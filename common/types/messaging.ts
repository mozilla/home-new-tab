export type MessageSurface =
  | "feature-highlight"
  | "modal"
  | "inline-prompt"
  | "toast"

export type MessageLifecycleState =
  | "impressed"
  | "dismissed"
  | "completed"
  | "blocked"

export type Message = {
  /** Stable identifier for this message. */
  id: string
  /** Which renderer surface this message targets. */
  surface: MessageSurface
  /** Surface-specific payload. Refined per surface in Phase 4. */
  content: unknown
}
