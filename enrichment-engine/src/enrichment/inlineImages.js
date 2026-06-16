/**
 * Inline image processing — no Redis/BullMQ required (shop PC mode).
 */
import { createWriteStream, mkdirSync } from 'fs';
import { resolve, extname } from 'path';
import { pipeline } from 'stream/promises';
import fetch from 'node-fetch';
import { v2 as cloudinarySDK } from 'cloudinary';
import pRetry from 'p-retry';
import { cloudinary as cloudinaryConfig, output, processing } from '../config/index.js';
import { query } from '../db/pool.js';
import { setEnrichmentCloudinaryUrl, setEnrichmentImageUrl } from '../db/enrichmentStore.js';
import logger from '../logger/index.js';

mkdirSync(output.imagesDir, { recursive: true });

if (cloudinaryConfig.cloud_name) {
  cloudinarySDK.config({
    cloud_name: cloudinaryConfig.cloud_name,
    api_key: cloudinaryConfig.api_key,
    api_secret: cloudinaryConfig.api_secret,
    secure: true,
  });
}

async function downloadImage(imageId, sourceUrl, productId) {
  const ext = extname(new URL(sourceUrl).pathname) || '.jpg';
  const localPath = resolve(output.imagesDir, `${productId}_${imageId}${ext}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), processing.imageTimeoutMs);
  try {
    const res = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'PharmacyEnrichmentBot/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await pipeline(res.body, createWriteStream(localPath));
    return localPath;
  } finally {
    clearTimeout(timeout);
  }
}

export async function processImagesInline(imageRows) {
  for (const row of imageRows) {
    try {
      const localPath = await pRetry(
        () => downloadImage(row.id, row.source_url, row.product_id),
        { retries: processing.imageRetryAttempts }
      );

      await query(
        `UPDATE product_images SET local_path = ?, status = 'downloaded' WHERE id = ?`,
        [localPath, row.id]
      );

      if (!cloudinaryConfig.cloud_name) {
        await setEnrichmentImageUrl(row.product_id, row.source_url);
        continue;
      }

      const publicId = `${cloudinaryConfig.folder}/product_${row.product_id}_img_${row.id}`;
      const result = await cloudinarySDK.uploader.upload(localPath, {
        public_id: publicId,
        folder: cloudinaryConfig.folder,
        overwrite: true,
        transformation: [
          { quality: 'auto:good', fetch_format: 'auto' },
          { width: 800, height: 800, crop: 'limit' },
        ],
      });

      await query(
        `UPDATE product_images SET cloudinary_url = ?, public_id = ?, status = 'uploaded' WHERE id = ?`,
        [result.secure_url, result.public_id, row.id]
      );

      if (row.sort_order === 1 || Number(row.sort_order) <= 1) {
        await setEnrichmentCloudinaryUrl(row.product_id, result.secure_url);
      }
    } catch (err) {
      logger.warn('Inline image failed', { id: row.id, err: err.message });
      await query(
        `UPDATE product_images SET status = 'failed' WHERE id = ?`,
        [row.id]
      ).catch(() => {});
    }
  }
}
