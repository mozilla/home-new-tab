import { describe, it, expect } from "vitest"
import { buildCloudinaryUrl, buildImageSrcSet } from "./index"

describe("buildCloudinaryUrl", () => {
  const cloudName = "test-cloud"
  const sourceUrl = "https://example.com/image.jpg"

  it("builds basic fetch URL without transformations", () => {
    const url = buildCloudinaryUrl(cloudName, sourceUrl)
    expect(url).toBe(
      "https://res.cloudinary.com/test-cloud/image/fetch/https%3A%2F%2Fexample.com%2Fimage.jpg",
    )
  })

  it("builds URL with all transformations", () => {
    const url = buildCloudinaryUrl(cloudName, sourceUrl, {
      width: 400,
      height: 300,
      crop: "fill",
      gravity: "auto",
      dpr: 2.0,
      quality: 100,
      format: "webp",
    })
    expect(url).toBe(
      "https://res.cloudinary.com/test-cloud/image/fetch/w_400,h_300,c_fill,g_auto,dpr_2,q_100,f_webp/https%3A%2F%2Fexample.com%2Fimage.jpg",
    )
  })

  it("builds URL with partial transformations", () => {
    const url = buildCloudinaryUrl(cloudName, sourceUrl, {
      width: 500,
      format: "webp",
    })
    expect(url).toBe(
      "https://res.cloudinary.com/test-cloud/image/fetch/w_500,f_webp/https%3A%2F%2Fexample.com%2Fimage.jpg",
    )
  })

  it("rounds fractional width/height to integers", () => {
    const url = buildCloudinaryUrl(cloudName, sourceUrl, {
      width: 400.7,
      height: 300.3,
    })
    expect(url).toContain("w_401,h_300")
  })

  it("properly encodes source URL with special characters", () => {
    const specialUrl = "https://example.com/path?foo=bar&baz=qux"
    const url = buildCloudinaryUrl(cloudName, specialUrl)
    expect(url).toContain(encodeURIComponent(specialUrl))
  })

  it("handles empty options object", () => {
    const url = buildCloudinaryUrl(cloudName, sourceUrl, {})
    expect(url).toBe(
      "https://res.cloudinary.com/test-cloud/image/fetch/https%3A%2F%2Fexample.com%2Fimage.jpg",
    )
  })

  it("handles quality as 'auto'", () => {
    const url = buildCloudinaryUrl(cloudName, sourceUrl, {
      quality: "auto",
    })
    expect(url).toBe(
      "https://res.cloudinary.com/test-cloud/image/fetch/q_auto/https%3A%2F%2Fexample.com%2Fimage.jpg",
    )
  })

  it("handles format as 'auto'", () => {
    const url = buildCloudinaryUrl(cloudName, sourceUrl, {
      format: "auto",
    })
    expect(url).toBe(
      "https://res.cloudinary.com/test-cloud/image/fetch/f_auto/https%3A%2F%2Fexample.com%2Fimage.jpg",
    )
  })

  it("handles different crop modes", () => {
    const cropModes = ["fill", "scale", "fit", "limit", "pad", "crop"] as const
    cropModes.forEach((mode) => {
      const url = buildCloudinaryUrl(cloudName, sourceUrl, {
        crop: mode,
      })
      expect(url).toContain(`c_${mode}`)
    })
  })

  it("handles different gravity settings", () => {
    const gravities = [
      "auto",
      "center",
      "face",
      "faces",
      "north",
      "south",
      "east",
      "west",
    ] as const
    gravities.forEach((gravity) => {
      const url = buildCloudinaryUrl(cloudName, sourceUrl, {
        gravity: gravity,
      })
      expect(url).toContain(`g_${gravity}`)
    })
  })
})

describe("buildImageSrcSet", () => {
  const cloudName = "test-cloud"
  const sourceUrl = "https://example.com/image.jpg"

  it("generates single 2x quality image URL", () => {
    const result = buildImageSrcSet({
      cloudName,
      sourceUrl,
      aspectRatio: "wide",
      format: "auto",
    })

    // Should return single URL at 2x DPR
    expect(result.src).toContain("dpr_2")

    // Should contain width/height (wide = 400×225)
    expect(result.src).toContain("w_400")
    expect(result.src).toContain("h_225")

    // Should use format auto
    expect(result.src).toContain("f_auto")
  })

  it("applies smart crop transformations when useSmartCrop is true", () => {
    const result = buildImageSrcSet({
      cloudName,
      sourceUrl,
      aspectRatio: "portrait",
      useSmartCrop: true,
      format: "auto",
    })

    // Should contain crop and gravity
    expect(result.src).toContain("c_fill")
    expect(result.src).toContain("g_auto")
  })

  it("omits smart crop transformations when useSmartCrop is false", () => {
    const result = buildImageSrcSet({
      cloudName,
      sourceUrl,
      aspectRatio: "square",
      useSmartCrop: false,
      format: "auto",
    })

    // Should NOT contain crop and gravity
    expect(result.src).not.toContain("c_fill")
    expect(result.src).not.toContain("g_auto")
  })

  it("always uses 2x DPR for consistent quality", () => {
    const result = buildImageSrcSet({
      cloudName,
      sourceUrl,
      aspectRatio: "wide",
      format: "auto",
    })

    // Should always use dpr_2
    expect(result.src).toContain("dpr_2")
    // Should NOT contain dpr_1
    expect(result.src).not.toContain("dpr_1")
  })

  it("returns original URL when cloudName is not provided", () => {
    const result = buildImageSrcSet({
      sourceUrl,
      aspectRatio: "wide",
    })

    // Should return original source URL
    expect(result.src).toBe(sourceUrl)

    // Should NOT contain Cloudinary domain
    expect(result.src).not.toContain("res.cloudinary.com")
  })

  it("uses correct portrait dimensions with 2x quality", () => {
    const result = buildImageSrcSet({
      cloudName,
      sourceUrl,
      aspectRatio: "portrait",
      format: "auto",
    })

    // Portrait should be 400×562 at 2x DPR
    expect(result.src).toContain("w_400")
    expect(result.src).toContain("h_562")
    expect(result.src).toContain("dpr_2")
  })

  it("uses correct wide dimensions with 2x quality", () => {
    const result = buildImageSrcSet({
      cloudName,
      sourceUrl,
      aspectRatio: "wide",
      format: "auto",
    })

    // Wide should be 400×225 at 2x DPR
    expect(result.src).toContain("w_400")
    expect(result.src).toContain("h_225")
    expect(result.src).toContain("dpr_2")
  })

  it("uses correct square dimensions with 2x quality", () => {
    const result = buildImageSrcSet({
      cloudName,
      sourceUrl,
      aspectRatio: "square",
      format: "auto",
    })

    // Square should be 400×426 at 2x DPR
    expect(result.src).toContain("w_400")
    expect(result.src).toContain("h_426")
    expect(result.src).toContain("dpr_2")
  })

  it("uses specified format parameter", () => {
    const result = buildImageSrcSet({
      cloudName,
      sourceUrl,
      aspectRatio: "wide",
      format: "webp",
    })

    expect(result.src).toContain("f_webp")
  })

  it("omits format when not specified", () => {
    const result = buildImageSrcSet({
      cloudName,
      sourceUrl,
      aspectRatio: "wide",
    })

    // Should not contain format parameter
    expect(result.src).not.toContain("f_")
  })
})
