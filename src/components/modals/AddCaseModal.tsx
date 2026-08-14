import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus, XCircle, Upload, Download
} from "lucide-react";
import { QATestSuite } from "../../features/qa/types";

interface AddCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSuite: QATestSuite | null;
  activeTab: "single" | "bulk";
  onTabChange: (tab: "single" | "bulk") => void;

  // Single input state
  caseTitle: string;
  onTitleChange: (title: string) => void;
  casePriority: "High" | "Medium" | "Low" | "Critical";
  onPriorityChange: (priority: "High" | "Medium" | "Low" | "Critical") => void;
  caseAssignedTo: string;
  onAssignedToChange: (assignedTo: string) => void;
  caseSteps: string;
  onStepsChange: (steps: string) => void;
  caseExpected: string;
  onExpectedChange: (expected: string) => void;
  onSubmitSingle: (e: React.FormEvent) => void;

  // Bulk upload state
  uploadFile: File | null;
  onFileChange: (file: File | null) => void;
  onSubmitBulk: (e: React.FormEvent) => void;
  onDownloadTemplate: () => void;
}

export const AddCaseModal: React.FC<AddCaseModalProps> = ({
  isOpen,
  onClose,
  activeSuite,
  activeTab,
  onTabChange,
  caseTitle,
  onTitleChange,
  casePriority,
  onPriorityChange,
  caseAssignedTo,
  onAssignedToChange,
  caseSteps,
  onStepsChange,
  caseExpected,
  onExpectedChange,
  onSubmitSingle,
  uploadFile,
  onFileChange,
  onSubmitBulk,
  onDownloadTemplate,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => onTabChange("single")}
              className={`flex-1 py-2 text-xs font-medium uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                activeTab === "single"
                  ? "bg-white text-[#405189] shadow-xs border border-slate-200/80"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Single Input (Manual)
            </button>
            <button
              type="button"
              onClick={() => onTabChange("bulk")}
              className={`flex-1 py-2 text-xs font-medium uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                activeTab === "bulk"
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
              Modul Target: <strong>{activeSuite ? activeSuite.name : "Belum ada modul terpilih"}</strong>
            </span>
            <span className="px-2.5 py-0.5 bg-[#405189] text-white font-medium rounded-full text-[10px]">
              {activeSuite ? activeSuite.phase : "SIT"}
            </span>
          </div>

          {/* Single Input Tab */}
          {activeTab === "single" ? (
            <form onSubmit={onSubmitSingle} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[calc(100vh-320px)] overflow-y-auto pr-1 custom-scrollbar">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block">
                      Judul Test Case *
                    </label>
                    <input
                      type="text"
                      required
                      value={caseTitle}
                      onChange={(e) => onTitleChange(e.target.value)}
                      placeholder="Masukkan judul skenario pengujian..."
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md focus:border-[#405189] focus:outline-none font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block">
                      Tingkat Prioritas *
                    </label>
                    <select
                      value={casePriority}
                      onChange={(e) => onPriorityChange(e.target.value as any)}
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
                      value={caseSteps}
                      onChange={(e) => onStepsChange(e.target.value)}
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
                      value={caseExpected}
                      onChange={(e) => onExpectedChange(e.target.value)}
                      placeholder="Tuliskan ekspektasi hasil akhir..."
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md focus:border-[#405189] focus:outline-none font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
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
            // Bulk Upload Tab
            <form onSubmit={onSubmitBulk} className="space-y-4">
              {/* Download Template Banner */}
              <div className="flex items-center justify-between bg-indigo-50/60 border border-indigo-100 p-3 rounded-md">
                <div>
                  <h4 className="text-xs font-medium text-[#405189]">Butuh Berkas Template Excel?</h4>
                  <p className="text-[10px] text-slate-500 font-medium">Unduh contoh struktur kolom resmi</p>
                </div>
                <button
                  type="button"
                  onClick={onDownloadTemplate}
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
                  onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                  className="hidden"
                  id="bulk_upload_input"
                />
                <label
                  htmlFor="bulk_upload_input"
                  className="inline-block px-4 py-2 bg-[#405189]/10 hover:bg-[#405189]/20 text-[#405189] text-xs font-medium rounded-md cursor-pointer transition-colors"
                >
                  {uploadFile ? uploadFile.name : "Pilih Berkas Excel"}
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium uppercase tracking-wider rounded-md cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile}
                  className="px-5 py-2 bg-[#405189] hover:bg-[#354473] text-white text-xs font-medium uppercase tracking-wider rounded-md shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  Proses Bulk Upload
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
