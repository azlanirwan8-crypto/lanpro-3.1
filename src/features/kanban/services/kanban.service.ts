/**
 * Lapisan akses data Kanban Board.
 *
 * Diekstrak dari hooks/useKanbanLogic.ts (Fase 3 — Anti-God-Object).
 *
 * Sebelumnya `apiRequest` di-import secara dinamis di tengah handler
 * (`const { apiRequest } = await import(...)`). Import statis di sini membuat
 * dependensinya terlihat dari luar dan menghapus satu pemuatan modul di jalur
 * drag-and-drop, yang justru jalur paling sering dipakai di layar ini.
 */

import { apiRequest } from '../../../lib/api';

/** Bentuk respons standar backend. */
export interface KanbanApiResponse {
  status: string;
  data?: any;
  message?: string;
}

/**
 * Menentukan ID pengguna untuk header `x-user-id`.
 * Backend menerima "guest" sebagai penanda pengguna tak dikenal.
 */
export function resolveUserId(user: any): string {
  return user?.uid || user?.id || 'guest';
}

/**
 * Memperbarui task setelah dipindahkan antar kolom.
 *
 * `updates` berisi hanya field yang berubah (mis. status dan urutan), bukan
 * seluruh entitas task.
 */
export async function updateTask(
  projectId: string,
  taskId: string,
  userId: string,
  updates: unknown,
): Promise<KanbanApiResponse> {
  return apiRequest(`/api/projects/${projectId}/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'x-user-id': userId },
    body: updates,
  });
}
