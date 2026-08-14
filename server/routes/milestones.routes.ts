/**
 * Rute milestone proyek: daftar, tambah, ubah, dan hapus.
 *
 * Diekstrak apa adanya dari meetings.routes.ts, yang sempat menampung enam
 * domain berbeda dalam satu berkas 2.264 baris. Isi handler tidak diubah
 * sebaris pun; yang berpindah hanya tempatnya.
 */
import { Router } from 'express';
import { verifyProjectAccess } from '../middleware/rbac';
import db from '../../src/lib/db';
import crypto from 'crypto';
import { createAuditLog } from '../services/audit.service';

const router = Router();

  // Milestones API (Hybrid Value-Added)
  router.get("/api/projects/:projectId/milestones", verifyProjectAccess(['*']), async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      connection = await db.getConnection();
      
      const [milestones]: any = await connection.query(
        "SELECT * FROM Milestones WHERE projectId = ? ORDER BY dueDate ASC",
        [projectId]
      );

      // Optimization: Get ALL milestone-sprint links in ONE query
      const [allMilestoneLinks]: any = await connection.query(
        "SELECT milestoneId, sprintId FROM MilestoneSprints WHERE milestoneId IN (SELECT id FROM Milestones WHERE projectId = ?)",
        [projectId]
      );

      // Map milestoneId -> sprintIds
      const milestoneSprintMap = new Map<string, string[]>();
      for (const link of allMilestoneLinks) {
        if (!milestoneSprintMap.has(link.milestoneId)) {
          milestoneSprintMap.set(link.milestoneId, []);
        }
        milestoneSprintMap.get(link.milestoneId)!.push(link.sprintId);
      }

      // Get stats for ALL sprints in ONE query
      const allSprintIds = new Set<string>();
      milestoneSprintMap.forEach(sprints => sprints.forEach(s => allSprintIds.add(s)));

      let sprintStatsMap = new Map<string, any>();
      if (allSprintIds.size > 0) {
        const [stats]: any = await connection.query(`
          SELECT
            sprintId,
            SUM(CASE WHEN status = 'Done' THEN storyPoints ELSE 0 END) as donePoints,
            SUM(storyPoints) as totalPoints
          FROM Tasks
          WHERE sprintId IN (?) AND storyPoints IS NOT NULL
          GROUP BY sprintId
        `, [Array.from(allSprintIds)]);

        stats.forEach((stat: any) => {
          sprintStatsMap.set(stat.sprintId, stat);
        });
      }

      // Calculate progress for each milestone using pre-fetched data
      for (const ms of milestones) {
        const sprintIds = milestoneSprintMap.get(ms.id) || [];
        if (sprintIds.length > 0) {
          let totalPoints = 0, donePoints = 0;
          sprintIds.forEach(sprintId => {
            const stat = sprintStatsMap.get(sprintId);
            if (stat) {
              totalPoints += stat.totalPoints || 0;
              donePoints += stat.donePoints || 0;
            }
          });
          ms.progress = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
          ms.totalStoryPoints = totalPoints;
          ms.doneStoryPoints = donePoints;
        } else {
          ms.progress = 0;
        }
      }

      res.json({ status: "success", data: milestones });
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: GET milestones error:", error);
      res.status(500).json({ status: "error", message: "Gagal mengambil Milestone." });
    } finally {
      if (connection) connection.release();
    }
  });

  router.post("/api/projects/:projectId/milestones", verifyProjectAccess(['admin', 'manager', 'head']), async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      const { name, description, dueDate, sprintIds } = req.body;
      const userId = req.headers['x-user-id'] || req.query.userId || 'guest';
      
      connection = await db.getConnection();
      const milestoneId = crypto.randomUUID();

      await connection.query(
        "INSERT INTO Milestones (id, projectId, name, description, dueDate, status) VALUES (?, ?, ?, ?, ?, ?)",
        [milestoneId, projectId, name, description || '', dueDate || null, 'planned']
      );

      if (sprintIds && Array.isArray(sprintIds)) {
        for (const sid of sprintIds) {
          await connection.query("INSERT INTO MilestoneSprints (milestoneId, sprintId) VALUES (?, ?)", [milestoneId, sid]);
        }
      }

      await createAuditLog(userId as string, projectId, 'CREATE', 'Milestones', milestoneId, null, { name, sprintIds });

      res.json({ status: "success", data: { id: milestoneId, name, milestoneId } });
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: POST milestones error:", error);
      res.status(500).json({ status: "error", message: "Gagal membuat Milestone." });
    } finally {
      if (connection) connection.release();
    }
  });

  router.put("/api/projects/:projectId/milestones/:id", verifyProjectAccess(['admin', 'manager', 'head']), async (req, res) => {
    let connection;
    try {
      const { id, projectId } = req.params;
      const { name, description, dueDate, status, sprintIds } = req.body;
      const userId = req.headers['x-user-id'] || 'guest';
      
      connection = await db.getConnection();
      
      const updates = [];
      const values = [];
      if (name !== undefined) { updates.push("name = ?"); values.push(name); }
      if (description !== undefined) { updates.push("description = ?"); values.push(description); }
      if (dueDate !== undefined) { updates.push("dueDate = ?"); values.push(dueDate); }
      if (status !== undefined) { updates.push("status = ?"); values.push(status); }

      if (updates.length > 0) {
        values.push(id);
        await connection.query(`UPDATE Milestones SET ${updates.join(', ')} WHERE id = ?`, values);
      }

      if (sprintIds !== undefined && Array.isArray(sprintIds)) {
        await connection.query("DELETE FROM MilestoneSprints WHERE milestoneId = ?", [id]);
        for (const sid of sprintIds) {
          await connection.query("INSERT INTO MilestoneSprints (milestoneId, sprintId) VALUES (?, ?)", [id, sid]);
        }
      }

      await createAuditLog(userId as string, projectId, 'UPDATE', 'Milestones', id, null, req.body);
      res.json({ status: "success", message: "Milestone updated" });
    } catch (error: any) {
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  router.delete("/api/projects/:projectId/milestones/:id", verifyProjectAccess(['admin', 'head']), async (req, res) => {
    let connection;
    try {
      const { id, projectId } = req.params;
      const userId = req.headers['x-user-id'] || 'guest';
      connection = await db.getConnection();
      
      await createAuditLog(userId as string, projectId, 'DELETE', 'Milestones', id, null, null);
      await connection.query("DELETE FROM Milestones WHERE id = ?", [id]);
      
      res.json({ status: "success", message: "Milestone deleted" });
    } catch (error: any) {
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });


export default router;
