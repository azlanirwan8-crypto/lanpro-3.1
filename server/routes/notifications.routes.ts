/**
 * Rute notifikasi pengguna.
 *
 * Diekstrak dari task.routes.ts. Berkas itu bukan berkas task saja: ia juga
 * menampung seluruh endpoint chat dan notifikasi — pola grab-bag yang sama
 * seperti meetings.routes.ts sebelum dipecah. Isi handler tidak diubah
 * sebaris pun; yang berpindah hanya tempatnya.
 */
import express from "express";
import crypto from "crypto";
import db from "../../src/lib/db";
import { matchesCaller } from "../services/task.service";

const router = express.Router();

router.get("/api/users/:userId/notifications", async (req, res) => {
  let connection;
  try {
    // 1. EKSTRAKSI USER ID SECARA DINAMIS (Anti-IDOR / Data Leakage Protection)
    const activeUser = (req as any).user;
    if (!activeUser) {
      return res
        .status(401)
        .json({ status: "error", message: "Akses tidak sah: Sesi tidak valid atau belum login." });
    }

    const activeUserId = activeUser.id || activeUser.uid;
    const requesterRole = activeUser.role || "user";

    // Enforce dynamic user query & isolate user data dynamically (No hardcoded names)
    let targetUserId = activeUserId;
    if (requesterRole === "admin") {
      // Global administrators can query target users for debugging/troubleshooting
      targetUserId = req.params.userId || activeUserId;
    }

    connection = await db.getConnection();

    // Support fetching notifications by both db standard id and firebase uid
    const [uCheck]: any = await connection.query(
      "SELECT id, uid, displayName, username, role FROM Users WHERE id = ? OR uid = ?",
      [targetUserId, targetUserId]
    );

    let userIds = [targetUserId];
    let dbUserId = targetUserId;
    let firebaseUid = targetUserId;
    let userDisplayName = "";
    let userUsername = "";
    let globalRole = "user";

    if (uCheck.length > 0) {
      userIds = [uCheck[0].id, uCheck[0].uid].filter(Boolean);
      dbUserId = uCheck[0].id;
      firebaseUid = uCheck[0].uid;
      userDisplayName = uCheck[0].displayName || "";
      userUsername = uCheck[0].username || "";
      globalRole = uCheck[0].role || "user";
    }

    // Fetch user's project roles from ProjectMembers
    const [pmRows]: any = await connection.query(
      "SELECT projectId, role FROM ProjectMembers WHERE userId = ? OR userId = ?",
      [dbUserId, firebaseUid]
    );

    const projectRoles: Record<string, string> = {};
    const adminProjectIds: string[] = [];
    const qaProjectIds: string[] = [];

    for (const pm of pmRows) {
      if (pm.projectId) {
        const rawRole = (pm.role || "").toLowerCase().trim();
        let role = rawRole;
        if (rawRole === "qa engineer" || rawRole === "qa") {
          role = "qa";
          qaProjectIds.push(pm.projectId);
        } else if (rawRole === "ui/ux designer") {
          role = "ui/ux";
        } else if (rawRole === "database admin (dba)" || rawRole === "database admin") {
          role = "dba";
        } else if (rawRole === "architecture") {
          role = "arsitektur";
        } else if (rawRole === "business analyst") {
          role = "bisnis analyst";
        } else if (rawRole === "project admin" || rawRole === "admin") {
          role = "admin";
          adminProjectIds.push(pm.projectId);
        }
        projectRoles[pm.projectId] = role;
      }
    }

    // Also fetch if user is owner of any project (treat as admin)
    const [ownerRows]: any = await connection.query(
      "SELECT id FROM Projects WHERE ownerId = ? OR ownerId = ?",
      [dbUserId, firebaseUid]
    );
    for (const p of ownerRows) {
      projectRoles[p.id] = "admin";
      if (!adminProjectIds.includes(p.id)) {
        adminProjectIds.push(p.id);
      }
    }

    // Secure, high-performance, and unified candidate selection query (Anti-IDOR)
    const sqlQuery = `
        SELECT n.*, 
               t.projectId as taskProjectId, t.assigneeId, t.reporterId, t.status as taskStatus,
               pt.reporterId as parentTaskReporterId,
               m.projectId as meetingProjectId,
               a.projectId as activityProjectId
        FROM Notifications n
        LEFT JOIN Tasks t ON n.relatedId = t.id
        LEFT JOIN Tasks pt ON t.parentId = pt.id
        LEFT JOIN Meetings m ON n.relatedId = m.id
        LEFT JOIN ActivityLogs a ON n.relatedId = a.id
        WHERE n.recipientId IN (?)
        ORDER BY n.createdAt DESC
        LIMIT 150
      `;

    const [rows]: any = await connection.query(sqlQuery, [userIds]);

    // Dynamic multi-layered verification filter for role-based security & spam protection
    const filteredNotifications = rows.filter((row: any) => {
      const projId = row.taskProjectId || row.meetingProjectId || row.activityProjectId || null;

      // Resolve dynamic authorization context based on current database state (no hardcoding)
      const isAdminGlobally = globalRole === "admin";
      const roleInProject = projId ? projectRoles[projId] : null;
      const isProjectAdmin = roleInProject === "admin";
      const isUserAdmin = isAdminGlobally || isProjectAdmin;

      // Direct context variables (Assignee/Creator/Parent Epic Creator mapping)
      const isAssignee = row.assigneeId === dbUserId || row.assigneeId === firebaseUid;
      const isCreator = row.reporterId === dbUserId || row.reporterId === firebaseUid;
      const isParentEpicReporter =
        row.parentTaskReporterId &&
        (row.parentTaskReporterId === dbUserId || row.parentTaskReporterId === firebaseUid);

      // Target of action: user is mentioned or explicitly involved in the notification message
      const isTargetAksi =
        isAssignee ||
        (userDisplayName && row.message && row.message.includes(userDisplayName)) ||
        (userUsername && row.message && row.message.includes(userUsername));

      // Mentioned: explicit check for '@' prefix followed by username or display name
      const isMentioned =
        (userUsername &&
          row.message &&
          row.message.toLowerCase().includes("@" + userUsername.toLowerCase())) ||
        (userDisplayName &&
          row.message &&
          row.message.toLowerCase().includes("@" + userDisplayName.toLowerCase()));

      const hasDirectContext =
        isAssignee || isCreator || isParentEpicReporter || isTargetAksi || isMentioned;

      // System or general notification not tied to any project is visible to the recipient
      if (!projId) {
        // If the notification type is project_activity, task, or meeting, or has project/tugas keywords,
        // then it is NOT a general system notification.
        const isProjectOrTaskRelated =
          row.type === "project_activity" ||
          row.type === "task" ||
          row.type === "meeting" ||
          (row.title &&
            (row.title.toLowerCase().includes("proyek") ||
              row.title.toLowerCase().includes("project") ||
              row.title.toLowerCase().includes("tugas") ||
              row.title.toLowerCase().includes("task"))) ||
          (row.message &&
            (row.message.toLowerCase().includes("proyek") ||
              row.message.toLowerCase().includes("project") ||
              row.message.toLowerCase().includes("tugas") ||
              row.message.toLowerCase().includes("task")));

        if (isProjectOrTaskRelated) {
          // Project/Task related: Non-admins must have direct context (target of action or mentioned)
          if (isUserAdmin) {
            return true;
          }
          return hasDirectContext;
        }

        return true;
      }

      // --- 1. JALUR AKSES ADMIN (GLOBAL & PROJECT ADMIN) ---
      if (isUserAdmin) {
        // Administrators can view all project activity notifications
        return true;
      }

      // --- 2. JALUR AKSES USER BIASA (NON-ADMIN) ---
      // If they are not in the project, block immediately (Information Barrier)
      if (!roleInProject) {
        return false;
      }

      // Role-specific granular rules for non-admin:
      if (roleInProject === "viewer") {
        // Viewers only receive notifications if explicitly @mentioned
        return isMentioned;
      }

      if (roleInProject === "qa") {
        // QA Engineers can view tasks assigned to them, created by them, or status updates transitioning to testing states
        const isQAStatus =
          row.taskStatus &&
          (row.taskStatus.toLowerCase() === "ready for qa" ||
            row.taskStatus.toLowerCase() === "testing" ||
            row.taskStatus.toLowerCase() === "uat");
        return hasDirectContext || isQAStatus;
      }

      // Regular roles (Member, Developer, UI/UX Designer, DBA, Architecture, Analyst):
      // STRICT filter: only allow if user has direct involvement or direct mention (No cross-talk spam)
      return hasDirectContext;
    });

    // Limit to max 50 for performance and layout compact-ability
    res.json({ status: "success", data: filteredNotifications.slice(0, 50) });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: GET /api/users/:userId/notifications error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  } finally {
    if (connection) connection.release();
  }
});

router.post("/api/users/:userId/notifications", async (req, res) => {
  let connection;
  try {
    const { userId } = req.params;
    const { type, title, message, relatedId, senderId, read } = req.body;
    connection = await db.getConnection();

    const newId = crypto.randomUUID();

    await connection.query(
      "INSERT INTO Notifications (id, recipientId, senderId, title, message, type, relatedId, `read`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        newId,
        userId,
        senderId || null,
        title || "New Notification",
        message || "",
        type || "system",
        relatedId || null,
        read ? true : false,
      ]
    );

    res.json({
      status: "success",
      data: { id: newId, type, title, message, relatedId, senderId, read },
    });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: POST /api/users/:userId/notifications error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  } finally {
    if (connection) connection.release();
  }
});

router.put("/api/users/:userId/notifications/:id", async (req: any, res) => {
  let connection;
  try {
    const { userId, id } = req.params;
    const { read } = req.body;

    if (!matchesCaller(req.user, userId)) {
      return res.status(403).json({
        status: "error",
        message: "Akses ditolak: Anda hanya dapat mengubah notifikasi milik Anda sendiri.",
      });
    }

    connection = await db.getConnection();

    const [notifRows]: any = await connection.query(
      "SELECT recipientId FROM Notifications WHERE id = ?",
      [id]
    );
    if (notifRows.length === 0) {
      return res.status(404).json({ status: "error", message: "Notifikasi tidak ditemukan." });
    }
    if (!matchesCaller(req.user, notifRows[0].recipientId)) {
      return res
        .status(403)
        .json({ status: "error", message: "Akses ditolak: notifikasi ini bukan milik Anda." });
    }

    await connection.query("UPDATE Notifications SET `read` = ? WHERE id = ?", [
      read ? true : false,
      id,
    ]);

    res.json({ status: "success", message: "Notification updated" });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: PUT /api/users/:userId/notifications/:id error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  } finally {
    if (connection) connection.release();
  }
});

// ============================================
// LIVE CHAT WIDGET ENDPOINTS (LanPro Chat System)

export default router;
