import { useNotificationStore } from '../stores';

export const useNotificationState = () => {
  return useNotificationStore((state) => ({
    notifications: state.notifications,
    comments: state.comments,
    newCommentText: state.newCommentText,
    uploadProgress: state.uploadProgress,
  }));
};

export const useNotificationActions = () => {
  return useNotificationStore((state) => ({
    addNotification: state.addNotification,
    removeNotification: state.removeNotification,
    clearNotifications: state.clearNotifications,
    setComments: state.setComments,
    setNewCommentText: state.setNewCommentText,
    setUploadProgress: state.setUploadProgress,
    updateUploadProgress: state.updateUploadProgress,
  }));
};

export const useNotification = () => ({
  ...useNotificationState(),
  ...useNotificationActions(),
});
