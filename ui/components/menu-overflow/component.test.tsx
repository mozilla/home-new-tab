import "@testing-library/jest-dom/vitest"
import { fireEvent, render, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { MenuOverflow as Component } from "."

describe("MenuOverflow", () => {
  it("renders closed with defaults", () => {
    const rendered = render(
      <Component testid="menu-overflow-1">{() => <div />}</Component>,
    )

    expect(rendered.getByTestId("menu-overflow-1")).toBeInTheDocument()
    expect(rendered.container).toMatchSnapshot()
  })

  it("opens the panel on trigger click", () => {
    const rendered = render(
      <Component testid="menu-overflow-2">{() => <div>Item</div>}</Component>,
    )

    const menuRoot = rendered.getByTestId("menu-overflow-2")
    const trigger = within(menuRoot).getByRole("button")

    fireEvent.click(trigger)

    expect(rendered.getByRole("menu")).toBeInTheDocument()
    expect(rendered.getByText("Item")).toBeInTheDocument()
  })
})
