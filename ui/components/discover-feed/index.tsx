import style from "./style.module.css"

import { DiscoverCard } from "../discover-card"
import { Sponsored } from "../discover-sponsored"
import { useDiscover } from "@data/state/discover"
import { useSponsored } from "@data/state/sponsored"

/**
 * validHeroLayouts
 * ---
 * Layout names that support hero card positioning.
 * These layouts can accommodate a high-priority item in a prominent hero slot.
 */
const validHeroLayouts = ["7-double-row-2-ad", "4-large-small-medium-1-ad"]

/**
 * DiscoverFeed
 * ---
 * Feed of content served from a cached call to curated/suggested content:
 * - Retrieves ordered feeds from Zustand state
 * - Renders each feed as a separate section via DiscoverSection
 * - Supports toggles for ad display and priority editing mode
 */
export function DiscoverFeed({
  showAds = false,
  showPriority = false,
}: {
  /** Enable display of sponsored content (SPOC) */
  showAds?: boolean
  /** Enable priority editing mode for cards */
  showPriority?: boolean
}) {
  const orderedFeeds = useDiscover((state) => state.orderedFeeds)
  if (!orderedFeeds) return null

  return (
    <div data-testid="discover-feed">
      {orderedFeeds.map((feedKey) => (
        <DiscoverSection
          key={feedKey}
          feedKey={feedKey}
          showAds={showAds}
          showPriority={showPriority}
        />
      ))}
    </div>
  )
}

/**
 * DiscoverSection
 * ---
 * Renders a single feed section with cards in a responsive grid:
 * - Resolves which layout to use based on priorities and item count
 * - Manages hero card positioning (moves high-priority item to front)
 * - Handles sponsored content (SPOC) integration
 * - Sets data attributes for layout system integration
 */
export function DiscoverSection({
  feedKey,
  showAds = false,
  showPriority = false,
}: {
  /** Key identifying the feed in state */
  feedKey: string
  /** Enable display of sponsored content (SPOC) */
  showAds?: boolean
  /** Enable priority editing mode for cards */
  showPriority?: boolean
}) {
  const feed = useDiscover((state) => state.feeds[feedKey])
  const itemsById = useDiscover((state) => state.itemsById)

  if (!feed) return null

  const itemIds = feed.recIds

  const count = itemIds.length
  const slicedIds = itemIds.slice(0, count)

  const sponsoredItemIds = useSponsored((state) => state.itemsById)
  const sponsorIds = Object.keys(sponsoredItemIds)

  // Detect priority flags for layout system
  const highId = slicedIds.find((id) => itemsById[id]?.priority === "high")
  const hasHigh = Boolean(highId)
  const hasLow = slicedIds.some((id) => itemsById[id]?.priority === "low")

  // Check for sponsored content availability
  const hasSpoc = Boolean(showAds) && sponsorIds.length > 0
  const spocId = hasSpoc ? sponsorIds[0] : null

  // Layout resolution: use hero layout if requested or if high-priority item exists
  const requestedLayout = feed.layout.name
  const isHeroLayout = validHeroLayouts.includes(requestedLayout)
  const shouldForceHero = hasHigh

  const enableHero = isHeroLayout || shouldForceHero
  const resolvedLayout = enableHero
    ? resolveHeroLayout(requestedLayout, slicedIds.length)
    : requestedLayout

  // Hero card positioning: use high-priority item if available, otherwise use first item
  const heroId = enableHero ? (highId ?? slicedIds[0] ?? null) : null
  const orderedIds = enableHero ? moveIdToFront(slicedIds, heroId) : slicedIds

  return (
    <section data-layout={resolvedLayout}>
      <header>
        <h2>{feed.title}</h2>
        {feed.subtitle ? <h3>{feed.subtitle}</h3> : null}
      </header>

      <div className={style.base} data-testid="grid">
        <div
          className={style.grid}
          data-has-high={hasHigh}
          data-has-low={hasLow}
          data-has-spoc={hasSpoc}
          data-item-count={slicedIds.length}>
          {orderedIds.map((id) => (
            <DiscoverCard
              key={id}
              itemId={id}
              showPriority={showPriority}
              role={heroId === id ? "hero" : undefined}
            />
          ))}

          {spocId ? <Sponsored itemId={spocId} /> : null}
        </div>
      </div>
    </section>
  )
}

/**
 * resolveHeroLayout
 * ---
 * Determines which hero layout to use based on the requested layout and item count.
 * Falls back to appropriate hero layouts when the requested layout doesn't support heroes.
 */
function resolveHeroLayout(requestedLayout: string, itemCount: number): string {
  if (validHeroLayouts.includes(requestedLayout)) return requestedLayout
  if (itemCount >= 4) return "7-double-row-2-ad"
  return "4-large-small-medium-1-ad"
}

/**
 * moveIdToFront
 * ---
 * Moves a specific ID to the front of the array for hero card positioning.
 * Returns the original array if the ID is already first or not found.
 */
function moveIdToFront(ids: string[], id: string | null): string[] {
  if (!id) return ids
  const index = ids.indexOf(id)
  if (index <= 0) return ids // already first, or not found
  return [id, ...ids.slice(0, index), ...ids.slice(index + 1)]
}
