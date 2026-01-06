import { arrayToObject } from "@common/utilities/arrays"
import { create } from "zustand"
import { devtools } from "zustand/middleware"

import type {
  SponsoredItem,
  SponsoredData,
  SponsoredSections,
} from "@common/types"

export type SponsoredState = {
  sections: SponsoredSections
  itemsById: Record<string, SponsoredItem>
  getItems: (sponsorData: SponsoredData) => void
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

export function normalizeSponsoredData(sponsorData: SponsoredData) {
  return Object.entries(sponsorData).reduce(
    (previousValue, currentValue) => {
      const sectionId = currentValue[0]
      const sectionItems = currentValue[1]
      const sectionItemIds = sectionItems.map((item) => item.block_key)

      return {
        sections: {
          ...previousValue.sections,
          [sectionId]: sectionItemIds,
        },
        itemsById: {
          ...previousValue.itemsById,
          ...arrayToObject<SponsoredItem>(sectionItems, "block_key"),
        },
      }
    },
    { sections: {}, itemsById: {} },
  )
}
