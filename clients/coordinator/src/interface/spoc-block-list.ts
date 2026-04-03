import { createBufferedLogger } from "@common/utilities/logger"
import { readJson, writeJson } from "./_storage"

const logger = createBufferedLogger({
  prefix: "Bridge:Spoc-block-list",
  shouldBuffer: false,
  colors: { log: "#ff6c11" },
})

const STORAGE_KEY = "coordinator:spoc-blocks"

type SpocBlocks = {
  urls: string[]
  flights: string[]
  tiles: string[]
}

const DEFAULT_BLOCKS: SpocBlocks = { urls: [], flights: [], tiles: [] }

/**
 * getSpocBlocks
 * ---
 * Returns persisted spoc block lists for inclusion in the MARS request body.
 * Called by the spocs data source on every fetch.
 */
export function getSpocBlocks(): SpocBlocks {
  return readJson<SpocBlocks>(STORAGE_KEY, DEFAULT_BLOCKS)
}

/**
 * onSpocUrlBlocked
 * ---
 * Records a URL-level spoc block in coordinator storage. The block list is
 * sent as a request param in the next MARS fetch.
 */
export function onSpocUrlBlocked(url: string): void {
  const blocks = getSpocBlocks()
  if (blocks.urls.includes(url)) return
  writeJson(STORAGE_KEY, { ...blocks, urls: [...blocks.urls, url] })
  logger.info("spocUrlBlocked", { url })
}

/**
 * onSpocFlightBlocked
 * ---
 * Records a flight-level spoc block in coordinator storage.
 */
export function onSpocFlightBlocked(flightId: string): void {
  const blocks = getSpocBlocks()
  if (blocks.flights.includes(flightId)) return
  writeJson(STORAGE_KEY, { ...blocks, flights: [...blocks.flights, flightId] })
  logger.info("spocFlightBlocked", { flightId })
}

/**
 * onSpocTileBlocked
 * ---
 * Records a tile-level spoc block in coordinator storage.
 */
export function onSpocTileBlocked(tileId: string): void {
  const blocks = getSpocBlocks()
  if (blocks.tiles.includes(tileId)) return
  writeJson(STORAGE_KEY, { ...blocks, tiles: [...blocks.tiles, tileId] })
  logger.info("spocTileBlocked", { tileId })
}
