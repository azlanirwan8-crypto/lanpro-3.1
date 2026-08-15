import { apiRequest } from "../lib/api";
import { Task } from "../types";

export const taskService = {
  updateTaskField: async (projectId: string, taskId: string, field: string, value: any) => {
    let updateData: any = {};
    if (field === "dates") {
      updateData = {
        startDate: value.startDate,
        endDate: value.endDate,
      };
    } else if (field === "assigneeId") {
      const isEmail = typeof value === 'string' && value.includes("@");
      if (isEmail) {
        updateData = {
          assigneeId: null,
          assigneeEmail: value,
        };
      } else {
        updateData = {
          assigneeId: value || null,
          assigneeEmail: null,
        };
      }
    } else {
      updateData = {
        [field]: value,
      };
    }

    const data = await apiRequest(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: "PUT",
      body: updateData
    });

    if (data.status !== "success") throw new Error(data.message || "Failed to update task");

    return data;
  },
  
  // Add other task-related methods here as we extract them from App.tsx
};

/* ---------------------------------------------------------------------------
 * Fungsi di bawah diekstrak dari AppContainer, yang sebelumnya memanggil
 * apiRequest langsung — pelanggaran aturan lapisan ARCHITECTURE.md §2.
 * URL, metode, header, dan bentuk body dipertahankan persis seperti aslinya.
 * ------------------------------------------------------------------------- */

export const fetchTasks = (projectId: string) =>
  apiRequest(`/api/projects/${projectId}/tasks`);

export const createTask = (projectId: string, body: any) =>
  apiRequest(`/api/projects/${projectId}/tasks`, { method: "POST", body });

export const updateTask = (projectId: string, taskId: string, body: any) =>
  apiRequest(`/api/projects/${projectId}/tasks/${taskId}`, { method: "PUT", body });

export const updateTaskAsUser = (projectId: string, taskId: string, userId: string, body: any) =>
  apiRequest(`/api/projects/${projectId}/tasks/${taskId}`, {
    method: "PUT",
    headers: { "x-user-id": userId },
    body,
  });

export const deleteTask = (projectId: string, taskId: string, userId: string) =>
  apiRequest(`/api/projects/${projectId}/tasks/${taskId}`, {
    method: "DELETE",
    headers: { "x-user-id": userId },
  });

/**
 * Hapus banyak task sekaligus.
 *
 * Catatan: body di sini di-JSON.stringify lebih dulu, berbeda dari fungsi lain
 * di berkas ini yang mengirim objek biasa. Perbedaan itu dipertahankan apa
 * adanya karena ia berasal dari kode aslinya; menyamakannya berarti mengubah
 * payload yang dikirim ke backend, bukan sekadar memindahkan kode.
 */
export const bulkDeleteTasks = (projectId: string, userId: string, taskIds: string[]) =>
  apiRequest(`/api/projects/${projectId}/tasks/bulk-delete`, {
    method: "POST",
    headers: { "x-user-id": userId },
    body: JSON.stringify({ taskIds }),
  });

export const fetchTaskComments = (projectId: string, taskId: string) =>
  apiRequest(`/api/projects/${projectId}/tasks/${taskId}/comments`);

export const createTaskComment = (projectId: string, taskId: string, body: any) =>
  apiRequest(`/api/projects/${projectId}/tasks/${taskId}/comments`, { method: "POST", body });

export const createTaskLink = (projectId: string, taskId: string, body: any) =>
  apiRequest(`/api/projects/${projectId}/tasks/${taskId}/links`, { method: "POST", body });

export const deleteTaskLink = (projectId: string, taskId: string, linkId: string) =>
  apiRequest(`/api/projects/${projectId}/tasks/${taskId}/links/${linkId}`, { method: "DELETE" });
