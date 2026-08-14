/**
 * Koleksi bentuk diagram: tombol pemicu di toolbar dan panel yang muncul.
 *
 * Sebelumnya berupa blok JSX di dalam FlowchartContainer. Dipindah verbatim;
 * yang berubah hanya cara ia memperoleh data — dari closure atas state induk
 * menjadi props eksplisit.
 *
 * Tanpa state sendiri. Pencarian, warna default, dan grup mana yang terbuka
 * semuanya tinggal di useFlowchartUI, tempat state itu memang berada.
 */
import React from "react";
import { Layers, ChevronDown, X, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import { DIAGRAM_SHAPE_GROUPS } from "../constants";
import { renderMiniPreviewIcon } from "../lib/shapes";
import type { FlowNode } from "../types";

interface ShapePaletteProps {
  isShapeDropdownOpen: boolean;
  setIsShapeDropdownOpen: (value: boolean) => void;
  /** Warna yang dipakai untuk setiap bentuk baru yang ditambahkan. */
  selectedAddColor: string;
  setSelectedAddColor: (value: string) => void;
  /** Kata kunci penyaring bentuk. Saat terisi, semua grup dipaksa terbuka. */
  shapeSearchQuery: string;
  setShapeSearchQuery: (value: string) => void;
  expandedGroups: Record<string, boolean>;
  toggleGroupExpanded: (title: string) => void;
  handleAddNewNode: (type: FlowNode["type"], customColor?: string) => void;
}

export const ShapePalette: React.FC<ShapePaletteProps> = ({
  isShapeDropdownOpen,
  setIsShapeDropdownOpen,
  selectedAddColor,
  setSelectedAddColor,
  shapeSearchQuery,
  setShapeSearchQuery,
  expandedGroups,
  toggleGroupExpanded,
  handleAddNewNode,
}) => {
  return (
            <div className="relative font-sans">
              <button
                onClick={() => setIsShapeDropdownOpen(!isShapeDropdownOpen)}
                className={cn(
                  "p-2 rounded-lg transition-all flex flex-col items-center w-10 border border-slate-100",
                  isShapeDropdownOpen ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "text-slate-650 hover:bg-slate-100"
                )}
                title="Buka Koleksi Simbol"
              >
                <Layers className="w-4 h-4" />
                <span className="text-[7.5px] font-medium uppercase tracking-tight text-indigo-600 mt-0.5 flex items-center">Shapes <ChevronDown className="w-2 h-2 ml-0.5" /></span>
              </button>

              {isShapeDropdownOpen && (
                <div className="absolute left-14 top-0 w-80 bg-white/85 backdrop-blur-lg border border-slate-200/40 shadow-[0_12px_40px_rgba(0,0,0,0.12)] rounded-xl z-40 flex flex-col h-[calc(100vh-160px)] max-h-[640px] overflow-hidden select-none">
                  {/* Panel Header */}
                  <div className="p-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <div className="p-1 px-1.5 bg-indigo-100 rounded text-indigo-700">
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-medium text-slate-800 uppercase tracking-tight">Diagramming shapes</span>
                    </div>
                    <button
                      onClick={() => setIsShapeDropdownOpen(false)}
                      className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Preset Colors Bar */}
                  <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50/20 flex items-center justify-between shrink-0">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Warna Default:</span>
                    <div className="flex items-center gap-1">
                      {["yellow", "blue", "green", "purple", "rose", "sky", "slate"].map(colName => {
                        const colorClassMap: Record<string, string> = {
                          yellow: "bg-amber-300 border-amber-400",
                          blue: "bg-blue-300 border-blue-400",
                          green: "bg-emerald-350 border-emerald-400",
                          purple: "bg-purple-300 border-purple-400",
                          rose: "bg-rose-300 border-rose-400",
                          sky: "bg-sky-300 border-sky-400",
                          slate: "bg-slate-300 border-slate-400"
                        };
                        return (
                          <button
                            key={colName}
                            onClick={() => {
                              setSelectedAddColor(colName);
                              toast.info(`Warna default bentuk baru diset ke ${colName.toUpperCase()}`);
                            }}
                            className={cn(
                              "w-3.5 h-3.5 rounded-full border transition-all active:scale-75",
                              colorClassMap[colName] || "bg-indigo-300",
                              selectedAddColor === colName ? "ring-2 ring-indigo-500 ring-offset-1 scale-110 border-indigo-650" : "border-black/5"
                            )}
                            title={`Mulai dengan warna ${colName}`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="p-3 border-b border-slate-100 shrink-0">
                    <div className="relative font-sans">
                      <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Cari bentuk (e.g. DBA, flow...)"
                        value={shapeSearchQuery}
                        onChange={(e) => setShapeSearchQuery(e.target.value)}
                        className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-1.5 pl-7 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:bg-white transition-all"
                      />
                      {shapeSearchQuery && (
                        <button
                          onClick={() => setShapeSearchQuery("")}
                          className="absolute right-2.5 top-2.5 text-[10px] text-slate-400 hover:text-slate-650"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Categorized Scrollable Shapes */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                    {DIAGRAM_SHAPE_GROUPS.map((group, groupIdx) => {
                      const filteredItems = group.items.filter(item =>
                        item.name.toLowerCase().includes(shapeSearchQuery.toLowerCase()) ||
                        (item.desc && item.desc.toLowerCase().includes(shapeSearchQuery.toLowerCase()))
                      );

                      if (filteredItems.length === 0) return null;

                      const isExpanded = shapeSearchQuery.trim() !== "" ? true : !!expandedGroups[group.title];

                      return (
                        <div key={groupIdx} className="border-b border-slate-100/65 pb-2.5 last:border-b-0 space-y-1 fallback-accordion">
                          {/* Collapsible Accordion Header */}
                          <button
                            onClick={() => toggleGroupExpanded(group.title)}
                            disabled={shapeSearchQuery.trim() !== ""}
                            className="w-full flex items-center justify-between text-left py-1.5 hover:bg-slate-50/70 p-1 rounded-lg transition-colors group"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-medium text-slate-800 uppercase tracking-widest font-mono">
                                {group.title}
                              </span>
                              {(group.title === "AWS" || group.title === "UML" || group.title === "My Shapes") && (
                                <span className="text-[7.5px] bg-indigo-50 text-indigo-600 font-medium px-1 py-[1px] rounded border border-indigo-100 flex items-center gap-0.5 leading-none">
                                  FREE
                                </span>
                              )}
                            </div>

                            {/* Collapse/Expand indicator */}
                            {shapeSearchQuery.trim() === "" && (
                              <div className="p-0.5 rounded text-slate-400 group-hover:text-slate-600 group-hover:bg-slate-100 transition-colors">
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                  <svg className="w-3.5 h-3.5 transform -rotate-90 transition-transform duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                    <path d="M19 9l-7 7-7-7" />
                                  </svg>
                                )}
                              </div>
                            )}
                          </button>

                          {/* Expanded Content Grid */}
                          {isExpanded && (
                            <div className="grid grid-cols-2 gap-1.5 mt-1.5 px-0.5 transition-all">
                              {filteredItems.map((item) => (
                                <button
                                  key={item.type}
                                  onClick={() => handleAddNewNode(item.type as FlowNode["type"], selectedAddColor)}
                                  className="flex items-center gap-2 p-1.5 bg-white hover:bg-indigo-50/5 border border-slate-100 hover:border-indigo-200 hover:shadow-[0_2px_8px_rgba(99,102,241,0.06)] text-left rounded-xl transition-all group pointer-events-auto w-full"
                                  title={`Tambahkan ${item.name} ke canvas`}
                                >
                                  <div className="w-8 h-8 flex items-center justify-center shrink-0 border border-slate-100 rounded-lg bg-slate-50/30 group-hover:bg-indigo-50/30 group-hover:border-indigo-300/40 transition-all duration-150">
                                    {renderMiniPreviewIcon(item.type)}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-medium text-slate-700 leading-tight truncate group-hover:text-indigo-600 transition-colors">{item.name}</p>
                                    <p className="text-[8.5px] text-slate-450 leading-none truncate mt-0.5">{item.desc}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {DIAGRAM_SHAPE_GROUPS.every(group =>
                      group.items.filter(item =>
                        item.name.toLowerCase().includes(shapeSearchQuery.toLowerCase()) ||
                        (item.desc && item.desc.toLowerCase().includes(shapeSearchQuery.toLowerCase()))
                      ).length === 0
                    ) && (
                      <div className="text-center py-8 text-slate-400 text-[11px]">
                        Tidak menemukan bentuk dengan kata kunci tersebut.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
  );
};
