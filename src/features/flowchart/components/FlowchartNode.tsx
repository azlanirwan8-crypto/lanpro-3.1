/**
 * Render satu node di kanvas: rangka bentuk, teks, port sambungan, pegangan
 * ukur, tombol auto-connect, dan bilah properti saat terpilih.
 *
 * Sebelumnya berupa badan `nodes.map()` di dalam FlowchartContainer — blok JSX
 * terbesar di berkas itu. Dipindah verbatim; yang berubah hanya cara ia
 * memperoleh data: dari closure atas state induk menjadi props eksplisit.
 *
 * Props-nya banyak (28) dan itu memang konsekuensi yang disengaja. Node
 * bersinggungan dengan hampir seluruh state kanvas — seleksi, hover, drag,
 * mode sambung, tema, simulasi. Memindahkan state itu ke sini akan memecah
 * satu sumber kebenaran, karena edge dan marquee membaca state yang sama.
 * Daftar props yang panjang justru membuat ketergantungan itu terlihat, bukan
 * menyembunyikannya di balik closure.
 */
import React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, User, ExternalLink } from "lucide-react";
import { cn } from "../../../lib/utils";
import { customSvgTypes, renderCustomSvgShape } from "../lib/shapes";
import { getShapeThemeClasses } from "../lib/nodeTheme";
import { colorPaletteHex } from "../constants";
import { NodePropertiesOverlay } from "./NodePropertiesOverlay";
import type { FlowNode, FlowEdge } from "../types";
import type { Task } from "../../../types";

interface FlowchartNodeProps {
  /** Node yang dirender oleh instance ini. */
  node: FlowNode;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  copiedNodes: FlowNode[];
  connectSourceId: string | null;
  setConnectSourceId: (id: string | null) => void;
  hoveredNodeId: string | null;
  setHoveredNodeId: (id: string | null) => void;
  draggingNodeId: string | null;
  activeSimNodeId: string | null;
  canvasTheme: "miro" | "blueprint";
  /** Menentukan boleh-tidaknya menu konteks dan sunting muncul. */
  isWorkspaceEditable: boolean;
  setActiveTool: (tool: "select" | "hand" | "connect") => void;
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
  setNodeContextMenu: (menu: { x: number; y: number; nodeId: string } | null) => void;
  handleNodeMouseDown: (e: React.MouseEvent, node: FlowNode) => void;
  handleResizeMouseDown: (e: React.MouseEvent, nodeId: string, direction: "se" | "e" | "s") => void;
  handleConnectPortClick: (nodeId: string, portName: string) => void;
  handleUpdateActiveNode: (props: Partial<FlowNode>) => void;
  handleDuplicateNode: (node: FlowNode) => void;
  handleDeleteSelected: () => void;
  /** Task yang tertaut pada node, bila ada. */
  getLinkedTaskDetails: (taskId?: string) => Task | undefined;
  setSelectedTaskForDetail: (task: Task) => void;
  setIsTaskDetailModalOpen: (isOpen: boolean) => void;
}

export const FlowchartNode: React.FC<FlowchartNodeProps> = ({
  node,
  selectedNodeId,
  setSelectedNodeId,
  setSelectedEdgeId,
  copiedNodes,
  connectSourceId,
  setConnectSourceId,
  hoveredNodeId,
  setHoveredNodeId,
  draggingNodeId,
  activeSimNodeId,
  canvasTheme,
  isWorkspaceEditable,
  setActiveTool,
  setNodes,
  setEdges,
  setNodeContextMenu,
  handleNodeMouseDown,
  handleResizeMouseDown,
  handleConnectPortClick,
  handleUpdateActiveNode,
  handleDuplicateNode,
  handleDeleteSelected,
  getLinkedTaskDetails,
  setSelectedTaskForDetail,
  setIsTaskDetailModalOpen,
}) => {
                const isSelected = selectedNodeId === node.id || copiedNodes.some(copy => copy.id === node.id);
                const isSourceOfConnect = connectSourceId === node.id;
                const linkedTask = getLinkedTaskDetails(node.taskId);
                
                const nodeWidth = node.width || 130;
                const nodeHeight = node.height || 70;

                const isSticky = node.type === "sticky";
                const isDiamond = node.type === "diamond" || node.type === "decision";
                const isBlueprint = canvasTheme === "blueprint";
                const isSvgShape = customSvgTypes.includes(node.type as any) || node.type === "parallelogram" || node.type === "diamond" || node.type === "decision";

                return (
                  <motion.div
                    key={node.id}
                    style={{
                      left: `${node.x}px`,
                      top: `${node.y}px`,
                      width: `${nodeWidth}px`,
                      height: `${nodeHeight}px`,
                      willChange: "transform",
                    }}
                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedNodeId(node.id);
                      setSelectedEdgeId(null);
                      if (isWorkspaceEditable) {
                        setNodeContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          nodeId: node.id
                        });
                      }
                    }}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    className={cn(
                      "absolute z-20 cursor-pointer rounded-[inherit]",
                      node.id === activeSimNodeId && "ring-4 ring-emerald-500 shadow-2xl shadow-emerald-450/40"
                    )}
                    animate={{
                      scale: draggingNodeId === node.id 
                        ? 1.07 
                        : isSourceOfConnect
                        ? 1.05
                        : isSelected
                        ? 1.03
                        : (hoveredNodeId === node.id)
                        ? (connectSourceId !== null ? 1.05 : 1.02)
                        : 1,
                      rotate: draggingNodeId === node.id 
                        ? 1.2
                        : isSourceOfConnect 
                        ? [0, -1.2, 1.2, -1.2, 0]
                        : 0,
                      boxShadow: !isSvgShape
                        ? (draggingNodeId === node.id
                            ? "0 25px 40px -10px rgba(0, 0, 0, 0.25), 0 12px 20px -8px rgba(0, 0, 0, 0.18)"
                            : isSourceOfConnect
                            ? "0 0 0 3px rgba(244, 63, 94, 0.45), 0 8px 20px -6px rgba(244, 63, 94, 0.3)"
                            : isSelected
                            ? "0 0 0 3px rgba(139, 92, 246, 0.4), 0 8px 20px -6px rgba(139, 92, 246, 0.3)"
                            : hoveredNodeId === node.id
                            ? (connectSourceId !== null ? "0 0 0 3px rgba(167, 139, 250, 0.45), 0 10px 15px -3px rgba(0, 0, 0, 0.08)" : "0 10px 20px -5px rgba(0, 0, 0, 0.12), 0 4px 8px -2px rgba(0, 0, 0, 0.06)")
                            : "0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -1px rgba(0, 0, 0, 0.04)")
                        : "none"
                    }}
                    whileTap={{ scale: 0.97 }}
                    transition={{
                      type: "spring",
                      stiffness: 450,
                      damping: 22,
                      mass: 0.5,
                      rotate: isSourceOfConnect ? {
                        type: "keyframes",
                        duration: 1.0,
                        ease: "easeInOut",
                        repeat: Infinity
                      } : {
                        type: "spring",
                        stiffness: 300,
                        damping: 15
                      }
                    }}
                    id={`val-node-${node.id}`}
                  >
                    
                    {/* Floating connection ports on hover/select */}
                    {(hoveredNodeId === node.id || isSelected) && (
                      <div className="absolute inset-0 pointer-events-none z-30">
                        {/* TOP PORT */}
                        <div 
                          className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-violet-500 shadow-md flex items-center justify-center hover:scale-130 hover:bg-violet-50 transition-all active:scale-95 cursor-crosshair pointer-events-auto"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleConnectPortClick(node.id, "top");
                          }}
                          title="Tarik panah dari Sisi Atas"
                        >
                          <Plus className="w-2 md:w-2.5 h-2 md:h-2.5 text-violet-600 font-medium" />
                        </div>

                        {/* RIGHT PORT */}
                        <div 
                          className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-violet-500 shadow-md flex items-center justify-center hover:scale-130 hover:bg-violet-50 transition-all active:scale-95 cursor-crosshair pointer-events-auto"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleConnectPortClick(node.id, "right");
                          }}
                          title="Tarik panah dari Sisi Kanan"
                        >
                          <Plus className="w-2 md:w-2.5 h-2 md:h-2.5 text-violet-600 font-medium" />
                        </div>

                        {/* BOTTOM PORT */}
                        <div 
                          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-violet-500 shadow-md flex items-center justify-center hover:scale-130 hover:bg-violet-50 transition-all active:scale-95 cursor-crosshair pointer-events-auto"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleConnectPortClick(node.id, "bottom");
                          }}
                          title="Tarik panah dari Sisi Bawah"
                        >
                          <Plus className="w-2 md:w-2.5 h-2 md:h-2.5 text-violet-600 font-medium" />
                        </div>

                        {/* LEFT PORT */}
                        <div 
                          className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-violet-500 shadow-md flex items-center justify-center hover:scale-130 hover:bg-violet-50 transition-all active:scale-95 cursor-crosshair pointer-events-auto"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleConnectPortClick(node.id, "left");
                          }}
                          title="Tarik panah dari Sisi Kiri"
                        >
                          <Plus className="w-2 md:w-2.5 h-2 md:h-2.5 text-violet-600 font-medium" />
                        </div>
                      </div>
                    )}

                    {/* Floating mini shapes attributes modification overlay */}
                    <NodePropertiesOverlay
                      node={node}
                      isSelected={isSelected}
                      handleUpdateActiveNode={handleUpdateActiveNode}
                      handleDuplicateNode={handleDuplicateNode}
                      setActiveTool={setActiveTool}
                      setConnectSourceId={setConnectSourceId}
                      handleDeleteSelected={handleDeleteSelected}
                    />

                    {/* Shape Component Frame Body */}
                    <div 
                      className={cn(getShapeThemeClasses(node, isSelected), "w-full h-full relative")}
                      style={
                        isBlueprint 
                          ? undefined 
                          : isSticky 
                          ? { background: `linear-gradient(135deg, ${colorPaletteHex[node.color]?.bg || '#fef08a'} 0%, ${colorPaletteHex[node.color]?.bgGrad || '#fef3c7'} 100%)` }
                          : customSvgTypes.includes(node.type as any) || node.type === "parallelogram" || node.type === "diamond" || node.type === "decision"
                          ? undefined // SVGs handle their own fill
                          : { background: `linear-gradient(135deg, ${colorPaletteHex[node.color]?.bg || '#eff6ff'} 0%, ${colorPaletteHex[node.color]?.bgGrad || '#dbeafe'} 100%)` }
                      }
                    >
                      
                      {renderCustomSvgShape(node, canvasTheme, isSelected, hoveredNodeId === node.id, draggingNodeId === node.id, isSourceOfConnect)}

                      {/* Glowing high-fidelity active border overlays (only for non-SVG standard box shapes) */}
                      {!isSvgShape && isSelected && (
                        <motion.div
                          className="absolute -inset-1 rounded-[inherit] border-2 border-violet-500/50 pointer-events-none z-10"
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: [0.4, 0.8, 0.4] }}
                          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                        />
                      )}

                      {!isSvgShape && isSourceOfConnect && (
                        <motion.div
                          className="absolute -inset-1.5 rounded-[inherit] border-2 border-dashed border-rose-500/80 pointer-events-none z-10"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0.6, 1, 0.6] }}
                          transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                        />
                      )}

                      {node.type === "card" && (
                        <div className="absolute top-0 inset-x-0 h-1 rounded-t-lg bg-indigo-500" />
                      )}

                      {isDiamond && node.type !== 'decision' && node.type !== 'diamond' && (
                        <div className="absolute inset-1.5 border border-black/10 rotate-45 pointer-events-none rounded bg-inherit" />
                      )}

                      {node.type === "parallelogram" && (
                        <div className={cn("absolute inset-0 transform -skew-x-12 border border-black/10 rounded-md bg-inherit pointer-events-none", node.borderStyle === "dashed" ? "border-dashed border-2" : node.borderStyle === "none" ? "border-0 shadow-none" : "border-2")} />
                      )}

                      {node.type === "document" && (
                        <div className="absolute top-0 right-0 w-3 h-3 bg-black/15 rounded-bl border-b border-l border-black/10 pointer-events-none" />
                      )}

                      {(node.type === "subprocess" || node.type === "predefined") && (
                        <>
                          <div className="absolute left-1.5 inset-y-0 w-0.5 bg-black/15 pointer-events-none border-l border-current/20" />
                          <div className="absolute right-1.5 inset-y-0 w-0.5 bg-black/15 pointer-events-none border-r border-current/20" />
                        </>
                      )}

                      {(node.type === "cylinder" || node.type === "database") && (
                        <>
                          {/* Cylinder Top Lip overlay */}
                          <div className="absolute top-0 inset-x-0 h-3 rounded-t-[18px] border-b border-black/15 bg-inherit pointer-events-none opacity-80" />
                          {/* Cylinder Bottom curved base overlay */}
                          <div className="absolute bottom-0 inset-x-0 h-3 rounded-b-[18px] border-t border-black/15 pointer-events-none opacity-40 bg-black/5" />
                        </>
                      )}

                      {node.type === "actor" && (
                        <User className="w-3.5 h-3.5 text-current/50 absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none" />
                      )}

                      {node.type === "folder" && (
                        <div className="absolute -top-1.5 left-2 w-7 h-1.5 rounded-t bg-inherit border-t border-x border-black/15 pointer-events-none" />
                      )}

                      {/* Display Text content box */}
                      <div 
                        className={cn("flex-1 w-full flex flex-col justify-center min-w-0 h-full relative z-10", node.type === "actor" && "pt-3.5")}
                        style={{ padding: isDiamond ? '15%' : undefined }}
                      >
                        <textarea
                          disabled={!isWorkspaceEditable}
                          value={node.label}
                          onChange={(e) => handleUpdateActiveNode({ label: e.target.value })}
                          className={cn(
                            "w-full bg-transparent border-0 resize-none font-medium text-current focus:outline-none focus:ring-1 focus:ring-violet-300 rounded leading-tight text-center font-sans tracking-tight custom-scrollbar",
                            canvasTheme === "blueprint" && !isSticky && "text-white select-text",
                            node.fontStyle === "serif" && "sticky-handwriting font-medium",
                            node.fontStyle === "mono" && "font-mono text-[10px]",
                            node.align === "left" && "text-left",
                            node.align === "right" && "text-right"
                          )}
                          style={{ 
                            fontSize: `${
                              node.type === "sticky" 
                                ? ((node.label || "").length > 100 ? 9 : (node.label || "").length > 60 ? 10 : (node.label || "").length > 30 ? 11 : 13)
                                : (node.fontSize || 12)
                            }px` 
                          }}
                          placeholder="..."
                        />

                        {/* Show Linked Jira / Backlog Scrum tasks indicators */}
                        {linkedTask && (
                          <div className="mt-1 flex flex-col items-center gap-0.5 w-full">
                            <div 
                              className={cn(
                                "flex items-center gap-1 text-[8.5px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border shadow-sm cursor-pointer whitespace-nowrap",
                                linkedTask.status === "Done" || linkedTask.status === "Selesai"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : linkedTask.status === "In Progress" || linkedTask.status === "Dikerjakan"
                                  ? "bg-indigo-150 text-indigo-800 border-indigo-300"
                                  : "bg-slate-100 text-slate-800 border-slate-350"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTaskForDetail(linkedTask);
                                setIsTaskDetailModalOpen(true);
                              }}
                              title="Klik untuk detail Backlog"
                            >
                              <span>{linkedTask.key}</span>
                              <span className="w-1 h-3 bg-current/40 mx-0.5" />
                              <span className="truncate max-w-[65px]">{linkedTask.status}</span>
                              <ExternalLink className="w-2 h-2 opacity-55" />
                            </div>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Interactive Sizing Handles & Quick Auto-Connect Widget */}
                    {isSelected && isWorkspaceEditable && (
                      <>
                        {/* Right East sizing circle handle */}
                        <div 
                          onMouseDown={(e) => handleResizeMouseDown(e, node.id, "e")}
                          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 bg-violet-600 rounded-full border border-white cursor-ew-resize z-30 hover:scale-125 transition-transform shadow-md"
                          title="Tarik untuk melebarkan"
                        />
                        {/* Bottom South sizing circle handle */}
                        <div 
                          onMouseDown={(e) => handleResizeMouseDown(e, node.id, "s")}
                          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 bg-violet-600 rounded-full border border-white cursor-ns-resize z-30 hover:scale-125 transition-transform shadow-md"
                          title="Tarik untuk mempertinggi"
                        />
                        {/* Corners SE sizing square handle */}
                        <div 
                          onMouseDown={(e) => handleResizeMouseDown(e, node.id, "se")}
                          className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-3.5 h-3.5 bg-violet-600 rounded border border-white cursor-nwse-resize z-30 hover:scale-125 transition-transform shadow-md"
                          title="Sizing Bebas"
                        />
                        
                        {/* Auto-Connector plus direction link helper */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const nextNodeId = "node_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
                            const nextX = node.x + nodeWidth + 120;
                            const nextY = node.y;
                            const newNode: FlowNode = {
                              ...node,
                              id: nextNodeId,
                              x: nextX,
                              y: nextY,
                              label: "Langkah Alur Baru"
                            };
                            const newRelation: FlowEdge = {
                              id: "edge_" + Date.now(),
                              fromNodeId: node.id,
                              toNodeId: nextNodeId
                            };
                            setNodes(prev => [...prev, newNode]);
                            setEdges(prev => [...prev, newRelation]);
                            setSelectedNodeId(nextNodeId);
                            toast.success("Otomatis menambahkan & menghubungkan alur langkah baru!");
                          }}
                          className="absolute -right-11 top-1/2 -translate-y-1/2 w-7 h-7 bg-white hover:bg-violet-600 border border-slate-250 shadow-lg text-violet-600 hover:text-white rounded-full flex items-center justify-center font-medium text-base transition-all scale-90 hover:scale-110 z-30"
                          title="Buat Alur Hubung Baru secara Instan"
                        >
                          <Plus className="w-4 h-4" />
                        </button>

                        {/* Downward Auto-Connector plus direction link helper */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const nextNodeId = "node_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
                            const nextX = node.x;
                            const nextY = node.y + nodeHeight + 100;
                            const newNode: FlowNode = {
                              ...node,
                              id: nextNodeId,
                              x: nextX,
                              y: nextY,
                              label: "Langkah Alur Baru"
                            };
                            const newRelation: FlowEdge = {
                              id: "edge_" + Date.now(),
                              fromNodeId: node.id,
                              toNodeId: nextNodeId
                            };
                            setNodes(prev => [...prev, newNode]);
                            setEdges(prev => [...prev, newRelation]);
                            setSelectedNodeId(nextNodeId);
                            toast.success("Otomatis menambahkan & menghubungkan alur ke bawah!");
                          }}
                          className="absolute -bottom-11 left-1/2 -translate-x-1/2 w-7 h-7 bg-white hover:bg-indigo-600 border border-slate-250 shadow-lg text-indigo-600 hover:text-white rounded-full flex items-center justify-center font-medium text-base transition-all scale-90 hover:scale-110 z-30"
                          title="Hubungkan Alir ke Bawah Baru secara Instan"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </>
                    )}

                  </motion.div>
                );
};
