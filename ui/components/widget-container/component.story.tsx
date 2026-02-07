import { WidgetContainer as Component } from "."

import type { Meta, StoryObj } from "@storybook/react-vite"

// Storybook Meta
const meta: Meta<typeof Component> = {
  title: "Widget / Container",
  component: Component,
}
export default meta

// Stories
export const Container: StoryObj<typeof Component> = {
  render: () => {
    return <Component />
  },
  args: {},
}
