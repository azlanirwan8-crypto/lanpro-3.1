/**
 * Lapisan akses data QA (Test Suites & Test Cases).
 *
 * Diekstrak dari TestQAContainer.tsx (Fase 3 — Anti-God-Object).
 *
 * Fitur ini memakai DUA jalur transport, dan keduanya dipertahankan:
 *
 * 1. `apiRequest` — wrapper standar aplikasi. Mengurai JSON dan melempar pada
 *    kegagalan. Dipakai untuk endpoint yang penanganan errornya memang ingin
 *    memakai try/catch.
 *
 * 2. `qaFetch` — transport mentah yang mengembalikan `Response`. Sebelumnya
 *    bernama `apiFetch` dan didefinisikan di dalam komponen. Diperlukan karena
 *    unggah massal mengirim `FormData`, dan karena sebagian pemanggil memeriksa
 *    `response.ok` alih-alih menangkap exception.
 *
 * Fungsi di bawah yang memakai qaFetch sengaja tetap mengembalikan `Response`
 * mentah, bukan data terurai. Itu memang bocornya detail HTTP ke pemanggil, dan
 * idealnya diperketat — tetapi mengubahnya berarti menulis ulang alur `.ok` dan
 * `.json()` di sebelas titik sekaligus. Nilai yang didapat sekarang: penyusunan
 * URL, header, dan token terpusat di satu tempat.
 */

import { safeLocalStorage } from '../../../lib/safeStorage';
import { apiRequest } from '../../../lib/api';

/**
 * Transport mentah dengan token terlampir.
 *
 * Membaca kunci `lanpro_jwt_token` — kunci yang sama dipakai `src/lib/api.ts`.
 * Jangan menebak nama kunci lain di sini: fitur NotebookLM pernah membaca
 * `'token'` yang tidak pernah ada, sehingga seluruh requestnya dibalas 401.
 */
async function qaFetch(url: string, options: any = {}): Promise<Response> {
  const token = safeLocalStorage.getItem('lanpro_jwt_token');
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}

/** Pembungkus untuk body JSON, agar Content-Type dan stringify tidak diulang. */
function jsonBody(method: string, payload: unknown) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

// ── Test Suites ───────────────────────────────────────────────────

/** Mengambil daftar suite. Mengembalikan Response mentah. */
export function fetchSuites(projectId: string): Promise<Response> {
  return qaFetch(`/api/projects/${projectId}/qa-test-suites`);
}

/** Membuat suite baru. */
export function createSuite(projectId: string, suite: unknown): Promise<Response> {
  return qaFetch(`/api/projects/${projectId}/qa-test-suites`, jsonBody('POST', suite));
}

/** Memperbarui suite. Dipakai baik untuk ubah metadata maupun ganti PIC. */
export function updateSuite(
  projectId: string,
  suiteId: string,
  suite: unknown,
): Promise<Response> {
  return qaFetch(`/api/projects/${projectId}/qa-test-suites/${suiteId}`, jsonBody('PUT', suite));
}

/** Menghapus suite. */
export function deleteSuite(projectId: string, suiteId: string): Promise<Response> {
  return qaFetch(`/api/projects/${projectId}/qa-test-suites/${suiteId}`, { method: 'DELETE' });
}

// ── Test Cases ────────────────────────────────────────────────────

/** Mengambil daftar test case. Mengembalikan Response mentah. */
export function fetchCases(projectId: string): Promise<Response> {
  return qaFetch(`/api/projects/${projectId}/qa-test-cases`);
}

/** Memperbarui test case. Dipakai untuk ubah isi maupun ganti PIC. */
export function updateCase(
  projectId: string,
  caseId: string,
  testCase: unknown,
): Promise<Response> {
  return qaFetch(`/api/projects/${projectId}/qa-test-cases/${caseId}`, jsonBody('PUT', testCase));
}

/** Menghapus test case. */
export function deleteCase(projectId: string, caseId: string): Promise<Response> {
  return qaFetch(`/api/projects/${projectId}/qa-test-cases/${caseId}`, { method: 'DELETE' });
}

/** Mengambil riwayat eksekusi sebuah test case. */
export function fetchCaseHistory(projectId: string, caseId: string): Promise<Response> {
  return qaFetch(`/api/projects/${projectId}/qa-test-cases/${caseId}/history`);
}

/**
 * Mengunggah test case secara massal dari berkas.
 *
 * Memakai FormData, sehingga Content-Type sengaja TIDAK diset — browser perlu
 * menentukannya sendiri agar boundary multipart-nya benar.
 */
export function bulkUploadCases(formData: FormData): Promise<Response> {
  return qaFetch('/api/v1/qa/test-case/bulk-upload', {
    method: 'POST',
    body: formData,
  });
}

// ── Jalur apiRequest (JSON terurai, melempar pada kegagalan) ───────

/**
 * Memperbarui status eksekusi sebuah test case.
 *
 * Memakai PATCH, bukan PUT — endpoint ini menambal satu field saja. Perbedaan
 * itu penting: PUT pada endpoint QA lain bersifat menggantikan seluruh entitas.
 */
export async function updateCaseStatus(
  projectId: string,
  caseId: string,
  payload: unknown,
): Promise<any> {
  return apiRequest(`/api/projects/${projectId}/qa-test-cases/${caseId}/status`, {
    method: 'PATCH',
    body: payload,
  });
}

/** Membuat test case baru. */
export async function createCase(projectId: string, payload: unknown): Promise<any> {
  return apiRequest(`/api/projects/${projectId}/qa-test-cases`, {
    method: 'POST',
    body: payload,
  });
}

/** Membuat task dari temuan QA (mis. bug yang perlu ditindaklanjuti). */
export async function createTaskFromQA(projectId: string, payload: unknown): Promise<any> {
  return apiRequest(`/api/projects/${projectId}/tasks`, {
    method: 'POST',
    body: payload,
  });
}
