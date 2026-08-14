/**
 * Lapisan akses data Team Management.
 *
 * Diekstrak dari TeamManagementPanel.tsx (Fase 3 — Anti-God-Object).
 */

import { apiRequest } from '../../../lib/api';

/** Bentuk respons standar backend. */
export interface TeamApiResponse {
  status: string;
  data?: any;
  message?: string;
}

/** Mengambil task seluruh anggota tim pada sebuah proyek. */
export async function fetchTeamTasks(projectId: string): Promise<TeamApiResponse> {
  return apiRequest(`/api/projects/${projectId}/team-tasks`);
}
