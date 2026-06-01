/**
 * FloraChemist Stock Sync Bridge
 * --------------------------------
 * Reads stock files dropped in a folder by the medical software
 * and pushes them to the website API automatically.
 *
 * Supported formats: CSV, JSON, Excel (.xlsx)
 * Run manually:   node sync-bridge.js
 * Schedule:       Use Windows Task Scheduler to run every hour
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  // Folder where the medical software drops files
  watchFolder: process.env.SYNC_FOLDER || 'C:\\StockUpdates',

  // Your website API
  apiUrl: process.env.WEBSITE_URL || 'https://www.florachemist.online',
  apiKey: process.env.SYNC_API_KEY || 'YOUR_SYNC_API_KEY_HERE',

  // Column name mappings (edit to match whatever your software exports)
  // Supports: Modern Pharma, Generics, and other pharmacy management systems
  columns: {
    id:        ['id', 'sku', 'item_code', 'code', 'product_id', 'product'],
    name:      ['name', 'product_name', 'item_name', 'medicine_name', 'description', 'product'],
    brand:     ['brand', 'manufacturer', 'company', 'mfr', 'company_name'],
    category:  ['category', 'cat', 'group', 'department', 'scheme_wise'],
    price:     ['price', 'sale_price', 'selling_price', 'rate', 'ptr'],
    mrp:       ['mrp', 'max_price', 'maximum_retail_price'],
    stock:     ['stock', 'qty', 'quantity', 'balance', 'closing_stock', 'available'],
    packSize:  ['pack_size', 'packsize', 'pack', 'packing', 'unit'],
  },
};
// ─────────────────────────────────────────────────────────────────────────────

const log = (msg) => {
  const ts = new Date().toLocaleString('en-IN');
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(path.join(__dirname, 'sync-log.txt'), line + '\n');
  } catch {}
};

// Find a value in a row using flexible column name matching
function getCol(row, keys) {
  const rowLower = {};
  for (const k of Object.keys(row)) rowLower[k.toLowerCase().trim()] = row[k];
  for (const key of keys) {
    if (rowLower[key] !== undefined) return rowLower[key];
  }
  return undefined;
}

// Parse CSV text into array of objects
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  return lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || [];
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (vals[i] || '').replace(/^"|"$/g, '').trim();
    });
    return obj;
  });
}

// Parse JSON file (array or { products: [...] } or { stock: [...] })
function parseJSON(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.products)) return data.products;
  if (Array.isArray(data.stock)) return data.stock;
  return [];
}

// Parse Excel using xlsx library if available
function parseExcel(filePath) {
  try {
    const xlsx = require('xlsx');
    const wb = xlsx.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return xlsx.utils.sheet_to_json(sheet, { defval: '' });
  } catch {
    log('ERROR: xlsx library not installed. Run: npm install xlsx');
    return [];
  }
}

// Map raw rows to product/stock objects
function mapRows(rows) {
  const { columns: C } = CONFIG;
  return rows
    .map(row => {
      const stock = getCol(row, C.stock);
      if (stock === undefined) return null;
      return {
        id:       getCol(row, C.id),
        name:     getCol(row, C.name),
        brand:    getCol(row, C.brand),
        category: getCol(row, C.category),
        price:    parseFloat(getCol(row, C.price)) || undefined,
        mrp:      parseFloat(getCol(row, C.mrp)) || undefined,
        stock:    parseInt(stock) || 0,
        packSize: getCol(row, C.packSize),
      };
    })
    .filter(Boolean);
}

// HTTP POST helper
function post(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const url = new URL(CONFIG.apiUrl);
    const isHttps = url.protocol === 'https:';
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': CONFIG.apiKey,
      },
    };
    const req = (isHttps ? https : http).request(options, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Determine if we should do full product sync or stock-only
function isStockOnly(rows) {
  const { columns: C } = CONFIG;
  return rows.every(r => !getCol(r, C.name) || !getCol(r, C.price));
}

async function processFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  log(`Processing: ${filePath}`);

  let rows = [];
  try {
    if (ext === '.csv') {
      rows = parseCSV(fs.readFileSync(filePath, 'utf8'));
    } else if (ext === '.json') {
      rows = parseJSON(fs.readFileSync(filePath, 'utf8'));
    } else if (ext === '.xlsx' || ext === '.xls') {
      rows = parseExcel(filePath);
    } else {
      log(`SKIP: Unsupported file type ${ext}`);
      return;
    }
  } catch (e) {
    log(`ERROR reading file: ${e.message}`);
    return;
  }

  if (!rows.length) { log('SKIP: File is empty'); return; }

  const mapped = mapRows(rows);
  if (!mapped.length) { log('SKIP: Could not map any rows. Check column names in CONFIG.'); return; }

  log(`Mapped ${mapped.length} items`);

  // For large files (>1000 items), use batch endpoint with chunking
  const BATCH_SIZE = 5000;
  let totalCreated = 0, totalUpdated = 0, totalErrors = 0;

  if (mapped.length > 1000) {
    log(`Large file detected (${mapped.length} items). Using batch sync with ${BATCH_SIZE}-item chunks...`);
    
    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      const chunk = mapped.slice(i, i + BATCH_SIZE);
      const chunkNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalChunks = Math.ceil(mapped.length / BATCH_SIZE);
      
      log(`Syncing chunk ${chunkNum}/${totalChunks} (${chunk.length} items)...`);
      
      const result = await post('/api/sync/batch', { products: chunk });
      
      if (result.status === 200) {
        const b = result.body;
        totalCreated += b.created || 0;
        totalUpdated += b.updated || 0;
        totalErrors += b.errors?.length || 0;
        log(`  Chunk ${chunkNum}: created=${b.created} updated=${b.updated} errors=${b.errors?.length || 0} (${b.duration})`);
      } else {
        log(`  ERROR in chunk ${chunkNum}: ${JSON.stringify(result.body)}`);
        totalErrors += chunk.length;
      }
    }
    
    log(`BATCH COMPLETE: created=${totalCreated} updated=${totalUpdated} total_errors=${totalErrors}`);
  } else {
    // For smaller files, use stock-only or full product sync
    let result;
    if (isStockOnly(mapped)) {
      log('Mode: Stock-only update');
      result = await post('/api/sync/stock', { stock: mapped });
    } else {
      log('Mode: Full product sync');
      result = await post('/api/sync/products', { products: mapped });
    }

    if (result.status === 200) {
      const b = result.body;
      totalCreated = b.created || 0;
      totalUpdated = b.updated || 0;
      totalErrors = b.errors?.length || 0;
      log(`SUCCESS: created=${totalCreated} updated=${totalUpdated} errors=${totalErrors}`);
    } else {
      log(`ERROR from API: ${JSON.stringify(result.body)}`);
      return;
    }
  }

  // Move file to processed folder to avoid re-processing
  const processedDir = path.join(CONFIG.watchFolder, 'processed');
  if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true });
  const dest = path.join(processedDir, `${Date.now()}_${path.basename(filePath)}`);
  fs.renameSync(filePath, dest);
  log(`Moved to: ${dest}`);
}

async function run() {
  log('=== FloraChemist Sync Bridge started ===');

  if (!fs.existsSync(CONFIG.watchFolder)) {
    log(`ERROR: Watch folder not found: ${CONFIG.watchFolder}`);
    log('Create the folder or update SYNC_FOLDER in config.');
    process.exit(1);
  }

  const files = fs.readdirSync(CONFIG.watchFolder)
    .filter(f => ['.csv', '.json', '.xlsx', '.xls'].includes(path.extname(f).toLowerCase()))
    .map(f => path.join(CONFIG.watchFolder, f));

  if (!files.length) {
    log('No new files found in folder. Nothing to sync.');
    return;
  }

  for (const file of files) {
    await processFile(file);
  }

  log('=== Sync complete ===\n');
}

run().catch(e => { log(`FATAL: ${e.message}`); process.exit(1); });
