import { Brand as Component } from "."

import type { Meta, StoryObj } from "@storybook/react-vite"

// Storybook Meta
const meta: Meta<typeof Component> = {
  title: "Header / Brand",
  component: Component,
}
export default meta

// Stories
export const Brand: StoryObj<typeof Component> = {
  render: () => {
    return <Component />
  },
  args: {},
}
