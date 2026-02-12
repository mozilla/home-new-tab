import style from "../discover-card/style.module.css"

import mockDiscoverFeed from "@data/mocks/merino-curated.json"

import { DiscoverMedia as Component } from "."
import { inCardRig, type CardRigSlot } from "../_base/decorators"
import { useDiscover } from "@data/state/discover"

import type { Meta, StoryObj } from "@storybook/react-vite"

// Extract all item IDs from mock feed for story controls
const feedItemIds = Object.values(mockDiscoverFeed.feeds).flatMap((feed) =>
  feed.recommendations.map((item) => item.corpusItemId),
)

type ComponentPropsAndCustomArgs = {
  itemId: string
  slot: CardRigSlot
  smartCrop: boolean
} & React.ComponentProps<typeof Component>

// Storybook Meta
const meta: Meta<ComponentPropsAndCustomArgs> = {
  title: "Discover / Media",
  component: Component,
  decorators: [
    (Story) => {
      useDiscover.getState().getItems(mockDiscoverFeed)
      return <Story />
    },
  ],
}
export default meta

// Stories
export const Media: StoryObj<ComponentPropsAndCustomArgs> = {
  decorators: [inCardRig],
  render: (args) => {
    const { imageUrl } = useDiscover((state) => state.itemsById[args.itemId])
    const className = `${style[args.slot]} ${style.base}`

    return (
      <article className={className}>
        <div className={style.inner}>
          <Component
            imageUrl={imageUrl}
            showPriority={false}
            priority="null"
            smartCrop={args.smartCrop}
          />
          <div className={style.meta}></div>
        </div>
      </article>
    )
  },
  args: {
    itemId: feedItemIds[0],
    smartCrop: false,
  },
  argTypes: {
    showPriority: { table: { disable: true } },
    priority: { table: { disable: true } },
    imageUrl: { table: { disable: true } },
    aspectRatio: { table: { disable: true } },
    itemId: { control: { type: "select" }, options: feedItemIds },
    slot: {
      control: { type: "radio" },
      options: ["hero", "medium", "smallTop", "smallBottom"],
    },
  },
}
