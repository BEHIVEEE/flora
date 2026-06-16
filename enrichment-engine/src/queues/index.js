import { Queue } from 'bullmq';
import { redis as redisConfig } from '../config/index.js';

const connection = { ...redisConfig };

export const matchingQueue        = new Queue('matching_queue',        { connection });
export const imageDownloadQueue   = new Queue('image_download_queue',  { connection });
export const cloudinaryUploadQueue = new Queue('cloudinary_upload_queue', { connection });
export const mysqlUpdateQueue     = new Queue('mysql_update_queue',    { connection });

export const ALL_QUEUES = [
  matchingQueue,
  imageDownloadQueue,
  cloudinaryUploadQueue,
  mysqlUpdateQueue,
];

/** Add a batch of image download jobs */
export async function enqueueImageDownloads(imageRows) {
  const jobs = imageRows.map(row => ({
    name: 'download',
    data: {
      image_id:    row.id,
      product_id:  row.product_id,
      source_url:  row.source_url,
      public_id:   row.public_id_hint,
    },
    opts: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 500,
      removeOnFail: 200,
    },
  }));
  await imageDownloadQueue.addBulk(jobs);
}

/** Add a batch of cloudinary upload jobs */
export async function enqueueCloudinaryUploads(imageRows) {
  const jobs = imageRows.map(row => ({
    name: 'upload',
    data: {
      image_id:   row.id,
      product_id: row.product_id,
      local_path: row.local_path,
    },
    opts: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: 500,
      removeOnFail: 200,
    },
  }));
  await cloudinaryUploadQueue.addBulk(jobs);
}

/** Add a MySQL enrichment update job */
export async function enqueueMysqlUpdate(productId, data) {
  await mysqlUpdateQueue.add('update', { productId, data }, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 500,
  });
}
