import { useState } from "react";

// FlowNode dulu didefinisikan ulang di sini dengan `type: string` yang longgar.
// Kini memakai satu sumber di features/flowchart/types.ts, sehingga node hasil
// salin-tempel tetap bertipe ketat saat diserahkan ke setNodes.
import type { FlowNode } from "../features/flowchart/types";
export type { FlowNode };

export interface FlowEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
}

export interface MarqueeBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

/**
 * useFlowchartSelection
 * Manages node/edge selection, tools, connection mode, and clipboard
 * Handles marquee selection and keyboard shortcuts for selection operations
 */
export function useFlowchartSelection() {
  // Node and edge selection
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Tool mode: select (pointer), hand (pan), connect (draw edges)
  const [activeTool, setActiveTool] = useState<'select' | 'hand' | 'connect'>('select');

  // Connection mode: when drawing edges, track source node
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);

  // Spacebar hold for temporary pan mode
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);

  // Hover feedback
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  // Clipboard: nodes copied for paste operations
  const [copiedNodes, setCopiedNodes] = useState<FlowNode[]>([]);

  // Marquee selection: drag to select multiple nodes
  const [marqueeBox, setMarqueeBox] = useState<MarqueeBox | null>(null);

  // Clear all selection
  const clearSelection = () => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setConnectSourceId(null);
    setCopiedNodes([]);
    setActiveTool('select');
    setMarqueeBox(null);
  };

  // Select single node
  const selectNode = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    if (!nodeId) {
      setConnectSourceId(null);
    }
  };

  // Select single edge
  const selectEdge = (edgeId: string | null) => {
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
  };

  // Toggle tool mode
  const switchTool = (tool: 'select' | 'hand' | 'connect') => {
    setActiveTool(tool);
    if (tool === 'connect') {
      // Prepare for connection mode
      setMarqueeBox(null);
    }
  };

  // Start connection: set source node
  const startConnection = (nodeId: string) => {
    setConnectSourceId(nodeId);
    setActiveTool('connect');
  };

  // Complete connection: reset connection state
  const completeConnection = () => {
    setConnectSourceId(null);
    setActiveTool('select');
  };

  // Copy nodes to clipboard
  const copyNodesToClipboard = (nodes: FlowNode[]) => {
    setCopiedNodes(JSON.parse(JSON.stringify(nodes)));
  };

  // Get clipboard contents
  const getClipboardNodes = (): FlowNode[] => {
    return copiedNodes;
  };

  // Clear clipboard
  const clearClipboard = () => {
    setCopiedNodes([]);
  };

  // Set marquee selection box (for drag-to-select)
  const setMarqueeSelection = (box: MarqueeBox | null) => {
    setMarqueeBox(box);
  };

  // Update marquee box during drag
  const updateMarqueeBox = (clientX: number, clientY: number) => {
    setMarqueeBox(prev =>
      prev ? { ...prev, currentX: clientX, currentY: clientY } : null
    );
  };

  // Check if node is selected
  const isNodeSelected = (nodeId: string): boolean => selectedNodeId === nodeId;

  // Check if edge is selected
  const isEdgeSelected = (edgeId: string): boolean => selectedEdgeId === edgeId;

  // Check if node is hovered
  const isNodeHovered = (nodeId: string): boolean => hoveredNodeId === nodeId;

  // Check if edge is hovered
  const isEdgeHovered = (edgeId: string): boolean => hoveredEdgeId === edgeId;

  // Check if in connection mode
  const isInConnectMode = (): boolean => activeTool === 'connect' && connectSourceId !== null;

  // Check if in panning mode
  const isInPanMode = (): boolean => activeTool === 'hand' || isSpacePressed;

  // Has selection
  const hasSelection = (): boolean => selectedNodeId !== null || selectedEdgeId !== null;

  // Has copied nodes
  const hasClipboardContent = (): boolean => copiedNodes.length > 0;

  // Count marquee selected nodes
  const getMarqueeSelectionCount = (): number => copiedNodes.length;

  return {
    // Selection state
    selectedNodeId,
    setSelectedNodeId,
    selectedEdgeId,
    setSelectedEdgeId,

    // Tool state
    activeTool,
    setActiveTool,

    // Connection state
    connectSourceId,
    setConnectSourceId,

    // Input state
    isSpacePressed,
    setIsSpacePressed,

    // Hover state
    hoveredNodeId,
    setHoveredNodeId,
    hoveredEdgeId,
    setHoveredEdgeId,

    // Clipboard
    copiedNodes,
    setCopiedNodes,

    // Marquee selection
    marqueeBox,
    setMarqueeBox,

    // Selection helpers
    clearSelection,
    selectNode,
    selectEdge,
    switchTool,
    startConnection,
    completeConnection,
    copyNodesToClipboard,
    getClipboardNodes,
    clearClipboard,
    setMarqueeSelection,
    updateMarqueeBox,

    // Checkers
    isNodeSelected,
    isEdgeSelected,
    isNodeHovered,
    isEdgeHovered,
    isInConnectMode,
    isInPanMode,
    hasSelection,
    hasClipboardContent,
    getMarqueeSelectionCount
  };
}
