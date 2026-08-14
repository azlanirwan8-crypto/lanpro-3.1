/**
 * Lapisan akses data manajemen pengguna.
 *
 * Diekstrak dari index.tsx (Fase 3 — Anti-God-Object).
 *
 * Satu-satunya tempat panel admin pengguna berbicara dengan backend. Komponen
 * tidak lagi menyusun URL, menentukan method, atau memasang header sendiri.
 *
 * Bentuk respons backend (`{ status, data, message }`) diteruskan apa adanya,
 * sama seperti wiki.service.ts. Mengubahnya menjadi throw-on-error akan
 * memaksa penulisan ulang penanganan error di tujuh titik panggilan sekaligus.
 */

import { apiRequest } from '../../../lib/api';

/** Bentuk respons standar backend. */
export interface UserApiResponse {
  status: string;
  data?: any;
  message?: string;
}

/**
 * Header penanda siapa yang melakukan aksi.
 *
 * Dipakai endpoint keanggotaan proyek untuk audit trail. Backend menerima
 * "guest" sebagai penanda aktor tak dikenal, jadi fallback-nya dipertahankan.
 */
function actorHeader(actorId?: string | null) {
  return { 'x-user-id': actorId || 'guest' };
}

// ── Keanggotaan proyek ────────────────────────────────────────────

/**
 * Menambahkan atau memperbarui keanggotaan pengguna pada sebuah proyek.
 *
 * Memakai PUT, bukan POST: endpoint ini bersifat idempoten dan dipakai baik
 * untuk menambah anggota baru maupun mengubah perannya.
 */
export async function assignUserToProject(
  projectId: string,
  actorId: string | null | undefined,
  payload: any,
): Promise<UserApiResponse> {
  return apiRequest(`/api/projects/${projectId}/members`, {
    method: 'PUT',
    headers: actorHeader(actorId),
    body: payload,
  });
}

/** Mengeluarkan pengguna dari sebuah proyek. */
export async function removeUserFromProject(
  projectId: string,
  actorId: string | null | undefined,
  userId: string,
): Promise<UserApiResponse> {
  return apiRequest(`/api/projects/${projectId}/members/${userId}`, {
    method: 'DELETE',
    headers: actorHeader(actorId),
  });
}

// ── Pengguna ──────────────────────────────────────────────────────

/**
 * Mendaftarkan pengguna baru.
 *
 * Memakai endpoint registrasi publik yang sama dengan layar pendaftaran,
 * sehingga aturan validasi dan pembatas lajunya konsisten.
 */
export async function registerUser(payload: any): Promise<UserApiResponse> {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: payload,
  });
}

/**
 * Memperbarui sebagian data pengguna.
 *
 * Dipakai untuk mengubah status (approve/reject) maupun peran; keduanya PUT
 * ke endpoint yang sama dengan isi body berbeda.
 */
export async function updateUser(
  userId: string,
  patch: Record<string, any>,
): Promise<UserApiResponse> {
  return apiRequest(`/api/users/${userId}`, {
    method: 'PUT',
    body: patch,
  });
}

/** Menghapus pengguna secara permanen. */
export async function deleteUser(userId: string): Promise<UserApiResponse> {
  return apiRequest(`/api/users/${userId}`, {
    method: 'DELETE',
  });
}
