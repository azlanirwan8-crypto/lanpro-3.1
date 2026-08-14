import { useUIStore } from '../stores';

/** Selector atomik — lihat catatan di useAuthState.ts. */
export const useUIState = () => ({
  isDarkMode: useUIStore((s) => s.isDarkMode),
  selectedTheme: useUIStore((s) => s.selectedTheme),
  isSidebarOpen: useUIStore((s) => s.isSidebarOpen),
  density: useUIStore((s) => s.density),
  activeModal: useUIStore((s) => s.activeModal),
  isTaskDetailOpen: useUIStore((s) => s.isTaskDetailOpen),
  isProjectModalOpen: useUIStore((s) => s.isProjectModalOpen),
  isSprintModalOpen: useUIStore((s) => s.isSprintModalOpen),
  isUserModalOpen: useUIStore((s) => s.isUserModalOpen),
  isSettingsOpen: useUIStore((s) => s.isSettingsOpen),
  selectedView: useUIStore((s) => s.selectedView),
  isFullscreen: useUIStore((s) => s.isFullscreen),
  showKanban: useUIStore((s) => s.showKanban),
  isLoadingModal: useUIStore((s) => s.isLoadingModal),
});

export const useUIActions = () => ({
  setIsDarkMode: useUIStore((s) => s.setIsDarkMode),
  setSelectedTheme: useUIStore((s) => s.setSelectedTheme),
  setIsSidebarOpen: useUIStore((s) => s.setIsSidebarOpen),
  toggleSidebar: useUIStore((s) => s.toggleSidebar),
  setDensity: useUIStore((s) => s.setDensity),
  setActiveModal: useUIStore((s) => s.setActiveModal),
  setIsTaskDetailOpen: useUIStore((s) => s.setIsTaskDetailOpen),
  setIsProjectModalOpen: useUIStore((s) => s.setIsProjectModalOpen),
  setIsSprintModalOpen: useUIStore((s) => s.setIsSprintModalOpen),
  setIsUserModalOpen: useUIStore((s) => s.setIsUserModalOpen),
  setIsSettingsOpen: useUIStore((s) => s.setIsSettingsOpen),
  setSelectedView: useUIStore((s) => s.setSelectedView),
  setIsFullscreen: useUIStore((s) => s.setIsFullscreen),
  setShowKanban: useUIStore((s) => s.setShowKanban),
  setIsLoadingModal: useUIStore((s) => s.setIsLoadingModal),
});

export const useUI = () => ({
  ...useUIState(),
  ...useUIActions(),
});
