import { DOMLocalization } from "@fluent/dom"
import { FluentBundle, FluentResource } from "@fluent/bundle"

/**
 * GetMessages
 * ---
 * Supplies raw FTL source for a given locale (e.g. "en-US").
 *
 * - Storybook/tests: return an in-memory virtual bundle string
 * - App: fetch `/locales/${locale}/${surface}.ftl` (later)
 */
export type GetMessages = (locale: string) => Promise<string>

/**
 * InitFluentDomArgs
 * ---
 * Minimal inputs needed to wire Fluent DOM to a set of DOM roots.
 */
export type InitFluentDomArgs = {
  /** Primary locale for this run (e.g. "en-US"). */
  locale: string

  /** Optional fallback chain (e.g. ["en-US"]). */
  fallbackLocales?: string[]

  /** Root nodes Fluent should translate + observe. */
  roots: Element[]

  /** Message source for a locale. */
  getMessages: GetMessages
}

/**
 * FluentDomRuntime
 * ---
 * Small runtime handle for:
 * - re-translating roots
 * - switching locales (recreates DOMLocalization cleanly)
 * - clearing cached bundles
 */
export type FluentDomRuntime = {
  /** The current DOMLocalization instance. */
  readonly l10n: DOMLocalization

  /** Current ordered locales (primary + fallbacks, deduped). */
  readonly locales: readonly string[]

  /** Re-translate all connected roots. */
  translate: () => Promise<void>

  /**
   * Switch primary locale and/or fallbacks.
   * This recreates DOMLocalization (typed + stable).
   */
  setLocales: (next: {
    locale: string
    fallbackLocales?: string[]
  }) => Promise<void>

  /** Clear cached FluentBundle instances so the next translate reloads messages. */
  clearCache: () => void
}

/**
 * uniqLocales
 * ---
 * Produces a stable, deduped locale chain:
 * [primary, ...fallbacks] with duplicates removed.
 */
function uniqLocales(primary: string, fallbacks: string[]) {
  const out: string[] = []
  const seen = new Set<string>()
  for (const loc of [primary, ...fallbacks]) {
    if (!seen.has(loc)) {
      seen.add(loc)
      out.push(loc)
    }
  }
  return out
}

/**
 * initFluentDom
 * ---
 * Typed Fluent DOM initializer:
 * - builds Fluent bundles from `getMessages(locale)`
 * - connects roots
 * - runs an initial translate for first-paint gating
 *
 * Locale switching is supported via `setLocales()`, implemented by recreating
 * DOMLocalization (no internal field mutation).
 */
export async function initFluentDom(
  args: InitFluentDomArgs,
): Promise<FluentDomRuntime> {
  const { roots, getMessages } = args

  // Cache bundles per locale so repeated translations are cheap.
  const bundleCache = new Map<string, FluentBundle>()

  const getOrCreateBundle = async (loc: string) => {
    const cached = bundleCache.get(loc)
    if (cached) return cached

    const source = await getMessages(loc)
    const bundle = new FluentBundle(loc, { useIsolating: true })
    bundle.addResource(new FluentResource(source))
    bundleCache.set(loc, bundle)
    return bundle
  }

  let locales = uniqLocales(args.locale, args.fallbackLocales ?? [])

  /**
   * createLocalization
   * ---
   * Creates a DOMLocalization for the current locales list and connects roots.
   */
  const createLocalization = () => {
    async function* generateBundles() {
      for (const loc of locales) {
        yield await getOrCreateBundle(loc)
      }
    }

    const l10n = new DOMLocalization(locales, () => generateBundles())

    for (const root of roots) {
      l10n.connectRoot(root)
    }

    return l10n
  }

  let l10n = createLocalization()

  const translate = async () => {
    await l10n.translateRoots()
  }

  const clearCache = () => {
    bundleCache.clear()
  }

  const setLocales: FluentDomRuntime["setLocales"] = async (next) => {
    // Disconnect existing roots cleanly.
    for (const root of roots) {
      l10n.disconnectRoot(root)
    }

    locales = uniqLocales(next.locale, next.fallbackLocales ?? [])
    l10n = createLocalization()

    // Re-translate after switching so the UI updates immediately.
    await translate()
  }

  // Initial pass
  await translate()

  return {
    get l10n() {
      return l10n
    },
    get locales() {
      return locales
    },
    translate,
    setLocales,
    clearCache,
  }
}
