import type { CoordinatedData } from "@common/types"

/**
 * A Merino (HTTP) data source descriptor.
 * Declared in the renderer's data-schema.json for non-blocking sources.
 */
export type MerinoDescriptor = {
  key: keyof CoordinatedData
  transport: "merino"
  blocking: false
  endpoint: string
  method: string
  cacheName: string
  ttlMs: number
  maxAgeMs: number
}

/**
 * A Remote Settings data source descriptor.
 * Declared in the renderer's data-schema.json for blocking RS sources.
 */
export type RSDescriptor = {
  key: keyof CoordinatedData
  transport: "rs"
  blocking: true
  collection: string
}

/**
 * A browser-core data source descriptor.
 * May produce multiple CoordinatedData keys from a single getData() dispatch.
 */
export type CoreDescriptor = {
  keys: Array<keyof CoordinatedData>
  transport: "core"
  blocking: true
}

export type SourceDescriptor = MerinoDescriptor | RSDescriptor | CoreDescriptor

/**
 * The result of a successful Merino cache read.
 */
export type CachedSourceResult = {
  data: Partial<CoordinatedData>
  fresh: boolean
  updatedAt: string
}
