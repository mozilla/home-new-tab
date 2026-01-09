// import style from "./style.module.css"

import { GridType, type DiscoverItemAction } from "@common/types"
import { DiscoverCard } from "../discover-card"
import { Grid } from "../structure-grid"
import { useDiscover } from "@data/state/discover"

// useSponsored.getState().getItems(mockSponsoredFeed.data)

/**
 * DiscoverFeed
 * ---
 * Feed of content served from a cached call to curated/suggested content
 */
export function DiscoverFeed({ gridType }: { gridType?: GridType }) {
  const orderedFeeds = useDiscover((state) => state.orderedFeeds)
  if (!orderedFeeds) return null

  return (
    <div data-testid="discover-feed">
      {orderedFeeds.map((feedKey) => (
        <TopicSection key={feedKey} feedKey={feedKey} gridType={gridType} />
      ))}
    </div>
  )
}

export function TopicSection({
  feedKey,
  gridType,
}: {
  feedKey: string
  gridType?: GridType
}) {
  const feed = useDiscover((state) => state.feeds[feedKey])
  const itemIds = feed.recIds
  // const sponsorIds = useSponsored((state) => state.itemIds)

  const gridToUse = gridType ?? GridType.FLUID
  return (
    <section>
      <h2>{feed.title}</h2>
      <Grid gridType={gridToUse} layout={feed.layout.name}>
        {/* <DiscoverSponsored itemId={sponsorIds[position]} /> */}
        {itemIds.map((id) => (
          <Card itemId={id} key={id} />
        ))}
        {/* <DiscoverSponsored itemId={sponsorIds[position + 1]} /> */}
      </Grid>
    </section>
  )
}

const Card = ({
  itemId,
  actionsOverride,
}: {
  itemId: string
  actionsOverride?: DiscoverItemAction[]
}) => {
  const actions: DiscoverItemAction[] = [
    {
      name: "Bookmark",
      action: () => {
        console.log("I like you")
      },
    },
    {
      name: "Open in a New Window",
      action: () => {
        console.log("I like you")
      },
    },
    {
      name: "Open in a New Private Window",
      action: () => {
        console.log("I like you")
      },
    },
    {
      name: "Dismiss",
      action: () => {
        console.log("I like you")
      },
    },
    {
      name: "Report",
      action: () => {
        console.log("I like you")
      },
    },
  ]

  const actionsToUse = actionsOverride ? actionsOverride : actions
  return <DiscoverCard itemId={itemId} actions={actionsToUse} />
}
