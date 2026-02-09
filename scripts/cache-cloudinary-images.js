/**
 * Cache Cloudinary Images Script
 *
 * Transforms images from merino-curated.json through Cloudinary and caches them locally.
 * This avoids hitting Cloudinary's transform limit repeatedly.
 *
 * Usage: node scripts/cache-cloudinary-images.js
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cloudinary config (from your Python script)
const CLOUDINARY_CLOUD_NAME = 'djl4pgjfg';

// Card dimensions (from CSS analysis)
const DIMENSIONS = {
  hero: { width: 190, height: 250, suffix: 'hero' },
  sideBySide: { width: 110, height: 117, suffix: 'sbs' },
  vertical: { width: 300, height: 160, suffix: 'vert' }, // 16:9 ratio
};

// Paths
const MOCK_DATA_PATH = resolve(__dirname, '../data/mocks/merino-curated.json');
const IMAGE_CACHE_DIR = resolve(__dirname, '../clients/web/public/cached-images');
const BACKUP_PATH = resolve(__dirname, '../data/mocks/merino-curated.backup.json');

/**
 * Generate Cloudinary transformation URL
 */
function getCloudinaryUrl(originalUrl, width, height) {
  const transformations = [
    `w_${Math.round(width)}`,
    `h_${Math.round(height)}`,
    'c_fill',
    'g_auto',
    'dpr_2.0', // Retina/HiDPI support (2x pixel density)
    'q_100',
    'f_webp',
  ].join(',');

  const encodedUrl = encodeURIComponent(originalUrl);
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/fetch/${transformations}/${encodedUrl}`;
}

/**
 * Generate a hash-based filename for an image
 */
function getImageFilename(url, suffix) {
  const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
  // Always use WebP for cached images
  return `${hash}-${suffix}.webp`;
}

/**
 * Download an image from URL to local path
 */
async function downloadImage(url, outputPath) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const fileStream = createWriteStream(outputPath);
    await pipeline(response.body, fileStream);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to download: ${error.message}`);
    return false;
  }
}

/**
 * Process a single image: transform through Cloudinary and cache locally
 */
async function processImage(originalUrl, baseFilename) {
  const results = {};

  for (const [type, config] of Object.entries(DIMENSIONS)) {
    const filename = `${baseFilename}-${config.suffix}.webp`;
    const localPath = resolve(IMAGE_CACHE_DIR, filename);
    const cloudinaryUrl = getCloudinaryUrl(originalUrl, config.width, config.height);

    console.log(`  → ${type}: ${config.width}x${config.height}`);

    const success = await downloadImage(cloudinaryUrl, localPath);
    if (success) {
      results[type] = `/cached-images/${filename}`;
      console.log(`  ✓ Saved: ${filename}`);
    } else {
      results[type] = null;
    }
  }

  return results;
}

/**
 * Extract all unique image URLs from the mock data
 */
function extractImageUrls(mockData) {
  const urls = new Set();

  for (const feed of Object.values(mockData.feeds)) {
    if (feed.recommendations) {
      for (const item of feed.recommendations) {
        if (item.imageUrl) {
          urls.add(item.imageUrl);
        }
      }
    }
  }

  return Array.from(urls);
}

/**
 * Update mock data to use cached local images
 */
function updateMockData(mockData, imageMapping) {
  const updated = JSON.parse(JSON.stringify(mockData)); // Deep clone

  for (const feed of Object.values(updated.feeds)) {
    if (feed.recommendations) {
      for (const item of feed.recommendations) {
        if (item.imageUrl && imageMapping[item.imageUrl]) {
          const cached = imageMapping[item.imageUrl];

          // Store original URL for reference
          item.originalImageUrl = item.imageUrl;

          // Update imageUrl to local cached version (hero as default)
          item.imageUrl = cached.hero || item.imageUrl;

          // Add srcset for responsive images
          const srcsetParts = [];
          if (cached.hero) srcsetParts.push(`${cached.hero} 190w`);
          if (cached.vertical) srcsetParts.push(`${cached.vertical} 300w`);
          if (cached.sideBySide) srcsetParts.push(`${cached.sideBySide} 110w`);

          if (srcsetParts.length > 0) {
            item.imageSrcset = srcsetParts.join(', ');
          }
        }
      }
    }
  }

  return updated;
}

/**
 * Main execution
 */
async function main() {
  console.log('🖼️  Cloudinary Image Caching Script\n');
  console.log('=' .repeat(60));

  // Create cache directory
  await mkdir(IMAGE_CACHE_DIR, { recursive: true });
  console.log(`✓ Cache directory ready: ${IMAGE_CACHE_DIR}\n`);

  // Read mock data
  console.log('📖 Reading mock data...');
  const mockDataJson = await readFile(MOCK_DATA_PATH, 'utf-8');
  const mockData = JSON.parse(mockDataJson);
  console.log('✓ Mock data loaded\n');

  // Extract unique image URLs
  const imageUrls = extractImageUrls(mockData);
  console.log(`📸 Found ${imageUrls.length} unique images\n`);

  // Process each image
  const imageMapping = {};
  let processedCount = 0;

  for (const [index, url] of imageUrls.entries()) {
    console.log(`\n[${index + 1}/${imageUrls.length}] Processing:`);
    console.log(`  ${url.slice(0, 80)}...`);

    const baseFilename = getImageFilename(url, 'base');
    const cached = await processImage(url, baseFilename.replace('-base.', ''));

    imageMapping[url] = cached;
    processedCount++;

    // Rate limiting: small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✓ Processed ${processedCount} images\n`);

  // Backup original mock data
  console.log('💾 Creating backup of original mock data...');
  await writeFile(BACKUP_PATH, mockDataJson);
  console.log(`✓ Backup saved: ${BACKUP_PATH}\n`);

  // Update mock data with cached image paths
  console.log('📝 Updating mock data with cached images...');
  const updatedMockData = updateMockData(mockData, imageMapping);
  await writeFile(
    MOCK_DATA_PATH,
    JSON.stringify(updatedMockData, null, 2)
  );
  console.log(`✓ Mock data updated: ${MOCK_DATA_PATH}\n`);

  // Summary
  console.log('='.repeat(60));
  console.log('✨ Done! Summary:');
  console.log(`   • Images processed: ${processedCount}`);
  console.log(`   • Cache directory: ${IMAGE_CACHE_DIR}`);
  console.log(`   • Original backup: ${BACKUP_PATH}`);
  console.log('='.repeat(60));
}

// Run
main().catch(error => {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
