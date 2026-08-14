/**
 * Bilah properti melayang di atas node yang sedang dipilih.
 *
 * Isinya: pengubah jenis bentuk, palet warna cepat, jenis huruf, perataan teks,
 * ukuran font, gaya garis tepi, duplikat, mulai sambungan, dan hapus.
 *
 * Sebelumnya berupa blok JSX di dalam FlowchartContainer, di dalam perulangan
 * render node. Dipindah verbatim; yang berubah hanya cara ia memperoleh data —
 * dari closure atas state induk menjadi props eksplisit.
 *
 * Penjaga `isSelected` yang dulu ada di sisi pemanggil kini menjadi early
 * return di sini, sehingga kondisi tampil-tidaknya menjadi urusan komponen ini.
 */
import React from "react";
import { AlignLeft, AlignCenter, AlignRight, Square, Copy, ArrowRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import type { FlowNode } from "../types";

interface NodePropertiesOverlayProps {
  /** Node yang sedang dipilih; seluruh kendali di sini bekerja padanya. */
  node: FlowNode;
  isSelected: boolean;
  /** Menerapkan perubahan sebagian pada node yang aktif. */
  handleUpdateActiveNode: (props: Partial<FlowNode>) => void;
  handleDuplicateNode: (node: FlowNode) => void;
  setActiveTool: (tool: "select" | "hand" | "connect") => void;
  setConnectSourceId: (id: string | null) => void;
  handleDeleteSelected: () => void;
}

export const NodePropertiesOverlay: React.FC<NodePropertiesOverlayProps> = ({
  node,
  isSelected,
  handleUpdateActiveNode,
  handleDuplicateNode,
  setActiveTool,
  setConnectSourceId,
  handleDeleteSelected,
}) => {
  if (!isSelected) return null;

  return (
                      <div
                        className="absolute -top-16 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md text-slate-850 p-2 px-3 rounded-xl border border-slate-200/90 shadow-[0_10px_35px_rgba(0,0,0,0.12)] flex items-center gap-2 z-40 select-none pointer-events-auto transition-all"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {/* Shape Converter Selector */}
                        <select
                          value={node.type}
                          onChange={(e) => {
                            handleUpdateActiveNode({ type: e.target.value as FlowNode["type"] });
                            toast.success(`Bentuk bentuk diubah ke ${e.target.value.toUpperCase()}!`);
                          }}
                          className="bg-slate-50 border border-slate-200 text-[10px] font-medium text-slate-700 outline-none p-1 rounded-lg cursor-pointer hover:bg-slate-100 max-w-[120px]"
                          title="Ubah jenis bentuk"
                        >
                          <option value="rect">Rectangle</option>
                          <option value="oval">Oval (Start/End)</option>
                          <option value="diamond">Decision (Diamond)</option>
                          <option value="triangle">Triangle</option>
                          <option value="pentagon">Pentagon</option>
                          <option value="hexagon">Hexagon</option>
                          <option value="octagon">Octagon</option>
                          <option value="star">Star</option>
                          <option value="arrowRight">Arrow Right</option>
                          <option value="arrowLeft">Arrow Left</option>
                          <option value="arrowLeftRight">Arrow Left Right</option>
                          <option value="trapezoid">Trapezoid</option>
                          <option value="cross">Cross / Plus</option>
                          <option value="chevron">Chevron</option>
                          <option value="delay">Delay (Bullet)</option>
                          <option value="callout">Callout / Bubble</option>
                          <option value="cylinder">Database Server</option>
                          <option value="sticky">Sticky Note</option>
                          <option value="cloud">Cloud API</option>
                          <option value="circle">Circle</option>
                          <option value="card">Card Item</option>
                          <option value="document">Doc Page</option>
                          <option value="subprocess">Subprocess</option>
                          <option value="actor">Actor Icon</option>
                          <option value="folder">Folder Block</option>
                          <option value="curlyLeft">{`Curly Left {`}</option>
                          <option value="curlyRight">{`Curly Right }`}</option>
                        </select>

                        <div className="h-4 w-px bg-slate-200" />

                        {/* Quick Pastel Selection circle dots */}
                        <div className="flex items-center gap-1">
                          {["yellow", "blue", "green", "purple", "rose", "slate"].map(colName => {
                            const colorClassMap: Record<string, string> = {
                              yellow: "bg-amber-100 hover:bg-amber-200",
                              blue: "bg-blue-150 hover:bg-blue-200",
                              green: "bg-emerald-100 hover:bg-emerald-200",
                              purple: "bg-purple-100 hover:bg-purple-200",
                              rose: "bg-rose-100 hover:bg-rose-200",
                              slate: "bg-slate-100 hover:bg-slate-200"
                            };
                            return (
                              <button
                                key={colName}
                                onClick={() => {
                                  handleUpdateActiveNode({ color: colName });
                                }}
                                className={cn(
                                  "w-3.5 h-3.5 rounded-full border border-black/10 transition-transform hover:scale-125 focus:outline-none",
                                  colorClassMap[colName],
                                  node.color === colName && "ring-2 ring-violet-500 scale-110"
                                )}
                                title={`Ubah warna ke: ${colName}`}
                              />
                            );
                          })}
                        </div>

                        <div className="h-4 w-px bg-slate-200" />

                        {/* Font Family switch */}
                        <button
                          onClick={() => {
                            const nextStyle: FlowNode["fontStyle"] = node.fontStyle === "sans" ? "serif" : node.fontStyle === "serif" ? "mono" : "sans";
                            handleUpdateActiveNode({ fontStyle: nextStyle });
                          }}
                          className="p-1 px-1.5 hover:bg-slate-100 text-[10px] rounded font-medium uppercase"
                          title="Format Huruf (Sans / Serif / Mono)"
                        >
                          {node.fontStyle || "sans"}
                        </button>

                        {/* Toggle Align text */}
                        <button
                          onClick={() => {
                            const nextAlign: FlowNode["align"] = node.align === "left" ? "center" : node.align === "center" ? "right" : "left";
                            handleUpdateActiveNode({ align: nextAlign });
                          }}
                          className="p-1 hover:bg-slate-100 rounded text-slate-600 pointer-events-auto"
                          title="Rata Kiri/Tengah/Kanan"
                        >
                          {node.align === "left" ? <AlignLeft className="w-3.5 h-3.5" /> : node.align === "right" ? <AlignRight className="w-3.5 h-3.5" /> : <AlignCenter className="w-3.5 h-3.5" />}
                        </button>

                        <div className="h-4 w-px bg-slate-200" />

                        {/* Font sizing buttons */}
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => handleUpdateActiveNode({ fontSize: Math.max(9, (node.fontSize || 12) - 1) })} className="p-1 hover:bg-slate-100 text-xs rounded font-medium" title="Perkecil Font">-</button>
                          <span className="text-[10px] font-mono font-medium px-0.5 whitespace-nowrap">{node.fontSize || 12}px</span>
                          <button onClick={() => handleUpdateActiveNode({ fontSize: Math.min(22, (node.fontSize || 12) + 1) })} className="p-1 hover:bg-slate-100 text-xs rounded font-medium" title="Perbesar Font">+</button>
                        </div>

                        <div className="h-4 w-px bg-slate-200" />

                        {/* Border style loop selector */}
                        <button
                          onClick={() => {
                            const nextStyle = node.borderStyle === "dashed" ? "none" : node.borderStyle === "none" ? "solid" : "dashed";
                            handleUpdateActiveNode({ borderStyle: nextStyle as FlowNode["borderStyle"] });
                            toast.success(`Jenis garis diubah ke: ${(nextStyle || "solid").toUpperCase()}`);
                          }}
                          className="p-1 hover:bg-slate-100 rounded text-slate-600"
                          title="Ubah garis tepian (Solid/Dashed/None)"
                        >
                          <Square className={cn("w-3.5 h-3.5", node.borderStyle === "dashed" && "border-dashed border-2", node.borderStyle === "none" && "opacity-30")} />
                        </button>

                        {/* Duplicate */}
                        <button
                          onClick={() => handleDuplicateNode(node)}
                          className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-indigo-50"
                          title="Duplikat Bentuk (Ctrl+D)"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {/* Connection Drawer mode toggle */}
                        <button
                          onClick={() => {
                            setActiveTool('connect');
                            setConnectSourceId(node.id);
                            toast.info(`Sambungkan alur dari "${node.label}" ke shape berikutnya.`);
                          }}
                          className="p-1 text-slate-500 hover:text-amber-500 rounded hover:bg-amber-50"
                          title="Mulai tarik panah hubungan"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        <div className="h-4 w-px bg-slate-200" />

                        {/* Delete shape */}
                        <button
                          onClick={handleDeleteSelected}
                          className="p-1 text-slate-450 hover:text-rose-600 rounded hover:bg-rose-50"
                          title="Hapus shape"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
  );
};
