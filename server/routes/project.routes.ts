import express from "express";
import crypto from "crypto";
import db from "../../src/lib/db";
import { buatProyekDemoBni } from "../services/demo-seed.service";
import { authenticateJWT, verifyGlobalAdmin } from "../middleware/auth";
import { verifyProjectAccess } from "../middleware/rbac";
import { createAuditLog } from "../services/audit.service";
const router = express.Router();

router.get("/api/projects", async (req: any, res) => {
  let connection;
  try {
    connection = await db.getConnection();

    // Resolve caller identity from the verified JWT — never from a client-supplied
    // ?userId= query param, which previously let any user list any other user's
    // projects (or, with no userId at all, every project in the system).
    const callerId = req.user?.id || req.user?.uid;
    const [callerRows]: any = await connection.query(
      "SELECT id, role FROM Users WHERE id = ? OR uid = ?",
      [callerId, callerId]
    );
    const callerRole = callerRows[0]?.role;
    const resolvedCallerId = callerRows[0]?.id || callerId;

    let query = "SELECT * FROM Projects ORDER BY createdAt DESC";
    let params: any[] = [];

    if (callerRole !== "admin") {
      query = `
          SELECT p.* FROM Projects p
          LEFT JOIN ProjectMembers pm ON p.id = pm.projectId
          WHERE p.ownerId = ? OR pm.userId = ?
          GROUP BY p.id
          ORDER BY p.createdAt DESC
        `;
      params = [resolvedCallerId, resolvedCallerId];
    }

    const [rows] = await connection.query(query, params);

    // Populate member arrays & roles for each project
    const projects = rows as any[];
    if (projects.length > 0) {
      const projectIds = projects.map((p) => p.id);

      const [allMemberRows]: any = await connection.query(
        `SELECT pm.projectId, u.uid, u.id as uuid, pm.role 
           FROM ProjectMembers pm
           JOIN Users u ON (pm.userId = u.id OR pm.userId = u.uid)
           WHERE pm.projectId IN (?)`,
        [projectIds]
      );

      const membersByProject = new Map();

      for (const row of allMemberRows) {
        if (!membersByProject.has(row.projectId)) {
          membersByProject.set(row.projectId, { list: [], roles: {} });
        }
        const pData = membersByProject.get(row.projectId);
        if (row.uid && !pData.list.includes(row.uid)) pData.list.push(row.uid);
        if (row.uuid && !pData.list.includes(row.uuid)) pData.list.push(row.uuid);
        if (row.uid) pData.roles[row.uid] = row.role || "viewer";
        if (row.uuid) pData.roles[row.uuid] = row.role || "viewer";
      }

      for (const p of projects) {
        const pData = membersByProject.get(p.id) || { list: [], roles: {} };
        p.members = pData.list;
        p.memberRoles = pData.roles;
      }
    }

    res.json({ status: "success", data: projects });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: GET /api/projects error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  } finally {
    if (connection) connection.release();
  }
});

router.post("/api/projects/generate-bni-demo", authenticateJWT, async (req: any, res: any) => {
  // Seluruh logika penyemaian ada di lapisan service; rute hanya meneruskan.
  return buatProyekDemoBni(req, res);
});
router.get("/api/projects/:id", verifyProjectAccess(["*"]), async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await db.getConnection();
    const [rows] = await connection.query("SELECT * FROM Projects WHERE id = ?", [id]);

    if ((rows as any[]).length > 0) {
      const p = (rows as any[])[0];
      const [memberRows] = await connection.query(
        `SELECT u.uid, u.id as uuid, pm.role 
           FROM ProjectMembers pm
           JOIN Users u ON pm.userId = u.id
           WHERE pm.projectId = ?`,
        [p.id]
      );

      const membersList: string[] = [];
      const memberRoles: Record<string, string> = {};

      for (const m of memberRows as any[]) {
        membersList.push(m.uid);
        memberRoles[m.uid] = m.role || "viewer";
        memberRoles[m.uuid] = m.role || "viewer";
      }

      p.members = membersList;
      p.memberRoles = memberRoles;

      connection.release();
      res.json({ status: "success", data: p });
    } else {
      connection.release();
      res.status(404).json({ status: "error", message: "Project not found" });
    }
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: GET /api/projects/:id error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  }
});

router.post("/api/projects", async (req, res) => {
  let connection;
  try {
    const { name, description, ownerId, status, projectKey, category } = req.body;
    connection = await db.getConnection();

    const newId = crypto.randomUUID();
    const pKey = projectKey || "PRJ";

    // Resolve ownerId to internal database user id (UUID)
    let resolvedOwnerId = ownerId;
    const [uRows]: any = await connection.query("SELECT id FROM Users WHERE id = ? OR uid = ?", [
      ownerId,
      ownerId,
    ]);
    if (uRows.length > 0) {
      resolvedOwnerId = uRows[0].id;
    }

    await connection.query(
      "INSERT INTO Projects (id, name, projectKey, description, ownerId, status, category) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        newId,
        name,
        pKey,
        description || "",
        resolvedOwnerId,
        status || "Active",
        category || "Agile",
      ]
    );

    // Auto-add owner as member using resolved internal user id
    await connection.query(
      "INSERT INTO ProjectMembers (projectId, userId, role) VALUES (?, ?, ?)",
      [newId, resolvedOwnerId, "Admin"]
    );

    res.json({
      status: "success",
      data: {
        id: newId,
        name,
        projectKey: pKey,
        description,
        ownerId: resolvedOwnerId,
        status: status || "Active",
        category: category || "Agile",
      },
    });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: POST /api/projects error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  } finally {
    if (connection) connection.release();
  }
});

router.put(
  "/api/projects/:projectId/dashboard-layout",
  verifyProjectAccess(["admin", "manager", "head", "developer", "designer", "viewer", "*"]),
  async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      const { layout } = req.body;

      // Validasi tipe data array
      if (!Array.isArray(layout)) {
        return res
          .status(400)
          .json({ status: "error", message: "Layout harus berupa tipe data array." });
      }

      connection = await db.getConnection();
      const jsonLayout = JSON.stringify(layout);

      // Simpan ke dashboard_layout dan dashboardLayout untuk kompatibilitas penuh
      await connection.query(
        "UPDATE Projects SET dashboard_layout = ?, dashboardLayout = ? WHERE id = ?",
        [jsonLayout, jsonLayout, projectId]
      );

      res.json({ status: "success", message: "Layout updated" });
    } catch (error: any) {
      console.error(
        "LOG ANOMALI CRITICAL: PUT /api/projects/:projectId/dashboard-layout error:",
        error
      );
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.put(
  "/api/projects/:id",
  verifyProjectAccess(["admin", "manager", "head"]),
  async (req, res) => {
    let connection;
    try {
      const { id } = req.params;
      const {
        name,
        description,
        status,
        currentSprintId,
        projectKey,
        ownerId,
        category,
        taskCounter,
        dashboardLayout,
      } = req.body;
      connection = await db.getConnection();

      const updates = [];
      const values = [];
      const changedFields: any = {};

      // Whitelist: Only allow these column names in dynamic updates
      const ALLOWED_COLUMNS = [
        "name",
        "description",
        "status",
        "projectKey",
        "ownerId",
        "category",
        "taskCounter",
        "dashboardLayout",
      ];

      if (name !== undefined) {
        updates.push("name = ?");
        values.push(name);
        changedFields.name = name;
      }
      if (description !== undefined) {
        updates.push("description = ?");
        values.push(description);
        changedFields.description = description;
      }
      if (status !== undefined) {
        updates.push("status = ?");
        values.push(status);
        changedFields.status = status;
      }
      if (projectKey !== undefined) {
        updates.push("projectKey = ?");
        values.push(projectKey);
        changedFields.projectKey = projectKey;
      }
      if (ownerId !== undefined) {
        let resolvedOwnerId = ownerId;
        const [uRows]: any = await connection.query(
          "SELECT id FROM Users WHERE id = ? OR uid = ?",
          [ownerId, ownerId]
        );
        if (uRows.length > 0) {
          resolvedOwnerId = uRows[0].id;
        }
        updates.push("ownerId = ?");
        values.push(resolvedOwnerId);
        changedFields.ownerId = resolvedOwnerId;
      }
      if (category !== undefined) {
        updates.push("category = ?");
        values.push(category);
        changedFields.category = category;
      }
      if (taskCounter !== undefined) {
        updates.push("taskCounter = ?");
        values.push(taskCounter);
        changedFields.taskCounter = taskCounter;
      }
      if (dashboardLayout !== undefined) {
        updates.push("dashboardLayout = ?");
        values.push(dashboardLayout !== null ? JSON.stringify(dashboardLayout) : null);
        changedFields.dashboardLayout = dashboardLayout;
      }

      if (updates.length > 0) {
        values.push(id);
        const query = `UPDATE Projects SET ${updates.join(", ")} WHERE id = ?`;
        await connection.query(query, values);

        const userId = req.headers["x-user-id"] || "guest";
        await createAuditLog(userId as string, id, "UPDATE", "Projects", id, null, changedFields);
      }

      res.json({ status: "success", message: "Project updated" });
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: PUT /api/projects error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    } finally {
      if (connection) connection.release();
    }
  }
);

// --- LanPro v1.5: BNI SDLC Advisor Route ---
router.post(
  "/api/projects/:projectId/methodology",
  authenticateJWT,
  verifyProjectAccess(["admin", "manager", "head"]),
  async (req: any, res: any) => {
    let connection;
    try {
      const { projectId } = req.params;
      const { methodology, matrixScores } = req.body;
      const userId = req.user?.id || req.user?.uid || req.headers["x-user-id"] || "guest";

      if (!methodology) {
        return res.status(400).json({ status: "error", message: "Metodologi harus ditentukan." });
      }

      // Normalisasi input string agar kompatibel dengan standard data
      const normalizedMethodology = methodology.toString().toUpperCase();

      connection = await db.getConnection();

      // 1. Ambil data lama untuk Audit (Gunakan kolom 'category' sesuai schema.sql LanPro)
      const [oldRows]: any = await connection.query("SELECT category FROM Projects WHERE id = ?", [
        projectId,
      ]);
      if (oldRows.length === 0) {
        return res.status(404).json({ status: "error", message: "Proyek tidak ditemukan." });
      }
      const oldMethod = oldRows[0].category;

      // 2. Update Metodologi (Normalisasi input string menjadi HURUF BESAR)
      await connection.query("UPDATE Projects SET category = ? WHERE id = ?", [
        normalizedMethodology,
        projectId,
      ]);

      // 3. Simpan Audit Log Terperinci dengan Defensive Data Handling (Nested Try-Catch)
      const auditNewValues = {
        category: normalizedMethodology,
        matrixScores: matrixScores ? JSON.stringify(matrixScores) : null,
      };

      try {
        await createAuditLog(
          userId,
          projectId,
          "UPDATE",
          "Projects",
          projectId,
          { category: oldMethod },
          auditNewValues
        );
      } catch (auditError) {
        console.warn(
          "Peringatan: Gagal menyimpan jejak audit, tetapi metodologi berhasil diperbarui.",
          auditError
        );
      }

      res.json({
        status: "success",
        message: `Metodologi proyek berhasil diperbarui menjadi ${normalizedMethodology}.`,
        data: { methodology: normalizedMethodology },
      });
    } catch (error: any) {
      console.error("====== EROR KRITIKAL METODOLOGI BACKEND ======", error);
      res.status(500).json({
        status: "error",
        message: "Gagal memperbarui metodologi ke Waterfall akibat masalah integritas data server.",
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

router.delete(
  "/api/projects/:projectId",
  verifyProjectAccess(["admin", "head"]),
  async (req, res) => {
    let connection;
    try {
      const { projectId } = req.params;
      connection = await db.getConnection();

      await connection.beginTransaction();

      const cascadeQueries: [string, any[]][] = [
        [
          "DELETE FROM LinkedTasks WHERE sourceTaskId IN (SELECT id FROM Tasks WHERE projectId = ?) OR targetTaskId IN (SELECT id FROM Tasks WHERE projectId = ?)",
          [projectId, projectId],
        ],
        [
          "DELETE FROM Comments WHERE taskId IN (SELECT id FROM Tasks WHERE projectId = ?)",
          [projectId],
        ],
        [
          "DELETE FROM Attachments WHERE taskId IN (SELECT id FROM Tasks WHERE projectId = ?)",
          [projectId],
        ],
        [
          "DELETE FROM TaskExternalLinks WHERE taskId IN (SELECT id FROM Tasks WHERE projectId = ?)",
          [projectId],
        ],
        [
          "DELETE FROM TaskCustomFields WHERE taskId IN (SELECT id FROM Tasks WHERE projectId = ?)",
          [projectId],
        ],
        [
          "DELETE FROM DiscussionPoints WHERE meetingId IN (SELECT id FROM Meetings WHERE projectId = ?)",
          [projectId],
        ],
        [
          "DELETE FROM MilestoneSprints WHERE milestoneId IN (SELECT id FROM Milestones WHERE projectId = ?)",
          [projectId],
        ],
        [
          "DELETE FROM meeting_details WHERE meeting_id IN (SELECT id FROM Meetings WHERE projectId = ?)",
          [projectId],
        ],
        ["DELETE FROM QATestCaseExecutionLogs WHERE projectId = ?", [projectId]],
        ["DELETE FROM Tasks WHERE projectId = ?", [projectId]],
        ["DELETE FROM Sprints WHERE projectId = ?", [projectId]],
        ["DELETE FROM ProjectMembers WHERE projectId = ?", [projectId]],
        ["DELETE FROM ProjectInvites WHERE projectId = ?", [projectId]],
        ["DELETE FROM Meetings WHERE projectId = ?", [projectId]],
        ["DELETE FROM Milestones WHERE projectId = ?", [projectId]],
        ["DELETE FROM Documents WHERE projectId = ?", [projectId]],
        ["DELETE FROM ActivityLogs WHERE projectId = ?", [projectId]],
        ["DELETE FROM AuditLogs WHERE projectId = ?", [projectId]],
        ["DELETE FROM QATestCases WHERE projectId = ?", [projectId]],
        ["DELETE FROM QATestSuites WHERE projectId = ?", [projectId]],
        ["DELETE FROM ProjectModules WHERE projectId = ?", [projectId]],
        ["DELETE FROM Projects WHERE id = ?", [projectId]],
      ];

      for (const [query, params] of cascadeQueries) {
        try {
          await connection.query(query, params);
        } catch (execError: any) {
          if (
            execError.code === "ER_NO_SUCH_TABLE" ||
            execError.code === "ER_BAD_TABLE_ERROR" ||
            (execError.message && execError.message.toLowerCase().includes("exist"))
          ) {
            continue; // Ignore missing table errors during cascade
          }
          throw execError;
        }
      }

      await connection.commit();

      res.json({
        status: "success",
        message: "Proyek berhasil dihapus beserta seluruh dependensinya.",
      });
    } catch (error: any) {
      if (connection) await connection.rollback();
      console.error("LOG ANOMALI CRITICAL: DELETE /api/projects error:", error);
      return res.status(500).json({
        status: "error",
        message: "Gagal menghapus proyek akibat kendala integritas database.",
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

// Project Members & Invites API
router.put("/api/projects/:id/members", authenticateJWT, verifyGlobalAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { memberRoles, newMemberId, newMemberRole } = req.body;
    const connection = await db.getConnection();

    // If we are passing full member roles map
    if (memberRoles) {
      for (const [userId, role] of Object.entries(memberRoles)) {
        // Resolve userId first (it might be uid or id)
        const [users] = await connection.query("SELECT id FROM Users WHERE id = ? OR uid = ?", [
          userId,
          userId,
        ]);
        if ((users as any[]).length > 0) {
          const resolvedUserId = (users as any[])[0].id;
          const [existing] = await connection.query(
            "SELECT * FROM ProjectMembers WHERE projectId = ? AND userId = ?",
            [id, resolvedUserId]
          );

          if ((existing as any[]).length > 0) {
            await connection.query(
              "UPDATE ProjectMembers SET role = ? WHERE projectId = ? AND userId = ?",
              [role, id, resolvedUserId]
            );
          } else {
            await connection.query(
              "INSERT INTO ProjectMembers (projectId, userId, role) VALUES (?, ?, ?)",
              [id, resolvedUserId, role]
            );
          }
        }
      }
    }

    // If we are adding/updating a single new member
    if (newMemberId && newMemberRole) {
      // Resolve user id first (if they passed firebase uid, get their UUID)
      const [users] = await connection.query("SELECT id FROM Users WHERE id = ? OR uid = ?", [
        newMemberId,
        newMemberId,
      ]);
      if ((users as any[]).length > 0) {
        const resolvedUserId = (users as any[])[0].id;

        const [existing] = await connection.query(
          "SELECT * FROM ProjectMembers WHERE projectId = ? AND userId = ?",
          [id, resolvedUserId]
        );

        if ((existing as any[]).length > 0) {
          await connection.query(
            "UPDATE ProjectMembers SET role = ? WHERE projectId = ? AND userId = ?",
            [newMemberRole, id, resolvedUserId]
          );
        } else {
          await connection.query(
            "INSERT INTO ProjectMembers (projectId, userId, role) VALUES (?, ?, ?)",
            [id, resolvedUserId, newMemberRole]
          );
        }

        // Handle hierarchy for Project Admin / Manager / Lead
        const { teamMemberIds } = req.body;
        if (
          ["admin", "manager", "lead"].includes(String(newMemberRole).toLowerCase()) &&
          Array.isArray(teamMemberIds) &&
          teamMemberIds.length > 0
        ) {
          for (const tmId of teamMemberIds) {
            const [tmUsers] = await connection.query(
              "SELECT id FROM Users WHERE id = ? OR uid = ?",
              [tmId, tmId]
            );
            if ((tmUsers as any[]).length > 0) {
              const resolvedTmId = (tmUsers as any[])[0].id;
              const [tmExisting] = await connection.query(
                "SELECT * FROM ProjectMembers WHERE projectId = ? AND userId = ?",
                [id, resolvedTmId]
              );

              if ((tmExisting as any[]).length > 0) {
                await connection.query(
                  "UPDATE ProjectMembers SET parentAdminId = ? WHERE projectId = ? AND userId = ?",
                  [resolvedUserId, id, resolvedTmId]
                );
              } else {
                await connection.query(
                  "INSERT INTO ProjectMembers (projectId, userId, role, parentAdminId) VALUES (?, ?, 'member', ?)",
                  [id, resolvedTmId, resolvedUserId]
                );
              }
            }
          }
        }
      }
    }

    connection.release();
    res.json({ status: "success", message: "Members updated" });
  } catch (error: any) {
    console.error("LOG ANOMALI CRITICAL: PUT /api/projects/:id/members error:", error);
    res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
  }
});

router.delete(
  "/api/projects/:id/members/:userId",
  authenticateJWT,
  verifyGlobalAdmin,
  async (req, res) => {
    try {
      const { id, userId } = req.params;
      const connection = await db.getConnection();

      // Resolve user id first (if they passed firebase uid, get their UUID)
      const [users] = await connection.query("SELECT id, uid FROM Users WHERE id = ? OR uid = ?", [
        userId,
        userId,
      ]);

      if ((users as any[]).length > 0) {
        const resolvedUserId = (users as any[])[0].id;
        const resolvedUserUid = (users as any[])[0].uid;

        // 1. Remove from ProjectMembers
        await connection.query(
          "DELETE FROM ProjectMembers WHERE projectId = ? AND (userId = ? OR userId = ?)",
          [id, resolvedUserId, userId]
        );

        // 2. Clear ownerId in Projects if user was owner
        await connection.query(
          "UPDATE Projects SET ownerId = NULL WHERE id = ? AND (ownerId = ? OR ownerId = ? OR ownerId = ?)",
          [id, resolvedUserId, resolvedUserUid, userId]
        );
      }

      connection.release();
      res.json({ status: "success", message: "Member removed from project" });
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: DELETE /api/projects/:id/members/:userId error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  }
);

router.put(
  "/api/projects/:id/invites",
  verifyProjectAccess(["admin", "manager", "head"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { emailToInvite } = req.body;
      const connection = await db.getConnection();

      await connection.query("INSERT INTO ProjectInvites (id, projectId, email) VALUES (?, ?, ?)", [
        crypto.randomUUID(),
        id,
        emailToInvite,
      ]);

      connection.release();
      res.json({ status: "success", message: "Invite added" });
    } catch (error: any) {
      console.error("LOG ANOMALI CRITICAL: PUT /api/projects/:id/invites error:", error);
      res.status(500).json({ status: "error", message: "Terjadi kesalahan internal server" });
    }
  }
);

// Sprints API

export default router;
