import React from "react";

interface TextAreaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const TextAreaField: React.FC<TextAreaFieldProps> = ({
  label,
  error,
  helperText,
  required,
  className = "",
  rows = 3,
  ...props
}) => {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-xs sm:text-[10px] text-content-body font-medium block uppercase tracking-wider">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        rows={rows}
        {...props}
        className={`w-full text-xs p-2.5 bg-surface-sunken border border-border-subtle rounded-md focus:border-primary focus:outline-none font-medium text-content-strong resize-none transition-all ${
          error ? "border-red-300 focus:border-red-400" : ""
        } ${className}`}
      />
      {error && <p className="text-xs sm:text-[10px] text-red-600 font-medium">{error}</p>}
      {helperText && !error && <p className="text-xs sm:text-[10px] text-content-muted">{helperText}</p>}
    </div>
  );
};
