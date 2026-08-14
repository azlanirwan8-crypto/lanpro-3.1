/**
 * Lapisan akses data Settings.
 *
 * Diekstrak dari components/BroadcastMonitor.tsx (Fase 3 — Anti-God-Object).
 */

import { apiRequest } from '../../../lib/api';

/** Bentuk respons standar backend. */
export interface SettingsApiResponse {
  status: string;
  data?: any;
  message?: string;
}

/** Mengambil daftar pengguna untuk daftar penerima broadcast. */
export async function fetchUsers(): Promise<SettingsApiResponse> {
  return apiRequest('/api/users');
}
