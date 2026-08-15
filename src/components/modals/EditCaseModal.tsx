import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { QATestCase } from "../../features/qa/types";

interface EditCaseModalProps {
  testCase: QATestCase | null;
  onClose: () => void;
  editTitle: string;
  onTitleChange: (title: string) => void;
  editSteps: string;
  onStepsChange: (steps: string) => void;
  editExpected: string;
  onExpectedChange: (expected: string) => void;
  editPriority: "High" | "Medium" | "Low" | "Critical";
  onPriorityChange: (priority: "High" | "Medium" | "Low" | "Critical") => void;
  editAssignedTo: string;
  onAssignedToChange: (assignedTo: string) => void;
  onSubmit: () => void;
}

export const EditCaseModal: React.FC<EditCaseModalProps> = ({
  testCase,
  onClose,
  editTitle,
  onTitleChange,
  editSteps,
  onStepsChange,
  editExpected,
  onExpectedChange,
  editPriority,
  onPriorityChange,
  editAssignedTo,
  onAssignedToChange,
  onSubmit,
}) => {
  if (!testCase) return null;

  return (
    <AnimatePresence>
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
                value={editTitle}
                onChange={(e) => onTitleChange(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Prioritas</label>
              <select
                value={editPriority}
                onChange={(e) => onPriorityChange(e.target.value as any)}
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
                value={editSteps}
                onChange={(e) => onStepsChange(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Hasil yang Diharapkan</label>
              <textarea
                rows={2}
                value={editExpected}
                onChange={(e) => onExpectedChange(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-800"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-medium rounded-md cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={onSubmit}
              className="px-4 py-2 bg-primary text-white text-xs font-medium rounded-md cursor-pointer shadow-xs active:scale-95"
            >
              Simpan Perubahan
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
