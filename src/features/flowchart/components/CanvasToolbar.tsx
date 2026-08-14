/**
 * Bilah kendali melayang di atas kanvas.
 *
 * Kiri: nama diagram aktif, pengalih tema kanvas, dan pengalih snap-to-grid.
 * Kanan: tombol ekspor JPG, backup JSON, dan pengalih panel konfigurasi.
 *
 * Sebelumnya berupa blok JSX di dalam FlowchartContainer. Dipindah verbatim;
 * yang berubah hanya cara ia memperoleh data — dari closure atas state induk
 * menjadi props eksplisit. Tanpa state sendiri.
 */
import React from "react";
import { Workflow, Sun, Moon, LayoutGrid, Download, Database, Activity } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import type { FlowchartData } from "../types";

interface CanvasToolbarProps {
  /** Flowchart yang sedang dibuka; hanya namanya yang ditampilkan. */
  currentFlowMetadata: FlowchartData | undefined;
  canvasTheme: "miro" | "blueprint";
  setCanvasTheme: (value: "miro" | "blueprint") => void;
  isSnapToGrid: boolean;
  setIsSnapToGrid: (value: boolean) => void;
  handleExportJPG: () => void;
  handleExportJSON: () => void;
  isRightSidebarOpen: boolean;
  setIsRightSidebarOpen: (value: boolean) => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  currentFlowMetadata,
  canvasTheme,
  setCanvasTheme,
  isSnapToGrid,
  setIsSnapToGrid,
  handleExportJPG,
  handleExportJSON,
  isRightSidebarOpen,
  setIsRightSidebarOpen,
}) => {
  return (
                  <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
                    <div className="flex items-center gap-3 pointer-events-auto">
                      {/* Active Diagram Name Indicator */}
                      <div className="flex items-center gap-2 bg-white/70 hover:bg-white/85 backdrop-blur-md border border-slate-200/40 px-4 py-1.5 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.06)] pointer-events-auto transition-all duration-300">
                        <div className="p-1.5 bg-violet-50 rounded-lg text-violet-700">
                          <Workflow className="w-3.5 h-3.5 text-violet-600" />
                        </div>
                        <div className="text-left font-sans">
                          <p className="text-[8px] font-medium text-slate-400 uppercase tracking-widest leading-none mb-0.5">Diagram Alur</p>
                          <span className="text-[11px] font-medium text-slate-800 truncate max-w-[150px] block leading-tight">
                            {currentFlowMetadata?.name || "Untitled Workspace"}
                          </span>
                        </div>
                      </div>

                      {/* INTEGRATIVE CANVAS SETTINGS CONTROLS (THEME & SNAPPING) */}
                      <div className="flex items-center gap-2 bg-white/70 hover:bg-white/85 backdrop-blur-md border border-slate-200/40 p-1.5 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all duration-300">
                        {/* Canvas Theme Toggle */}
                        <button
                          onClick={() => {
                            const nextTheme = canvasTheme === "miro" ? "blueprint" : "miro";
                            setCanvasTheme(nextTheme);
                            toast.success(`Tema Kanvas diubah ke: ${nextTheme === "miro" ? "Miro (Terang)" : "Blueprint (Gelap)"}`);
                          }}
                          className={cn(
                            "p-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                            canvasTheme === "miro"
                              ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                              : "bg-blue-950/40 hover:bg-blue-900/40 text-blue-400"
                          )}
                          title={`Ubah Tema Kanvas (Saat ini: ${canvasTheme === "miro" ? "Miro Terang" : "Blueprint Gelap"})`}
                        >
                          {canvasTheme === "miro" ? (
                            <>
                              <Sun className="w-3.5 h-3.5 text-amber-500 fill-amber-200 animate-spin-slow" />
                              <span className="text-[9px] font-medium uppercase tracking-wider hidden sm:inline px-0.5">Miro Theme</span>
                            </>
                          ) : (
                            <>
                              <Moon className="w-3.5 h-3.5 text-blue-400 fill-blue-950" />
                              <span className="text-[9px] font-medium uppercase tracking-wider hidden sm:inline px-0.5">Blueprint Theme</span>
                            </>
                          )}
                        </button>

                        <div className="w-px h-4 bg-slate-200/60" />

                        {/* Snap To Grid Toggle */}
                        <button
                          onClick={() => {
                            const nextSnap = !isSnapToGrid;
                            setIsSnapToGrid(nextSnap);
                            toast.success(`Snap to Grid: ${nextSnap ? "AKTIF" : "NON-AKTIF"}`);
                          }}
                          className={cn(
                            "p-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                            isSnapToGrid
                              ? "bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-100"
                              : "text-slate-400 hover:bg-slate-100"
                          )}
                          title={`Snap to Grid (Saat ini: ${isSnapToGrid ? "Aktif" : "Mati"})`}
                        >
                          <LayoutGrid className={cn("w-3.5 h-3.5", isSnapToGrid ? "text-violet-600" : "text-slate-400")} />
                          <span className="text-[9px] font-medium uppercase tracking-wider hidden sm:inline px-0.5">
                            {isSnapToGrid ? "Snap Grid" : "Free Move"}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* RIGHT SIDE EXPORT & SIDEBAR TOGGLE BUTTONS */}
                    <div className="flex items-center gap-2 pointer-events-auto">
                      <div className="bg-white/70 hover:bg-white/85 backdrop-blur-md border border-slate-200/40 p-1 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.06)] flex items-center gap-1.5 transition-all duration-300">
                        <button
                          onClick={handleExportJPG}
                          className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-[10px] font-medium transition-all cursor-pointer"
                        >
                          <Download className="w-3 h-3" /> Ekspor
                        </button>
                        <button
                          onClick={handleExportJSON}
                          className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-[10px] font-medium transition-all cursor-pointer"
                        >
                          <Database className="w-3 h-3" /> Backup
                        </button>
                      </div>

                      <button
                        onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                        className={cn(
                          "p-2 bg-white/70 hover:bg-white/85 backdrop-blur-md border border-slate-200/40 shadow-[0_8px_24px_rgba(0,0,0,0.06)] rounded-xl transition-all duration-300 cursor-pointer",
                          isRightSidebarOpen ? "bg-violet-600 text-white border-violet-600" : "text-slate-600 hover:text-violet-600"
                        )}
                        title="Toggle Panel Konfigurasi"
                      >
                        <Activity className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
  );
};
