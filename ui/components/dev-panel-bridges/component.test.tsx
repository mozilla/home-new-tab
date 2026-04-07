import "@testing-library/jest-dom/vitest"
import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { DevPanelBridges as Component } from "."

describe("renders DevPanelBridges", () => {
  it("with defaults", () => {
    const rendered = render(<Component />)
    const renderedComponent = rendered.getByTestId("dev-panel-bridges")
    expect(renderedComponent).toBeInTheDocument()
  })
})
