import ExcelJS from 'exceljs';
import { createReadStream } from 'fs';
import logger from '../logger/index.js';

/**
 * Stream-reads an Excel file and calls `onRow(rowObj, rowIndex)` for each data row.
 * Return false from onRow to abort early (destroys the read stream).
 */
export async function streamExcel(filePath, columnMap, onRow, options = {}) {
  const { sheetIndex = 0, onProgress } = options;
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

  function buildRowObj(values) {
    const obj = {};
    for (const [colIdx, field] of Object.entries(headerIndexMap)) {
      const cell = values[Number(colIdx)];
      let val = '';
      if (cell === null || cell === undefined) {
        val = '';
      } else if (typeof cell === 'object' && cell.text !== undefined) {
        val = cell.text;
      } else if (typeof cell === 'object' && cell.result !== undefined) {
        val = cell.result;
      } else {
        val = cell;
      }
      val = val === null || val === undefined ? '' : String(val).trim();
      if (!val) continue;
      if (!obj[field] || (field === 'pack_size' && val.length > obj[field].length)) {
        obj[field] = val;
      }
    }
    return obj;
  }

  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      chain
        .then(() => {
          settled = true;
          if (err) reject(err);
          else resolve();
        })
        .catch(reject);
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
              const cell = values[i];
              const header = cell?.text ?? cell ?? '';
              headers.push(String(header).trim());
            }
            const lowerMap = {};
            for (const [target, source] of Object.entries(columnMap)) {
              const sources = Array.isArray(source) ? source : [source];
              for (const s of sources) {
                lowerMap[String(s).toLowerCase().trim()] = target;
              }
            }
            for (let i = 0; i < headers.length; i++) {
              const lh = headers[i].toLowerCase();
              if (lowerMap[lh]) headerIndexMap[i + 1] = lowerMap[lh];
            }
            logger.debug('Excel headers detected', { headers, headerIndexMap });
            return;
          }

          const obj = buildRowObj(values);
          if (Object.values(obj).every(v => !v)) return;

          rowCount++;
          const stop = await onRow(obj, rowCount);
          if (onProgress && rowCount % 10000 === 0) onProgress(rowCount);
          if (stop === false) abort();
        }).catch(err => {
          abort();
          finish(err);
        });
      });

      worksheet.on('error', finish);
    });

    workbookReader.on('end', () => finish());
    workbookReader.on('error', finish);
    workbookReader.read();
  });

  logger.info(`Excel read complete: ${rowCount} rows from ${filePath}${stopped ? ' (early stop)' : ''}`);
  return rowCount;
}

export async function readExcelFull(filePath, columnMap, options = {}) {
  const rows = [];
  await streamExcel(filePath, columnMap, async (row) => { rows.push(row); }, options);
  return rows;
}

export async function readExcelRaw(filePath, options = {}) {
  const { sheetIndex = 0, maxRows } = options;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[sheetIndex];
  if (!sheet) throw new Error(`Sheet at index ${sheetIndex} not found`);

  const rows = [];
  let headers = null;
  sheet.eachRow((row) => {
    if (maxRows && rows.length >= maxRows) return;
    const vals = row.values.slice(1);
    const cellVals = vals.map(c => {
      if (c === null || c === undefined) return '';
      if (typeof c === 'object' && c.text !== undefined) return String(c.text).trim();
      if (typeof c === 'object' && c.result !== undefined) return String(c.result).trim();
      return String(c).trim();
    });

    if (!headers) { headers = cellVals; return; }
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cellVals[i] ?? ''; });
    rows.push(obj);
  });

  return { headers, rows };
}
