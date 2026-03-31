// Gating payload — passed to the renderer via init()
// Two facets: locale (translation context) and flags (resolved feature flag state)

export type LocaleAvailability = "full" | "partial" | "none"

export type LocaleFacet = {
  /** Active locale code (e.g. "fr", "de"). */
  locale: string
  /** Whether translations exist and their coverage level. */
  availability: LocaleAvailability
  /** Ratio of translated keys to total keys. Present when availability is "partial". */
  completeness?: number
  /** Baseline FTL key-set hash. Links translations to the snapshot. */
  l10nHash: string
  /** Ordered locale fallback chain resolved by the coordinator (e.g. ["en-US"]). Empty for en-US. */
  fallbackLocales: string[]
}

export type FlagState = {
  /** Stable identifier from the external flag system. */
  id: string
  /** Human-readable flag name. */
  name: string
  /** Whether this flag is enabled for the current user. */
  enabled: boolean
  /** Variant assigned to this user, if the flag has variants. */
  variant?: string
  /** Experiment metadata, present when the flag is part of an A/B test. */
  experiment?: {
    /** Stable identifier for the experiment. */
    id: string
    /** Key the renderer uses when reporting metrics for this experiment. */
    metricsKey: string
  }
}

export type FlagsFacet = Record<string, FlagState>

export type GatingPayload = {
  locale: LocaleFacet
  flags: FlagsFacet
}
