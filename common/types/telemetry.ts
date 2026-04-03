/**
 * Content item type for impression and click events.
 */
export type ContentItemType = "organic" | "sponsored" | "ad-tile" | "top-site"

/**
 * A content item became visible to the user.
 */
export type ImpressionEvent = {
  event: "impression"
  itemId: string
  itemType: ContentItemType
  /** Zero-based position in the rendered list or grid. */
  position: number
  /** Section ID, when the item appears within a named section. */
  section?: string
}

/**
 * The user clicked a content item.
 */
export type ClickEvent = {
  event: "click"
  itemId: string
  itemType: ContentItemType
  position: number
  section?: string
}

/**
 * The user followed a content section.
 */
export type SectionFollowEvent = {
  event: "section.follow"
  sectionId: string
}

/**
 * The user unfollowed a content section.
 */
export type SectionUnfollowEvent = {
  event: "section.unfollow"
  sectionId: string
}

/**
 * The user blocked a content section.
 */
export type SectionBlockEvent = {
  event: "section.block"
  sectionId: string
}

/**
 * The user initiated a search handoff.
 */
export type SearchHandoffEvent = {
  event: "search.handoff"
  /** Whether the handoff carried a query string. */
  hasQuery: boolean
}

/**
 * The user started a focus timer session.
 */
export type TimerStartEvent = {
  event: "timer.start"
  phase: "focus" | "break"
  durationMs: number
}

/**
 * A focus timer session completed without interruption.
 */
export type TimerCompleteEvent = {
  event: "timer.complete"
  phase: "focus" | "break"
  durationMs: number
}

/**
 * The user added a task to a list.
 */
export type ListItemAddEvent = {
  event: "list.item.add"
}

/**
 * The user marked a task as complete.
 */
export type ListItemCompleteEvent = {
  event: "list.item.complete"
}

/**
 * All telemetry events the renderer can dispatch to the coordinator.
 *
 * Discriminated on `event`. The coordinator routes each to the appropriate
 * telemetry channel — standard Glean ping or private OHTTP ping — based on
 * the event type and privacy classification.
 */
export type TelemetryEvent =
  | ImpressionEvent
  | ClickEvent
  | SectionFollowEvent
  | SectionUnfollowEvent
  | SectionBlockEvent
  | SearchHandoffEvent
  | TimerStartEvent
  | TimerCompleteEvent
  | ListItemAddEvent
  | ListItemCompleteEvent
