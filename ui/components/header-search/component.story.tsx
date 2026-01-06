import { Search as Component } from "."

import type { Meta, StoryObj } from "@storybook/react-vite"

// Storybook Meta
const meta: Meta<typeof Component> = {
  title: "Header / Search",
  component: Component,
}
export default meta

// Stories
export const Search: StoryObj<typeof Component> = {
  render: () => {
    return <Component />
  },
  args: {},
}
