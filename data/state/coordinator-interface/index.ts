// Plain zustand store, not createSyncedStore.
// This is write-once runtime context injected by the host via init(),
// not synced domain state. No persistence, no cross-tab sync, no LWW merge.

import { create } from "zustand"
import { devtools } from "zustand/middleware"

import type { RendererInitArgs } from "@common/types"

import type { CoordinatorInterfaceState } from "./types"

export const useCoordinatorInterface = create<CoordinatorInterfaceState>()(
  devtools(
    (set, get) => ({
      initialized: false,
      gatingPayload: null,
      bridges: null,

      initialize: (args: RendererInitArgs) => {
        if (get().initialized) {
          console.warn("[coordinator-interface] init() called more than once, ignoring.")
          return
        }

        const { gatingPayload, ...bridges } = args

        set({
          initialized: true,
          gatingPayload,
          bridges,
        })
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

export const useReportError = () =>
  useCoordinatorInterface((s) => s.bridges?.reportError ?? null)

export const useReportMetric = () =>
  useCoordinatorInterface((s) => s.bridges?.reportMetric ?? null)

export type { CoordinatorInterfaceState } from "./types"
