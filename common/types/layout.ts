export const GridType = { FLUID: "fluid" } as const
export type GridType = (typeof GridType)[keyof typeof GridType]

export const TileSize = { SMALL: "small", MEDIUM: "medium", LARGE: "large" }
export type TileSize = (typeof TileSize)[keyof typeof TileSize]

export const PriorityType = { LOW: "low", MEDIUM: "medium", HIGH: "high" } as const //prettier-ignore
export type PriorityType = (typeof PriorityType)[keyof typeof PriorityType]

export type PriorityMap = Record<string, string>

export type Layout = {
  name: string
  responsiveLayouts: ResponsiveLayout[]
}

export type ResponsiveLayout = {
  columnCount: number
  tiles: Tile[]
}

export type Tile = {
  hasAd: boolean
  hasExcerpt: boolean
  position: number
  size: string
}
