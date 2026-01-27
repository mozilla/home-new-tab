import { GridType } from "@common/types"
import { Grid } from "../structure-grid"

import type { Decorator } from "@storybook/react-vite"
/**
 * inGrid
 * ---
 * Places the story in a grid with passed in grid columns
 */
export const inGrid: Decorator = (Story) => {
  return (
    <section className="section-container">
      <Grid gridType={GridType.FLUID}>
        <Story />
      </Grid>
    </section>
  )
}

/**
 * inContainer
 * ---
 * Places the story in a grid with passed in grid columns
 */
export const inContainer: Decorator = (Story, { args }) => {
  return (
    <div style={{ width: `${args.containerSize}%` }}>
      <Story />
    </div>
  )
}

/**
 * inCenter
 * ---
 * Places the story in the center of the page
 */
export const inCenter: Decorator = (Story) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        minHeight: "100vh",
      }}>
      <div style={{ display: "block" }}>
        <Story />
      </div>
    </div>
  )
}
