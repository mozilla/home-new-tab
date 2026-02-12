import mockDiscoverFeed from "@data/mocks/merino-curated.json"
import "@testing-library/jest-dom/vitest"
import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { DiscoverMedia as Component } from "."

describe("renders DiscoverMedia", () => {
  it("with defaults", () => {
    const itemImages = Object.values(mockDiscoverFeed.feeds)
      .map((feed) => feed.recommendations.map((item) => item.imageUrl))
      .flat(1)
    const imageUrl = itemImages[0]

    const rendered = render(
      <Component
        aspectRatio="wide"
        imageUrl={imageUrl}
        showPriority={false}
        priority=""
        smartCrop={false}
      />,
    )
    const renderedComponent = rendered.getByTestId("discover-media")
    expect(renderedComponent).toBeInTheDocument()
  })
})
