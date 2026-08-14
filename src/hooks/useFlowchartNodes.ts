import { useState } from "react";
import { toast } from "sonner";

export interface FlowNode {
  id: string;
  type: string;
  x: number;
  y: number;
  label: string;
  color: string;
  taskId?: string;
  width?: number;
  height?: number;
  fontSize?: number;
  fontStyle?: "sans" | "serif" | "mono";
  align?: "left" | "center" | "right";
  borderStyle?: "solid" | "dashed" | "none";
  strokeWidth?: number;
}

export interface FlowEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
}

/**
 * useFlowchartNodes
 * Core node and edge CRUD operations
 * Handles creation, updating, deletion, and property changes
 */
export function useFlowchartNodes() {
  // Canvas content: nodes and edges
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);

  // --- NODE OPERATIONS ---

  // Add new node to canvas
  const addNode = (node: FlowNode) => {
    setNodes(prev => [...prev, node]);
  };

  // Update node properties
  const updateNode = (nodeId: string, updates: Partial<FlowNode>) => {
    setNodes(prev =>
      prev.map(n => n.id === nodeId ? { ...n, ...updates } : n)
    );
  };

  // Delete single node (and its connected edges)
  const deleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.fromNodeId !== nodeId && e.toNodeId !== nodeId));
  };

  // Delete multiple nodes
  const deleteNodes = (nodeIds: string[]) => {
    const idSet = new Set(nodeIds);
    setNodes(prev => prev.filter(n => !idSet.has(n.id)));
    setEdges(prev =>
      prev.filter(e => !idSet.has(e.fromNodeId) && !idSet.has(e.toNodeId))
    );
  };

  // Update node position (for dragging)
  const updateNodePosition = (nodeId: string, x: number, y: number) => {
    updateNode(nodeId, { x, y });
  };

  // Update node size
  const updateNodeSize = (nodeId: string, width: number, height: number) => {
    updateNode(nodeId, { width, height });
  };

  // Update node label
  const updateNodeLabel = (nodeId: string, label: string) => {
    updateNode(nodeId, { label });
  };

  // Update node color
  const updateNodeColor = (nodeId: string, color: string) => {
    updateNode(nodeId, { color });
  };

  // Update node style properties
  const updateNodeStyle = (nodeId: string, style: {
    fontSize?: number;
    fontStyle?: "sans" | "serif" | "mono";
    align?: "left" | "center" | "right";
    borderStyle?: "solid" | "dashed" | "none";
    strokeWidth?: number;
  }) => {
    updateNode(nodeId, style);
  };

  // Copy nodes with offset
  const copyNodes = (nodeIds: string[], offsetX: number = 100, offsetY: number = 100): FlowNode[] => {
    const nodesToCopy = nodes.filter(n => nodeIds.includes(n.id));
    return nodesToCopy.map(n => ({
      ...n,
      id: `${n.id}-copy-${Date.now()}`,
      x: n.x + offsetX,
      y: n.y + offsetY
    }));
  };

  // Paste copied nodes
  const pasteNodes = (nodesToPaste: FlowNode[]) => {
    const newNodes = nodesToPaste.map(n => ({
      ...n,
      id: `${n.id}-${Math.random().toString(36).substr(2, 9)}`
    }));
    setNodes(prev => [...prev, ...newNodes]);
    return newNodes;
  };

  // Get node by ID
  const getNode = (nodeId: string): FlowNode | undefined => {
    return nodes.find(n => n.id === nodeId);
  };

  // Get nodes by IDs
  const getNodes = (nodeIds: string[]): FlowNode[] => {
    const idSet = new Set(nodeIds);
    return nodes.filter(n => idSet.has(n.id));
  };

  // --- EDGE OPERATIONS ---

  // Add edge between nodes
  const addEdge = (edge: FlowEdge) => {
    // Check if edge already exists
    if (edges.some(e => e.fromNodeId === edge.fromNodeId && e.toNodeId === edge.toNodeId)) {
      toast.warning("Koneksi sudah ada antara dua node ini!");
      return false;
    }
    setEdges(prev => [...prev, edge]);
    return true;
  };

  // Update edge label
  const updateEdgeLabel = (edgeId: string, label: string) => {
    setEdges(prev =>
      prev.map(e => e.id === edgeId ? { ...e, label } : e)
    );
  };

  // Delete edge
  const deleteEdge = (edgeId: string) => {
    setEdges(prev => prev.filter(e => e.id !== edgeId));
  };

  // Delete edges connected to node
  const deleteNodeEdges = (nodeId: string) => {
    setEdges(prev =>
      prev.filter(e => e.fromNodeId !== nodeId && e.toNodeId !== nodeId)
    );
  };

  // Get edges connected to node
  const getNodeEdges = (nodeId: string): FlowEdge[] => {
    return edges.filter(e => e.fromNodeId === nodeId || e.toNodeId === nodeId);
  };

  // Get edge by ID
  const getEdge = (edgeId: string): FlowEdge | undefined => {
    return edges.find(e => e.id === edgeId);
  };

  // Get incoming edges for node
  const getIncomingEdges = (nodeId: string): FlowEdge[] => {
    return edges.filter(e => e.toNodeId === nodeId);
  };

  // Get outgoing edges from node
  const getOutgoingEdges = (nodeId: string): FlowEdge[] => {
    return edges.filter(e => e.fromNodeId === nodeId);
  };

  // --- BATCH OPERATIONS ---

  // Clear all nodes and edges
  const clearCanvas = () => {
    setNodes([]);
    setEdges([]);
  };

  // Load nodes and edges
  const loadContent = (newNodes: FlowNode[], newEdges: FlowEdge[]) => {
    setNodes(JSON.parse(JSON.stringify(newNodes)));
    setEdges(JSON.parse(JSON.stringify(newEdges)));
  };

  // Get canvas content
  const getContent = () => ({
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges))
  });

  // Get node count
  const getNodeCount = (): number => nodes.length;

  // Get edge count
  const getEdgeCount = (): number => edges.length;

  // Check if node exists
  const nodeExists = (nodeId: string): boolean => nodes.some(n => n.id === nodeId);

  // Check if edge exists
  const edgeExists = (fromNodeId: string, toNodeId: string): boolean => {
    return edges.some(e => e.fromNodeId === fromNodeId && e.toNodeId === toNodeId);
  };

  return {
    // State
    nodes,
    setNodes,
    edges,
    setEdges,

    // Node CRUD
    addNode,
    updateNode,
    deleteNode,
    deleteNodes,
    updateNodePosition,
    updateNodeSize,
    updateNodeLabel,
    updateNodeColor,
    updateNodeStyle,
    copyNodes,
    pasteNodes,
    getNode,
    getNodes,

    // Edge CRUD
    addEdge,
    updateEdgeLabel,
    deleteEdge,
    deleteNodeEdges,
    getNodeEdges,
    getEdge,
    getIncomingEdges,
    getOutgoingEdges,

    // Batch operations
    clearCanvas,
    loadContent,
    getContent,
    getNodeCount,
    getEdgeCount,
    nodeExists,
    edgeExists
  };
}
