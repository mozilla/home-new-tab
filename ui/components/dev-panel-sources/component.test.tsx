import "@testing-library/jest-dom/vitest"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, it, expect } from "vitest"

afterEach(cleanup)

import { DevPanelSources as Component } from "."

import type { DataSourceStatuses } from "@common/types"

const mockSourceStatuses: DataSourceStatuses = {
  weather: "ready",
  discovery: "stale",
  sponsored: "pending",
}

describe("renders DevPanelSources", () => {
  it("with defaults", () => {
    const rendered = render(<Component sourceStatuses={mockSourceStatuses} />)
    const renderedComponent = rendered.getByTestId("dev-panel-sources")
    expect(renderedComponent).toBeInTheDocument()
  })

  it("with initial state", () => {
    const rendered = render(
      <Component
        sourceStatuses={mockSourceStatuses}
        initialState={{ weather: { temperature: 72 }, discovery: [] }}
      />,
    )
    const renderedComponent = rendered.getByTestId("dev-panel-sources")
    expect(renderedComponent).toBeInTheDocument()
  })
})
