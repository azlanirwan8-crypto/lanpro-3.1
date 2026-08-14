import React from "react";
import { Upload } from "lucide-react";

interface FileUploadFieldProps {
  label?: string;
  accept?: string;
  onChange: (file: File | null) => void;
  file: File | null;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const FileUploadField: React.FC<FileUploadFieldProps> = ({
  label,
  accept = "*",
  onChange,
  file,
  error,
  helperText,
  required,
}) => {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-[10px] text-slate-700 font-medium block uppercase tracking-wider">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="border-2 border-dashed border-slate-200 hover:border-[#405189] rounded-md p-8 text-center space-y-3 transition-colors bg-slate-50/50 cursor-pointer">
        <Upload className="w-10 h-10 text-[#405189] mx-auto" />
        <div>
          <p className="text-xs font-medium text-slate-700">Upload file</p>
          {helperText && <p className="text-[10px] text-slate-400 mt-1">{helperText}</p>}
        </div>
        <input
          type="file"
          accept={accept}
          onChange={(e) => onChange(e.target.files?.[0] || null)}
          className="hidden"
          id="file_upload_input"
        />
        <label
          htmlFor="file_upload_input"
          className="inline-block px-4 py-2 bg-[#405189]/10 hover:bg-[#405189]/20 text-[#405189] text-xs font-medium rounded-md cursor-pointer transition-colors"
        >
          {file ? file.name : "Choose File"}
        </label>
      </div>
      {error && <p className="text-[10px] text-red-600 font-medium">{error}</p>}
    </div>
  );
};
