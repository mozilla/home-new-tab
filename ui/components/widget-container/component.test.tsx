import "@testing-library/jest-dom/vitest"
import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { WidgetContainer as Component } from "."

describe("renders WidgetContainer", () => {
  it("with defaults", () => {
    const rendered = render(<Component />)
    const renderedComponent = rendered.getByTestId("widget-container")
    expect(renderedComponent).toBeInTheDocument()
    expect(rendered.container).toMatchSnapshot()
  })
})
