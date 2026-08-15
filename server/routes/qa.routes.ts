import { Express } from "express";
import { z } from "zod";
import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { validateFileBuffer, sanitizeFilename } from "../../src/lib/fileSecurity";
import db from "../../src/lib/db";
import { verifyProjectAccess } from "../middleware/rbac";
import { generateContentWithFallback } from "../services/ai.service";
import { simpanBerkas } from "../services/storage.service";
import {
  QA_SCENARIO_REFINEMENT_SCHEMA,
  QA_TEST_CASE_SUGGESTION_SCHEMA,
} from "../services/qa-ai.schema";

export function setupQARoutes(
  app: Express,
  upload: multer.Multer,
  GLOBAL_UPLOADS_DIR: string,
  createAuditLog: (
    userId: string,
    projectId: string | null,
    actionType: "CREATE" | "UPDATE" | "DELETE",
    entityName: string,
    entityId: string,
    oldValues: any,
    newValues: any
  ) => Promise<any>
) {
  // Helper Function: Record Non-Destructive Execution Run Log (Audit Trail)
  async function recordExecutionRunLog(
    conn: any,
    projectId: string,
    testCaseId: string,
    executionStatus: string,
    linkedIssueKey: string | null = null,
    userId: string = "system",
    userName: string = "Tester / System",
    notes: string = "",
    evidences: any[] = []
  ) {
    try {
      const [rows]: any = await conn.query(
        "SELECT history FROM QATestCases WHERE id = ? AND projectId = ?",
        [testCaseId, projectId]
      );

      let currentHistory: any[] = [];
      if (rows && rows.length > 0 && rows[0].history) {
        try {
          currentHistory =
            typeof rows[0].history === "string"
              ? JSON.parse(rows[0].history)
              : rows[0].history || [];
        } catch (e) {
          currentHistory = [];
        }
      }

      const nextRunVersion = currentHistory.length + 1;
      const runLabel = `Run #${nextRunVersion}`;
      const logId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      const newLog = {
        id: logId,
        testCaseId,
        projectId,
        runVersion: nextRunVersion,
        runLabel,
        executionStatus: executionStatus.toUpperCase(),
        linkedIssueKey: linkedIssueKey || null,
        executedByUserId: userId,
        executedByName: userName,
        timestamp,
        notes: notes || `Status eksekusi diubah menjadi ${executionStatus.toUpperCase()}`,
        evidences: evidences || [],
      };

      currentHistory.push(newLog);

      await conn.query("UPDATE QATestCases SET history = ? WHERE id = ? AND projectId = ?", [
        JSON.stringify(currentHistory),
        testCaseId,
        projectId,
      ]);

      try {
        await conn.query(
          `INSERT INTO QATestCaseExecutionLogs
           (id, testCaseId, projectId, runVersion, runLabel, executionStatus, linkedIssueKey, executedByUserId, executedByName, timestamp, notes, evidences)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            logId,
            testCaseId,
            projectId,
            nextRunVersion,
            runLabel,
            executionStatus.toUpperCase(),
            linkedIssueKey || null,
            userId,
            userName,
            timestamp,
            notes || `Status eksekusi: ${executionStatus.toUpperCase()}`,
            JSON.stringify(evidences || []),
          ]
        );
      } catch (dbErr) {
        // Table fallback
      }

      return newLog;
    } catch (err) {
      console.error("recordExecutionRunLog error:", err);
      return null;
    }
  }

  // GET: List QA Test Suites
  app.get(
    "/api/projects/:projectId/qa-test-suites",
    verifyProjectAccess(["*"]),
    async (req: any, res) => {
      let connection;
      try {
        const { projectId } = req.params;
        connection = await db.getConnection();
        const [rows]: any = await connection.query(
          "SELECT * FROM QATestSuites WHERE projectId = ? ORDER BY uploadedAt DESC",
          [projectId]
        );
        res.json({ status: "success", data: rows });
      } catch (error: any) {
        console.error("GET /api/projects/:projectId/qa-test-suites error:", error);
        res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
      } finally {
        if (connection) connection.release();
      }
    }
  );

  // POST: Save QA/user feedback to ai_learning_logs for AI continuous learning
  app.post("/api/v1/qa/ai-feedback", async (req, res) => {
    let connection;
    try {
      const { project_id, evaluation_notes } = req.body;
      if (!project_id || !evaluation_notes || !evaluation_notes.trim()) {
        return res.status(400).json({
          status: "error",
          message: "Parameter project_id dan evaluation_notes wajib diisi.",
        });
      }

      connection = await db.getConnection();
      const id = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      await connection.query(
        "INSERT INTO ai_learning_logs (id, project_id, evaluation_notes, timestamp) VALUES (?, ?, ?, ?)",
        [id, project_id, evaluation_notes.trim(), timestamp]
      );

      console.log(`[QA AI FEEDBACK] Saved learning log ${id} for project ${project_id}`);
      return res.json({
        status: "success",
        message: "Feedback berhasil disimpan ke dalam log pembelajaran AI.",
      });
    } catch (error: any) {
      console.error("[QA AI FEEDBACK ERROR]", error);
      return res.status(500).json({
        status: "error",
        message: "Gagal menyimpan feedback: " + error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  });

  // POST: Bulk Upload QA Test Cases from Excel
  app.post("/api/v1/qa/test-case/bulk-upload", upload.single("file"), async (req, res) => {
    let connection;
    try {
      const { projectId, phase, uploaderName } = req.body;
      const file = req.file;

      if (!projectId || !phase || !file) {
        return res.status(400).json({
          status: "error",
          message: "Missing required fields (projectId, phase, file)",
        });
      }

      const fileBuf = fs.readFileSync(file.path);
      const fileVal = validateFileBuffer(fileBuf, file.originalname);
      if (!fileVal.valid) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(400).json({
          status: "error",
          message:
            fileVal.error ||
            "Gagal Mengunggah Dokumen: Format file tidak didukung atau ukuran melebihi batas maksimum (Max 10MB).",
        });
      }

      const ExcelJS = require("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(file.path);
      const worksheet = workbook.worksheets[0];
      const data: any[][] = [];
      worksheet.eachRow({ includeEmpty: true }, (row: any) => {
        data.push((row.values as any[]).slice(1));
      });

      const headers = data[0] as string[];
      if (!headers || headers.length < 4) {
        return res.status(400).json({
          status: "error",
          message:
            "Format kolom tidak sesuai standar (Nama Judul, Deskripsi, Hasil Diharapkan, Level)",
        });
      }

      const expectedHeaders = ["Nama Judul", "Deskripsi", "Hasil Diharapkan", "Level"];
      let headerValid = true;
      for (let i = 0; i < expectedHeaders.length; i++) {
        if (!headers[i] || headers[i].trim().toLowerCase() !== expectedHeaders[i].toLowerCase()) {
          headerValid = false;
          break;
        }
      }

      if (!headerValid) {
        return res.status(400).json({
          status: "error",
          message:
            "Format kolom tidak sesuai standar (Nama Judul, Deskripsi, Hasil Diharapkan, Level)",
        });
      }

      connection = await db.getConnection();

      const newSuiteId = `suite-${Date.now()}`;
      const newSuiteName = `${file.originalname.replace(/\.[^/.]+$/, "")} (${phase})`;

      await connection.query(
        `INSERT INTO QATestSuites (id, projectId, name, phase, uploadedBy, uploadedAt, fileName)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          newSuiteId,
          projectId,
          newSuiteName,
          phase,
          uploaderName || "Unknown",
          new Date().toISOString(),
          file.originalname,
        ]
      );

      let rowNum = 1;
      const casesToReturn = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i] as any[];
        if (!row || row.length === 0 || !row[0]) continue;

        const newCaseId = `case-${Date.now()}-${rowNum}`;
        const newCase = {
          id: newCaseId,
          suiteId: newSuiteId,
          rowNum: rowNum,
          title: row[0],
          steps: row[1] || "",
          expectedResult: row[2] || "",
          status: "Pending",
          priority: row[3] || "Medium",
          commentsList: [],
          evidences: [],
        };
        casesToReturn.push(newCase);

        await connection.query(
          `INSERT INTO QATestCases (id, projectId, judul, deskripsi, tipeTesting, prioritas, status, steps, history, createdAt, suiteId, rowNum, modulId, commentsList, evidences, expected)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newCase.id,
            projectId,
            newCase.title,
            newCase.steps,
            phase,
            newCase.priority,
            newCase.status,
            JSON.stringify(newCase.steps),
            JSON.stringify([]),
            new Date().toISOString(),
            newSuiteId,
            newCase.rowNum,
            newSuiteId,
            JSON.stringify([]),
            JSON.stringify([]),
            newCase.expectedResult,
          ]
        );
        rowNum++;
      }

      res.status(201).json({
        status: "success",
        message: "Bulk upload berhasil",
        data: {
          suiteId: newSuiteId,
          casesCount: casesToReturn.length,
        },
      });
    } catch (error: any) {
      console.error("POST /api/v1/qa/test-case/bulk-upload error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  });

  // POST: Create QA Test Suite
  app.post(
    "/api/projects/:projectId/qa-test-suites",
    verifyProjectAccess(["*"]),
    async (req, res) => {
      let connection;
      try {
        const { projectId } = req.params;
        const suite = req.body;
        connection = await db.getConnection();
        await connection.query(
          `INSERT INTO QATestSuites (id, projectId, name, phase, uploadedBy, uploadedAt, fileName, assignedTo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            suite.id,
            projectId,
            suite.name,
            suite.phase,
            suite.uploadedBy,
            suite.uploadedAt || new Date().toISOString(),
            suite.fileName || null,
            suite.assignedTo || null,
          ]
        );
        res.json({
          status: "success",
          message: "Test Suite created",
          data: suite,
        });
      } catch (error: any) {
        console.error("POST /api/projects/:projectId/qa-test-suites error:", error);
        res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
      } finally {
        if (connection) connection.release();
      }
    }
  );

  // PUT: Update QA Test Suite
  app.put(
    "/api/projects/:projectId/qa-test-suites/:id",
    verifyProjectAccess(["*"]),
    async (req, res) => {
      let connection;
      try {
        const { projectId, id } = req.params;
        const suite = req.body;
        connection = await db.getConnection();
        await connection.query(
          `UPDATE QATestSuites SET name = ?, phase = ?, uploadedBy = ?, uploadedAt = ?, fileName = ?, assignedTo = ?
         WHERE id = ? AND projectId = ?`,
          [
            suite.name,
            suite.phase,
            suite.uploadedBy,
            suite.uploadedAt,
            suite.fileName || null,
            suite.assignedTo || null,
            id,
            projectId,
          ]
        );
        res.json({ status: "success", message: "Test Suite updated" });
      } catch (error: any) {
        console.error("PUT /api/projects/:projectId/qa-test-suites/:id error:", error);
        res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
      } finally {
        if (connection) connection.release();
      }
    }
  );

  // DELETE: Remove QA Test Suite and related Test Cases
  app.delete(
    "/api/projects/:projectId/qa-test-suites/:id",
    verifyProjectAccess(["*"]),
    async (req, res) => {
      let connection;
      try {
        const { projectId, id } = req.params;
        connection = await db.getConnection();
        await connection.beginTransaction();

        await connection.query("DELETE FROM QATestCases WHERE suiteId = ? AND projectId = ?", [
          id,
          projectId,
        ]);

        await connection.query("DELETE FROM QATestCases WHERE modulId = ? AND projectId = ?", [
          id,
          projectId,
        ]);

        await connection.query("DELETE FROM QATestSuites WHERE id = ? AND projectId = ?", [
          id,
          projectId,
        ]);

        await connection.commit();
        res.json({
          status: "success",
          message: "Test Suite and its Test Cases deleted",
        });
      } catch (error: any) {
        if (connection) await connection.rollback();
        console.error("DELETE /api/projects/:projectId/qa-test-suites/:id error:", error);
        res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
      } finally {
        if (connection) connection.release();
      }
    }
  );

  // GET: List QA Test Cases
  app.get(
    "/api/projects/:projectId/qa-test-cases",
    verifyProjectAccess(["*"]),
    async (req, res) => {
      let connection;
      try {
        const { projectId } = req.params;
        connection = await db.getConnection();
        const [rows]: any = await connection.query(
          "SELECT * FROM QATestCases WHERE projectId = ? ORDER BY rowNum ASC, id ASC",
          [projectId]
        );

        const safeParse = (str: any, fallback = []) => {
          if (typeof str !== "string") return str || fallback;
          try {
            return JSON.parse(str);
          } catch (e) {
            return fallback;
          }
        };

        const parsed = rows.map((row: any) => ({
          ...row,
          steps: safeParse(row.steps, []),
          history: safeParse(row.history, []),
          commentsList: safeParse(row.commentsList, []),
          evidences: safeParse(row.evidences, []),
        }));

        res.json({ status: "success", data: parsed });
      } catch (error: any) {
        console.error("GET /api/projects/:projectId/qa-test-cases error:", error);
        res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
      } finally {
        if (connection) connection.release();
      }
    }
  );

  // POST: Create QA Test Case
  app.post(
    "/api/projects/:projectId/qa-test-cases",
    verifyProjectAccess(["*"]),
    async (req, res) => {
      let connection;
      try {
        const { projectId } = req.params;
        const tc = req.body;
        connection = await db.getConnection();

        await connection.query(
          `INSERT INTO QATestCases (
          id, projectId, judul, deskripsi, tipeTesting, prioritas, caseId, expected, status, steps, history, createdAt, activeTesterId, activeTesterName, lockedAt, modulId,
          suiteId, rowNum, comment, evidenceUrl, evidenceType, evidenceName, linkedBugKey, commentsList, evidences, assignedTo
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tc.id,
            projectId,
            tc.judul || tc.title,
            tc.deskripsi || tc.comment || null,
            tc.tipeTesting || tc.phase || "SIT",
            tc.prioritas || tc.priority || "Medium",
            tc.caseId || null,
            tc.expected || tc.expectedResult || null,
            tc.status || "untested",
            JSON.stringify(tc.steps || []),
            JSON.stringify(tc.history || []),
            tc.createdAt || new Date().toISOString(),
            tc.activeTesterId || null,
            tc.activeTesterName || null,
            tc.lockedAt || null,
            tc.modulId || tc.suiteId || null,
            tc.suiteId || null,
            tc.rowNum || null,
            tc.comment || null,
            tc.evidenceUrl || null,
            tc.evidenceType || null,
            tc.evidenceName || null,
            tc.linkedBugKey || null,
            JSON.stringify(tc.commentsList || []),
            JSON.stringify(tc.evidences || []),
            tc.assignedTo || null,
          ]
        );

        res.json({ status: "success", message: "Test Case created" });
      } catch (error: any) {
        console.error("POST /api/projects/:projectId/qa-test-cases error:", error);
        res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
      } finally {
        if (connection) connection.release();
      }
    }
  );

  // PUT: Update QA Test Case
  app.put(
    "/api/projects/:projectId/qa-test-cases/:id",
    verifyProjectAccess(["*"]),
    async (req, res) => {
      let connection;
      try {
        const { projectId, id } = req.params;
        const tc = req.body;
        connection = await db.getConnection();

        await connection.query(
          `UPDATE QATestCases SET
          judul = ?,
          deskripsi = ?,
          tipeTesting = ?,
          prioritas = ?,
          caseId = ?,
          expected = ?,
          status = ?,
          steps = ?,
          history = ?,
          activeTesterId = ?,
          activeTesterName = ?,
          lockedAt = ?,
          modulId = ?,
          suiteId = ?,
          rowNum = ?,
          comment = ?,
          evidenceUrl = ?,
          evidenceType = ?,
          evidenceName = ?,
          linkedBugKey = ?,
          commentsList = ?,
          evidences = ?,
          assignedTo = ?
         WHERE id = ? AND projectId = ?`,
          [
            tc.judul || tc.title,
            tc.deskripsi || tc.comment || null,
            tc.tipeTesting || tc.phase || "SIT",
            tc.prioritas || tc.priority || "Medium",
            tc.caseId || null,
            tc.expected || tc.expectedResult || null,
            tc.status,
            JSON.stringify(tc.steps || []),
            JSON.stringify(tc.history || []),
            tc.activeTesterId || null,
            tc.activeTesterName || null,
            tc.lockedAt || null,
            tc.modulId || tc.suiteId || null,
            tc.suiteId || null,
            tc.rowNum || null,
            tc.comment || null,
            tc.evidenceUrl || null,
            tc.evidenceType || null,
            tc.evidenceName || null,
            tc.linkedBugKey || null,
            JSON.stringify(tc.commentsList || []),
            JSON.stringify(tc.evidences || []),
            tc.assignedTo || null,
            id,
            projectId,
          ]
        );

        res.json({ status: "success", message: "Test Case updated" });
      } catch (error: any) {
        console.error("PUT /api/projects/:projectId/qa-test-cases/:id error:", error);
        res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
      } finally {
        if (connection) connection.release();
      }
    }
  );

  // POST: Save QA Test Case with evidence upload
  app.post(
    "/api/projects/:projectId/qa-test-cases/:id/save",
    upload.single("evidence"),
    verifyProjectAccess(["*"]),
    async (req, res) => {
      let connection;
      try {
        const { projectId, id } = req.params;
        const { comment, commentsList, evidences, status, linkedBugKey, currentUserName } =
          req.body;
        const file = req.file;

        connection = await db.getConnection();

        const [existingRows]: any = await connection.query(
          "SELECT * FROM QATestCases WHERE id = ? AND projectId = ?",
          [id, projectId]
        );

        if (existingRows.length === 0) {
          return res.status(404).json({ status: "error", message: "Test case tidak ditemukan." });
        }

        const tc = existingRows[0];

        let finalEvidenceUrl =
          req.body.evidenceUrl !== undefined ? req.body.evidenceUrl : tc.evidenceUrl;
        let finalEvidenceName =
          req.body.evidenceName !== undefined ? req.body.evidenceName : tc.evidenceName;
        let finalEvidenceType =
          req.body.evidenceType !== undefined ? req.body.evidenceType : tc.evidenceType;

        let finalEvidences = [];
        try {
          finalEvidences =
            typeof tc.evidences === "string" ? JSON.parse(tc.evidences) : tc.evidences || [];
        } catch (e) {
          finalEvidences = [];
        }

        if (file) {
          const fileBuf = fs.readFileSync(file.path);
          const fileVal = validateFileBuffer(fileBuf, file.originalname);
          if (!fileVal.valid) {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            return res.status(400).json({
              status: "error",
              message:
                fileVal.error ||
                "Gagal Mengunggah Dokumen: Format file tidak didukung atau ukuran melebihi batas maksimum (Max 10MB).",
            });
          }

          const safeName = fileVal.sanitizedName || sanitizeFilename(file.originalname);

          // Bukti QA disimpan lewat lapisan penyimpanan agar bertahan antar
          // deploy. Berkas sementara multer dibersihkan setelahnya.
          const relativePath = await simpanBerkas(safeName, fileBuf, file.mimetype);
          try {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          } catch {
            /* diabaikan */
          }
          finalEvidenceUrl = relativePath;
          finalEvidenceName = file.originalname;
          finalEvidenceType = file.mimetype.startsWith("video/") ? "video" : "image";

          finalEvidences.push({
            id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
            name: file.originalname,
            url: relativePath,
            type: finalEvidenceType,
          });
        }

        let parsedEvidences = finalEvidences;
        if (evidences) {
          try {
            parsedEvidences = typeof evidences === "string" ? JSON.parse(evidences) : evidences;
          } catch (e) {}
        }

        let parsedCommentsList = [];
        try {
          parsedCommentsList =
            typeof tc.commentsList === "string"
              ? JSON.parse(tc.commentsList)
              : tc.commentsList || [];
        } catch (e) {
          parsedCommentsList = [];
        }

        if (commentsList) {
          try {
            parsedCommentsList =
              typeof commentsList === "string" ? JSON.parse(commentsList) : commentsList;
          } catch (e) {}
        }

        if (comment && comment.trim() && comment !== tc.comment) {
          parsedCommentsList.push({
            id: `comment-${Date.now()}`,
            userName: currentUserName || "Tester LanPro",
            text: comment.trim(),
            timestamp: new Date().toISOString(),
          });
        }

        await connection.query(
          `UPDATE QATestCases SET
          comment = ?,
          commentsList = ?,
          evidenceUrl = ?,
          evidenceName = ?,
          evidenceType = ?,
          evidences = ?,
          status = ?,
          linkedBugKey = ?
         WHERE id = ? AND projectId = ?`,
          [
            comment || tc.comment || null,
            JSON.stringify(parsedCommentsList),
            finalEvidenceUrl,
            finalEvidenceName,
            finalEvidenceType,
            JSON.stringify(parsedEvidences),
            status || tc.status,
            linkedBugKey || tc.linkedBugKey || null,
            id,
            projectId,
          ]
        );

        res.json({
          status: "success",
          message: "Test case saved successfully",
          data: {
            id,
            comment: comment || tc.comment,
            commentsList: parsedCommentsList,
            evidenceUrl: finalEvidenceUrl,
            evidenceName: finalEvidenceName,
            evidenceType: finalEvidenceType,
            evidences: parsedEvidences,
            status: status || tc.status,
            linkedBugKey: linkedBugKey || tc.linkedBugKey,
          },
        });
      } catch (error: any) {
        console.error("POST /api/projects/:projectId/qa-test-cases/:id/save error:", error);
        res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
      } finally {
        if (connection) connection.release();
      }
    }
  );

  // GET: Execution History Timeline (Run History Audit Trail)
  app.get(
    "/api/projects/:projectId/qa-test-cases/:id/execution-history",
    verifyProjectAccess(["*"]),
    async (req, res) => {
      let connection;
      try {
        const { projectId, id } = req.params;
        connection = await db.getConnection();

        let logs: any[] = [];
        try {
          const [logRows]: any = await connection.query(
            "SELECT * FROM QATestCaseExecutionLogs WHERE testCaseId = ? AND projectId = ? ORDER BY runVersion ASC",
            [id, projectId]
          );
          if (logRows && logRows.length > 0) {
            logs = logRows.map((r: any) => ({
              ...r,
              evidences:
                typeof r.evidences === "string" ? JSON.parse(r.evidences || "[]") : r.evidences,
            }));
          }
        } catch (e) {}

        if (logs.length === 0) {
          const [tcRows]: any = await connection.query(
            "SELECT history FROM QATestCases WHERE id = ? AND projectId = ?",
            [id, projectId]
          );
          if (tcRows && tcRows.length > 0 && tcRows[0].history) {
            try {
              logs =
                typeof tcRows[0].history === "string"
                  ? JSON.parse(tcRows[0].history)
                  : tcRows[0].history;
            } catch (e) {}
          }
        }

        res.json({ status: "success", data: logs || [] });
      } catch (error: any) {
        console.error("GET execution-history error:", error);
        res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
      } finally {
        if (connection) connection.release();
      }
    }
  );

  // PATCH: Update Test Case status with auto bug creation
  app.patch(
    "/api/projects/:projectId/qa-test-cases/:id/status",
    verifyProjectAccess(["*"]),
    async (req: any, res) => {
      let connection;
      try {
        const { projectId, id } = req.params;
        const { status, notes } = req.body;
        if (!status) {
          return res.status(400).json({ status: "error", message: "Status required" });
        }

        connection = await db.getConnection();

        const [tcRows]: any = await connection.query(
          "SELECT * FROM QATestCases WHERE id = ? AND projectId = ?",
          [id, projectId]
        );

        let createdBugKey = null;

        if (tcRows.length > 0) {
          const tc = tcRows[0];
          const userIdStr = req.user?.uid || req.user?.id || req.headers["x-user-id"] || "guest";

          let userNameStr = "Tester";
          try {
            const [uRows]: any = await connection.query(
              "SELECT displayName, username FROM Users WHERE id = ? OR uid = ?",
              [userIdStr, userIdStr]
            );
            if (uRows && uRows.length > 0) {
              userNameStr = uRows[0].displayName || uRows[0].username || "Tester";
            }
          } catch (e) {}

          if (status.toLowerCase() === "failed" && !tc.linkedBugKey) {
            const [keyResult]: any = await connection.query(
              "SELECT taskKey FROM Tasks WHERE projectId = ? ORDER BY createdAt DESC LIMIT 1",
              [projectId]
            );

            let nextKeyNum = 1;
            let projCode = "PRJ";
            if (keyResult.length > 0 && keyResult[0].taskKey) {
              const keyParts = keyResult[0].taskKey.split("-");
              if (keyParts.length > 1) {
                projCode = keyParts[0];
                nextKeyNum = parseInt(keyParts[1], 10) + 1;
              }
            } else {
              const [projRes]: any = await connection.query(
                "SELECT prefix FROM Projects WHERE id = ?",
                [projectId]
              );
              if (projRes.length > 0 && projRes[0].prefix) {
                projCode = projRes[0].prefix;
              }
            }
            const taskKey = `${projCode}-${nextKeyNum}`;
            const bugId = crypto.randomUUID();

            const tcTitle = tc.judul || tc.title || "Untitled Test Case";
            const tcDesc = tc.deskripsi || tc.description || "";
            const tcCaseId = tc.caseId || tc.id || "";

            await connection.query(
              `INSERT INTO Tasks (id, projectId, taskKey, title, description, status, priority, type, reporterId, projectRisk)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                bugId,
                projectId,
                taskKey,
                `Bug: ${tcTitle}`,
                `Bug otomatis dibuat dari QA Test Case [${tcCaseId}]: ${tcTitle}.\n\n**Deskripsi Test Case:**\n${tcDesc}`,
                "To Do",
                "High",
                "bug",
                userIdStr,
                "High",
              ]
            );

            createdBugKey = taskKey;

            await connection.query(
              "UPDATE QATestCases SET status = ?, linkedBugKey = ? WHERE id = ? AND projectId = ?",
              [status, createdBugKey, id, projectId]
            );

            try {
              await createAuditLog(userIdStr, projectId, "CREATE", "Tasks", bugId, null, {
                title: `Bug: ${tcTitle}`,
              });
            } catch (e) {}
          } else {
            await connection.query(
              "UPDATE QATestCases SET status = ? WHERE id = ? AND projectId = ?",
              [status, id, projectId]
            );
          }

          let evList = [];
          try {
            evList =
              typeof tc.evidences === "string" ? JSON.parse(tc.evidences) : tc.evidences || [];
          } catch (e) {}

          const activeLinkedKey = createdBugKey || tc.linkedBugKey || null;
          await recordExecutionRunLog(
            connection,
            projectId,
            id,
            status,
            activeLinkedKey,
            userIdStr,
            userNameStr,
            notes ||
              (createdBugKey
                ? `Status FAILED. Auto-generated Bug Issue #${createdBugKey}`
                : `Manual Status Update to ${status.toUpperCase()}`),
            evList
          );
        }

        res.json({
          status: "success",
          message: "Status updated successfully",
          statusValue: status,
          bugKey: createdBugKey,
        });
      } catch (error: any) {
        console.error("PATCH /api/projects/:projectId/qa-test-cases/:id/status error:", error);
        res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
      } finally {
        if (connection) connection.release();
      }
    }
  );

  // DELETE: Remove QA Test Case
  app.delete(
    "/api/projects/:projectId/qa-test-cases/:id",
    verifyProjectAccess(["*"]),
    async (req, res) => {
      let connection;
      try {
        const { projectId, id } = req.params;
        connection = await db.getConnection();
        await connection.query("DELETE FROM QATestCases WHERE id = ? AND projectId = ?", [
          id,
          projectId,
        ]);
        res.json({ status: "success", message: "Test Case deleted" });
      } catch (error: any) {
        console.error("DELETE /api/projects/:projectId/qa-test-cases/:id error:", error);
        res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
      } finally {
        if (connection) connection.release();
      }
    }
  );

  // POST: Sync QA Test Cases
  app.post(
    "/api/projects/:projectId/qa-test-cases/sync",
    verifyProjectAccess(["*"]),
    async (req, res) => {
      let connection;
      try {
        const { projectId } = req.params;
        const testCases = req.body;
        if (!Array.isArray(testCases)) {
          return res.status(400).json({ status: "error", message: "Body must be an array" });
        }

        connection = await db.getConnection();
        for (const tc of testCases) {
          const [existing]: any = await connection.query(
            "SELECT id FROM QATestCases WHERE id = ?",
            [tc.id]
          );

          if (existing && existing.length > 0) {
            await connection.query(
              `UPDATE QATestCases SET
              judul = ?,
              deskripsi = ?,
              tipeTesting = ?,
              prioritas = ?,
              caseId = ?,
              expected = ?,
              status = ?,
              steps = ?,
              history = ?,
              activeTesterId = ?,
              activeTesterName = ?,
              lockedAt = ?,
              modulId = ?,
              suiteId = ?,
              rowNum = ?,
              comment = ?,
              evidenceUrl = ?,
              evidenceType = ?,
              evidenceName = ?,
              linkedBugKey = ?,
              commentsList = ?,
              evidences = ?
             WHERE id = ? AND projectId = ?`,
              [
                tc.judul || tc.title,
                tc.deskripsi || tc.comment || null,
                tc.tipeTesting || tc.phase || "SIT",
                tc.prioritas || tc.priority || "Medium",
                tc.caseId || null,
                tc.expected || tc.expectedResult || null,
                tc.status,
                JSON.stringify(tc.steps || []),
                JSON.stringify(tc.history || []),
                tc.activeTesterId || null,
                tc.activeTesterName || null,
                tc.lockedAt || null,
                tc.modulId || tc.suiteId || null,
                tc.suiteId || null,
                tc.rowNum || null,
                tc.comment || null,
                tc.evidenceUrl || null,
                tc.evidenceType || null,
                tc.evidenceName || null,
                tc.linkedBugKey || null,
                JSON.stringify(tc.commentsList || []),
                JSON.stringify(tc.evidences || []),
                tc.id,
                projectId,
              ]
            );
          } else {
            await connection.query(
              `INSERT INTO QATestCases (
              id, projectId, judul, deskripsi, tipeTesting, prioritas, caseId, expected, status, steps, history, createdAt, activeTesterId, activeTesterName, lockedAt, modulId,
              suiteId, rowNum, comment, evidenceUrl, evidenceType, evidenceName, linkedBugKey, commentsList, evidences
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                tc.id,
                projectId,
                tc.judul || tc.title,
                tc.deskripsi || tc.comment || null,
                tc.tipeTesting || tc.phase || "SIT",
                tc.prioritas || tc.priority || "Medium",
                tc.caseId || null,
                tc.expected || tc.expectedResult || null,
                tc.status || "untested",
                JSON.stringify(tc.steps || []),
                JSON.stringify(tc.history || []),
                tc.createdAt || new Date().toISOString(),
                tc.activeTesterId || null,
                tc.activeTesterName || null,
                tc.lockedAt || null,
                tc.modulId || tc.suiteId || null,
                tc.suiteId || null,
                tc.rowNum || null,
                tc.comment || null,
                tc.evidenceUrl || null,
                tc.evidenceType || null,
                tc.evidenceName || null,
                tc.linkedBugKey || null,
                JSON.stringify(tc.commentsList || []),
                JSON.stringify(tc.evidences || []),
              ]
            );
          }
        }

        res.json({
          status: "success",
          message: `Successfully synced ${testCases.length} test cases`,
        });
      } catch (error: any) {
        console.error("POST /api/projects/:projectId/qa-test-cases/sync error:", error);
        res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
      } finally {
        if (connection) connection.release();
      }
    }
  );

  // POST: AI-Powered QA Test Case Generator (Single)
  app.post(
    "/api/projects/:projectId/qa-test-cases/generate-ai",
    verifyProjectAccess(["*"]),
    async (req, res) => {
      try {
        const { judul, deskripsi, tipeTesting, prioritas } = req.body;
        if (!judul) {
          return res.status(400).json({
            status: "error",
            message: "Judul skenario uji diperlukan.",
          });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return res.status(400).json({
            status: "error",
            message: "Kunci API Gemini tidak dikonfigurasi pada server.",
          });
        }

        const ai = new GoogleGenAI({
          apiKey: apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });

        const response = await generateContentWithFallback(ai, {
          model: "gemini-flash-latest",
          contents: `Anda adalah pakar QA (Quality Assurance) profesional.
Buat skenario uji (test case) QA yang sangat detail dan sistematis berdasarkan informasi tugas berikut:

Nama Fitur/Skenario: ${judul}
Deskripsi/Konteks: ${deskripsi || "Tidak ada deskripsi rinci."}
Tipe Pengujian: ${tipeTesting || "Manual"}
Prioritas: ${prioritas || "Medium"}

Berikan langkah-langkah pengujian (langkah-langkah nyata yang harus dilakukan tester di browser/aplikasi) beserta hasil yang diharapkan (expected result) untuk masing-masing langkah tersebut.`,
          config: {
            temperature: 0.3,
            responseMimeType: "application/json",
            responseSchema: QA_SCENARIO_REFINEMENT_SCHEMA,
          },
        });

        const jsonStr = response.text ? response.text.trim() : "{}";
        let parsedData;
        try {
          parsedData = JSON.parse(jsonStr);
        } catch (parseErr) {
          console.error("JSON parse error in QA test generation:", parseErr);
          parsedData = {};
        }

        res.json({
          status: "success",
          data: parsedData,
        });
      } catch (error: any) {
        console.error("POST /api/projects/:projectId/qa-test-cases/generate-ai error:", error);
        res.status(500).json({
          status: "error",
          message: error.message || "Gagal membuat skenario uji otomatis dengan AI.",
        });
      }
    }
  );

  // POST: AI-Powered QA Test Cases Generator (Bulk based on project context)
  app.post("/api/v1/projects/:projectId/qa/generate-test-cases-ai", async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      const { suiteName, suitePhase, existingCases } = req.body || {};
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          status: "error",
          message: "Kunci API Gemini tidak dikonfigurasi pada server.",
        });
      }

      connection = await db.getConnection();

      const [meetingsPromise, documentsPromise, tasksPromise] = await Promise.all([
        connection.query("SELECT * FROM Meetings WHERE projectId = ? ORDER BY createdAt DESC", [
          projectId,
        ]),
        connection.query("SELECT * FROM Documents WHERE projectId = ? ORDER BY createdAt DESC", [
          projectId,
        ]),
        connection.query(
          "SELECT * FROM Tasks WHERE projectId = ? AND LOWER(status) NOT IN ('done', 'completed', 'closed') ORDER BY createdAt DESC",
          [projectId]
        ),
      ]);

      const meetingsList = (meetingsPromise[0] as any[]) || [];
      const documentsList = (documentsPromise[0] as any[]) || [];
      const tasksList = (tasksPromise[0] as any[]) || [];

      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const itemsToAggregate: { date: Date; text: string }[] = [];

      meetingsList.forEach((m) => {
        const date = m.createdAt ? new Date(m.createdAt) : new Date();
        if (date >= fourteenDaysAgo) {
          const aiSummaryText = m.aiSummary
            ? typeof m.aiSummary === "string"
              ? m.aiSummary
              : JSON.stringify(m.aiSummary)
            : "";
          itemsToAggregate.push({
            date,
            text: `[MEETING NOTES]\nTitle: ${m.title || ""}\nDescription: ${
              m.description || ""
            }\nTranscript: ${m.transcript || ""}\nSummary: ${aiSummaryText}\nCreated At: ${
              m.createdAt || ""
            }\n`,
          });
        }
      });

      documentsList.forEach((doc) => {
        const date = doc.createdAt ? new Date(doc.createdAt) : new Date();
        itemsToAggregate.push({
          date,
          text: `[DOCUMENTATION]\nTitle: ${doc.title || ""}\nDescription: ${
            doc.description || ""
          }\nType: ${doc.type || ""}\nCreated At: ${doc.createdAt || ""}\n`,
        });
      });

      tasksList.forEach((t) => {
        const date = t.createdAt ? new Date(t.createdAt) : new Date();
        itemsToAggregate.push({
          date,
          text: `[ACTIVE TASK]\nKey: ${t.taskKey || ""}\nTitle: ${
            t.title || ""
          }\nDescription: ${t.description || ""}\nAcceptance Criteria: ${
            t.acceptanceCriteria || ""
          }\nPriority: ${t.priority || ""}\nStatus: ${t.status || ""}\nCreated At: ${
            t.createdAt || ""
          }\n`,
        });
      });

      itemsToAggregate.sort((a, b) => b.date.getTime() - a.date.getTime());

      let aggregatedPrompt = "";
      const charLimit = 80000;
      for (const item of itemsToAggregate) {
        if (aggregatedPrompt.length + item.text.length > charLimit) {
          break;
        }
        aggregatedPrompt += item.text + "\n";
      }

      if (aggregatedPrompt.trim().length === 0) {
        aggregatedPrompt =
          "Tidak ada meeting notes 14 hari terakhir, dokumen, atau task aktif untuk project ini.";
      }

      let suiteContextPrompt = "";
      if (suiteName) {
        suiteContextPrompt = `\n\nKonteks Tambahan (Fokus Utama):\nAnda sedang menambahkan skenario pengujian baru untuk test suite aktif bernama "${suiteName}" (Fase: ${
          suitePhase || "SIT"
        }).\n`;
        if (existingCases && existingCases.length > 0) {
          suiteContextPrompt += `Skenario pengujian yang SUDAH ada dalam test suite ini adalah:\n${JSON.stringify(
            existingCases
          )}\nHarap fokuskan untuk membuat skenario uji pelengkap yang menguji kasus ekstrem (edge cases) atau alur fungsionalitas lain yang belum tercover di atas, tanpa menduplikasi skenario pengujian yang sudah ada.\n`;
        }
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const response = await generateContentWithFallback(ai, {
        model: "gemini-flash-latest",
        contents: `Anda adalah Principal QA Engineer dan AI Integration Specialist untuk LanPro.
Berdasarkan data project teragregasi di bawah ini (yang terdiri dari dokumen fungsional, meeting notes terbaru, dan backlog/acceptance criteria aktif), buatlah daftar skenario uji (test cases) yang komprehensif, terstruktur, sistematis, dan siap pakai untuk tim pengujian.
${suiteContextPrompt}
Format keluaran HARUS berupa array JSON yang mematuhi skema berikut secara ketat.

DATA AGREGASI PROJECT:
---
${aggregatedPrompt}
---`,
        config: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: QA_TEST_CASE_SUGGESTION_SCHEMA,
        },
      });

      const responseText = response.text ? response.text.trim() : "[]";
      let testCases;
      try {
        testCases = JSON.parse(responseText);
      } catch (parseErr) {
        console.error("JSON parse error in test cases generation:", parseErr);
        testCases = [];
      }

      res.json({
        status: "success",
        data: testCases,
      });
    } catch (error: any) {
      console.error("POST /api/v1/projects/:projectId/qa/generate-test-cases-ai error:", error);
      res.status(500).json({
        status: "error",
        message: error.message || "Gagal membuat test case dengan AI.",
      });
    } finally {
      if (connection) connection.release();
    }
  });
}

export default setupQARoutes;
