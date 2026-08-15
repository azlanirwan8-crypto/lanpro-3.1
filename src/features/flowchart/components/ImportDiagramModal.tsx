/**
 * Dialog impor diagram: Draw.io (XML), Miro (JSON/CSV), dan format cadangan
 * bawaan aplikasi.
 *
 * Sebelumnya berupa blok JSX di dalam FlowchartContainer. Dipindah verbatim;
 * yang berubah hanya cara ia memperoleh data — dari closure atas state induk
 * menjadi props eksplisit.
 *
 * Pasangannya di lapisan lain: parser yang mengubah isi berkas menjadi node dan
 * edge ada di `lib/importers.ts`, sedangkan komponen ini hanya mengurus
 * tampilan dan interaksi. Berkasnya sendiri dibaca oleh `handleProcessImportFile`
 * di container, karena ia perlu menulis ke state hasil parse.
 */
import React from "react";
import { Upload, X } from "lucide-react";
import { cn } from "../../../lib/utils";

/** Bentuk hasil parse yang ditampilkan sebagai ringkasan sebelum diterapkan. */
type ParsedImportData = { nodes: any[]; edges: any[] } | null;

interface ImportDiagramModalProps {
  isImportModalOpen: boolean;
  setIsImportModalOpen: (value: boolean) => void;
  /** Format asal yang sedang dipilih; menentukan petunjuk dan ekstensi yang diterima. */
  importType: "native" | "drawio" | "miro";
  setImportType: (value: "native" | "drawio" | "miro") => void;
  parsedImportData: ParsedImportData;
  setParsedImportData: (value: ParsedImportData) => void;
  parsedFilename: string;
  setParsedFilename: (value: string) => void;
  dragOverImport: boolean;
  setDragOverImport: (value: boolean) => void;
  /** Membaca berkas lalu mengisi parsedImportData. Tinggal di container. */
  handleProcessImportFile: (file: File) => void;
  /** Menambahkan hasil impor ke kanvas yang sudah ada. */
  handleApplyImportMerge: () => void;
  /** Mengganti seluruh isi kanvas dengan hasil impor. */
  handleApplyImportReplace: () => void;
}

export const ImportDiagramModal: React.FC<ImportDiagramModalProps> = ({
  isImportModalOpen,
  setIsImportModalOpen,
  importType,
  setImportType,
  parsedImportData,
  setParsedImportData,
  parsedFilename,
  setParsedFilename,
  dragOverImport,
  setDragOverImport,
  handleProcessImportFile,
  handleApplyImportMerge,
  handleApplyImportReplace,
}) => {
  if (!isImportModalOpen) return null;

  return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
          <div className="bg-white border border-slate-200 w-full max-w-xl rounded-xl shadow-xl overflow-hidden flex flex-col text-slate-800 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]">

            {/* Modal Head */}
            <div className="px-5 py-4 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <h3 className="font-medium text-sm text-slate-900">
                  Integrasi & Impor File Alur Kerja
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setParsedImportData(null);
                }}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-all active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              {/* Platforms Option Slider */}
              <div className="grid grid-cols-3 gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setImportType("drawio");
                    setParsedImportData(null);
                    setParsedFilename("");
                  }}
                  className={cn(
                    "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5",
                    importType === "drawio"
                      ? "bg-orange-50/70 border-orange-200 text-orange-800 ring-2 ring-orange-500/20 font-medium"
                      : "border-slate-200 hover:bg-slate-50 text-slate-605 hover:border-slate-300 font-medium"
                  )}
                >
                  <span className="text-xl">📊</span>
                  <div className="text-[10px] font-medium uppercase tracking-wider">Draw.io / XML</div>
                  <div className="text-[9px] text-slate-500 font-medium">File .xml / .drawio</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setImportType("miro");
                    setParsedImportData(null);
                    setParsedFilename("");
                  }}
                  className={cn(
                    "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5",
                    importType === "miro"
                      ? "bg-amber-50/70 border-amber-200 text-amber-800 ring-2 ring-amber-500/20 font-medium"
                      : "border-slate-200 hover:bg-slate-50 text-slate-605 hover:border-slate-300 font-medium"
                  )}
                >
                  <span className="text-xl">🟡</span>
                  <div className="text-[10px] font-medium uppercase tracking-wider">Miro Board</div>
                  <div className="text-[9px] text-slate-500 font-medium">Miro .json / .csv</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setImportType("native");
                    setParsedImportData(null);
                    setParsedFilename("");
                  }}
                  className={cn(
                    "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5",
                    importType === "native"
                      ? "bg-indigo-50/70 border-indigo-200 text-indigo-800 ring-2 ring-indigo-500/20 font-medium"
                      : "border-slate-200 hover:bg-slate-50 text-slate-605 hover:border-slate-300 font-medium"
                  )}
                >
                  <span className="text-xl">🔮</span>
                  <div className="text-[10px] font-medium uppercase tracking-wider">Format Cadangan</div>
                  <div className="text-[9px] text-slate-500 font-medium">Bawaan File .json</div>
                </button>
              </div>

              {/* Guidelines helper text */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] leading-relaxed text-slate-550">
                {importType === "drawio" && (
                  <p>
                    💡 <strong>Petunjuk Draw.io</strong>: Anda dapat mengekspor diagram dari Draw.io sebagai berkas <strong>XML Terkompresi maupun Mentah (.xml / .drawio)</strong>. Sistem kami secara otomatis mengonversi bentuk dasar, warna, label, serta garis penghubung agar kompatibel di whiteboard.
                  </p>
                )}
                {importType === "miro" && (
                  <p>
                    💡 <strong>Petunjuk Miro</strong>: Ekspor papan Miro Anda dalam format <strong>JSON</strong> atau <strong>Metadata CSV</strong>. Bentuk geometri, koordinat posisi, teks konten, serta panah logic (connectors) akan dipetakan secara cerdas ke bentuk alur whiteboard.
                  </p>
                )}
                {importType === "native" && (
                  <p>
                    💡 <strong>Petunjuk Format Cadangan</strong>: Unggah file backup ruang kerja berformat <strong>JSON</strong> yang diunduh dari aplikasi ini untuk memulihkan keseluruhan kondisi kanvas (bentuk, relasi, tema, dan status).
                  </p>
                )}
              </div>

              {/* Drag and Drop Box */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverImport(true);
                }}
                onDragLeave={() => setDragOverImport(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverImport(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleProcessImportFile(file);
                }}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  if (importType === "drawio") {
                    input.accept = ".xml, .drawio";
                  } else if (importType === "miro") {
                    input.accept = ".json, .csv";
                  } else {
                    input.accept = ".json";
                  }
                  input.onchange = (ev) => {
                    const file = (ev.target as HTMLInputElement).files?.[0];
                    if (file) handleProcessImportFile(file);
                  };
                  input.click();
                }}
                className={cn(
                  "border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 min-h-[140px]",
                  dragOverImport
                    ? "border-violet-500 bg-violet-50 text-violet-700"
                    : parsedImportData
                    ? "border-emerald-300 bg-emerald-50/10 text-emerald-800 animate-pulse"
                    : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50 text-slate-500 font-medium"
                )}
              >
                {parsedImportData ? (
                  <span className="text-3xl animate-bounce">📦</span>
                ) : (
                  <Upload className="w-8 h-8 text-slate-300" />
                )}

                <div className="text-center font-medium font-sans">
                  {parsedImportData ? (
                    <span className="text-emerald-700 text-[11px] uppercase tracking-wider font-medium block mb-1">Struktur File Berhasil Dimuat!</span>
                  ) : (
                    <span>Tarik & lepas file di sini atau klik untuk memilih file</span>
                  )}
                  {parsedFilename && (
                    <span className="text-[10px] text-slate-600 font-mono block mt-2 bg-slate-100 p-1 px-2.5 rounded-lg border border-slate-200 inline-block">
                      📎 {parsedFilename}
                    </span>
                  )}
                </div>

                {!parsedImportData && (
                  <p className="text-[9px] text-slate-400 font-medium">
                    Mendukung ekstensi {importType === "drawio" ? ".xml, .drawio" : importType === "miro" ? ".json, .csv" : ".json"}
                  </p>
                )}
              </div>

              {/* Analytical preview result of parser */}
              {parsedImportData && (
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-2 text-[11px] animate-fade-in text-emerald-900 leading-relaxed font-sans font-medium">
                  <span className="font-medium uppercase tracking-widest text-[9.5px] text-emerald-800 flex items-center gap-1.5 shadow-sm bg-white p-1 px-2.5 w-fit rounded-full border border-emerald-100">
                    🔍 Ulasan Kesiapan Diagram
                  </span>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-200 flex items-center gap-2 shadow-inner">
                      <span className="text-xl">🛠️</span>
                      <div>
                        <div className="font-medium text-slate-900 text-xs">{parsedImportData.nodes.length}</div>
                        <div className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">Bentuk & Ornamen (Nodes)</div>
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-emerald-200 flex items-center gap-2 shadow-inner">
                      <span className="text-xl">🖧</span>
                      <div>
                        <div className="font-medium text-slate-900 text-xs">{parsedImportData.edges.length}</div>
                        <div className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">Anak Panah Penghubung (Edges)</div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-emerald-700 italic pt-1 font-medium leading-relaxed">
                    Kesiapan 105%: Semua komponen berhasil dipetakan ke logic element whiteboard. Silakan klik salah satu tombol di bawah untuk mengaplikasikan.
                  </p>
                </div>
              )}

            </div>

            {/* Modal Actions */}
            <div className="p-4 px-5 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setParsedImportData(null);
                }}
                className="p-2 px-4 rounded-xl bg-slate-200/80 hover:bg-slate-300 font-medium border border-slate-300 text-slate-600 hover:text-slate-800 transition-all text-[11px] active:scale-95"
              >
                Tutup
              </button>

              {parsedImportData ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApplyImportMerge}
                    className="p-2 px-3 bg-white hover:bg-indigo-50 border border-indigo-200 hover:border-indigo-300 text-indigo-700 hover:text-indigo-900 font-medium rounded-xl transition-all text-[11px] shadow-sm flex items-center gap-1 active:scale-95"
                  >
                    <span>➕ Gabungkan ke Kanvas</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyImportReplace}
                    className="p-2 px-4 bg-gradient-to-tr from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium rounded-xl transition-all text-[11px] shadow-sm flex items-center gap-1 active:scale-95"
                  >
                    <span>🔥 Ganti Kanvas Aktif</span>
                  </button>
                </div>
              ) : (
                <div className="text-[10px] text-slate-400 italic font-medium">Silakan tarik / pilih diagram di atas</div>
              )}
            </div>
          </div>
        </div>
  );
};
