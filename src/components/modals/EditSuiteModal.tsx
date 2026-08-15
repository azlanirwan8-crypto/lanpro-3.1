import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { QATestSuite } from "../../features/qa/types";

interface EditSuiteModalProps {
  suite: QATestSuite | null;
  onClose: () => void;
  editName: string;
  onNameChange: (name: string) => void;
  editAssignedTo: string;
  onAssignedToChange: (assignedTo: string) => void;
  onSubmit: () => void;
}

export const EditSuiteModal: React.FC<EditSuiteModalProps> = ({
  suite,
  onClose,
  editName,
  onNameChange,
  editAssignedTo,
  onAssignedToChange,
  onSubmit,
}) => {
  if (!suite) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-surface border border-border-subtle/80 rounded-md p-6 max-w-sm w-full shadow-2xl space-y-4"
        >
          <h3 className="text-sm font-medium text-content-strong uppercase tracking-wider">Ubah Info Dokumen Suite</h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs sm:text-[10px] font-medium text-content-subtle uppercase tracking-wider block">Nama Dokumen</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => onNameChange(e.target.value)}
                className="w-full text-xs p-2.5 bg-surface-sunken border border-border-subtle rounded-md font-medium text-content-strong"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-surface-muted text-content-secondary text-xs font-medium rounded-md cursor-pointer"
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
