import style from "../discover-card/style.module.css"

import mockDiscoverFeed from "@data/mocks/merino-curated.json" // This will come from a live endpoint
// import mockSponsored from "@data/mocks/sponsored.json"

import { GridType } from "@common/types"
import { useDiscover } from "@data/state/discover"
// import { useSponsored } from "@data/state/sponsored"
import { DiscoverFeed as Component } from "."

import type { Meta, StoryObj } from "@storybook/react-vite"

// Storybook Meta
const meta: Meta<typeof Component> = {
  title: "Discover / Feed",
  component: Component,
  decorators: [
    (Story) => {
      // 💧 hydrate Zustand before rendering
      useDiscover.getState().getItems(mockDiscoverFeed)
      // useSponsored.getState().getItems(mockSponsored)
      return <Story />
    },
  ],
}
export default meta

type ComponentPropsAndCustomArgs = {
  showColor: boolean
} & React.ComponentProps<typeof Component>

// Stories
export const Feed: StoryObj<ComponentPropsAndCustomArgs> = {
  render: (args) => {
    return (
      <div className={`${args.showColor ? style.showColor : ""}`}>
        <Component gridType={args.gridType} />
      </div>
    )
  },
  args: {
    gridType: GridType.LEGACY,
    showColor: false,
  },
  argTypes: {
    gridType: {
      options: Object.values(GridType),
      mapping: Object.values(GridType),
      control: {
        type: "select",
        labels: Object.keys(GridType),
      },
    },
  },
}
