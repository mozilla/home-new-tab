import { Admin as Component } from "."

import type { Meta, StoryObj } from "@storybook/react-vite"

// Storybook Meta
const meta: Meta<typeof Component> = {
  title: "Structure / Admin",
  component: Component,
}
export default meta

// Stories
export const Admin: StoryObj<typeof Component> = {
  render: () => {
    return <Component />
  },
  args: {},
}
