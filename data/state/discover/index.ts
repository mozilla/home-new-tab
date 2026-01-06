import { arrayToObject } from "@common/utilities/arrays"
import { create } from "zustand"
import { devtools } from "zustand/middleware"

import type { DiscoverFeed, DiscoveryItem, FeedMeta } from "@common/types"

type Feeds = Record<
  string,
  Omit<FeedMeta, "recommendations"> & {
    recIds: string[]
  }
>

type DiscoverState = {
  orderedFeeds: string[]
  feeds: Feeds
  itemsById: Record<string, DiscoveryItem>
  lastFetched: number
  inFlight: Promise<void> | null
  getFeed: (force?: boolean) => Promise<void>
  getItems: (discoverData: DiscoverFeed) => void
  setItems: (items: Record<string, DiscoveryItem>) => void
  clearItems: () => void
  updateItemById: (
    discoverData: Partial<DiscoveryItem> & { corpusItemId: string },
  ) => void
}

// Let's fetch this very infrequently so as to not upset the ancient gods.
const cacheTime = 10 * 60 * 1000 // 10 Minutes

export const useDiscover = create<DiscoverState>()(
  devtools(
    (set, get) => ({
      orderedFeeds: [],
      feed: {},
      itemsById: {},
      inFlight: null,
      lastFetched: 0,
      getFeed: async (force) => {
        console.count("Now I'm feeeeed ... feeed falling")
        // Make a request to the server. This should only happen once and we should cache the
        // result ... but for the purposes of prototyping ... meh ... baby cache
        const lastFetched = get().lastFetched
        if (!force && Date.now() - lastFetched < cacheTime) return

        // If we are mid request, just breathe deeply and channel your inner peace
        if (get().inFlight) return

        try {
          const task = (async () => {
            const response = await fetch("/api/discover")
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const data: DiscoverFeed = await response.json()
            get().getItems(data)
            set({ lastFetched: Date.now() })
          })().finally(() => set({ inFlight: null }))

          set({ inFlight: task })
        } catch (err) {
          console.log(err)
          // This is just a hard guard for the time being
          set({ lastFetched: Date.now() })
        }
      },
      getItems: async (discoverFeed) => {
        // Let's do some normalization so we can work with the data

        // Get all the entries in to key/value array so we can sort them and use them to map sections
        const orderedFeeds = Object.entries(discoverFeed.feeds)
          .sort(([, a], [, b]) => a.receivedFeedRank - b.receivedFeedRank)
          .map(([key]) => key)

        // We want feeds to contain ids for recs but we are gonna store the actual data in itemsById
        const feeds = orderedFeeds.reduce<Feeds>((accumulator, key) => {
          const { recommendations, ...rest } = discoverFeed.feeds[key]
          const recIds = recommendations.map((rec) => rec.corpusItemId)
          accumulator[key] = { recIds, ...rest }
          return accumulator
        }, {})

        // Let's build items by id so we can access them surgically
        const feedItems = Object.values(discoverFeed.feeds)
          .map((feed) => feed.recommendations)
          .flat(1)
        const itemsById = arrayToObject<DiscoveryItem>(feedItems, "corpusItemId") //prettier-ignore

        set({ itemsById, orderedFeeds, feeds })
      },
      setItems: (itemsById) => {
        set((state) => ({
          itemsById: {
            ...state.itemsById,
            ...itemsById,
          },
        }))
      },
      updateItemById: async (itemChange: {
        corpusItemId: string
        priority: string
      }) => {
        const response = await fetch("/api/priority", {
          method: "PUT",
          body: JSON.stringify(itemChange),
        })

        if (response.ok) {
          set((state) => ({
            lastFetched: 0,
            itemsById: {
              ...state.itemsById,
              [itemChange.corpusItemId]: {
                ...state.itemsById[itemChange.corpusItemId],
                ...itemChange,
              },
            },
          }))
        }
      },
    }),
    { name: "Discover" },
  ),
)
