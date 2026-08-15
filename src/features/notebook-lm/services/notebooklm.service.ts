/**
 * Panggilan backend fitur NotebookLM.
 *
 * Diekstrak dari NotebookLM.tsx yang sebelumnya memakai `fetch` langsung dari
 * komponen — pelanggaran aturan lapisan ARCHITECTURE.md §2. URL, metode,
 * header, dan bentuk body dipertahankan persis seperti aslinya.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ PERINGATAN: DUA CACAT DI BAWAH SENGAJA DIPERTAHANKAN APA ADANYA.          │
 * │                                                                           │
 * │ 1. Kunci token yang dibaca adalah 'token', sedangkan kunci sebenarnya     │
 * │    yang dipakai aplikasi adalah 'lanpro_jwt_token' (lihat src/lib/api.ts).│
 * │    Akibatnya setiap permintaan di berkas ini mengirim header              │
 * │    `Authorization: Bearer ` yang kosong dan dibalas 401.                  │
 * │                                                                           │
 * │ 2. `fetchWikiSources` memanggil /api/projects/:id/wiki, endpoint yang     │
 * │    tidak pernah ada di backend. Fitur Wiki sendiri membaca                │
 * │    /api/projects/:id/documents (lihat wiki.service.ts).                   │
 * │                                                                           │
 * │ Keduanya menunggu keputusan pemilik repo dan BUKAN bagian dari pemindahan │
 * │ lapisan ini. Memperbaiki salah satunya saja tidak memulihkan fitur —      │
 * │ keduanya harus diperbaiki bersama.                                        │
 * └───────────────────────────────────────────────────────────────────────────┘
 */
import { safeLocalStorage } from '../../../lib/safeStorage';

/** Lihat peringatan di atas: kunci ini keliru, dan sengaja belum diubah. */
const ambilToken = () => safeLocalStorage.getItem('token') || '';

const headerJson = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${ambilToken()}`,
});

/** Endpoint ini tidak ada di backend — lihat peringatan di atas. */
export const fetchWikiSources = (projectId: string) =>
  fetch(`/api/projects/${projectId}/wiki`, {
    headers: { Authorization: `Bearer ${ambilToken()}` },
  });

export const fetchMeetingSources = (projectId: string) =>
  fetch(`/api/projects/${projectId}/meetings`, {
    headers: { Authorization: `Bearer ${ambilToken()}` },
  });

export const sendChat = (body: unknown) =>
  fetch('/api/notebooklm/chat', {
    method: 'POST',
    headers: headerJson(),
    body: JSON.stringify(body),
  });

export const generateOverview = (body: unknown) =>
  fetch('/api/notebooklm/generate-overview', {
    method: 'POST',
    headers: headerJson(),
    body: JSON.stringify(body),
  });

export const generateAudio = (body: unknown) =>
  fetch('/api/notebooklm/generate-audio', {
    method: 'POST',
    headers: headerJson(),
    body: JSON.stringify(body),
  });
