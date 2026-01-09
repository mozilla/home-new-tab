import mockSponsoredContent from "@data/mocks/sponsored.json" // This will come from a live endpoint

import { Sponsored as Component } from "."
import { inGrid } from "../_base/decorators"
import { useSponsored, normalizeSponsoredData } from "@data/state/sponsored"

import type { Meta, StoryObj } from "@storybook/react-vite"

const { itemsById } = normalizeSponsoredData(mockSponsoredContent)
const itemIds = Object.keys(itemsById)

// Storybook Meta
const meta: Meta<typeof Component> = {
  title: "Discover / Sponsored",
  component: Component,
  decorators: [
    (Story) => {
      // 💧 hydrate Zustand before rendering
      useSponsored.getState().getItems(mockSponsoredContent)
      return <Story />
    },
  ],
}
export default meta

// Stories
export const Sponsored: StoryObj<typeof Component> = {
  render: (args) => {
    return <Component itemId={args.itemId} />
  },
  decorators: [inGrid],
  args: {
    itemId: itemIds[0],
  },
  argTypes: {
    itemId: { control: { type: "select" }, options: itemIds },
  },
}
