import mysql from 'mysql2/promise';

let pool = null;

export function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    pool = mysql.createPool({
      uri: url,
      connectionLimit: 5,
      charset: 'utf8mb4',
      timezone: 'Z',
    });
  }
  return pool;
}

export async function ensureSchema() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS trees (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(64) NOT NULL,
      name VARCHAR(100) NOT NULL DEFAULT '',
      slots JSON NOT NULL,
      edit_token_hash CHAR(64) NOT NULL,
      created_ip VARCHAR(45) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_trees_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}
