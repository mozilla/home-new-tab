/**
 * compareVersions
 * ---
 * A quick utility used for sorting semantic versions
 * "0.0.1" vs "0.1.2" and the like
 */
export function compareVersions(a?: string, b?: string): number {
  const parsedA = (a ?? "0").split(".").map((n) => parseInt(n || "0", 10))
  const parsedB = (b ?? "0").split(".").map((n) => parseInt(n || "0", 10))

  for (let i = 0; i < Math.max(parsedA.length, parsedB.length); i++) {
    const da = parsedA[i] ?? 0
    const db = parsedB[i] ?? 0
    if (da > db) return 1
    if (da < db) return -1
  }
  return 0
}

/**
 * getLatestVersion
 * ---
 * Get the latest semantic version from an array of versions
 * ( We heard you like versions dawg! )
 *
 * example
 * ["0.0.1", "0.1.2"] will return "0.1.2"
 */
export function getLatestVersion(versions: string[] = []) {
  try {
    if (!versions.length) return false
    const sorted = versions.sort(compareVersions).reverse()
    return sorted[0]
  } catch {
    return false
  }
}

export const BASIS = {
  major: "MAJOR",
  minor: "MINOR",
  patch: "PATCH",
} as const

export type Basis = (typeof BASIS)[keyof typeof BASIS]

// Simple semantic version representation
type SemVer = {
  major: number
  minor: number
  patch: number
}

function parseVersion(value: string): SemVer | null {
  const match = value.trim().match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) return null

  const [, majorStr, minorStr, patchStr] = match
  const major = Number(majorStr)
  const minor = Number(minorStr)
  const patch = Number(patchStr)

  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    return null
  }

  return { major, minor, patch }
}

/**
 * inRange
 * ---
 * Takes an acceptable range "anchor" version, a current version, and
 * the basis of comparison.
 *
 * Basis:
 * - MAJOR: same major, minor/patch can differ
 * - MINOR: same major and minor, patch can differ
 * - PATCH: exact match
 */
export function inRange(
  acceptableRange: string,
  version?: string,
  basis: Basis = BASIS.major,
): boolean {
  if (!version) return false

  const base = parseVersion(acceptableRange)
  const target = parseVersion(version)

  // If either is invalid, we just return false
  if (!base || !target) return false

  // What do we actually care about
  switch (basis) {
    case BASIS.major:
      return target.major === base.major

    case BASIS.minor:
      return target.major === base.major && target.minor === base.minor

    case BASIS.patch:
      return (
        target.major === base.major &&
        target.minor === base.minor &&
        target.patch === base.patch
      )

    // Wat? If you reached this ... you are living on the edge
    default:
      return false
  }
}
