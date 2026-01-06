import { ToDo as Component } from "."
import { inGrid } from "../_base/decorators"

import type { Meta, StoryObj } from "@storybook/react-vite"

// Storybook Meta
const meta: Meta<typeof Component> = {
  title: "Todo / Complete",
  component: Component,
}
export default meta

type ComponentPropsAndCustomArgs = {
  gridCols: number
} & React.ComponentProps<typeof Component>

// Stories
export const Complete: StoryObj<ComponentPropsAndCustomArgs> = {
  render: () => {
    return <Component />
  },
  decorators: [inGrid],
  args: {
    gridCols: 3,
  },
  argTypes: {
    gridCols: {
      control: { type: "range", min: 2, max: 4, step: 1 },
    },
  },
}
