import { useState } from "react";
import { format, addDays } from "date-fns";

/**
 * useNewSprintForm
 * Manages sprint creation form state
 * - Sprint name, goal, start date, end date
 * - Default dates: today to +14 days
 * - resetForm() helper to clear form after sprint creation
 */
export const useNewSprintForm = () => {
  const [newSprintName, setNewSprintName] = useState("");
  const [newSprintGoal, setNewSprintGoal] = useState("");
  const [newSprintStartDate, setNewSprintStartDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [newSprintEndDate, setNewSprintEndDate] = useState(
    format(addDays(new Date(), 14), "yyyy-MM-dd")
  );

  const resetForm = () => {
    setNewSprintName("");
    setNewSprintGoal("");
    setNewSprintStartDate(format(new Date(), "yyyy-MM-dd"));
    setNewSprintEndDate(format(addDays(new Date(), 14), "yyyy-MM-dd"));
  };

  return {
    newSprintName,
    setNewSprintName,
    newSprintGoal,
    setNewSprintGoal,
    newSprintStartDate,
    setNewSprintStartDate,
    newSprintEndDate,
    setNewSprintEndDate,
    resetForm,
  };
};
