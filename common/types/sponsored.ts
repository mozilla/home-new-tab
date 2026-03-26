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
