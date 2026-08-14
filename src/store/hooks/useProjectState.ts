import { useProjectStore } from '../stores';

export const useProjectState = () => {
  return useProjectStore((state) => ({
    selectedProject: state.selectedProject,
    selectedProjectId: state.selectedProjectId,
    projects: state.projects,
    tasks: state.tasks,
    sprints: state.sprints,
    projectMembers: state.projectMembers,
    activityLogs: state.activityLogs,
    masterData: state.masterData,
    allUsers: state.allUsers,
    taskFilters: state.taskFilters,
    selectedTasks: state.selectedTasks,
  }));
};

export const useProjectActions = () => {
  return useProjectStore((state) => ({
    setSelectedProject: state.setSelectedProject,
    setSelectedProjectId: state.setSelectedProjectId,
    setProjects: state.setProjects,
    setTasks: state.setTasks,
    setSprints: state.setSprints,
    setProjectMembers: state.setProjectMembers,
    setActivityLogs: state.setActivityLogs,
    setMasterData: state.setMasterData,
    setAllUsers: state.setAllUsers,
    setTaskFilters: state.setTaskFilters,
    setSelectedTasks: state.setSelectedTasks,
    toggleTaskSelection: state.toggleTaskSelection,
    clearProjectData: state.clearProjectData,
  }));
};

export const useProject = () => ({
  ...useProjectState(),
  ...useProjectActions(),
});
