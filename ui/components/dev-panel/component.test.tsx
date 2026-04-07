import "@testing-library/jest-dom/vitest"
import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { DevPanel as Component } from "."

const mockProps = {
  manifest: {
    version: "1.0.0",
    buildTime: "2026-01-01T00:00:00.000Z",
    file: "/renderer.js",
    hash: "abc123def456",
    dataSchemaVersion: "2",
  },
  renderUpdate: false,
  isCached: false,
}

describe("renders DevPanel", () => {
  it("with defaults", () => {
    const rendered = render(<Component {...mockProps} />)
    const renderedComponent = rendered.getByTestId("dev-panel")
    expect(renderedComponent).toBeInTheDocument()
  })
})
