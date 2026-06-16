import { Worker } from 'bullmq';
import { createWriteStream, mkdirSync } from 'fs';
import { resolve, extname, basename } from 'path';
import { pipeline } from 'stream/promises';
import fetch from 'node-fetch';
import pRetry from 'p-retry';
import { redis as redisConfig, processing, output } from '../config/index.js';
import { query } from '../db/pool.js';
import { enqueueCloudinaryUploads } from '../queues/index.js';
import { imageLogger } from '../logger/index.js';

mkdirSync(output.imagesDir, { recursive: true });

const connection = { ...redisConfig };

async function downloadImage(imageId, sourceUrl, productId) {
  const ext = extname(new URL(sourceUrl).pathname) || '.jpg';
  const filename = `${productId}_${imageId}${ext}`;
  const localPath = resolve(output.imagesDir, filename);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), processing.imageTimeoutMs);

  try {
    const res = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'PharmacyEnrichmentBot/1.0' },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      throw new Error(`Not an image: ${contentType}`);
    }

    await pipeline(res.body, createWriteStream(localPath));
    return localPath;
  } finally {
    clearTimeout(timeout);
  }
}

const worker = new Worker(
  'image_download_queue',
  async (job) => {
    const { image_id, product_id, source_url } = job.data;
    imageLogger.info('Downloading image', { image_id, product_id, source_url: source_url?.slice(0, 80) });

    const localPath = await pRetry(
      () => downloadImage(image_id, source_url, product_id),
      {
        retries: processing.imageRetryAttempts,
        onFailedAttempt: err => {
          imageLogger.warn('Download retry', {
            image_id,
            attempt: err.attemptNumber,
            err: err.message,
          });
        },
      }
    );

    // Update DB status
    await query(
      `UPDATE product_images SET local_path=?, status='downloaded' WHERE id=?`,
      [localPath, image_id]
    );

    // Queue cloudinary upload
    await enqueueCloudinaryUploads([{ id: image_id, product_id, local_path: localPath }]);

    imageLogger.info('Image downloaded', { image_id, localPath });
    return { localPath };
  },
  {
    connection,
    concurrency: processing.imageConcurrency,
  }
);

worker.on('failed', async (job, err) => {
  imageLogger.error('Image download failed permanently', {
    image_id: job?.data?.image_id,
    source_url: job?.data?.source_url?.slice(0, 80),
    err: err.message,
  });
  // Mark as failed in DB
  if (job?.data?.image_id) {
    await query(
      `UPDATE product_images SET status='failed', error_msg=? WHERE id=?`,
      [err.message.slice(0, 500), job.data.image_id]
    ).catch(() => {});
  }
});

worker.on('error', err => imageLogger.error('Worker error', { err: err.message }));

imageLogger.info('Image download worker started', { concurrency: processing.imageConcurrency });

export default worker;
