import { useState } from "react";

/**
 * useNewProjectForm
 * Manages project creation form state
 * - Project name, key (uppercase), description
 * - resetForm() helper to clear form after project creation
 */
export const useNewProjectForm = () => {
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectKey, setNewProjectKey] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");

  const resetForm = () => {
    setNewProjectName("");
    setNewProjectKey("");
    setNewProjectDescription("");
  };

  return {
    newProjectName,
    setNewProjectName,
    newProjectKey,
    setNewProjectKey,
    newProjectDescription,
    setNewProjectDescription,
    resetForm,
  };
};
