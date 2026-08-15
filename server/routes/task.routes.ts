import express from "express";
import crypto from "crypto";
import db from "../../src/lib/db";
import { authenticateJWT } from "../middleware/auth";
import { verifyProjectAccess } from "../middleware/rbac";
import { createAuditLog } from "../services/audit.service";
import {
  broadcastProjectNotification,
  sendProjectActivityNotification,
  checkUpcomingDueDates,
  createAutomatedNotification,
  createNotification,
} from "../services/notification.service";
import { optimisticLockingConflicts } from "../config/metrics";
import { GoogleGenAI } from "@google/genai";
import xss from "xss";
import { generateContentWithFallback } from "../services/ai.service";
import {
  matchesCaller,
  recordExecutionRunLog,
  validateTimelineBoundaries,
  checkUserPermissionBackend,
} from "../services/task.service";

const router = express.Router();

router.get("/api/projects/:projectId/tasks", verifyProjectAccess(["*"]), async (req: any, res) => {
  let connection;
  try {
    const { projectId } = req.params;
    const userId = req.user?.id || req.user?.uid;
    let userIdentifiers = [
      userId,
      req.user?.uid,
      req.user?.id,
      req.user?.username,
      req.user?.email,
      req.user?.displayName,
    ].filter(Boolean);

    connection = await db.getConnection();

    if (userId) {
      const [uRows]: any = await connection.query(
        "SELECT id, uid, username, email, displayName, nama_lengkap FROM Users WHERE id = ? OR uid = ?",
        [userId, userId]
      );
      if (uRows.length > 0) {
        const u = uRows[0];
        userIdentifiers.push(u.id, u.uid, u.username, u.email, u.displayName, u.nama_lengkap);
      }
    }
    userIdentifiers = Array.from(new Set(userIdentifiers.filter(Boolean)));

    // Check user role / admin status
    const [uRoleRows]: any = await connection.query(
      "SELECT role FROM Users WHERE id = ? OR uid = ?",
      [userId, userId]
    );
    const role = (uRoleRows && uRoleRows.length > 0 && uRoleRows[0]?.role) || "viewer";
    const isAdminOrManager = ["admin", "manager", "head"].includes(role.toLowerCase());

    let tasksRows: any = [];
    if (isAdminOrManager) {
      const [allRows]: any = await connection.query(
        "SELECT * FROM Tasks WHERE projectId = ? ORDER BY orderIndex ASC, createdAt DESC LIMIT 2000",
        [projectId]
      );
      tasksRows = allRows;
    } else {
      const [allProjTasks]: any = await connection.query(
        "SELECT * FROM Tasks WHERE projectId = ? ORDER BY orderIndex ASC, createdAt DESC LIMIT 2000",
        [projectId]
      );

      const directMatchedIds = new Set<string>();

      // Helper to check if user is reporter of any ancestor (e.g. parent Epic) of task t
      const hasAncestorReporterMatch = (task: any): boolean => {
        let curr = task;
        while (curr && curr.parentId) {
          const parent = allProjTasks.find((p: any) => p.id === curr.parentId);
          if (!parent) break;
          if (userIdentifiers.includes(parent.reporterId)) {
            return true;
          }
          curr = parent;
        }
        return false;
      };

      allProjTasks.forEach((t: any) => {
        if (!t) return;
        const isAssignee = userIdentifiers.includes(t.assigneeId);
        const isReporter = userIdentifiers.includes(t.reporterId);
        const hasParentReporter = hasAncestorReporterMatch(t);

        if (isAssignee || isReporter || hasParentReporter) {
          directMatchedIds.add(t.id);
        }
      });

      const allowedIds = new Set<string>(directMatchedIds);

      const addAncestors = (childTask: any) => {
        if (childTask && childTask.parentId) {
          const parent = allProjTasks.find((p: any) => p.id === childTask.parentId);
          if (parent && !allowedIds.has(parent.id)) {
            allowedIds.add(parent.id);
            addAncestors(parent);
          }
        }
      };

      directMatchedIds.forEach((id) => {
        const t = allProjTasks.find((x: any) => x.id === id);
        if (t) addAncestors(t);
      });

      tasksRows = allProjTasks.filter((t: any) => t && allowedIds.has(t.id));
    }

    const [linksRows]: any = await connection.query(
      "SELECT * FROM LinkedTasks WHERE sourceTaskId IN (SELECT id FROM Tasks WHERE projectId = ?)",
      [projectId]
    );

    // Use a Map for O(1) link lookup instead of nested loops O(N*M)
    const linksMap = new Map();
    (linksRows as any[]).forEach((link) => {
      if (!linksMap.has(link.sourceTaskId)) {
        linksMap.set(link.sourceTaskId, []);
      }
      const targetArray = linksMap.get(link.sourceTaskId);
      if (targetArray) {
        targetArray.push(link);
      } else {
        console.warn(`[AuditLog] linksMap missing entry for sourceTaskId: ${link.sourceTaskId}`);
      }
    });

    // Create a map of subtasks for each parent
    const subtasksMap = new Map();
    (tasksRows as any[]).forEach((t) => {
      if (t.parentId) {
        if (!subtasksMap.has(t.parentId)) {
          subtasksMap.set(t.parentId, []);
        }
        subtasksMap.get(t.parentId).push(t);
      }
    });

    // Fetch users map for reporter object resolution
    const [userRows]: any = await connection.query(
      "SELECT id, uid, displayName, nama_lengkap, username, email, photoURL FROM Users"
    );
    const usersMap = new Map();
    (userRows as any[]).forEach((u: any) => {
      const uObj = {
        id: u.id,
        uid: u.uid,
        name: u.displayName || u.nama_lengkap || u.username || u.email,
        displayName: u.displayName || u.nama_lengkap || u.username || u.email,
        avatar: u.photoURL || "",
        photoURL: u.photoURL || "",
        email: u.email || "",
      };
      if (u.id) usersMap.set(u.id, uObj);
      if (u.uid) usersMap.set(u.uid, uObj);
    });

    const tasks = tasksRows.map((t: any) => {
      const reporterUser = t.reporterId ? usersMap.get(t.reporterId) : null;
      return {
        ...t,
        key: t.taskKey,
        reporter: reporterUser || null,
        linkedTasks: linksMap.get(t.id) || [],
        subtasks: subtasksMap.get(t.id) || [],
      };
    });

    res.json({ status: "success", data: tasks });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: GET /api/projects/:projectId/tasks error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  } finally {
    if (connection) connection.release();
  }
});

router.get(
  "/api/projects/:projectId/team-tasks",
  verifyProjectAccess(["*"]),
  async (req: any, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      connection = await db.getConnection();

      const [tasksRows]: any = await connection.query(
        "SELECT * FROM Tasks WHERE projectId = ? ORDER BY orderIndex ASC, createdAt DESC LIMIT 2000",
        [projectId]
      );

      const [linksRows]: any = await connection.query(
        "SELECT * FROM LinkedTasks WHERE sourceTaskId IN (SELECT id FROM Tasks WHERE projectId = ?)",
        [projectId]
      );

      const linksMap = new Map();
      (linksRows as any[]).forEach((link) => {
        if (!linksMap.has(link.sourceTaskId)) {
          linksMap.set(link.sourceTaskId, []);
        }
        linksMap.get(link.sourceTaskId).push(link);
      });

      const [usersRows]: any = await connection.query(
        "SELECT id, uid, username, nama_lengkap, email, displayName, photoURL AS avatar FROM Users"
      );

      const usersMap = new Map();
      usersRows.forEach((u: any) => {
        const uObj = {
          id: u.id,
          uid: u.uid,
          username: u.username,
          nama_lengkap: u.nama_lengkap,
          email: u.email,
          displayName: u.displayName || u.nama_lengkap || u.username,
          avatar: u.avatar || null,
        };
        if (u.id) usersMap.set(u.id, uObj);
        if (u.uid) usersMap.set(u.uid, uObj);
      });

      const tasks = tasksRows.map((t: any) => {
        const reporterUser = t.reporterId ? usersMap.get(t.reporterId) : null;
        return {
          ...t,
          key: t.taskKey,
          reporter: reporterUser || null,
          linkedTasks: linksMap.get(t.id) || [],
          subtasks: [],
        };
      });

      res.json({ status: "success", data: tasks });
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: GET /api/projects/:projectId/team-tasks error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.post(
  "/api/projects/:projectId/tasks",
  authenticateJWT,
  verifyProjectAccess(["admin", "manager", "head", "developer", "member"]),
  async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      const {
        title,
        description,
        status,
        type,
        priority,
        assigneeId,
        reporterId,
        sprintId,
        parentId,
        acceptanceCriteria,
        storyPoints,
        projectRisk,
        customFields,
        startDate,
        endDate,
        attachments,
      } = req.body;
      connection = await db.getConnection();

      const newId = crypto.randomUUID();

      // Atomic increment-and-read with SELECT...FOR UPDATE to prevent race conditions
      await connection.query("START TRANSACTION");
      const [lockRows] = await connection.query(
        "SELECT id, projectKey, taskCounter FROM Projects WHERE id = ? FOR UPDATE",
        [projectId]
      );

      let taskKey = "TASK-1";
      if ((lockRows as any[]).length > 0) {
        const proj = (lockRows as any[])[0];
        const newCounter = (proj.taskCounter || 0) + 1;
        await connection.query("UPDATE Projects SET taskCounter = ? WHERE id = ?", [
          newCounter,
          projectId,
        ]);
        taskKey = `${proj.projectKey}-${newCounter}`;
      }
      await connection.query("COMMIT");

      // Extract active authenticated user
      const authenticatedUserStr =
        (req as any).user?.uid || (req as any).user?.id || req.headers["x-user-id"];

      let resolvedReporterId = reporterId;
      if (
        !resolvedReporterId ||
        resolvedReporterId === "guest" ||
        resolvedReporterId === "Unknown"
      ) {
        if (authenticatedUserStr && authenticatedUserStr !== "guest") {
          const [uCheck]: any = await connection.query(
            "SELECT id, uid FROM Users WHERE id = ? OR uid = ?",
            [authenticatedUserStr, authenticatedUserStr]
          );
          if (uCheck && uCheck.length > 0) {
            resolvedReporterId = uCheck[0].id || uCheck[0].uid;
          } else {
            resolvedReporterId = authenticatedUserStr;
          }
        }
      }

      // Fallback if still no reporterId
      if (
        !resolvedReporterId ||
        resolvedReporterId === "guest" ||
        resolvedReporterId === "Unknown"
      ) {
        const [projOwner]: any = await connection.query(
          "SELECT ownerId FROM Projects WHERE id = ?",
          [projectId]
        );
        if (projOwner && projOwner.length > 0 && projOwner[0].ownerId) {
          resolvedReporterId = projOwner[0].ownerId;
        } else {
          const [firstUser]: any = await connection.query(
            "SELECT id, uid FROM Users ORDER BY createdAt ASC LIMIT 1"
          );
          if (firstUser && firstUser.length > 0) {
            resolvedReporterId = firstUser[0].id || firstUser[0].uid;
          }
        }
      }

      const validationError = await validateTimelineBoundaries(
        connection,
        projectId,
        sprintId,
        parentId,
        startDate,
        endDate
      );
      if (validationError) {
        return res.status(400).json({
          status: "error",
          code: validationError.code,
          message: validationError.message,
        });
      }

      await connection.query(
        `INSERT INTO Tasks (id, projectId, sprintId, taskKey, title, description, status, priority, type, assigneeId, reporterId, parentId, acceptanceCriteria, storyPoints, projectRisk, startDate, endDate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId,
          projectId,
          sprintId || null,
          taskKey,
          title,
          description || "",
          status || "To Do",
          priority || "Medium",
          type || "task",
          assigneeId || null,
          resolvedReporterId || null,
          parentId || null,
          acceptanceCriteria || "",
          storyPoints || null,
          projectRisk || "Low",
          startDate || null,
          endDate || null,
        ]
      );

      // Save attachments if provided
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        for (const att of attachments) {
          await connection.query(
            `INSERT INTO TaskAttachments (id, taskId, name, url, fileType, uploadedByName, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [
              att.id || crypto.randomUUID(),
              newId,
              att.name || "Attachment",
              att.url || "",
              att.type || "file",
              att.uploadedByName || "User",
            ]
          );
        }
      }

      // Populate reporter object
      let reporterObj: any = null;
      if (resolvedReporterId) {
        const [rRows]: any = await connection.query(
          "SELECT id, uid, displayName, nama_lengkap, username, email, photoURL FROM Users WHERE id = ? OR uid = ?",
          [resolvedReporterId, resolvedReporterId]
        );
        if (rRows && rRows.length > 0) {
          const r = rRows[0];
          reporterObj = {
            id: r.id,
            uid: r.uid,
            name: r.displayName || r.nama_lengkap || r.username || r.email,
            displayName: r.displayName || r.nama_lengkap || r.username || r.email,
            avatar: r.photoURL || "",
            photoURL: r.photoURL || "",
            email: r.email || "",
          };
        }
      }

      const userIdStr = authenticatedUserStr || resolvedReporterId || "guest";
      await createAuditLog(
        userIdStr as string,
        projectId,
        "CREATE",
        "Tasks",
        newId,
        null,
        req.body
      );

      // Trigger automatic broadcast notifications to all team members of this project
      await sendProjectActivityNotification(projectId, userIdStr, "create_task", {
        taskId: newId,
      }).catch((err) => console.error("Create task notification broadcast failed:", err));

      res.json({
        status: "success",
        data: {
          id: newId,
          projectId,
          title,
          description,
          status: status || "To Do",
          type: type || "task",
          priority: priority || "Medium",
          assigneeId: assigneeId || null,
          reporterId: resolvedReporterId,
          reporter: reporterObj,
          sprintId: sprintId || null,
          parentId: parentId || null,
          taskKey,
          key: taskKey,
          startDate: startDate || null,
          endDate: endDate || null,
        },
      });
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: POST /api/projects/:projectId/tasks error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.put(
  "/api/projects/:projectId/tasks/reorder",
  authenticateJWT,
  verifyProjectAccess(["admin", "manager", "head"]),
  async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ status: "error", message: "orderedIds must be an array" });
      }

      connection = await db.getConnection();
      await connection.beginTransaction();

      for (let i = 0; i < orderedIds.length; i++) {
        await connection.query("UPDATE Tasks SET orderIndex = ? WHERE id = ? AND projectId = ?", [
          i,
          orderedIds[i],
          projectId,
        ]);
      }

      await connection.commit();
      connection.release();

      const io = req.app.get("io");
      if (io) {
        io.to(projectId).emit("project_updated", { type: "tasks_reordered", projectId });
      }
      res.json({ status: "success", message: "Tasks reordered successfully" });
    } catch (error: any) {
      if (connection) {
        await connection.rollback();
        connection.release();
      }
      console.error("Reorder tasks error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  }
);

router.put(
  "/api/projects/:projectId/tasks/:id",
  authenticateJWT,
  verifyProjectAccess(["admin", "manager", "head", "developer", "member"]),
  async (req, res) => {
    let connection;
    try {
      const { id, projectId } = req.params;
      const {
        status,
        type,
        priority,
        assigneeId,
        sprintId,
        parentId,
        dueDate,
        storyPoints,
        startDate,
        endDate,
        estimatedHours,
        loggedHours,
        acceptanceCriteria,
        version,
        isBlocked,
      } = req.body;
      const title = req.body.title !== undefined ? xss(req.body.title || "") : undefined;
      const description =
        req.body.description !== undefined ? xss(req.body.description || "") : undefined;
      const userId = (req as any).user?.id || req.headers["x-user-id"] || "guest";

      connection = await db.getConnection();

      // ============================================
      // 1. Fetch current state for Audit Log & Constraints
      // ============================================
      const [oldRows]: any = await connection.query(
        `SELECT t.*, p.category as projectCategory, pt.reporterId as parentEpicReporterId 
         FROM Tasks t 
         JOIN Projects p ON t.projectId = p.id 
         LEFT JOIN Tasks pt ON t.parentId = pt.id 
         WHERE t.id = ? AND t.projectId = ?`,
        [id, projectId]
      );
      if (oldRows.length === 0)
        return res.status(404).json({ status: "error", message: "Tugas tidak ditemukan." });
      const oldTask = oldRows[0];

      // Auto state transfer for Bug tasks when marked Done -> "Ready for Retest"
      let effectiveStatus = status;
      if (
        effectiveStatus &&
        (effectiveStatus.toLowerCase() === "done" || effectiveStatus.toLowerCase() === "selesai")
      ) {
        const isBugTask =
          (oldTask.type && oldTask.type.toLowerCase() === "bug") ||
          (oldTask.taskKey && oldTask.taskKey.toUpperCase().startsWith("BUG")) ||
          (type && type.toLowerCase() === "bug") ||
          (oldTask.title && oldTask.title.toLowerCase().includes("bug"));
        if (isBugTask) {
          effectiveStatus = "Ready for Retest";
        }
      }

      // Strict Authorization Cascade Check
      const [userRows]: any = await connection.query(
        "SELECT permissions, role FROM Users WHERE id = ? OR uid = ?",
        [userId, userId]
      );
      let userRole = "viewer";
      let userPerms: any = null;
      if (userRows.length > 0) {
        userRole = userRows[0].role || "viewer";
        const userPermsRaw = userRows[0].permissions;
        if (userPermsRaw) {
          try {
            userPerms = typeof userPermsRaw === "string" ? JSON.parse(userPermsRaw) : userPermsRaw;
          } catch (e) {
            console.error("Error parsing user permissions in update task route:", e);
          }
        }
      }

      const dbUserId = userRows[0]?.id;
      const dbUserUid = userRows[0]?.uid;
      const dbUsername = userRows[0]?.username;

      const isDirectReporter =
        oldTask.reporterId === userId ||
        oldTask.reporterId === (req as any).user?.uid ||
        oldTask.reporterId === (req as any).user?.username ||
        (dbUserId && oldTask.reporterId === dbUserId) ||
        (dbUserUid && oldTask.reporterId === dbUserUid) ||
        (dbUsername && oldTask.reporterId === dbUsername);

      const parentReporterId = oldTask.parentEpicReporterId;
      const isParentReporter = parentReporterId
        ? parentReporterId === userId ||
          parentReporterId === (req as any).user?.uid ||
          parentReporterId === (req as any).user?.username ||
          (dbUserId && parentReporterId === dbUserId) ||
          (dbUserUid && parentReporterId === dbUserUid) ||
          (dbUsername && parentReporterId === dbUsername)
        : false;

      // Check project level role
      let projectRole = "";
      const [memberRows]: any = await connection.query(
        "SELECT role FROM ProjectMembers WHERE projectId = ? AND userId = ?",
        [projectId, userId]
      );
      if (memberRows.length > 0) {
        projectRole = (memberRows[0].role || "").toLowerCase();
      }

      const isWorkspaceAdmin = (userRole || "").toLowerCase() === "admin";
      const isProjectManager = projectRole === "manager" || projectRole === "admin";
      const isAdmin = isWorkspaceAdmin || isProjectManager;

      // TIER 1 - RBAC PERMISSION CHECK
      const hasRolePermission = checkUserPermissionBackend(userRole, userPerms, "update");
      if (!hasRolePermission) {
        return res
          .status(403)
          .json({ status: "error", message: "Role Anda tidak memiliki akses untuk tindakan ini" });
      }

      // TIER 2 - DISCRETE PERMISSION / REPORTER OWNERSHIP & PARENT EPIC REPORTER CHECK
      if (sprintId !== undefined) {
        // Business Rule for Sprint Drag and Drop
        const isAuthorizedSprint = isDirectReporter || isParentReporter || isAdmin;
        if (!isAuthorizedSprint) {
          return res.status(403).json({
            status: "error",
            message: "Akses ditolak: Anda tidak memiliki wewenang untuk memindahkan task ini.",
          });
        }
      } else {
        // Standard updates ownership rule
        const isAuthorizedGeneral = isDirectReporter || isAdmin;
        if (!isAuthorizedGeneral) {
          return res.status(403).json({
            status: "error",
            message:
              "Hanya Reporter pembuat task ini atau Admin/Manager yang diizinkan melakukan perubahan/penghapusan",
          });
        }
      }

      // ============================================
      // MULTI-LEVEL PLANNING & EPIC TIMELINE BOUNDARY VALIDATION
      // ============================================
      const isDateOrRelUpdated =
        parentId !== undefined ||
        sprintId !== undefined ||
        startDate !== undefined ||
        endDate !== undefined ||
        dueDate !== undefined;
      const effectiveParentId = parentId !== undefined ? parentId : oldTask?.parentId;
      const effectiveSprintId = sprintId !== undefined ? sprintId : oldTask?.sprintId;
      const effectiveStartDate = startDate !== undefined ? startDate : oldTask?.startDate;
      const effectiveEndDate =
        endDate !== undefined ? endDate : dueDate !== undefined ? dueDate : oldTask?.endDate;

      if (isDateOrRelUpdated) {
        const validationError = await validateTimelineBoundaries(
          connection,
          projectId,
          effectiveSprintId,
          effectiveParentId,
          effectiveStartDate,
          effectiveEndDate
        );
        if (validationError) {
          return res.status(400).json({
            status: "error",
            code: validationError.code,
            message: validationError.message,
          });
        }
      }

      const isAgile = oldTask.projectCategory === "AGILE";
      const isWaterfall = oldTask.projectCategory === "WATERFALL";

      // ============================================
      // 2. AGILE CONSTRAINT: Optimistic Locking & Subtask Blocker
      // ============================================
      if (version !== undefined && oldTask.version !== version) {
        optimisticLockingConflicts.inc();

        // Catat sebagai log operasional karena lumrah terjadi di Agile Scrum
        await createAuditLog(
          userId as string,
          projectId,
          "UPDATE",
          "Tasks",
          id,
          { version: oldTask.version },
          { version: version, status: "409 CONFLICT" }
        );

        // Alert jika konflik terjadi (v1.5)
        // sendAlert(`Konflik Optimistic Locking terdeteksi pada Task ID ${id} oleh user ${userId}. (Server Ver: ${oldTask.version}, User Ver: ${version})`, 'warn');

        return res
          .status(409)
          .json({ status: "error", message: "Konflik versi tugas. Silakan refresh." });
      }

      /*
      // SUBTASK BLOCKER GUARD
      if (status && TERMINAL_STATUSES.includes(status.toLowerCase().trim())) {
        const [subtasks]: any = await connection.query("SELECT status FROM Subtasks WHERE taskId = ?", [id]);
        const unfinished = subtasks.filter((st: any) => !TERMINAL_STATUSES.includes(st.status.toLowerCase().trim()));
        if (unfinished.length > 0) {
           return res.status(422).json({ status: "error", message: "Gagal memindahkan task: Masih ada subtask yang belum selesai." });
        }
      }
      */

      // ============================================
      // 3. WATERFALL CONSTRAINT: Phase Gate Validation
      // ============================================
      if (isWaterfall && status === "Done" && oldTask.status !== "Done") {
        // Validasi apakah tugas ini memiliki dependensi (LinkedTasks) bertipe 'blocking'
        const [deps]: any = await connection.query(
          `
           SELECT tl.sourceId, t_dep.status 
           FROM LinkedTasks tl 
           JOIN Tasks t_dep ON tl.sourceId = t_dep.id 
           WHERE tl.targetId = ? AND tl.type = 'blocks'
         `,
          [id]
        );

        const unfinishedDeps = deps.filter((d: any) => d.status !== "Done");

        if (unfinishedDeps.length > 0) {
          // Pelanggaran Batasan Linimasa (Governance Audit)
          await createAuditLog(
            userId as string,
            projectId,
            "UPDATE",
            "Tasks",
            id,
            { status: oldTask.status },
            { status: "Done", constraintFailure: "WATERFALL_PHASE_GATE_VIOLATION" }
          );

          return res.status(403).json({
            status: "error",
            message:
              "Phase Gate Constraint: Anda tidak dapat menyelesaikan tugas Tahap ini. Terdapat dependensi prasyarat yang belum mencapai 100% ('Done').",
          });
        }
      }

      // ============================================
      // 4. HIERARCHICAL INTEGRITY: Sub-task Integrity Gate
      // ============================================
      if (status === "Done" && oldTask.status !== "Done") {
        // Check if this task has sub-tasks that are not finished (status != 'Done')
        const [subtasks]: any = await connection.query(
          `
            SELECT id, taskKey, title, status 
            FROM Tasks 
            WHERE parentId = ? AND status != 'Done'
         `,
          [id]
        );

        if (subtasks.length > 0) {
          const unfinishedKeys = subtasks.map((s: any) => s.taskKey || s.title || s.id).join(", ");

          // Log this hierarchical constraint violation in the audit logs
          await createAuditLog(
            userId as string,
            projectId,
            "UPDATE",
            "Tasks",
            id,
            { status: oldTask.status },
            { status: "Done", constraintFailure: "SUBTASK_INTEGRITY_VIOLATION" }
          );

          return res.status(400).json({
            status: "error",
            message: `Integritas Hirarki: Tidak dapat menyelesaikan tugas utama ini karena masih memiliki sub-task yang belum selesai (${unfinishedKeys}). Silakan selesaikan semua sub-task terlebih dahulu.`,
          });
        }
      }

      // Build dynamic update
      const updates = [];
      const values = [];
      const changedFields: any = {};
      const newValues: any = {};

      const ALLOWED_TASK_COLUMNS = [
        "title",
        "description",
        "status",
        "type",
        "priority",
        "assigneeId",
        "sprintId",
        "parentId",
        "dueDate",
        "storyPoints",
        "startDate",
        "endDate",
        "estimatedHours",
        "loggedHours",
        "acceptanceCriteria",
        "isBlocked",
      ];

      const checkUpdate = (field: string, val: any) => {
        if (!ALLOWED_TASK_COLUMNS.includes(field)) {
          console.warn(`Attempted to update disallowed task field: ${field}`);
          return;
        }
        if (val !== undefined && val !== oldTask[field]) {
          updates.push(`${field} = ?`);
          values.push(val);
          changedFields[field] = val;
          newValues[field] = val;
        }
      };

      checkUpdate("title", title);
      checkUpdate("description", description);
      checkUpdate("status", effectiveStatus);
      checkUpdate("type", type);
      checkUpdate("priority", priority);
      checkUpdate("assigneeId", assigneeId);
      checkUpdate("sprintId", sprintId);
      checkUpdate("parentId", parentId);
      checkUpdate("dueDate", dueDate);
      checkUpdate("storyPoints", storyPoints);
      checkUpdate("startDate", startDate);
      checkUpdate("endDate", endDate);
      checkUpdate("estimatedHours", estimatedHours);
      checkUpdate("loggedHours", loggedHours);
      checkUpdate("acceptanceCriteria", acceptanceCriteria);

      if (isBlocked !== undefined) {
        const oldBlockedVal = oldTask.isBlocked === true || oldTask.isBlocked === 1 ? true : false;
        const newBlockedVal = isBlocked ? true : false;
        if (newBlockedVal !== oldBlockedVal) {
          updates.push("isBlocked = ?");
          values.push(newBlockedVal);
          changedFields.isBlocked = newBlockedVal;
          newValues.isBlocked = newBlockedVal;
        }
      }

      if (updates.length > 0) {
        // Increment version on update
        updates.push("version = version + 1");

        values.push(id);

        let sql = `UPDATE Tasks SET ${updates.join(", ")} WHERE id = ?`;

        // Final guard for optimistic locking in SQL
        if (version !== undefined) {
          sql += " AND version = ?";
          values.push(version);
        }

        const [updateResult]: any = await connection.query(sql, values);

        if (updateResult.affectedRows === 0) {
          optimisticLockingConflicts.inc();
          return res.status(409).json({
            status: "error",
            message: "Gagal memperbarui: Data mungkin sudah berubah. Silakan coba lagi.",
          });
        }

        // 2. Log the activity (Enterprise Audit)
        await createAuditLog(
          userId as string,
          projectId,
          "UPDATE",
          "Tasks",
          id,
          oldTask,
          newValues
        );

        // 3. Broadcast real-time update (Socket.io Delta Update)
        const io = req.app.get("io");
        if (io) {
          io.to(projectId).emit("task_updated", {
            taskId: id,
            projectId,
            changes: changedFields,
            updatedBy: userId,
          });

          // Special TASK_MOVE broadcast if status changed
          if (changedFields.status) {
            io.to(projectId).emit("TASK_MOVE", {
              taskId: id,
              oldStatus: oldTask.status,
              newStatus: changedFields.status,
              updatedBy: userId,
            });
          }
        }

        // 4. Automated notifications for Blocked task status or isBlocked flag changes
        const isNowBlockedStatus =
          changedFields.status &&
          changedFields.status.toLowerCase() === "blocked" &&
          (!oldTask.status || oldTask.status.toLowerCase() !== "blocked");
        const isNowBlockedFlag =
          changedFields.isBlocked !== undefined &&
          changedFields.isBlocked === true &&
          (!oldTask.isBlocked || oldTask.isBlocked === false);

        if (isNowBlockedStatus || isNowBlockedFlag) {
          const recipientId =
            changedFields.assigneeId !== undefined ? changedFields.assigneeId : oldTask.assigneeId;
          if (recipientId) {
            const [updaterRows]: any = await connection.query(
              "SELECT displayName, username FROM Users WHERE id = ? OR uid = ?",
              [userId, userId]
            );
            const updaterName =
              updaterRows.length > 0
                ? updaterRows[0].displayName || updaterRows[0].username
                : "Seorang pengguna";
            const taskKey = oldTask.taskKey || oldTask.key || id;
            const taskTitle = oldTask.title || "Tugas";

            const title = "⚠️ Tugas Terblokir (Blocked)";
            const message = `Tugas "${taskTitle}" (${taskKey}) telah ditandai sebagai Terblokir (Blocked) oleh ${updaterName}.`;
            await createAutomatedNotification(recipientId, userId, title, message, "blocked", id);
          }
        }

        // Requirement 2: Automated State Machine & Workflow Rules for Bug/Issue Resolution
        const isIssueResolvedOrDone =
          changedFields.status &&
          [
            "done",
            "resolved",
            "ready for retest",
            "retest",
            "completed",
            "selesai",
            "done / closed",
          ].includes(changedFields.status.toLowerCase().trim());

        if (isIssueResolvedOrDone) {
          const taskKey = oldTask.taskKey || oldTask.key || id;
          const [updaterRows]: any = await connection.query(
            "SELECT displayName, username FROM Users WHERE id = ? OR uid = ?",
            [userId, userId]
          );
          const updaterName =
            updaterRows.length > 0
              ? updaterRows[0].displayName || updaterRows[0].username
              : "Developer";

          // Action 1: Detect all TEST_CASE_ID bound to this ISSUE_KEY
          const [linkedTCs]: any = await connection.query(
            "SELECT * FROM QATestCases WHERE (linkedBugKey = ? OR linkedBugKey = ?) AND projectId = ?",
            [taskKey, id, projectId]
          );

          if (linkedTCs && linkedTCs.length > 0) {
            for (const tc of linkedTCs) {
              // Action 2: Change execution status to [RETEST]
              await connection.query(
                "UPDATE QATestCases SET status = 'Retest' WHERE id = ? AND projectId = ?",
                [tc.id, projectId]
              );

              // Action 3: Non-Destructive Execution Run Log
              const notes = `Automated Workflow: Linked Issue #${taskKey} was marked as [${changedFields.status}] by ${updaterName}. Test case auto-transitioned to RETEST.`;
              await recordExecutionRunLog(
                connection,
                projectId,
                tc.id,
                "RETEST",
                taskKey,
                userId as string,
                updaterName,
                notes,
                []
              );

              // Action 4: Notification event to REPORTER_USER_ID
              const reporterUserId = oldTask.reporterId || tc.activeTesterId || userId;
              if (reporterUserId) {
                const notifTitle = "🔄 Test Case Ready for Retest";
                const notifMsg = `Issue #${taskKey} (${oldTask.title || "Bug"}) telah [${changedFields.status}] oleh ${updaterName}. Test Case "${tc.judul || tc.title}" kini siap diuji ulang (Retest).`;
                await createAutomatedNotification(
                  reporterUserId,
                  userId as string,
                  notifTitle,
                  notifMsg,
                  "bug_retest",
                  tc.id
                );
              }

              // Real-time Socket.io broadcast
              const io = req.app.get("io");
              if (io) {
                io.to(projectId).emit("QA_TESTCASE_UPDATED", {
                  testCaseId: tc.id,
                  projectId,
                  status: "Retest",
                  linkedBugKey: taskKey,
                });
              }
            }
          }
        }

        // Trigger activity notification using createNotification for status or assignee changes or description or AC changes
        const ioInstance = req.app.get("io");
        const notificationPromises = [];

        if (changedFields.status) {
          notificationPromises.push(
            createNotification(ioInstance, projectId, id, userId as string, "update_task", {
              field: "status",
              oldValue: oldTask.status,
              newValue: changedFields.status,
            }).catch((err) => console.error("Update status notification failed:", err))
          );
        } else if (changedFields.assigneeId !== undefined) {
          notificationPromises.push(
            createNotification(ioInstance, projectId, id, userId as string, "update_task", {
              field: "assigneeId",
              oldValue: oldTask.assigneeId,
              newValue: changedFields.assigneeId,
            }).catch((err) => console.error("Update assignee notification failed:", err))
          );
        } else if (changedFields.description !== undefined) {
          notificationPromises.push(
            createNotification(ioInstance, projectId, id, userId as string, "update_task", {
              field: "deskripsi",
              newValue: "Deskripsi diperbarui",
            }).catch((err) => console.error("Update description notification failed:", err))
          );
        } else if (changedFields.acceptanceCriteria !== undefined) {
          notificationPromises.push(
            createNotification(ioInstance, projectId, id, userId as string, "update_task", {
              field: "acceptanceCriteria",
              newValue: "Acceptance Criteria diperbarui",
            }).catch((err) => console.error("Update AC notification failed:", err))
          );
        }

        // Wait for all notifications to complete before responding
        if (notificationPromises.length > 0) {
          await Promise.allSettled(notificationPromises);
        }

        // Trigger immediate check if dueDate is updated to be within 24 hours
        if (changedFields.dueDate) {
          setImmediate(() => checkUpcomingDueDates());
        }
      }

      res.json({ status: "success", data: { id, ...changedFields } });
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: PUT /api/projects/:projectId/tasks/:id error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.delete(
  "/api/projects/:projectId/tasks/:id",
  authenticateJWT,
  verifyProjectAccess(["admin", "manager", "head", "developer", "member"]),
  async (req, res) => {
    let connection;
    try {
      const { id, projectId } = req.params;
      const userId = (req as any).user?.id || req.headers["x-user-id"] || "guest";
      connection = await db.getConnection();

      // Get task to check ownership
      const [taskRows]: any = await connection.query(
        "SELECT assigneeId, reporterId FROM Tasks WHERE id = ? AND projectId = ?",
        [id, projectId]
      );
      if (taskRows.length === 0) {
        return res.status(404).json({ status: "error", message: "Task not found" });
      }

      // Strict Authorization Cascade Check for Deletion
      const [userRows]: any = await connection.query(
        "SELECT id, uid, permissions, role FROM Users WHERE id = ? OR uid = ?",
        [userId, userId]
      );
      let userRole = "viewer";
      let userPerms: any = null;
      if (userRows.length > 0) {
        userRole = userRows[0].role || "viewer";
        const userPermsRaw = userRows[0].permissions;
        if (userPermsRaw) {
          try {
            userPerms = typeof userPermsRaw === "string" ? JSON.parse(userPermsRaw) : userPermsRaw;
          } catch (e) {
            console.error("Error parsing user permissions in delete task route:", e);
          }
        }
      }

      const dbUserId = userRows[0]?.id;
      const dbUserUid = userRows[0]?.uid;
      const dbUsername = userRows[0]?.username;

      const isReporter =
        taskRows[0].reporterId === userId ||
        taskRows[0].reporterId === (req as any).user?.uid ||
        taskRows[0].reporterId === (req as any).user?.username ||
        (dbUserId && taskRows[0].reporterId === dbUserId) ||
        (dbUserUid && taskRows[0].reporterId === dbUserUid) ||
        (dbUsername && taskRows[0].reporterId === dbUsername);

      // TIER 1 - RBAC PERMISSION CHECK
      const hasRolePermission = checkUserPermissionBackend(userRole, userPerms, "delete");
      if (!hasRolePermission) {
        return res
          .status(403)
          .json({ status: "error", message: "Role Anda tidak memiliki akses untuk tindakan ini" });
      }

      // TIER 2 - REPORTER OWNERSHIP CHECK
      if (!isReporter) {
        return res.status(403).json({
          status: "error",
          message: "Hanya Reporter pembuat task ini yang diizinkan melakukan perubahan/penghapusan",
        });
      }

      await createAuditLog(userId as string, projectId, "DELETE", "Tasks", id, null, null);
      await connection.query("DELETE FROM Tasks WHERE id = ? AND projectId = ?", [id, projectId]);

      res.json({ status: "success", message: "Task deleted" });
    } catch (error: any) {
      console.error(
        "LOG ANOMALI CRITICAL: DELETE /api/projects/:projectId/tasks/:id error:",
        error
      );
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  }
);

// Bulk Delete Tasks API
router.post(
  "/api/projects/:projectId/tasks/bulk-delete",
  authenticateJWT,
  verifyProjectAccess(["admin", "manager", "head", "developer", "member"]),
  async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      let taskIds = req.body?.taskIds;
      if (typeof taskIds === "string") {
        try {
          taskIds = JSON.parse(taskIds);
        } catch (e) {}
      }
      const userId =
        (req as any).user?.id || (req as any).user?.uid || req.headers["x-user-id"] || "guest";

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return res
          .status(400)
          .json({ status: "error", message: "taskIds must be a non-empty array" });
      }

      connection = await db.getConnection();

      // Get user role and permissions
      let userRole = "viewer";
      let userPerms = null;
      const [userRows]: any = await connection.query(
        "SELECT id, uid, role, permissions FROM Users WHERE id = ? OR uid = ?",
        [userId, userId]
      );
      if (userRows.length > 0) {
        userRole = userRows[0].role || "viewer";
        const userPermsRaw = userRows[0].permissions;
        if (userPermsRaw) {
          try {
            userPerms = typeof userPermsRaw === "string" ? JSON.parse(userPermsRaw) : userPermsRaw;
          } catch (e) {
            console.error("Error parsing user permissions in bulk delete task route:", e);
          }
        }
      } else {
        if (
          userId === "admin-uid" ||
          userId === "admin-fixed-id" ||
          (req as any).user?.role === "admin"
        ) {
          userRole = "admin";
        }
      }

      const dbUserId = userRows[0]?.id;
      const dbUserUid = userRows[0]?.uid;

      // Find tasks belonging to project
      const [taskRows]: any = await connection.query(
        "SELECT id, projectId, reporterId, assigneeId FROM Tasks WHERE id IN (?) AND projectId = ?",
        [taskIds, projectId]
      );

      const deletableTaskIds: string[] = [];
      for (const t of taskRows) {
        const isReporter =
          t.reporterId === userId ||
          t.reporterId === (req as any).user?.uid ||
          t.reporterId === (req as any).user?.username ||
          (dbUserId && t.reporterId === dbUserId) ||
          (dbUserUid && t.reporterId === dbUserUid);

        if (isReporter) {
          deletableTaskIds.push(t.id);
        }
      }

      if (deletableTaskIds.length === 0) {
        return res.status(403).json({
          status: "error",
          message: "You do not have permission to delete any of the selected tasks",
        });
      }

      await connection.query("DELETE FROM Tasks WHERE id IN (?) AND projectId = ?", [
        deletableTaskIds,
        projectId,
      ]);

      for (const deletedId of deletableTaskIds) {
        await createAuditLog(userId as string, projectId, "DELETE", "Tasks", deletedId, null, null);
      }

      res.json({
        status: "success",
        message: `Successfully deleted ${deletableTaskIds.length} tasks`,
        deletedIds: deletableTaskIds,
      });
    } catch (error: any) {
      console.error(
        "LOG ANOMALI CRITICAL: POST /api/projects/:projectId/tasks/bulk-delete error:",
        error
      );
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  }
);

// Comments API
router.get(
  "/api/projects/:projectId/tasks/:taskId/comments",
  verifyProjectAccess(["*"]),
  async (req, res) => {
    let connection;
    try {
      const { taskId } = req.params;
      connection = await db.getConnection();
      const [rows] = await connection.query(
        "SELECT * FROM Comments WHERE taskId = ? ORDER BY createdAt ASC LIMIT 200",
        [taskId]
      );
      res.json({ status: "success", data: rows });
    } catch (error: any) {
      console.error(
        "LOG ANOMALI CRITICAL: GET /api/projects/:projectId/tasks/:taskId/comments error:",
        error
      );
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.post(
  "/api/projects/:projectId/tasks/:taskId/comments",
  verifyProjectAccess(["*"]),
  async (req, res) => {
    let connection;
    try {
      const { projectId, taskId } = req.params;
      const { content, authorId } = req.body;
      const effectiveAuthorId =
        authorId ||
        (req as any).user?.uid ||
        (req as any).user?.id ||
        req.headers["x-user-id"] ||
        "guest";
      connection = await db.getConnection();

      const newId = crypto.randomUUID();

      await connection.query(
        "INSERT INTO Comments (id, taskId, content, authorId) VALUES (?, ?, ?, ?)",
        [newId, taskId, content, effectiveAuthorId]
      );

      // Trigger notification for commenting on task
      sendProjectActivityNotification(projectId, effectiveAuthorId as string, "comment_task", {
        taskId,
        commentContent: content,
      }).catch((err) => console.error("Comment notification broadcast failed:", err));

      res.json({
        status: "success",
        data: { id: newId, taskId, content, authorId: effectiveAuthorId },
      });
    } catch (error: any) {
      console.error(
        "LOG ANOMALI CRITICAL: POST /api/projects/:projectId/tasks/:taskId/comments error:",
        error
      );
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  }
);

// ActivityLogs API
router.get("/api/projects/:projectId/activity", verifyProjectAccess(["*"]), async (req, res) => {
  let connection;
  try {
    const { projectId } = req.params;
    connection = await db.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM ActivityLogs WHERE projectId = ? ORDER BY createdAt DESC LIMIT 50",
      [projectId]
    );
    res.json({ status: "success", data: rows });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: GET /api/projects/:projectId/activity error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  } finally {
    if (connection) connection.release();
  }
});

router.post("/api/projects/:projectId/activity", verifyProjectAccess(["*"]), async (req, res) => {
  let connection;
  try {
    const { projectId } = req.params;
    const { action, details, userId } = req.body;
    connection = await db.getConnection();

    const newId = crypto.randomUUID();

    await connection.query(
      `INSERT INTO ActivityLogs (id, projectId, userId, action, details)
         VALUES (?, ?, ?, ?, ?)`,
      [newId, projectId, userId || null, action, details || ""]
    );

    // Trigger automatic broadcast notifications to all team members of this project
    const notificationTitle = `Aktivitas Proyek: ${action}`;
    const notificationMessage = details || `Terdapat aktivitas "${action}" pada proyek ini.`;

    // Execute asynchronously so we don't block the client response
    broadcastProjectNotification(
      projectId,
      userId || null,
      notificationTitle,
      notificationMessage,
      "project_activity",
      newId
    ).catch((err) => console.error("Async broadcast error:", err));

    res.json({ status: "success", data: { id: newId } });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: POST /api/projects/:projectId/activity error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  } finally {
    if (connection) connection.release();
  }
});

// Notifications API

// Helper for Cycle Detection in Task Dependencies
async function hasCycle(connection: any, startNode: string, targetNode: string): Promise<boolean> {
  const visited = new Set<string>();
  const stack = [targetNode]; // We check if targetNode can eventually reach startNode

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === startNode) return true;
    if (visited.has(current)) continue;

    visited.add(current);

    // Find all tasks that depend on 'current'
    const [edges]: any = await connection.query(
      "SELECT targetTaskId FROM LinkedTasks WHERE sourceTaskId = ?",
      [current]
    );

    for (const edge of edges) {
      stack.push(edge.targetTaskId);
    }
  }
  return false;
}

// Task Links API
router.post(
  "/api/projects/:projectId/tasks/:taskId/links",
  verifyProjectAccess(["admin", "manager", "head", "developer", "member"]),
  async (req, res) => {
    let connection;
    try {
      const { taskId } = req.params;
      const { targetTaskId, relationType } = req.body;
      connection = await db.getConnection();

      // Cycle Detection: If A depends on B, we must ensure B does not already depend on A
      // In Gantt, if we add A -> B (Finish-to-Start), B is the target.
      // We check if B can reach A through existing links.
      if (relationType === "precedes" || relationType === "blocks") {
        const cycleDetected = await hasCycle(connection, taskId, targetTaskId);
        if (cycleDetected) {
          return res.status(400).json({
            status: "error",
            message:
              "Circular Dependency Terdeteksi! Tugas ini tidak bisa dihubungkan karena akan menyebabkan looping (saling menunggu).",
          });
        }
      }

      const newId = crypto.randomUUID();

      await connection.query(
        "INSERT INTO LinkedTasks (id, sourceTaskId, targetTaskId, relationType) VALUES (?, ?, ?, ?)",
        [newId, taskId, targetTaskId, relationType]
      );

      res.json({
        status: "success",
        data: { id: newId, sourceTaskId: taskId, targetTaskId, relationType },
      });
    } catch (error: any) {
      console.error(
        "LOG ANOMALI CRITICAL: POST /api/projects/:projectId/tasks/:taskId/links error:",
        error
      );
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.delete("/api/projects/:projectId/tasks/:taskId/links/:linkId", async (req, res) => {
  let connection;
  try {
    const { taskId, linkId } = req.params;
    connection = await db.getConnection();

    // Get targetTaskId first
    const [linkRows] = await connection.query("SELECT * FROM LinkedTasks WHERE id = ?", [linkId]);
    if ((linkRows as any[]).length > 0) {
      const link = (linkRows as any[])[0];
      // Delete original link
      await connection.query("DELETE FROM LinkedTasks WHERE id = ?", [linkId]);
      // Delete inverse link
      await connection.query(
        "DELETE FROM LinkedTasks WHERE sourceTaskId = ? AND targetTaskId = ?",
        [link.targetTaskId, link.sourceTaskId]
      );
    }

    res.json({ status: "success", message: "Task link deleted" });
  } catch (error: any) {
    console.error(
      "LOG ANOMALI CRITICAL: DELETE /api/projects/:projectId/tasks/:taskId/links/:linkId error:",
      error
    );
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  } finally {
    if (connection) connection.release();
  }
});

// Documents API

export default router;
