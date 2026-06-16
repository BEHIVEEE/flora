import mysql from 'mysql2/promise';

let pool;

export function getMysqlPool() {
  if (!pool) {
    const config = {
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'chemistshop',
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    };

    console.log(`[MYSQL] Initializing connection pool to ${config.user}@${config.host}:${config.port}/${config.database}`);
    pool = mysql.createPool(config);
  }
  return pool;
}

export async function query(sql, params) {
  const connectionPool = getMysqlPool();
  try {
    const [results] = await connectionPool.execute(sql, params);
    return results;
  } catch (error) {
    console.error(`[MYSQL ERROR] Query failed: "${sql}" - Error: ${error.message}`);
    throw error;
  }
}
