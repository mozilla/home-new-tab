import mockDiscoverFeed from "@data/mocks/merino-curated.json" // This will come from a live endpoint
import mockSponsoredFeed from "@data/mocks/sponsored.json"

import { GridType } from "@common/types"
import { Grid as Component } from "."
import { DiscoverCard } from "../discover-card"
import { Sponsored } from "../discover-sponsored"
import { useDiscover } from "@data/state/discover"
import { useSponsored } from "@data/state/sponsored"

import type { DiscoverItemAction } from "@common/types"
import type { Meta, StoryObj } from "@storybook/react-vite"

// Storybook Meta
const meta: Meta<typeof Component> = {
  title: "Structure / Grid",
  component: Component,
  decorators: [
    (Story) => {
      // 💧 hydrate Zustand before rendering
      useDiscover.getState().getItems(mockDiscoverFeed)
      useSponsored.getState().getItems(mockSponsoredFeed)
      return <Story />
    },
  ],
}
export default meta

type ComponentPropsAndCustomArgs = {
  showMultiple: boolean
  itemCount: number
  showAds: boolean
  adSections: string[]
} & React.ComponentProps<typeof Component>

// Need this for storybook options
const orderedFeeds = Object.entries(mockDiscoverFeed.feeds)
  .sort(([, a], [, b]) => a.receivedFeedRank - b.receivedFeedRank)
  .map(([key]) => key)

// Stories
export const Grid: StoryObj<ComponentPropsAndCustomArgs> = {
  render: (args) => {
    const orderedFeeds = useDiscover((state) => state.orderedFeeds)

    const mainTopicKey = orderedFeeds.slice().shift() // Teenage Mutate Ninja ... Array
    const adSections = args.adSections
    return (
      <section className="section-container">
        <TopicSection
          feedKey={mainTopicKey!}
          itemCount={args.itemCount}
          showAds={adSections.includes(mainTopicKey!)}
        />
        {args.showMultiple
          ? orderedFeeds
              .slice(1, -1)
              .map((feedKey) => (
                <TopicSection
                  showAds={adSections.includes(feedKey)}
                  feedKey={feedKey}
                  itemCount={args.itemCount}
                />
              ))
          : null}
      </section>
    )
  },
  args: {
    showMultiple: false,
    itemCount: 8,
    showAds: true,
    adSections: [orderedFeeds[0]],
  },
  argTypes: {
    children: {
      table: { disable: true },
    },
    showMultiple: {
      name: "show multiple grids",
    },
    itemCount: {
      name: "maximum item count",
      control: { type: "range", min: 0, max: 8, step: 1 },
    },
    adSections: {
      name: "Which sections should have ads",
      control: "inline-check",
      options: orderedFeeds,
    },
  },
}

function TopicSection({
  feedKey,
  itemCount,
  showAds,
}: {
  itemCount: number
  feedKey: string
  showAds?: boolean
}) {
  const feed = useDiscover((state) => state.feeds[feedKey])
  const itemIds = feed.recIds
  const updateItemById = useDiscover((state) => state.updateItemById)

  const sponsoredItemIds = useSponsored((state) => state.itemsById)
  const sponsorIds = Object.keys(sponsoredItemIds)

  return (
    <section data-section-priority={feed.layout.name}>
      <header>
        <h2>{feed.title}</h2>
        {feed.subtitle ? <h3>{feed.subtitle}</h3> : null}
      </header>
      <Component gridType={GridType.FLUID}>
        {showAds ? <Sponsored itemId={sponsorIds[1]} /> : null}
        {itemIds.slice(0, itemCount).map((id) => {
          const actions: DiscoverItemAction[] = [
            {
              name: "High Priority",
              action: () => {
                updateItemById({ corpusItemId: id, priority: "high" })
              },
            },
            {
              name: "Medium Priority",
              action: () => {
                updateItemById({ corpusItemId: id, priority: "medium" })
              },
            },
            {
              name: "Low Priority",
              action: () => {
                updateItemById({ corpusItemId: id, priority: "low" })
              },
            },
          ]
          return (
            <DiscoverCard itemId={id} actions={actions} showPriority={true} />
          )
        })}
      </Component>
    </section>
  )
}
