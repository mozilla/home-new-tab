import { TimerMenu as Component } from "."
import { inCenter } from "../_base/decorators"

import type { Meta, StoryObj } from "@storybook/react-vite"

// Storybook Meta
const meta: Meta<typeof Component> = {
  title: "Timer / Menu",
  component: Component,
}
export default meta

// Stories
export const Menu: StoryObj<typeof Component> = {
  decorators: [inCenter],
  render: () => {
    return (
      <div
        style={{
          padding: "3rem",
          display: "flex",
          alignContent: "center",
          justifyContent: "center",
          marginTop: "20vh",
        }}>
        <Component />
      </div>
    )
  },
  args: {},
}
