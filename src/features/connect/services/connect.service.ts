/**
 * Lapisan akses data konfigurasi koneksi database.
 *
 * Diekstrak dari ConnectPanel.tsx (Fase 3 — Anti-God-Object).
 *
 * CATATAN: teks antarmuka di panel ini masih menyebut MySQL, peninggalan
 * sebelum migrasi. Aplikasi kini Neon PostgreSQL saja (lihat src/lib/db.ts).
 * Teksnya sengaja tidak diubah di sini agar ekstraksi tetap murni refactor.
 */

import { apiRequest } from '../../../lib/api';

/** Bentuk respons standar backend. */
export interface ConnectApiResponse {
  status: string;
  data?: any;
  message?: string;
}

/** Mengambil konfigurasi database yang sedang aktif. */
export async function fetchDbConfig(): Promise<ConnectApiResponse> {
  return apiRequest('/api/system/db-config');
}

/** Menguji koneksi dengan konfigurasi yang diberikan, tanpa menyimpannya. */
export async function testDbConfig(config: unknown): Promise<ConnectApiResponse> {
  return apiRequest('/api/system/db-config', {
    method: 'POST',
    body: config,
  });
}

/**
 * Menyimpan konfigurasi dan mengganti koneksi secara langsung.
 *
 * Backend membangun ulang connection pool saat ini dipanggil, sehingga
 * request berikutnya memakai konfigurasi baru tanpa perlu restart.
 */
export async function saveDbConfig(config: unknown): Promise<ConnectApiResponse> {
  return apiRequest('/api/system/db-config/save', {
    method: 'POST',
    body: config,
  });
}
