import type { RemoteSettingsClient, RemoteSettingsFactory } from "@common/types"

let factory: RemoteSettingsFactory | null = null

/**
 * Sets the Remote Settings factory for this coordinator instance.
 *
 * Must be called once before boot. Pass `createDevRemoteSettings()` to use
 * the local API server simulation.
 */
export function configureRemoteSettings(f: RemoteSettingsFactory): void {
  factory = f
}

/**
 * Returns a Remote Settings client for the given collection.
 *
 * Throws if `configureRemoteSettings` has not been called.
 * Data sources call this and receive a typed client — they never branch on env.
 */
export function getRemoteSettings<T>(collection: string): RemoteSettingsClient<T> {
  if (!factory) {
    throw new Error(
      `RemoteSettings not configured. Call configureRemoteSettings() before boot.`,
    )
  }
  return factory<T>(collection)
}

/**
 * Creates a Remote Settings factory that proxies to the local API server.
 *
 * Each collection maps to `GET /rs/:collection/records`. The route structure
 * mirrors the RS server URL pattern and is separate from the `/api/` routes.
 *
 * No caching at this layer — the coordinator's SWR cycle controls refresh
 * frequency, and the local API server is fast.
 */
export function createDevRemoteSettings(): RemoteSettingsFactory {
  return <T>(collection: string): RemoteSettingsClient<T> => ({
    async get(): Promise<T[]> {
      const res = await fetch(`/rs/${collection}/records`, { cache: "no-store" })
      if (!res.ok) return []
      return res.json() as Promise<T[]>
    },
  })
}
