import { safeLocalStorage, safeSessionStorage } from "../../lib/safeStorage";
import React, { useState, useEffect, useRef } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "../../lib/api";
import { hasPermission } from "../../lib/permissions";
import { QAComment, QATestCase, QATestSuite, TestQAPanelProps } from "./types";
import { QATopBar } from "./components/QATopBar";
import { QASuiteSidebar } from "./components/QASuiteSidebar";
import { QATestCaseTable } from "./components/QATestCaseTable";
import { QADetailDrawer } from "./components/QADetailDrawer";
import { QAModals } from "./components/QAModals";

const apiFetch = async (url: string, options: any = {}) => {
  const token = safeLocalStorage.getItem("lanpro_jwt_token");
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
};

export function TestQAPanel({
  tasks,
  projectMembers,
  selectedProject,
  user,
  initialStatusFilter,
}: TestQAPanelProps) {
  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 shadow-sm max-w-lg mx-auto mt-12">
        <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full mb-4 animate-bounce">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-medium text-slate-800">Silakan Pilih Proyek Terlebih Dahulu</h3>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          Modul QA Testing membutuhkan konteks proyek aktif untuk mengunggah skrip pengujian, mengelola status eksekusi, serta menghubungkannya dengan Bug Ticket.
        </p>
      </div>
    );
  }

  // State Management
  const [suites, setSuites] = useState<QATestSuite[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>("");
  const [phaseFilter, setPhaseFilter] = useState<"ALL" | "SIT" | "UAT" | "PTR">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Passed" | "Failed" | "Blocked" | "Retest" | "Pending">(
    initialStatusFilter || "ALL"
  );
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);

  const [activeSuitePicDropdownId, setActiveSuitePicDropdownId] = useState<string | null>(null);
  const [activeCasePicDropdownId, setActiveCasePicDropdownId] = useState<string | null>(null);

  // Lock System States
  const [lockState, setLockState] = useState<{
    lockedBy: string | null;
    userName: string | null;
    lockedAt: number | null;
  }>({ lockedBy: null, userName: null, lockedAt: null });
  const [remainingTime, setRemainingTime] = useState<number>(900);

  // Modals & Drawers States
  const [isAddSuiteOpen, setIsAddSuiteOpen] = useState(false);
  const [newSuiteNameOnly, setNewSuiteNameOnly] = useState("");
  const [newSuitePhaseOnly, setNewSuitePhaseOnly] = useState<"SIT" | "UAT" | "PTR">("SIT");
  const [newSuiteAssignedTo, setNewSuiteAssignedTo] = useState("");

  const [isAddCaseOpen, setIsAddCaseOpen] = useState(false);
  const [activeAddTab, setActiveAddTab] = useState<"single" | "bulk">("single");
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [newCasePriority, setNewCasePriority] = useState<"High" | "Medium" | "Low" | "Critical">("Medium");
  const [newCaseAssignedTo, setNewCaseAssignedTo] = useState("");
  const [newCaseSteps, setNewCaseSteps] = useState("");
  const [newCaseExpected, setNewCaseExpected] = useState("");
  const [bulkUploadFile, setBulkUploadFile] = useState<File | null>(null);

  const [suiteToEdit, setSuiteToEdit] = useState<QATestSuite | null>(null);
  const [suiteEditName, setSuiteEditName] = useState("");
  const [suiteEditAssignedTo, setSuiteEditAssignedTo] = useState("");

  const [caseToEditInfo, setCaseToEditInfo] = useState<QATestCase | null>(null);
  const [caseEditTitle, setCaseEditTitle] = useState("");
  const [caseEditSteps, setCaseEditSteps] = useState("");
  const [caseEditExpected, setCaseEditExpected] = useState("");
  const [caseEditPriority, setCaseEditPriority] = useState<"High" | "Medium" | "Low" | "Critical">("Medium");
  const [caseEditAssignedTo, setCaseEditAssignedTo] = useState("");

  const [suiteToDelete, setSuiteToDelete] = useState<QATestSuite | null>(null);
  const [caseToDelete, setCaseToDelete] = useState<QATestCase | null>(null);

  const [selectedTestCase, setSelectedTestCase] = useState<QATestCase | null>(null);
  const [drawerNewComment, setDrawerNewComment] = useState("");
  const [drawerActiveTab, setDrawerActiveTab] = useState<"details" | "history">("details");
  const [executionLogs, setExecutionLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Bug Ticket Modal States
  const [isCreateBugModalOpen, setIsCreateBugModalOpen] = useState(false);
  const [bugModalTestCase, setBugModalTestCase] = useState<QATestCase | null>(null);
  const [bugTitleInput, setBugTitleInput] = useState("");
  const [bugSelectedParentId, setBugSelectedParentId] = useState("");
  const [parentSearchTerm, setParentSearchTerm] = useState("");
  const [bugPriorityInput, setBugPriorityInput] = useState("High");
  const [bugAssigneeInput, setBugAssigneeInput] = useState("");
  const [bugDescriptionInput, setBugDescriptionInput] = useState("");
  const [isSubmittingBug, setIsSubmittingBug] = useState(false);

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const currentUserUid = user?.uid || user?.id || "anonymous-user";
  const currentUserName = user?.displayName || user?.name || user?.username || "QA Tester";
  const currentUserRole = (user?.role ? user.role.toLowerCase() : "qa") as any;

  // RBAC Permission Flags
  const isAdminRole =
    currentUserRole === "admin" ||
    currentUserRole === "administrator" ||
    currentUserRole === "superadmin" ||
    currentUserRole === "manager" ||
    currentUserRole === "head" ||
    currentUserRole === "project_admin" ||
    currentUserRole === "lead";

  const canCreate = isAdminRole || hasPermission(currentUserRole, "qaTesting", "create", false, user?.permissions);
  const canUpdate = isAdminRole || hasPermission(currentUserRole, "qaTesting", "update", false, user?.permissions);
  const canDelete = isAdminRole || hasPermission(currentUserRole, "qaTesting", "delete", false, user?.permissions);

  // Load Data
  const loadSuitesFromBackend = async () => {
    try {
      const suitesRes = await apiFetch(`/api/projects/${selectedProject.id}/qa-test-suites`);
      const casesRes = await apiFetch(`/api/projects/${selectedProject.id}/qa-test-cases`);

      if (suitesRes.ok && casesRes.ok) {
        const suitesData = await suitesRes.json();
        const casesData = await casesRes.json();

        if (suitesData.status === "success" && casesData.status === "success") {
          const dbCases = casesData.data || [];
          const mergedSuites: QATestSuite[] = (suitesData.data || []).map((suite: any) => {
            const suiteCases = dbCases.filter((tc: any) => tc.suiteId === suite.id || tc.modulId === suite.id);
            return {
              ...suite,
              cases: suiteCases.map((tc: any) => ({
                ...tc,
                status: tc.status && tc.status !== "untested" ? tc.status : "Pending",
                expectedResult: tc.expected || tc.expectedResult || "",
                title: tc.judul || tc.title || "",
                steps: typeof tc.steps === "string" ? JSON.parse(tc.steps) : tc.steps || [],
                priority: tc.prioritas || tc.priority || "Medium",
                assignedTo: tc.assignedTo || undefined,
                commentsList: typeof tc.commentsList === "string" ? JSON.parse(tc.commentsList) : tc.commentsList || [],
                evidences: typeof tc.evidences === "string" ? JSON.parse(tc.evidences) : tc.evidences || [],
              })),
            };
          });

          setSuites(mergedSuites);
          if (mergedSuites.length > 0 && !selectedSuiteId) {
            setSelectedSuiteId(mergedSuites[0].id);
          }
        }
      }
    } catch (e) {
      console.warn("Falling back to local suites state:", e);
    }
  };

  useEffect(() => {
    if (selectedProject?.id) {
      loadSuitesFromBackend();
    }
  }, [selectedProject?.id]);

  // Save state helper
  const saveSuitesToStorage = (updatedSuites: QATestSuite[]) => {
    setSuites(updatedSuites);
    safeLocalStorage.setItem(`lanpro_qa_suites_${selectedProject.id}`, JSON.stringify(updatedSuites));
  };

  // Lock helper
  const acquireLockForCurrentUser = () => {
    const lockKey = `lanpro_qa_lock_${selectedSuiteId}`;
    const newLock = { lockedBy: currentUserUid, userName: currentUserName, lockedAt: Date.now() };
    safeLocalStorage.setItem(lockKey, JSON.stringify(newLock));
    setLockState(newLock);
    setRemainingTime(900);
  };

  const handleForceUnlock = () => {
    acquireLockForCurrentUser();
    toast.success("Force Unlock berhasil! Anda memegang kontrol pengujian.");
  };

  const releaseLockManually = () => {
    const lockKey = `lanpro_qa_lock_${selectedSuiteId}`;
    safeLocalStorage.removeItem(lockKey);
    setLockState({ lockedBy: null, userName: null, lockedAt: null });
    toast.info("Lock dilepaskan.");
  };

  // Status Change Handler
  const handleStatusChange = async (
    caseId: string,
    newStatus: "Passed" | "Failed" | "Blocked" | "Retest" | "Pending"
  ) => {
    const updatedSuites = suites.map((suite) => ({
      ...suite,
      cases: suite.cases.map((c) => (c.id === caseId ? { ...c, status: newStatus } : c)),
    }));
    saveSuitesToStorage(updatedSuites);

    try {
      await apiRequest(`/api/projects/${selectedProject.id}/qa-test-cases/${caseId}/status`, {
        method: "PATCH",
        body: { status: newStatus },
      });
      toast.success(`Status berhasil diubah menjadi ${newStatus}`);
    } catch (e: any) {
      console.warn("Status update fallback:", e.message);
    }
  };

  // Update Suite / Case PIC Handlers
  const handleUpdateSuitePic = async (suiteId: string, assignedTo: string) => {
    setActiveSuitePicDropdownId(null);
    const updatedSuites = suites.map((s) => (s.id === suiteId ? { ...s, assignedTo: assignedTo || undefined } : s));
    saveSuitesToStorage(updatedSuites);
    const targetSuite = updatedSuites.find((s) => s.id === suiteId);
    if (targetSuite) {
      toast.success("PIC Modul berhasil diperbarui.");
      try {
        await apiFetch(`/api/projects/${selectedProject.id}/qa-test-suites/${suiteId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(targetSuite),
        });
      } catch (err) {
        console.warn("Failed to update suite PIC:", err);
      }
    }
  };

  const handleUpdateCasePic = async (suiteId: string, caseId: string, assignedTo: string) => {
    setActiveCasePicDropdownId(null);
    const updatedSuites = suites.map((s) => {
      if (s.id !== suiteId) return s;
      return {
        ...s,
        cases: s.cases.map((c) => (c.id === caseId ? { ...c, assignedTo: assignedTo || undefined } : c)),
      };
    });
    saveSuitesToStorage(updatedSuites);
    const targetSuite = updatedSuites.find((s) => s.id === suiteId);
    const targetCase = targetSuite?.cases.find((c) => c.id === caseId);
    if (targetCase) {
      toast.success("PIC Task berhasil diperbarui.");
      try {
        await apiFetch(`/api/projects/${selectedProject.id}/qa-test-cases/${caseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(targetCase),
        });
      } catch (err) {
        console.warn("Failed to update test case PIC:", err);
      }
    }
  };

  // ADMIN BULK OPERATIONS
  const handleToggleSelectAll = (cases: QATestCase[]) => {
    if (selectedCaseIds.length === cases.length) {
      setSelectedCaseIds([]);
    } else {
      setSelectedCaseIds(cases.map((c) => c.id));
    }
  };

  const handleToggleSelectCase = (caseId: string) => {
    if (selectedCaseIds.includes(caseId)) {
      setSelectedCaseIds(selectedCaseIds.filter((id) => id !== caseId));
    } else {
      setSelectedCaseIds([...selectedCaseIds, caseId]);
    }
  };

  const handleBulkAssignPic = async (assignedTo: string) => {
    if (selectedCaseIds.length === 0) return;
    const updatedSuites = suites.map((suite) => ({
      ...suite,
      cases: suite.cases.map((c) => (selectedCaseIds.includes(c.id) ? { ...c, assignedTo: assignedTo || undefined } : c)),
    }));
    saveSuitesToStorage(updatedSuites);
    toast.success(`Berhasil menetapkan PIC ke ${selectedCaseIds.length} task sekaligus.`);
    setSelectedCaseIds([]);
  };

  const handleBulkChangeStatus = async (newStatus: "Passed" | "Failed" | "Blocked" | "Retest" | "Pending") => {
    if (selectedCaseIds.length === 0) return;
    const updatedSuites = suites.map((suite) => ({
      ...suite,
      cases: suite.cases.map((c) => (selectedCaseIds.includes(c.id) ? { ...c, status: newStatus } : c)),
    }));
    saveSuitesToStorage(updatedSuites);
    toast.success(`Berhasil mengubah status ${selectedCaseIds.length} task ke ${newStatus}.`);
    setSelectedCaseIds([]);
  };

  const handleBulkDeleteCases = async () => {
    if (selectedCaseIds.length === 0) return;
    const updatedSuites = suites.map((suite) => ({
      ...suite,
      cases: suite.cases.filter((c) => !selectedCaseIds.includes(c.id)),
    }));
    saveSuitesToStorage(updatedSuites);
    toast.success(`Berhasil menghapus ${selectedCaseIds.length} task sekaligus.`);
    setSelectedCaseIds([]);
  };

  // Add Suite Handler
  const handleAddSuiteOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuiteNameOnly.trim()) return;

    const newSuite: QATestSuite = {
      id: `suite-${Date.now()}`,
      projectId: selectedProject.id,
      name: newSuiteNameOnly.trim(),
      phase: newSuitePhaseOnly,
      uploadedBy: currentUserUid,
      uploadedAt: new Date().toISOString(),
      assignedTo: newSuiteAssignedTo || undefined,
      cases: [],
    };

    const updatedSuites = [...suites, newSuite];
    saveSuitesToStorage(updatedSuites);
    setSelectedSuiteId(newSuite.id);
    setIsAddSuiteOpen(false);
    setNewSuiteNameOnly("");

    try {
      await apiFetch(`/api/projects/${selectedProject.id}/qa-test-suites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSuite),
      });
      toast.success("Dokumen skrip berhasil ditambahkan.");
    } catch (err) {
      console.warn("Failed to add suite:", err);
    }
  };

  // Add Manual Case Handler
  const handleCreateManualTestCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCaseTitle || !newCaseSteps || !newCaseExpected || !selectedSuiteId) return;

    const targetSuite = suites.find((s) => s.id === selectedSuiteId);
    const nextRowNum = targetSuite ? targetSuite.cases.length + 1 : 1;

    const newTestCase: QATestCase = {
      id: `case-${Date.now()}`,
      suiteId: selectedSuiteId,
      rowNum: nextRowNum,
      title: newCaseTitle,
      steps: newCaseSteps,
      expectedResult: newCaseExpected,
      status: "Pending",
      priority: newCasePriority,
      assignedTo: newCaseAssignedTo || undefined,
      commentsList: [],
      evidences: [],
    };

    const updatedSuites = suites.map((suite) =>
      suite.id === selectedSuiteId ? { ...suite, cases: [...suite.cases, newTestCase] } : suite
    );
    saveSuitesToStorage(updatedSuites);

    try {
      await apiRequest(`/api/projects/${selectedProject.id}/qa-test-cases`, {
        method: "POST",
        body: newTestCase,
      });
    } catch (err) {
      console.warn("Failed to post case:", err);
    }

    setNewCaseTitle("");
    setNewCaseSteps("");
    setNewCaseExpected("");
    setIsAddCaseOpen(false);
    toast.success("Test case berhasil ditambahkan.");
  };

  // Bulk Upload Handler
  const handleBulkUploadTestCases = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkUploadFile || !selectedSuiteId) return;

    const formData = new FormData();
    formData.append("file", bulkUploadFile);
    formData.append("suiteId", selectedSuiteId);
    formData.append("projectId", selectedProject.id);
    formData.append("uploaderName", currentUserName);
    formData.append("phase", phaseFilter === "ALL" ? "SIT" : phaseFilter);

    try {
      const response = await apiFetch(`/api/v1/qa/test-case/bulk-upload`, {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        toast.success("Bulk upload berhasil.");
        setIsAddCaseOpen(false);
        loadSuitesFromBackend();
      }
    } catch (err) {
      toast.error("Gagal bulk upload file.");
    }
  };

  // Edit Suite Handler
  const submitEditSuite = async () => {
    if (!suiteToEdit) return;
    const updatedSuite = {
      ...suiteToEdit,
      name: suiteEditName.trim() || suiteToEdit.name,
      assignedTo: suiteEditAssignedTo || undefined,
    };
    const updatedSuites = suites.map((s) => (s.id === suiteToEdit.id ? updatedSuite : s));
    saveSuitesToStorage(updatedSuites);

    try {
      await apiFetch(`/api/projects/${selectedProject.id}/qa-test-suites/${suiteToEdit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSuite),
      });
      toast.success("Suite berhasil diperbarui.");
    } catch (err) {
      console.warn("Failed to update suite:", err);
    }
    setSuiteToEdit(null);
  };

  // Edit Case Handler
  const submitEditTestCaseInfo = async () => {
    if (!caseToEditInfo) return;
    const updatedTc = {
      ...caseToEditInfo,
      title: caseEditTitle.trim() || caseToEditInfo.title,
      steps: caseEditSteps.trim() || caseToEditInfo.steps,
      expectedResult: caseEditExpected.trim() || caseToEditInfo.expectedResult,
      priority: caseEditPriority,
      assignedTo: caseEditAssignedTo || undefined,
    };

    const updatedSuites = suites.map((suite) => ({
      ...suite,
      cases: suite.cases.map((c) => (c.id === caseToEditInfo.id ? updatedTc : c)),
    }));
    saveSuitesToStorage(updatedSuites);

    try {
      await apiFetch(`/api/projects/${selectedProject.id}/qa-test-cases/${caseToEditInfo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTc),
      });
      toast.success("Test case berhasil diperbarui.");
    } catch (err) {
      console.warn("Failed to update case:", err);
    }
    setCaseToEditInfo(null);
  };

  // Delete Handlers
  const handleDeleteSuite = async (id: string) => {
    const updated = suites.filter((s) => s.id !== id);
    saveSuitesToStorage(updated);
    if (selectedSuiteId === id) setSelectedSuiteId(updated[0]?.id || "");

    try {
      await apiFetch(`/api/projects/${selectedProject.id}/qa-test-suites/${id}`, { method: "DELETE" });
    } catch (e) {}
    toast.success("Test suite dihapus.");
    setSuiteToDelete(null);
  };

  const handleDeleteTestCase = async (id: string) => {
    const updatedSuites = suites.map((suite) => ({
      ...suite,
      cases: suite.cases.filter((c) => c.id !== id),
    }));
    saveSuitesToStorage(updatedSuites);

    try {
      await apiFetch(`/api/projects/${selectedProject.id}/qa-test-cases/${id}`, { method: "DELETE" });
    } catch (e) {}
    toast.success("Test case dihapus.");
    setCaseToDelete(null);
  };

  // Bug Ticket Creation Handler
  const handleOpenCreateBugModal = (tc: QATestCase) => {
    setBugModalTestCase(tc);
    setBugTitleInput(`BUG: ${tc.title}`);
    setBugDescriptionInput(
      `### Detail Bug\nOrigin: TC #${tc.rowNum}\nSteps:\n${tc.steps}\nExpected:\n${tc.expectedResult}`
    );
    setBugPriorityInput(tc.priority || "High");
    setIsCreateBugModalOpen(true);
  };

  const handleSubmitCreateBugTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugModalTestCase || !bugSelectedParentId) return;

    setIsSubmittingBug(true);
    try {
      const response = await apiRequest(`/api/projects/${selectedProject.id}/tasks`, {
        method: "POST",
        body: {
          title: bugTitleInput.trim(),
          description: bugDescriptionInput,
          status: "todo",
          type: "bug",
          priority: bugPriorityInput.toLowerCase(),
          parentId: bugSelectedParentId,
          assigneeId: bugAssigneeInput || null,
        },
      });

      if (response && response.status === "success") {
        const createdKey = response.data.key || `BUG-${Date.now()}`;
        const updatedSuites = suites.map((s) => ({
          ...s,
          cases: s.cases.map((c) => (c.id === bugModalTestCase.id ? { ...c, linkedBugKey: createdKey } : c)),
        }));
        saveSuitesToStorage(updatedSuites);
        toast.success(`Tiket bug ${createdKey} berhasil dibuat.`);
        setIsCreateBugModalOpen(false);
      }
    } catch (err: any) {
      toast.error("Gagal membuat tiket bug.");
    } finally {
      setIsSubmittingBug(false);
    }
  };

  // Drawer comment send
  const handleSendCommentFromDrawer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTestCase || !drawerNewComment.trim()) return;

    const newComment: QAComment = {
      id: `comment-${Date.now()}`,
      userName: currentUserName,
      text: drawerNewComment.trim(),
      timestamp: new Date().toISOString(),
    };

    const list = [...(selectedTestCase.commentsList || []), newComment];
    const updatedCase = { ...selectedTestCase, commentsList: list };
    setSelectedTestCase(updatedCase);

    const updatedSuites = suites.map((s) => ({
      ...s,
      cases: s.cases.map((c) => (c.id === selectedTestCase.id ? updatedCase : c)),
    }));
    saveSuitesToStorage(updatedSuites);
    setDrawerNewComment("");
    toast.success("Komentar ditambahkan.");
  };

  const handleEvidenceUploadFromDrawer = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedTestCase) return;

    const fileUrl = URL.createObjectURL(files[0]);
    const newEv = {
      id: `ev-${Date.now()}`,
      name: files[0].name,
      url: fileUrl,
      type: files[0].name.match(/\.(mp4|mov|avi)$/i) ? "video" : ("image" as any),
    };
    const updatedEvs = [...(selectedTestCase.evidences || []), newEv];
    const updatedCase = { ...selectedTestCase, evidences: updatedEvs };

    setSelectedTestCase(updatedCase);
    const updatedSuites = suites.map((s) => ({
      ...s,
      cases: s.cases.map((c) => (c.id === selectedTestCase.id ? updatedCase : c)),
    }));
    saveSuitesToStorage(updatedSuites);
    toast.success("Bukti pengujian diupload.");
  };

  const handleRemoveSpecificEvidenceFromDrawer = (evidenceId: string) => {
    if (!selectedTestCase) return;
    const updatedEvs = (selectedTestCase.evidences || []).filter((e) => e.id !== evidenceId);
    const updatedCase = { ...selectedTestCase, evidences: updatedEvs };
    setSelectedTestCase(updatedCase);

    const updatedSuites = suites.map((s) => ({
      ...s,
      cases: s.cases.map((c) => (c.id === selectedTestCase.id ? updatedCase : c)),
    }));
    saveSuitesToStorage(updatedSuites);
    toast.info("Bukti pengujian dihapus.");
  };

  const fetchExecutionHistory = async (caseId: string) => {
    setLoadingHistory(true);
    try {
      const res = await apiFetch(`/api/projects/${selectedProject.id}/qa-test-cases/${caseId}/history`);
      if (res.ok) {
        const data = await res.json();
        setExecutionLogs(data.data || []);
      }
    } catch (e) {
      setExecutionLogs([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleExportQAReport = () => {
    const activeSuite = suites.find((s) => s.id === selectedSuiteId);
    if (!activeSuite) return;
    const reportContent = `QA REPORT: ${activeSuite.name}\nTotal: ${activeSuite.cases.length}`;
    const blob = new Blob([reportContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `QA_Report_${activeSuite.name}.txt`;
    a.click();
    toast.success("Report exported.");
  };

  const handleMigrateSuitePhase = async () => {
    const activeSuite = suites.find((s) => s.id === selectedSuiteId);
    if (!activeSuite) return;
    const nextPhase = activeSuite.phase === "SIT" ? "UAT" : "PTR";
    const newSuite: QATestSuite = {
      ...activeSuite,
      id: `suite-${Date.now()}`,
      phase: nextPhase,
      name: activeSuite.name.replace(/\s*\((SIT|UAT|PTR)\)/gi, ""),
      cases: activeSuite.cases.map((c) => ({ ...c, status: "Pending" })),
    };
    saveSuitesToStorage([newSuite, ...suites]);
    setSelectedSuiteId(newSuite.id);
    toast.success(`Modul dimigrasikan ke ${nextPhase}`);
  };

  const handleGenerateWithAi = () => {
    toast.info("AI Test Case Generator disimulasikan.");
  };

  const activeSuiteObj = suites.find((s) => s.id === selectedSuiteId);
  const suitesForFilter = suites.filter((s) => phaseFilter === "ALL" || s.phase === phaseFilter);
  const filteredCases =
    activeSuiteObj?.cases.filter((c) => statusFilter === "ALL" || c.status === statusFilter) || [];

  return (
    <div className="w-full space-y-3.5 select-none" id="qa_module_container">
      {/* Topbar Lock Indicator & Integrated Velzon Page Title */}
      <QATopBar
        lockState={lockState}
        remainingTime={remainingTime}
        currentUserUid={currentUserUid}
        currentUserRole={currentUserRole}
        handleForceUnlock={handleForceUnlock}
        releaseLockManually={releaseLockManually}
      />



      {/* OPTIMIZED RESPONSIVE GRID (3 : 9 RATIO) - 75% WIDTH FOR TABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        <QASuiteSidebar
          suitesForFilter={suitesForFilter}
          selectedSuiteId={selectedSuiteId}
          setSelectedSuiteId={setSelectedSuiteId}
          phaseFilter={phaseFilter}
          setPhaseFilter={setPhaseFilter}
          setIsAddSuiteOpen={setIsAddSuiteOpen}
          setSuiteToEdit={setSuiteToEdit}
          setSuiteEditName={setSuiteEditName}
          setSuiteEditAssignedTo={setSuiteEditAssignedTo}
          setSuiteToDelete={setSuiteToDelete}
          activeSuitePicDropdownId={activeSuitePicDropdownId}
          setActiveSuitePicDropdownId={setActiveSuitePicDropdownId}
          handleUpdateSuitePic={handleUpdateSuitePic}
          projectMembers={projectMembers}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canDelete={canDelete}
        />

        <QATestCaseTable
          activeSuite={activeSuiteObj}
          filteredCases={filteredCases}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          projectMembers={projectMembers}
          currentUserUid={currentUserUid}
          currentUserRole={currentUserRole}
          lockState={lockState}
          isGeneratingAi={isGeneratingAi}
          handleGenerateWithAi={handleGenerateWithAi}
          handleExportQAReport={handleExportQAReport}
          handleMigrateSuitePhase={handleMigrateSuitePhase}
          setIsAddCaseOpen={setIsAddCaseOpen}
          setActiveAddTab={setActiveAddTab}
          handleStatusChange={handleStatusChange}
          activeCasePicDropdownId={activeCasePicDropdownId}
          setActiveCasePicDropdownId={setActiveCasePicDropdownId}
          handleUpdateCasePic={handleUpdateCasePic}
          setCaseToEditInfo={setCaseToEditInfo}
          setCaseEditTitle={setCaseEditTitle}
          setCaseEditSteps={setCaseEditSteps}
          setCaseEditExpected={setCaseEditExpected}
          setCaseEditPriority={setCaseEditPriority}
          setCaseEditAssignedTo={setCaseEditAssignedTo}
          setCaseToDelete={setCaseToDelete}
          handleOpenCreateBugModal={handleOpenCreateBugModal}
          setSelectedTestCase={setSelectedTestCase}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isAdminRole={isAdminRole}
          selectedCaseIds={selectedCaseIds}
          handleToggleSelectAll={handleToggleSelectAll}
          handleToggleSelectCase={handleToggleSelectCase}
          handleBulkAssignPic={handleBulkAssignPic}
          handleBulkChangeStatus={handleBulkChangeStatus}
          handleBulkDeleteCases={handleBulkDeleteCases}
        />
      </div>

      {/* Side Drawer Detail */}
      <QADetailDrawer
        selectedTestCase={selectedTestCase}
        setSelectedTestCase={setSelectedTestCase}
        drawerActiveTab={drawerActiveTab}
        setDrawerActiveTab={setDrawerActiveTab}
        executionLogs={executionLogs}
        loadingHistory={loadingHistory}
        fetchExecutionHistory={fetchExecutionHistory}
        drawerNewComment={drawerNewComment}
        setDrawerNewComment={setDrawerNewComment}
        handleSendCommentFromDrawer={handleSendCommentFromDrawer}
        handleEvidenceUploadFromDrawer={handleEvidenceUploadFromDrawer}
        handleRemoveSpecificEvidenceFromDrawer={handleRemoveSpecificEvidenceFromDrawer}
        handleOpenCreateBugModal={handleOpenCreateBugModal}
        handleStatusChange={handleStatusChange}
        projectMembers={projectMembers}
      />

      {/* Dialog Modals */}
      <QAModals
        isAddSuiteOpen={isAddSuiteOpen}
        setIsAddSuiteOpen={setIsAddSuiteOpen}
        newSuiteNameOnly={newSuiteNameOnly}
        setNewSuiteNameOnly={setNewSuiteNameOnly}
        newSuitePhaseOnly={newSuitePhaseOnly}
        setNewSuitePhaseOnly={setNewSuitePhaseOnly}
        newSuiteAssignedTo={newSuiteAssignedTo}
        setNewSuiteAssignedTo={setNewSuiteAssignedTo}
        handleAddSuiteOnly={handleAddSuiteOnly}
        isAddCaseOpen={isAddCaseOpen}
        setIsAddCaseOpen={setIsAddCaseOpen}
        activeAddTab={activeAddTab}
        setActiveAddTab={setActiveAddTab}
        newCaseTitle={newCaseTitle}
        setNewCaseTitle={setNewCaseTitle}
        newCasePriority={newCasePriority}
        setNewCasePriority={setNewCasePriority}
        newCaseAssignedTo={newCaseAssignedTo}
        setNewCaseAssignedTo={setNewCaseAssignedTo}
        newCaseSteps={newCaseSteps}
        setNewCaseSteps={setNewCaseSteps}
        newCaseExpected={newCaseExpected}
        setNewCaseExpected={setNewCaseExpected}
        handleCreateManualTestCase={handleCreateManualTestCase}
        bulkUploadFile={bulkUploadFile}
        setBulkUploadFile={setBulkUploadFile}
        handleBulkUploadTestCases={handleBulkUploadTestCases}
        suiteToEdit={suiteToEdit}
        setSuiteToEdit={setSuiteToEdit}
        suiteEditName={suiteEditName}
        setSuiteEditName={setSuiteEditName}
        suiteEditAssignedTo={suiteEditAssignedTo}
        setSuiteEditAssignedTo={setSuiteEditAssignedTo}
        submitEditSuite={submitEditSuite}
        caseToEditInfo={caseToEditInfo}
        setCaseToEditInfo={setCaseToEditInfo}
        caseEditTitle={caseEditTitle}
        setCaseEditTitle={setCaseEditTitle}
        caseEditSteps={caseEditSteps}
        setCaseEditSteps={setCaseEditSteps}
        caseEditExpected={caseEditExpected}
        setCaseEditExpected={setCaseEditExpected}
        caseEditPriority={caseEditPriority}
        setCaseEditPriority={setCaseEditPriority}
        caseEditAssignedTo={caseEditAssignedTo}
        setCaseEditAssignedTo={setCaseEditAssignedTo}
        submitEditTestCaseInfo={submitEditTestCaseInfo}
        suiteToDelete={suiteToDelete}
        setSuiteToDelete={setSuiteToDelete}
        handleDeleteSuite={handleDeleteSuite}
        caseToDelete={caseToDelete}
        setCaseToDelete={setCaseToDelete}
        handleDeleteTestCase={handleDeleteTestCase}
        isCreateBugModalOpen={isCreateBugModalOpen}
        setIsCreateBugModalOpen={setIsCreateBugModalOpen}
        bugModalTestCase={bugModalTestCase}
        setBugModalTestCase={setBugModalTestCase}
        bugTitleInput={bugTitleInput}
        setBugTitleInput={setBugTitleInput}
        bugSelectedParentId={bugSelectedParentId}
        setBugSelectedParentId={setBugSelectedParentId}
        parentSearchTerm={parentSearchTerm}
        setParentSearchTerm={setParentSearchTerm}
        bugPriorityInput={bugPriorityInput}
        setBugPriorityInput={setBugPriorityInput}
        bugAssigneeInput={bugAssigneeInput}
        setBugAssigneeInput={setBugAssigneeInput}
        bugDescriptionInput={bugDescriptionInput}
        setBugDescriptionInput={setBugDescriptionInput}
        isSubmittingBug={isSubmittingBug}
        handleSubmitCreateBugTicket={handleSubmitCreateBugTicket}
        selectedSuiteId={selectedSuiteId}
        suites={suites}
        tasks={tasks}
        projectMembers={projectMembers}
        selectedProject={selectedProject}
      />
    </div>
  );
}
