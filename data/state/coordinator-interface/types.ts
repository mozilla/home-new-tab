import type {
  GatingPayload,
  RendererAdapters,
  RendererInitArgs,
} from "@common/types"

/**
 * Shape of the coordinator-interface store.
 *
 * Holds everything the renderer receives from the host via `init()`: the
 * gating payload (locale + flags), the host-provided bridge callbacks, and the
 * fetched FTL content. All fields start null and are populated once during
 * initialization — nothing here changes after `init()` resolves.
 */
export type CoordinatorInterfaceState = {
  /** Whether init() has been called. */
  initialized: boolean

  /** Gating context: locale availability and feature flags. */
  gatingPayload: GatingPayload | null

  /** Host-provided adapters (browserCore, storage, telemetry, getMessages). */
  bridges: RendererAdapters | null

  /** FTL source for the active locale, fetched during init(). Null before init completes. */
  ftlContent: string | null

  /** Populates the store from init() args. Idempotent: warns and no-ops on second call. */
  initialize: (args: RendererInitArgs) => void

  /** Stores the FTL content after getMessages resolves. Called once per init. */
  setFtlContent: (content: string) => void
}
