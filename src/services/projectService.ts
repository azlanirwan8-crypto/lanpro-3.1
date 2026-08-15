/**
 * Panggilan backend untuk Proyek: pembuatan, perubahan, penghapusan,
 * keanggotaan, undangan, dan log aktivitas.
 *
 * Diekstrak dari AppContainer. URL, metode, header, dan bentuk body
 * dipertahankan persis seperti aslinya.
 */
import { apiRequest } from "../lib/api";

export const createProject = (body: any) =>
  apiRequest("/api/projects", { method: "POST", body });

export const updateProject = (projectId: string, body: any) =>
  apiRequest(`/api/projects/${projectId}`, { method: "PUT", body });

export const deleteProject = (projectId: string, userId: string) =>
  apiRequest(`/api/projects/${projectId}`, { method: "DELETE", headers: { "x-user-id": userId } });

export const updateMemberRoles = (projectId: string, memberRoles: any) =>
  apiRequest(`/api/projects/${projectId}/members`, { method: "PUT", body: { memberRoles } });

export const addMember = (projectId: string, userId: string, newMemberId: string) =>
  apiRequest(`/api/projects/${projectId}/members`, {
    method: "PUT",
    headers: { "x-user-id": userId },
    body: { newMemberId, newMemberRole: "member" },
  });

export const removeMember = (projectId: string, userId: string) =>
  apiRequest(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" });

export const inviteMember = (projectId: string, emailToInvite: string) =>
  apiRequest(`/api/projects/${projectId}/invites`, { method: "PUT", body: { emailToInvite } });

export const fetchActivity = (projectId: string) =>
  apiRequest(`/api/projects/${projectId}/activity`);

export const logActivity = (projectId: string, body: any) =>
  apiRequest(`/api/projects/${projectId}/activity`, { method: "POST", body });
