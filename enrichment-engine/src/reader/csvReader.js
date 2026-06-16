import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import logger from '../logger/index.js';

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

/**
 * Stream-read a CSV file row-by-row (memory efficient for 200k+ rows).
 */
export async function streamCsv(filePath, columnMap, onRow, options = {}) {
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
      logger.debug('CSV headers detected', { file: filePath, headers: headers.slice(0, 12) });
      continue;
    }

    const vals = parseCsvLine(line).map(v => v.replace(/^"|"$/g, ''));
    const obj = {};
    for (const [idx, field] of Object.entries(headerIndexMap)) {
      const val = (vals[Number(idx)] ?? '').trim();
      if (!val) continue;
      if (!obj[field] || (field === 'pack_size' && val.length > obj[field].length)) {
        obj[field] = val;
      }
    }
    if (Object.values(obj).every(v => !v)) continue;

    rowCount++;
    const stop = await onRow(obj, rowCount);
    if (onProgress && rowCount % 10000 === 0) onProgress(rowCount);
    if (stop === false || (maxRows && rowCount >= maxRows)) break;
  }

  logger.info(`CSV read complete: ${rowCount} rows from ${filePath}`);
  return rowCount;
}

export async function streamDataFile(filePath, columnMap, onRow, options = {}) {
  if (filePath.toLowerCase().endsWith('.csv')) {
    return streamCsv(filePath, columnMap, onRow, options);
  }
  const { streamExcel } = await import('./excelReader.js');
  return streamExcel(filePath, columnMap, onRow, options);
}
