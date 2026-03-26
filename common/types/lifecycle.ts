export type AppRenderManifest = {
  version: string
  buildTime: string
  file: string
  hash: string
  dataSchemaVersion: string
  cssFile?: string
  assetsBase?: string
  isCached?: boolean
}

export type AppProps = {
  manifest: AppRenderManifest
  renderUpdate: boolean
  isCached: boolean
  isStaleData: boolean
  nextHash?: string
  timeToStaleData?: string
  initialState?: unknown
}

export type RendererModule = {
  mount: (container: HTMLElement, props: AppProps) => void
  update?: (data: AppProps) => void
  unmount?: (container: HTMLElement) => void
  version?: string
}

export type BaselineRenderer = {
  manifest: AppRenderManifest
  jsUrl: string
}

export type RendererMeta = {
  active?: { hash?: string; version?: string; savedAt: number }
  latest?: { hash?: string; version?: string; savedAt: number }
}
