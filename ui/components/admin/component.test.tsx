import "@testing-library/jest-dom/vitest"

import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { Admin as Component } from "."

describe("renders Admin", () => {
  it("with defaults", () => {
    const rendered = render(<Component />)
    const renderedComponent = rendered.getByTestId("admin")
    expect(renderedComponent).toBeInTheDocument()
    expect(rendered.container).toMatchSnapshot()
  })
})
