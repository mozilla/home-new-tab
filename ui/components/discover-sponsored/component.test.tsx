import mockSponsoredContent from "@data/mocks/sponsored.json" // This will come from a live endpoint
import "@testing-library/jest-dom/vitest"

import { normalizeSponsoredData, useSponsored } from "@data/state/sponsored"
import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { Sponsored as Component } from "."

describe("renders DiscoverAd", () => {
  it("with defaults", () => {
    const { itemsById } = normalizeSponsoredData(mockSponsoredContent)
    const itemIds = Object.keys(itemsById)
    useSponsored.getState().getItems(mockSponsoredContent)

    const rendered = render(<Component itemId={itemIds[0]} />)
    const renderedComponent = rendered.getByTestId("sponsored")
    expect(renderedComponent).toBeInTheDocument()
    expect(rendered.container).toMatchSnapshot()
  })
})
