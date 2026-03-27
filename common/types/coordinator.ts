import type { DiscoverFeed } from "./discovery"
import type { Message } from "./messaging"
import type { SponsoredData } from "./sponsored"
import type { WeatherData } from "./weather"

export type CoordinatedData = {
  topSites?: unknown
  discovery?: DiscoverFeed
  sponsored?: SponsoredData
  weather?: WeatherData
  wallpapers?: unknown
  messages?: Message[]
  widgets?: unknown
}

export type CoordinatedPayload = {
  schemaVersion: string
  updatedAt: string
  data?: CoordinatedData
}
