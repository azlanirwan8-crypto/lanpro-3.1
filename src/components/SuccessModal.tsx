import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
}

export function SuccessModal({ isOpen, onClose, title = "Berhasil!", message }: SuccessModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-surface rounded-lg shadow-xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-4 flex justify-end">
              <button
                onClick={onClose}
                className="text-content-subtle hover:text-content-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 pt-0 flex flex-col items-center text-center">
              <div className="mb-6 relative">
                {/* Simplified party popper svg representation if Lucide is not exact, but we'll use a custom SVG to closely match the image */}
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 64 64"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M19 44L28 17L44 32L19 44Z"
                    stroke="#0EA5E9"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M28 17C28 17 38 22 44 32"
                    stroke="#0EA5E9"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path d="M26 12L28 13" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
                  <path d="M37 10L39 10" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
                  <path d="M49 20L50 22" stroke="#4F46E5" strokeWidth="3" strokeLinecap="round" />
                  <path d="M36 21L33 25" stroke="#4F46E5" strokeWidth="3" strokeLinecap="round" />
                  <path d="M37 32L39 34" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
                  <path d="M32 18L33 16" stroke="#4F46E5" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
              <h2 className="text-xl font-medium text-content mb-2">{title}</h2>
              <p className="text-content-muted mb-8">{message}</p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-[#425287] hover:bg-[#34416a] text-white font-medium rounded-md transition-colors"
              >
                Tutup
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
