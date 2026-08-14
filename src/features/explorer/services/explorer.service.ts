/**
 * Lapisan akses data DB Explorer.
 *
 * Diekstrak dari DbExplorerPanel.tsx (Fase 3 — Anti-God-Object).
 *
 * Seluruh endpoint di sini dilindungi `verifyGlobalAdmin` di backend, karena
 * memang mengeksekusi SQL sembarang. Panel ini hanya boleh dijangkau admin
 * global.
 *
 * Bentuk respons backend (`{ status, data, message }`) diteruskan apa adanya,
 * konsisten dengan service fitur lain.
 */

import { apiRequest } from '../../../lib/api';

/** Bentuk respons standar backend. */
export interface ExplorerApiResponse {
  status: string;
  data?: any;
  message?: string;
  /**
   * Mode database. Mengikuti kontrak getDbMode() di src/lib/db.ts, yang
   * bertipe 'pg' | 'local' dan pada praktiknya selalu mengembalikan 'pg'.
   * Bukan string bebas — mengetiknya longgar membuat konsumen kehilangan
   * pemeriksaan tipe pada perbandingan mode.
   */
  mode?: 'pg' | 'local';
  host?: string;
  tables?: any;
  stats?: any;
}

/**
 * Menjalankan kueri SQL mentah.
 *
 * Ini memang pintu eksekusi SQL bebas — itulah fungsi DB Explorer. Backend
 * mewajibkan admin global; jangan pernah memanggilnya dari alur yang bisa
 * disentuh pengguna biasa.
 */
export async function runQuery(sql: string): Promise<ExplorerApiResponse> {
  return apiRequest('/api/db-query', {
    method: 'POST',
    body: { query: sql },
  });
}

/**
 * Menyusun literal string SQL dengan meng-escape tanda kutip tunggal.
 *
 * CATATAN: hanya NILAI yang di-escape. Nama tabel dan nama kolom di
 * deleteRow/updateRow di bawah disisipkan apa adanya, persis seperti kode
 * aslinya. Perilaku itu sengaja dipertahankan agar ekstraksi ini tetap murni
 * refactor. Risikonya terbatas karena endpoint-nya sudah membutuhkan admin
 * global yang toh bisa menjalankan SQL apa pun — tetapi bila suatu saat
 * dibenahi, di sinilah tempatnya.
 */
function quoteValue(value: any): string {
  return String(value).replace(/'/g, "''");
}

/** Menghapus satu baris berdasarkan kolom kunci primernya. */
export async function deleteRow(
  table: string,
  pkField: string,
  pkValue: any,
): Promise<ExplorerApiResponse> {
  const sql = `DELETE FROM ${table} WHERE \`${pkField}\` = '${quoteValue(pkValue)}'`;
  return runQuery(sql);
}

/**
 * Memperbarui satu baris.
 *
 * `assignments` sudah dalam bentuk potongan SQL `kolom = 'nilai'` yang
 * digabung koma, sama seperti sebelum diekstrak.
 */
export async function updateRow(
  table: string,
  assignments: string,
  pkField: string,
  pkValue: any,
): Promise<ExplorerApiResponse> {
  const sql = `UPDATE ${table} SET ${assignments} WHERE \`${pkField}\` = '${quoteValue(pkValue)}'`;
  return runQuery(sql);
}

/** Mengambil status koneksi database (mode dan host). */
export async function fetchDbStatus(): Promise<ExplorerApiResponse> {
  return apiRequest('/api/system/db-status');
}

/**
 * Mengganti mode database.
 *
 * CATATAN: mode 'local' sudah tidak didukung — src/lib/db.ts kini Neon
 * PostgreSQL saja dan getDbMode() selalu mengembalikan 'pg'. Fungsi ini
 * dipertahankan karena UI-nya masih ada, tetapi tombolnya kemungkinan besar
 * tidak lagi berguna.
 */
export async function toggleDbMode(mode: string): Promise<ExplorerApiResponse> {
  return apiRequest('/api/system/db-status', {
    method: 'POST',
    body: { mode },
  });
}

/** Mengambil skema database beserta statistik tabelnya. */
export async function fetchSchema(): Promise<ExplorerApiResponse> {
  return apiRequest('/api/db-schema');
}
