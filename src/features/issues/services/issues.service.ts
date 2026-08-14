/**
 * Lapisan akses data Issue List.
 *
 * Diekstrak dari hooks.ts dan index.tsx (Fase 3 — Anti-God-Object).
 */

import { apiRequest } from '../../../lib/api';

/** Bentuk respons standar backend. */
export interface IssuesApiResponse {
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

/** Membuat task baru dari baris tambah-cepat di Issue List. */
export async function createTask(
  projectId: string,
  userId: string,
  payload: unknown,
): Promise<IssuesApiResponse> {
  return apiRequest(`/api/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: { 'x-user-id': userId },
    body: payload,
  });
}

/**
 * Menyimpan urutan baru backlog setelah drag-and-drop.
 *
 * Mengirim seluruh daftar ID terurut sekaligus, bukan satu per satu, sehingga
 * backend dapat menuliskan ulang prioritasnya dalam satu transaksi.
 */
export async function reorderTasks(
  projectId: string,
  orderedIds: string[],
): Promise<IssuesApiResponse> {
  return apiRequest(`/api/projects/${projectId}/tasks/reorder`, {
    method: 'PUT',
    body: { orderedIds },
  });
}
