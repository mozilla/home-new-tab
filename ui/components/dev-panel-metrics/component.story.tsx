import { DevPanelMetrics as Component } from "."

import type { Meta, StoryObj } from "@storybook/react-vite"

const mockManifest = {
  version: "1.0.0",
  buildTime: new Date().toISOString(),
  file: "/renderer.js",
  hash: "abc123def456",
  dataSchemaVersion: "2",
}

// Storybook Meta
const meta: Meta<typeof Component> = {
  title: "Dev Panel / Metrics",
  component: Component,
}
export default meta

// Stories
export const Metrics: StoryObj<typeof Component> = {
  render: (args) => {
    const withHash = args.isCached ? {} : { nextHash: "def456abc123" }
    return <Component {...args} {...withHash} />
  },
  args: {
    manifest: mockManifest,
    renderUpdate: false,
    isCached: true,
  },
  argTypes: {
    isCached: { control: "boolean" },
    renderUpdate: { control: "boolean" },
    manifest: { table: { disable: true } },
    nextHash: { table: { disable: true } },
  },
}
