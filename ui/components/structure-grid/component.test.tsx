import "@testing-library/jest-dom/vitest"

import { GridType } from "@common/types"
import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { Grid as Component } from "."

describe("renders Grid", () => {
  it("with defaults", () => {
    const rendered = render(
      <Component gridType={GridType.EVEN}>
        <div></div>
      </Component>,
    )
    const renderedComponent = rendered.getByTestId("grid")
    expect(renderedComponent).toBeInTheDocument()
  })
})
