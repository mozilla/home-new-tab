import "@testing-library/jest-dom/vitest"

import { weatherState } from "@data/state/weather" // Just a placeholder
import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { Weather as Component } from "."

const weatherId = Object.keys(weatherState)[0]

describe("renders Weather", () => {
  it("with defaults", () => {
    const rendered = render(<Component weatherId={weatherId} />)
    const renderedComponent = rendered.getByTestId("weather")
    expect(renderedComponent).toBeInTheDocument()
  })
})
