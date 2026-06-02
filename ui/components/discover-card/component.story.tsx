import style from "./style.module.css"

import mockDiscoverFeed from "@data/mocks/merino-curated.json"

import React from "react"
import { DiscoverCard as Component } from "."
import { inCardRig, type CardRigSlot } from "../_base/decorators"
import { useDiscover } from "@data/state/discover"

import type { Meta, StoryObj } from "@storybook/react-vite"

// Extract all item IDs from mock feed for story controls
const feedItemIds = Object.values(mockDiscoverFeed.feeds).flatMap((feed) =>
  feed.recommendations.map((item) => item.corpusItemId),
)

type ComponentPropsAndCustomArgs = {
  slot: CardRigSlot
} & React.ComponentProps<typeof Component>

const meta: Meta<ComponentPropsAndCustomArgs> = {
  title: "Discover / Card",
  component: Component,
  decorators: [
    (Story) => {
      useDiscover.getState().getItems(mockDiscoverFeed)
      return <Story />
    },
  ],
}
export default meta

export const Card: StoryObj<ComponentPropsAndCustomArgs> = {
  decorators: [inCardRig],
  render: (args) => {
    return (
      <Component
        itemId={args.itemId}
        showPriority={args.showPriority}
        className={style[args.slot]}
        {...(args.slot === "hero" ? { role: "hero" } : null)}
      />
    )
  },
  args: {
    itemId: feedItemIds[0],
    slot: "hero",
  },
  argTypes: {
    itemId: { control: { type: "select" }, options: feedItemIds },
    showPriority: { table: { disable: true } },
    role: { table: { disable: true } },
    className: { table: { disable: true } },
    slot: {
      control: { type: "radio" },
      options: ["hero", "medium", "smallTop", "smallBottom"],
    },
  },
}
