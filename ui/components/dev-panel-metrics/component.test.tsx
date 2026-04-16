import "@testing-library/jest-dom/vitest"
import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { DevPanelMetrics as Component } from "."

const mockProps = {
  manifest: {
    version: "1.0.0",
    buildTime: "2026-01-01T00:00:00.000Z",
    file: "/renderer.js",
    hash: "abc123def456",
    schemaFile: "data-schema.b2e0739a7dd78a0e.json",
  },
  renderUpdate: false,
  isCached: false,
}

describe("renders DevPanelMetrics", () => {
  it("with defaults", () => {
    const rendered = render(<Component {...mockProps} />)
    const renderedComponent = rendered.getByTestId("dev-panel-metrics")
    expect(renderedComponent).toBeInTheDocument()
  })
})
