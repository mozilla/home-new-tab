import "@testing-library/jest-dom/vitest"

import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { ToDo as Component } from "."

describe("renders Todo", () => {
  it("with defaults", () => {
    const rendered = render(<Component />)
    const renderedComponent = rendered.getByTestId("todo")
    expect(renderedComponent).toBeInTheDocument()
    expect(rendered.container).toMatchSnapshot()
  })
})
