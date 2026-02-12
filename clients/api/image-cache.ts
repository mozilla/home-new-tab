import "dotenv/config"
import crypto from "crypto"

import { env } from "hono/adapter"
import { Hono } from "hono"
import path from "path"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { buildCloudinaryUrl } from "@common/utilities/image"

export const imageCacheRoutes = new Hono()

imageCacheRoutes.get("/:url", async (c) => {
  try {
    // Verify Cloudinary configuration
    const { CLOUDINARY_CLOUD_NAME } = env<{ CLOUDINARY_CLOUD_NAME: string }>(c)
    if (!CLOUDINARY_CLOUD_NAME) {
      throw new Error("CLOUDINARY_CLOUD_NAME environment variable is required")
    }

    // Extract and decode URL parameter
    const url = c.req.param("url")
    if (!url) return c.text("Missing URL parameter", 400)

    // Generate cache key from URL hash
    const cacheKey = getCacheKey(url)
    const cachePath = path.join(process.cwd(), "image-cache", cacheKey)

    let buffer: Buffer

    // Check if cached version exists
    if (existsSync(cachePath)) {
      console.log("Serving from local cache")
      buffer = await readFile(cachePath) // Serve from cache
    } else {
      console.log("Getting from Cloudinary")
      buffer = await cacheImage(url, CLOUDINARY_CLOUD_NAME, cachePath) // Fetch through Cloudinary and cache
      console.log("Cloudinary fetch complete")
    }

    // Detect content type from buffer
    const contentType = detectContentType(buffer)

    // Serve image with proper content type
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
      },
    })
  } catch (err) {
    console.error("Image cache error:", err)
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    return c.text(`Image fetch failed: ${errorMessage}`, 500)
  }
})

async function cacheImage(
  url: string,
  cloudName: string,
  cachePath: string,
): Promise<Buffer> {
  // Construct Cloudinary fetch URL using utility
  const cloudinaryUrl = buildCloudinaryUrl(cloudName, url)

  // Fetch from Cloudinary
  const response = await fetch(cloudinaryUrl)
  if (!response.ok) {
    throw new Error(
      `Cloudinary fetch failed: ${response.status} ${response.statusText}`,
    )
  }

  // Get buffer
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Store to cache
  const { writeFile, mkdir } = await import("fs/promises")
  await mkdir(path.dirname(cachePath), { recursive: true })
  await writeFile(cachePath, buffer)

  return buffer
}

function getCacheKey(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex")
}

//prettier-ignore
function detectContentType(buffer: Buffer): string {
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg"
  }
  // PNG: 89 50 4E 47
  if ( buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png"
  }
  // GIF: 47 49 46
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return "image/gif"
  }
  // WebP: RIFF....WEBP (check bytes 8-11 for WEBP)
  if (buffer.length >= 12 &&buffer[8] === 0x57 &&buffer[9] === 0x45 &&buffer[10] === 0x42 &&buffer[11] === 0x50) {
    return "image/webp"
  }
  // SVG: starts with '<svg' or '<?xml'
  if (buffer[0] === 0x3c && (buffer[1] === 0x73 || buffer[1] === 0x3f)) {
    return "image/svg+xml"
  }
  // Fallback for unknown types
  return "application/octet-stream"
}
