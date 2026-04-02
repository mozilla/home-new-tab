/**
 * Minimal interface proxying the Remote Settings collection client.
 *
 * Models the shape of the browser-native `RemoteSettings()` API so the
 * coordinator can be developed and tested against a local simulation.
 * Data sources call through this interface without knowing what backs it.
 */
export interface RemoteSettingsClient<T> {
  get(): Promise<T[]>
}

/**
 * Factory function that returns a client for the given RS collection.
 * Configured once at coordinator startup via `configureRemoteSettings`.
 */
export type RemoteSettingsFactory = <T>(
  collection: string,
) => RemoteSettingsClient<T>
