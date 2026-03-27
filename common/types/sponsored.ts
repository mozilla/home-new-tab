/** Raw shape from the upstream sponsored API. Used only at the data boundary. */
export type RawSponsoredItem = {
  block_key: string
  caps: {
    cap_key: string
    day: number
    flight?: {
      count: number
      period: number
    }
  }
  domain: string
  excerpt: string
  fetchTimestamp?: number
  flight_id?: string
  format: string
  ranking: {
    item_score: number
    personalization_models: Record<string, number | undefined>
    priority: number
  }
  raw_image_src?: string
  image_url: string
  shim?: {
    click: string
    impression: string
    report: string
  }
  sponsor: string
  title: string
  url: string
}

/** Raw sponsored data keyed by section ID. */
export type RawSponsoredData = Record<string, RawSponsoredItem[]>

/** Normalized sponsored data keyed by section ID. */
export type SponsoredData = Record<string, SponsoredItem[]>

/** Section ID to item ID mapping. */
export type SponsoredSections = Record<string, string[]>

export type SponsoredItem = {
  /** Unique key used for frequency capping and deduplication. */
  blockKey: string
  /** Frequency cap configuration for this placement. */
  caps: {
    /** Key identifying the cap rule. */
    capKey: string
    /** Maximum impressions per day. */
    day: number
    /** Flight-level cap, if applicable. */
    flight?: {
      /** Maximum impressions for this flight. */
      count: number
      /** Flight period in seconds. */
      period: number
    }
  }
  /** Publisher domain for display. */
  domain: string
  /** Short description of the sponsored content. */
  excerpt: string
  /** Timestamp when this item was fetched from the ad server. */
  fetchTimestamp?: number
  /** Identifier for the ad flight this item belongs to. */
  flightId?: string
  /** Ad format identifier (e.g. "spoc"). */
  format: string
  /** Ranking signals used for placement ordering. */
  ranking: {
    /** Overall relevance score for this item. */
    itemScore: number
    /** Per-category affinity scores from the personalization model. */
    personalizationModels: Record<string, number | undefined>
    /** Priority weight for this item. */
    priority: number
  }
  /** Original unprocessed image source URL. */
  rawImageSrc?: string
  /** Display-ready image URL. */
  imageUrl: string
  /** Tracking pixel URLs for impression, click, and report events. */
  shim?: {
    /** URL fired on click. */
    click: string
    /** URL fired on impression. */
    impression: string
    /** URL fired when the user reports this content. */
    report: string
  }
  /** Name of the sponsor for attribution. */
  sponsor: string
  /** Display title for the sponsored content. */
  title: string
  /** Target URL for the sponsored content. */
  url: string
}
