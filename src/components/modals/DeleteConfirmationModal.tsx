import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trash2 } from "lucide-react";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  itemName: string;
  onConfirm: () => void;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  title,
  itemName,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-surface border border-border-subtle/80 rounded-md p-6 max-w-sm w-full shadow-2xl space-y-4 text-center"
        >
          <Trash2 className="w-10 h-10 text-danger mx-auto" />
          <div>
            <h3 className="text-sm font-medium text-content-strong uppercase tracking-wider">{title}</h3>
            <p className="text-xs text-content-muted mt-1">
              Apakah Anda yakin ingin menghapus <strong>{itemName}</strong>?
            </p>
          </div>
          <div className="flex gap-2.5 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-surface-muted hover:bg-slate-200 text-content-body text-xs font-medium rounded-md cursor-pointer transition-colors"
            >
              Batal
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2.5 bg-danger hover:bg-[#d95338] text-white text-xs font-medium rounded-md cursor-pointer shadow-xs transition-colors"
            >
              Ya, Hapus
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
