import { useProjectStore } from '../stores';

/** Selector atomik — lihat catatan di useAuthState.ts. */
export const useProjectState = () => ({
  selectedProject: useProjectStore((s) => s.selectedProject),
  selectedProjectId: useProjectStore((s) => s.selectedProjectId),
  projects: useProjectStore((s) => s.projects),
  tasks: useProjectStore((s) => s.tasks),
  sprints: useProjectStore((s) => s.sprints),
  projectMembers: useProjectStore((s) => s.projectMembers),
  activityLogs: useProjectStore((s) => s.activityLogs),
  masterData: useProjectStore((s) => s.masterData),
  allUsers: useProjectStore((s) => s.allUsers),
  taskFilters: useProjectStore((s) => s.taskFilters),
  selectedTasks: useProjectStore((s) => s.selectedTasks),
});

export const useProjectActions = () => ({
  setSelectedProject: useProjectStore((s) => s.setSelectedProject),
  setSelectedProjectId: useProjectStore((s) => s.setSelectedProjectId),
  setProjects: useProjectStore((s) => s.setProjects),
  setTasks: useProjectStore((s) => s.setTasks),
  setSprints: useProjectStore((s) => s.setSprints),
  setProjectMembers: useProjectStore((s) => s.setProjectMembers),
  setActivityLogs: useProjectStore((s) => s.setActivityLogs),
  setMasterData: useProjectStore((s) => s.setMasterData),
  setAllUsers: useProjectStore((s) => s.setAllUsers),
  setTaskFilters: useProjectStore((s) => s.setTaskFilters),
  setSelectedTasks: useProjectStore((s) => s.setSelectedTasks),
  toggleTaskSelection: useProjectStore((s) => s.toggleTaskSelection),
  clearProjectData: useProjectStore((s) => s.clearProjectData),
});

export const useProject = () => ({
  ...useProjectState(),
  ...useProjectActions(),
});
