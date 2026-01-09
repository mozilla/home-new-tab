import mockDiscoverFeed from "@data/mocks/merino-curated.json" // This will come from a live endpoint

import { DiscoverCard as Component } from "."
import { inGrid } from "../_base/decorators"
import { useDiscover } from "@data/state/discover"

import type { Meta, StoryObj } from "@storybook/react-vite"

// Need this for storybook options
const feedItemIds = Object.values(mockDiscoverFeed.feeds)
  .map((feed) => feed.recommendations.map((item) => item.corpusItemId))
  .flat(1)

// Storybook Meta
const meta: Meta<typeof Component> = {
  title: "Discover / Card",
  component: Component,
  decorators: [
    (Story) => {
      // 💧 hydrate Zustand before rendering
      useDiscover.getState().getItems(mockDiscoverFeed)
      return <Story />
    },
  ],
}
export default meta

type ComponentPropsAndCustomArgs = {} & React.ComponentProps<typeof Component>

// Stories
export const Card: StoryObj<ComponentPropsAndCustomArgs> = {
  render: (args) => {
    return (
      <>
        <Component itemId={args.itemId} />
      </>
    )
  },
  decorators: [inGrid],
  args: {
    itemId: feedItemIds[0],
  },
  argTypes: {
    itemId: { control: { type: "select" }, options: feedItemIds },
  },
}
