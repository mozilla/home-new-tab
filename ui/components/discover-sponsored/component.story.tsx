import mockSponsoredContent from "@data/mocks/sponsored.json"

import { Sponsored as Component } from "."
import { inCardRig, type CardRigSlot } from "../_base/decorators"
import { useSponsored, normalizeSponsoredData } from "@data/state/sponsored"

import type { Meta, StoryObj } from "@storybook/react-vite"

// Normalize mock data and extract item IDs for story controls
const { itemsById } = normalizeSponsoredData(mockSponsoredContent)
const itemIds = Object.keys(itemsById)

type ComponentPropsAndCustomArgs = {
  slot: CardRigSlot
} & React.ComponentProps<typeof Component>

// Storybook Meta
const meta: Meta<ComponentPropsAndCustomArgs> = {
  title: "Discover / Sponsored",
  component: Component,
  decorators: [
    (Story) => {
      // Hydrate Zustand state with mock sponsored data
      useSponsored.getState().getItems(mockSponsoredContent)
      return <Story />
    },
  ],
}
export default meta

// Stories
export const Sponsored: StoryObj<ComponentPropsAndCustomArgs> = {
  decorators: [inCardRig],
  render: (args) => {
    return <Component itemId={args.itemId} />
  },
  args: {
    itemId: itemIds[0],
    slot: "medium",
  },
  argTypes: {
    itemId: { control: { type: "select" }, options: itemIds },
    // Sponsored content only supports medium slot in card rig
    slot: {
      control: { type: "radio" },
      options: ["medium"],
    },
  },
}
