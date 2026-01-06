import "@testing-library/jest-dom/vitest"
import mockDiscoverFeed from "@data/mocks/merino-curated.json" // This will come from a live endpoint

import { useDiscover } from "@data/state/discover"
import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { DiscoverCard as Component } from "."

describe("renders DiscoverCard", () => {
  it("with defaults", () => {
    const feedItemIds = Object.values(mockDiscoverFeed.feeds)
      .map((feed) => feed.recommendations.map((item) => item.corpusItemId))
      .flat(1)

    useDiscover.getState().getItems(mockDiscoverFeed)
    const rendered = render(<Component itemId={feedItemIds[0]} />)
    const renderedComponent = rendered.getByTestId("discover-card")
    expect(renderedComponent).toBeInTheDocument()
  })
})
