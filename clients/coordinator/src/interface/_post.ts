/**
 * postEvent
 * ---
 * Fire-and-forget POST to the dev API events endpoint. Used by interface
 * stubs to prove the full chain (renderer → coordinator → API) during
 * development. Failures are swallowed — this is a dev observability tool,
 * not a critical path.
 */
export function postEvent(action: string, data: unknown): void {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data }),
  })
}
