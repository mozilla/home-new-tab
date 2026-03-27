import type {
  CoordinatorInterface,
  GatingPayload,
  RendererInitArgs,
} from "@common/types"

export type CoordinatorInterfaceState = {
  /** Whether init() has been called. */
  initialized: boolean

  /** Gating context: locale availability and feature flags. */
  gatingPayload: GatingPayload | null

  /** Host-provided bridges and action callbacks. */
  bridges: CoordinatorInterface | null

  /** Populates the store from init() args. Idempotent: warns and no-ops on second call. */
  initialize: (args: RendererInitArgs) => void
}
