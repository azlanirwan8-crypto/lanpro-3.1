# Custom Hooks Guide

Complete reference for all 16 extracted custom hooks across the application.

## Table of Contents

### AppContainer Hooks (10 hooks)
- [useAppModals](#useappmodals) - Modal & detail panel management
- [useAppTheme](#useapptheme) - Theme & appearance with localStorage
- [useAppNotifications](#useappnotifications) - Notification polling & dropdown
- [useAppUI](#useappui) - Layout toggle states
- [useAppPagination](#useapppagination) - Pagination & search state
- [useNewTaskForm](#usenewtaskform) - Task creation form (16 fields)
- [useNewSprintForm](#usenewtsprintform) - Sprint creation form
- [useNewProjectForm](#usenewprojectform) - Project creation form
- [useTaskSelection](#usetaskselection) - Bulk task selection
- [useAppSync](#useappsync) - Socket & sync management

### FlowchartView Hooks (6 hooks)
- [useFlowchartCanvas](#useflowchartcanvas) - Viewport & zoom
- [useFlowchartUI](#useflowchartui) - Modals & sidebars
- [useFlowchartHistory](#useflowcharthistory) - Undo/redo
- [useFlowchartSelection](#useflowchartselection) - Node selection
- [useFlowchartList](#useflowchartlist) - Persistence & pagination
- [useFlowchartNodes](#useflowchartnodes) - Node/edge CRUD

---

## AppContainer Hooks

### useAppModals

**Location:** `src/hooks/useAppModals.ts` (281 lines)

**Purpose:** Centralized management of all modal and detail panel states.

**State Management:**
- Create modals: new project, task, sprint, invite
- Edit modals: sprint, task, project
- Detail panels: profile, shortcuts, sync
- Entity selection: editing task/sprint/project, selected task/user
- Metadata: last invited email, previous view for navigation

**Returns:**
```typescript
{
  // Create modals
  isNewProjectModalOpen, setIsNewProjectModalOpen,
  isNewTaskModalOpen, setIsNewTaskModalOpen,
  isNewSprintModalOpen, setIsNewSprintModalOpen,
  isInviteModalOpen, setIsInviteModalOpen,
  isInviteSuccessModalOpen, setIsInviteSuccessModalOpen,
  
  // Edit modals
  isEditSprintModalOpen, setIsEditSprintModalOpen,
  isEditTaskModalOpen, setIsEditTaskModalOpen,
  isEditProjectModalOpen, setIsEditProjectModalOpen,
  
  // Detail panels
  isProfileModalOpen, setIsProfileModalOpen,
  isShortcutsModalOpen, setIsShortcutsModalOpen,
  isSyncModalOpen, setIsSyncModalOpen,
  
  // Entity being edited/viewed
  editingTask, setEditingTask,
  editingSprint, setEditingSprint,
  editingProject, setEditingProject,
  selectedTaskForDetail, setSelectedTaskForDetail,
  selectedUserForDetail, setSelectedUserForDetail,
  lastInvitedEmail, setLastInvitedEmail,
  previousView, setPreviousView,
  
  // Helper functions (open/close for each modal)
  openNewProjectModal, closeNewProjectModal,
  openNewTaskModal, closeNewTaskModal,
  openNewSprintModal, closeNewSprintModal,
  // ... and more helpers
}
```

**Usage:**
```typescript
const { isNewTaskModalOpen, setIsNewTaskModalOpen } = useAppModals();
```

---

### useAppTheme

**Location:** `src/hooks/useAppTheme.ts` (175 lines)

**Purpose:** Theme management with localStorage persistence.

**Features:**
- Toggle between light/dark themes
- Theme dropdown visibility
- Fullscreen state management
- Computed dark/light mode flags
- Effective theme resolution

**State:**
- `theme`: 'light' | 'dark' | 'auto' (persisted to localStorage)
- `isThemeOpen`: boolean (dropdown visible)
- `isFullscreen`: boolean

**Returns:**
```typescript
{
  theme, setTheme,
  isThemeOpen, setIsThemeOpen,
  isFullscreen, setIsFullscreen,
  toggleTheme(),
  getEffectiveTheme(),
  isDarkMode, isLightMode,
  toggleThemeDropdown(),
  openThemeDropdown(),
  closeThemeDropdown(),
  toggleFullscreen(),
  enterFullscreen(),
  exitFullscreen()
}
```

---

### useAppNotifications

**Location:** `src/hooks/useAppNotifications.ts` (82 lines)

**Purpose:** Notification polling and dropdown management.

**Features:**
- Polls `/api/users/:userId/notifications` every 3 minutes
- Click-outside handler to close dropdown
- QA test status filter state

**State:**
- `notifications`: AppNotification[]
- `isNotificationsOpen`: boolean (dropdown visible)
- `qaInitialStatusFilter`: 'ALL' | 'Passed' | 'Failed' | 'Blocked' | 'Retest' | 'Pending'

**Functions:**
- `fetchNotifications()`: Fetch from API

**Dependencies:**
- Requires `userId` or `currentUserId`

---

### useAppUI

**Location:** `src/hooks/useAppUI.ts` (16 lines)

**Purpose:** UI layout toggle states.

**State:**
- `isSidebarCollapsed`: boolean
- `isMobileMenuOpen`: boolean
- `isQuickCreateOpen`: boolean

**Note:** Simple toggle state management. No complex logic.

---

### useAppPagination

**Location:** `src/hooks/useAppPagination.ts` (25 lines)

**Purpose:** Pagination and search state (currently unused, available for future refactoring).

**State:**
- `listPage`, `masterPage`, `backlogPage`: number
- `auditLogSearch`, `backlogSearch`: string
- `backlogPriorityFilter`: string

**Note:** Child components currently manage their own pagination. These states are declared for potential future consolidation.

---

### useNewTaskForm

**Location:** `src/hooks/useNewTaskForm.ts` (96 lines)

**Purpose:** Task creation form state management.

**State (16 fields):**
- Basic: `newTaskTitle`, `newTaskAssigneeId`, `newTaskType`
- Classification: `newTaskCategory`, `newTaskRelease`, `newTaskParentId`, `newTaskSprintId`
- Dates: `newTaskStartDate`, `newTaskEndDate`, `newTaskDueDate`
- Details: `newTaskDescription`, `newTaskAttachments`, `newTaskBusinessValue`
- Estimation: `newTaskProjectRisk`, `newTaskStoryPoints`
- Acceptance: `newTaskAcceptanceCriteria`, `newTaskLabels`, `newTaskFigmaUrl`, `newTaskEnvironment`

**Functions:**
- `resetForm()`: Clear all fields to defaults

**Used By:**
- `handleCreateTask()` calls `resetNewTaskForm()` after successful creation

---

### useNewSprintForm

**Location:** `src/hooks/useNewSprintForm.ts` (32 lines)

**Purpose:** Sprint creation form state.

**State:**
- `newSprintName`: string (default: empty)
- `newSprintGoal`: string
- `newSprintStartDate`: string (default: today)
- `newSprintEndDate`: string (default: today + 14 days)

**Functions:**
- `resetForm()`: Reset to empty name/goal and default dates

---

### useNewProjectForm

**Location:** `src/hooks/useNewProjectForm.ts` (23 lines)

**Purpose:** Project creation form state.

**State:**
- `newProjectName`: string
- `newProjectKey`: string (converted to uppercase)
- `newProjectDescription`: string

**Functions:**
- `resetForm()`: Clear all fields

---

### useTaskSelection

**Location:** `src/hooks/useTaskSelection.ts` (40 lines)

**Purpose:** Manage task selection for bulk operations.

**State:**
- `selectedTaskIds`: Set<string>

**Functions:**
- `toggleTaskSelection(taskId)`: Add/remove task from selection
- `selectAllTasks(taskIds)`: Select all provided tasks
- `clearSelection()`: Clear all selections
- `isTaskSelected(taskId)`: Check if task is selected

**Used For:**
- Bulk delete operations
- Bulk move operations
- Other batch task operations

---

### useAppSync

**Location:** `src/hooks/useAppSync.ts` (62 lines)

**Purpose:** Socket connection and sync state management.

**State:**
- `socketConnected`: boolean
- `apiLatency`: number | null (ms)
- `latencyStatus`: 'excellent' | 'warning' | 'poor' | 'offline'
- `isSyncing`: boolean (during bulk sync)
- `cacheStats`: any (from CacheManager)
- `lastSyncedTime`: string (human readable)

**Functions:**
- `checkLatency()`: Perform health check via `/api/health-check`

**Initial Setup:**
- Latency defaults to 12ms with 'excellent' status on mount

---

## FlowchartView Hooks

> Complete documentation for FlowchartView hooks available in `src/features/flowchart/hooks.ts`

### useFlowchartCanvas

**Location:** `src/features/flowchart/useFlowchartCanvas.ts` (136 lines)

**Purpose:** Viewport pan/zoom/theme management for flowchart canvas.

**State:**
- Pan/zoom state
- Theme for diagram rendering

---

### useFlowchartUI

**Location:** `src/features/flowchart/useFlowchartUI.ts` (219 lines)

**Purpose:** Modals and sidebar management for flowchart editor.

---

### useFlowchartHistory

**Location:** `src/features/flowchart/useFlowchartHistory.ts` (184 lines)

**Purpose:** Undo/redo and simulation history.

---

### useFlowchartSelection

**Location:** `src/features/flowchart/useFlowchartSelection.ts` (220 lines)

**Purpose:** Node/edge selection and tool management.

---

### useFlowchartList

**Location:** `src/features/flowchart/useFlowchartList.ts` (242 lines)

**Purpose:** Persistence and pagination for flowchart lists.

---

### useFlowchartNodes

**Location:** `src/features/flowchart/useFlowchartNodes.ts` (257 lines)

**Purpose:** Node and edge CRUD operations.

---

## Best Practices

### When to Use These Hooks

1. **useAppModals** - Import in any component that needs to open/close modals
2. **useAppTheme** - Import for theme-aware UI components
3. **useAppNotifications** - Use in header/navbar for notification badge
4. **useAppUI** - Use in layout components (sidebar, menu)
5. **useNewTaskForm** - Use in task creation form
6. **useNewSprintForm** - Use in sprint creation form
7. **useNewProjectForm** - Use in project creation form
8. **useTaskSelection** - Use in task list/table for bulk operations
9. **useAppSync** - Use in status bar/monitor components

### Composition Rules

- Hooks can be combined in any component
- Each hook is independent (no circular dependencies)
- All state is colocated with logic
- Reset functions should be called after successful operations

### Testing

- Each hook can be tested independently with React Testing Library
- Mock dependencies (userId, socket, etc.) as needed
- All 28 unit tests currently passing

---

## Migration Guide

**If moving logic between components:**

1. Identify which hooks your component uses
2. Import the hooks in the new component
3. Replace local state with hook state
4. Update any dependencies passed to hooks
5. Run tests to verify behavior

---

## Future Improvements

1. **useAppPagination** - Currently unused. Consider consolidating child component pagination states here
2. **Hook Splitting** - Large hooks (>200 lines) could be split further
3. **Type Safety** - Consider extracting hook return types for better reusability
4. **Error Boundaries** - Add error handling for API calls in polling hooks

---

**Last Updated:** Phase 15.3.10 ✅
**Total Hooks:** 16 | **Total Lines:** 1,909 | **Test Coverage:** 28/28 passing
