import React from "react";

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
  required?: boolean;
  placeholder?: string;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  options,
  error,
  helperText,
  required,
  placeholder,
  className = "",
  ...props
}) => {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-xs sm:text-[10px] text-slate-700 font-medium block uppercase tracking-wider">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        {...props}
        className={`w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md focus:border-primary focus:outline-none font-medium text-slate-800 cursor-pointer transition-all ${
          error ? "border-red-300 focus:border-red-400" : ""
        } ${className}`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs sm:text-[10px] text-red-600 font-medium">{error}</p>}
      {helperText && !error && <p className="text-xs sm:text-[10px] text-slate-500">{helperText}</p>}
    </div>
  );
};
