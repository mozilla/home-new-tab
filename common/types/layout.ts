export const GridType = { FLUID: "fluid" } as const
export type GridType = (typeof GridType)[keyof typeof GridType]

export const TileSize = { SMALL: "small", MEDIUM: "medium", LARGE: "large" }
export type TileSize = (typeof TileSize)[keyof typeof TileSize]

export const PriorityType = { LOW: "low", MEDIUM: "medium", HIGH: "high" } as const //prettier-ignore
export type PriorityType = (typeof PriorityType)[keyof typeof PriorityType]

export type PriorityMap = Record<string, string>

export type Layout = {
  /** Identifier for this layout configuration. */
  name: string
  /** Breakpoint-specific layout definitions, ordered by viewport width. */
  responsiveLayouts: ResponsiveLayout[]
}

export type ResponsiveLayout = {
  /** Number of columns in this breakpoint's grid. */
  columnCount: number
  /** Tile definitions for this breakpoint. */
  tiles: Tile[]
}

export type Tile = {
  /** Whether this tile position carries a sponsored placement. */
  hasAd: boolean
  /** Whether this tile displays an excerpt below the title. */
  hasExcerpt: boolean
  /** Zero-based position in the grid. */
  position: number
  /** Display size for this tile (small, medium, large). */
  size: string
}
