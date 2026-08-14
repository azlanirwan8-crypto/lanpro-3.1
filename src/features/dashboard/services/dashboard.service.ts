/**
 * Lapisan akses data Dashboard.
 *
 * Diekstrak dari index.tsx (Fase 3 — Anti-God-Object).
 *
 * Dashboard hanya membaca ringkasan dari sumber daya milik fitur lain;
 * tidak ada operasi tulis di sini.
 */

import { apiRequest } from '../../../lib/api';

/** Bentuk respons standar backend. */
export interface DashboardApiResponse {
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

/** Mengambil daftar rapat untuk kartu ringkasan. */
export async function fetchMeetings(
  projectId: string,
  userId: string,
): Promise<DashboardApiResponse> {
  return apiRequest(`/api/projects/${projectId}/meetings`, {
    headers: { 'x-user-id': userId },
  });
}

/** Mengambil daftar dokumen untuk kartu ringkasan. */
export async function fetchDocuments(
  projectId: string,
  userId: string,
): Promise<DashboardApiResponse> {
  return apiRequest(`/api/projects/${projectId}/documents`, {
    headers: { 'x-user-id': userId },
  });
}
