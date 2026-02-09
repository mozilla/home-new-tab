# Cloudinary Image Caching

This script transforms images from the mock data through Cloudinary's smart cropping API and caches them locally to avoid hitting the transformation limit.

## Overview

The discover feed uses images with different dimensions based on the card type:
- **Hero cards**: 190x250px (featured items)
- **Side-by-side cards**: 110x117px (compact layout)
- **Vertical cards**: 300x169px (16:9 aspect ratio)

The script:
1. Extracts all image URLs from `data/mocks/merino-curated.json`
2. Transforms each image through Cloudinary with all 3 dimensions
3. Downloads and caches the transformed images locally
4. Updates the mock data to use local paths with `srcset` for responsive images

## Usage

### Initial Setup (First Time Only)

Run the caching script to download and cache all Cloudinary transformations:

```bash
pnpm cache-images
```

This will:
- Create `clients/web/public/cached-images/` directory
- Download transformed images for all 3 card dimensions
- Backup original mock data to `data/mocks/merino-curated.backup.json`
- Update mock data to reference local cached images

### What Gets Modified

**Before:**
```json
{
  "imageUrl": "https://example.com/image.jpg"
}
```

**After:**
```json
{
  "imageUrl": "/cached-images/abc123-hero.jpg",
  "imageSrcset": "/cached-images/abc123-hero.jpg 190w, /cached-images/abc123-vert.jpg 300w, /cached-images/abc123-sbs.jpg 110w",
  "originalImageUrl": "https://example.com/image.jpg"
}
```

### Restoring Original Data

If you need to restore the original image URLs:

```bash
cp data/mocks/merino-curated.backup.json data/mocks/merino-curated.json
```

## How It Works

### 1. Image Transformation

Each image is transformed through Cloudinary with these parameters:
- **Crop mode**: `fill` (smart cropping)
- **Gravity**: `auto` (face/salient object detection)
- **Quality**: `auto` (optimized)

### 2. Filename Generation

Images are saved with a hash-based naming scheme:
```
{md5-hash}-{type}.{ext}

Examples:
- a1b2c3d4e5f6-hero.jpg   (190x250px)
- a1b2c3d4e5f6-sbs.jpg    (110x117px)
- a1b2c3d4e5f6-vert.jpg   (300x169px)
```

### 3. Responsive Images with srcset

The DiscoverCard component uses `srcset` to serve the appropriate image size:

```tsx
<img
  src={imageUrl}
  srcSet={imageSrcset}
  sizes="(min-width: 1248px) 190px, (min-width: 940px) 300px, 100vw"
  alt=""
/>
```

The browser automatically selects the best image based on:
- Container width
- Device pixel ratio
- Network conditions

## Configuration

Edit `scripts/cache-cloudinary-images.js` to modify:

### Cloudinary Settings
```javascript
const CLOUDINARY_CLOUD_NAME = 'djl4pgjfg';
```

### Card Dimensions
```javascript
const DIMENSIONS = {
  hero: { width: 190, height: 250, suffix: 'hero' },
  sideBySide: { width: 110, height: 117, suffix: 'sbs' },
  vertical: { width: 300, height: 169, suffix: 'vert' },
};
```

### Rate Limiting
```javascript
// Delay between requests (milliseconds)
await new Promise(resolve => setTimeout(resolve, 500));
```

## Troubleshooting

### Script fails with "fetch is not defined"
Make sure you're using Node.js 18+ which has native fetch support.

### Images not loading in browser
1. Check that `clients/web/public/cached-images/` exists
2. Verify the dev server is serving static files from `public/`
3. Check browser console for 404 errors

### Mock data is corrupted
Restore from backup:
```bash
cp data/mocks/merino-curated.backup.json data/mocks/merino-curated.json
```

### Need to re-cache images
1. Delete cached images: `rm -rf clients/web/public/cached-images`
2. Restore original mock data (see above)
3. Run `pnpm cache-images` again

## Architecture

```
┌─────────────────────┐
│ Mock Data (JSON)    │
│ - Original URLs     │
└──────────┬──────────┘
           │
           │ 1. Extract URLs
           ▼
┌─────────────────────┐
│ Cloudinary API      │
│ - Transform images  │
│ - Smart crop        │
└──────────┬──────────┘
           │
           │ 2. Download
           ▼
┌─────────────────────┐
│ Local Cache         │
│ /public/cached-     │
│   images/           │
│ - hero.jpg          │
│ - sbs.jpg           │
│ - vert.jpg          │
└──────────┬──────────┘
           │
           │ 3. Update mock data
           ▼
┌─────────────────────┐
│ DiscoverCard        │
│ - Uses srcset       │
│ - Responsive images │
└─────────────────────┘
```
