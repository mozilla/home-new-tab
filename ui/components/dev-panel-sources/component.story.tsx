import { DevPanelSources as Component } from "."

import type { DataSourceStatuses, DataSourceTimestamps } from "@common/types"
import type { Meta, StoryObj } from "@storybook/react-vite"

const mockSourceStatuses: DataSourceStatuses = {
  weather: "ready",
  discovery: "stale",
  sponsored: "pending",
}

const mockCachedAt: DataSourceTimestamps = {
  weather: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  discovery: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
}

const mockInitialState = {
  weather: { temperature: 72, unit: "F", conditions: "Sunny" },
  discovery: { articles: [], count: 0 },
  sponsored: null,
}

type ComponentPropsAndCustomArgs = {
  withData: boolean
} & React.ComponentProps<typeof Component>

// Storybook Meta
const meta: Meta<ComponentPropsAndCustomArgs> = {
  title: "Dev Panel / Sources",
  component: Component,
}
export default meta

// Stories
export const Sources: StoryObj<ComponentPropsAndCustomArgs> = {
  render: (args) => {
    const withData = args.withData ? { initialState: mockInitialState } : {}
    return <Component {...args} {...withData} />
  },
  args: {
    sourceStatuses: mockSourceStatuses,
    sourceCachedAt: mockCachedAt,
    withData: false,
  },
  argTypes: {
    sourceStatuses: { table: { disable: true } },
    sourceCachedAt: { table: { disable: true } },
    initialState: { table: { disable: true } },
  },
}
