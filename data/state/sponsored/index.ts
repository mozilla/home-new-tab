import { arrayToObject } from "@common/utilities/arrays"
import { create } from "zustand"
import { devtools } from "zustand/middleware"

import type {
  SponsoredItem,
  RawSponsoredData,
  RawSponsoredItem,
  SponsoredSections,
} from "@common/types"

export type SponsoredState = {
  sections: SponsoredSections
  itemsById: Record<string, SponsoredItem>
  getItems: (sponsorData: RawSponsoredData) => void
  setItems: (items: Record<string, SponsoredItem>) => void
}

/**
 * useSponsored
 * ---
 * The state for sponsored
 * NOTE! — Add more context for future you (and future others)
 */
export const useSponsored = create<SponsoredState>()(
  devtools(
    (set) => ({
      /** State Values */
      itemsById: [],
      sections: {},
      getItems: async (sponsorData) => {
        const { itemsById, sections } = normalizeSponsoredData(sponsorData)
        set({ itemsById, sections })
      },
      setItems: (itemsById) => {
        set((state) => ({
          itemsById: {
            ...state.itemsById,
            ...itemsById,
          },
        }))
      },

      reset: () => {
        set({ sections: {}, itemsById: {} })
      },
    }),
    { name: "Sponsored" },
  ),
)

function toSponsoredItem(raw: RawSponsoredItem): SponsoredItem {
  return {
    blockKey: raw.block_key,
    caps: {
      capKey: raw.caps.cap_key,
      day: raw.caps.day,
      flight: raw.caps.flight,
    },
    domain: raw.domain,
    excerpt: raw.excerpt,
    fetchTimestamp: raw.fetchTimestamp,
    flightId: raw.flight_id,
    format: raw.format,
    ranking: {
      itemScore: raw.ranking.item_score,
      personalizationModels: raw.ranking.personalization_models,
      priority: raw.ranking.priority,
    },
    rawImageSrc: raw.raw_image_src,
    imageUrl: raw.image_url,
    shim: raw.shim,
    sponsor: raw.sponsor,
    title: raw.title,
    url: raw.url,
  }
}

export function normalizeSponsoredData(sponsorData: RawSponsoredData) {
  return Object.entries(sponsorData).reduce(
    (previousValue, currentValue) => {
      const sectionId = currentValue[0]
      const sectionItems = currentValue[1].map(toSponsoredItem)
      const sectionItemIds = sectionItems.map((item) => item.blockKey)

      return {
        sections: {
          ...previousValue.sections,
          [sectionId]: sectionItemIds,
        },
        itemsById: {
          ...previousValue.itemsById,
          ...arrayToObject<SponsoredItem>(sectionItems, "blockKey"),
        },
      }
    },
    { sections: {}, itemsById: {} },
  )
}
