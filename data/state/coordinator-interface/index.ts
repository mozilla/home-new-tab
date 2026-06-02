// Plain zustand store, not createSyncedStore.
// This is write-once runtime context injected by the host via init(),
// not synced domain state. No persistence, no cross-tab sync, no LWW merge.

import { create } from "zustand"
import { devtools } from "zustand/middleware"

import type { RendererInitArgs } from "@common/types"

import type { CoordinatorInterfaceState } from "./types"

/**
 * The renderer's window into host-provided context.
 *
 * Populated once by `init()` with the gating payload, bridge callbacks, and
 * fetched FTL content. Components read from this store through the selectors
 * below rather than importing `init()` args directly, which keeps the
 * dependency surface narrow and the store testable in isolation.
 */
export const useCoordinatorInterface = create<CoordinatorInterfaceState>()(
  devtools(
    (set, get) => ({
      initialized: false,
      gatingPayload: null,
      bridges: null,
      ftlContent: null,

      initialize: (args: RendererInitArgs) => {
        if (get().initialized) {
          console.warn(
            "[coordinator-interface] init() called more than once, ignoring.",
          )
          return
        }

        const { gatingPayload, ...bridges } = args

        set({
          initialized: true,
          gatingPayload,
          bridges,
        })
      },

      setFtlContent: (content: string) => {
        set({ ftlContent: content })
      },
    }),
    { name: "CoordinatorInterface" },
  ),
)

// --- Selectors ---

export const useGatingPayload = () =>
  useCoordinatorInterface((s) => s.gatingPayload)

export const useLocale = () =>
  useCoordinatorInterface((s) => s.gatingPayload?.locale ?? null)

export const useFlags = () =>
  useCoordinatorInterface((s) => s.gatingPayload?.flags ?? null)

export const useBridges = () => useCoordinatorInterface((s) => s.bridges)

export const useReportError = () =>
  useCoordinatorInterface((s) => s.bridges?.telemetry.reportError ?? null)

export const useReportMetric = () =>
  useCoordinatorInterface((s) => s.bridges?.telemetry.reportMetric ?? null)

export const useFtlContent = () => useCoordinatorInterface((s) => s.ftlContent)

export type { CoordinatorInterfaceState } from "./types"
