import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Portal } from './Portal';

declare global {
  namespace React.JSX {
    interface IntrinsicElements {
      'lord-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string;
        trigger?: string;
        colors?: string;
        style?: React.CSSProperties;
      }, HTMLElement>;
    }
  }
  namespace JSX {
    interface IntrinsicElements {
      'lord-icon': any;
    }
  }
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  isAlert?: boolean;
  closeOnBackdropClick?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Ya, Hapus!',
  cancelText = 'Batal',
  variant = 'danger',
  isLoading = false,
  isAlert = false,
  closeOnBackdropClick = true
}) => {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const isDeleteAction =
    variant === 'danger' ||
    title.toLowerCase().includes('hapus') ||
    title.toLowerCase().includes('delete') ||
    title.toLowerCase().includes('remove');

  return (
    <AnimatePresence>
      {isOpen && (
        <Portal>
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeOnBackdropClick ? onClose : undefined}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Velzon SweetAlert Modal Window */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="relative bg-white dark:bg-slate-900 rounded-md shadow-2xl w-full max-w-sm border border-slate-200/80 dark:border-slate-800 z-10 p-6 sm:p-8 text-center flex flex-col items-center"
            >
              {/* Top Right Close X Button */}
              <button
                onClick={onClose}
                className="absolute top-3.5 right-3.5 text-[#878a99] hover:text-[#495057] dark:hover:text-slate-200 transition-colors p-1 rounded cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Center Velzon Animated LordIcon */}
              <div className="w-24 h-24 mx-auto mb-1 flex items-center justify-center">
                {isDeleteAction ? (
                  <lord-icon
                    src="https://cdn.lordicon.com/gsqxdxog.json"
                    trigger="loop"
                    colors="primary:#f7b84b,secondary:#f06548"
                    style={{ width: '90px', height: '90px' }}
                  />
                ) : (
                  <lord-icon
                    src="https://cdn.lordicon.com/lupuorrc.json"
                    trigger="loop"
                    colors="primary:#0ab39c,secondary:#405189"
                    style={{ width: '90px', height: '90px' }}
                  />
                )}
              </div>

              {/* Title */}
              <h3 className="text-[1.21875rem] font-semibold text-[#495057] dark:text-[#e9ecef] mb-2 leading-[1.4] tracking-tight text-center">
                {title || 'Apakah Anda Yakin?'}
              </h3>

              {/* Message */}
              <p className="text-[0.9375rem] text-[#878a99] dark:text-[#adb5bd] mb-6 max-w-xs mx-auto leading-relaxed text-center">
                {message}
              </p>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-2 w-full">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={onConfirm}
                  className="min-w-[5rem] px-4 py-2 bg-primary hover:bg-[#364574] text-white font-normal rounded text-[0.8125rem] shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isLoading && (
                    <svg className="animate-spin h-3.5 w-3.5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {confirmText}
                </button>

                {!isAlert && (
                  <button
                    ref={cancelButtonRef}
                    type="button"
                    disabled={isLoading}
                    onClick={onClose}
                    className="min-w-[5rem] px-4 py-2 bg-danger hover:bg-[#d95a40] text-white font-normal rounded text-[0.8125rem] shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {cancelText}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </Portal>
      )}
    </AnimatePresence>
  );
};
