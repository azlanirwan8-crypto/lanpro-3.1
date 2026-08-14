import React from "react";

interface FormLayoutProps {
  children: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  layout?: "single" | "grid" | "vertical";
  gap?: string;
  className?: string;
}

export const FormLayout: React.FC<FormLayoutProps> = ({
  children,
  onSubmit,
  layout = "vertical",
  gap = "gap-4",
  className = "",
}) => {
  const layoutClasses = {
    single: "flex flex-col",
    grid: "grid grid-cols-1 md:grid-cols-2",
    vertical: "flex flex-col",
  };

  return (
    <form onSubmit={onSubmit} className={`${layoutClasses[layout]} ${gap} ${className}`}>
      {children}
    </form>
  );
};

interface FormSectionProps {
  children: React.ReactNode;
  className?: string;
}

export const FormSection: React.FC<FormSectionProps> = ({ children, className = "" }) => (
  <div className={`space-y-4 ${className}`}>{children}</div>
);

interface FormActionsProps {
  onCancel?: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
}

export const FormActions: React.FC<FormActionsProps> = ({
  onCancel,
  onSubmit,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  isPending = false,
}) => (
  <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
    <button
      type="button"
      onClick={onCancel}
      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md cursor-pointer transition-all"
    >
      {cancelLabel}
    </button>
    <button
      type="submit"
      onClick={onSubmit}
      disabled={isPending}
      className="px-4 py-2 bg-[#405189] hover:bg-[#354473] text-white text-xs font-medium rounded-md cursor-pointer shadow-xs disabled:opacity-50 transition-all"
    >
      {isPending ? "Saving..." : submitLabel}
    </button>
  </div>
);
