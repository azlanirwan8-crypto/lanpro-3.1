/**
 * Lapisan akses data Backup & Restore.
 *
 * Diekstrak dari BackupPanel.tsx (Fase 3 — Anti-God-Object).
 */

import { apiRequest } from '../../../lib/api';

/** Bentuk respons standar backend. */
export interface BackupApiResponse {
  status: string;
  data?: any;
  message?: string;
}

/**
 * Mengambil cadangan seluruh sistem.
 *
 * Mengembalikan data mentah; pemanggil yang mengubahnya menjadi berkas unduhan.
 */
export async function createBackup(): Promise<BackupApiResponse> {
  return apiRequest('/api/system/backup');
}

/**
 * Memulihkan sistem dari data cadangan.
 *
 * OPERASI DESTRUKTIF: menimpa data yang ada. Pemanggil wajib meminta
 * konfirmasi pengguna sebelum memanggil fungsi ini.
 */
export async function restoreBackup(data: unknown): Promise<BackupApiResponse> {
  return apiRequest('/api/system/restore', {
    method: 'POST',
    body: { data },
  });
}
