import mysql from 'mysql2/promise';
import { db as dbConfig } from '../config/index.js';
import { dbLogger } from '../logger/index.js';

let pool;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
    dbLogger.info('MySQL pool created', { host: dbConfig.host, database: dbConfig.database });
  }
  return pool;
}

/** Execute a query and return rows */
export async function query(sql, params = []) {
  const p = getPool();
  try {
    const [rows] = await p.execute(sql, params);
    return rows;
  } catch (err) {
    dbLogger.error('Query error', { sql: sql.slice(0, 200), err: err.message });
    throw err;
  }
}

/** Batch insert using multi-row VALUES syntax for performance */
export async function batchInsert(table, columns, rows, { ignore = false, onDuplicateUpdate = null } = {}) {
  if (!rows.length) return { affectedRows: 0 };
  const p = getPool();
  const conn = await p.getConnection();
  let totalAffected = 0;
  const CHUNK = 1000;
  try {
    await conn.beginTransaction();
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const placeholders = chunk.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
      const values = chunk.flat();
      const ignoreSql = ignore ? 'IGNORE ' : '';
      let sql = `INSERT ${ignoreSql}INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(',')}) VALUES ${placeholders}`;
      if (onDuplicateUpdate) {
        const updateClause = onDuplicateUpdate.map(c => `\`${c}\`=VALUES(\`${c}\`)`).join(',');
        sql += ` ON DUPLICATE KEY UPDATE ${updateClause}`;
      }
      const [result] = await conn.execute(sql, values);
      totalAffected += result.affectedRows;
    }
    await conn.commit();
    return { affectedRows: totalAffected };
  } catch (err) {
    await conn.rollback();
    dbLogger.error('Batch insert error', { table, err: err.message });
    throw err;
  } finally {
    conn.release();
  }
}

/** Batch update using CASE WHEN for performance */
export async function batchUpdate(table, idColumn, updates, columns) {
  if (!updates.length) return;
  const p = getPool();
  const conn = await p.getConnection();
  const CHUNK = 500;
  try {
    await conn.beginTransaction();
    for (let i = 0; i < updates.length; i += CHUNK) {
      const chunk = updates.slice(i, i + CHUNK);
      const ids = chunk.map(u => u[idColumn]);
      const setClauses = columns.map(col => {
        const cases = chunk.map(() => `WHEN ? THEN ?`).join(' ');
        return `\`${col}\` = CASE \`${idColumn}\` ${cases} END`;
      });
      const params = [];
      for (const col of columns) {
        for (const u of chunk) {
          params.push(u[idColumn], u[col] ?? null);
        }
      }
      const inList = ids.map(() => '?').join(',');
      params.push(...ids);
      const sql = `UPDATE \`${table}\` SET ${setClauses.join(', ')} WHERE \`${idColumn}\` IN (${inList})`;
      await conn.execute(sql, params);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    dbLogger.error('Batch update error', { table, err: err.message });
    throw err;
  } finally {
    conn.release();
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
