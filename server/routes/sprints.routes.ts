import { Express } from "express";
import crypto from "crypto";
import mysqlPool from "../../src/lib/db";
import { verifyProjectAccess } from "../middleware/rbac";

export function setupSprintsRoutes(
  app: Express,
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
  // GET: List Sprints for a project
  app.get(
    "/api/projects/:projectId/sprints",
    verifyProjectAccess(["*"]),
    async (req, res) => {
      let connection;
      try {
        const { projectId } = req.params;
        connection = await mysqlPool.getConnection();
        const [rows] = await connection.query(
          "SELECT * FROM Sprints WHERE projectId = ? ORDER BY startDate ASC",
          [projectId]
        );
        res.json({ status: "success", data: rows });
      } catch (error: any) {
        console.error("LOG ANOMALI CRITICAL: GET /api/projects/:projectId/sprints error:", error);
        res
          .status(500)
          .json({ status: "error", message: "Terjadi kesalahan internal server" });
      } finally {
        if (connection) connection.release();
      }
    }
  );

  // POST: Create Sprint
  app.post(
    "/api/projects/:projectId/sprints",
    verifyProjectAccess(["admin", "manager", "head"]),
    async (req: any, res) => {
      let connection;
      try {
        const { projectId } = req.params;
        const { name, goal, startDate, endDate, status } = req.body;
        connection = await mysqlPool.getConnection();

        const [proj]: any = await connection.query(
          "SELECT category FROM Projects WHERE id = ?",
          [projectId]
        );
        if (proj.length > 0 && proj[0].category === "Waterfall") {
          return res.status(400).json({
            status: "error",
            message:
              "Metodologi Waterfall tidak mendukung pembuatan Sprint. Gunakan Milestone atau GANTT Chart.",
          });
        }

        const newId = crypto.randomUUID();

        await connection.query(
          "INSERT INTO Sprints (id, projectId, name, goal, startDate, endDate, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            newId,
            projectId,
            name,
            goal || "",
            startDate || null,
            endDate || null,
            status || "planned",
          ]
        );

        const userIdStr = req.headers["x-user-id"] || "guest";
        await createAuditLog(
          userIdStr as string,
          projectId,
          "CREATE",
          "Sprints",
          newId,
          null,
          req.body
        );

        res.json({
          status: "success",
          data: {
            id: newId,
            projectId,
            name,
            goal,
            startDate,
            endDate,
            status: status || "planned",
          },
        });
      } catch (error: any) {
        console.error(
          "LOG ANOMALI CRITICAL: POST /api/projects/:projectId/sprints error:",
          error
        );
        res
          .status(500)
          .json({ status: "error", message: "Terjadi kesalahan internal server" });
      } finally {
        if (connection) connection.release();
      }
    }
  );

  // PUT: Update Sprint
  app.put(
    "/api/projects/:projectId/sprints/:id",
    verifyProjectAccess(["admin", "manager", "head"]),
    async (req, res) => {
      let connection;
      try {
        const { id } = req.params;
        connection = await mysqlPool.getConnection();

        const [existingSprints]: any = await connection.query(
          "SELECT * FROM Sprints WHERE id = ?",
          [id]
        );
        if (existingSprints.length === 0) {
          return res
            .status(404)
            .json({ status: "error", message: "Sprint tidak ditemukan" });
        }

        const existing = existingSprints[0];
        const finalName = req.body.hasOwnProperty("name")
          ? req.body.name
          : existing.name;
        const finalGoal = req.body.hasOwnProperty("goal")
          ? req.body.goal
          : existing.goal;
        const finalStartDate = req.body.hasOwnProperty("startDate")
          ? req.body.startDate
          : existing.startDate;
        const finalEndDate = req.body.hasOwnProperty("endDate")
          ? req.body.endDate
          : existing.endDate;
        const finalStatus = req.body.hasOwnProperty("status")
          ? req.body.status
          : existing.status;

        await connection.query(
          "UPDATE Sprints SET name=?, goal=?, startDate=?, endDate=?, status=? WHERE id=?",
          [
            finalName,
            finalGoal,
            finalStartDate || null,
            finalEndDate || null,
            finalStatus,
            id,
          ]
        );

        res.json({ status: "success", message: "Sprint updated" });
      } catch (error: any) {
        console.error(
          "LOG ANOMALI CRITICAL: PUT /api/projects/:projectId/sprints/:id error:",
          error
        );
        res
          .status(500)
          .json({ status: "error", message: "Terjadi kesalahan internal server" });
      } finally {
        if (connection) connection.release();
      }
    }
  );

  // DELETE: Remove Sprint
  app.delete(
    "/api/projects/:projectId/sprints/:id",
    verifyProjectAccess(["admin", "manager", "head"]),
    async (req, res) => {
      try {
        const { id, projectId } = req.params;
        const connection = await mysqlPool.getConnection();
        await connection.query("DELETE FROM Sprints WHERE id = ? AND projectId = ?", [
          id,
          projectId,
        ]);
        connection.release();
        res.json({ status: "success", message: "Sprint deleted" });
      } catch (error: any) {
        console.error(
          "LOG ANOMALI CRITICAL: DELETE /api/projects/:projectId/sprints/:id error:",
          error
        );
        res
          .status(500)
          .json({ status: "error", message: "Terjadi kesalahan internal server" });
      }
    }
  );
}

export default setupSprintsRoutes;
