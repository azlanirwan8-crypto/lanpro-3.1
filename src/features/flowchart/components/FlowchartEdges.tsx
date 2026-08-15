/**
 * Lapisan SVG kanvas: definisi penanda panah, gradien bentuk, seluruh garis
 * penghubung antar node, dan garis putus-putus yang mengikuti kursor saat
 * pengguna sedang menarik sambungan baru.
 *
 * Sebelumnya berupa satu elemen <svg> di dalam FlowchartContainer. Dipindah
 * verbatim; yang berubah hanya cara ia memperoleh data — dari closure atas
 * state induk menjadi props eksplisit.
 *
 * Berada di bawah node dalam urutan tumpuk (z-10 berbanding z-20) dan
 * `pointer-events-none` di tingkat svg, sehingga garis tidak menghalangi
 * interaksi dengan bentuk; hanya jalur tak terlihat yang lebar di tiap garis
 * yang menerima klik.
 */
import React from "react";
import { motion } from "framer-motion";
import { findSmartRoute } from "../lib/routing";
import { colorPaletteHex } from "../constants";
import type { FlowNode, FlowEdge } from "../types";

interface FlowchartEdgesProps {
  edges: FlowEdge[];
  nodes: FlowNode[];
  canvasTheme: "miro" | "blueprint";
  selectedEdgeId: string | null;
  setSelectedEdgeId: (id: string | null) => void;
  hoveredEdgeId: string | null;
  setHoveredEdgeId: (id: string | null) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  hoveredNodeId: string | null;
  /** Node asal saat mode sambung aktif; null berarti tidak sedang menyambung. */
  connectSourceId: string | null;
  setConnectSourceId: (id: string | null) => void;
  /** Posisi kursor di ruang kanvas, dipakai ujung garis bantu. */
  hoverCoords: { x: number; y: number };
  /** Bentuk garis penghubung yang dipilih pengguna. */
  connectorType: 'bezier' | 'straight' | 'orthogonal';
  /** Titik tengah sebuah node; tinggal di container karena membaca state nodes. */
  getNodeCenter: (nodeId: string) => { x: number; y: number };
}

export const FlowchartEdges: React.FC<FlowchartEdgesProps> = ({
  edges,
  nodes,
  canvasTheme,
  selectedEdgeId,
  setSelectedEdgeId,
  hoveredEdgeId,
  setHoveredEdgeId,
  selectedNodeId,
  setSelectedNodeId,
  hoveredNodeId,
  connectSourceId,
  setConnectSourceId,
  hoverCoords,
  connectorType,
  getNodeCenter,
}) => {
  return (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                <defs>
                  <marker
                    id="canvas-arrow-head"
                    markerWidth="13"
                    markerHeight="13"
                    refX="14"
                    refY="4"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path d="M0,1 L0,7 L6,4 z" fill={canvasTheme === 'miro' ? "#475569" : "#60a5fa"} />
                  </marker>
                  <marker
                    id="canvas-arrow-head-selected"
                    markerWidth="13"
                    markerHeight="13"
                    refX="14"
                    refY="4"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path d="M0,1 L0,7 L6,4 z" fill="#8b5cf6" />
                  </marker>

                  {/* Dynamic gradients for beautiful, smooth custom shapes */}
                  {Object.entries(colorPaletteHex).map(([colorName, colors]) => (
                    <linearGradient key={colorName} id={`grad-${colorName}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={colors.bg} />
                      <stop offset="100%" stopColor={colors.bgGrad || colors.bg} />
                    </linearGradient>
                  ))}
                </defs>

                {/* Draw connecting Edge arrows */}
                {edges.map((edge) => {
                  const source = nodes.find(n => n.id === edge.fromNodeId);
                  const target = nodes.find(n => n.id === edge.toNodeId);
                  
                  const startCenter = getNodeCenter(edge.fromNodeId);
                  const endCenter = getNodeCenter(edge.toNodeId);
                  const isSelected = selectedEdgeId === edge.id;
                  const isHovered = hoveredEdgeId === edge.id;

                  const isSourceSelected = selectedNodeId === edge.fromNodeId;
                  const isTargetSelected = selectedNodeId === edge.toNodeId;
                  const isSourceHovered = hoveredNodeId === edge.fromNodeId;
                  const isTargetHovered = hoveredNodeId === edge.toNodeId;
                  const isNodeConnectedActive = isSourceSelected || isTargetSelected || isSourceHovered || isTargetHovered;

                  if (startCenter.x === 0 || endCenter.x === 0) return null;

                  // Magnetic Snapping and Dynamic Port Connection Locator
                  const getClosestPortsPoint = (srcNode: FlowNode, tgtNode: FlowNode) => {
                    const sW = srcNode.width || 130;
                    const sH = srcNode.height || 70;
                    const tW = tgtNode.width || 130;
                    const tH = tgtNode.height || 70;

                    const sourcePorts = [
                      { name: 'top', x: srcNode.x + sW / 2, y: srcNode.y, dir: { x: 0, y: -1 } },
                      { name: 'right', x: srcNode.x + sW, y: srcNode.y + sH / 2, dir: { x: 1, y: 0 } },
                      { name: 'bottom', x: srcNode.x + sW / 2, y: srcNode.y + sH, dir: { x: 0, y: 1 } },
                      { name: 'left', x: srcNode.x, y: srcNode.y + sH / 2, dir: { x: -1, y: 0 } }
                    ];

                    const targetPorts = [
                      { name: 'top', x: tgtNode.x + tW / 2, y: tgtNode.y, dir: { x: 0, y: -1 } },
                      { name: 'right', x: tgtNode.x + tW, y: tgtNode.y + tH / 2, dir: { x: 1, y: 0 } },
                      { name: 'bottom', x: tgtNode.x + tW / 2, y: tgtNode.y + tH, dir: { x: 0, y: 1 } },
                      { name: 'left', x: tgtNode.x, y: tgtNode.y + tH / 2, dir: { x: -1, y: 0 } }
                    ];

                    let minDistance = Infinity;
                    let bestSource = sourcePorts[2]; // bottom fallback
                    let bestTarget = targetPorts[0]; // top fallback

                    for (const sP of sourcePorts) {
                      for (const tP of targetPorts) {
                        const dx = tP.x - sP.x;
                        const dy = tP.y - sP.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < minDistance) {
                          minDistance = dist;
                          bestSource = sP;
                          bestTarget = tP;
                        }
                      }
                    }

                    return { source: bestSource, target: bestTarget };
                  };

                  const { source: startPort, target: endPort } = source && target 
                    ? getClosestPortsPoint(source, target)
                    : { 
                        source: { x: startCenter.x, y: startCenter.y, dir: { x: 0, y: 1 } }, 
                        target: { x: endCenter.x, y: endCenter.y, dir: { x: 0, y: -1 } } 
                      };

                  const start = startPort;
                  const end = endPort;

                  // Find smart route path avoiding intermediate node obstacles
                  const pathPoints = findSmartRoute(start, end, edge.fromNodeId, edge.toNodeId, nodes);

                  // Compute custom router path based on active routing types (bezier, straight, orthogonal right-angles)
                  let pathD = "";
                  if (connectorType === "straight") {
                    pathD = "M " + pathPoints.map(p => `${p.x} ${p.y}`).join(" L ");
                  } else if (connectorType === "orthogonal") {
                    // Connect each consecutive point and align orthogonally beautiful
                    let current = pathPoints[0];
                    let parts = [`M ${current.x} ${current.y}`];
                    for (let i = 1; i < pathPoints.length; i++) {
                      const next = pathPoints[i];
                      if (current.x !== next.x && current.y !== next.y) {
                        if (i === 1) {
                          const dir = start.dir || { x: 0, y: 1 };
                          if (dir.x !== 0) {
                            parts.push(`L ${next.x} ${current.y}`);
                          } else {
                            parts.push(`L ${current.x} ${next.y}`);
                          }
                        } else {
                          parts.push(`L ${next.x} ${current.y}`);
                        }
                      }
                      parts.push(`L ${next.x} ${next.y}`);
                      current = next;
                    }
                    pathD = parts.join(" ");
                  } else {
                    // Curved / Bezier
                    if (pathPoints.length <= 2) {
                      const dist = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
                      const k = Math.min(100, Math.max(30, dist * 0.45));
                      const cp1 = { x: start.x + (start.dir?.x || 0) * k, y: start.y + (start.dir?.y || 0) * k };
                      const cp2 = { x: end.x + (end.dir?.x || 0) * k, y: end.y + (end.dir?.y || 0) * k };
                      pathD = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
                    } else {
                      let d = `M ${pathPoints[0].x} ${pathPoints[0].y}`;
                      for (let i = 1; i < pathPoints.length; i++) {
                        const p = pathPoints[i];
                        if (i === 1) {
                          const dist = Math.sqrt((p.x - start.x) ** 2 + (p.y - start.y) ** 2);
                          const k = Math.min(50, dist * 0.3);
                          const cp = { x: start.x + (start.dir?.x || 0) * k, y: start.y + (start.dir?.y || 0) * k };
                          d += ` Q ${cp.x} ${cp.y}, ${p.x} ${p.y}`;
                        } else if (i === pathPoints.length - 1) {
                          const prev = pathPoints[i - 1];
                          const dist = Math.sqrt((end.x - prev.x) ** 2 + (end.y - prev.y) ** 2);
                          const k = Math.min(50, dist * 0.3);
                          const cp = { x: end.x + (end.dir?.x || 0) * k, y: end.y + (end.dir?.y || 0) * k };
                          d += ` Q ${cp.x} ${cp.y}, ${end.x} ${end.y}`;
                        } else {
                          const prev = pathPoints[i - 1];
                          const midX = (prev.x + p.x) / 2;
                          const midY = (prev.y + p.y) / 2;
                          d += ` S ${midX} ${midY}, ${p.x} ${p.y}`;
                        }
                      }
                      pathD = d;
                    }
                  }

                  return (
                    <g 
                      key={edge.id} 
                      className="pointer-events-auto cursor-pointer"
                      onMouseEnter={() => setHoveredEdgeId(edge.id)}
                      onMouseLeave={() => setHoveredEdgeId(null)}
                    >
                      
                      {/* Interaction trigger line (Invisible & wide) */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={isSelected ? "#c084fc" : "transparent"}
                        strokeWidth="16"
                        className="opacity-45 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEdgeId(edge.id);
                          setSelectedNodeId(null);
                          setConnectSourceId(null);
                        }}
                      />
                      
                      {/* Suble hover or selected pulse under-glow path */}
                      {(isHovered || isSelected) && (
                        <motion.path
                          d={pathD}
                          fill="none"
                          stroke={isSelected ? "#c084fc" : "#93c5fd"}
                          strokeWidth={isSelected ? "8" : "6"}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0.2, 0.5, 0.2] }}
                          transition={{
                            repeat: Infinity,
                            duration: 1.4,
                            ease: "easeInOut"
                          }}
                        />
                      )}

                      {/* Flow Tracer Animation (When connected node is hovered or selected) */}
                      {isNodeConnectedActive && (
                        <motion.path
                          d={pathD}
                          fill="none"
                          stroke={isSourceSelected || isSourceHovered ? "#10b981" : "#3b82f6"} // Green/Emerald for outflow, Blue/Indigo for inflow
                          strokeWidth={isSelected ? "4" : "3"}
                          strokeLinecap="round"
                          strokeDasharray="12, 60"
                          animate={{ strokeDashoffset: [0, -72] }}
                          transition={{
                            repeat: Infinity,
                            duration: 1.2,
                            ease: "linear"
                          }}
                          className="pointer-events-none opacity-90 drop-shadow-[0_0_2px_rgba(59,130,246,0.5)]"
                        />
                      )}

                      {/* Actual visual indicator path */}
                      <motion.path
                        d={pathD}
                        fill="none"
                        stroke={isSelected ? "#8b5cf6" : isHovered ? "#3b82f6" : canvasTheme === 'miro' ? "#475569" : "#60a5fa"}
                        strokeWidth={isSelected ? "3" : isHovered ? "2.5" : "2"}
                        markerEnd={isSelected ? "url(#canvas-arrow-head-selected)" : "url(#canvas-arrow-head)"}
                        className="transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEdgeId(edge.id);
                          setSelectedNodeId(null);
                          setConnectSourceId(null);
                        }}
                        initial={{ pathLength: 0 }}
                        strokeDasharray={isSelected ? "6, 4" : isHovered ? "4, 4" : undefined}
                        animate={{ 
                          pathLength: 1,
                          strokeDashoffset: isSelected ? [0, -20] : isHovered ? [0, -15] : 0 
                        }}
                        transition={{ 
                          pathLength: { duration: 0.35, ease: "easeOut" },
                          strokeDashoffset: { repeat: Infinity, duration: isSelected ? 0.8 : 1.2, ease: "linear" }
                        }}
                      />

                      {/* Optional inline description on arrows */}
                      {edge.label && (
                        <foreignObject
                          x={(start.x + end.x) / 2 - 45}
                          y={(start.y + end.y) / 2 - 12}
                          width="90"
                          height="26"
                        >
                          <div className="bg-white border border-slate-200 text-xs sm:text-[11px] sm:text-[9px] text-slate-800 font-medium px-1.5 py-0.5 rounded shadow-soft text-center truncate">
                            {edge.label}
                          </div>
                        </foreignObject>
                      )}

                    </g>
                  );
                })}

                {/* Real-time interactive dotted helper path while creating connection lines */}
                {connectSourceId && (() => {
                  const srcNode = nodes.find(n => n.id === connectSourceId);
                  if (!srcNode) return null;
                  const sW = srcNode.width || 130;
                  const sH = srcNode.height || 70;
                  const startX = srcNode.x + sW / 2;
                  const startY = srcNode.y + sH / 2;
                  const endX = hoverCoords.x;
                  const endY = hoverCoords.y;
                  
                  const dx = endX - startX;
                  const dy = endY - startY;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  const k = Math.min(100, Math.max(30, dist * 0.45));
                  const pathD = `M ${startX} ${startY} C ${startX + k} ${startY}, ${endX - k} ${endY}, ${endX} ${endY}`;
                  
                  return (
                    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                      <motion.path
                        d={pathD}
                        fill="none"
                        stroke="#a78bfa"
                        strokeWidth="3"
                        strokeDasharray="6,4"
                        animate={{
                          strokeDashoffset: [-20, 0]
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.8,
                          ease: "linear"
                        }}
                      />
                      <circle cx={endX} cy={endY} r="5" fill="#8b5cf6" className="animate-ping" />
                      <circle cx={endX} cy={endY} r="4" fill="#8b5cf6" />
                    </motion.g>
                  );
                })()}
              </svg>
  );
};
