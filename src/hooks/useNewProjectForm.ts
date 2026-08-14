import { useState } from "react";

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
