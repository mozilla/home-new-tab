import { Weather as Component } from "."
import { weatherState } from "@data/state/weather" // Just a placeholder

import type { Meta, StoryObj } from "@storybook/react-vite"

const weatherIds = Object.keys(weatherState)

// Storybook Meta
const meta: Meta<typeof Component> = {
  title: "Weather / Widget",
  component: Component,
}
export default meta

// Stories
export const Widget: StoryObj<typeof Component> = {
  render: (args) => {
    return <Component weatherId={args.weatherId} />
  },
  args: {
    weatherId: weatherIds[0],
  },
  argTypes: {
    weatherId: { control: { type: "select" }, options: weatherIds },
  },
}
