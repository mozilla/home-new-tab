// Layouts available in the grid
export const GridType = {
  EVEN: "even",
  CORE: "core",
  WIDE: "wide",
  HERO: "hero",
  MIXED: "mixed",
  FLUID: "fluid",
  LEGACY: "legacy",
} as const
export type GridType = (typeof GridType)[keyof typeof GridType]

export const TileSize = { SMALL: "small", MEDIUM: "medium", LARGE: "large" }
export type TileSize = (typeof TileSize)[keyof typeof TileSize]

export const PriorityType = { LOW: "low", MEDIUM: "medium", HIGH: "high" } as const //prettier-ignore
export type PriorityType = (typeof PriorityType)[keyof typeof PriorityType]

export const TemperatureView = {
  Simple: "simple",
  Detailed: "detailed",
  Extreme: "extreme",
}
export type TemperatureView = (typeof TemperatureView)[keyof typeof TemperatureView] //prettier-ignore

export const TemperatureUnit = {
  Celsius: "Celsius",
  Fahrenheit: "Fahrenheit",
  Kelvin: "Kelvin",
}
export type TemperatureUnit = (typeof TemperatureUnit)[keyof typeof TemperatureUnit] //prettier-ignore

export type AppRenderManifest = {
  version: string
  buildTime: string
  file: string
  hash: string
  dataSchemaVersion: string
  cssFile?: string
  assetsBase?: string
  isCached?: boolean
}

export type AppProps = {
  manifest: AppRenderManifest
  willUpdate: boolean
  isCached: boolean
  isStaleData: boolean
  timeToStaleData?: string
  initialState?: unknown
}
export type RendererModule = {
  mount: (container: HTMLElement, props: AppProps) => void
  update?: (state: unknown) => void
  unmount?: (container: HTMLElement) => void
}

export type BaselineRenderer = {
  manifest: AppRenderManifest
  jsUrl: string
}

export type RendererMeta = {
  active?: { hash?: string; version?: string; savedAt: number }
  latest?: { hash?: string; version?: string; savedAt: number }
}

export type PriorityMap = Record<string, string>

export type CoordinatedData = unknown
export type CoordinatedPayload = {
  schemaVersion: string
  updatedAt: string
  data?: CoordinatedData
}

export type Layout = {
  name: string
  responsiveLayouts: ResponsiveLayout[]
}

export type ResponsiveLayout = {
  columnCount: number
  tiles: Tile[]
}

export type Tile = {
  hasAd: boolean
  hasExcerpt: boolean
  position: number
  size: string
}

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
  surfaceId: string // could be an enum
}
// Discover item from activity feed
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

export type SponsoredData = Record<string, SponsoredItem[]>
export type SponsoredSections = Record<string, string[]>
export type SponsoredItem = {
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

export type Temperature = {
  c: number
  f: number
}

export type Conditions = {
  url: string
  summary: string
  iconId: number
  temperature: Temperature
}

export type Forecast = {
  url: string
  summary: string
  high: Temperature
  low: Temperature
}

export type WeatherData = {
  title: string
  url: string
  provider: string
  isSponsored: boolean
  score: number
  cityName: string
  regionCode: string
  currentConditions: Conditions
  forecast: Forecast
  requestId: string
  source: string
}
