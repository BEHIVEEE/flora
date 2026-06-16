/**
 * Stream-read product list files preserving ALL original columns for enriched export.
 */
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import ExcelJS from 'exceljs';

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
      continue;
    }
    if (c === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function buildHeaderIndexMap(headers, columnMap) {
  const lowerMap = {};
  for (const [target, sources] of Object.entries(columnMap)) {
    const list = Array.isArray(sources) ? sources : [sources];
    for (const source of list) {
      lowerMap[String(source).toLowerCase().trim()] = target;
    }
  }
  const headerIndexMap = {};
  headers.forEach((h, i) => {
    const field = lowerMap[h.toLowerCase().trim()];
    if (field) headerIndexMap[i] = field;
  });
  return headerIndexMap;
}

function cellToString(cell) {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object' && cell.text !== undefined) return String(cell.text).trim();
  if (typeof cell === 'object' && cell.result !== undefined) return String(cell.result).trim();
  return String(cell).trim();
}

/**
 * Stream product list — yields { raw, mapped, rowNum } per row.
 * `raw` keeps every original column; `mapped` has normalized internal fields.
 */
export async function streamProductList(filePath, columnMap, onRow, options = {}) {
  if (filePath.toLowerCase().endsWith('.csv')) {
    return streamProductListCsv(filePath, columnMap, onRow, options);
  }
  return streamProductListExcel(filePath, columnMap, onRow, options);
}

async function streamProductListCsv(filePath, columnMap, onRow, options = {}) {
  const { onProgress, maxRows } = options;
  let headers = null;
  let headerIndexMap = {};
  let rowCount = 0;

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!headers) {
      headers = parseCsvLine(line).map(h => h.replace(/^"|"$/g, ''));
      headerIndexMap = buildHeaderIndexMap(headers, columnMap);
      continue;
    }

    const vals = parseCsvLine(line).map(v => v.replace(/^"|"$/g, ''));
    const raw = {};
    headers.forEach((h, i) => { raw[h] = vals[i] ?? ''; });

    const mapped = mapRowFromIndices(headers, vals, headerIndexMap);
    if (Object.values(mapped).every(v => !v)) continue;

    rowCount++;
    const stop = await onRow({ raw, mapped, rowNum: rowCount, headers });
    if (onProgress && rowCount % 5000 === 0) onProgress(rowCount);
    if (stop === false || (maxRows && rowCount >= maxRows)) break;
  }

  return { rowCount, headers: headers || [] };
}

async function streamProductListExcel(filePath, columnMap, onRow, options = {}) {
  const { onProgress, maxRows, sheetIndex = 0 } = options;
  const inputStream = createReadStream(filePath);
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(inputStream, {
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    styles: 'ignore',
    entries: 'emit',
    worksheets: 'emit',
  });

  let headers = null;
  let headerIndexMap = {};
  let rowCount = 0;
  let sheetCount = 0;
  let stopped = false;
  let chain = Promise.resolve();

  const abort = () => {
    if (stopped) return;
    stopped = true;
    try { inputStream.destroy(); } catch { /* ignore */ }
  };

  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      chain.then(() => {
        settled = true;
        if (err) reject(err);
        else resolve();
      }).catch(reject);
    };

    workbookReader.on('worksheet', worksheet => {
      if (stopped) return;
      if (sheetCount !== sheetIndex) { sheetCount++; return; }
      sheetCount++;

      worksheet.on('row', row => {
        if (stopped) return;
        const values = row.values;

        chain = chain.then(async () => {
          if (stopped) return;

          if (!headers) {
            headers = [];
            for (let i = 1; i < values.length; i++) {
              headers.push(cellToString(values[i]));
            }
            headerIndexMap = buildHeaderIndexMap(headers, columnMap);
            return;
          }

          const vals = [];
          for (let i = 1; i <= headers.length; i++) {
            vals.push(cellToString(values[i]));
          }
          const raw = {};
          headers.forEach((h, i) => { raw[h] = vals[i] ?? ''; });

          const mapped = mapRowFromIndices(headers, vals, headerIndexMap);
          if (Object.values(mapped).every(v => !v)) return;

          rowCount++;
          const stop = await onRow({ raw, mapped, rowNum: rowCount, headers });
          if (onProgress && rowCount % 5000 === 0) onProgress(rowCount);
          if (stop === false || (maxRows && rowCount >= maxRows)) abort();
        }).catch(err => { abort(); finish(err); });
      });

      worksheet.on('error', finish);
    });

    workbookReader.on('end', () => finish());
    workbookReader.on('error', finish);
    workbookReader.read();
  });

  return { rowCount, headers: headers || [] };
}

function mapRowFromIndices(headers, vals, headerIndexMap) {
  const mapped = {};
  for (const [idx, field] of Object.entries(headerIndexMap)) {
    const val = (vals[Number(idx)] ?? '').trim();
    if (!val) continue;
    if (!mapped[field] || (field === 'pack_size' && val.length > mapped[field].length)) {
      mapped[field] = val;
    }
  }
  return mapped;
}
