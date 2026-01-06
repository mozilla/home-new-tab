import style from "./style.module.css"

import { createBufferedLogger } from "@common/utilities/logger"
import { createRoot } from "react-dom/client"
import { DATA_TTL_MS, DATA_STALE_MS } from "../../coordinator/src/constants"
import { useCountdownSeconds, formatDuration } from "./timers.hook"

import type { AppProps } from "@common/types"

/**
 * Just some helper functions that will go away once the discovery phase is over
 * but add some flavor to the logging.
 */
const logger = createBufferedLogger({
  prefix: "Renderer",
  groupLabel: "HNT Lifecycle",
  shouldBuffer: false,
  colors: {
    log: "#ba03fd",
  },
})

let root: ReturnType<typeof createRoot> | null = null
let initialState = {}

function App(props: AppProps) {
  const { manifest, willUpdate, isCached, isStaleData, initialState } = props
  const { dataSchemaVersion, buildTime, hash } = manifest
  const cacheStatus = isCached ? "Cached" : "Bundled"
  const dataStatus = isStaleData ? "Stale" : "Cached"

  const { timeToStaleData } = props
  const ttlSeconds = useCountdownSeconds(timeToStaleData, DATA_TTL_MS)
  const ttsSeconds = useCountdownSeconds(timeToStaleData, DATA_STALE_MS)
  return (
    <main className={style.base}>
      <div className={style.content}>
        <h1>
          {cacheStatus} Renderer: {hash}
        </h1>
        <ul>
          <li>Data Schema Version: {dataSchemaVersion}</li>
          <li>Generated at: {new Date(buildTime).toLocaleString()}</li>
          <li>Hash: {hash}</li>
          <li>Renderer Status: {cacheStatus}</li>
          <li>Data Status: {dataStatus}</li>
          <li>Time to live data: {formatDuration(ttlSeconds)}</li>
          <li>Time to stale data: {formatDuration(ttsSeconds)}</li>
        </ul>
        <div
          className={`${style.updateIndicator} ${willUpdate ? style.willUpdate : ""}`}>
          {willUpdate
            ? "Renderer updates next render"
            : "No updates to renderer"}
        </div>
        <div>
          <code>{`${JSON.stringify(initialState)}`}</code>
        </div>
      </div>
    </main>
  )
}

export function mount(container: HTMLElement, data: AppProps) {
  logger.log("mounting Renderer", data)
  if (!root) root = createRoot(container)
  initialState = data
  root.render(<App {...data} />)
}

export function unmount(container: HTMLElement) {
  root?.unmount()
  root = null
  container.innerHTML = ""
}

/** Re-render only if mounted; safe no-op otherwise */
export function update(data: AppProps): void {
  if (!root) return
  const updatedState = { ...initialState, ...data }
  root.render(<App {...updatedState} />)
}

// replaced at build time by the vite plugin
export const version = "__BUILD_HASH__"
