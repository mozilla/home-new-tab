import "@testing-library/jest-dom/vitest"
import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { TimerMenu as Component } from "."

describe("renders TimerMenuView", () => {
  it("with defaults", () => {
    const rendered = render(<Component />)

    expect(rendered.getByTestId("timer-menu")).toBeInTheDocument()
    expect(rendered.container).toMatchSnapshot()
  })
})
