import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronRight,
  Plus,
  ChevronDown,
  Search,
  Settings2,
  MoreHorizontal,
  CheckCircle2,
  X,
  Calendar,
  Settings,
  Bell,
  BellRing,
  FileText,
  Image,
  Filter,
  LayoutList,
  ArrowUpDown,
  MoreVertical,
  MessageSquare,
  Paperclip,
  Clock,
  Hash,
  UserPlus,
  Zap,
  CircleDot,
  Layout,
  Lock as LockIcon,
  List,
  Trash,
  ShieldAlert,
  LayoutGrid,
  Eye,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { cn, ensureDate } from "../../lib/utils";
import { reorderTasks } from "./services/issues.service";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { UserAvatar } from "../../components/ui/UserAvatar";
import {
  PriorityIcon,
  TypeIcon,
  StyledDropdown,
  TableStatusBadge,
  UncontrolledInput,
} from "../../components/ui/CommonComponents";
import { RenderIcon } from "../../components/RenderIcon";
import { Task } from "../../types";
import { useAppStore } from "../../store/useAppStore";
import { IssueListViewProps } from "./types";
import { useIssueList } from "./hooks";
import { styles } from "./styles";
import { ConfigureColumnsModal } from "./ConfigureColumnsModal";

export const IssueListView: React.FC<IssueListViewProps> = (props) => {
  const { density, setCurrentView } = useAppStore();
  const isCompact = density === "compact";
  const {
    projectRole,
    tasks = [],
    projectMembers = [],
    masterData = [],
    userRole,
    currentUserProfile,
    setSelectedTaskForDetail,
    setIsTaskDetailModalOpen,
    setIsNewTaskModalOpen,
    hasPermission,
    deleteTask,
    bulkDeleteTasks,
    handleQuickCreate,
    selectedProject,
    user,
    fetchTasks,
  } = props;

  const isProjectMember = projectRole?.toLowerCase() === "member";
  const canReorder =
    (userRole === "admin" || userRole === "head" || userRole === "manager") && !isProjectMember;

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;

    const startIndex = (listPage - 1) * itemsPerPage;
    const absoluteSourceIndex = startIndex + result.source.index;
    const absoluteDestinationIndex = startIndex + result.destination.index;

    const reorderedRoots = Array.from(displayRoots);
    const [removed] = reorderedRoots.splice(absoluteSourceIndex, 1);
    reorderedRoots.splice(absoluteDestinationIndex, 0, removed);

    const toastId = toast.loading("Reordering backlog tasks...");
    try {
      const orderedIds = reorderedRoots.map((r) => r.id);

      const response = await reorderTasks(selectedProject.id, orderedIds);

      if (response.status === "success") {
        toast.success("Backlog tasks prioritized successfully!", { id: toastId });
        if (fetchTasks) {
          fetchTasks();
        }
      } else {
        throw new Error(response.message || "Failed to reorder");
      }
    } catch (err: any) {
      console.error("Failed to reorder tasks:", err);
      toast.error(err.message || "Failed to prioritize tasks", { id: toastId });
    }
  };

  const {
    displayRoots,
    handleToggleSelectAll,
    handleToggleSelectOne,
    listFilterStatus,
    setListFilterStatus,
    listFilterPriority,
    setListFilterPriority,
    listFilterAssignee,
    setListFilterAssignee,
    listFilterCategory,
    setListFilterCategory,
    listFilterSprint,
    setListFilterSprint,
    listFilterLabel,
    setListFilterLabel,
    listFilterEnvironment,
    setListFilterEnvironment,
    listFilterProjectRisk,
    setListFilterProjectRisk,
    listFilterRelease,
    setListFilterRelease,
    listFilterResolution,
    setListFilterResolution,
    listFilterDateType,
    setListFilterDateType,
    listFilterStartDate,
    setListFilterStartDate,
    listFilterEndDate,
    setListFilterEndDate,
    issueSearch,
    setIssueSearch,
    listPage,
    setListPage,
    itemsPerPage,
    setItemsPerPage,
    expandedTasks,
    setExpandedTasks,
    selectedTaskIds,
    setSelectedTaskIds,
    issueTableColumns,
    setIssueTableColumns,
    isConfigureColumnsOpen,
    setIsConfigureColumnsOpen,
    inlineAddingTaskId,
    setInlineAddingTaskId,
    inlineAddTitle,
    setInlineAddTitle,
    inlineAddType,
    setInlineAddType,
    inlineAddPriority,
    setInlineAddPriority,
    inlineAddStatus,
    setInlineAddStatus,
    inlineAddAssigneeId,
    setInlineAddAssigneeId,
    inlineAddReporterId,
    setInlineAddReporterId,
    inlineAddCategory,
    setInlineAddCategory,
    inlineAddDueDate,
    setInlineAddDueDate,
    inlineAddRelease,
    setInlineAddRelease,
    isInlineTypeOpen,
    setIsInlineTypeOpen,
    isCreating,
    toggleTaskExpansion,
    handleInlineAdd,
    handleReorderColumns,
    handleColumnResize,
  } = useIssueList({ ...props, updateTaskField: props.updateTaskField });

  const { updateTaskField } = props;

  const isUserReporter = (issue: Task): boolean => {
    if (!issue) return false;
    const currentUserId =
      currentUserProfile?.uid || currentUserProfile?.id || user?.uid || user?.id;
    const currentUsername = currentUserProfile?.username || user?.username;
    const currentEmail = currentUserProfile?.email || user?.email;
    const rId = issue.reporterId;
    return (
      !!currentUserId &&
      (rId === currentUserId ||
        rId === currentUsername ||
        rId === currentEmail ||
        rId === currentUserProfile?.id)
    );
  };

  const canEditIssue = (issue: Task): boolean => {
    if (!issue) return false;
    const isReporter = isUserReporter(issue);
    const hasRole = hasPermission(
      userRole,
      "list",
      "update",
      isReporter,
      currentUserProfile?.permissions
    );
    const isLeadOrAdmin = ["admin", "manager", "head"].includes(userRole || "");
    return hasRole || isReporter || isLeadOrAdmin;
  };

  const canDeleteIssue = (issue: Task): boolean => {
    if (!issue) return false;
    const isReporter = isUserReporter(issue);
    const hasRole = hasPermission(
      userRole,
      "list",
      "delete",
      isReporter,
      currentUserProfile?.permissions
    );
    const isLeadOrAdmin = ["admin", "manager", "head"].includes(userRole || "");
    return hasRole || isReporter || isLeadOrAdmin;
  };

  const currentUserId = currentUserProfile?.uid || currentUserProfile?.id || user?.uid || user?.id;
  const currentUsername = currentUserProfile?.username || user?.username;
  const currentEmail = currentUserProfile?.email || user?.email;
  const currentDisplayName = currentUserProfile?.displayName || user?.displayName;
  const currentNamaLengkap =
    (currentUserProfile as any)?.nama_lengkap || (user as any)?.nama_lengkap;

  const validIdentifiers = [
    currentUserId,
    currentUsername,
    currentEmail,
    currentDisplayName,
    currentNamaLengkap,
  ].filter(Boolean);

  const rawTasks = Array.isArray(tasks) ? tasks : [];
  const isAdminOrManager = ["admin", "manager", "head"].includes(userRole || "");

  const tArr = React.useMemo(() => {
    return rawTasks;
  }, [rawTasks]);
  const mArr = Array.isArray(masterData) ? masterData : [];

  const [isFiltersPanelOpen, setIsFiltersPanelOpen] = React.useState(false);
  const [activeContextMenuTaskId, setActiveContextMenuTaskId] = React.useState<string | null>(null);

  const [inlineTitleMap, setInlineTitleMap] = React.useState<Record<string, string>>({});
  const [quickCreateTitle, setQuickCreateTitle] = React.useState("");

  const createSubtask = async (parentId: string) => {
    const title = inlineTitleMap[parentId] || "";
    if (!title.trim()) {
      toast.error("Judul tugas tidak boleh kosong");
      return;
    }
    await handleInlineAdd(parentId, title);
    setInlineTitleMap((prev) => ({ ...prev, [parentId]: "" }));
  };

  const createGlobalIssue = async () => {
    if (!quickCreateTitle.trim()) {
      toast.error("Judul tugas tidak boleh kosong");
      return;
    }
    await handleInlineAdd(null, quickCreateTitle);
    setQuickCreateTitle("");
  };

  // Memoized fields computed from database / current tasks for custom options
  const allLabels = React.useMemo(() => {
    const labelSet = new Set<string>();
    tArr.forEach((t) => {
      if (Array.isArray(t.labels)) {
        t.labels.forEach((l) => {
          if (l) labelSet.add(l.trim());
        });
      }
    });
    return Array.from(labelSet).sort();
  }, [tArr]);

  const allEnvironments = React.useMemo(() => {
    const envSet = new Set<string>();
    mArr.filter((m) => m.type === "environment").forEach((m) => envSet.add(m.label));
    tArr.forEach((t) => {
      if (t.environment) envSet.add(t.environment);
    });
    return Array.from(envSet).sort();
  }, [tArr, mArr]);

  const allProjectRisks = React.useMemo(() => {
    const riskSet = new Set<string>(["Low", "Medium", "High"]);
    tArr.forEach((t) => {
      if (t.projectRisk) riskSet.add(t.projectRisk);
    });
    return Array.from(riskSet).sort();
  }, [tArr]);

  const allReleases = React.useMemo(() => {
    const releaseSet = new Set<string>();
    mArr.filter((m) => m.type === "release").forEach((m) => releaseSet.add(m.label));
    tArr.forEach((t) => {
      if (t.release) releaseSet.add(t.release);
    });
    return Array.from(releaseSet).sort();
  }, [tArr, mArr]);

  const allResolutions = React.useMemo(() => {
    const resSet = new Set<string>();
    mArr.filter((m) => m.type === "resolution").forEach((m) => resSet.add(m.label));
    tArr.forEach((t) => {
      if (t.resolution) resSet.add(t.resolution);
    });
    return Array.from(resSet).sort();
  }, [tArr, mArr]);

  const renderIssueRow = (task: Task, depth: number = 0, dragHandleProps?: any) => {
    const isExpanded = expandedTasks.has(task.id);
    const rawSubtasks = tArr
      .filter((t) => t.parentId === task.id)
      .filter((s) => {
        if (issueSearch) {
          const query = issueSearch.toLowerCase().trim();
          const matchesQuery =
            (s.title || "").toLowerCase().includes(query) ||
            (s.key || "").toLowerCase().includes(query);
          if (!matchesQuery) return false;
        }
        if (listFilterStatus && listFilterStatus !== "All" && s.status !== listFilterStatus)
          return false;
        if (listFilterPriority && listFilterPriority !== "All" && s.priority !== listFilterPriority)
          return false;
        if (
          listFilterAssignee &&
          listFilterAssignee !== "All" &&
          s.assigneeId !== listFilterAssignee
        )
          return false;
        if (listFilterCategory && listFilterCategory !== "All" && s.category !== listFilterCategory)
          return false;
        if (listFilterSprint && listFilterSprint !== "All") {
          if (listFilterSprint === "Backlog" && s.sprintId) return false;
          if (listFilterSprint !== "Backlog" && s.sprintId !== listFilterSprint) return false;
        }
        if (
          listFilterEnvironment &&
          listFilterEnvironment !== "All" &&
          s.environment !== listFilterEnvironment
        )
          return false;
        if (
          listFilterProjectRisk &&
          listFilterProjectRisk !== "All" &&
          s.projectRisk !== listFilterProjectRisk
        )
          return false;
        if (listFilterRelease && listFilterRelease !== "All" && s.release !== listFilterRelease)
          return false;
        if (
          listFilterResolution &&
          listFilterResolution !== "All" &&
          s.resolution !== listFilterResolution
        )
          return false;
        if (listFilterLabel && listFilterLabel !== "All") {
          if (!s.labels || !Array.isArray(s.labels) || !s.labels.includes(listFilterLabel))
            return false;
        }
        if (listFilterStartDate || listFilterEndDate) {
          const col = listFilterDateType;
          const checkSubDate = (key: string): boolean => {
            const rawVal = s[key as keyof Task];
            if (!rawVal) return false;
            try {
              const itemDate = new Date(rawVal);
              if (isNaN(itemDate.getTime())) return false;
              const time = itemDate.getTime();
              const startOk = listFilterStartDate
                ? time >= new Date(listFilterStartDate + "T00:00:00").getTime()
                : true;
              const endOk = listFilterEndDate
                ? time <= new Date(listFilterEndDate + "T23:59:59").getTime()
                : true;
              return startOk && endOk;
            } catch {
              return false;
            }
          };

          if (col === "any") {
            const hasAnyMatch = ["startDate", "endDate", "dueDate", "createdAt"].some((c) =>
              checkSubDate(c)
            );
            if (!hasAnyMatch) return false;
          } else {
            if (!checkSubDate(col)) return false;
          }
        }
        return true;
      });
    const subtasks = Array.from(
      new Map(rawSubtasks.filter((s) => s && s.id).map((s) => [s.id, s])).values()
    );
    const hasSubtasks = subtasks.length > 0;
    const isSelected = selectedTaskIds.has(task.id);
    const isDirectOwner = isUserReporter(task);
    const isEditable = isDirectOwner;
    const canDelete = isDirectOwner;
    const blockMember = !isEditable;
    const isProjectMember = false;
    const isReporter = isDirectOwner;

    return (
      <React.Fragment key={task.id ? `tr-${task.id}-${depth}` : `tr-rnd-${Math.random()}`}>
        <motion.tr
          layout
          initial={{ opacity: 0, y: -8, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.99 }}
          transition={{
            duration: 0.22,
            ease: [0.16, 1, 0.3, 1],
          }}
          className={cn(
            styles.tableRow,
            "hover:bg-indigo-50/30 hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-all duration-200",
            isSelected && styles.selectedTableRow
          )}
        >
          {canReorder && (
            <td className="w-8 px-1 text-center border-r border-border-faint/50 bg-surface">
              {depth === 0 && dragHandleProps ? (
                <div
                  {...dragHandleProps}
                  className="cursor-grab active:cursor-grabbing text-content-subtle hover:text-content-secondary flex justify-center py-1 outline-none"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </div>
              ) : null}
            </td>
          )}
          <td
            className={cn(
              "w-12 px-4 border-r border-border-faint/50",
              isCompact ? "py-0.5" : "py-1.5"
            )}
          >
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggleSelectOne(task.id)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shadow-soft transition-all cursor-pointer"
              />
            </div>
          </td>

          {issueTableColumns
            .filter((c) => c.visible)
            .map((col: any) => {
              let content: React.ReactNode = null;

              switch (col.id) {
                case "work":
                  const typeData = mArr.find(
                    (m) =>
                      m.type === "issue_type" && m.label?.toLowerCase() === task.type?.toLowerCase()
                  );
                  content = (
                    <div
                      className="flex items-center gap-2"
                      style={{ paddingLeft: `${depth * 24}px` }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskExpansion(task.id);
                        }}
                        className={cn(
                          "p-1 hover:bg-slate-200 rounded transition-colors text-content-subtle shrink-0 outline-none",
                          !hasSubtasks && "opacity-0 pointer-events-none"
                        )}
                      >
                        <ChevronRight
                          className={cn(
                            "w-3.5 h-3.5 transition-transform",
                            isExpanded && "rotate-90"
                          )}
                        />
                      </button>

                      <div className="w-4 h-4 flex items-center justify-center shrink-0">
                        {typeData?.icon ? (
                          <RenderIcon
                            iconName={typeData.icon}
                            className="w-3.5 h-3.5 saturate-150"
                            style={{ color: typeData.color }}
                          />
                        ) : task.type === "epic" ? (
                          <Zap className="w-3.5 h-3.5 text-purple-600" />
                        ) : task.type === "task" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <CircleDot className="w-3.5 h-3.5 text-content-subtle" />
                        )}
                      </div>

                      {task.type !== "epic" && (
                        <span
                          className="text-xs sm:text-[11px] font-mono font-medium text-content-subtle bg-surface-sunken px-1.5 py-0.5 rounded border border-border-subtle select-all shrink-0 uppercase tracking-tighter"
                          title={task.key}
                        >
                          {task.key}
                        </span>
                      )}

                      {!!task.isBlocked && (
                        <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0 animate-pulse" />
                      )}

                      <span
                        onClick={() => {
                          setSelectedTaskForDetail(task);
                          setIsTaskDetailModalOpen(false);
                          setCurrentView("issueDetail" as any);
                        }}
                        className="text-[13px] font-medium text-content-body hover:text-blue-600 transition-colors cursor-pointer truncate max-w-[320px] block"
                        title="Klik untuk membuka halaman detail issue"
                      >
                        {task.title || (task as any).summary || (task as any).name || ""}
                      </span>

                      {!!task.parentId && (
                        <span className="text-xs sm:text-[10px] text-content-subtle font-medium bg-surface-muted px-1.5 py-0.5 rounded border border-border-subtle shrink-0">
                          Subtask
                        </span>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInlineTitleMap((prev) => ({ ...prev, [task.id]: "" }));
                          setInlineAddingTaskId(task.id);
                          if (!expandedTasks.has(task.id)) {
                            toggleTaskExpansion(task.id);
                          }
                        }}
                        className="p-1 opacity-0 group-hover:opacity-100 text-content-subtle hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all shrink-0 border border-transparent hover:border-blue-100"
                        title="Add subtask"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                  break;

                case "assignee":
                  const memberOptions = [
                    { id: "", label: "Unassigned" },
                    ...projectMembers.map((m) => ({
                      id: m?.uid || "",
                      label: m?.displayName || m?.email || "Unknown",
                    })),
                  ];
                  content = (
                    <StyledDropdown
                      value={task.assigneeId || ""}
                      onChange={(val) => updateTaskField(task.id, "assigneeId", val)}
                      options={memberOptions}
                      members={projectMembers}
                      type="member"
                      masterData={mArr}
                      disabled={!isEditable || blockMember}
                      className={cn(
                        "max-w-[150px]",
                        blockMember && "pointer-events-none opacity-85"
                      )}
                    />
                  );
                  break;

                case "reporter": {
                  const reporterObj =
                    (task as any).reporter ||
                    projectMembers.find(
                      (m) => m.uid === task.reporterId || (m as any).id === task.reporterId
                    );
                  const reporterName =
                    reporterObj?.name ||
                    reporterObj?.displayName ||
                    reporterObj?.email ||
                    (task.reporterId ? "Unknown" : "Unassigned");
                  content = (
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        uid={task.reporterId || ""}
                        user={reporterObj}
                        members={projectMembers}
                        className="w-5 h-5 border border-white shadow-soft ring-1 ring-slate-100"
                      />
                      <span
                        className={cn(
                          "text-xs sm:text-[11px] font-medium truncate max-w-[120px]",
                          reporterObj ? "text-content-body" : "text-content-subtle"
                        )}
                      >
                        {reporterName}
                      </span>
                    </div>
                  );
                  break;
                }

                case "priority":
                  const priorityOptions = mArr
                    .filter((m) => m.type === "priority")
                    .map((m) => ({ id: m.label, label: m.label, color: m.color, icon: m.icon }));
                  content = (
                    <StyledDropdown
                      value={task.priority}
                      onChange={(val) => updateTaskField(task.id, "priority", val)}
                      options={priorityOptions}
                      masterData={mArr}
                      type="priority"
                      disabled={!isEditable}
                      className="text-xs sm:text-[10px]"
                    />
                  );
                  break;

                case "status":
                  const statusOptions = mArr
                    .filter((m) => m.type === "status")
                    .map((m) => ({ id: m.label, label: m.label, color: m.color, icon: m.icon }));
                  content = (
                    <StyledDropdown
                      value={task.status}
                      onChange={(val) => updateTaskField(task.id, "status", val)}
                      options={statusOptions}
                      masterData={mArr}
                      type="status"
                      disabled={!isEditable}
                      className="text-xs sm:text-[10px]"
                    />
                  );
                  break;

                case "progress":
                  const getProgressValue = (statusStr: string): number => {
                    if (!statusStr) return 0;
                    const s = statusStr.toLowerCase().trim();
                    if (s === "done" || s === "selesai" || s === "completed" || s === "closed") {
                      return 100;
                    }
                    if (s === "code review" || s === "review" || s === "testing") {
                      return 75;
                    }
                    if (s === "in progress" || s === "dikerjakan" || s === "doing") {
                      return 50;
                    }
                    return 0;
                  };
                  const progressValue = getProgressValue(task.status);
                  content = (
                    <div className="flex items-center gap-2 w-full max-w-[120px] select-none pr-1">
                      <div className="flex-1 h-1.5 bg-surface-muted rounded-full overflow-hidden border border-border-subtle/40 relative">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            progressValue === 100
                              ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                              : progressValue === 75
                                ? "bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.4)]"
                                : progressValue === 50
                                  ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                                  : "bg-slate-300"
                          )}
                          style={{ width: `${progressValue}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-xs sm:text-[10px] font-medium font-mono w-8 text-right shrink-0",
                          progressValue === 100
                            ? "text-emerald-600"
                            : progressValue === 75
                              ? "text-violet-600"
                              : progressValue === 50
                                ? "text-amber-600"
                                : "text-content-subtle"
                        )}
                      >
                        {progressValue}%
                      </span>
                    </div>
                  );
                  break;

                case "resolution":
                  const resOptions = [
                    { id: "Unresolved", label: "Unresolved", color: "#94a3b8" },
                    ...mArr
                      .filter((m) => m.type === "resolution")
                      .map((m) => ({ id: m.label, label: m.label, color: m.color })),
                  ];
                  content = (
                    <StyledDropdown
                      value={task.resolution || "Unresolved"}
                      onChange={(val) => updateTaskField(task.id, "resolution", val)}
                      options={resOptions}
                      masterData={mArr}
                      disabled={!isEditable}
                      className="text-xs sm:text-[10px]"
                    />
                  );
                  break;

                case "category":
                  const catOptions = [
                    { id: "", label: "No Category", color: "#94a3b8" },
                    ...mArr
                      .filter((m) => m.type === "category")
                      .map((m) => ({ id: m.label, label: m.label, color: m.color })),
                  ];
                  content = (
                    <StyledDropdown
                      value={task.category || ""}
                      onChange={(val) => updateTaskField(task.id, "category", val)}
                      options={catOptions}
                      masterData={mArr}
                      disabled={!isEditable}
                      className="text-xs sm:text-[10px]"
                    />
                  );
                  break;

                case "storyPoints":
                  content = (
                    <UncontrolledInput
                      type="number"
                      disabled={!isEditable}
                      initialValue={task.storyPoints || ""}
                      onSave={(val: any) =>
                        updateTaskField(task.id, "storyPoints", val ? Number(val) : null)
                      }
                      className="bg-transparent border border-transparent hover:border-border-subtle focus:border-indigo-500 rounded px-2 py-1 text-xs sm:text-[11px] font-medium text-content-body w-full outline-none transition-colors"
                      placeholder="-"
                    />
                  );
                  break;

                case "sprint":
                  content = (
                    <StyledDropdown
                      disabled={!isEditable}
                      value={task.sprintId || ""}
                      onChange={(val) => updateTaskField(task.id, "sprintId", val)}
                      options={[
                        { id: "", label: "Backlog", icon: "Box" },
                        ...(props.sprints?.map((s) => ({
                          id: s.id,
                          label: s.name,
                          icon: "IterationCcw",
                        })) || []),
                      ]}
                      type="sprint"
                      masterData={mArr}
                    />
                  );
                  break;

                case "labels":
                  content = (
                    <div className="flex gap-1 overflow-hidden max-w-[150px]">
                      {task.labels?.length ? (
                        task.labels.map((L, lIdx) => (
                          <span
                            key={`${L}-${lIdx}`}
                            className="text-xs sm:text-[11px] sm:text-[9px] font-medium rounded bg-surface-muted text-content-secondary px-1.5 py-0.5 truncate max-w-[60px]"
                          >
                            {L}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs sm:text-[10px] text-slate-300">-</span>
                      )}
                    </div>
                  );
                  break;

                case "startDate":
                case "endDate":
                case "dueDate":
                  const dateVal = task[col.id as keyof Task];
                  content = (
                    <UncontrolledInput
                      type="date"
                      disabled={!isEditable}
                      initialValue={dateVal ? format(ensureDate(dateVal), "yyyy-MM-dd") : ""}
                      onSave={(val: any) => updateTaskField(task.id, col.id, val)}
                      className="bg-transparent border-none text-xs sm:text-[10px] font-medium text-content-muted focus:ring-0 active:ring-0 outline-none w-full"
                    />
                  );
                  break;

                case "release":
                  const relOptions = [
                    { id: "", label: "No Release", color: "#94a3b8" },
                    ...mArr
                      .filter((m) => m.type === "release")
                      .map((m) => ({ id: m.label, label: m.label, color: m.color })),
                  ];
                  content = (
                    <StyledDropdown
                      value={task.release || ""}
                      onChange={(val) => updateTaskField(task.id, "release", val)}
                      options={relOptions}
                      masterData={mArr}
                      disabled={!isEditable}
                      className="text-xs sm:text-[10px]"
                    />
                  );
                  break;

                case "updated":
                  content = (
                    <span className="text-xs sm:text-[10px] font-medium text-content-subtle whitespace-nowrap">
                      {task.updatedAt
                        ? formatDistanceToNow(ensureDate(task.updatedAt), { addSuffix: true })
                        : "-"}
                    </span>
                  );
                  break;

                case "created":
                  content = (
                    <span className="text-xs sm:text-[10px] font-medium text-content-subtle whitespace-nowrap">
                      {task.createdAt ? format(ensureDate(task.createdAt), "d MMM yyyy") : "-"}
                    </span>
                  );
                  break;
              }

              return (
                <td
                  key={col.id}
                  className={cn(
                    "px-4 border-r border-border-faint/50 whitespace-nowrap overflow-hidden text-ellipsis",
                    isCompact ? "py-0.5" : "py-1.5"
                  )}
                  style={{ width: col.width }}
                >
                  {content}
                </td>
              );
            })}

          <td className={cn("px-2 relative", isCompact ? "py-0.5" : "py-1.5")}>
            <div className="flex items-center justify-center gap-1.5">
              {canDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTask(task.id);
                  }}
                  className="p-1 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200/80 rounded-lg transition-all cursor-pointer shadow-xs font-medium"
                  title="Hapus Issue"
                >
                  <Trash className="w-3.5 h-3.5 shrink-0" />
                </button>
              )}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveContextMenuTaskId(
                      activeContextMenuTaskId === task.id ? null : task.id
                    );
                  }}
                  className="p-1 bg-surface-muted hover:bg-indigo-600 text-content-secondary hover:text-white border border-border-subtle rounded-lg transition-all cursor-pointer shadow-xs font-medium"
                  title="Menu Aksi"
                >
                  <MoreVertical className="w-3.5 h-3.5 shrink-0" />
                </button>
                {activeContextMenuTaskId === task.id && (
                  <>
                    <div
                      className="fixed inset-0 z-[100]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveContextMenuTaskId(null);
                      }}
                    />
                    <div className="absolute right-0 mt-1 w-36 bg-surface border border-border-subtle rounded-lg shadow-xl z-[101] overflow-hidden py-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTaskForDetail(task);
                          setCurrentView("issueDetail");
                          setActiveContextMenuTaskId(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs sm:text-[11px] font-medium text-content-secondary hover:bg-surface-sunken flex items-center gap-2 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-content-subtle" />
                        <span>View Details</span>
                      </button>
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTask(task.id);
                            setActiveContextMenuTaskId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs sm:text-[11px] font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer border-t border-border-faint"
                        >
                          <Trash className="w-3.5 h-3.5 text-red-400" />
                          <span>Delete Issue</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </td>
        </motion.tr>

        {/* Inline Add Row */}
        {expandedTasks.has(task.id) && inlineAddingTaskId === task.id && (
          <motion.tr
            layout
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className={styles.inlineAddRow}
          >
            {canReorder && (
              <td className="w-8 border-y-2 border-blue-500 border-r border-border-faint/50 bg-surface" />
            )}
            <td
              className={cn(
                "px-4 border-r border-border-faint/50 border-y-2 border-blue-500",
                isCompact ? "py-0.5" : "py-1.5"
              )}
            />
            {issueTableColumns
              .filter((c) => c.visible)
              .map((col) => (
                <td
                  key={col.id}
                  className={cn(styles.inlineAddBorderedCell, col.id === "work" && "z-20")}
                >
                  {col.id === "work" ? (
                    <div
                      className="flex items-center gap-2 p-2 bg-surface h-full"
                      style={{ paddingLeft: `${(depth + 1) * 24}px` }}
                    >
                      <div className="relative">
                        <button
                          onClick={() =>
                            setIsInlineTypeOpen(isInlineTypeOpen === "inline" ? null : "inline")
                          }
                          className="flex items-center gap-1.5 p-1 bg-surface-sunken border border-border-subtle rounded text-content-secondary hover:border-blue-300 hover:bg-blue-50 transition-all font-medium text-xs sm:text-[10px]"
                        >
                          {(() => {
                            const typeData = mArr.find(
                              (m) =>
                                m.type === "issue_type" &&
                                m.label?.toLowerCase() === inlineAddType?.toLowerCase()
                            );
                            if (typeData?.icon)
                              return (
                                <RenderIcon
                                  iconName={typeData.icon}
                                  className="w-3.5 h-3.5"
                                  style={{ color: typeData.color }}
                                />
                              );
                            return <Zap className="w-3.5 h-3.5 text-blue-600" />;
                          })()}
                          <ChevronDown className="w-3 h-3 text-content-subtle ml-0.5" />
                        </button>
                        {isInlineTypeOpen === "inline" && (
                          <div className="absolute left-0 top-full mt-2 w-48 bg-surface border border-border-subtle rounded-lg shadow-xl z-[100] overflow-hidden">
                            {mArr
                              .filter((m) => m.type === "issue_type")
                              .map((t) => (
                                <button
                                  key={t.id}
                                  onClick={() => {
                                    setInlineAddType(t.label);
                                    setIsInlineTypeOpen(null);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs sm:text-[11px] font-medium text-content-secondary hover:bg-surface-sunken flex items-center gap-2"
                                >
                                  {t.icon ? (
                                    <RenderIcon
                                      iconName={t.icon}
                                      className="w-3.5 h-3.5"
                                      style={{ color: t.color }}
                                    />
                                  ) : (
                                    <Zap className="w-3.5 h-3.5" style={{ color: t.color }} />
                                  )}
                                  <span>{t.label}</span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 relative">
                        <input
                          autoFocus
                          value={inlineTitleMap[task.id] || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInlineTitleMap((prev) => ({ ...prev, [task.id]: val }));
                          }}
                          placeholder="What needs to be done?"
                          onKeyDown={(e) => e.key === "Enter" && createSubtask(task.id)}
                          className={styles.inlineAddInput}
                        />
                      </div>
                    </div>
                  ) : col.id === "assignee" ? (
                    <div className="p-2 bg-surface h-full min-w-[150px] flex items-center">
                      <StyledDropdown
                        value={inlineAddAssigneeId}
                        onChange={(val) => setInlineAddAssigneeId(val)}
                        options={[
                          { id: "", label: "Unassigned" },
                          ...projectMembers.map((m) => ({
                            id: m?.uid || "",
                            label: m?.displayName || m?.email || "Unknown",
                          })),
                        ]}
                        members={projectMembers}
                        type="member"
                        masterData={mArr}
                        className="w-full"
                      />
                    </div>
                  ) : col.id === "priority" ? (
                    <div className="flex items-center p-2 bg-surface h-full min-w-[120px]">
                      <StyledDropdown
                        value={inlineAddPriority || "Medium"}
                        onChange={(val) => setInlineAddPriority(val)}
                        options={mArr
                          .filter((m) => m.type === "priority")
                          .map((p) => ({
                            id: p.label,
                            label: p.label,
                          }))}
                        type="priority"
                        masterData={mArr}
                        className="w-[100px]"
                      />
                    </div>
                  ) : (
                    <div className="bg-surface h-full border-r border-border-faint/50" />
                  )}
                </td>
              ))}
            <td className="px-2 py-3 border-y-2 border-blue-500 bg-surface">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => createSubtask(task.id)}
                  disabled={isCreating}
                  className="p-1 px-2 bg-blue-600 text-white rounded text-xs sm:text-[10px] font-medium hover:bg-blue-700 disabled:opacity-50 transition-all"
                >
                  {isCreating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setInlineAddingTaskId(null);
                    setInlineTitleMap((prev) => {
                      const next = { ...prev };
                      delete next[task.id];
                      return next;
                    });
                  }}
                  className="p-1 px-2 bg-surface-muted text-content-subtle rounded text-xs sm:text-[10px] font-medium hover:bg-slate-200 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </td>
          </motion.tr>
        )}

        <AnimatePresence initial={false}>
          {isExpanded && subtasks.map((s) => renderIssueRow(s, depth + 1))}
        </AnimatePresence>
      </React.Fragment>
    );
  };

  return (
    <div className="flex-1 p-2 sm:p-4 md:p-6 bg-surface-sunken overflow-hidden flex flex-col w-full h-full">
      <div className={cn(styles.container, "rounded-xl flex-1 flex flex-col")}>
        {/* Header Toolbar */}
        <div className={styles.toolbar}>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className={cn(styles.searchWrapper, "flex-1 sm:flex-none")}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-subtle group-focus-within:text-indigo-500 transition-colors" />
              <input
                value={issueSearch}
                onChange={(e) => setIssueSearch(e.target.value)}
                placeholder="Search issues..."
                className={styles.searchInput}
              />
            </div>

            <button
              type="button"
              onClick={() => setIsFiltersPanelOpen((prev) => !prev)}
              className={cn(
                "flex items-center justify-center gap-1.5 px-3 py-2 sm:px-3.5 bg-surface border border-border-subtle/80 rounded-md text-content-body hover:text-primary hover:border-primary/40 transition-all text-xs font-medium shadow-xs select-none shrink-0 cursor-pointer",
                isFiltersPanelOpen &&
                  "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15"
              )}
              title="Toggle Advanced Filtering Panel"
            >
              <Filter className="w-3.5 h-3.5 text-content-muted shrink-0" />
              <span className="hidden sm:inline">Advanced Filters</span>
              <span className="sm:hidden">Filters</span>
              {(() => {
                let activeCount = 0;
                if (listFilterStatus !== "All") activeCount++;
                if (listFilterPriority !== "All") activeCount++;
                if (listFilterAssignee !== "All") activeCount++;
                if (listFilterCategory !== "All") activeCount++;
                if (listFilterSprint !== "All") activeCount++;
                if (listFilterLabel !== "All") activeCount++;
                if (listFilterEnvironment !== "All") activeCount++;
                if (listFilterProjectRisk !== "All") activeCount++;
                if (listFilterRelease !== "All") activeCount++;
                if (listFilterResolution !== "All") activeCount++;
                if (listFilterStartDate) activeCount++;
                if (listFilterEndDate) activeCount++;

                if (activeCount > 0) {
                  return (
                    <span className="ml-1 bg-primary text-white rounded-full px-1.5 py-0.5 flex items-center justify-center text-xs sm:text-[11px] sm:text-[9px] font-semibold leading-none">
                      {activeCount}
                    </span>
                  );
                }
                return null;
              })()}
            </button>

            <div className="flex items-center gap-1.5 flex-wrap max-w-xl">
              {listFilterStatus !== "All" && (
                <span
                  className={cn(
                    styles.filterPill,
                    "flex items-center gap-1 py-1 px-2.5 rounded-full text-xs sm:text-[11px] font-medium"
                  )}
                >
                  Status: {listFilterStatus}
                  <button
                    type="button"
                    onClick={() => setListFilterStatus("All")}
                    className="hover:text-red-500 font-medium transition-colors outline-none inline-flex items-center"
                  >
                    <X className="w-2.5 h-2.5 ml-1" />
                  </button>
                </span>
              )}
              {listFilterPriority !== "All" && (
                <span
                  className={cn(
                    styles.filterPillAmber,
                    "flex items-center gap-1 py-1 px-2.5 rounded-full text-xs sm:text-[11px] font-medium"
                  )}
                >
                  Priority: {listFilterPriority}
                  <button
                    type="button"
                    onClick={() => setListFilterPriority("All")}
                    className="hover:text-red-500 font-medium transition-colors outline-none inline-flex items-center"
                  >
                    <X className="w-2.5 h-2.5 ml-1" />
                  </button>
                </span>
              )}
              {listFilterAssignee !== "All" && (
                <span className="text-xs sm:text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 flex items-center gap-1 shadow-soft">
                  Assignee:{" "}
                  {projectMembers.find((m) => m.uid === listFilterAssignee)?.displayName ||
                    "Unassigned"}
                  <button
                    type="button"
                    onClick={() => setListFilterAssignee("All")}
                    className="hover:text-red-500 font-medium transition-colors outline-none inline-flex items-center"
                  >
                    <X className="w-2.5 h-2.5 ml-0.5" />
                  </button>
                </span>
              )}
              {listFilterSprint !== "All" && (
                <span className="text-xs sm:text-[11px] font-medium text-content-secondary bg-surface-muted px-2.5 py-1 rounded-full border border-border-subtle flex items-center gap-1 shadow-soft">
                  Sprint:{" "}
                  {listFilterSprint === "Backlog"
                    ? "Backlog"
                    : props.sprints?.find((s) => s.id === listFilterSprint)?.name ||
                      listFilterSprint}
                  <button
                    type="button"
                    onClick={() => setListFilterSprint("All")}
                    className="hover:text-red-500 font-medium transition-colors outline-none inline-flex items-center"
                  >
                    <X className="w-2.5 h-2.5 ml-0.5" />
                  </button>
                </span>
              )}
              {listFilterCategory !== "All" && (
                <span className="text-xs sm:text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1 shadow-soft">
                  Category: {listFilterCategory}
                  <button
                    type="button"
                    onClick={() => setListFilterCategory("All")}
                    className="hover:text-red-500 font-medium transition-colors outline-none inline-flex items-center"
                  >
                    <X className="w-2.5 h-2.5 ml-0.5" />
                  </button>
                </span>
              )}
              {listFilterLabel !== "All" && (
                <span className="text-xs sm:text-[11px] font-medium text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100 flex items-center gap-1 shadow-soft">
                  Label: {listFilterLabel}
                  <button
                    type="button"
                    onClick={() => setListFilterLabel("All")}
                    className="hover:text-red-500 font-medium transition-colors outline-none inline-flex items-center"
                  >
                    <X className="w-2.5 h-2.5 ml-0.5" />
                  </button>
                </span>
              )}
              {listFilterEnvironment !== "All" && (
                <span className="text-xs sm:text-[11px] font-medium text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100 flex items-center gap-1 shadow-soft">
                  Environment: {listFilterEnvironment}
                  <button
                    type="button"
                    onClick={() => setListFilterEnvironment("All")}
                    className="hover:text-red-500 font-medium transition-colors outline-none inline-flex items-center"
                  >
                    <X className="w-2.5 h-2.5 ml-0.5" />
                  </button>
                </span>
              )}
              {listFilterProjectRisk !== "All" && (
                <span className="text-xs sm:text-[11px] font-medium text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100 flex items-center gap-1 shadow-soft">
                  Risk: {listFilterProjectRisk}
                  <button
                    type="button"
                    onClick={() => setListFilterProjectRisk("All")}
                    className="hover:text-red-500 font-medium transition-colors outline-none inline-flex items-center"
                  >
                    <X className="w-2.5 h-2.5 ml-0.5" />
                  </button>
                </span>
              )}
              {listFilterRelease !== "All" && (
                <span className="text-xs sm:text-[11px] font-medium text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100 flex items-center gap-1 shadow-soft">
                  Release: {listFilterRelease}
                  <button
                    type="button"
                    onClick={() => setListFilterRelease("All")}
                    className="hover:text-red-500 font-medium transition-colors outline-none inline-flex items-center"
                  >
                    <X className="w-2.5 h-2.5 ml-0.5" />
                  </button>
                </span>
              )}
              {listFilterResolution !== "All" && (
                <span className="text-xs sm:text-[11px] font-medium text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-100 flex items-center gap-1 shadow-soft">
                  Resolution: {listFilterResolution}
                  <button
                    type="button"
                    onClick={() => setListFilterResolution("All")}
                    className="hover:text-red-500 font-medium transition-colors outline-none inline-flex items-center"
                  >
                    <X className="w-2.5 h-2.5 ml-0.5" />
                  </button>
                </span>
              )}
              {(listFilterStartDate || listFilterEndDate) && (
                <span className="text-xs sm:text-[11px] font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 flex items-center gap-1 shadow-soft">
                  <Calendar className="w-3 h-3 text-amber-600 shrink-0" />
                  Date (
                  {listFilterDateType === "dueDate"
                    ? "Due"
                    : listFilterDateType === "startDate"
                      ? "Start"
                      : listFilterDateType === "endDate"
                        ? "End"
                        : listFilterDateType === "createdAt"
                          ? "Created"
                          : "Any"}
                  ): {listFilterStartDate || "∞"} to {listFilterEndDate || "∞"}
                  <button
                    type="button"
                    onClick={() => {
                      setListFilterStartDate("");
                      setListFilterEndDate("");
                    }}
                    className="hover:text-red-500 font-medium transition-colors outline-none inline-flex items-center"
                  >
                    <X className="w-2.5 h-2.5 ml-0.5" />
                  </button>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsConfigureColumnsOpen(true)}
              className="p-2 bg-surface border border-border-subtle rounded-lg text-content-muted hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-soft"
              title="Configure Columns"
            >
              <Settings2 className="w-4 h-4" />
            </button>
            <button className="p-2 bg-surface border border-border-subtle rounded-lg text-content-muted hover:text-content-body transition-all shadow-soft">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expandable Advanced Filters Panel content */}
        <AnimatePresence initial={false}>
          {isFiltersPanelOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="mx-6 mb-4 bg-surface rounded-xl border border-border-subtle/80 shadow-md overflow-hidden relative"
            >
              <div className="p-5">
                {/* Section 1: Standard Issue Attributes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {/* Status Filter */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs sm:text-[10px] uppercase font-medium text-content-subtle tracking-wider">
                      Status
                    </label>
                    <select
                      value={listFilterStatus}
                      onChange={(e) => setListFilterStatus(e.target.value)}
                      className="w-full text-xs font-medium text-content-body bg-surface-sunken border border-border-subtle rounded-xl px-2.5 py-1.5 focus:border-indigo-500 outline-none"
                    >
                      <option value="All">All Statuses</option>
                      {mArr
                        .filter((m) => m.type === "status")
                        .map((m, idx) => (
                          <option
                            key={m.id ? `opt-st-${m.id}-${idx}` : `opt-st-${idx}`}
                            value={m.label}
                          >
                            {m.label}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Priority Filter */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs sm:text-[10px] uppercase font-medium text-content-subtle tracking-wider">
                      Priority
                    </label>
                    <select
                      value={listFilterPriority}
                      onChange={(e) => setListFilterPriority(e.target.value)}
                      className="w-full text-xs font-medium text-content-body bg-surface-sunken border border-border-subtle rounded-xl px-2.5 py-1.5 focus:border-indigo-500 outline-none"
                    >
                      <option value="All">All Priorities</option>
                      {mArr
                        .filter((m) => m.type === "priority")
                        .map((m, idx) => (
                          <option
                            key={m.id ? `flt-p-${m.id}-${idx}` : `flt-p-${idx}`}
                            value={m.label}
                          >
                            {m.label}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Sprint Filter */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs sm:text-[10px] uppercase font-medium text-content-subtle tracking-wider">
                      Sprint
                    </label>
                    <select
                      value={listFilterSprint}
                      onChange={(e) => setListFilterSprint(e.target.value)}
                      className="w-full text-xs font-medium text-content-body bg-surface-sunken border border-border-subtle rounded-xl px-2.5 py-1.5 focus:border-indigo-500 outline-none"
                    >
                      <option value="All">All Sprints</option>
                      <option value="Backlog">Backlog</option>
                      {props.sprints?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Label Filter */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs sm:text-[10px] uppercase font-medium text-content-subtle tracking-wider">
                      Label
                    </label>
                    <select
                      value={listFilterLabel}
                      onChange={(e) => setListFilterLabel(e.target.value)}
                      className="w-full text-xs font-medium text-content-body bg-surface-sunken border border-border-subtle rounded-xl px-2.5 py-1.5 focus:border-indigo-500 outline-none"
                    >
                      <option value="All">All Labels</option>
                      {allLabels.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Section 2: Custom fields & date ranges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4 border-t border-border-faint pt-4">
                  {/* Category Filter */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs sm:text-[10px] uppercase font-medium text-content-subtle tracking-wider">
                      Category (Custom)
                    </label>
                    <select
                      value={listFilterCategory}
                      onChange={(e) => setListFilterCategory(e.target.value)}
                      className="w-full text-xs font-medium text-content-body bg-surface-sunken border border-border-subtle rounded-xl px-2.5 py-1.5 focus:border-indigo-500 outline-none"
                    >
                      <option value="All">All Categories</option>
                      {mArr
                        .filter((m) => m.type === "category")
                        .map((m) => (
                          <option key={m.id} value={m.label}>
                            {m.label}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Environment Filter */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs sm:text-[10px] uppercase font-medium text-content-subtle tracking-wider">
                      Environment (Custom)
                    </label>
                    <select
                      value={listFilterEnvironment}
                      onChange={(e) => setListFilterEnvironment(e.target.value)}
                      className="w-full text-xs font-medium text-content-body bg-surface-sunken border border-border-subtle rounded-xl px-2.5 py-1.5 focus:border-indigo-500 outline-none"
                    >
                      <option value="All">All Environments</option>
                      {allEnvironments.map((env) => (
                        <option key={env} value={env}>
                          {env}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Project Risk Filter */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs sm:text-[10px] uppercase font-medium text-content-subtle tracking-wider">
                      Project Risk (Custom)
                    </label>
                    <select
                      value={listFilterProjectRisk}
                      onChange={(e) => setListFilterProjectRisk(e.target.value)}
                      className="w-full text-xs font-medium text-content-body bg-surface-sunken border border-border-subtle rounded-xl px-2.5 py-1.5 focus:border-indigo-500 outline-none"
                    >
                      <option value="All">All Risks</option>
                      {allProjectRisks.map((risk) => (
                        <option key={risk} value={risk}>
                          {risk}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Release Filter */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs sm:text-[10px] uppercase font-medium text-content-subtle tracking-wider">
                      Release (Custom)
                    </label>
                    <select
                      value={listFilterRelease}
                      onChange={(e) => setListFilterRelease(e.target.value)}
                      className="w-full text-xs font-medium text-content-body bg-surface-sunken border border-border-subtle rounded-xl px-2.5 py-1.5 focus:border-indigo-500 outline-none"
                    >
                      <option value="All">All Releases</option>
                      {allReleases.map((rel) => (
                        <option key={rel} value={rel}>
                          {rel}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Resolution Filter */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs sm:text-[10px] uppercase font-medium text-content-subtle tracking-wider">
                      Resolution (Custom)
                    </label>
                    <select
                      value={listFilterResolution}
                      onChange={(e) => setListFilterResolution(e.target.value)}
                      className="w-full text-xs font-medium text-content-body bg-surface-sunken border border-border-subtle rounded-xl px-2.5 py-1.5 focus:border-indigo-500 outline-none"
                    >
                      <option value="All">All Resolutions</option>
                      {allResolutions.map((res) => (
                        <option key={res} value={res}>
                          {res}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Section 3: Date Ranges */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 border-t border-border-faint pt-4 items-end">
                  {/* Date Column Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs sm:text-[10px] uppercase font-medium text-content-subtle tracking-wider">
                      Date Range Type
                    </label>
                    <select
                      value={listFilterDateType}
                      onChange={(e) => setListFilterDateType(e.target.value)}
                      className="w-full text-xs font-medium text-content-body bg-surface-sunken border border-border-subtle rounded-xl px-2.5 py-1.5 focus:border-indigo-500 outline-none text-left"
                    >
                      <option value="dueDate">Due Date</option>
                      <option value="startDate">Start Date</option>
                      <option value="endDate">End Date</option>
                      <option value="createdAt">Created Date</option>
                      <option value="any">Any of the Above</option>
                    </select>
                  </div>

                  {/* Start Date */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs sm:text-[10px] uppercase font-medium text-content-subtle tracking-wider">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={listFilterStartDate}
                      onChange={(e) => setListFilterStartDate(e.target.value)}
                      className="w-full text-xs font-medium text-content-body bg-surface-sunken border border-border-subtle rounded-xl px-2.5 py-1.5 focus:border-indigo-500 outline-none h-[34px]"
                    />
                  </div>

                  {/* End Date & Reset controls inside grid */}
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1.5 flex-1 font-sans">
                      <label className="text-xs sm:text-[10px] uppercase font-medium text-content-subtle tracking-wider">
                        To Date
                      </label>
                      <input
                        type="date"
                        value={listFilterEndDate}
                        onChange={(e) => setListFilterEndDate(e.target.value)}
                        className="w-full text-xs font-medium text-content-body bg-surface-sunken border border-border-subtle rounded-xl px-2.5 py-1.5 focus:border-indigo-500 outline-none h-[34px]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setListFilterStatus("All");
                        setListFilterPriority("All");
                        setListFilterAssignee("All");
                        setListFilterCategory("All");
                        setListFilterSprint("All");
                        setListFilterLabel("All");
                        setListFilterEnvironment("All");
                        setListFilterProjectRisk("All");
                        setListFilterRelease("All");
                        setListFilterResolution("All");
                        setListFilterStartDate("");
                        setListFilterEndDate("");
                      }}
                      className="px-4 h-[34px] bg-surface-muted hover:bg-slate-200 text-content-secondary rounded-xl text-xs font-medium transition-all shrink-0 flex items-center justify-center gap-1.5 select-none"
                      title="Clear all fields"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="overflow-x-auto w-full flex-1 flex flex-col min-h-0">
          <div className={cn(styles.tableWrapper, "flex-1")}>
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="min-w-max flex flex-col">
                <Droppable droppableId="backlog-droppable" type="backlog-tasks">
                  {(providedDroppable) => (
                    <table
                      className={styles.table}
                      style={{
                        minWidth: issueTableColumns
                          .filter((c) => c.visible)
                          .reduce(
                            (acc: number, c: any) => acc + (acc > 0 ? c.width || 100 : 0),
                            100
                          ),
                      }}
                      ref={providedDroppable.innerRef}
                      {...providedDroppable.droppableProps}
                    >
                      <thead>
                        <tr className={styles.tableHeader}>
                          {canReorder && (
                            <th className="w-8 px-1 text-center bg-surface-sunken">
                              {/* Empty header for drag handle */}
                            </th>
                          )}
                          <th className={cn("w-12 px-4", isCompact ? "py-1" : "py-2.5")}>
                            <div className="flex justify-center">
                              <input
                                type="checkbox"
                                checked={
                                  selectedTaskIds.size === displayRoots.length &&
                                  displayRoots.length > 0
                                }
                                onChange={handleToggleSelectAll}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shadow-soft transition-all cursor-pointer"
                              />
                            </div>
                          </th>
                          {issueTableColumns
                            .filter((c: any) => c.visible)
                            .map((col: any) => (
                              <th
                                key={col.id}
                                className={cn(
                                  styles.tableHeaderCell,
                                  isCompact ? "py-1 text-xs sm:text-[10px]" : "py-2.5"
                                )}
                                style={{ width: col.width }}
                              >
                                <div className="flex items-center justify-between">
                                  <span>{col.label}</span>
                                  {col.id === "work" && (
                                    <Layout className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity" />
                                  )}
                                </div>
                                <div className="absolute right-0 top-1/4 bottom-1/4 w-px bg-slate-200" />
                              </th>
                            ))}
                          <th
                            className={cn(
                              "w-12 px-2 sticky right-0 bg-surface-sunken z-[30]",
                              isCompact ? "py-1" : "py-2.5"
                            )}
                          >
                            <List className="w-4 h-4 text-content-subtle mx-auto" />
                          </th>
                        </tr>
                      </thead>
                      {displayRoots.length === 0 ? (
                        <tbody className="divide-y divide-border-faint italic-rows text-[13px]">
                          <tr>
                            <td
                              colSpan={
                                issueTableColumns.filter((c: any) => c.visible).length +
                                2 +
                                (canReorder ? 1 : 0)
                              }
                              className="px-10 py-20 text-center"
                            >
                              <div className="flex flex-col items-center gap-3 opacity-40">
                                <Search className="w-8 h-8 text-slate-300" />
                                <p className="text-xs font-medium text-content-muted uppercase tracking-widest">
                                  No matching records found
                                </p>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      ) : (
                        <AnimatePresence mode="popLayout" initial={false}>
                          {displayRoots
                            .slice((listPage - 1) * itemsPerPage, listPage * itemsPerPage)
                            .map((root: Task, index: number) => (
                              <Draggable
                                key={root.id ? `drag-${root.id}-${index}` : `drag-${index}`}
                                draggableId={root.id || `drag-${index}`}
                                index={index}
                                isDragDisabled={!canReorder}
                              >
                                {(providedDraggable, snapshot) => (
                                  <tbody
                                    ref={providedDraggable.innerRef}
                                    {...providedDraggable.draggableProps}
                                    className={cn(
                                      "divide-y divide-border-faint italic-rows text-[13px]",
                                      snapshot.isDragging &&
                                        "bg-surface-muted/50 shadow-soft border border-indigo-200"
                                    )}
                                    style={providedDraggable.draggableProps.style}
                                  >
                                    {renderIssueRow(root, 0, providedDraggable.dragHandleProps)}
                                  </tbody>
                                )}
                              </Draggable>
                            ))}
                        </AnimatePresence>
                      )}

                      {providedDroppable.placeholder}
                    </table>
                  )}
                </Droppable>
              </div>
            </DragDropContext>
          </div>
        </div>

        {/* Global Inline Add Bar */}
        <div className="p-2 bg-surface border-t border-border-subtle shrink-0 shadow-[0_-2px_4px_-1px_rgba(0,0,0,0.03)] z-20 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 border border-border-subtle rounded-xl bg-surface-sunken shadow-soft p-1.5 sm:p-1">
            <div className="flex items-center gap-2 w-full sm:w-auto flex-1 min-w-0">
              <div className="relative pl-1 shrink-0">
                <button
                  onClick={() =>
                    setIsInlineTypeOpen(isInlineTypeOpen === "global" ? null : "global")
                  }
                  className="flex items-center justify-center p-1.5 hover:bg-slate-200 rounded transition-colors text-content-secondary outline-none"
                >
                  {(() => {
                    const typeData = mArr.find(
                      (m) =>
                        m.type === "issue_type" &&
                        m.label?.toLowerCase() === inlineAddType?.toLowerCase()
                    );
                    if (typeData?.icon)
                      return (
                        <RenderIcon
                          iconName={typeData.icon}
                          className="w-4 h-4"
                          style={{ color: typeData.color }}
                        />
                      );
                    return <Zap className="w-4 h-4 text-blue-600" />;
                  })()}
                  <ChevronDown className="w-3 h-3 text-content-subtle ml-0.5" />
                </button>
                {isInlineTypeOpen === "global" && (
                  <div className="absolute left-0 bottom-full mb-2 w-48 bg-surface border border-border-subtle rounded-lg shadow-xl z-[100] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
                    {mArr
                      .filter((m) => m.type === "issue_type")
                      .map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setInlineAddType(t.label);
                            setIsInlineTypeOpen(null);
                          }}
                          className="w-full text-left px-3 py-2 text-xs sm:text-[11px] font-medium text-content-secondary hover:bg-surface-sunken flex items-center gap-2"
                        >
                          {t.icon ? (
                            <RenderIcon
                              iconName={t.icon}
                              className="w-3.5 h-3.5"
                              style={{ color: t.color }}
                            />
                          ) : (
                            <Zap className="w-3.5 h-3.5" style={{ color: t.color }} />
                          )}
                          <span>{t.label}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <input
                type="text"
                value={quickCreateTitle}
                onChange={(e) => setQuickCreateTitle(e.target.value)}
                placeholder="What needs to be done? Type and press Enter to save..."
                onKeyDown={(e) => e.key === "Enter" && createGlobalIssue()}
                className="flex-1 min-w-0 bg-transparent border-none text-[12px] font-medium text-content-body placeholder:text-content-subtle focus:ring-0 outline-none px-2"
              />
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-1 pr-1 border-t sm:border-t-0 sm:border-l border-border-subtle pt-2 sm:pt-0 pl-0 sm:pl-2 w-full sm:w-auto">
              <div className="w-full sm:w-[160px]">
                <StyledDropdown
                  value={inlineAddAssigneeId}
                  onChange={(val) => setInlineAddAssigneeId(val)}
                  options={[
                    { id: "", label: "Unassigned" },
                    ...projectMembers.map((m) => ({
                      id: m?.uid || "",
                      label: m?.displayName || m?.email || "Unknown",
                    })),
                  ]}
                  members={projectMembers}
                  type="member"
                  masterData={mArr}
                  className="w-full !border-transparent !bg-transparent hover:!bg-slate-200"
                />
              </div>

              <div className="w-full sm:w-[120px]">
                <StyledDropdown
                  value={inlineAddPriority || "Medium"}
                  onChange={(val) => setInlineAddPriority(val)}
                  options={mArr
                    .filter((m) => m.type === "priority")
                    .map((p) => ({ id: p.label, label: p.label, icon: p.icon, color: p.color }))}
                  type="priority"
                  masterData={mArr}
                  className="w-full !border-transparent !bg-transparent hover:!bg-slate-200"
                />
              </div>

              <button
                onClick={() => createGlobalIssue()}
                disabled={!quickCreateTitle.trim() || isCreating}
                className="w-full sm:w-auto px-4 py-1.5 bg-primary hover:bg-primary-hover active:bg-primary-active disabled:opacity-50 disabled:bg-primary/50 text-white text-xs sm:text-[11px] font-medium rounded-md uppercase tracking-wider transition-all duration-200 shrink-0 flex items-center justify-center gap-1.5 sm:ml-1 shadow-xs cursor-pointer"
              >
                {isCreating ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5 text-white stroke-[3px]" />
                )}
                <span>{isCreating ? "Creating..." : "+ CREATE"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-t border-border-subtle bg-surface-sunken shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-[10px] font-medium text-content-muted">
              Showing {displayRoots.length === 0 ? 0 : (listPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(listPage * itemsPerPage, displayRoots.length)} of {displayRoots.length}{" "}
              entries
            </span>
            <div className="flex items-center gap-1.5 pl-2 border-l border-border-subtle">
              <span className="text-xs sm:text-[10px] font-medium text-content-subtle uppercase tracking-wider">
                Per Page:
              </span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setListPage(1);
                }}
                className="text-xs sm:text-[10px] font-medium bg-surface border border-border-subtle rounded-lg px-2 py-0.5 text-content-body outline-none focus:border-indigo-500 cursor-pointer shadow-soft"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={9999}>All</option>
              </select>
            </div>
          </div>

          <div className="flex gap-1 items-center">
            <button
              onClick={() => setListPage((p) => Math.max(1, p - 1))}
              disabled={listPage === 1}
              className="px-2.5 py-1 text-xs sm:text-[10px] font-medium text-content-secondary bg-surface border border-border-subtle rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-sunken transition-all active:scale-95 cursor-pointer shadow-soft"
            >
              Prev
            </button>
            <div className="flex gap-1 items-center px-1 max-w-[200px] overflow-x-auto">
              {Array.from({ length: Math.ceil(displayRoots.length / itemsPerPage) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setListPage(i + 1)}
                  className={cn(
                    "w-6 h-6 rounded-lg flex items-center justify-center text-xs sm:text-[11px] sm:text-[9px] font-medium transition-all cursor-pointer active:scale-95 shrink-0",
                    listPage === i + 1
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none"
                      : "text-content-muted hover:bg-slate-200/80"
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() =>
                setListPage((p) => Math.min(Math.ceil(displayRoots.length / itemsPerPage), p + 1))
              }
              disabled={listPage >= Math.ceil(displayRoots.length / itemsPerPage)}
              className="px-2.5 py-1 text-xs sm:text-[10px] font-medium text-content-secondary bg-surface border border-border-subtle rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-sunken transition-all active:scale-95 cursor-pointer shadow-soft"
            >
              Next
            </button>
          </div>
        </div>

        <ConfigureColumnsModal
          isOpen={isConfigureColumnsOpen}
          onClose={() => setIsConfigureColumnsOpen(false)}
          issueTableColumns={issueTableColumns}
          setIssueTableColumns={setIssueTableColumns}
          handleReorderColumns={handleReorderColumns}
        />

        {/* Floating Bulk Action Bar */}
        <AnimatePresence>
          {selectedTaskIds.size > 0 && (
            <motion.div
              initial={{ y: 80, opacity: 0, x: "-50%" }}
              animate={{ y: 0, opacity: 1, x: "-50%" }}
              exit={{ y: 80, opacity: 0, x: "-50%" }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="fixed bottom-6 left-1/2 z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] px-6 py-3.5 flex flex-wrap items-center gap-6 text-white text-xs font-medium select-none"
            >
              <div className="flex items-center gap-2 border-r border-slate-700 pr-4">
                <span className="bg-indigo-600 text-white text-xs sm:text-[10px] font-medium rounded-full px-2 py-0.5 min-w-[20px] text-center">
                  {selectedTaskIds.size}
                </span>
                <span className="text-slate-300 font-medium uppercase tracking-wider text-xs sm:text-[10px]">
                  Tugas Dipilih
                </span>
              </div>

              {/* Change Status Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-content-subtle text-xs sm:text-[10px] uppercase tracking-wider">
                  Status:
                </span>
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      const ids = Array.from(selectedTaskIds);
                      ids.forEach((id) => updateTaskField(id, "status", val));
                      toast.success(
                        `Berhasil mengubah status ${ids.length} tugas menjadi "${val}"`
                      );
                      setSelectedTaskIds(new Set());
                    }
                  }}
                  defaultValue=""
                  className="bg-slate-800 border border-slate-700 text-white rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 cursor-pointer font-medium"
                >
                  <option value="" disabled>
                    Pilih Status...
                  </option>
                  {mArr
                    .filter((m) => m.type === "status")
                    .map((m) => (
                      <option key={m.id} value={m.label}>
                        {m.label}
                      </option>
                    ))}
                </select>
              </div>

              {/* Change Assignee Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-content-subtle text-xs sm:text-[10px] uppercase tracking-wider">
                  Assignee:
                </span>
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    const effectiveAssignee = val === "unassigned" ? null : val;
                    const ids = Array.from(selectedTaskIds);
                    ids.forEach((id) => updateTaskField(id, "assigneeId", effectiveAssignee));
                    toast.success(`Berhasil memperbarui assignee untuk ${ids.length} tugas`);
                    setSelectedTaskIds(new Set());
                  }}
                  defaultValue=""
                  className="bg-slate-800 border border-slate-700 text-white rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 cursor-pointer font-medium"
                >
                  <option value="" disabled>
                    Pilih Assignee...
                  </option>
                  <option value="unassigned">Unassigned (Kosongkan)</option>
                  {projectMembers.map((m) => (
                    <option key={m.uid} value={m.uid}>
                      {m.displayName || m.email || "Unknown"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bulk Delete */}
              {(() => {
                const deletableIds = Array.from(selectedTaskIds).filter((id) => {
                  const t = tArr.find((x) => x.id === id);
                  return t ? canDeleteIssue(t) : false;
                });
                const canDeleteAnySelected = deletableIds.length > 0;

                return (
                  (bulkDeleteTasks || deleteTask) &&
                  canDeleteAnySelected && (
                    <button
                      onClick={() => {
                        if (bulkDeleteTasks) {
                          bulkDeleteTasks(deletableIds);
                          setSelectedTaskIds(new Set());
                        } else if (deleteTask) {
                          deletableIds.forEach((id) => deleteTask(id));
                          setSelectedTaskIds(new Set());
                        }
                      }}
                      className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-medium rounded-xl px-4 py-2 flex items-center gap-1.5 transition-all shadow-soft cursor-pointer"
                    >
                      <Trash className="w-3.5 h-3.5" />
                      <span>Hapus ({deletableIds.length})</span>
                    </button>
                  )
                );
              })()}

              {/* Deselect All / Close */}
              <button
                onClick={() => setSelectedTaskIds(new Set())}
                className="p-1.5 hover:bg-slate-800 text-content-subtle hover:text-white rounded-xl transition-all cursor-pointer"
                title="Batal pilih semua"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default IssueListView;
