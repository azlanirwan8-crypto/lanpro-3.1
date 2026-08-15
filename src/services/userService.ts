/**
 * Panggilan backend untuk Pengguna dan notifikasinya.
 *
 * Diekstrak dari AppContainer. URL, metode, dan bentuk body dipertahankan
 * persis seperti aslinya.
 */
import { apiRequest } from "../lib/api";

export const verifyAuth = () => apiRequest("/api/auth/verify");

export const fetchUsers = () => apiRequest("/api/users");

/** Menandai pengguna masih aktif. Kegagalannya sengaja diabaikan pemanggil. */
export const sendHeartbeat = () => apiRequest("/api/users/heartbeat", { method: "POST" });

export const createNotification = (userUid: string, body: any) =>
  apiRequest(`/api/users/${userUid}/notifications`, { method: "POST", body });

export const markNotificationRead = (userUid: string, notificationId: string) =>
  apiRequest(`/api/users/${userUid}/notifications/${notificationId}`, {
    method: "PUT",
    body: { read: true },
  });
