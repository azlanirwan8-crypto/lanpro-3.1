/**
 * Lapisan akses data Enterprise Audit.
 *
 * Diekstrak dari EnterpriseAuditDashboard.tsx (Fase 3 — Anti-God-Object).
 */

import { apiRequest } from '../../../lib/api';

/** Bentuk respons standar backend. */
export interface AuditApiResponse {
  status: string;
  data?: any;
  message?: string;
}

/** Filter yang tersedia untuk pengambilan log audit. */
export interface AuditLogFilter {
  limit: number;
  projectId?: string;
  /** Nama entitas; 'All' berarti tanpa filter dan tidak dikirim ke backend. */
  entityName?: string;
}

/**
 * Mengambil log audit.
 *
 * Penyusunan query string dipusatkan di sini. Sebelumnya URL dirangkai dengan
 * penggabungan string bertahap di dalam komponen, sehingga mudah salah saat
 * menambah filter baru.
 */
export async function fetchAuditLogs(filter: AuditLogFilter): Promise<AuditApiResponse> {
  const params = new URLSearchParams({ limit: String(filter.limit) });
  if (filter.projectId) params.set('projectId', filter.projectId);
  if (filter.entityName && filter.entityName !== 'All') {
    params.set('entityName', filter.entityName);
  }
  return apiRequest(`/api/audit-logs?${params.toString()}`);
}
