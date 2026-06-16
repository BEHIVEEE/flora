import { Worker } from 'bullmq';
import { v2 as cloudinarySDK } from 'cloudinary';
import { unlink } from 'fs/promises';
import { redis as redisConfig, cloudinary as cloudinaryConfig } from '../config/index.js';
import { query } from '../db/pool.js';
import { setEnrichmentCloudinaryUrl } from '../db/enrichmentStore.js';
import { cloudinaryLogger } from '../logger/index.js';

// Configure Cloudinary
cloudinarySDK.config({
  cloud_name: cloudinaryConfig.cloud_name,
  api_key:    cloudinaryConfig.api_key,
  api_secret: cloudinaryConfig.api_secret,
  secure:     true,
});

const connection = { ...redisConfig };

const worker = new Worker(
  'cloudinary_upload_queue',
  async (job) => {
    const { image_id, product_id, local_path } = job.data;
    cloudinaryLogger.info('Uploading to Cloudinary', { image_id, product_id });

    const publicId = `${cloudinaryConfig.folder}/product_${product_id}_img_${image_id}`;

    const result = await cloudinarySDK.uploader.upload(local_path, {
      public_id: publicId,
      folder:    cloudinaryConfig.folder,
      resource_type: 'image',
      overwrite: true,
      transformation: [
        { quality: 'auto:good', fetch_format: 'auto' },
        { width: 800, height: 800, crop: 'limit' },
      ],
    });

    // Update DB
    await query(
      `UPDATE product_images 
       SET cloudinary_url=?, public_id=?, status='uploaded' 
       WHERE id=?`,
      [result.secure_url, result.public_id, image_id]
    );

    const [primary] = await query(
      `SELECT sort_order FROM product_images WHERE id = ?`,
      [image_id]
    );
    if (!primary || primary.sort_order <= 1) {
      await setEnrichmentCloudinaryUrl(product_id, result.secure_url);
    }

    // Clean up local file
    await unlink(local_path).catch(() => {});

    cloudinaryLogger.info('Upload complete', {
      image_id,
      cloudinary_url: result.secure_url,
      public_id: result.public_id,
    });

    return { cloudinaryUrl: result.secure_url, publicId: result.public_id };
  },
  {
    connection,
    concurrency: 5,
  }
);

worker.on('failed', async (job, err) => {
  cloudinaryLogger.error('Cloudinary upload failed permanently', {
    image_id: job?.data?.image_id,
    err: err.message,
  });
  if (job?.data?.image_id) {
    await query(
      `UPDATE product_images SET status='failed', error_msg=? WHERE id=?`,
      [('cloudinary: ' + err.message).slice(0, 500), job.data.image_id]
    ).catch(() => {});
  }
});

worker.on('error', err => cloudinaryLogger.error('Worker error', { err: err.message }));

cloudinaryLogger.info('Cloudinary upload worker started');

export default worker;
