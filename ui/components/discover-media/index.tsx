import style from "./style.module.css"

import { buildImageSrcSet, type AspectRatio } from "@common/utilities/image"

/**
 * DiscoverMedia
 * ---
 * This is just a small wrapper for the media attached to cards.  Let's us do
 * srcSet and sizing dynamically
 */
export function DiscoverMedia({
  imageUrl,
  showPriority,
  priority,
  smartCrop,
  aspectRatio = "wide",
}: {
  imageUrl: string
  showPriority: boolean
  priority: string
  smartCrop: boolean
  aspectRatio?: AspectRatio
}) {
  // Validate required environment variable
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  if (!cloudName) {
    throw new Error(
      "VITE_CLOUDINARY_CLOUD_NAME environment variable is required for image transformation",
    )
  }

  // Aspect ratio hint ensures Cloudinary crops appropriately for display context
  // Always serves 2x quality - no DPR switching to avoid compression artifacts
  const imageData = smartCrop
    ? buildImageSrcSet({
        cloudName,
        sourceUrl: imageUrl,
        aspectRatio,
        useSmartCrop: true,
        format: "auto",
      })
    : { src: imageUrl }

  return (
    <picture className={style.media} data-testid="discover-media">
      <img src={imageData.src} alt="" />
      {/* Priority badge shown only in priority editing mode */}
      {showPriority ? <div className={style.priority}>{priority}</div> : null}
    </picture>
  )
}
