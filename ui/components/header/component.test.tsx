import "@testing-library/jest-dom/vitest"

import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { Header as Component } from "."

describe("renders Header", () => {
  it("with defaults", () => {
    const rendered = render(<Component />)
    const renderedComponent = rendered.getByTestId("header")
    expect(renderedComponent).toBeInTheDocument()
    expect(rendered.container).toMatchSnapshot()
  })
})
