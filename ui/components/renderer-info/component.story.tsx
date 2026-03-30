import { RendererInfo as Component } from "."

import type { AppProps } from "@common/types"
import type { Meta, StoryObj } from "@storybook/react-vite"

const mockManifest = {
  version: "1.0.0",
  buildTime: new Date().toISOString(),
  file: "/renderer.js",
  hash: "abc123def456",
  dataSchemaVersion: "2",
}

// Storybook Meta
const meta: Meta<AppProps> = {
  title: "RendererInfo / Overview",
  component: Component,
}
export default meta

// Stories
export const Overview: StoryObj<AppProps> = {
  render: (args) => <Component {...args} />,
  args: {
    manifest: mockManifest,
    renderUpdate: false,
    isCached: false,
    isStaleData: false,
    timeToStaleData: new Date().toISOString(),
    initialState: { example: true },
  },
  argTypes: {
    isCached: { control: "boolean" },
    renderUpdate: { control: "boolean" },
    isStaleData: { control: "boolean" },
    manifest: { table: { disable: true } },
    initialState: { table: { disable: true } },
  },
}
