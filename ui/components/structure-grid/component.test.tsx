import "@testing-library/jest-dom/vitest"
import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { GridType } from "@common/types"
import { Grid as Component } from "."

describe("renders Grid", () => {
  it("with defaults", () => {
    const rendered = render(
      <Component gridType={GridType.FLUID}>
        <div></div>
      </Component>,
    )
    const renderedComponent = rendered.getByTestId("grid")
    expect(renderedComponent).toBeInTheDocument()
  })
})
