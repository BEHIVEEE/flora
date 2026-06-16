import { cloudinary } from '../cloudinary.js';
import pLimit from 'p-limit';

/**
 * Uploads a local image file to Cloudinary.
 * @param {string} filePath - Absolute path to local file
 * @param {string} folder - Destination folder on Cloudinary
 * @returns {Promise<string>} Secure URL from Cloudinary
 */
export async function uploadLocalImage(filePath, folder = 'chemistshop/enriched_products') {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'image',
      quality: 'auto:good',
      fetch_format: 'auto',
    });
    return result.secure_url;
  } catch (error) {
    console.error(`[CLOUDINARY UPLOAD ERROR] File: ${filePath} - Error: ${error.message}`);
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
}

/**
 * Uploads multiple local files concurrently to Cloudinary.
 * @param {Array<Object>} uploads - List of uploads: { productId, filePath }
 * @param {string} folder - Target folder name
 * @param {number} concurrency - Max concurrent uploads (default 5)
 * @param {Function} onProgress - Progress callback: (success, failed, total, currentUrl, error) => {}
 * @returns {Promise<Array<Object>>} Completed uploads with Cloudinary URLs or errors
 */
export async function uploadLocalImagesBatch(uploads, folder = 'chemistshop/enriched_products', concurrency = 5, onProgress = () => {}) {
  const limit = pLimit(concurrency);
  let successCount = 0;
  let failedCount = 0;
  const total = uploads.length;

  const uploadPromises = uploads.map((task) => {
    return limit(async () => {
      try {
        const cloudinaryUrl = await uploadLocalImage(task.filePath, folder);
        successCount++;
        onProgress(successCount, failedCount, total, cloudinaryUrl, null);
        return {
          productId: task.productId,
          localPath: task.filePath,
          cloudinaryUrl,
          success: true,
        };
      } catch (error) {
        failedCount++;
        onProgress(successCount, failedCount, total, null, error.message);
        return {
          productId: task.productId,
          localPath: task.filePath,
          error: error.message,
          success: false,
        };
      }
    });
  });

  return Promise.all(uploadPromises);
}
