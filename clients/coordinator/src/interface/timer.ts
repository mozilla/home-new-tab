/**
 * onTimerComplete
 * ---
 * Transport stub for the OS timer notification API. Called by the renderer
 * when a focus or break session ends.
 *
 * In production, browser core forwards this to the platform notification
 * system. The dev stub is a no-op so the renderer call site is exercised
 * without requiring a real notification transport.
 */
export function onTimerComplete(): void {
  // Dev stub — no-op. Production: browser core routes to OS notifications.
}
