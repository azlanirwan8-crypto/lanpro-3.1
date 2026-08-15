/**
 * Panggilan backend untuk Sprint.
 *
 * Diekstrak dari AppContainer, yang sebelumnya memanggil apiRequest langsung —
 * pelanggaran aturan lapisan di ARCHITECTURE.md §2. URL, metode, dan bentuk
 * body dipertahankan persis seperti aslinya.
 */
import { apiRequest } from "../lib/api";

export const fetchSprints = (projectId: string) =>
  apiRequest(`/api/projects/${projectId}/sprints`);

export const createSprint = (projectId: string, body: any) =>
  apiRequest(`/api/projects/${projectId}/sprints`, { method: "POST", body });

export const updateSprint = (projectId: string, sprintId: string, body: any) =>
  apiRequest(`/api/projects/${projectId}/sprints/${sprintId}`, { method: "PUT", body });

export const deleteSprint = (projectId: string, sprintId: string) =>
  apiRequest(`/api/projects/${projectId}/sprints/${sprintId}`, { method: "DELETE" });
