/**
 * Rute dokumen proyek: daftar, unduh, unggah, ubah, dan hapus.
 *
 * Diekstrak apa adanya dari meetings.routes.ts, yang sempat menampung enam
 * domain berbeda dalam satu berkas 2.264 baris. Isi handler tidak diubah
 * sebaris pun; yang berpindah hanya tempatnya.
 */
import { Router } from 'express';
import { verifyProjectAccess } from '../middleware/rbac';
import db from '../../src/lib/db';
import crypto from 'crypto';

const router = Router();

  router.get("/api/projects/:projectId/documents", verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      connection = await db.getConnection();
      const [rows] = await connection.query("SELECT id, projectId, title, description, type, link, fileName, fileType, createdBy, downloadCount, createdAt, updatedAt FROM Documents WHERE projectId = ? ORDER BY createdAt DESC", [projectId]);
      res.json({ status: "success", data: rows });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  router.get("/api/projects/:projectId/documents/:id/download", verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { id } = req.params;
      connection = await db.getConnection();
      const [rows] = await connection.query("SELECT fileData, fileName, fileType FROM Documents WHERE id = ?", [id]);
      console.log(`[DOWNLOAD DOC] id: ${id}, rows length: ${(rows as any[]).length}`);
      await connection.query("UPDATE Documents SET downloadCount = downloadCount + 1 WHERE id = ?", [id]);
      if ((rows as any[]).length > 0) {
         res.json({ status: "success", data: (rows as any[])[0] });
      } else {
         const { getDbMode } = await import("../../src/lib/db"); res.status(404).json({ status: "error", message: "Document not found. id: " + id + ", mode: " + getDbMode() });
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  router.post("/api/projects/:projectId/documents", verifyProjectAccess(['*']), async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const { title, description, type, link, fileData, fileName, fileType, createdBy } = req.body;
      const currentUserId = req.user?.id || req.user?.uid || createdBy || "guest";
      const connection = await db.getConnection();
      const newId = crypto.randomUUID();
      await connection.query(
        "INSERT INTO Documents (id, projectId, title, description, type, link, fileData, fileName, fileType, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [newId, projectId, title, description || null, type || null, link || null, fileData || null, fileName || null, fileType || null, currentUserId]
      );
      connection.release();
      res.json({ status: "success", data: { id: newId, projectId, title, description, type, link, fileName, fileType, createdBy: currentUserId } });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });

  router.put("/api/projects/:projectId/documents/:id", verifyProjectAccess(['*']), async (req: any, res) => {
    let connection;
    try {
      const { id } = req.params;
      connection = await db.getConnection();

      const [rows]: any = await connection.query("SELECT * FROM Documents WHERE id = ?", [id]);
      if (!rows || rows.length === 0) {
        connection.release();
        return res.status(404).json({ status: "error", message: "Document not found" });
      }
      const item = rows[0];

      const currentUserId = req.user?.id || req.user?.uid || req.headers["x-user-id"];
      const userRole = (req.user?.role || req.user?.system_role || '').toUpperCase();
      const isAdmin = ['SADM', 'ADMN', 'ADMIN'].includes(userRole);
      const authorId = item.createdBy || item.author_id || item.authorId;
      const isAuthor = authorId === currentUserId;

      if (!isAuthor && !isAdmin) {
        connection.release();
        return res.status(403).json({
          status: "error",
          error: "Akses ditolak: Anda hanya diizinkan untuk melihat data ini."
        });
      }

      const { title, description, type, link, fileData, fileName, fileType } = req.body;
      
      const updates = [];
      const values = [];
      if (title !== undefined) { updates.push("title = ?"); values.push(title); }
      if (description !== undefined) { updates.push("description = ?"); values.push(description); }
      if (type !== undefined) { updates.push("type = ?"); values.push(type); }
      if (link !== undefined) { updates.push("link = ?"); values.push(link); }
      if (fileData !== undefined) { updates.push("fileData = ?"); values.push(fileData); }
      if (fileName !== undefined) { updates.push("fileName = ?"); values.push(fileName); }
      if (fileType !== undefined) { updates.push("fileType = ?"); values.push(fileType); }
      
      if (updates.length > 0) {
        values.push(id);
        await connection.query(`UPDATE Documents SET ${updates.join(', ')} WHERE id = ?`, values);
      }
      connection.release();
      res.json({ status: "success", message: "Document updated" });
    } catch (error: any) {
      if (connection) connection.release();
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });

  router.delete("/api/projects/:projectId/documents/:id", verifyProjectAccess(['*']), async (req: any, res) => {
    let connection;
    try {
      const { id } = req.params;
      connection = await db.getConnection();

      const [rows]: any = await connection.query("SELECT * FROM Documents WHERE id = ?", [id]);
      if (!rows || rows.length === 0) {
        connection.release();
        return res.status(404).json({ status: "error", message: "Document not found" });
      }
      const item = rows[0];

      const currentUserId = req.user?.id || req.user?.uid || req.headers["x-user-id"];
      const userRole = (req.user?.role || req.user?.system_role || '').toUpperCase();
      const isAdmin = ['SADM', 'ADMN', 'ADMIN'].includes(userRole);
      const authorId = item.createdBy || item.author_id || item.authorId;
      const isAuthor = authorId === currentUserId;

      if (!isAuthor && !isAdmin) {
        connection.release();
        return res.status(403).json({
          status: "error",
          error: "Akses ditolak: Anda hanya diizinkan untuk melihat data ini."
        });
      }

      await connection.query("DELETE FROM Documents WHERE id = ?", [id]);
      connection.release();
      res.json({ status: "success", message: "Document deleted" });
    } catch (error: any) {
      if (connection) connection.release();
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });

export default router;
