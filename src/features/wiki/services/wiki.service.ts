/**
 * Lapisan akses data Wiki / Dokumentasi.
 *
 * Diekstrak dari index.tsx (Fase 3 — Anti-God-Object).
 *
 * Satu-satunya tempat fitur Wiki berbicara dengan backend. Komponen tidak lagi
 * menyusun URL, menentukan method, atau memasang header sendiri.
 *
 * Bentuk respons backend (`{ status, data, message }`) sengaja diteruskan apa
 * adanya. Mengubahnya menjadi throw-on-error akan memaksa penulisan ulang
 * penanganan error di delapan titik panggilan sekaligus — risiko yang tidak
 * sepadan untuk sebuah refactor. Perubahan itu bisa menyusul terpisah.
 */

import { apiRequest } from '../../../lib/api';
import type { UserProfile } from '../../../types';

/** Bentuk respons standar backend untuk endpoint dokumen. */
export interface DocumentApiResponse {
  status: string;
  data?: any;
  message?: string;
}

/**
 * Menentukan ID pengguna untuk header `x-user-id`.
 *
 * Sebelumnya baris ini disalin delapan kali di dalam komponen. Backend
 * menerima "guest" sebagai penanda pengguna tak dikenal, jadi perilaku
 * fallback-nya dipertahankan persis.
 */
export function resolveUserId(currentUser: UserProfile | null): string {
  return (currentUser as any)?.id || (currentUser as any)?.uid || 'guest';
}

/** Header yang dikirim pada setiap permintaan dokumen. */
function userHeader(userId: string) {
  return { 'x-user-id': userId };
}

/** Mengambil seluruh dokumen milik sebuah proyek. */
export async function fetchDocuments(
  projectId: string,
  userId: string,
): Promise<DocumentApiResponse> {
  return apiRequest(`/api/projects/${projectId}/documents`, {
    headers: userHeader(userId),
  });
}

/** Membuat dokumen baru. */
export async function createDocument(
  projectId: string,
  userId: string,
  payload: any,
): Promise<DocumentApiResponse> {
  return apiRequest(`/api/projects/${projectId}/documents`, {
    method: 'POST',
    headers: userHeader(userId),
    body: payload,
  });
}

/**
 * Memperbarui dokumen.
 *
 * Dipakai untuk tiga hal berbeda yang semuanya PUT ke endpoint yang sama:
 * mengunggah berkas lampiran, menyimpan catatan, dan menyunting metadata.
 */
export async function updateDocument(
  projectId: string,
  userId: string,
  docId: string,
  payload: any,
): Promise<DocumentApiResponse> {
  return apiRequest(`/api/projects/${projectId}/documents/${docId}`, {
    method: 'PUT',
    headers: userHeader(userId),
    body: payload,
  });
}

/** Menghapus dokumen. */
export async function deleteDocument(
  projectId: string,
  userId: string,
  docId: string,
): Promise<DocumentApiResponse> {
  return apiRequest(`/api/projects/${projectId}/documents/${docId}`, {
    method: 'DELETE',
    headers: userHeader(userId),
  });
}

/**
 * Mengambil isi berkas lampiran sebuah dokumen.
 *
 * Backend mengembalikan `data.fileData` (base64) dan `data.fileType`. Endpoint
 * ini juga menaikkan penghitung unduhan, sehingga pemanggil biasanya memuat
 * ulang daftar dokumen setelahnya.
 */
export async function downloadDocument(
  projectId: string,
  userId: string,
  docId: string,
): Promise<DocumentApiResponse> {
  return apiRequest(`/api/projects/${projectId}/documents/${docId}/download`, {
    headers: userHeader(userId),
  });
}
