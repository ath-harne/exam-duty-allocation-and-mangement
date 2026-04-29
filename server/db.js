import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.join(__dirname, "db", "schema.sql");

// Supports DATABASE_URL (Railway/PlanetScale) or individual DB_* vars
function buildPoolConfig() {
  if (process.env.DATABASE_URL) {
    // mysql2 accepts `uri` as a top-level key in createPool
    return {
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true,
      decimalNumbers: true,
      ssl: { rejectUnauthorized: false },
    };
  }

  if (!process.env.DB_HOST) {
    throw new Error(
      "❌ DB_HOST (or DATABASE_URL) is missing. Set environment variables in Render."
    );
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true,
    decimalNumbers: true,
  };
}

const poolConfig = buildPoolConfig();
const pool = mysql.createPool(poolConfig);

// Retry until DB is reachable (important for cloud cold starts)
async function waitForDB(retries = 10) {
  while (retries > 0) {
    try {
      const conn = await pool.getConnection();
      conn.release();
      console.log("✅ Database connected");
      return;
    } catch (err) {
      console.log(`⏳ Waiting for DB... (${retries} retries left) — ${err.message}`);
      retries--;
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
  throw new Error("❌ Could not connect to DB after retries");
}

// Resolve DB name for information_schema queries
function resolveDbName() {
  if (process.env.DB_NAME) return process.env.DB_NAME;
  if (process.env.DATABASE_URL) {
    const match = process.env.DATABASE_URL.match(/\/([^/?]+)(\?|$)/);
    return match ? match[1] : null;
  }
  return null;
}

async function columnExists(tableName, columnName) {
  const dbName = resolveDbName();
  if (!dbName) return false; // skip migration check if we can't resolve DB name

  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [dbName, tableName, columnName]
  );
  return rows.length > 0;
}

async function migrateSchema() {
  try {
    if (!(await columnExists("fairness_counter", "last_allocated_term"))) {
      await pool.query(
        "ALTER TABLE fairness_counter ADD COLUMN last_allocated_term VARCHAR(255) NULL AFTER total_allocations"
      );
    }
  } catch (e) {
    console.warn("⚠️ Migration skip (fairness_counter.last_allocated_term):", e.message);
  }

  try {
    if (!(await columnExists("exam_schedule", "student_count"))) {
      await pool.query(
        "ALTER TABLE exam_schedule ADD COLUMN student_count INT NOT NULL DEFAULT 0 AFTER subject_name"
      );
    }
  } catch (e) {
    console.warn("⚠️ Migration skip (exam_schedule.student_count):", e.message);
  }

<<<<<<< HEAD
  await pool.query(
    "ALTER TABLE allocations MODIFY COLUMN role ENUM('Jr_SV', 'Substitute', 'Sr_SV', 'Squad', 'Overall_Substitute') NOT NULL"
  );

  await pool.query("ALTER TABLE allocations MODIFY COLUMN exam_date DATE NULL");
  await pool.query("ALTER TABLE allocations MODIFY COLUMN shift ENUM('M', 'E') NULL");

  const [tableExists] = await pool.query(
    `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'dept_block_rules' LIMIT 1`,
    [databaseConfig.database]
  );
  if (tableExists.length === 0) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dept_block_rules (
        rule_id INT AUTO_INCREMENT PRIMARY KEY,
        dept_id VARCHAR(32) NOT NULL,
        start_block INT NOT NULL,
        end_block INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
=======
  try {
    await pool.query(
      "ALTER TABLE allocations MODIFY COLUMN role ENUM('Jr_SV', 'Substitute', 'Sr_SV', 'Squad') NOT NULL"
    );
  } catch (e) {
    console.warn("⚠️ Migration skip (allocations.role):", e.message);
>>>>>>> e7a76da5b9db5d346e872ddf8c43fda3a4d537f1
  }
}

export async function initDatabase() {
  await waitForDB();

  // Only create the database when using individual params — cloud DBs pre-create it
  if (!process.env.DATABASE_URL) {
    const bootstrap = await mysql.createConnection({
      host: poolConfig.host,
      port: poolConfig.port,
      user: poolConfig.user,
      password: poolConfig.password,
      ssl: poolConfig.ssl,
      multipleStatements: true,
    });
    await bootstrap.query(
      `CREATE DATABASE IF NOT EXISTS \`${poolConfig.database}\``
    );
    await bootstrap.end();
  }

  const schemaSql = await fs.readFile(schemaPath, "utf8");
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
