import type { GatingPayload } from "./gating"
import type { CoordinatorInterface, CoordinatedData } from "./coordinator"

/** Lifecycle status of a single coordinated data source. */
export type DataSourceStatus = "pending" | "ready" | "failed"

/** Status of each coordinated data source, keyed to CoordinatedData fields. */
export type DataSourceStatuses = Partial<Record<keyof CoordinatedData, DataSourceStatus>>

export type AppRenderManifest = {
  /** Semantic version of this renderer build. */
  version: string
  /** ISO timestamp of when this build was produced. */
  buildTime: string
  /** Path to the JavaScript entry artifact. */
  file: string
  /** Content hash of the entry artifact, used for identity and caching. */
  hash: string
  /** Data schema version this renderer expects from the coordinator. */
  dataSchemaVersion: string
  /** Path to the CSS presentation artifact, if present. */
  cssFile?: string
  /** Key-set hash of the baseline FTL. Feeds into snapshot identity and keys translations. */
  l10nHash?: string
  /** Path to the baseline FTL artifact, relative to the renderer's served directory. */
  baselineFtlFile?: string
  /** Base path for resolving additional assets (images, fonts, etc.). */
  assetsBase?: string
  /** Whether this manifest was loaded from cache. */
  isCached?: boolean
}

export type AppProps = {
  /** Manifest describing the current renderer build. */
  manifest: AppRenderManifest
  /** Whether this render is an update (true) or initial mount (false). */
  renderUpdate: boolean
  /** Whether the data payload was served from cache. */
  isCached: boolean
  /** Whether the data payload is stale and a refresh is in flight. */
  isStaleData: boolean
  /** Hash of the next renderer version, if an update is available. */
  nextHash?: string
  /** Human-readable label for when cached data becomes stale. */
  timeToStaleData?: string
  /** Serialized state for hydration on initial mount. */
  initialState?: unknown
  /** Explicit lifecycle status for each coordinated data source. */
  sourceStatuses?: DataSourceStatuses
}

export type RendererInitArgs = {
  /** Gating context for locale and feature flag decisions. */
  gatingPayload: GatingPayload
} & CoordinatorInterface

export type RendererModule = {
  /** One-time setup before the first mount. Receives gating context and coordinator interface. */
  init?: (args: RendererInitArgs) => void | Promise<void>
  /** Mounts the renderer into the given container with initial props. */
  mount: (container: HTMLElement, props: AppProps) => void
  /** Provides updated props for deferred or refreshed data. */
  update?: (data: AppProps) => void
  /** Tears down the renderer and cleans up resources. */
  unmount?: (container: HTMLElement) => void
  /** Renderer version string, used for diagnostics. */
  version?: string
}

export type BaselineRenderer = {
  /** Manifest for the baseline (fallback) renderer. */
  manifest: AppRenderManifest
  /** URL to the baseline renderer's JavaScript entry. */
  jsUrl: string
}

export type RendererMeta = {
  /** Metadata about the currently active renderer, if any. */
  active?: { hash?: string; version?: string; savedAt: number }
  /** Metadata about the latest known renderer, if any. */
  latest?: { hash?: string; version?: string; savedAt: number }
}
