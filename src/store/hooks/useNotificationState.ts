import { useNotificationStore } from '../stores';

/** Selector atomik — lihat catatan di useAuthState.ts. */
export const useNotificationState = () => ({
  notifications: useNotificationStore((s) => s.notifications),
  comments: useNotificationStore((s) => s.comments),
  newCommentText: useNotificationStore((s) => s.newCommentText),
  uploadProgress: useNotificationStore((s) => s.uploadProgress),
});

export const useNotificationActions = () => ({
  addNotification: useNotificationStore((s) => s.addNotification),
  removeNotification: useNotificationStore((s) => s.removeNotification),
  clearNotifications: useNotificationStore((s) => s.clearNotifications),
  setComments: useNotificationStore((s) => s.setComments),
  setNewCommentText: useNotificationStore((s) => s.setNewCommentText),
  setUploadProgress: useNotificationStore((s) => s.setUploadProgress),
  updateUploadProgress: useNotificationStore((s) => s.updateUploadProgress),
});

export const useNotification = () => ({
  ...useNotificationState(),
  ...useNotificationActions(),
});
