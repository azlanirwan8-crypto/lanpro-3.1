/**
 * Rute discussion point sebuah rapat, beserta komentarnya.
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

  // Discussion Points API
  router.get("/api/projects/:projectId/meetings/:id/discussionPoints", verifyProjectAccess(['*']), async (req, res) => {
    try {
      const { id } = req.params;
      const connection = await db.getConnection();
      const [rows] = await connection.query("SELECT * FROM DiscussionPoints WHERE meetingId = ? ORDER BY createdAt ASC", [id]);
      connection.release();
      res.json({ status: "success", data: rows });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });

  router.post("/api/projects/:projectId/meetings/:id/discussionPoints", verifyProjectAccess(['*']), async (req, res) => {
    try {
      const { id } = req.params;
      const { parentPointId, authorId, assignTo, concern, fitur, system, surrounding, keterangan, tindakanLanjut, status, targetDate, tanggalUpdateStatus } = req.body;
      const effectiveAuthorId = authorId || req.headers["x-user-id"] || "guest";
      const connection = await db.getConnection();
      const newId = crypto.randomUUID();
      const contentVal = concern || keterangan || "Poin Diskusi";
      try {
        await connection.query(
          "INSERT INTO DiscussionPoints (id, meetingId, \"parentPointId\", \"authorId\", \"assignTo\", concern, fitur, \"system\", surrounding, keterangan, \"tindakanLanjut\", status, \"targetDate\", \"tanggalUpdateStatus\", content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            newId,
            id,
            parentPointId || null,
            effectiveAuthorId,
            assignTo || null,
            concern || null,
            fitur || null,
            system || null,
            surrounding || null,
            keterangan || null,
            tindakanLanjut || null,
            status || 'pending',
            targetDate || null,
            tanggalUpdateStatus || null,
            contentVal
          ]
        );
      } catch (insertErr: any) {
        console.warn("[POST DiscussionPoint Resilient Retry]:", insertErr?.message);
        await connection.query(
          "INSERT INTO DiscussionPoints (id, meetingId, \"authorId\", concern, status, content) VALUES (?, ?, ?, ?, ?, ?)",
          [newId, id, effectiveAuthorId, concern || "Poin Diskusi", status || 'pending', contentVal]
        );
      }
      connection.release();
      res.json({ status: "success", data: { id: newId, meetingId: id } });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });

  router.put("/api/projects/:projectId/meetings/:id/discussionPoints/:pointId", verifyProjectAccess(['*']), async (req, res) => {
    try {
      const { pointId } = req.params;
      const { parentPointId, assignTo, concern, fitur, system, surrounding, keterangan, tindakanLanjut, status, targetDate, tanggalUpdateStatus } = req.body;
      const updates = [];
      const values = [];
      if (parentPointId !== undefined) { updates.push('parentPointId = ?'); values.push(parentPointId); }
      if (assignTo !== undefined) { updates.push('assignTo = ?'); values.push(assignTo); }
      if (concern !== undefined) { updates.push('concern = ?'); values.push(concern); }
      if (fitur !== undefined) { updates.push('fitur = ?'); values.push(fitur); }
      if (system !== undefined) { updates.push('`system` = ?'); values.push(system); }
      if (surrounding !== undefined) { updates.push('surrounding = ?'); values.push(surrounding); }
      if (keterangan !== undefined) { updates.push('keterangan = ?'); values.push(keterangan); }
      if (tindakanLanjut !== undefined) { updates.push('tindakanLanjut = ?'); values.push(tindakanLanjut); }
      if (status !== undefined) { updates.push('status = ?'); values.push(status); }
      if (targetDate !== undefined) { updates.push('targetDate = ?'); values.push(targetDate); }
      if (tanggalUpdateStatus !== undefined) { updates.push('tanggalUpdateStatus = ?'); values.push(tanggalUpdateStatus); }
      
      const connection = await db.getConnection();
      if (updates.length > 0) {
        values.push(pointId);
        await connection.query(`UPDATE DiscussionPoints SET ${updates.join(', ')} WHERE id = ?`, values);
      }
      connection.release();
      res.json({ status: "success", message: "Point updated" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });

  router.delete("/api/projects/:projectId/meetings/:id/discussionPoints/:pointId", verifyProjectAccess(['*']), async (req, res) => {
    try {
      const { pointId } = req.params;
      const connection = await db.getConnection();
      await connection.query("DELETE FROM DiscussionPoints WHERE id = ?", [pointId]);
      connection.release();
      res.json({ status: "success", message: "Point deleted" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  });

  // DISCUSSION POINT THREADED COMMENTS API
  const getCommentsHandler = async (req: any, res: any) => {
    try {
      const pointId = req.params.pointId || req.params.id;
      const connection = await db.getConnection();
      const [rows] = await connection.query(
        "SELECT * FROM discussion_point_comments WHERE pointId = ? OR point_id = ? ORDER BY createdAt ASC",
        [pointId, pointId]
      );
      connection.release();
      res.json({ status: "success", data: rows });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Failed to fetch comments: " + error.message });
    }
  };

  const postCommentHandler = async (req: any, res: any) => {
    try {
      const pointId = req.params.pointId || req.params.id;
      const { userId, userName, commentText } = req.body;

      if (!commentText || !commentText.trim()) {
        return res.status(400).json({ status: "error", message: "Teks komentar wajib diisi." });
      }

      const connection = await db.getConnection();
      const commentId = crypto.randomUUID();
      const effectiveUserId = userId || req.headers["x-user-id"] || "guest";
      const effectiveUserName = userName || "Member";
      const createdAt = new Date().toISOString();

      await connection.query(
        "INSERT INTO discussion_point_comments (id, pointId, point_id, userId, user_id, userName, user_name, commentText, comment_text, createdAt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [commentId, pointId, pointId, effectiveUserId, effectiveUserId, effectiveUserName, effectiveUserName, commentText.trim(), commentText.trim(), createdAt, createdAt]
      );
      connection.release();

      res.status(201).json({
        status: "success",
        data: {
          id: commentId,
          pointId,
          userId: effectiveUserId,
          userName: effectiveUserName,
          commentText: commentText.trim(),
          createdAt
        }
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Failed to add comment: " + error.message });
    }
  };

  router.get("/api/discussion-points/:pointId/comments", getCommentsHandler);
  router.get("/api/projects/:projectId/meetings/:meetingId/discussionPoints/:pointId/comments", getCommentsHandler);
  router.post("/api/discussion-points/:pointId/comments", postCommentHandler);
  router.post("/api/projects/:projectId/meetings/:meetingId/discussionPoints/:pointId/comments", postCommentHandler);


export default router;
