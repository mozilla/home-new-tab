import "@testing-library/jest-dom/vitest"
import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { TimerRings as Component } from "."

describe("renders TimerRings", () => {
  it("with defaults", () => {
    const rendered = render(<Component />)
    const renderedComponent = rendered.getByTestId("timer-rings")
    expect(renderedComponent).toBeInTheDocument()
    expect(rendered.container).toMatchSnapshot()
  })
})
