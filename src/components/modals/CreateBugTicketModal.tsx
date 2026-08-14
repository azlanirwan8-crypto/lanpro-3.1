import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  XCircle, Search, CheckCircle2, Bug, ChevronDown
} from "lucide-react";
import { QATestCase } from "../../features/qa/types";

interface CreateBugTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  testCase: QATestCase | null;

  // Form state
  titleInput: string;
  onTitleChange: (title: string) => void;
  selectedParentId: string;
  onParentSelect: (parentId: string) => void;
  parentSearchTerm: string;
  onSearchTermChange: (term: string) => void;
  priorityInput: string;
  onPriorityChange: (priority: string) => void;
  assigneeInput: string;
  onAssigneeChange: (assignee: string) => void;
  descriptionInput: string;
  onDescriptionChange: (desc: string) => void;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;

  // Context data
  tasks: any[];
  projectMembers: any[];
  selectedProject: any;
}

export const CreateBugTicketModal: React.FC<CreateBugTicketModalProps> = ({
  isOpen,
  onClose,
  testCase,
  titleInput,
  onTitleChange,
  selectedParentId,
  onParentSelect,
  parentSearchTerm,
  onSearchTermChange,
  priorityInput,
  onPriorityChange,
  assigneeInput,
  onAssigneeChange,
  descriptionInput,
  onDescriptionChange,
  isSubmitting,
  onSubmit,
  tasks,
  projectMembers,
  selectedProject,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
  const selectedParentTask = parentCandidates.find((pt: any) => pt.id === selectedParentId);

  if (!isOpen || !testCase) return null;

  return (
    <AnimatePresence>
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
                  Dibuat dari Test Case #{testCase.rowNum}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
                JUDUL TIKET BUG *
              </label>
              <input
                type="text"
                required
                value={titleInput}
                onChange={(e) => onTitleChange(e.target.value)}
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-800 focus:border-[#405189] focus:outline-none"
              />
            </div>

            {/* Parent Task Searchable Combobox */}
            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-medium text-[#f06548] uppercase tracking-wider block">
                TARGET EPIC / TASK UTAMA (PARENT * MANDATORY)
              </label>

              <div
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-800 flex items-center justify-between cursor-pointer hover:border-[#405189]"
              >
                <span className="truncate">
                  {selectedParentTask
                    ? `[${selectedParentTask.key || selectedParentTask.taskKey || "TASK"}] ${selectedParentTask.title}`
                    : "-- Pilih Target Epic / Task Utama --"}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              </div>

              {isDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="relative mb-2">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Cari nama Epic atau Task..."
                        value={parentSearchTerm}
                        onChange={(e) => onSearchTermChange(e.target.value)}
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
                              onParentSelect(pt.id);
                              setIsDropdownOpen(false);
                            }}
                            className={`p-2.5 text-xs font-medium flex items-center justify-between cursor-pointer transition-colors ${
                              selectedParentId === pt.id
                                ? "bg-rose-50/70 text-[#f06548]"
                                : "hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <span className="truncate">
                              [{pt.key || pt.taskKey || (pt.type ? pt.type.toUpperCase() : "TASK")}] {pt.title}
                            </span>
                            {selectedParentId === pt.id && <CheckCircle2 className="w-4 h-4 text-[#f06548] shrink-0" />}
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
                  value={priorityInput}
                  onChange={(e) => onPriorityChange(e.target.value)}
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
                  value={assigneeInput}
                  onChange={(e) => onAssigneeChange(e.target.value)}
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
                value={descriptionInput}
                onChange={(e) => onDescriptionChange(e.target.value)}
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-md font-mono text-slate-700 focus:outline-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md uppercase tracking-wider cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedParentId}
                className="flex-1 py-3 bg-[#f06548] hover:bg-[#d95338] text-white text-xs font-medium rounded-md uppercase tracking-wider cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
              >
                <Bug className="w-4 h-4" />
                <span>{isSubmitting ? "Menyimpan Tiket..." : "SIMPAN & TAUTKAN BUG"}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
