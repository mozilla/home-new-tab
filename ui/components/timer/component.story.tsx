import { Timers as Component } from "."
import { inGrid } from "../_base/decorators"

import type { Meta, StoryObj } from "@storybook/react-vite"

// Storybook Meta
const meta: Meta<typeof Component> = {
  title: "Timers / Complete",
  component: Component,
}
export default meta

// Stories
export const Complete: StoryObj<typeof Component> = {
  render: () => {
    return <Component />
  },
  decorators: [inGrid],
}
