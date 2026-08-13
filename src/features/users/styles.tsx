import React from 'react';
import { motion } from 'motion/react';
import { X, Users } from 'lucide-react';
import { UserProfile } from '../../types';

export const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, size = 'md' }: any) => {
  const baseStyle = "inline-flex items-center justify-center font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed outline-none";
  let variantStyle = "";
  if (variant === 'primary') variantStyle = "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-md shadow-indigo-600/20";
  if (variant === 'secondary') variantStyle = "bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95";
  if (variant === 'outline') variantStyle = "border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 active:scale-95";
  if (variant === 'danger') variantStyle = "bg-rose-500 text-white hover:bg-rose-600 active:scale-95 shadow-md shadow-rose-500/20";
  if (variant === 'ghost') variantStyle = "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-95";
  
  let sizeStyle = "";
  if (size === 'sm') sizeStyle = "px-3 py-1 text-xs rounded-md";
  if (size === 'md') sizeStyle = "px-3.5 py-1.5 text-xs font-medium rounded-md";
  if (size === 'lg') sizeStyle = "px-4 py-2 text-sm font-medium rounded-md";

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variantStyle} ${sizeStyle} ${className}`}>
      {children}
    </button>
  );
};

export const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className={`bg-white dark:bg-slate-900 rounded-lg shadow-xl relative z-10 w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800`}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <h3 className="font-medium text-sm text-slate-800 dark:text-slate-100 tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-slate-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto overflow-x-hidden flex-1 custom-scrollbar relative">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

import { UserAvatar } from '../../components/ui/UserAvatar';
export { UserAvatar };
