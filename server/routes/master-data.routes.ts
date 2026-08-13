/**
 * Master Data Routes
 * CRUD operations for master data (dropdowns, enums, configurations)
 */

import { Router } from 'express';
import { verifyGlobalAdmin } from '../middleware/auth';
import mysqlPool from '../../src/lib/db';
import crypto from 'crypto';

const router = Router();

/**
 * Get all master data
 * GET /api/master-data
 */
router.get("/api/master-data", async (req, res) => {
  try {
    const connection = await mysqlPool.getConnection();
    const [rows] = await connection.query("SELECT * FROM MasterData ORDER BY `order` ASC");
    connection.release();
    res.json({ status: "success", data: rows });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: GET /api/master-data error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  }
});

/**
 * Create new master data item
 * POST /api/master-data
 * Body: { type, label, color?, icon?, order?, description?, fieldType?, dropdownOptions?, role_type? }
 */
router.post("/api/master-data", verifyGlobalAdmin, async (req, res) => {
  try {
    const { id, type, label, color, icon, order, description, fieldType, dropdownOptions, role_type, roleType } = req.body;
    const rType = role_type || roleType || null;
    const connection = await mysqlPool.getConnection();

    const newId = id || crypto.randomUUID();
    const itemLabel = label || type || "Item";

    // Server-side validation for project_role
    if (type === 'project_role') {
      const trimmedLabel = itemLabel.trim();
      if (trimmedLabel.length < 3) {
        connection.release();
        return res.status(400).json({ status: "error", message: "Nama Role minimal harus 3 karakter." });
      }
      if (/^(.)\1+$/i.test(trimmedLabel)) {
        connection.release();
        return res.status(400).json({ status: "error", message: "Nama Role tidak boleh berisi karakter sampah atau berulang." });
      }
      const lowerLabel = trimmedLabel.toLowerCase();
      if (lowerLabel === 'asdf' || lowerLabel === 'qwer' || lowerLabel === 'zxcv' || lowerLabel === 'junk' || lowerLabel === 'test' || lowerLabel === 'testing' || lowerLabel === 'dd') {
        connection.release();
        return res.status(400).json({ status: "error", message: "Nama Role tidak boleh berupa karakter sampah atau acak." });
      }
    }

    await connection.query(
      `INSERT INTO MasterData (id, type, label, color, icon, \`order\`, description, fieldType, dropdownOptions, role_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, type || "general", itemLabel, color || null, icon || null, order || 0, description || null, fieldType || null, dropdownOptions ? JSON.stringify(dropdownOptions) : null, rType]
    );

    connection.release();
    res.json({ status: "success", data: { id: newId, type, label: itemLabel, color, icon, order, description, fieldType, dropdownOptions, role_type: rType } });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: POST /api/master-data error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  }
});

/**
 * Update master data item
 * PUT /api/master-data/:id
 * Body: { label?, color?, icon?, order?, description?, fieldType?, dropdownOptions?, role_type?, type? }
 */
router.put("/api/master-data/:id", verifyGlobalAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { label, color, icon, order, description, fieldType, dropdownOptions, role_type, roleType, type } = req.body;
    const rType = role_type || roleType || null;
    const connection = await mysqlPool.getConnection();

    const itemLabel = label !== undefined && label !== null ? label : "Item";

    // Server-side validation for project_role
    let itemType = type;
    if (!itemType) {
      const [existing]: any = await connection.query("SELECT type FROM MasterData WHERE id = ?", [id]);
      if (existing && existing.length > 0) {
        itemType = existing[0].type;
      }
    }

    if (itemType === 'project_role') {
      const trimmedLabel = itemLabel.trim();
      if (trimmedLabel.length < 3) {
        connection.release();
        return res.status(400).json({ status: "error", message: "Nama Role minimal harus 3 karakter." });
      }
      if (/^(.)\1+$/i.test(trimmedLabel)) {
        connection.release();
        return res.status(400).json({ status: "error", message: "Nama Role tidak boleh berisi karakter sampah atau berulang." });
      }
      const lowerLabel = trimmedLabel.toLowerCase();
      if (lowerLabel === 'asdf' || lowerLabel === 'qwer' || lowerLabel === 'zxcv' || lowerLabel === 'junk' || lowerLabel === 'test' || lowerLabel === 'testing' || lowerLabel === 'dd') {
        connection.release();
        return res.status(400).json({ status: "error", message: "Nama Role tidak boleh berupa karakter sampah atau acak." });
      }
    }

    await connection.query(
      `UPDATE MasterData SET label=?, color=?, icon=?, \`order\`=?, description=?, fieldType=?, dropdownOptions=?, role_type=? WHERE id=?`,
      [itemLabel, color || null, icon || null, order || 0, description || null, fieldType || null, dropdownOptions ? JSON.stringify(dropdownOptions) : null, rType, id]
    );

    connection.release();
    res.json({ status: "success", message: "MasterData updated" });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: PUT /api/master-data error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  }
});

/**
 * Delete master data item (with safety checks)
 * DELETE /api/master-data/:id
 * Cannot delete system defaults or in-use items
 */
router.delete("/api/master-data/:id", verifyGlobalAdmin, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await mysqlPool.getConnection();

    const [rows]: any = await connection.query("SELECT * FROM MasterData WHERE id = ?", [id]);
    if (!rows || rows.length === 0) {
      connection.release();
      return res.status(404).json({ status: "error", message: "Master data tidak ditemukan." });
    }

    const item = rows[0];

    if (item.is_system_default === 1 || item.is_system_default === true) {
      connection.release();
      return res.status(400).json({ status: "error", message: "Data master bawaan sistem terkunci dan tidak dapat dihapus." });
    }

    const [taskRows]: any = await connection.query(
      "SELECT COUNT(*) as count FROM Tasks WHERE status = ? OR priority = ? OR type = ? OR environment = ?",
      [item.label, item.label, item.label, item.label]
    );

    const usageCount = taskRows?.[0]?.count || 0;
    if (usageCount > 0) {
      connection.release();
      return res.status(400).json({ status: "error", message: `Data master ini sedang digunakan oleh ${usageCount} Task aktif dan tidak dapat dihapus.` });
    }

    await connection.query("DELETE FROM MasterData WHERE id = ?", [id]);
    connection.release();
    res.json({ status: "success", message: "MasterData deleted" });
  } catch (error: any) {
    if (connection) connection.release();
    console.error("LOG ANOMALI CRITICAL: DELETE /api/master-data error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  }
});

export default router;
