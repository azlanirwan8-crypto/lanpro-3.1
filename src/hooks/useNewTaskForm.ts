import { useState } from "react";
import { format } from "date-fns";

/**
 * useNewTaskForm
 * Manages task creation form state
 * - All 16 task field states (title, assignee, type, dates, description, etc.)
 * - resetForm() helper to clear form after task creation
 * - Default values for start/end dates
 */
export const useNewTaskForm = () => {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState("");
  const [newTaskType, setNewTaskType] = useState<"epic" | "task" | "subtask">(
    "task"
  );
  const [newTaskCategory, setNewTaskCategory] = useState("");
  const [newTaskRelease, setNewTaskRelease] = useState("");
  const [newTaskParentId, setNewTaskParentId] = useState<string>("");
  const [newTaskSprintId, setNewTaskSprintId] = useState<string>("");

  const [newTaskStartDate, setNewTaskStartDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [newTaskEndDate, setNewTaskEndDate] = useState(
    format(new Date(Date.now() + 86400000), "yyyy-MM-dd")
  );
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskAttachments, setNewTaskAttachments] = useState<File[]>([]);
  const [newTaskBusinessValue, setNewTaskBusinessValue] = useState<string>("");
  const [newTaskProjectRisk, setNewTaskProjectRisk] = useState<string>("");
  const [newTaskStoryPoints, setNewTaskStoryPoints] = useState<number>(0);
  const [newTaskAcceptanceCriteria, setNewTaskAcceptanceCriteria] =
    useState<string>("");
  const [newTaskLabels, setNewTaskLabels] = useState<string>("");
  const [newTaskFigmaUrl, setNewTaskFigmaUrl] = useState<string>("");
  const [newTaskEnvironment, setNewTaskEnvironment] = useState<string>("");

  const resetForm = () => {
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskAcceptanceCriteria("");
    setNewTaskLabels("");
    setNewTaskStoryPoints(0);
    setNewTaskBusinessValue("");
    setNewTaskProjectRisk("");
    setNewTaskFigmaUrl("");
    setNewTaskEnvironment("");
    setNewTaskParentId("");
    setNewTaskStartDate(format(new Date(), "yyyy-MM-dd"));
    setNewTaskEndDate(format(new Date(Date.now() + 86400000), "yyyy-MM-dd"));
    setNewTaskCategory("");
    setNewTaskRelease("");
    setNewTaskAssigneeId("");
    setNewTaskType("task");
    setNewTaskSprintId("");
    setNewTaskDueDate("");
    setNewTaskAttachments([]);
  };

  return {
    newTaskTitle,
    setNewTaskTitle,
    newTaskAssigneeId,
    setNewTaskAssigneeId,
    newTaskType,
    setNewTaskType,
    newTaskCategory,
    setNewTaskCategory,
    newTaskRelease,
    setNewTaskRelease,
    newTaskParentId,
    setNewTaskParentId,
    newTaskSprintId,
    setNewTaskSprintId,
    newTaskStartDate,
    setNewTaskStartDate,
    newTaskEndDate,
    setNewTaskEndDate,
    newTaskDueDate,
    setNewTaskDueDate,
    newTaskDescription,
    setNewTaskDescription,
    newTaskAttachments,
    setNewTaskAttachments,
    newTaskBusinessValue,
    setNewTaskBusinessValue,
    newTaskProjectRisk,
    setNewTaskProjectRisk,
    newTaskStoryPoints,
    setNewTaskStoryPoints,
    newTaskAcceptanceCriteria,
    setNewTaskAcceptanceCriteria,
    newTaskLabels,
    setNewTaskLabels,
    newTaskFigmaUrl,
    setNewTaskFigmaUrl,
    newTaskEnvironment,
    setNewTaskEnvironment,
    resetForm,
  };
};
