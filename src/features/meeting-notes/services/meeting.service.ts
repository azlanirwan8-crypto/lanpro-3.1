/**
 * Lapisan akses data Meeting Notes.
 *
 * Diekstrak dari AiMeetingCompanion.tsx dan MeetingNotes.tsx
 * (Fase 3 — Anti-God-Object).
 *
 * Bentuk respons backend (`{ status, data, message }`) diteruskan apa adanya,
 * konsisten dengan service fitur lain.
 */

import { apiRequest } from '../../../lib/api';
import type { UserProfile } from '../../../types';

/** Bentuk respons standar backend. */
export interface MeetingApiResponse {
  status: string;
  data?: any;
  message?: string;
}

/**
 * Menentukan ID pengguna untuk header `x-user-id`.
 *
 * Backend menerima "guest" sebagai penanda pengguna tak dikenal, jadi
 * perilaku fallback-nya dipertahankan persis seperti sebelumnya.
 */
export function resolveUserId(currentUser: UserProfile | null): string {
  return (currentUser as any)?.id || (currentUser as any)?.uid || 'guest';
}

/**
 * Mengirim transkrip rapat untuk dianalisis Asisten AI.
 *
 * Endpoint ini berjalan lama: backend memanggil layanan AI dan memancarkan
 * progres lewat Socket.IO (`meeting_ai_status`) selama prosesnya.
 */
export async function analyzeTranscript(
  projectId: string,
  meetingId: string,
  transcript: string,
  meetingLink?: string,
): Promise<MeetingApiResponse> {
  return apiRequest(`/api/projects/${projectId}/meetings/${meetingId}/analyze-transcript`, {
    method: 'POST',
    body: { transcript, meetingLink },
  });
}

/**
 * Membuat task di backlog dari temuan rapat.
 *
 * Memakai endpoint task umum, sehingga aturan validasi dan penomoran key-nya
 * sama dengan task yang dibuat dari layar lain.
 */
export async function createTaskFromMeeting(
  projectId: string,
  payload: unknown,
): Promise<MeetingApiResponse> {
  return apiRequest(`/api/projects/${projectId}/tasks`, {
    method: 'POST',
    body: payload,
  });
}

/**
 * Mengunduh berkas lampiran sebuah rapat.
 *
 * Backend mengembalikan `data.fileData` (base64) beserta `data.fileName`.
 */
export async function downloadMeetingFile(
  projectId: string,
  meetingId: string,
  userId: string,
): Promise<MeetingApiResponse> {
  return apiRequest(`/api/projects/${projectId}/meetings/${meetingId}/download`, {
    headers: { 'x-user-id': userId },
  });
}
