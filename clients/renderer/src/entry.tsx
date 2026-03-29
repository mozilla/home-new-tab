import style from "./style.module.css"

import { createBufferedLogger } from "@common/utilities/logger"
import { createRoot } from "react-dom/client"
import { DATA_TTL_MS, DATA_STALE_MS } from "../../coordinator/src/constants"
import { useCountdownSeconds, formatDuration } from "./timers.hook"
import { useCoordinatorInterface } from "@data/state/coordinator-interface"

import type { AppProps, RendererInitArgs, RendererModule } from "@common/types"

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
let initialized = false

/**
 * Prepare the renderer for use.
 *
 * Stores the host-provided init args (gating payload, bridges) into the
 * coordinator-interface store, then fetches FTL content for the active locale
 * so it is ready before the first mount.
 *
 * Idempotent: if called more than once, subsequent calls are ignored with a
 * log message. The host should call `init()` once before `mount()`.
 */
async function init(args: RendererInitArgs): Promise<void> {
  if (initialized) {
    logger.log("init() called more than once, ignoring")
    return
  }
  initialized = true
  useCoordinatorInterface.getState().initialize(args)

  const { locale } = args.gatingPayload.locale
  const ftlContent = await args.getMessages(locale)
  useCoordinatorInterface.getState().setFtlContent(ftlContent)

  logger.log("initialized", { locale })
}

function App(props: AppProps) {
  const {
    manifest,
    renderUpdate,
    nextHash,
    isCached,
    isStaleData,
    initialState,
  } = props
  const { dataSchemaVersion, buildTime, hash } = manifest

  // Clarify renderer source
  const rendererSource = isCached ? "Remote " : "Bundled "
  const rendererType = isCached ? "remote renderer" : "fallback renderer"

  const dataStatus = isStaleData ? "will update" : "cached"
  const renderStatus = renderUpdate ? "will update" : "cached"

  const { timeToStaleData } = props
  const ttlSeconds = useCountdownSeconds(timeToStaleData, DATA_TTL_MS)
  const ttsSeconds = useCountdownSeconds(timeToStaleData, DATA_STALE_MS)

  return (
    <main className={style.base}>
      <header className={style.title}>
        <h1>Intentionally boring renderer</h1>
        <h2>
          rendered from: <span>{rendererType}</span>
        </h2>
      </header>
      <div className={style.content}>
        <div
          className={`${style.renderer} ${renderUpdate ? style.willUpdate : ""}`}>
          <div className={style.inner}>
            <header>Renderer — {renderStatus}</header>
            <ul>
              <li>
                <strong>Renderer Source:</strong> {rendererSource}
              </li>
              <li>
                <strong>Hash:</strong> {hash}
              </li>
              {nextHash ? (
                <li>
                  <strong>Next Hash: </strong> {nextHash}
                </li>
              ) : null}
              <li>
                <strong>Data Schema Version:</strong> {dataSchemaVersion}
              </li>
              <li>
                <strong>Build Time:</strong>{" "}
                {new Date(buildTime).toLocaleString()}
              </li>
              <li>
                <strong>Time to TTL:</strong> {formatDuration(ttlSeconds)}
              </li>
              <li>
                <strong>Time to Stale:</strong> {formatDuration(ttsSeconds)}
              </li>
            </ul>
          </div>
        </div>
        <div
          className={`${style.state}  ${isStaleData ? style.willUpdate : ""}`}>
          <div className={style.inner}>
            <header>Data — {dataStatus}</header>
            <pre>
              <code typeof="json">{JSON.stringify(initialState, null, 2)}</code>
            </pre>
          </div>
        </div>
      </div>
    </main>
  )
}

/**
 * Render the app into a container element.
 *
 * Creates the React root on first call and re-renders on subsequent calls.
 * Safe to call with a new `data` object to update props without unmounting.
 */
function mount(container: HTMLElement, data: AppProps) {
  if (!initialized) {
    logger.log("mount() called before init() — bridges will not be available")
  }

  logger.log("mounting Renderer", data)
  if (!root) root = createRoot(container)
  initialState = data
  root.render(<App {...data} />)
}

/** Unmount the React root and clear the container's DOM content. */
function unmount(container: HTMLElement) {
  root?.unmount()
  root = null
  container.innerHTML = ""
}

/** Re-render only if mounted; safe no-op otherwise */
function update(data: AppProps): void {
  if (!root) return
  const updatedState = { ...initialState, ...data }
  root.render(<App {...updatedState} />)
}

// replaced at build time by the vite plugin
const version = "__BUILD_HASH__"

/**
 * Register the renderer API on `globalThis`.
 *
 * This bundle is loaded via classic <script> (IIFE) in environments
 * where dynamic ESM import is blocked (e.g. legacy CORS constraints).
 *
 * Contract:
 * - After evaluation, `globalThis.AppRenderer` must exist.
 * - Loading a newer renderer intentionally overwrites the previous one.
 */
const rendererApi: RendererModule = { init, mount, unmount, update, version }
declare global { var AppRenderer: RendererModule | undefined } //prettier-ignore

// Always override — newer bundle wins
globalThis.AppRenderer = rendererApi
