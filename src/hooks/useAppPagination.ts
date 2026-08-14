import { useState } from "react";

/**
 * useAppPagination
 * Manages pagination and search state (currently unused, available for future use)
 * - Page states for list/master/backlog views
 * - Search query states
 * - Priority filter for backlog
 */
export const useAppPagination = () => {
  const [listPage, setListPage] = useState(1);
  const [masterPage, setMasterPage] = useState(1);
  const [backlogPage, setBacklogPage] = useState(1);
  const [auditLogSearch, setAuditLogSearch] = useState("");
  const [backlogSearch, setBacklogSearch] = useState("");
  const [backlogPriorityFilter, setBacklogPriorityFilter] = useState<string>("all");

  return {
    listPage,
    setListPage,
    masterPage,
    setMasterPage,
    backlogPage,
    setBacklogPage,
    auditLogSearch,
    setAuditLogSearch,
    backlogSearch,
    setBacklogSearch,
    backlogPriorityFilter,
    setBacklogPriorityFilter,
  };
};
