import { describe, it, expect } from "vitest"

import { polarToCartesian } from "."

describe("polarToCartesian", () => {
  it("returns the center point when radius is 0", () => {
    expect(polarToCartesian(10, 20, 0, 0)).toEqual({ x: 10, y: 20 })
    expect(polarToCartesian(-5, 7, 0, Math.PI / 3)).toEqual({ x: -5, y: 7 })
  })

  it("computes points on the unit circle at key angles", () => {
    const eps = 1e-10

    const p0 = polarToCartesian(0, 0, 1, 0)
    expect(p0.x).toBeCloseTo(1, 10)
    expect(p0.y).toBeCloseTo(0, 10)

    const p90 = polarToCartesian(0, 0, 1, Math.PI / 2)
    expect(p90.x).toBeCloseTo(0, 10)
    expect(p90.y).toBeCloseTo(1, 10)

    const p180 = polarToCartesian(0, 0, 1, Math.PI)
    expect(p180.x).toBeCloseTo(-1, 10)
    expect(p180.y).toBeCloseTo(0, 10)

    const p270 = polarToCartesian(0, 0, 1, (3 * Math.PI) / 2)
    expect(p270.x).toBeCloseTo(0, 10)
    expect(p270.y).toBeCloseTo(-1, 10)

    // sanity: use eps to ensure we didn't accidentally return NaN, etc.
    expect(Number.isFinite(p0.x)).toBe(true)
    expect(Math.abs(p0.y)).toBeLessThan(eps)
  })

  it("applies center offsets correctly", () => {
    const p = polarToCartesian(10, 20, 5, 0)
    expect(p.x).toBeCloseTo(15, 10)
    expect(p.y).toBeCloseTo(20, 10)
  })

  it("scales with radius", () => {
    const p = polarToCartesian(0, 0, 2, Math.PI / 2)
    expect(p.x).toBeCloseTo(0, 10)
    expect(p.y).toBeCloseTo(2, 10)
  })

  it("supports negative radius by reflecting the point", () => {
    // r = -1 at angle 0 should be the same as r=1 at angle PI
    const pNeg = polarToCartesian(0, 0, -1, 0)
    expect(pNeg.x).toBeCloseTo(-1, 10)
    expect(pNeg.y).toBeCloseTo(0, 10)
  })
})
