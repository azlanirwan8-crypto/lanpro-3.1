/**
 * Database Administration Routes
 * For global admins only - database utilities, query explorer, schema inspection
 */

import { Router } from 'express';
import { verifyGlobalAdmin } from '../middleware/auth';
import db from '../../src/lib/db';
import path from 'path';
import fs from 'fs';

const router = Router();

// ==========================================
// DB TESTING & QUERY SECTION
// ==========================================

/**
 * Test database connection
 * GET /api/test-db
 */
router.get("/api/test-db", verifyGlobalAdmin, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.query("SELECT 1 + 1 AS solution");
    res.json({ status: "success", message: "Koneksi ke database MySQL berhasil!" });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: Database connection error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * Run raw database queries (read-only for explorer)
 * POST /api/db-query
 * Body: { query: "SELECT * FROM table" }
 */
router.post("/api/db-query", verifyGlobalAdmin, async (req, res) => {
  let connection;
  try {
    const { query: sqlString } = req.body;
    if (!sqlString || typeof sqlString !== 'string') return res.status(400).json({ error: "Query is required" });

    // DB Explorer is read-only: single SELECT/SHOW/DESCRIBE statement only, no chaining, no mutation keywords.
    const trimmed = sqlString.trim().replace(/;+\s*$/, '');
    const isSingleStatement = !trimmed.includes(';');
    const isReadOnly = /^(SELECT|SHOW|DESCRIBE)\s/i.test(trimmed);
    const hasForbiddenKeyword = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXEC|CALL|MERGE)\b/i.test(trimmed);

    if (!isSingleStatement || !isReadOnly || hasForbiddenKeyword) {
      return res.status(400).json({ status: "error", message: "DB Explorer hanya mengizinkan satu statement SELECT/SHOW/DESCRIBE read-only." });
    }

    connection = await db.getConnection();
    const [rows] = await connection.query(trimmed);

    res.json({ status: "success", data: rows });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: Database query error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * Get database schema and table information
 * GET /api/db-schema
 */
router.get("/api/db-schema", verifyGlobalAdmin, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [tablesRow] = await connection.query("SHOW TABLES");
    const tables = (tablesRow as any[]).map(row => Object.values(row)[0] as string);

    const schema: Record<string, any> = {};
    for (const table of tables) {
      const [columns] = await connection.query(`DESCRIBE \`${table}\``);
      schema[table] = columns;
    }

    // get table sizes
    let tableStats: any[] = [];
    try {
      const [stats] = await connection.query(`
        SELECT
          table_name AS 'tableName',
          table_rows AS 'rowCount',
          data_length + index_length AS 'sizeBytes'
        FROM information_schema.TABLES
        WHERE table_schema = DATABASE();
      `);
      tableStats = stats as any[];
    } catch (e) {
       console.warn("Could not fetch table stats", e);
    }

    res.json({ status: "success", tables: schema, stats: tableStats });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: Database query error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * Run database schema migration (Import DB from schema.sql)
 * POST /api/migrate-db
 */
router.post("/api/migrate-db", verifyGlobalAdmin, async (req, res) => {
  try {
    // 1. Baca isi file schema.sql
    const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // 2. Karena schema.sql kita awalnya ada CREATE DATABASE (yang tidak diizinkan di beberapa user-level Aiven db)
    // Kita bersihkan dulu baris "CREATE DATABASE" dan "USE app_database" agar langsung memakai db yang terkoneksi
    let cleanSql = schemaSql
      .replace(/CREATE DATABASE IF NOT EXISTS.*?;/i, '')
      .replace(/USE .*?;/i, '');

    // 3. Eksekusi semua query
    const connection = await db.getConnection();
    await connection.query(cleanSql);
    connection.release();

    res.json({ status: "success", message: "Migrasi database berhasil dijalankan! Tabel sudah terbuat." });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: Migration error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  }
});

// ==========================================
// DB CONFIG SECTION (PostgreSQL)
// ==========================================

/**
 * Get active DB config from environment
 * GET /api/system/db-config
 */
router.get("/api/system/db-config", verifyGlobalAdmin, (req, res) => {
  try {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || '3306',
      user: process.env.DB_USER || 'app_user',
      password: process.env.DB_PASSWORD || 'app_password',
      database: process.env.DB_NAME || 'app_database'
    };

    const persistentPath = path.join(process.cwd(), 'database', 'db_config.json');
    if (fs.existsSync(persistentPath)) {
      try {
        const saved = JSON.parse(fs.readFileSync(persistentPath, 'utf8'));
        if (saved.host) config.host = saved.host;
        if (saved.port) config.port = String(saved.port);
        if (saved.user) config.user = saved.user;
        if (saved.password) config.password = saved.password;
        if (saved.database) config.database = saved.database;
      } catch (err) {}
    }

    res.json({
      status: "success",
      data: config
    });
  } catch (e: any) {
    res.status(500).json({ status: "error", message: e.message });
  }
});

/**
 * Get active DB connection status
 * GET /api/system/db-status
 */
router.get("/api/system/db-status", verifyGlobalAdmin, async (req, res) => {
  try {
    const { getDbMode } = await import('../../src/lib/db');
    const mode = getDbMode();
    res.json({
      status: "success",
      mode, // "pg"
      host: process.env.DATABASE_URL ? "Neon PostgreSQL Server" : "PostgreSQL Server"
    });
  } catch (e: any) {
    res.status(500).json({ status: "error", message: e.message });
  }
});

/**
 * Switch/Toggle DB connection mode
 * POST /api/system/db-status
 */
router.post("/api/system/db-status", verifyGlobalAdmin, async (req, res) => {
  try {
    res.json({
      status: "success",
      mode: "pg",
      message: "Aplikasi terkunci pada Neon PostgreSQL Server."
    });
  } catch (e: any) {
    res.status(500).json({ status: "error", message: e.message });
  }
});

/**
 * Test PostgreSQL connection with provided config
 * POST /api/system/db-config
 * Body: { connectionString: "postgresql://..." }
 */
router.post("/api/system/db-config", verifyGlobalAdmin, async (req, res) => {
  try {
    const { connectionString } = req.body;
    const { Pool } = await import('pg');
    const testPool = new Pool({
      connectionString: connectionString || process.env.DATABASE_URL || process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false }
    });
    await testPool.query("SELECT 1");
    await testPool.end();
    res.json({ status: "success", message: "Koneksi PostgreSQL Berhasil!" });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ status: "error", message: e.message });
  }
});

/**
 * Save and hot-swap DB config connection
 * POST /api/system/db-config/save
 * Body: { connectionString: "postgresql://..." }
 */
router.post("/api/system/db-config/save", verifyGlobalAdmin, async (req, res) => {
  try {
    const { connectionString } = req.body;
    const { updatePoolConfig } = await import('../../src/lib/db');
    updatePoolConfig({ connectionString });
    res.json({ status: "success", message: "Konfigurasi PostgreSQL berhasil diperbarui!" });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ status: "error", message: e.message });
  }
});

export default router;
