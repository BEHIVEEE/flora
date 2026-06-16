import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';

const TIMEOUT_MS = 10000; // 10 seconds timeout
const MAX_RETRIES = 3;

/**
 * Downloads an image from a URL and saves it locally.
 * @param {string} url - Remote image URL
 * @param {string} destFolder - Local folder where the image should be saved
 * @param {string} fileName - Filename (e.g., product_id.jpg)
 * @returns {Promise<string>} Path to local downloaded image file
 */
async function downloadSingleImage(url, destFolder, fileName) {
  if (!fs.existsSync(destFolder)) {
    fs.mkdirSync(destFolder, { recursive: true });
  }

  const destPath = path.join(destFolder, fileName);

  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      attempt++;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.startsWith('image/')) {
        throw new Error(`Invalid content type: ${contentType}. Expected image/`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      fs.writeFileSync(destPath, buffer);
      return destPath;
      
    } catch (error) {
      console.warn(`[DOWNLOAD ATTEMPT ${attempt} FAILED] Url: ${url} - Error: ${error.message}`);
      if (attempt >= MAX_RETRIES) {
        throw new Error(`Failed to download after ${MAX_RETRIES} attempts: ${error.message}`);
      }
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
}

/**
 * Downloads a list of image tasks concurrently using p-limit.
 * @param {Array<Object>} tasks - List of tasks: { url, fileName }
 * @param {string} destFolder - Destination directory
 * @param {number} concurrency - Max concurrent downloads (default 10)
 * @param {Function} onProgress - Progress callback: (success, failed, total, currentUrl, error) => {}
 * @returns {Promise<Array<Object>>} List of completed tasks with local paths or errors
 */
export async function downloadImagesBatch(tasks, destFolder, concurrency = 10, onProgress = () => {}) {
  const limit = pLimit(concurrency);
  let successCount = 0;
  let failedCount = 0;
  const total = tasks.length;

  const downloadPromises = tasks.map((task) => {
    return limit(async () => {
      try {
        const localPath = await downloadSingleImage(task.url, destFolder, task.fileName);
        successCount++;
        onProgress(successCount, failedCount, total, task.url, null);
        return {
          productId: task.productId,
          url: task.url,
          localPath,
          success: true,
        };
      } catch (error) {
        failedCount++;
        onProgress(successCount, failedCount, total, task.url, error.message);
        return {
          productId: task.productId,
          url: task.url,
          error: error.message,
          success: false,
        };
      }
    });
  });

  return Promise.all(downloadPromises);
}
