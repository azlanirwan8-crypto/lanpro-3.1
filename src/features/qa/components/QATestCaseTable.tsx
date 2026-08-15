import React, { useState } from "react";
import {
  Plus, Sparkles, Download, CheckCircle2, FileSpreadsheet,
  Edit3, Trash2, Bug, User, ChevronDown, Search, Filter, Eye, UserCheck, Layers, CheckSquare
} from "lucide-react";
import { QATestCase, QATestSuite } from "../types";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import { ResponsiveTable } from "../../../components/ResponsiveTable";

interface QATestCaseTableProps {
  activeSuite: QATestSuite | undefined;
  filteredCases: QATestCase[];
  statusFilter: string;
  setStatusFilter: (status: any) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  projectMembers: any[];
  currentUserUid: string;
  currentUserRole: string;
  lockState: { lockedBy: string | null; userName: string | null; lockedAt: number | null };
  isGeneratingAi: boolean;
  handleGenerateWithAi: () => void;
  handleExportQAReport: () => void;
  handleMigrateSuitePhase: () => void;
  setIsAddCaseOpen: (open: boolean) => void;
  setActiveAddTab: (tab: "single" | "bulk") => void;
  handleStatusChange: (caseId: string, status: "Passed" | "Failed" | "Blocked" | "Retest" | "Pending") => void;
  activeCasePicDropdownId: string | null;
  setActiveCasePicDropdownId: (id: string | null) => void;
  handleUpdateCasePic: (suiteId: string, caseId: string, assignedTo: string) => void;
  setCaseToEditInfo: (tc: QATestCase) => void;
  setCaseEditTitle: (title: string) => void;
  setCaseEditSteps: (steps: string) => void;
  setCaseEditExpected: (expected: string) => void;
  setCaseEditPriority: (priority: "High" | "Medium" | "Low" | "Critical") => void;
  setCaseEditAssignedTo: (assignedTo: string) => void;
  setCaseToDelete: (tc: QATestCase) => void;
  handleOpenCreateBugModal: (tc: QATestCase) => void;
  setSelectedTestCase: (tc: QATestCase) => void;

  // RBAC & Admin Bulk Assignment Props
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isAdminRole: boolean;
  selectedCaseIds: string[];
  handleToggleSelectAll: (cases: QATestCase[]) => void;
  handleToggleSelectCase: (caseId: string) => void;
  handleBulkAssignPic: (assignedTo: string) => void;
  handleBulkChangeStatus: (status: "Passed" | "Failed" | "Blocked" | "Retest" | "Pending") => void;
  handleBulkDeleteCases: () => void;
}

export const QATestCaseTable: React.FC<QATestCaseTableProps> = ({
  activeSuite,
  filteredCases,
  statusFilter,
  setStatusFilter,
  searchTerm,
  setSearchTerm,
  projectMembers,
  currentUserUid,
  currentUserRole,
  lockState,
  isGeneratingAi,
  handleGenerateWithAi,
  handleExportQAReport,
  handleMigrateSuitePhase,
  setIsAddCaseOpen,
  setActiveAddTab,
  handleStatusChange,
  activeCasePicDropdownId,
  setActiveCasePicDropdownId,
  handleUpdateCasePic,
  setCaseToEditInfo,
  setCaseEditTitle,
  setCaseEditSteps,
  setCaseEditExpected,
  setCaseEditPriority,
  setCaseEditAssignedTo,
  setCaseToDelete,
  handleOpenCreateBugModal,
  setSelectedTestCase,

  canCreate,
  canUpdate,
  canDelete,
  isAdminRole,
  selectedCaseIds,
  handleToggleSelectAll,
  handleToggleSelectCase,
  handleBulkAssignPic,
  handleBulkChangeStatus,
  handleBulkDeleteCases,
}) => {
  const [isBulkPicDropdownOpen, setIsBulkPicDropdownOpen] = useState(false);
  const [isBulkStatusDropdownOpen, setIsBulkStatusDropdownOpen] = useState(false);

  if (!activeSuite) {
    return (
      <div className="lg:col-span-9 bg-surface border border-border-subtle/80 p-10 rounded-md text-center shadow-xs">
        <div className="w-10 h-10 bg-primary/10 text-primary rounded-md flex items-center justify-center mx-auto mb-2.5">
          <FileSpreadsheet className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-medium text-content-strong">Silakan Pilih Modul Testing</h3>
        <p className="text-xs text-content-subtle font-medium mt-1">
          Pilih dokumen pengujian di panel sebelah kiri untuk menampilkan matriks eksekusi test case.
        </p>
      </div>
    );
  }

  // Clean duplicate phase suffixes like (UAT) from title
  const cleanSuiteName = activeSuite.name.replace(/\s*\((SIT|UAT|PTR)\)/gi, "");

  const totalCasesCount = activeSuite.cases?.length || 0;
  const passedCasesCount = activeSuite.cases?.filter((c) => c.status === "Passed").length || 0;
  const failedCasesCount = activeSuite.cases?.filter((c) => c.status === "Failed").length || 0;
  const blockedCasesCount = activeSuite.cases?.filter((c) => c.status === "Blocked").length || 0;
  const retestCasesCount = activeSuite.cases?.filter((c) => c.status === "Retest").length || 0;
  const pendingCasesCount = activeSuite.cases?.filter((c) => c.status === "Pending").length || 0;
  const passedPercent = totalCasesCount > 0 ? Math.round((passedCasesCount / totalCasesCount) * 100) : 0;

  // Filter cases with search term
  const searchedCases = filteredCases.filter((tc) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      tc.title?.toLowerCase().includes(q) ||
      tc.steps?.toLowerCase().includes(q) ||
      tc.expectedResult?.toLowerCase().includes(q) ||
      (tc.linkedBugKey && tc.linkedBugKey.toLowerCase().includes(q))
    );
  });

  const isAllSelected = searchedCases.length > 0 && selectedCaseIds.length === searchedCases.length;

  return (
    <div className="lg:col-span-9 space-y-3.5 lg:sticky lg:top-4">
      {/* Velzon Header & Micro Stats Box */}
      <div className="bg-surface border border-border-subtle/80 p-4 rounded-md shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-primary text-white font-medium text-xs sm:text-[11px] sm:text-[9px] rounded-md uppercase tracking-wider">
                {activeSuite.phase}
              </span>
              <h2 className="text-base font-medium text-content-strong tracking-tight">{cleanSuiteName}</h2>
            </div>
            <p className="text-xs sm:text-[11px] text-content-subtle font-medium mt-0.5">
              Diupload oleh: {activeSuite.uploadedBy} • {new Date(activeSuite.uploadedAt).toLocaleDateString("id-ID")}
            </p>
          </div>

          {/* Action Buttons Header */}
          <div className="flex flex-wrap items-center gap-1.5">
            {canCreate && (
              <button
                onClick={() => {
                  setIsAddCaseOpen(true);
                  setActiveAddTab("single");
                }}
                className="px-3 py-1.5 bg-primary hover:bg-[#354473] text-white font-medium rounded-md text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Task</span>
              </button>
            )}

            {canCreate && (
              <button
                onClick={handleGenerateWithAi}
                disabled={isGeneratingAi}
                className="px-3 py-1.5 bg-gradient-to-r from-primary to-indigo-600 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 text-white font-medium rounded-md text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer active:scale-95"
                title="Generate test cases dengan AI"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAi ? "animate-spin" : ""}`} />
                <span>{isGeneratingAi ? "Menganalisis..." : "Generate AI"}</span>
              </button>
            )}

            <button
              onClick={handleExportQAReport}
              className="px-2.5 py-1.5 bg-surface-muted hover:bg-slate-200 text-content-body font-medium rounded-md text-xs flex items-center gap-1 transition-all cursor-pointer"
              title="Export Laporan Eksekusi QA"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              <span>Export</span>
            </button>

            {passedPercent === 100 &&
              totalCasesCount > 0 &&
              (activeSuite.phase === "SIT" || activeSuite.phase === "UAT") &&
              canUpdate && (
                <button
                  onClick={handleMigrateSuitePhase}
                  className="px-3 py-1.5 bg-success hover:bg-[#089683] text-white font-medium rounded-md text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{activeSuite.phase === "SIT" ? "Migrate to UAT" : "Migrate to PTR"}</span>
                </button>
              )}
          </div>
        </div>

        {/* Velzon Compact Micro Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          <div className="bg-primary/5 border border-primary/10 p-2 rounded-md text-center">
            <span className="text-xs sm:text-[11px] sm:text-[9px] text-primary font-medium uppercase tracking-wider block">Total Case</span>
            <span className="text-base font-medium text-primary block mt-0.5">{totalCasesCount}</span>
          </div>
          <div className="bg-surface-sunken p-2 rounded-md border border-border-subtle/60 text-center">
            <span className="text-xs sm:text-[11px] sm:text-[9px] text-content-muted font-medium uppercase tracking-wider block">Passed Rate</span>
            <span className="text-base font-medium text-content-strong block mt-0.5">{passedPercent}%</span>
          </div>
          <div className="bg-emerald-50/50 p-2 rounded-md border border-emerald-100 text-center">
            <span className="text-xs sm:text-[11px] sm:text-[9px] text-success font-medium uppercase tracking-wider block">PASSED</span>
            <span className="text-base font-medium text-success block mt-0.5">{passedCasesCount}</span>
          </div>
          <div className="bg-rose-50/50 p-2 rounded-md border border-rose-100 text-center">
            <span className="text-xs sm:text-[11px] sm:text-[9px] text-danger font-medium uppercase tracking-wider block">FAILED</span>
            <span className="text-base font-medium text-danger block mt-0.5">{failedCasesCount}</span>
          </div>
          <div className="bg-amber-50/50 p-2 rounded-md border border-amber-100 text-center">
            <span className="text-xs sm:text-[11px] sm:text-[9px] text-warning font-medium uppercase tracking-wider block">BLOCKED</span>
            <span className="text-base font-medium text-warning block mt-0.5">{blockedCasesCount}</span>
          </div>
          <div className="bg-surface-sunken p-2 rounded-md border border-border-subtle/60 text-center">
            <span className="text-xs sm:text-[11px] sm:text-[9px] text-content-muted font-medium uppercase tracking-wider block">RETEST/PEND</span>
            <span className="text-base font-medium text-content-body block mt-0.5">
              {retestCasesCount + pendingCasesCount}
            </span>
          </div>
        </div>

        {/* ELEGANT TOP RIGHT SEARCH & FILTER BAR */}
        <div className="flex items-center justify-between gap-2.5 pt-2.5 border-t border-border-faint">
          <div className="text-xs sm:text-[11px] font-medium text-content-strong uppercase tracking-wider flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
            <span>Matriks Skenario Test Case ({searchedCases.length})</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Elegant Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-content-subtle" />
              <input
                type="text"
                placeholder="Cari scenario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 pr-2.5 py-1 bg-surface-sunken border border-border-subtle/80 rounded-md text-xs font-medium text-content-body focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary transition-all w-36 sm:w-48"
              />
            </div>

            {/* Elegant Filter Status Select */}
            <div className="relative flex items-center gap-1 bg-surface-sunken border border-border-subtle/80 rounded-md px-2 py-1 text-xs font-medium text-content-body">
              <Filter className="w-3 h-3 text-primary" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent border-none outline-none font-medium text-xs cursor-pointer text-content-body pr-1"
              >
                <option value="ALL">Status: Semua (ALL)</option>
                <option value="Passed">Status: Passed</option>
                <option value="Failed">Status: Failed</option>
                <option value="Blocked">Status: Blocked</option>
                <option value="Retest">Status: Retest</option>
                <option value="Pending">Status: Pending</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING BULK ACTIONS TOOLBAR FOR ADMIN / PROJECT ADMIN */}
      {selectedCaseIds.length > 0 && (canUpdate || isAdminRole) && (
        <div className="bg-gradient-to-r from-primary to-indigo-900 text-white p-3 rounded-md shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-surface/10 rounded-md">
              <CheckSquare className="w-4 h-4 text-emerald-400" />
            </span>
            <span className="text-xs font-medium">
              {selectedCaseIds.length} Task Terpilih
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* BULK MULTIPLE ASSIGN PIC DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => setIsBulkPicDropdownOpen(!isBulkPicDropdownOpen)}
                className="px-3 py-1.5 bg-surface/10 hover:bg-surface/20 text-white text-xs font-medium rounded-md flex items-center gap-1.5 transition-all cursor-pointer border border-white/20"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Bulk Assign PIC</span>
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>

              {isBulkPicDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsBulkPicDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 w-60 bg-surface text-content-strong rounded-md shadow-2xl border border-border-subtle py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3.5 py-1.5 text-xs sm:text-[10px] font-medium uppercase tracking-wider text-primary border-b border-border-faint mb-1">
                      Tetapkan PIC ke {selectedCaseIds.length} Task
                    </div>
                    <button
                      onClick={() => {
                        handleBulkAssignPic("");
                        setIsBulkPicDropdownOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs font-medium hover:bg-indigo-50 hover:text-primary transition-colors"
                    >
                      Semua PIC Proyek (All Members)
                    </button>
                    <div className="max-h-44 overflow-y-auto custom-scrollbar">
                      {(projectMembers || []).map((m: any) => {
                        const mId = m.uid || m.id;
                        return (
                          <button
                            key={mId}
                            onClick={() => {
                              handleBulkAssignPic(mId);
                              setIsBulkPicDropdownOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs font-medium hover:bg-indigo-50 hover:text-primary transition-colors flex items-center gap-2"
                          >
                            <UserAvatar uid={mId} members={projectMembers} className="w-4 h-4 shrink-0" />
                            <span className="truncate">{m.displayName || m.email || m.username}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* BULK CHANGE STATUS DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => setIsBulkStatusDropdownOpen(!isBulkStatusDropdownOpen)}
                className="px-3 py-1.5 bg-surface/10 hover:bg-surface/20 text-white text-xs font-medium rounded-md flex items-center gap-1.5 transition-all cursor-pointer border border-white/20"
              >
                <Layers className="w-3.5 h-3.5 text-amber-300" />
                <span>Bulk Status</span>
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>

              {isBulkStatusDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsBulkStatusDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 w-44 bg-surface text-content-strong rounded-md shadow-2xl border border-border-subtle py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    {["Passed", "Failed", "Blocked", "Retest", "Pending"].map((st) => (
                      <button
                        key={st}
                        onClick={() => {
                          handleBulkChangeStatus(st as any);
                          setIsBulkStatusDropdownOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-1.5 text-xs font-medium hover:bg-indigo-50 hover:text-primary transition-colors"
                      >
                        Set to {st}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* BULK DELETE */}
            {canDelete && (
              <button
                onClick={handleBulkDeleteCases}
                className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium rounded-md flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Terpilih</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ULTRA-SLEEK 5-COLUMN ENTERPRISE QA TABLE MATRIX */}
      <div className="bg-surface border border-border-subtle/80 rounded-md shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <ResponsiveTable className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-primary/5 border-b border-primary/15 text-xs sm:text-[10px] font-medium uppercase tracking-wider text-primary">
                {/* SELECT ALL CHECKBOX (For Admin / Users with edit access) */}
                <th className="py-2.5 px-3 w-8 text-center" onClick={(e) => e.stopPropagation()}>
                  {(canUpdate || isAdminRole) && (
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={() => handleToggleSelectAll(searchedCases)}
                      className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                    />
                  )}
                </th>
                <th className="py-2.5 px-3 w-8 text-center">#</th>
                <th className="py-2.5 px-4 min-w-[280px]">Test Scenario / Title</th>
                <th className="py-2.5 px-3 min-w-[90px] text-center">Priority</th>
                <th className="py-2.5 px-3 min-w-[180px] text-center">Status & PIC Assignee</th>
                <th className="py-2.5 px-3 w-28 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-faint text-xs font-medium text-content-body">
              {searchedCases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-content-subtle font-medium">
                    Tidak ada test case yang sesuai dengan filter atau kata kunci pencarian.
                  </td>
                </tr>
              ) : (
                searchedCases.map((tc, idx) => {
                  const matchedMember = (projectMembers || []).find(
                    (m: any) =>
                      m.uid === tc.assignedTo ||
                      m.id === tc.assignedTo ||
                      m.username === tc.assignedTo ||
                      m.email === tc.assignedTo
                  );

                  const isPicDropdownOpen = activeCasePicDropdownId === tc.id;
                  const isChecked = selectedCaseIds.includes(tc.id);

                  return (
                    <tr
                      key={tc.id || idx}
                      onClick={() => setSelectedTestCase(tc)}
                      className={`hover:bg-primary/[0.03] transition-colors cursor-pointer group ${
                        isChecked ? "bg-indigo-50/40" : ""
                      }`}
                    >
                      {/* Checkbox Multi-Select */}
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {(canUpdate || isAdminRole) && (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelectCase(tc.id)}
                            className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                          />
                        )}
                      </td>

                      {/* Row Num */}
                      <td className="py-2.5 px-3 text-center font-medium text-content-subtle text-xs group-hover:text-primary">
                        {tc.rowNum || idx + 1}
                      </td>

                      {/* Title & Linked Bug Key */}
                      <td className="py-2.5 px-4 font-medium text-content-strong">
                        <div className="flex items-center gap-2">
                          <span className="line-clamp-1 text-xs group-hover:text-primary transition-colors">
                            {tc.title}
                          </span>
                          {tc.linkedBugKey && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-rose-50 border border-rose-200/60 rounded text-xs sm:text-[11px] sm:text-[9px] font-medium text-danger shrink-0">
                              <Bug className="w-2.5 h-2.5" />
                              {tc.linkedBugKey}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Velzon Priority Compact Pill Badge */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-xs sm:text-[11px] sm:text-[9px] font-medium uppercase tracking-wider inline-block ${
                            tc.priority === "Critical" || tc.priority === "High"
                              ? "bg-rose-50 text-danger border border-rose-200/60"
                              : tc.priority === "Low"
                              ? "bg-surface-muted text-content-secondary border border-border-subtle/60"
                              : "bg-amber-50 text-warning border border-amber-200/60"
                          }`}
                        >
                          {tc.priority || "Medium"}
                        </span>
                      </td>

                      {/* STATUS & PIC ASSIGNEE (COMPACT SMOOTH PILL LAYOUT) */}
                      <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {/* 1. Status Dropdown Pill (ALL USERS CAN UPDATE STATUS) */}
                          <select
                            value={tc.status}
                            onChange={(e) => handleStatusChange(tc.id, e.target.value as any)}
                            className={`py-1 px-2.5 rounded-md text-xs sm:text-[10px] font-medium uppercase tracking-wider outline-none cursor-pointer transition-all border shadow-2xs ${
                              tc.status === "Passed"
                                ? "bg-emerald-50 text-success border-emerald-200"
                                : tc.status === "Failed"
                                ? "bg-rose-50 text-danger border-rose-200"
                                : tc.status === "Blocked"
                                ? "bg-amber-50 text-warning border-amber-200"
                                : tc.status === "Retest"
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                : "bg-surface-muted text-content-secondary border-border-subtle"
                            }`}
                          >
                            <option value="Passed">Passed</option>
                            <option value="Failed">Failed</option>
                            <option value="Blocked">Blocked</option>
                            <option value="Retest">Retest</option>
                            <option value="Pending">Pending</option>
                          </select>

                          {/* 2. Sleek PIC Avatar Icon Button NEXT TO STATUS */}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (canUpdate) {
                                  setActiveCasePicDropdownId(isPicDropdownOpen ? null : tc.id);
                                }
                              }}
                              className={`w-6 h-6 rounded-full border transition-all flex items-center justify-center shadow-2xs ${
                                canUpdate ? "cursor-pointer hover:ring-2 hover:ring-primary/30" : "cursor-default"
                              } ${
                                tc.assignedTo
                                  ? "bg-primary/10 border-primary/40"
                                  : "bg-surface-muted border-border-subtle/80 text-content-muted"
                              }`}
                              title={
                                tc.assignedTo
                                  ? `PIC Task: ${matchedMember?.displayName || matchedMember?.username || tc.assignedTo}`
                                  : "PIC Task"
                              }
                            >
                              {tc.assignedTo ? (
                                <UserAvatar uid={tc.assignedTo} members={projectMembers} className="w-5.5 h-5.5 rounded-full" />
                              ) : (
                                <User className="w-3 h-3 text-content-subtle" />
                              )}
                            </button>

                            {/* User Picker Dropdown Menu */}
                            {isPicDropdownOpen && canUpdate && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveCasePicDropdownId(null);
                                  }}
                                />
                                <div className="absolute right-0 top-full mt-1.5 w-56 bg-surface rounded-md shadow-2xl border border-border-subtle py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                                  <div className="px-3.5 py-1.5 text-xs sm:text-[10px] font-medium uppercase tracking-wider text-primary border-b border-border-faint mb-1">
                                    Assign PIC Task (Tim Proyek)
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUpdateCasePic(activeSuite.id, tc.id, "");
                                    }}
                                    className={`w-full text-left px-3.5 py-1.5 text-xs font-medium hover:bg-indigo-50 hover:text-primary transition-colors flex items-center justify-between ${
                                      !tc.assignedTo ? "bg-indigo-50/60 text-primary" : "text-content-body"
                                    }`}
                                  >
                                    <span>Semua PIC Proyek (All Members)</span>
                                    {!tc.assignedTo && <CheckCircle2 className="w-4 h-4 text-primary" />}
                                  </button>
                                  <div className="max-h-44 overflow-y-auto custom-scrollbar">
                                    {(projectMembers || []).map((m: any) => {
                                      const mId = m.uid || m.id;
                                      const isSelected = tc.assignedTo === mId;
                                      return (
                                        <button
                                          key={mId}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleUpdateCasePic(activeSuite.id, tc.id, mId);
                                          }}
                                          className={`w-full text-left px-3.5 py-1.5 text-xs font-medium hover:bg-indigo-50 hover:text-primary transition-colors flex items-center justify-between gap-2 ${
                                            isSelected ? "bg-indigo-50/60 text-primary" : "text-content-body"
                                          }`}
                                        >
                                          <div className="flex items-center gap-2 truncate">
                                            <UserAvatar uid={mId} members={projectMembers} className="w-4 h-4 shrink-0" />
                                            <span className="truncate">{m.displayName || m.email || m.username}</span>
                                          </div>
                                          {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Minimalist Action Icons */}
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedTestCase(tc)}
                            className="p-1 text-content-subtle hover:text-primary hover:bg-indigo-50 rounded-md transition-all"
                            title="Lihat Detail Skenario & Langkah Pengujian"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {tc.status === "Failed" && (
                            <button
                              onClick={() => handleOpenCreateBugModal(tc)}
                              className="p-1 text-danger hover:bg-rose-50 rounded-md transition-all"
                              title="Buat Tiket Bug"
                            >
                              <Bug className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canUpdate && (
                            <button
                              onClick={() => {
                                setCaseToEditInfo(tc);
                                setCaseEditTitle(tc.title);
                                setCaseEditSteps(tc.steps);
                                setCaseEditExpected(tc.expectedResult);
                                setCaseEditPriority(tc.priority || "Medium");
                                setCaseEditAssignedTo(tc.assignedTo || "");
                              }}
                              className="p-1 text-content-subtle hover:text-primary hover:bg-indigo-50 rounded-md transition-all"
                              title="Edit Test Case"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => setCaseToDelete(tc)}
                              className="p-1 text-content-subtle hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
                              title="Hapus Test Case"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </ResponsiveTable>
        </div>
      </div>
    </div>
  );
};
