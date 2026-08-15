/**
 * Logika pendukung rute task yang berdiri sendiri dari req/res.
 *
 * Keempat bagian di bawah sebelumnya berupa fungsi level-modul di dalam
 * task.routes.ts. Tak satu pun menyentuh request maupun response — semuanya
 * menerima argumen biasa dan mengembalikan nilai — sehingga tempatnya di
 * lapisan services. Dipindah apa adanya, tanpa perubahan logika.
 */
import crypto from 'crypto';

// True if `val` (a client-supplied id, e.g. senderId/receiverId/userId in a chat or
// notification request) actually identifies the authenticated caller — checked
// against both `id` and `uid` since different tables/flows use either as the
// user-reference value.
export function matchesCaller(reqUser: any, val: any): boolean {
  if (val === undefined || val === null) return false;
  return String(val) === String(reqUser?.id) || String(val) === String(reqUser?.uid);
}

export async function recordExecutionRunLog(
  connection: any,
  projectId: string,
  caseId: string,
  executionStatus: string,
  linkedIssueKey: string,
  executedByUserId: string,
  executedByName: string,
  evaluationNotes: string,
  evidences: any[]
) {
  const logId = crypto.randomUUID();
  await connection.query(
    `INSERT INTO QATestCaseExecutionLogs (id, projectId, caseId, executionStatus, linkedIssueKey, executedByUserId, executedByName, evaluationNotes, evidences)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [logId, projectId, caseId, executionStatus, linkedIssueKey, executedByUserId, executedByName, evaluationNotes, JSON.stringify(evidences || [])]
  );
}

export async function validateTimelineBoundaries(connection: any, projectId: string, sprintId: string | null, parentId: string | null, startDate: string | null, endDate: string | null) {
  // 1. Validate against Sprint (Planning) if sprintId is present
  if (sprintId && (startDate || endDate)) {
    const [sprintRows]: any = await connection.query("SELECT startDate, endDate, name FROM Sprints WHERE id = ? AND projectId = ?", [sprintId, projectId]);
    if (sprintRows.length > 0) {
      const sprint = sprintRows[0];
      if (sprint.startDate || sprint.endDate) {
        const sprintStart = sprint.startDate ? new Date(sprint.startDate).getTime() : null;
        const sprintEnd = sprint.endDate ? new Date(sprint.endDate).getTime() : null;
        const itemStart = startDate ? new Date(startDate).getTime() : null;
        const itemEnd = endDate ? new Date(endDate).getTime() : null;

        if (sprintStart && itemStart && itemStart < sprintStart) {
          return {
            code: "PLANNING_BOUNDARY_EXCEEDED",
            message: `Gagal Menyimpan: Tanggal mulai melampaui rentang jadwal Planning induk (${sprint.name}).`
          };
        }
        if (sprintEnd && itemStart && itemStart > sprintEnd) {
          return {
            code: "PLANNING_BOUNDARY_EXCEEDED",
            message: `Gagal Menyimpan: Tanggal mulai melampaui rentang jadwal Planning induk (${sprint.name}).`
          };
        }
        if (sprintStart && itemEnd && itemEnd < sprintStart) {
          return {
            code: "PLANNING_BOUNDARY_EXCEEDED",
            message: `Gagal Menyimpan: Tanggal selesai melampaui rentang jadwal Planning induk (${sprint.name}).`
          };
        }
        if (sprintEnd && itemEnd && itemEnd > sprintEnd) {
          return {
            code: "PLANNING_BOUNDARY_EXCEEDED",
            message: `Gagal Menyimpan: Tanggal selesai melampaui rentang jadwal Planning induk (${sprint.name}).`
          };
        }
      }
    }
  }

  // 2. Validate against Parent Epic if parentId is present
  if (parentId && (startDate || endDate)) {
    const [parentRows]: any = await connection.query("SELECT startDate, endDate, title FROM Tasks WHERE id = ? AND projectId = ?", [parentId, projectId]);
    if (parentRows.length > 0) {
      const parentEpic = parentRows[0];
      if (parentEpic.startDate || parentEpic.endDate) {
        const epicStart = parentEpic.startDate ? new Date(parentEpic.startDate).getTime() : null;
        const epicEnd = parentEpic.endDate ? new Date(parentEpic.endDate).getTime() : null;
        const itemStart = startDate ? new Date(startDate).getTime() : null;
        const itemEnd = endDate ? new Date(endDate).getTime() : null;

        if (epicStart && itemStart && itemStart < epicStart) {
          return {
            code: "EPIC_TIMELINE_EXCEEDED",
            message: "Peringatan: Tanggal mulai task tidak boleh lebih awal dari rentang tanggal Epic induk."
          };
        }
        if (epicEnd && itemStart && itemStart > epicEnd) {
          return {
            code: "EPIC_TIMELINE_EXCEEDED",
            message: "Peringatan: Tanggal mulai task tidak boleh melebihi rentang tanggal Epic induk."
          };
        }
        if (epicStart && itemEnd && itemEnd < epicStart) {
          return {
            code: "EPIC_TIMELINE_EXCEEDED",
            message: "Peringatan: Tanggal selesai task tidak boleh lebih awal dari rentang tanggal Epic induk."
          };
        }
        if (epicEnd && itemEnd && itemEnd > epicEnd) {
          return {
            code: "EPIC_TIMELINE_EXCEEDED",
            message: "Peringatan: Tanggal selesai task tidak boleh melebihi rentang tanggal Epic induk."
          };
        }
      }
    }
  }

  return null;
}

const DEFAULT_PERMISSIONS = {
  admin: { list: { create: true, read: true, update: true, delete: true } },
  head: { list: { create: false, read: true, update: false, delete: false } },
  manager: { list: { create: true, read: true, update: true, delete: true } },
  user: { list: { create: true, read: true, update: true, delete: false } },
  viewer: { list: { create: false, read: true, update: false, delete: false } },
};

export function checkUserPermissionBackend(role: string, customPermissions: any, action: 'update' | 'delete'): boolean {
  const userRole = (role || 'viewer').toLowerCase();
  const roleDefaults = (DEFAULT_PERMISSIONS as any)[userRole] || DEFAULT_PERMISSIONS.viewer;
  const defaultVal = roleDefaults.list[action];

  if (customPermissions) {
    const customList = customPermissions.list || customPermissions.issueList;
    if (customList && customList[action] !== undefined) {
      return !!customList[action];
    }
  }

  return defaultVal;
}
