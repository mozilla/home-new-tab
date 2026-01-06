import "@testing-library/jest-dom/vitest"

import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { Brand as Component } from "."

describe("renders HeaderBrand", () => {
  it("with defaults", () => {
    const rendered = render(<Component />)
    const renderedComponent = rendered.getByTestId("brand")
    expect(renderedComponent).toBeInTheDocument()
    expect(rendered.container).toMatchSnapshot()
  })
})
