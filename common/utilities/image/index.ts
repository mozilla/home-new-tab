export interface CloudinaryTransformOptions {
  width?: number
  height?: number
  crop?: "fill" | "scale" | "fit" | "limit" | "pad" | "crop"
  gravity?:
    | "auto"
    | "center"
    | "face"
    | "faces"
    | "north"
    | "south"
    | "east"
    | "west"
  dpr?: number // Device pixel ratio (1.0, 2.0, etc.)
  quality?: number | "auto" // 1-100 or 'auto'
  format?: "jpg" | "png" | "webp" | "gif" | "auto"
}

/**
 * Builds a Cloudinary fetch URL with optional transformations
 *
 * @param cloudName - Cloudinary cloud name
 * @param sourceUrl - Original image URL to fetch
 * @param options - Optional transformation parameters
 * @returns Full Cloudinary fetch URL
 *
 * @example
 * buildCloudinaryUrl('my-cloud', 'https://example.com/image.jpg', {
 *   width: 400,
 *   height: 300,
 *   crop: 'fill',
 *   gravity: 'auto',
 *   format: 'webp'
 * })
 *
 * // => 'https://res.cloudinary.com/my-cloud/image/fetch/w_400,h_300,c_fill,g_auto,f_webp/https%3A%2F%2Fexample.com%2Fimage.jpg'
 */
export function buildCloudinaryUrl(
  cloudName: string,
  sourceUrl: string,
  options?: CloudinaryTransformOptions,
): string {
  const encodedUrl = encodeURIComponent(sourceUrl)

  // No transformations - basic fetch
  if (!options || Object.keys(options).length === 0) {
    return `https://res.cloudinary.com/${cloudName}/image/fetch/${encodedUrl}`
  }

  // Build transformation string
  const transformations: string[] = []

  if (options.width) transformations.push(`w_${Math.round(options.width)}`)
  if (options.height) transformations.push(`h_${Math.round(options.height)}`)
  if (options.crop) transformations.push(`c_${options.crop}`)
  if (options.gravity) transformations.push(`g_${options.gravity}`)
  if (options.dpr) transformations.push(`dpr_${options.dpr}`)
  if (options.quality) transformations.push(`q_${options.quality}`)
  if (options.format) transformations.push(`f_${options.format}`)

  const transformString = transformations.join(",")
  return `https://res.cloudinary.com/${cloudName}/image/fetch/${transformString}/${encodedUrl}`
}

export type AspectRatio = "wide" | "portrait" | "square"

export interface SrcSetConfig {
  cloudName?: string
  sourceUrl: string
  aspectRatio: AspectRatio
  useSmartCrop?: boolean
  format?: "auto" | "webp" | "jpg" | "png"
}

/**
 * Aspect ratio dimensions for different layout contexts
 * All scaled to 400px base width for consistency
 */
export const ASPECT_RATIO_DIMENSIONS: Record<
  AspectRatio,
  { width: number; height: number }
> = {
  wide: { width: 400, height: 225 }, // 16:9 ratio (300×169 scaled)
  portrait: { width: 400, height: 562 }, // ~0.71 ratio (190×267 scaled)
  square: { width: 400, height: 426 }, // ~0.94 ratio (110×117 scaled)
}

/**
 * Builds a high-quality 2x image URL with aspect ratio awareness
 *
 * Always serves images at 2x DPR for consistent quality across all displays.
 * No srcset - just one high-quality image to avoid compression artifacts.
 *
 * @param config - Configuration for image generation
 * @returns Single high-quality image URL
 *
 * @example
 * buildImageSrcSet({
 *   cloudName: 'my-cloud',
 *   sourceUrl: 'https://example.com/image.jpg',
 *   aspectRatio: 'wide',
 *   useSmartCrop: true,
 *   format: 'auto'
 * })
 *
 * // Returns:
 * // {
 * //   src: "url-400x225-dpr2-crop-auto-format"
 * // }
 */
export function buildImageSrcSet(config: SrcSetConfig): {
  src: string
} {
  const {
    cloudName,
    sourceUrl,
    aspectRatio,
    useSmartCrop = false,
    format,
  } = config

  if (!cloudName) {
    return { src: sourceUrl }
  }

  const { width, height } = ASPECT_RATIO_DIMENSIONS[aspectRatio]

  // Always generate 2x for consistent high quality
  const url = buildCloudinaryUrl(cloudName, sourceUrl, {
    width,
    height,
    dpr: 2,
    ...(useSmartCrop && { crop: "fill", gravity: "auto" }),
    ...(format && { format }),
  })

  return { src: url }
}
