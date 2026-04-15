import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.join(__dirname, "db", "schema.sql");

// ❗ REMOVE FALLBACKS (VERY IMPORTANT)
const databaseConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
};

if (!databaseConfig.host) {
  throw new Error("❌ DB_HOST is missing. Set environment variables in Render.");
}

// ✅ Create pool
const pool = mysql.createPool({
  ...databaseConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true,
  decimalNumbers: true,
});

// ✅ Retry connection (VERY IMPORTANT for Render cold start)
async function waitForDB(retries = 5) {
  while (retries) {
    try {
      const conn = await pool.getConnection();
      conn.release();
      console.log("✅ Database connected");
      return;
    } catch (err) {
      console.log("⏳ Waiting for DB...", retries);
      retries--;
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
  throw new Error("❌ Could not connect to DB after retries");
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [databaseConfig.database, tableName, columnName]
  );

  return rows.length > 0;
}

async function migrateSchema() {
  if (!(await columnExists(pool, "fairness_counter", "last_allocated_term"))) {
    await pool.query(
      "ALTER TABLE fairness_counter ADD COLUMN last_allocated_term VARCHAR(255) NULL AFTER total_allocations"
    );
  }

  if (!(await columnExists(pool, "exam_schedule", "student_count"))) {
    await pool.query(
      "ALTER TABLE exam_schedule ADD COLUMN student_count INT NOT NULL DEFAULT 0 AFTER subject_name"
    );
  }

  await pool.query(
    "ALTER TABLE allocations MODIFY COLUMN role ENUM('Jr_SV', 'Substitute', 'Sr_SV', 'Squad') NOT NULL"
  );
}

export async function initDatabase() {
  await waitForDB(); // ✅ ensure DB is ready

  const bootstrapConnection = await mysql.createConnection({
    host: databaseConfig.host,
    port: databaseConfig.port,
    user: databaseConfig.user,
    password: databaseConfig.password,
    ssl: databaseConfig.ssl,
    multipleStatements: true,
  });

  const schemaSql = await fs.readFile(schemaPath, "utf8");

  await bootstrapConnection.query(
    `CREATE DATABASE IF NOT EXISTS \`${databaseConfig.database}\``
  );

  await bootstrapConnection.end();

  await pool.query(schemaSql);
  await migrateSchema();

  console.log("✅ Database initialized");
}

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function withTransaction(callback) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export { pool };