import { create } from 'zustand';

interface UIState {
  // Theme
  isDarkMode: boolean;
  selectedTheme: string;

  // Sidebar
  isSidebarOpen: boolean;
  density: 'compact' | 'normal' | 'spacious';

  // Modals
  activeModal: string | null;
  isTaskDetailOpen: boolean;
  isProjectModalOpen: boolean;
  isSprintModalOpen: boolean;
  isUserModalOpen: boolean;
  isSettingsOpen: boolean;

  // UI state
  selectedView: string;
  isFullscreen: boolean;
  showKanban: boolean;

  // Loading states
  isLoadingModal: boolean;

  // Actions
  setIsDarkMode: (value: boolean) => void;
  setSelectedTheme: (theme: string) => void;
  setIsSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setDensity: (density: 'compact' | 'normal' | 'spacious') => void;

  // Modal actions
  setActiveModal: (modal: string | null) => void;
  setIsTaskDetailOpen: (open: boolean) => void;
  setIsProjectModalOpen: (open: boolean) => void;
  setIsSprintModalOpen: (open: boolean) => void;
  setIsUserModalOpen: (open: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;

  // View actions
  setSelectedView: (view: string) => void;
  setIsFullscreen: (fullscreen: boolean) => void;
  setShowKanban: (show: boolean) => void;
  setIsLoadingModal: (loading: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  isDarkMode: false,
  selectedTheme: 'light',
  isSidebarOpen: true,
  density: 'normal',
  activeModal: null,
  isTaskDetailOpen: false,
  isProjectModalOpen: false,
  isSprintModalOpen: false,
  isUserModalOpen: false,
  isSettingsOpen: false,
  selectedView: 'dashboard',
  isFullscreen: false,
  showKanban: false,
  isLoadingModal: false,

  // Theme actions
  setIsDarkMode: (value) => set({ isDarkMode: value }),
  setSelectedTheme: (theme) => set({ selectedTheme: theme }),

  // Sidebar actions
  setIsSidebarOpen: (open) => set({ isSidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setDensity: (density) => set({ density }),

  // Modal actions
  setActiveModal: (modal) => set({ activeModal: modal }),
  setIsTaskDetailOpen: (open) => set({ isTaskDetailOpen: open }),
  setIsProjectModalOpen: (open) => set({ isProjectModalOpen: open }),
  setIsSprintModalOpen: (open) => set({ isSprintModalOpen: open }),
  setIsUserModalOpen: (open) => set({ isUserModalOpen: open }),
  setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),

  // View actions
  setSelectedView: (view) => set({ selectedView: view }),
  setIsFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),
  setShowKanban: (show) => set({ showKanban: show }),
  setIsLoadingModal: (loading) => set({ isLoadingModal: loading }),
}));
