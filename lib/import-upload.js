/** Trim import rows to essential fields before chunked upload (smaller payloads, fewer timeouts). */

export function slimImportRow(row) {
  if (!row || typeof row !== 'object') return row;
  const desc = row.description != null ? String(row.description) : '';
  return {
    name: row.name,
    brand: row.brand,
    category: row.category,
    subcategory: row.subcategory,
    price: row.price,
    mrp: row.mrp,
    stock: row.stock,
    packSize: row.packSize || row.pack_size,
    description: desc.length > 500 ? desc.slice(0, 500) : desc,
    prescription: row.prescription,
    imageUrl: row.imageUrl || row.image,
    externalId: row.externalId || row.productCode,
    productCode: row.productCode,
    manufacturer: row.manufacturer,
  };
}

export function slimImportRows(rows) {
  return Array.isArray(rows) ? rows.map(slimImportRow) : [];
}

function estimateJsonBytes(obj) {
  try {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(JSON.stringify(obj)).length;
    }
  } catch {
    /* ignore */
  }
  return JSON.stringify(obj).length * 2;
}

/** Pick upload batch size based on estimated JSON payload size. */
export function pickUploadChunkSize(rows, preferred = 75) {
  if (!rows?.length) return preferred;
  const sample = rows.slice(0, Math.min(5, rows.length));
  const bytes = estimateJsonBytes(sample);
  const perRow = Math.max(bytes / sample.length, 200);
  if (perRow > 8000) return 15;
  if (perRow > 4000) return 25;
  if (perRow > 2000) return 40;
  if (perRow > 1000) return 50;
  return preferred;
}
