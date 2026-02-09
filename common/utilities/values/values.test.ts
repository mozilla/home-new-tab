import { describe, it, expect } from "vitest"
import { safeJsonParse } from "."

describe("safeJsonParse", () => {
  it("parses valid JSON", () => {
    const result = safeJsonParse('{"foo":"bar"}')
    expect(result).toEqual({ foo: "bar" })
  })

  it("returns null for malformed JSON", () => {
    const result = safeJsonParse("{invalid json}")
    expect(result).toBeNull()
  })

  it("returns null for empty string", () => {
    const result = safeJsonParse("")
    expect(result).toBeNull()
  })

  it("parses arrays", () => {
    const result = safeJsonParse("[1,2,3]")
    expect(result).toEqual([1, 2, 3])
  })

  it("parses primitives", () => {
    expect(safeJsonParse("42")).toBe(42)
    expect(safeJsonParse('"hello"')).toBe("hello")
    expect(safeJsonParse("true")).toBe(true)
    expect(safeJsonParse("null")).toBe(null)
  })
})
