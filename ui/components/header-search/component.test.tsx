import "@testing-library/jest-dom/vitest"
import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { Search as Component } from "."

describe("renders HeaderSearch", () => {
  it("with defaults", () => {
    const rendered = render(<Component />)
    const renderedComponent = rendered.getByTestId("header-search")
    expect(renderedComponent).toBeInTheDocument()
    expect(rendered.container).toMatchSnapshot()
  })
})
