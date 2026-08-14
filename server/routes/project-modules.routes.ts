/**
 * Rute CRUD Project Modules — master data modul/aplikasi per proyek.
 *
 * Diekstrak apa adanya dari meetings.routes.ts, yang sempat menampung enam
 * domain berbeda dalam satu berkas 2.264 baris. Isi handler tidak diubah
 * sebaris pun; yang berpindah hanya tempatnya.
 */
import { Router } from 'express';
import db from '../../src/lib/db';

const router = Router();

  // ProjectModules API (Master Data for Modul/Aplikasi)
  router.get("/api/project-modules", async (req, res) => {
    let connection;
    try {
      connection = await db.getConnection();
      const [rows] = await connection.query("SELECT * FROM ProjectModules ORDER BY createdAt DESC");
      res.json({ status: "success", data: rows });
    } catch (error: any) {
      console.error("GET /api/project-modules error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  router.post("/api/project-modules", async (req, res) => {
    let connection;
    try {
      const { id, projectId, namaModul, keterangan } = req.body;
      if (!projectId || !namaModul) {
        return res.status(400).json({ status: "error", message: "projectId and namaModul are required" });
      }
      connection = await db.getConnection();
      await connection.query(
        "INSERT INTO ProjectModules (id, projectId, namaModul, keterangan, createdAt) VALUES (?, ?, ?, ?, ?)",
        [id || String(Date.now()), projectId, namaModul, keterangan || null, new Date().toISOString()]
      );
      res.json({ status: "success", message: "Module created" });
    } catch (error: any) {
      console.error("POST /api/project-modules error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  router.put("/api/project-modules/:id", async (req, res) => {
    let connection;
    try {
      const { id } = req.params;
      const { projectId, namaModul, keterangan } = req.body;
      connection = await db.getConnection();
      await connection.query(
        "UPDATE ProjectModules SET projectId = ?, namaModul = ?, keterangan = ? WHERE id = ?",
        [projectId, namaModul, keterangan || null, id]
      );
      res.json({ status: "success", message: "Module updated" });
    } catch (error: any) {
      console.error("PUT /api/project-modules/:id error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  router.delete("/api/project-modules/:id", async (req, res) => {
    let connection;
    try {
      const { id } = req.params;
      connection = await db.getConnection();
      await connection.beginTransaction();
      
      // Delete test cases linked to this module
      await connection.query("DELETE FROM QATestCases WHERE modulId = ?", [id]);
      
      // Delete module
      await connection.query("DELETE FROM ProjectModules WHERE id = ?", [id]);
      
      await connection.commit();
      res.json({ status: "success", message: "Module and linked test cases deleted" });
    } catch (error: any) {
      if (connection) await connection.rollback();
      console.error("DELETE /api/project-modules/:id error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });


export default router;
