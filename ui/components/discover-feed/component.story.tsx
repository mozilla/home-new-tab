import mockDiscoverFeed from "@data/mocks/merino-curated.json"
import mockSponsored from "@data/mocks/sponsored.json"

import { DiscoverSection, DiscoverFeed as Component } from "."
import { useDiscover } from "@data/state/discover"
import { useSponsored } from "@data/state/sponsored"

import type { Meta, StoryObj } from "@storybook/react-vite"

// -----------------------------
// Build labeled options for Storybook label shown → value stored
// -----------------------------
const feedEntries = Object.entries(mockDiscoverFeed.feeds)
const feedKeys = feedEntries.map(([key]) => key)
const feedLabels: Record<string, string> = Object.fromEntries(
  feedEntries.map(([key, value]) => [key, `${key} — ${value.layout.name}`]),
)

// Storybook Meta
const meta: Meta<typeof Component> = {
  title: "Discover / Feed",
  component: Component,
  decorators: [
    (Story) => {
      // Hydrate Zustand state with mock data before rendering
      useDiscover.getState().getItems(mockDiscoverFeed)
      useSponsored.getState().getItems(mockSponsored)
      return <Story />
    },
  ],
}
export default meta

type ComponentPropsAndCustomArgs = {
  fullFeed: boolean
  showAds: boolean
  showMarkers: boolean
  showPriority: boolean
  feedKey?: string
} & React.ComponentProps<typeof Component>

// Stories
export const Feed: StoryObj<ComponentPropsAndCustomArgs> = {
  render: (args) => {
    // Render single section or full feed based on controls
    const Renderer = args.feedKey ? DiscoverSection : Component

    return (
      <div {...(args.showMarkers && { "data-debug": "active" })}>
        {args.feedKey && !args.fullFeed ? (
          <Renderer
            showAds={args.showAds}
            feedKey={args.feedKey}
            showPriority={args.showPriority}
          />
        ) : (
          <Component showAds={args.showAds} showPriority={args.showPriority} />
        )}
      </div>
    )
  },

  args: {
    fullFeed: false,
    showAds: false,
    showMarkers: false,
    showPriority: false,
  },

  argTypes: {
    feedKey: {
      // dropdown shows "key — layout.name"
      control: { type: "select", labels: feedLabels },
      options: feedKeys,
    },
  },
}
