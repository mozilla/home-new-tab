import { Header as Component } from "."

import type { Meta, StoryObj } from "@storybook/react-vite"

// Storybook Meta
const meta: Meta<typeof Component> = {
  title: "Header / Complete",
  component: Component,
}
export default meta

// Stories
export const Complete: StoryObj<typeof Component> = {
  render: () => {
    return <Component />
  },
  args: {},
}
