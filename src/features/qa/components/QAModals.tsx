import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus, XCircle, Upload, Search, CheckCircle2, Trash2, Bug, FileSpreadsheet, Download, ChevronDown
} from "lucide-react";
import { QATestCase, QATestSuite } from "../types";

interface QAModalsProps {
  // Add Suite Modal
  isAddSuiteOpen: boolean;
  setIsAddSuiteOpen: (open: boolean) => void;
  newSuiteNameOnly: string;
  setNewSuiteNameOnly: (name: string) => void;
  newSuitePhaseOnly: "SIT" | "UAT" | "PTR";
  setNewSuitePhaseOnly: (phase: "SIT" | "UAT" | "PTR") => void;
  newSuiteAssignedTo: string;
  setNewSuiteAssignedTo: (assignedTo: string) => void;
  handleAddSuiteOnly: (e: React.FormEvent) => void;

  // Add Case Modal
  isAddCaseOpen: boolean;
  setIsAddCaseOpen: (open: boolean) => void;
  activeAddTab: "single" | "bulk";
  setActiveAddTab: (tab: "single" | "bulk") => void;
  newCaseTitle: string;
  setNewCaseTitle: (title: string) => void;
  newCasePriority: "High" | "Medium" | "Low" | "Critical";
  setNewCasePriority: (priority: "High" | "Medium" | "Low" | "Critical") => void;
  newCaseAssignedTo: string;
  setNewCaseAssignedTo: (assignedTo: string) => void;
  newCaseSteps: string;
  setNewCaseSteps: (steps: string) => void;
  newCaseExpected: string;
  setNewCaseExpected: (expected: string) => void;
  handleCreateManualTestCase: (e: React.FormEvent) => void;
  bulkUploadFile: File | null;
  setBulkUploadFile: (file: File | null) => void;
  handleBulkUploadTestCases: (e: React.FormEvent) => void;

  // Edit Suite Modal
  suiteToEdit: QATestSuite | null;
  setSuiteToEdit: (suite: QATestSuite | null) => void;
  suiteEditName: string;
  setSuiteEditName: (name: string) => void;
  suiteEditAssignedTo: string;
  setSuiteEditAssignedTo: (assignedTo: string) => void;
  submitEditSuite: () => void;

  // Edit Case Modal
  caseToEditInfo: QATestCase | null;
  setCaseToEditInfo: (tc: QATestCase | null) => void;
  caseEditTitle: string;
  setCaseEditTitle: (title: string) => void;
  caseEditSteps: string;
  setCaseEditSteps: (steps: string) => void;
  caseEditExpected: string;
  setCaseEditExpected: (expected: string) => void;
  caseEditPriority: "High" | "Medium" | "Low" | "Critical";
  setCaseEditPriority: (priority: "High" | "Medium" | "Low" | "Critical") => void;
  caseEditAssignedTo: string;
  setCaseEditAssignedTo: (assignedTo: string) => void;
  submitEditTestCaseInfo: () => void;

  // Delete Suite Modal
  suiteToDelete: QATestSuite | null;
  setSuiteToDelete: (suite: QATestSuite | null) => void;
  handleDeleteSuite: (id: string) => void;

  // Delete Case Modal
  caseToDelete: QATestCase | null;
  setCaseToDelete: (tc: QATestCase | null) => void;
  handleDeleteTestCase: (id: string) => void;

  // Create Bug Ticket Modal
  isCreateBugModalOpen: boolean;
  setIsCreateBugModalOpen: (open: boolean) => void;
  bugModalTestCase: QATestCase | null;
  setBugModalTestCase: (tc: QATestCase | null) => void;
  bugTitleInput: string;
  setBugTitleInput: (title: string) => void;
  bugSelectedParentId: string;
  setBugSelectedParentId: (parentId: string) => void;
  parentSearchTerm: string;
  setParentSearchTerm: (term: string) => void;
  bugPriorityInput: string;
  setBugPriorityInput: (priority: string) => void;
  bugAssigneeInput: string;
  setBugAssigneeInput: (assignee: string) => void;
  bugDescriptionInput: string;
  setBugDescriptionInput: (desc: string) => void;
  isSubmittingBug: boolean;
  handleSubmitCreateBugTicket: (e: React.FormEvent) => void;

  // Context & Members
  selectedSuiteId: string;
  suites: QATestSuite[];
  tasks: any[];
  projectMembers: any[];
  selectedProject: any;
}

export const QAModals: React.FC<QAModalsProps> = ({
  isAddSuiteOpen,
  setIsAddSuiteOpen,
  newSuiteNameOnly,
  setNewSuiteNameOnly,
  newSuitePhaseOnly,
  setNewSuitePhaseOnly,
  newSuiteAssignedTo,
  setNewSuiteAssignedTo,
  handleAddSuiteOnly,
  isAddCaseOpen,
  setIsAddCaseOpen,
  activeAddTab,
  setActiveAddTab,
  newCaseTitle,
  setNewCaseTitle,
  newCasePriority,
  setNewCasePriority,
  newCaseAssignedTo,
  setNewCaseAssignedTo,
  newCaseSteps,
  setNewCaseSteps,
  newCaseExpected,
  setNewCaseExpected,
  handleCreateManualTestCase,
  bulkUploadFile,
  setBulkUploadFile,
  handleBulkUploadTestCases,
  suiteToEdit,
  setSuiteToEdit,
  suiteEditName,
  setSuiteEditName,
  suiteEditAssignedTo,
  setSuiteEditAssignedTo,
  submitEditSuite,
  caseToEditInfo,
  setCaseToEditInfo,
  caseEditTitle,
  setCaseEditTitle,
  caseEditSteps,
  setCaseEditSteps,
  caseEditExpected,
  setCaseEditExpected,
  caseEditPriority,
  setCaseEditPriority,
  caseEditAssignedTo,
  setCaseEditAssignedTo,
  submitEditTestCaseInfo,
  suiteToDelete,
  setSuiteToDelete,
  handleDeleteSuite,
  caseToDelete,
  setCaseToDelete,
  handleDeleteTestCase,
  isCreateBugModalOpen,
  setIsCreateBugModalOpen,
  bugModalTestCase,
  setBugModalTestCase,
  bugTitleInput,
  setBugTitleInput,
  bugSelectedParentId,
  setBugSelectedParentId,
  parentSearchTerm,
  setParentSearchTerm,
  bugPriorityInput,
  setBugPriorityInput,
  bugAssigneeInput,
  setBugAssigneeInput,
  bugDescriptionInput,
  setBugDescriptionInput,
  isSubmittingBug,
  handleSubmitCreateBugTicket,
  selectedSuiteId,
  suites,
  tasks,
  projectMembers,
  selectedProject,
}) => {
  const [isParentDropdownOpen, setIsParentDropdownOpen] = useState(false);

  const activeSuiteObj = suites.find((s) => s.id === selectedSuiteId);

  const parentCandidates = (tasks || []).filter(
    (t: any) => (t.projectId === selectedProject?.id || !t.projectId) && t.type !== "subtask"
  );
  const filteredParents = parentCandidates.filter((p: any) => {
    if (!parentSearchTerm.trim()) return true;
    const term = parentSearchTerm.toLowerCase();
    const titleMatch = p.title?.toLowerCase().includes(term);
    const keyMatch = (p.key || p.taskKey || "").toLowerCase().includes(term);
    return titleMatch || keyMatch;
  });

  const selectedParentTask = parentCandidates.find((pt: any) => pt.id === bugSelectedParentId);

  const handleDownloadTemplateExcel = () => {
    const csvContent =
      "Judul,Deskripsi_Langkah,Hasil_Ekspektasi,Prioritas\n" +
      '"User Login Scenario","1. Buka URL login\n2. Input email & password valid\n3. Klik Tombol Login","Sistem berhasil mengarahkan ke Dashboard Utama","High"\n' +
      '"Filter Task Test","1. Masuk ke halaman daftar task\n2. Pilih status In Progress","Hanya task In Progress yang muncul","Medium"\n';

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Template_QA_Test_Cases.csv";
    a.click();
  };

  return (
    <>
      {/* 1. Add New Test Suite Modal (Velzon Style) */}
      <AnimatePresence>
        {isAddSuiteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200/80 rounded-md p-6 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="w-10 h-10 rounded-md bg-[#405189]/10 text-[#405189] flex items-center justify-center font-medium">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-800 uppercase tracking-wider">
                    Tambah Dokumen Skrip
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">Buat modul skenario pengujian baru</p>
                </div>
              </div>

              <form onSubmit={handleAddSuiteOnly} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-700 font-medium block">Nama Dokumen *</label>
                  <input
                    autoFocus
                    type="text"
                    required
                    value={newSuiteNameOnly}
                    onChange={(e) => setNewSuiteNameOnly(e.target.value)}
                    className="w-full text-xs p-3 bg-slate-50/80 border border-slate-200 rounded-md focus:border-[#405189] focus:ring-2 focus:ring-[#405189]/20 focus:outline-none font-medium text-slate-800"
                    placeholder="Masukkan nama dokumen..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-700 font-medium block">Fase Testing *</label>
                  <select
                    value={newSuitePhaseOnly}
                    onChange={(e) => setNewSuitePhaseOnly(e.target.value as any)}
                    className="w-full text-xs p-3 bg-slate-50/80 border border-slate-200 rounded-md focus:border-[#405189] focus:outline-none font-medium text-[#405189] cursor-pointer"
                  >
                    <option value="SIT">Fase SIT (System Integration Test)</option>
                    <option value="UAT">Fase UAT (User Acceptance Test)</option>
                    <option value="PTR">Fase PTR (Production Readiness Test)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsAddSuiteOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium uppercase tracking-wider rounded-md transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#405189] hover:bg-[#354473] text-white text-xs font-medium uppercase tracking-wider rounded-md transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4" /> Buat Dokumen
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Add New Test Case Modal (Velzon Style) */}
      <AnimatePresence>
        {isAddCaseOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200/80 rounded-md p-6 max-w-3xl w-full shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-md bg-[#405189]/10 text-[#405189] flex items-center justify-center font-medium">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-800 uppercase tracking-wider">Tambah Test Case Baru</h3>
                    <p className="text-[11px] text-slate-400 font-medium">Input manual atau bulk upload Excel</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddCaseOpen(false)}
                  className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Velzon Tab Switcher */}
              <div className="flex gap-2 p-1 bg-slate-100 rounded-md">
                <button
                  type="button"
                  onClick={() => setActiveAddTab("single")}
                  className={`flex-1 py-2 text-xs font-medium uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                    activeAddTab === "single"
                      ? "bg-white text-[#405189] shadow-xs border border-slate-200/80"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Single Input (Manual)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAddTab("bulk")}
                  className={`flex-1 py-2 text-xs font-medium uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                    activeAddTab === "bulk"
                      ? "bg-white text-[#405189] shadow-xs border border-slate-200/80"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Bulk Upload (Excel)
                </button>
              </div>

              {/* Target Suite Banner */}
              <div className="bg-[#405189]/5 border border-[#405189]/10 px-4 py-2.5 rounded-md flex items-center justify-between text-xs">
                <span className="font-medium text-[#405189]">
                  Modul Target: <strong>{activeSuiteObj ? activeSuiteObj.name : "Belum ada modul terpilih"}</strong>
                </span>
                <span className="px-2.5 py-0.5 bg-[#405189] text-white font-medium rounded-full text-[10px]">
                  {activeSuiteObj ? activeSuiteObj.phase : "SIT"}
                </span>
              </div>

              {activeAddTab === "single" ? (
                <form onSubmit={handleCreateManualTestCase} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[calc(100vh-320px)] overflow-y-auto pr-1 custom-scrollbar">
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block">
                          Judul Test Case *
                        </label>
                        <input
                          type="text"
                          required
                          value={newCaseTitle}
                          onChange={(e) => setNewCaseTitle(e.target.value)}
                          placeholder="Masukkan judul skenario pengujian..."
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md focus:border-[#405189] focus:outline-none font-medium"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block">
                          Tingkat Prioritas *
                        </label>
                        <select
                          value={newCasePriority}
                          onChange={(e) => setNewCasePriority(e.target.value as any)}
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md focus:border-[#405189] focus:outline-none font-medium text-slate-700 cursor-pointer"
                        >
                          <option value="Low">Low Priority</option>
                          <option value="Medium">Medium Priority</option>
                          <option value="High">High Priority</option>
                          <option value="Critical">Critical Priority</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block">
                          Langkah Pengujian *
                        </label>
                        <textarea
                          required
                          rows={3}
                          value={newCaseSteps}
                          onChange={(e) => setNewCaseSteps(e.target.value)}
                          placeholder="Tuliskan urutan aksi pengujian..."
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md focus:border-[#405189] focus:outline-none font-medium"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block">
                          Hasil yang Diharapkan *
                        </label>
                        <textarea
                          required
                          rows={2}
                          value={newCaseExpected}
                          onChange={(e) => setNewCaseExpected(e.target.value)}
                          placeholder="Tuliskan ekspektasi hasil akhir..."
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md focus:border-[#405189] focus:outline-none font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsAddCaseOpen(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium uppercase tracking-wider rounded-md cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#405189] hover:bg-[#354473] text-white text-xs font-medium uppercase tracking-wider rounded-md shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Plus className="w-4 h-4" /> Simpan Test Case
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleBulkUploadTestCases} className="space-y-4">
                  {/* Download Template Banner */}
                  <div className="flex items-center justify-between bg-indigo-50/60 border border-indigo-100 p-3 rounded-md">
                    <div>
                      <h4 className="text-xs font-medium text-[#405189]">Butuh Berkas Template Excel?</h4>
                      <p className="text-[10px] text-slate-500 font-medium">Unduh contoh struktur kolom resmi</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadTemplateExcel}
                      className="px-3.5 py-1.5 bg-[#405189] hover:bg-[#354473] text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Template Excel</span>
                    </button>
                  </div>

                  <div className="border-2 border-dashed border-slate-200 hover:border-[#405189] rounded-md p-8 text-center space-y-3 transition-colors bg-slate-50/50">
                    <Upload className="w-10 h-10 text-[#405189] mx-auto" />
                    <div>
                      <p className="text-xs font-medium text-slate-700">Unggah berkas Excel (.xlsx / .csv)</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Format kolom: Judul, Deskripsi_Langkah, Hasil_Ekspektasi, Prioritas
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".xlsx, .csv"
                      onChange={(e) => setBulkUploadFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="bulk_upload_input"
                    />
                    <label
                      htmlFor="bulk_upload_input"
                      className="inline-block px-4 py-2 bg-[#405189]/10 hover:bg-[#405189]/20 text-[#405189] text-xs font-medium rounded-md cursor-pointer transition-colors"
                    >
                      {bulkUploadFile ? bulkUploadFile.name : "Pilih Berkas Excel"}
                    </label>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsAddCaseOpen(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium uppercase tracking-wider rounded-md cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={!bulkUploadFile}
                      className="px-5 py-2 bg-[#405189] hover:bg-[#354473] text-white text-xs font-medium uppercase tracking-wider rounded-md shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
                    >
                      Proses Bulk Upload
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Edit Suite Modal */}
      <AnimatePresence>
        {suiteToEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200/80 rounded-md p-6 max-w-sm w-full shadow-2xl space-y-4"
            >
              <h3 className="text-sm font-medium text-slate-800 uppercase tracking-wider">Ubah Info Dokumen Suite</h3>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Nama Dokumen</label>
                  <input
                    type="text"
                    value={suiteEditName}
                    onChange={(e) => setSuiteEditName(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-800"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setSuiteToEdit(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-medium rounded-md cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={submitEditSuite}
                  className="px-4 py-2 bg-[#405189] text-white text-xs font-medium rounded-md cursor-pointer shadow-xs active:scale-95"
                >
                  Simpan Perubahan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Edit Test Case Modal */}
      <AnimatePresence>
        {caseToEditInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200/80 rounded-md p-6 max-w-lg w-full shadow-2xl space-y-4"
            >
              <h3 className="text-sm font-medium text-slate-800 uppercase tracking-wider">Ubah Test Case Detail</h3>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Judul Test Case</label>
                  <input
                    type="text"
                    value={caseEditTitle}
                    onChange={(e) => setCaseEditTitle(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Prioritas</label>
                  <select
                    value={caseEditPriority}
                    onChange={(e) => setCaseEditPriority(e.target.value as any)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-800 cursor-pointer"
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Critical">Critical Priority</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Langkah Pengujian</label>
                  <textarea
                    rows={3}
                    value={caseEditSteps}
                    onChange={(e) => setCaseEditSteps(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Hasil yang Diharapkan</label>
                  <textarea
                    rows={2}
                    value={caseEditExpected}
                    onChange={(e) => setCaseEditExpected(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-800"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setCaseToEditInfo(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-medium rounded-md cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={submitEditTestCaseInfo}
                  className="px-4 py-2 bg-[#405189] text-white text-xs font-medium rounded-md cursor-pointer shadow-xs active:scale-95"
                >
                  Simpan Perubahan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Create Bug Ticket Modal (Velzon Theme + Collapsible Combobox) */}
      <AnimatePresence>
        {isCreateBugModalOpen && bugModalTestCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200/80 rounded-md p-6 max-w-2xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-rose-50 text-[#f06548] rounded-md">
                    <Bug className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-slate-800">Buat Tiket Bug Terstruktur</h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Dibuat dari Test Case #{bugModalTestCase.rowNum}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateBugModalOpen(false);
                    setBugModalTestCase(null);
                  }}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitCreateBugTicket} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
                    JUDUL TIKET BUG *
                  </label>
                  <input
                    type="text"
                    required
                    value={bugTitleInput}
                    onChange={(e) => setBugTitleInput(e.target.value)}
                    className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-800 focus:border-[#405189] focus:outline-none"
                  />
                </div>

                {/* ELEGANT COLLAPSIBLE SEARCHABLE COMBOBOX */}
                <div className="space-y-1.5 relative">
                  <label className="text-[10px] font-medium text-[#f06548] uppercase tracking-wider block">
                    TARGET EPIC / TASK UTAMA (PARENT * MANDATORY)
                  </label>

                  <div
                    onClick={() => setIsParentDropdownOpen(!isParentDropdownOpen)}
                    className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-800 flex items-center justify-between cursor-pointer hover:border-[#405189]"
                  >
                    <span className="truncate">
                      {selectedParentTask
                        ? `[${selectedParentTask.key || selectedParentTask.taskKey || "TASK"}] ${selectedParentTask.title}`
                        : "-- Pilih Target Epic / Task Utama --"}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>

                  {/* COLLAPSIBLE DROPDOWN LIST */}
                  {isParentDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsParentDropdownOpen(false)} />
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                        <div className="relative mb-2">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                          <input
                            autoFocus
                            type="text"
                            placeholder="Cari nama Epic atau Task..."
                            value={parentSearchTerm}
                            onChange={(e) => setParentSearchTerm(e.target.value)}
                            className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none"
                          />
                        </div>

                        <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-md divide-y divide-slate-100 bg-white custom-scrollbar">
                          {filteredParents.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-400">
                              Tidak ada task target yang cocok.
                            </div>
                          ) : (
                            filteredParents.map((pt: any) => (
                              <div
                                key={pt.id}
                                onClick={() => {
                                  setBugSelectedParentId(pt.id);
                                  setIsParentDropdownOpen(false);
                                }}
                                className={`p-2.5 text-xs font-medium flex items-center justify-between cursor-pointer transition-colors ${
                                  bugSelectedParentId === pt.id
                                    ? "bg-rose-50/70 text-[#f06548]"
                                    : "hover:bg-slate-50 text-slate-700"
                                }`}
                              >
                                <span className="truncate">
                                  [{pt.key || pt.taskKey || (pt.type ? pt.type.toUpperCase() : "TASK")}] {pt.title}
                                </span>
                                {bugSelectedParentId === pt.id && <CheckCircle2 className="w-4 h-4 text-[#f06548] shrink-0" />}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
                      SEVERITAS BUG
                    </label>
                    <select
                      value={bugPriorityInput}
                      onChange={(e) => setBugPriorityInput(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-800"
                    >
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
                      ASSIGNEE DEVELOPER
                    </label>
                    <select
                      value={bugAssigneeInput}
                      onChange={(e) => setBugAssigneeInput(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-800"
                    >
                      <option value="">-- Belum Ditugaskan --</option>
                      {(projectMembers || []).map((m: any, mIdx: number) => (
                        <option key={m.id || m.uid || mIdx} value={m.id || m.uid}>
                          {m.displayName || m.name || m.email || "Member"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
                    DESKRIPSI BUG
                  </label>
                  <textarea
                    rows={5}
                    value={bugDescriptionInput}
                    onChange={(e) => setBugDescriptionInput(e.target.value)}
                    className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-md font-mono text-slate-700 focus:outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateBugModalOpen(false);
                      setBugModalTestCase(null);
                    }}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md uppercase tracking-wider cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingBug || !bugSelectedParentId}
                    className="flex-1 py-3 bg-[#f06548] hover:bg-[#d95338] text-white text-xs font-medium rounded-md uppercase tracking-wider cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                  >
                    <Bug className="w-4 h-4" />
                    <span>{isSubmittingBug ? "Menyimpan Tiket..." : "SIMPAN & TAUTKAN BUG"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. Confirm Delete Suite Modal */}
      <AnimatePresence>
        {suiteToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200/80 rounded-md p-6 max-w-sm w-full shadow-2xl space-y-4 text-center"
            >
              <Trash2 className="w-10 h-10 text-[#f06548] mx-auto" />
              <div>
                <h3 className="text-sm font-medium text-slate-800 uppercase tracking-wider">Hapus Modul Suite</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Apakah Anda yakin ingin menghapus modul <strong>{suiteToDelete.name}</strong>?
                </p>
              </div>
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setSuiteToDelete(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleDeleteSuite(suiteToDelete.id)}
                  className="flex-1 py-2.5 bg-[#f06548] hover:bg-[#d95338] text-white text-xs font-medium rounded-md cursor-pointer shadow-xs transition-colors"
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. Confirm Delete Case Modal */}
      <AnimatePresence>
        {caseToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200/80 rounded-md p-6 max-w-sm w-full shadow-2xl space-y-4 text-center"
            >
              <Trash2 className="w-10 h-10 text-[#f06548] mx-auto" />
              <div>
                <h3 className="text-sm font-medium text-slate-800 uppercase tracking-wider">Hapus Test Case</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Apakah Anda yakin ingin menghapus test case <strong>{caseToDelete.title}</strong>?
                </p>
              </div>
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setCaseToDelete(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleDeleteTestCase(caseToDelete.id)}
                  className="flex-1 py-2.5 bg-[#f06548] hover:bg-[#d95338] text-white text-xs font-medium rounded-md cursor-pointer shadow-xs transition-colors"
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
