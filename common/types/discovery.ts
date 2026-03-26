import type { Layout } from "./layout"

export type IAB = {
  categories: string[]
  taxonomy: string
}

export type FeedMeta = {
  followedAt: number | null
  iab: IAB | null
  isBlocked: boolean
  isFollowed: boolean
  isInitiallyVisible: boolean
  layout: Layout
  receivedFeedRank: number
  recommendations: DiscoveryItem[]
  subtitle: string | null
  title: string
}

export type DiscoverFeed = {
  data: string[]
  feeds: Record<string, FeedMeta>
  inferredLocalModel: string | null
  interestPicker: string | null
  recommendedAt: number
  surfaceId: string
}

export type DiscoveryItem = {
  corpusItemId: string
  scheduledCorpusItemId: string
  url: string
  title: string
  excerpt: string
  topic: string
  publisher: string
  isTimeSensitive: boolean
  imageUrl: string
  iconUrl: string | null
  tileId: number
  receivedRank: number
  features: unknown
  priority?: string
}

export type DiscoverItemAction = {
  name: string
  icon?: string
  action: () => void
}
