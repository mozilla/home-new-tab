import { WeatherIcon as Component, weatherIcons } from "."

import type { Meta, StoryObj } from "@storybook/react-vite"

const weatherIds = Object.keys(weatherIcons)

// Storybook Meta
const meta: Meta<typeof Component> = {
  title: "Weather / Icons",
  component: Component,
}
export default meta

// Stories
export const Icons: StoryObj<typeof Component> = {
  render: () => {
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
        }}>
        {weatherIds.map((id) => (
          <Component key={id} iconId={id} />
        ))}
      </div>
    )
  },
  argTypes: {
    iconId: {
      table: { disable: true },
    },
  },
}
