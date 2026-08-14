import { create } from 'zustand';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
  duration?: number;
}

interface NotificationState {
  notifications: Notification[];
  comments: any[];
  newCommentText: string;
  uploadProgress: Record<string, number>;

  // Actions
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // Comment actions
  setComments: (comments: any[]) => void;
  setNewCommentText: (text: string) => void;

  // Upload progress
  setUploadProgress: (progress: Record<string, number>) => void;
  updateUploadProgress: (fileId: string, progress: number) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  // Initial state
  notifications: [],
  comments: [],
  newCommentText: '',
  uploadProgress: {},

  // Notification actions
  addNotification: (notification) => set((state) => ({
    notifications: [
      ...state.notifications,
      {
        ...notification,
        id: `${Date.now()}-${Math.random()}`,
      },
    ],
  })),

  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter((n) => n.id !== id),
  })),

  clearNotifications: () => set({ notifications: [] }),

  // Comment actions
  setComments: (comments) => set({ comments }),
  setNewCommentText: (text) => set({ newCommentText: text }),

  // Upload progress
  setUploadProgress: (progress) => set({ uploadProgress: progress }),
  updateUploadProgress: (fileId, progress) => set((state) => ({
    uploadProgress: {
      ...state.uploadProgress,
      [fileId]: progress,
    },
  })),
}));
