import { describe, it, expect } from "vitest"
import { compareVersions, getLatestVersion, inRange, BASIS } from "."

describe("CompareVersions", () => {
  it("should sort patches correctly", () => {
    const order = ["0.0.1", "0.0.0"].sort(compareVersions)
    expect(order).toStrictEqual(["0.0.0", "0.0.1"])
  })

  it("should sort minor versions correctly", () => {
    const order = ["0.1.1", "0.0.2"].sort(compareVersions)
    expect(order).toStrictEqual(["0.0.2", "0.1.1"])
  })

  it("should sort major versions correctly", () => {
    const order = ["1.1.1", "2.3.2"].sort(compareVersions)
    expect(order).toStrictEqual(["1.1.1", "2.3.2"])
  })
})

describe("GetLatestVersion", () => {
  it("should return the latest version", () => {
    const latest = getLatestVersion(["1.1.1", "2.3.2"])
    expect(latest).toBe("2.3.2")
  })

  it("should return false if malformed", () => {
    // @ts-expect-error: Intentional type mismatch for testing
    const latest = getLatestVersion("1")
    expect(latest).toBeFalsy()
  })
})

describe("inRange", () => {
  describe("BASIS.major", () => {
    it("returns true for same major, different minor/patch", () => {
      expect(inRange("1.0.0", "1.5.3", BASIS.major)).toBe(true)
      expect(inRange("1.2.3", "1.0.0", BASIS.major)).toBe(true)
    })

    it("returns false for different major", () => {
      expect(inRange("1.0.0", "2.0.0", BASIS.major)).toBe(false)
      expect(inRange("2.0.0", "1.9.9", BASIS.major)).toBe(false)
    })
  })

  describe("BASIS.minor", () => {
    it("returns true for same major+minor, different patch", () => {
      expect(inRange("1.2.0", "1.2.9", BASIS.minor)).toBe(true)
      expect(inRange("1.2.3", "1.2.3", BASIS.minor)).toBe(true)
    })

    it("returns false for different minor", () => {
      expect(inRange("1.2.0", "1.3.0", BASIS.minor)).toBe(false)
      expect(inRange("1.2.0", "1.1.9", BASIS.minor)).toBe(false)
    })

    it("returns false for different major", () => {
      expect(inRange("1.2.0", "2.2.0", BASIS.minor)).toBe(false)
    })
  })

  describe("BASIS.patch", () => {
    it("returns true for exact match", () => {
      expect(inRange("1.2.3", "1.2.3", BASIS.patch)).toBe(true)
    })

    it("returns false for different patch", () => {
      expect(inRange("1.2.3", "1.2.4", BASIS.patch)).toBe(false)
    })

    it("returns false for different minor or major", () => {
      expect(inRange("1.2.3", "1.3.3", BASIS.patch)).toBe(false)
      expect(inRange("1.2.3", "2.2.3", BASIS.patch)).toBe(false)
    })
  })

  describe("default bASIS", () => {
    it("defaults to major bASIS", () => {
      expect(inRange("1.0.0", "1.9.9")).toBe(true)
      expect(inRange("1.0.0", "2.0.0")).toBe(false)
    })
  })

  describe("invalid input", () => {
    it("returns false if acceptableRange is invalid", () => {
      expect(inRange("foo", "1.0.0", BASIS.major)).toBe(false)
    })

    it("returns false if version is invalid", () => {
      expect(inRange("1.0.0", "bar", BASIS.major)).toBe(false)
    })

    it("returns false for partial versions", () => {
      expect(inRange("1.0", "1.0.0", BASIS.major)).toBe(false)
      expect(inRange("1.0.0", "1.0", BASIS.major)).toBe(false)
    })
  })
})
