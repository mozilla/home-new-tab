/**
 * Fetches JSON from a URL with explicit cache semantics.
 * Throws on non-OK responses.
 */
export async function fetchJson<T>(url: string, cache: RequestCache): Promise<T> {
  const res = await fetch(url, { cache })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return res.json() as Promise<T>
}
