import type { Layout } from "./layout"

export type IAB = {
  /** Content category labels from the IAB taxonomy. */
  categories: string[]
  /** IAB taxonomy version used for classification. */
  taxonomy: string
}

export type FeedMeta = {
  /** Timestamp when the user followed this feed, or null if not followed. */
  followedAt: number | null
  /** IAB content classification for this feed. */
  iab: IAB | null
  /** Whether the user has blocked this feed. */
  isBlocked: boolean
  /** Whether the user is following this feed. */
  isFollowed: boolean
  /** Whether this feed is visible on initial load. */
  isInitiallyVisible: boolean
  /** Grid layout configuration for this feed's cards. */
  layout: Layout
  /** Position this feed was ranked by the recommendation engine. */
  receivedFeedRank: number
  /** Items recommended within this feed. */
  recommendations: DiscoveryItem[]
  /** Secondary label displayed below the feed title. */
  subtitle: string | null
  /** Display name for this feed. */
  title: string
}

export type DiscoverFeed = {
  /** Ordered feed IDs defining display sequence. */
  data: string[]
  /** Feed metadata keyed by feed ID. */
  feeds: Record<string, FeedMeta>
  /** Locally inferred interest model identifier. */
  inferredLocalModel: string | null
  /** Interest picker state identifier. */
  interestPicker: string | null
  /** Timestamp when these recommendations were generated. */
  recommendedAt: number
  /** Identifier for the surface requesting this feed. */
  surfaceId: string
}

export type DiscoveryItem = {
  /** Unique identifier for this content item in the corpus. */
  corpusItemId: string
  /** Identifier for this item's scheduled appearance. */
  scheduledCorpusItemId: string
  /** Target URL for the content. */
  url: string
  /** Display title for the content. */
  title: string
  /** Short summary of the content. */
  excerpt: string
  /** Topic category for this item. */
  topic: string
  /** Name of the content publisher. */
  publisher: string
  /** Whether this item is time-sensitive (e.g. breaking news). */
  isTimeSensitive: boolean
  /** URL for the item's hero image. */
  imageUrl: string
  /** URL for the publisher's icon, if available. */
  iconUrl: string | null
  /** Numeric identifier for the tile this item occupies. */
  tileId: number
  /** Position this item was ranked by the recommendation engine. */
  receivedRank: number
  /** Feature signals used for ranking. */
  features: unknown
  /** Priority level override, if set. */
  priority?: string
}

export type DiscoverItemAction = {
  /** Display label for this action. */
  name: string
  /** Icon identifier for this action, if available. */
  icon?: string
  /** Callback invoked when the user triggers this action. */
  action: () => void
}
