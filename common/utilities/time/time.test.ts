import { describe, it, expect } from "vitest"

import {
  clamp,
  minutesToMs,
  msToMinutes,
  msToSeconds,
  parseNumber,
  safeRatio,
  formatMMSS,
} from "."

describe("msToMinutes", () => {
  it("converts ms to minutes with 2 decimal rounding", () => {
    expect(msToMinutes(0)).toBe(0)
    expect(msToMinutes(60_000)).toBe(1)
    expect(msToMinutes(90_000)).toBe(1.5)
    expect(msToMinutes(61_000)).toBe(1.02) // 1.0166.. -> 1.02
  })

  it("handles negative inputs", () => {
    expect(msToMinutes(-60_000)).toBe(-1)
  })
})

describe("minutesToMs", () => {
  it("converts minutes to ms and rounds to nearest ms", () => {
    expect(minutesToMs(0)).toBe(0)
    expect(minutesToMs(1)).toBe(60_000)
    expect(minutesToMs(1.5)).toBe(90_000)
  })

  it("clamps negative values to 0", () => {
    expect(minutesToMs(-1)).toBe(0)
    expect(minutesToMs(-0.001)).toBe(0)
  })

  it("rounds fractional minutes", () => {
    // 0.00001 min = 0.6 ms => rounds to 1 ms
    expect(minutesToMs(0.00001)).toBe(1)
  })
})

describe("parseNumber", () => {
  it("parses numeric strings", () => {
    expect(parseNumber("0")).toBe(0)
    expect(parseNumber("12")).toBe(12)
    expect(parseNumber("12.34")).toBe(12.34)
    expect(parseNumber("-5")).toBe(-5)
  })

  it("accepts whitespace-trimmed numeric input via Number()", () => {
    expect(parseNumber("  42 ")).toBe(42)
  })

  it("returns null for non-finite results", () => {
    expect(parseNumber("nope")).toBe(null)
    expect(parseNumber("NaN")).toBe(null)
    expect(parseNumber("Infinity")).toBe(null)
    expect(parseNumber("-Infinity")).toBe(null)
  })

  it("treats empty string as 0 because Number('') === 0", () => {
    // This locks in current behavior. If you *don't* want this,
    // change parseNumber to trim and return null on empty.
    expect(parseNumber("")).toBe(0)
  })
})

describe("msToSeconds", () => {
  it("floors milliseconds to whole seconds", () => {
    expect(msToSeconds(0)).toBe(0)
    expect(msToSeconds(999)).toBe(0)
    expect(msToSeconds(1000)).toBe(1)
    expect(msToSeconds(1001)).toBe(1)
    expect(msToSeconds(1999)).toBe(1)
    expect(msToSeconds(2000)).toBe(2)
  })

  it("floors negative values as well", () => {
    expect(msToSeconds(-1)).toBe(-1)
    expect(msToSeconds(-999)).toBe(-1)
    expect(msToSeconds(-1000)).toBe(-1)
    expect(msToSeconds(-1001)).toBe(-2)
  })
})

describe("clamp", () => {
  it("clamps within range", () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it("works with equal bounds", () => {
    expect(clamp(123, 7, 7)).toBe(7)
  })
})

describe("safeRatio", () => {
  it("returns numerator/denominator for valid finite inputs", () => {
    expect(safeRatio(1, 2)).toBe(0.5)
    expect(safeRatio(0, 10)).toBe(0)
    expect(safeRatio(-1, 2)).toBe(-0.5)
  })

  it("returns 0 when denominator is 0 or negative", () => {
    expect(safeRatio(1, 0)).toBe(0)
    expect(safeRatio(1, -2)).toBe(0)
  })

  it("returns 0 for non-finite inputs", () => {
    expect(safeRatio(Number.NaN, 2)).toBe(0)
    expect(safeRatio(1, Number.NaN)).toBe(0)
    expect(safeRatio(Number.POSITIVE_INFINITY, 2)).toBe(0)
    expect(safeRatio(1, Number.NEGATIVE_INFINITY)).toBe(0)
  })
})

describe("formatMMSS", () => {
  it("formats zero correctly", () => {
    expect(formatMMSS(0)).toBe("00:00")
  })

  it("formats seconds under a minute", () => {
    expect(formatMMSS(1)).toBe("00:01")
    expect(formatMMSS(9)).toBe("00:09")
    expect(formatMMSS(59)).toBe("00:59")
  })

  it("formats exact minutes", () => {
    expect(formatMMSS(60)).toBe("01:00")
    expect(formatMMSS(120)).toBe("02:00")
    expect(formatMMSS(600)).toBe("10:00")
  })

  it("formats minutes and seconds", () => {
    expect(formatMMSS(61)).toBe("01:01")
    expect(formatMMSS(125)).toBe("02:05")
    expect(formatMMSS(754)).toBe("12:34")
  })

  it("pads both minutes and seconds", () => {
    expect(formatMMSS(5)).toBe("00:05")
    expect(formatMMSS(65)).toBe("01:05")
    expect(formatMMSS(605)).toBe("10:05")
  })

  it("clamps negative values to zero", () => {
    expect(formatMMSS(-1)).toBe("00:00")
    expect(formatMMSS(-999)).toBe("00:00")
  })

  it("handles large values", () => {
    expect(formatMMSS(3600)).toBe("60:00") // 60 minutes
    expect(formatMMSS(3661)).toBe("61:01")
  })

  it("handles fractional seconds by truncating", () => {
    expect(formatMMSS(1.9)).toBe("00:01")
    expect(formatMMSS(61.7)).toBe("01:01")
  })

  it("always returns MM:SS format", () => {
    const cases = [0, 1, 9, 10, 59, 60, 61, 3599, 3600, 99999]

    for (const n of cases) {
      const result = formatMMSS(n)
      expect(result).toMatch(/^\d{2,}:\d{2}$/)
    }
  })

  it("never produces seconds >= 60", () => {
    for (let i = 0; i < 10_000; i++) {
      const formatted = formatMMSS(i)
      const [, seconds] = formatted.split(":")
      const s = Number(seconds)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThan(60)
    }
  })

  it("is monotonic as input increases", () => {
    let last = formatMMSS(0)

    for (let i = 1; i < 1000; i++) {
      const current = formatMMSS(i)

      // Compare as total seconds from formatted output
      const toSeconds = (s: string) => {
        const [m, sec] = s.split(":").map(Number)
        return m * 60 + sec
      }

      expect(toSeconds(current)).toBeGreaterThanOrEqual(toSeconds(last))

      last = current
    }
  })
})
