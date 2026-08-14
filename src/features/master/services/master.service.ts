/**
 * Lapisan akses data Master Data dan Project Modules.
 *
 * Diekstrak dari MasterDataPanel.tsx (Fase 3 — Anti-God-Object).
 *
 * Satu-satunya tempat panel master berbicara dengan backend. Panel ini
 * mengelola dua sumber daya yang berbeda lewat endpoint terpisah:
 *   - /api/project-modules : daftar modul proyek
 *   - /api/master-data     : label, warna, ikon, dan urutannya
 *
 * Bentuk respons backend (`{ status, data, message }`) diteruskan apa adanya,
 * konsisten dengan wiki.service.ts dan users.service.ts.
 */

import { apiRequest } from '../../../lib/api';

/** Bentuk respons standar backend. */
export interface MasterApiResponse {
  status: string;
  data?: any;
  message?: string;
}

// ── Project Modules ───────────────────────────────────────────────

/** Mengambil seluruh modul proyek. */
export async function fetchProjectModules(): Promise<MasterApiResponse> {
  return apiRequest('/api/project-modules');
}

/** Membuat modul proyek baru. */
export async function createProjectModule(payload: any): Promise<MasterApiResponse> {
  return apiRequest('/api/project-modules', {
    method: 'POST',
    body: payload,
  });
}

/** Memperbarui modul proyek. */
export async function updateProjectModule(
  moduleId: string,
  payload: any,
): Promise<MasterApiResponse> {
  return apiRequest(`/api/project-modules/${moduleId}`, {
    method: 'PUT',
    body: payload,
  });
}

/** Menghapus modul proyek. */
export async function deleteProjectModule(moduleId: string): Promise<MasterApiResponse> {
  return apiRequest(`/api/project-modules/${moduleId}`, {
    method: 'DELETE',
  });
}

// ── Master Data ───────────────────────────────────────────────────

/** Membuat entri master data baru. */
export async function createMasterData(payload: any): Promise<MasterApiResponse> {
  return apiRequest('/api/master-data', {
    method: 'POST',
    body: payload,
  });
}

/** Memperbarui entri master data. */
export async function updateMasterData(
  itemId: string,
  payload: any,
): Promise<MasterApiResponse> {
  return apiRequest(`/api/master-data/${itemId}`, {
    method: 'PUT',
    body: payload,
  });
}

/** Menghapus entri master data. */
export async function deleteMasterData(itemId: string): Promise<MasterApiResponse> {
  return apiRequest(`/api/master-data/${itemId}`, {
    method: 'DELETE',
  });
}

/**
 * Menyimpan urutan baru setelah drag-and-drop.
 *
 * Backend tidak menyediakan endpoint reorder khusus, sehingga urutan disimpan
 * dengan mem-PUT setiap entri satu per satu dengan field `order` mengikuti
 * posisinya dalam array. Detail itu sengaja dikurung di sini agar komponen
 * cukup menyerahkan daftar yang sudah tersusun.
 *
 * Field lain ikut dikirim karena endpoint PUT bersifat menggantikan, bukan
 * menambal — mengirim `order` saja akan mengosongkan label dan warnanya.
 */
export async function reorderMasterData(items: any[]): Promise<MasterApiResponse[]> {
  return Promise.all(
    items.map((item, index) =>
      updateMasterData(item.id, {
        order: index,
        label: item.label,
        color: item.color,
        icon: item.icon,
        description: item.description,
      }),
    ),
  );
}
