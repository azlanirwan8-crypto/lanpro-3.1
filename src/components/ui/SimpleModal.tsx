import React from "react";
import { X } from "lucide-react";

interface SimpleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const SimpleModal: React.FC<SimpleModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-medium">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-muted rounded-full">
            <X className="w-5 h-5 text-content-muted" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};
