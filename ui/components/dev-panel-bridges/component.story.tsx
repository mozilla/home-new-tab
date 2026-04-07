import { DevPanelBridges as Component } from "."

import type { Meta, StoryObj } from "@storybook/react-vite"

// Storybook Meta
const meta: Meta<typeof Component> = {
  title: "Dev Panel / Bridges",
  component: Component,
}
export default meta

// Stories
export const Bridges: StoryObj<typeof Component> = {
  render: () => <Component />,
}
