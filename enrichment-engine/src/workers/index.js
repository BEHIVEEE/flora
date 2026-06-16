/**
 * Worker process entry point.
 * Starts all BullMQ workers in a single Node.js process.
 */
import 'dotenv/config';
import imageDownloadWorker from './imageDownloadWorker.js';
import cloudinaryWorker from './cloudinaryWorker.js';
import mysqlUpdateWorker from './mysqlUpdateWorker.js';
import matchingQueueWorker from './matchingQueueWorker.js';
import { queueLogger } from '../logger/index.js';

queueLogger.info('All workers started (image, cloudinary, mysql, matching)');

async function gracefulShutdown(signal) {
  queueLogger.info(`Received ${signal}, shutting down workers…`);
  await Promise.all([
    imageDownloadWorker.close(),
    cloudinaryWorker.close(),
    mysqlUpdateWorker.close(),
    matchingQueueWorker.close(),
  ]);
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
