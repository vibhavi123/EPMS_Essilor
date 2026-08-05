import mysql from "mysql2/promise";

const config: mysql.PoolOptions = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Akila@1234",
  database: process.env.DB_NAME || "GuardSystemDB",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "+00:00",
};

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(config);
    console.log("MySQL connection pool created");
  }
  return pool;
}

/**
 * Returns the MySQL pool. Named getConnection() for backward compatibility
 * with all existing API routes.
 */
export async function getConnection(): Promise<mysql.Pool> {
  return getPool();
}

/**
 * @deprecated Use mysql2/promise directly in new code.
 * Kept only so legacy files that `import { sql } from "@/lib/db"` still compile
 * while they are being migrated one-by-one.
 */
export { mysql as sql };
