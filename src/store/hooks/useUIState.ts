import { useUIStore } from '../stores';

export const useUIState = () => {
  return useUIStore((state) => ({
    isDarkMode: state.isDarkMode,
    selectedTheme: state.selectedTheme,
    isSidebarOpen: state.isSidebarOpen,
    density: state.density,
    activeModal: state.activeModal,
    isTaskDetailOpen: state.isTaskDetailOpen,
    isProjectModalOpen: state.isProjectModalOpen,
    isSprintModalOpen: state.isSprintModalOpen,
    isUserModalOpen: state.isUserModalOpen,
    isSettingsOpen: state.isSettingsOpen,
    selectedView: state.selectedView,
    isFullscreen: state.isFullscreen,
    showKanban: state.showKanban,
    isLoadingModal: state.isLoadingModal,
  }));
};

export const useUIActions = () => {
  return useUIStore((state) => ({
    setIsDarkMode: state.setIsDarkMode,
    setSelectedTheme: state.setSelectedTheme,
    setIsSidebarOpen: state.setIsSidebarOpen,
    toggleSidebar: state.toggleSidebar,
    setDensity: state.setDensity,
    setActiveModal: state.setActiveModal,
    setIsTaskDetailOpen: state.setIsTaskDetailOpen,
    setIsProjectModalOpen: state.setIsProjectModalOpen,
    setIsSprintModalOpen: state.setIsSprintModalOpen,
    setIsUserModalOpen: state.setIsUserModalOpen,
    setIsSettingsOpen: state.setIsSettingsOpen,
    setSelectedView: state.setSelectedView,
    setIsFullscreen: state.setIsFullscreen,
    setShowKanban: state.setShowKanban,
    setIsLoadingModal: state.setIsLoadingModal,
  }));
};

export const useUI = () => ({
  ...useUIState(),
  ...useUIActions(),
});
