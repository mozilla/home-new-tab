import "@testing-library/jest-dom/vitest"
import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { Timer as Component } from "."

describe("renders Timer", () => {
  it("with defaults", () => {
    const rendered = render(<Component />)
    const renderedComponent = rendered.getByTestId("timer")
    expect(renderedComponent).toBeInTheDocument()
  })
})
