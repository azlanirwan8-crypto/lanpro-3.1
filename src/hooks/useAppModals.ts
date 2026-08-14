import { useState } from "react";
import { Task, Sprint, Project, UserProfile } from "../types";

/**
 * useAppModals
 * Manages all modal and detail panel states in the application
 * Handles creation, editing, and detail views for core entities
 */
export function useAppModals() {
  // Create/New Entity Modals
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isNewSprintModalOpen, setIsNewSprintModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isInviteSuccessModalOpen, setIsInviteSuccessModalOpen] = useState(false);

  // Edit Entity Modals
  const [isEditSprintModalOpen, setIsEditSprintModalOpen] = useState(false);
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);

  // Detail/View Panels
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Entity Being Edited
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Entity Being Viewed/Selected
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null);
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<UserProfile | null>(null);

  // Last Invited Email (for success modal)
  const [lastInvitedEmail, setLastInvitedEmail] = useState("");

  // View Navigation
  const [previousView, setPreviousView] = useState<string>('list');

  // --- CREATE MODAL HELPERS ---

  const openNewProjectModal = () => {
    setIsNewProjectModalOpen(true);
  };

  const closeNewProjectModal = () => {
    setIsNewProjectModalOpen(false);
  };

  const openNewTaskModal = () => {
    setIsNewTaskModalOpen(true);
  };

  const closeNewTaskModal = () => {
    setIsNewTaskModalOpen(false);
  };

  const openNewSprintModal = () => {
    setIsNewSprintModalOpen(true);
  };

  const closeNewSprintModal = () => {
    setIsNewSprintModalOpen(false);
  };

  const openInviteModal = () => {
    setIsInviteModalOpen(true);
  };

  const closeInviteModal = () => {
    setIsInviteModalOpen(false);
  };

  const openInviteSuccessModal = (email: string) => {
    setLastInvitedEmail(email);
    setIsInviteSuccessModalOpen(true);
  };

  const closeInviteSuccessModal = () => {
    setIsInviteSuccessModalOpen(false);
    setLastInvitedEmail("");
  };

  // --- EDIT MODAL HELPERS ---

  const openEditTaskModal = (task: Task) => {
    setEditingTask(task);
    setIsEditTaskModalOpen(true);
  };

  const closeEditTaskModal = () => {
    setEditingTask(null);
    setIsEditTaskModalOpen(false);
  };

  const openEditSprintModal = (sprint: Sprint) => {
    setEditingSprint(sprint);
    setIsEditSprintModalOpen(true);
  };

  const closeEditSprintModal = () => {
    setEditingSprint(null);
    setIsEditSprintModalOpen(false);
  };

  const openEditProjectModal = (project: Project) => {
    setEditingProject(project);
    setIsEditProjectModalOpen(true);
  };

  const closeEditProjectModal = () => {
    setEditingProject(null);
    setIsEditProjectModalOpen(false);
  };

  // --- DETAIL/VIEW PANEL HELPERS ---

  const openTaskDetail = (task: Task) => {
    setSelectedTaskForDetail(task);
  };

  const closeTaskDetail = () => {
    setSelectedTaskForDetail(null);
  };

  const openUserDetail = (user: UserProfile) => {
    setSelectedUserForDetail(user);
  };

  const closeUserDetail = () => {
    setSelectedUserForDetail(null);
  };

  const toggleProfileModal = () => {
    setIsProfileModalOpen(prev => !prev);
  };

  const openProfileModal = () => {
    setIsProfileModalOpen(true);
  };

  const closeProfileModal = () => {
    setIsProfileModalOpen(false);
  };

  const toggleShortcutsModal = () => {
    setIsShortcutsModalOpen(prev => !prev);
  };

  const openShortcutsModal = () => {
    setIsShortcutsModalOpen(true);
  };

  const closeShortcutsModal = () => {
    setIsShortcutsModalOpen(false);
  };

  const openSyncModal = () => {
    setIsSyncModalOpen(true);
  };

  const closeSyncModal = () => {
    setIsSyncModalOpen(false);
  };

  // --- CLOSE ALL MODALS ---

  const closeAllModals = () => {
    setIsNewProjectModalOpen(false);
    setIsNewTaskModalOpen(false);
    setIsNewSprintModalOpen(false);
    setIsInviteModalOpen(false);
    setIsInviteSuccessModalOpen(false);
    setIsEditSprintModalOpen(false);
    setIsEditTaskModalOpen(false);
    setIsEditProjectModalOpen(false);
    setIsProfileModalOpen(false);
    setIsShortcutsModalOpen(false);
    setIsSyncModalOpen(false);
    setEditingTask(null);
    setEditingSprint(null);
    setEditingProject(null);
    setSelectedTaskForDetail(null);
    setSelectedUserForDetail(null);
  };

  return {
    // Create Modal States
    isNewProjectModalOpen,
    setIsNewProjectModalOpen,
    isNewTaskModalOpen,
    setIsNewTaskModalOpen,
    isNewSprintModalOpen,
    setIsNewSprintModalOpen,
    isInviteModalOpen,
    setIsInviteModalOpen,
    isInviteSuccessModalOpen,
    setIsInviteSuccessModalOpen,

    // Edit Modal States
    isEditSprintModalOpen,
    setIsEditSprintModalOpen,
    isEditTaskModalOpen,
    setIsEditTaskModalOpen,
    isEditProjectModalOpen,
    setIsEditProjectModalOpen,

    // Detail/View Modal States
    isProfileModalOpen,
    setIsProfileModalOpen,
    isShortcutsModalOpen,
    setIsShortcutsModalOpen,
    isSyncModalOpen,
    setIsSyncModalOpen,

    // Editing Entity States
    editingTask,
    setEditingTask,
    editingSprint,
    setEditingSprint,
    editingProject,
    setEditingProject,

    // Selected/Viewed Entity States
    selectedTaskForDetail,
    setSelectedTaskForDetail,
    selectedUserForDetail,
    setSelectedUserForDetail,

    // Metadata
    lastInvitedEmail,
    setLastInvitedEmail,
    previousView,
    setPreviousView,

    // Create Modal Helpers
    openNewProjectModal,
    closeNewProjectModal,
    openNewTaskModal,
    closeNewTaskModal,
    openNewSprintModal,
    closeNewSprintModal,
    openInviteModal,
    closeInviteModal,
    openInviteSuccessModal,
    closeInviteSuccessModal,

    // Edit Modal Helpers
    openEditTaskModal,
    closeEditTaskModal,
    openEditSprintModal,
    closeEditSprintModal,
    openEditProjectModal,
    closeEditProjectModal,

    // Detail Panel Helpers
    openTaskDetail,
    closeTaskDetail,
    openUserDetail,
    closeUserDetail,

    // Profile Modal Helpers
    toggleProfileModal,
    openProfileModal,
    closeProfileModal,

    // Shortcuts Modal Helpers
    toggleShortcutsModal,
    openShortcutsModal,
    closeShortcutsModal,

    // Sync Modal Helpers
    openSyncModal,
    closeSyncModal,

    // Batch Operation
    closeAllModals
  };
}
