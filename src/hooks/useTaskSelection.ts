import { useState } from "react";

export const useTaskSelection = () => {
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    new Set(),
  );

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const selectAllTasks = (taskIds: string[]) => {
    setSelectedTaskIds(new Set(taskIds));
  };

  const clearSelection = () => {
    setSelectedTaskIds(new Set());
  };

  const isTaskSelected = (taskId: string): boolean => {
    return selectedTaskIds.has(taskId);
  };

  return {
    selectedTaskIds,
    setSelectedTaskIds,
    toggleTaskSelection,
    selectAllTasks,
    clearSelection,
    isTaskSelected,
  };
};
