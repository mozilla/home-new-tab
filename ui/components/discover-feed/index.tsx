// import style from "./style.module.css"

import { DiscoverCard } from "../discover-card"
import { Grid } from "../structure-grid"
import { useDiscover } from "@data/state/discover"

// useSponsored.getState().getItems(mockSponsoredFeed.data)

/**
 * DiscoverFeed
 * ---
 * Feed of content served from a cached call to curated/suggested content
 */
export function DiscoverFeed() {
  const orderedFeeds = useDiscover((state) => state.orderedFeeds)
  if (!orderedFeeds) return null

  return (
    <div data-testid="discover-feed">
      {orderedFeeds.map((feedKey) => (
        <TopicSection key={feedKey} feedKey={feedKey} />
      ))}
    </div>
  )
}

export function TopicSection({ feedKey }: { feedKey: string }) {
  const feed = useDiscover((state) => state.feeds[feedKey])
  const itemIds = feed.recIds
  // const sponsorIds = useSponsored((state) => state.itemIds)

  return (
    <section>
      <h2>{feed.title}</h2>
      <Grid layout={feed.layout.name}>
        {/* <DiscoverSponsored itemId={sponsorIds[position]} /> */}
        {itemIds.map((id) => (
          <DiscoverCard itemId={id} key={id} />
        ))}
        {/* <DiscoverSponsored itemId={sponsorIds[position + 1]} /> */}
      </Grid>
    </section>
  )
}
