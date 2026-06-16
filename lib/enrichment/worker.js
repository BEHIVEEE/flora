import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { query } from '../mysql.js';
import { normalizeName, normalizeBrand, normalizePackSize, computeMatchScore, fuzzyMatchProduct } from './matcher.js';
import { downloadImagesBatch } from './downloader.js';
import { uploadLocalImage } from './cloudinary.js';

// Singleton instance to track active background job
let activeJob = null;

export class EnrichmentWorker {
  static getActiveJob() {
    return activeJob;
  }

  static async start(jobId) {
    if (activeJob && activeJob.status === 'processing') {
      throw new Error('An enrichment job is already running');
    }

    activeJob = {
      id: jobId,
      status: 'processing',
      totalProducts: 0,
      processedProducts: 0,
      matchedCount: 0,
      reviewCount: 0,
      unmatchedCount: 0,
      imagesDownloaded: 0,
      imagesFailed: 0,
      logs: [],
      error: null
    };

    // Run asynchronously
    this.run(jobId).catch(async (error) => {
      console.error('[WORKER FATAL ERROR]', error);
      if (activeJob) {
        activeJob.status = 'failed';
        activeJob.error = error.message;
      }
      try {
        await query(
          'UPDATE enrichment_jobs SET status = "failed", error_message = ?, updated_at = NOW() WHERE id = ?',
          [error.message, jobId]
        );
        await this.log(jobId, 'ERROR', `Job failed with fatal error: ${error.message}`);
      } catch (dbError) {
        console.error('Failed to log job failure to database', dbError);
      }
    });

    return activeJob;
  }

  static async stop(jobId) {
    if (activeJob && activeJob.id === jobId && activeJob.status === 'processing') {
      activeJob.status = 'failed';
      activeJob.error = 'Job stopped by administrator';
      await query(
        'UPDATE enrichment_jobs SET status = "failed", error_message = "Stopped by administrator", updated_at = NOW() WHERE id = ?',
        [jobId]
      );
      await this.log(jobId, 'WARN', 'Job was manually stopped by administrator');
      return true;
    }
    return false;
  }

  static async log(jobId, level, message) {
    const timestamp = new Date().toLocaleTimeString('en-IN');
    const logLine = `[${level}] ${message}`;
    console.log(`[Job ${jobId}] ${logLine}`);
    
    if (activeJob && activeJob.id === jobId) {
      activeJob.logs.push({ level, message, time: timestamp });
      if (activeJob.logs.length > 500) {
        activeJob.logs.shift(); // keep log buffer manageable
      }
    }

    try {
      await query(
        'INSERT INTO enrichment_logs (job_id, level, message) VALUES (?, ?, ?)',
        [jobId, level, message]
      );
    } catch (e) {
      console.error('Failed to save log to database', e);
    }
  }

  static parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  static async run(jobId) {
    const basePath = process.cwd();
    const downloadsFolder = path.join(basePath, 'public', 'images', 'pending_enrichment');
    const reportsFolder = path.join(basePath, 'public', 'reports');

    await query(
      'INSERT INTO enrichment_jobs (id, status, total_products) VALUES (?, "processing", 0)',
      [jobId]
    );

    await this.log(jobId, 'INFO', 'Started product enrichment job');

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Load Image URLs Map from CSV
    // ─────────────────────────────────────────────────────────────────────────
    await this.log(jobId, 'INFO', 'Loading image URLs map...');
    const imageMap = new Map();
    const imageUrlsFile = path.join(basePath, 'data', 'June_2026_DRUGS_IMAGE_URLS.csv');
    
    if (!fs.existsSync(imageUrlsFile)) {
      throw new Error(`Required file not found: data/June_2026_DRUGS_IMAGE_URLS.csv. Run preprocessing first.`);
    }

    let rl = readline.createInterface({
      input: fs.createReadStream(imageUrlsFile),
      crlfDelay: Infinity
    });

    let isHeader = true;
    let idIdx = 0, nameIdx = 1, urlIdx = 2;

    for await (const line of rl) {
      if (!line.trim()) continue;
      const cells = this.parseCSVLine(line);
      if (isHeader) {
        idIdx = cells.findIndex(c => c.toLowerCase() === 'product id');
        nameIdx = cells.findIndex(c => c.toLowerCase() === 'product name');
        urlIdx = cells.findIndex(c => c.toLowerCase() === 'image url');
        if (idIdx === -1 || urlIdx === -1) {
          throw new Error('Image URLs CSV is missing Product ID or Image URL columns');
        }
        isHeader = false;
        continue;
      }
      const prodId = cells[idIdx];
      const imageUrl = cells[urlIdx];
      if (prodId && imageUrl) {
        imageMap.set(prodId, imageUrl);
      }
    }
    await this.log(jobId, 'INFO', `Successfully loaded ${imageMap.size} image mappings`);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Staging Catalog Products (Dataset B) in MySQL
    // ─────────────────────────────────────────────────────────────────────────
    const [{ count: catalogCount }] = await query('SELECT COUNT(*) as count FROM catalog_products');
    if (catalogCount === 0) {
      await this.log(jobId, 'INFO', 'MySQL catalog_products is empty. Initializing catalog imports...');
      await this.importCatalogFile(jobId, 'data/June_2026_DRUGS_DATA_PART_1.csv', imageMap);
      await this.importCatalogFile(jobId, 'data/June_2026_DRUGS_DATA_PART_2.csv', imageMap);
      const [{ count: newCatalogCount }] = await query('SELECT COUNT(*) as count FROM catalog_products');
      await this.log(jobId, 'SUCCESS', `Catalog staging completed. Total staged catalog products: ${newCatalogCount}`);
    } else {
      await this.log(jobId, 'INFO', `Staged catalog products found in MySQL: ${catalogCount}. Skipping catalog import.`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Load Prompt RMS Products (Dataset A) & Match
    // ─────────────────────────────────────────────────────────────────────────
    const sourceFile = path.join(basePath, 'data', 'ProductList.csv');
    if (!fs.existsSync(sourceFile)) {
      throw new Error(`Source file not found: data/ProductList.csv. Run preprocessing first.`);
    }

    // Count rows first to calculate progress total
    await this.log(jobId, 'INFO', 'Counting source products for progress tracking...');
    let totalLines = 0;
    rl = readline.createInterface({
      input: fs.createReadStream(sourceFile),
      crlfDelay: Infinity
    });
    for await (const line of rl) {
      if (line.trim()) totalLines++;
    }
    const totalProducts = Math.max(0, totalLines - 1); // subtract header
    activeJob.totalProducts = totalProducts;
    await query('UPDATE enrichment_jobs SET total_products = ? WHERE id = ?', [totalProducts, jobId]);
    await this.log(jobId, 'INFO', `Total products to process: ${totalProducts}`);

    // Now start matching
    await this.log(jobId, 'INFO', 'Matching source products against staging catalog...');
    rl = readline.createInterface({
      input: fs.createReadStream(sourceFile),
      crlfDelay: Infinity
    });

    isHeader = true;
    let nameCol = -1, mfrCol = -1, packCol = -1, mrpCol = -1, stockCol = -1, codeCol = -1, barcodeCol = -1;

    for await (const line of rl) {
      if (activeJob.status === 'failed') {
        return; // job was stopped
      }

      if (!line.trim()) continue;
      const cells = this.parseCSVLine(line);
      
      if (isHeader) {
        nameCol = cells.findIndex(c => c.toLowerCase() === 'product name');
        mfrCol = cells.findIndex(c => c.toLowerCase() === 'company');
        packCol = cells.findIndex(c => c.toLowerCase() === 'packing');
        mrpCol = cells.findIndex(c => c.toLowerCase() === 'mrp');
        stockCol = cells.findIndex(c => c.toLowerCase() === 'totalstock');
        codeCol = cells.findIndex(c => c.toLowerCase() === 'product code');
        barcodeCol = cells.findIndex(c => c.toLowerCase() === 'barcode');
        
        if (nameCol === -1 || codeCol === -1) {
          throw new Error('Source CSV is missing Product Name or Product Code columns');
        }
        isHeader = false;
        continue;
      }

      const productCode = cells[codeCol];
      const productName = cells[nameCol];
      const company = mfrCol !== -1 ? cells[mfrCol] : '';
      const packing = packCol !== -1 ? cells[packCol] : '';
      const mrp = mrpCol !== -1 ? parseFloat(cells[mrpCol]) || 0.0 : 0.0;
      const stock = stockCol !== -1 ? parseInt(cells[stockCol], 10) || 0 : 0;
      const barcode = barcodeCol !== -1 ? cells[barcodeCol] : '';

      const sourceProduct = {
        id: String(productCode),
        product_name: productName,
        manufacturer: company,
        pack_size: packing,
        mrp,
        stock,
        barcode
      };

      // Ensure the product exists in the main products table (so we can update it later)
      await this.ensureMainProductExists(sourceProduct);

      // Execute matching logic
      await this.matchSingleProduct(jobId, sourceProduct);

      activeJob.processedProducts++;
      if (activeJob.processedProducts % 100 === 0) {
        await query(
          `UPDATE enrichment_jobs SET 
            processed_products = ?, 
            matched_count = ?, 
            review_count = ?, 
            unmatched_count = ?, 
            updated_at = NOW() 
           WHERE id = ?`,
          [
            activeJob.processedProducts,
            activeJob.matchedCount,
            activeJob.reviewCount,
            activeJob.unmatchedCount,
            jobId
          ]
        );
      }
    }

    // Final matching sync
    await query(
      `UPDATE enrichment_jobs SET 
        processed_products = ?, 
        matched_count = ?, 
        review_count = ?, 
        unmatched_count = ?, 
        updated_at = NOW() 
       WHERE id = ?`,
      [
        activeJob.processedProducts,
        activeJob.matchedCount,
        activeJob.reviewCount,
        activeJob.unmatchedCount,
        jobId
      ]
    );

    await this.log(
      jobId, 
      'SUCCESS', 
      `Matching step finished. Matches: ${activeJob.matchedCount}, Review required: ${activeJob.reviewCount}, Unmatched: ${activeJob.unmatchedCount}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: Process Images for Auto-Accepted Matches
    // ─────────────────────────────────────────────────────────────────────────
    await this.log(jobId, 'INFO', 'Downloading and uploading images for auto-accepted matches...');
    const autoMatches = await query(
      'SELECT * FROM enrichment_matches WHERE job_id = ? AND review_status = "auto_accept" AND matched_image_urls != ""',
      [jobId]
    );

    await this.log(jobId, 'INFO', `Found ${autoMatches.length} auto-accepted products with images to enrich.`);

    if (autoMatches.length > 0) {
      if (!fs.existsSync(downloadsFolder)) {
        fs.mkdirSync(downloadsFolder, { recursive: true });
      }

      // Concurrency upload limit is 5. We process them sequentially or chunked.
      // We will loop through them and download then upload.
      for (let i = 0; i < autoMatches.length; i++) {
        if (activeJob.status === 'failed') return; // stopped

        const match = autoMatches[i];
        const rawUrls = match.matched_image_urls.split('|').map(u => u.trim()).filter(Boolean);
        const imageUrl = rawUrls[0]; // Take primary image

        if (!imageUrl) continue;

        const fileExt = path.extname(new URL(imageUrl).pathname) || '.jpg';
        const fileName = `${match.source_product_id}${fileExt}`;
        const localPath = path.join(downloadsFolder, fileName);

        try {
          // Download locally
          await this.downloadFile(imageUrl, localPath);
          
          // Upload to Cloudinary
          const cloudinaryUrl = await uploadLocalImage(localPath);
          activeJob.imagesDownloaded++;

          // Save Cloudinary URL in the database
          await query(
            'UPDATE products SET description = ?, composition = ?, category = ?, image_url = ? WHERE id = ?',
            [match.matched_description, match.matched_composition, match.matched_category, cloudinaryUrl, match.source_product_id]
          );

          // Clean up local downloaded file to save disk space
          if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
          }

          if (activeJob.imagesDownloaded % 20 === 0) {
            await query(
              'UPDATE enrichment_jobs SET images_downloaded = ?, updated_at = NOW() WHERE id = ?',
              [activeJob.imagesDownloaded, jobId]
            );
          }
        } catch (err) {
          activeJob.imagesFailed++;
          await this.log(jobId, 'WARN', `Failed to enrich image for product ${match.source_name}: ${err.message}`);
          
          // Fallback: update texts in DB even if image upload failed
          await query(
            'UPDATE products SET description = ?, composition = ?, category = ? WHERE id = ?',
            [match.matched_description, match.matched_composition, match.matched_category, match.source_product_id]
          );
        }
      }
    }

    // Sync final image counts
    await query(
      'UPDATE enrichment_jobs SET images_downloaded = ?, images_failed = ?, updated_at = NOW() WHERE id = ?',
      [activeJob.imagesDownloaded, activeJob.imagesFailed, jobId]
    );

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: Generate Report CSVs
    // ─────────────────────────────────────────────────────────────────────────
    await this.log(jobId, 'INFO', 'Generating report CSV files...');
    if (!fs.existsSync(reportsFolder)) {
      fs.mkdirSync(reportsFolder, { recursive: true });
    }

    await this.generateReportCSV(jobId, 'auto_accept', path.join(reportsFolder, 'matched_products.csv'));
    await this.generateReportCSV(jobId, 'manual_review', path.join(reportsFolder, 'review_required.csv'));
    await this.generateReportCSV(jobId, 'rejected', path.join(reportsFolder, 'unmatched_products.csv'));

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 6: Mark Complete
    // ─────────────────────────────────────────────────────────────────────────
    activeJob.status = 'completed';
    await query(
      'UPDATE enrichment_jobs SET status = "completed", updated_at = NOW() WHERE id = ?',
      [jobId]
    );
    await this.log(jobId, 'SUCCESS', 'Product enrichment job completed successfully! Reports are ready for download.');
  }

  static async importCatalogFile(jobId, relativePath, imageMap) {
    const basePath = process.cwd();
    const filePath = path.join(basePath, relativePath);
    if (!fs.existsSync(filePath)) {
      await this.log(jobId, 'WARN', `Staging file not found: ${relativePath}. Skipping.`);
      return;
    }

    await this.log(jobId, 'INFO', `Importing staged data from ${relativePath}...`);
    let count = 0;
    let chunk = [];
    const CHUNK_SIZE = 1000;

    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity
    });

    let isHeader = true;
    let idCol = -1, nameCol = -1, mfrCol = -1, compCol = -1, descCol = -1, catCol = -1, packCol = -1;

    for await (const line of rl) {
      if (!line.trim()) continue;
      const cells = this.parseCSVLine(line);
      
      if (isHeader) {
        idCol = cells.findIndex(c => c.toLowerCase() === 'product id');
        nameCol = cells.findIndex(c => c.toLowerCase() === 'product name');
        mfrCol = cells.findIndex(c => c.toLowerCase() === 'marketer');
        compCol = cells.findIndex(c => c.toLowerCase() === 'composition');
        descCol = cells.findIndex(c => c.toLowerCase() === 'introduction');
        catCol = cells.findIndex(c => c.toLowerCase() === 'medicine_type');
        packCol = cells.findIndex(c => c.toLowerCase() === 'packaging detail');
        isHeader = false;
        continue;
      }

      const prodId = cells[idCol];
      const prodName = cells[nameCol];
      const manufacturer = mfrCol !== -1 ? cells[mfrCol] : '';
      const composition = compCol !== -1 ? cells[compCol] : '';
      const description = descCol !== -1 ? cells[descCol] : '';
      const category = catCol !== -1 ? cells[catCol] : 'drugs';
      const packSize = packCol !== -1 ? cells[packCol] : '';
      
      // Look up image URLs mapping
      const image_urls = imageMap.get(prodId) || '';

      const normalized_name = normalizeName(prodName);
      const normalized_manufacturer = normalizeBrand(manufacturer);

      chunk.push([
        prodId,
        prodName,
        normalized_name,
        manufacturer,
        normalized_manufacturer,
        composition,
        description,
        category,
        packSize,
        image_urls
      ]);

      if (chunk.length >= CHUNK_SIZE) {
        await query(
          `INSERT IGNORE INTO catalog_products 
           (product_id, product_name, normalized_name, manufacturer, normalized_manufacturer, composition, description, category, pack_size, image_urls) 
           VALUES ?`,
          [chunk]
        );
        count += chunk.length;
        chunk = [];
      }
    }

    if (chunk.length > 0) {
      await query(
        `INSERT IGNORE INTO catalog_products 
         (product_id, product_name, normalized_name, manufacturer, normalized_manufacturer, composition, description, category, pack_size, image_urls) 
         VALUES ?`,
        [chunk]
      );
      count += chunk.length;
    }

    await this.log(jobId, 'INFO', `Staged ${count} products from ${relativePath}`);
  }

  static async ensureMainProductExists(source) {
    const rows = await query('SELECT id FROM products WHERE id = ?', [source.id]);
    if (rows.length === 0) {
      // Create stub product
      await query(
        `INSERT INTO products 
         (id, product_name, manufacturer, mrp, stock, pack_size, barcode) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [source.id, source.product_name, source.manufacturer, source.mrp, source.stock, source.pack_size, source.barcode]
      );
    }
  }

  static async matchSingleProduct(jobId, source) {
    const srcNormName = normalizeName(source.product_name);
    const srcNormMfr = normalizeBrand(source.manufacturer);
    const srcNormPack = normalizePackSize(source.pack_size);

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 1: Barcode match (if source product has a barcode)
    // ─────────────────────────────────────────────────────────────────────────
    if (source.barcode && source.barcode.trim()) {
      const barcodeRows = await query(
        'SELECT * FROM catalog_products WHERE product_id = ? OR product_name LIKE ?',
        [source.barcode, `%${source.barcode}%`]
      );
      if (barcodeRows.length > 0) {
        const catalog = barcodeRows[0];
        activeJob.matchedCount++;
        await this.insertMatch(jobId, source, catalog, 100.0, 'auto_accept');
        return;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 2: Exact Name + Manufacturer + Pack Size match
    // ─────────────────────────────────────────────────────────────────────────
    const exactRows = await query(
      'SELECT * FROM catalog_products WHERE normalized_name = ? AND normalized_manufacturer = ?',
      [srcNormName, srcNormMfr]
    );

    if (exactRows.length > 0) {
      // Check if pack size also matches exactly
      const perfectMatch = exactRows.find(row => normalizePackSize(row.pack_size) === srcNormPack);
      if (perfectMatch) {
        activeJob.matchedCount++;
        await this.insertMatch(jobId, source, perfectMatch, 100.0, 'auto_accept');
        return;
      }
      
      // Exact name and brand matches, but pack size is different
      const primaryCatalog = exactRows[0];
      activeJob.reviewCount++;
      await this.insertMatch(jobId, source, primaryCatalog, 88.0, 'manual_review');
      return;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 3: Fuzzy Matching with Brand Blocking
    // ─────────────────────────────────────────────────────────────────────────
    const candidates = await query(
      'SELECT * FROM catalog_products WHERE normalized_manufacturer = ?',
      [srcNormMfr]
    );

    if (candidates.length > 0) {
      const matchResult = fuzzyMatchProduct(source, candidates);
      if (matchResult) {
        if (matchResult.reviewStatus === 'auto_accept') {
          activeJob.matchedCount++;
        } else if (matchResult.reviewStatus === 'manual_review') {
          activeJob.reviewCount++;
        } else {
          activeJob.unmatchedCount++;
        }
        await this.insertMatch(
          jobId,
          source,
          matchResult.catalog,
          matchResult.confidence,
          matchResult.reviewStatus
        );
        return;
      }
    }

    // No matches found
    activeJob.unmatchedCount++;
    await this.insertMatch(jobId, source, null, 0.0, 'rejected');
  }

  static async insertMatch(jobId, source, catalog, confidence, reviewStatus) {
    await query(
      `INSERT INTO enrichment_matches 
       (job_id, source_product_id, source_name, source_manufacturer, source_pack_size, source_barcode,
        matched_catalog_id, matched_name, matched_manufacturer, matched_pack_size, 
        matched_composition, matched_description, matched_category, matched_image_urls,
        confidence_score, review_status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        jobId,
        source.id,
        source.product_name,
        source.manufacturer,
        source.pack_size,
        source.barcode,
        catalog ? catalog.product_id : null,
        catalog ? catalog.product_name : null,
        catalog ? catalog.manufacturer : null,
        catalog ? catalog.pack_size : null,
        catalog ? catalog.composition : null,
        catalog ? catalog.description : null,
        catalog ? catalog.category : null,
        catalog ? catalog.image_urls : null,
        confidence,
        reviewStatus
      ]
    );
  }

  static async downloadFile(url, destPath) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(destPath, buffer);
  }

  static async generateReportCSV(jobId, reviewStatus, destPath) {
    const rows = await query(
      `SELECT 
        source_product_id AS 'Product Code',
        source_name AS 'Product Name',
        source_manufacturer AS 'Manufacturer',
        source_pack_size AS 'Pack Size',
        source_barcode AS 'Barcode',
        matched_name AS 'Matched Catalog Name',
        confidence_score AS 'Confidence Score',
        matched_image_urls AS 'Image URLs'
       FROM enrichment_matches 
       WHERE job_id = ? AND review_status = ?`,
      [jobId, reviewStatus]
    );

    if (rows.length === 0) {
      fs.writeFileSync(destPath, 'No records found\n');
      return;
    }

    const headers = Object.keys(rows[0]);
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
    };

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map(row => headers.map(h => escapeCsv(row[h])).join(','))
    ].join('\n');

    fs.writeFileSync(destPath, csvContent, 'utf8');
  }
}
