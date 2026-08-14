import { safeLocalStorage, safeSessionStorage } from "../../lib/safeStorage";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useFlowchartCanvas } from "../../hooks/useFlowchartCanvas";
import { useFlowchartUI } from "../../hooks/useFlowchartUI";
import { useFlowchartHistory } from "../../hooks/useFlowchartHistory";
import { useFlowchartSelection } from "../../hooks/useFlowchartSelection";
import { useFlowchartList } from "../../hooks/useFlowchartList";
import { useFlowchartNodes } from "../../hooks/useFlowchartNodes";
import { 
  Plus, Trash2, ArrowRight, Save, RotateCcw, 
  Sparkles, ExternalLink, Eye, Check,
  Workflow, Database as DbIcon, Square, Circle as CircleIcon, 
  Layers, MousePointer, Hand,
  StickyNote, Type, Moon, Sun, Copy, AlignLeft, 
  AlignCenter, AlignRight, ZoomIn, ZoomOut,
  Cloud, ChevronDown, Search, BookOpen, Edit3, X, FileText, HelpCircle, Info,
  Folder, User, Undo, Redo, Play, Download, RefreshCw, Upload, Image as ImageIcon,
  LayoutGrid, Undo2, Redo2, Database, Activity, Minus, LayoutTemplate,
  Users,
  Clock,
  CheckCircle,
  FileSpreadsheet
} from "lucide-react";
import { toJpeg } from "html-to-image";
import { Task, Project } from "../../types";
import { cn } from "../../lib/utils";
import { ResponsiveTable } from "../../components/ResponsiveTable";
import { toast } from "sonner";
import { apiRequest } from "../../lib/api";
import { motion } from "framer-motion";
import { ConfirmationModal } from "../../components/ui/ConfirmationModal";
import { confirmDeleteAlert, showSuccessAlert } from "../../lib/sweetalert";
import { FlowchartMinimap } from "./components/FlowchartMinimap";
import { NodeContextMenu } from "./components/NodeContextMenu";
import { CanvasContextMenu } from "./components/CanvasContextMenu";
import type {
  FlowNode,
  FlowEdge,
  FlowchartDocument,
  FlowchartData,
  Point,
} from "./types";
import { findSmartRoute } from "./lib/routing";
import { colorPaletteHex } from "./constants";
// Diberi akhiran Api karena useFlowchartList() juga mengekspos updateFlowchart
// dan deleteFlowchart untuk state daftar lokal. Nama berbeda mencegah salah
// panggil, sekaligus memperjelas mana yang menembak backend.
import {
  fetchFlowcharts,
  createFlowchart as createFlowchartApi,
  updateFlowchart as updateFlowchartApi,
  deleteFlowchart as deleteFlowchartApi,
} from "./services/flowchart.service";
import {
  customSvgTypes,
  renderCustomSvgShape,
  renderMiniPreviewIcon,
} from "./lib/shapes";
import { DIAGRAM_SHAPE_GROUPS } from "./constants";

interface FlowchartViewProps {
  selectedProject: Project;
  tasks: Task[];
  projectMembers: any[];
  setSelectedTaskForDetail: (task: Task) => void;
  setIsTaskDetailModalOpen: (isOpen: boolean) => void;
  currentUserProfile?: any;
  onSaveFlowcharts?: (data: any) => Promise<void>;
}

export const FlowchartView: React.FC<FlowchartViewProps> = ({
  selectedProject,
  tasks,
  projectMembers,
  setSelectedTaskForDetail,
  setIsTaskDetailModalOpen,
  currentUserProfile,
  onSaveFlowcharts
}) => {
  // Get active logged in user author name dynamically
  const getResolvedAuthor = () => {
    if (currentUserProfile?.displayName) return currentUserProfile.displayName;
    if (currentUserProfile?.username) return currentUserProfile.username;
    try {
      const saved = safeSessionStorage.getItem("sessionUser") || safeLocalStorage.getItem("sessionUser");
      if (saved) {
        const u = JSON.parse(saved);
        return u?.displayName || u?.username || u?.email || "Administrator";
      }
    } catch (err) {
      console.error(err);
    }
    return "Administrator";
  };

  // BOLA & Authorization Check (LanPro v1.4)
  const effectiveUser = currentUserProfile || (() => {
    try {
      const stored = safeLocalStorage.getItem('sessionUser') || safeLocalStorage.getItem('lanpro_user') || safeSessionStorage.getItem('sessionUser');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  })();
  const currentUserId = effectiveUser?.id || effectiveUser?.uid || effectiveUser?.userId;
  const userRoleStr = effectiveUser?.role || effectiveUser?.system_role || 'user';
  const isAdmin = ['admin', 'sadm', 'admn'].includes(String(userRoleStr).toLowerCase());

  const isAuthor = (fw: FlowchartData) => {
    if (!fw || !effectiveUser) return false;
    const author = String(fw.createdBy || '').trim().toLowerCase();
    const curId = String(effectiveUser.id || '').trim().toLowerCase();
    const curUid = String(effectiveUser.uid || '').trim().toLowerCase();
    const curUser = String(effectiveUser.username || '').trim().toLowerCase();
    const curEmail = String(effectiveUser.email || '').trim().toLowerCase();
    const curName = String(effectiveUser.name || '').trim().toLowerCase();
    const curDisplay = String(effectiveUser.displayName || '').trim().toLowerCase();
    
    return (
      author !== "" && (
        author === curId ||
        author === curUid ||
        author === curUser ||
        author === curEmail ||
        author === curName ||
        author === curDisplay
      )
    );
  };
  const canModifyFlowchart = (fw: FlowchartData) => isAuthor(fw) || isAdmin;

  // Canvas Viewport & Theme Management
  const canvasHook = useFlowchartCanvas();
  const {
    panOffset, setPanOffset, zoomLevel, setZoomLevel, isPanning, setIsPanning,
    panStart, setPanStart,
    canvasTheme, setCanvasTheme, isSnapToGrid, setIsSnapToGrid,
    canvasContainerRef, isPanningRef, startCanvasPanning, updatePanOffset, stopCanvasPanning,
    toggleCanvasTheme, toggleGridSnap, resetZoom, resetPan, resetCanvas, applyGridSnap
  } = canvasHook;

  // UI Modals & Sidebars
  const uiHook = useFlowchartUI();
  const {
    isModalOpen, setIsModalOpen, modalMode, setModalMode, editingFlowId, setEditingFlowId,
    flowName, setFlowName, flowEpicId, setFlowEpicId, flowDescription, setFlowDescription,
    flowCategory, setFlowCategory, flowCreator, setFlowCreator, flowExternalUrl, setFlowExternalUrl,
    isUploadDocModalOpen, setIsUploadDocModalOpen, uploadDocName, setUploadDocName,
    uploadDocFile, setUploadDocFile, uploadDocBase64, setUploadDocBase64, activeDocumentId, setActiveDocumentId,
    rightViewMode, setRightViewMode,
    isLeftSidebarOpen, setIsLeftSidebarOpen, isRightSidebarOpen, setIsRightSidebarOpen,
    isShapeDropdownOpen, setIsShapeDropdownOpen, shapeSearchQuery, setShapeSearchQuery,
    selectedAddColor, setSelectedAddColor, expandedGroups, setExpandedGroups,
    isKeyboardHelpOpen, setIsKeyboardHelpOpen, hoverCoords, setHoverCoords,
    isImportModalOpen, setIsImportModalOpen, importType, setImportType, parsedImportData,
    setParsedImportData, parsedFilename, setParsedFilename, dragOverImport, setDragOverImport,
    openCreateFlowModal, openEditFlowModal, closeFlowModal, resetFlowFormFields,
    toggleLeftSidebar, toggleRightSidebar,
    toggleShapeDropdown, toggleGroupExpanded, toggleKeyboardHelp, openImportModal, closeImportModal
  } = uiHook;

  // History & Undo/Redo Management
  const historyHook = useFlowchartHistory();
  const {
    historyStack, historyIndex, activeSimNodeId, isSimulating, simCancelRef,
    // Keempat setter di bawah dipakai langsung oleh handleApplyImportReplace dan
    // handleSimulateFlow. Sebelumnya tidak ikut di-destructure, sehingga kedua
    // handler itu melempar ReferenceError begitu tombolnya ditekan.
    setHistoryStack, setHistoryIndex, setActiveSimNodeId, setIsSimulating,
    recordHistory, handleUndo, handleRedo, canUndo, canRedo, clearHistory, initializeHistory,
    getHistoryDepth, getHistoryPosition, startSimulation, stopSimulation, cancelSimulation
  } = historyHook;

  // Node/Edge Selection & Tool Management
  const selectionHook = useFlowchartSelection();
  const {
    selectedNodeId, setSelectedNodeId, selectedEdgeId, setSelectedEdgeId,
    activeTool, setActiveTool, connectSourceId, setConnectSourceId,
    isSpacePressed, setIsSpacePressed, hoveredNodeId, setHoveredNodeId,
    hoveredEdgeId, setHoveredEdgeId, copiedNodes, setCopiedNodes,
    marqueeBox, setMarqueeBox, clearSelection, selectNode, selectEdge,
    switchTool, startConnection, completeConnection, copyNodesToClipboard,
    getClipboardNodes, clearClipboard, setMarqueeSelection, updateMarqueeBox,
    isNodeSelected, isEdgeSelected, isNodeHovered, isEdgeHovered,
    isInConnectMode, isInPanMode, hasSelection, hasClipboardContent,
    getMarqueeSelectionCount
  } = selectionHook;

  // Saved Flowcharts List & Pagination
  const listHook = useFlowchartList();
  const {
    flowcharts, setFlowcharts, selectedFlowId, setSelectedFlowId,
    isEditorActive, setIsEditorActive, searchQuery, setSearchQuery,
    currentPage, setCurrentPage, itemsPerPage, setItemsPerPage,
    sortBy, setSortBy, confirmModal, setConfirmModal,
    addFlowchart, updateFlowchart, deleteFlowchart, closeConfirmModal,
    getCurrentFlowchart, getFilteredFlowcharts, getPaginatedFlowcharts,
    getTotalPages, getTotalCount, resetPagination, resetFilters,
    selectFlowchart, exitEditor, toggleEditor, addDocumentToFlowchart,
    removeDocumentFromFlowchart
  } = listHook;

  // Node & Edge Management
  const nodesHook = useFlowchartNodes();
  const {
    nodes, setNodes, edges, setEdges,
    addNode, updateNode, deleteNode, deleteNodes, updateNodePosition,
    updateNodeSize, updateNodeLabel, updateNodeColor, updateNodeStyle,
    copyNodes, pasteNodes, getNode, getNodes,
    addEdge, updateEdgeLabel, deleteEdge, deleteNodeEdges, getNodeEdges,
    getEdge, getIncomingEdges, getOutgoingEdges, clearCanvas, loadContent,
    getContent, getNodeCount, getEdgeCount, nodeExists, edgeExists
  } = nodesHook;

  const currentFlowMetadata = useMemo(() => {
    return getCurrentFlowchart();
  }, [flowcharts, selectedFlowId]);

  const isWorkspaceEditable = useMemo(() => {
    if (!selectedFlowId) return true;
    if (!currentFlowMetadata) return true;
    return canModifyFlowchart(currentFlowMetadata);
  }, [selectedFlowId, currentFlowMetadata, canModifyFlowchart]);





  // Right-click context menu state for flowchart nodes
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [canvasContextMenu, setCanvasContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Custom connection line routing types: bezier (curved), straight (direct), orthogonal (clean right-angles)
  const [connectorType, setConnectorType] = useState<'bezier' | 'straight' | 'orthogonal'>('bezier');

  // Node Interactive Resizing properties
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{
    clientX: number;
    clientY: number;
    initialWidth: number;
    initialHeight: number;
    initialX: number;
    initialY: number;
    direction: "se" | "e" | "s";
  } | null>(null);

  // Drag and Drop (Node moving)
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);


  const decodeHtmlEntity = (htmlText: string): string => {
    if (typeof document === "undefined") return htmlText;
    const txt = document.createElement("textarea");
    txt.innerHTML = htmlText;
    return txt.value;
  };

  const parseDrawIoXML = (xmlText: string): { nodes: FlowNode[]; edges: FlowEdge[] } => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    
    const parseError = xmlDoc.getElementsByTagName("parsererror");
    if (parseError.length > 0) {
      throw new Error("Format XML Draw.io tidak valid atau rusak.");
    }
    
    const cells = xmlDoc.getElementsByTagName("mxCell");
    if (cells.length === 0) {
      throw new Error("Tidak ditemukan elemen diagram <mxCell> di dalam Draw.io XML.");
    }

    const extractedNodes: FlowNode[] = [];
    const extractedEdges: FlowEdge[] = [];
    const nodeIdsSet = new Set<string>();

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const id = cell.getAttribute("id");
      const vertex = cell.getAttribute("vertex");
      const edge = cell.getAttribute("edge");
      const valueAttr = cell.getAttribute("value") || "";
      
      if (!id || id === "0" || id === "1") continue;

      if (vertex === "1") {
        const geometry = cell.getElementsByTagName("mxGeometry")[0];
        let x = Math.floor(Math.random() * 150 + 100);
        let y = Math.floor(Math.random() * 150 + 100);
        let width = 125;
        let height = 85;

        if (geometry) {
          x = parseFloat(geometry.getAttribute("x") || `${x}`);
          y = parseFloat(geometry.getAttribute("y") || `${y}`);
          width = parseFloat(geometry.getAttribute("width") || "125");
          height = parseFloat(geometry.getAttribute("height") || "85");
        }

        let decodedLabel = decodeHtmlEntity(valueAttr)
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n")
          .replace(/<[^>]*>/g, "")
          .trim();
        
        if (!decodedLabel) {
          decodedLabel = "Komponen Alur";
        }

        const style = cell.getAttribute("style") || "";
        let type: FlowNode["type"] = "rect";
        let color = "indigo";

        if (style.includes("ellipse") || style.includes("oval") || style.includes("circle")) {
          type = "oval";
          color = "emerald";
        } else if (style.includes("rhombus") || style.includes("diamond")) {
          type = "diamond";
          color = "orange";
        } else if (style.includes("cylinder") || style.includes("db") || style.includes("database")) {
          type = "cylinder";
          color = "sky";
        } else if (style.includes("cloud")) {
          type = "cloud";
          color = "slate";
        } else if (style.includes("parallelogram")) {
          type = "parallelogram";
          color = "yellow";
        } else if (style.includes("document")) {
          type = "document";
          color = "blue";
        } else if (style.includes("actor")) {
          type = "actor";
          color = "purple";
        } else if (style.includes("lambda")) {
          type = "awsLambda";
          color = "orange";
        } else if (style.includes("class")) {
          type = "umlClass";
          color = "slate";
        }

        extractedNodes.push({
          id: `drawio-${id}`,
          type,
          x,
          y,
          label: decodedLabel,
          color,
          fontSize: 12,
          align: "center",
          width,
          height,
          borderStyle: "solid",
          strokeWidth: 2,
        });
        nodeIdsSet.add(`drawio-${id}`);
      } else if (edge === "1") {
        const sourceId = cell.getAttribute("source");
        const targetId = cell.getAttribute("target");
        
        if (sourceId && targetId) {
          const edgeId = `drawio-edge-${id}`;
          let labelText = decodeHtmlEntity(valueAttr)
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>/gi, "\n")
            .replace(/<[^>]*>/g, "")
            .trim();

          extractedEdges.push({
            id: edgeId,
            fromNodeId: `drawio-${sourceId}`,
            toNodeId: `drawio-${targetId}`,
            label: labelText || undefined,
          });
        }
      }
    }

    const validEdges = extractedEdges.filter(
      (e) => nodeIdsSet.has(e.fromNodeId) && nodeIdsSet.has(e.toNodeId)
    );

    return { nodes: extractedNodes, edges: validEdges };
  };

  const parseMiroContent = (fileContent: string, isCsv: boolean): { nodes: FlowNode[]; edges: FlowEdge[] } => {
    if (isCsv) {
      const lines = fileContent.split(/\r?\n/);
      if (lines.length < 2) {
        throw new Error("File CSV kosong atau tidak memiliki data.");
      }

      const headers = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, "").toLowerCase());
      const rows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cells: string[] = [];
        let currentCell = "";
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            cells.push(currentCell.trim().replace(/^["']|["']$/g, ""));
            currentCell = "";
          } else {
            currentCell += char;
          }
        }
        cells.push(currentCell.trim().replace(/^["']|["']$/g, ""));

        const rowObj: any = {};
        headers.forEach((h, idx) => {
          rowObj[h] = cells[idx] || "";
        });
        rows.push(rowObj);
      }

      const extractedNodes: FlowNode[] = [];
      const extractedEdges: FlowEdge[] = [];
      const nodeIdsSet = new Set<string>();

      rows.forEach((row, idx) => {
        const id = row.id || `miro-row-${idx}`;
        const source = row.from || row["from id"] || row.source;
        const target = row.to || row["to id"] || row.target;

        if (source && target) {
          extractedEdges.push({
            id: `miro-edge-${id}`,
            fromNodeId: `miro-${source}`,
            toNodeId: `miro-${target}`,
            label: row.label || row.text || row.value || undefined,
          });
        } else {
          let x = parseFloat(row.x || row.left || "150") || (idx * 60 + 100);
          let y = parseFloat(row.y || row.top || "150") || (idx * 40 + 120);
          let width = parseFloat(row.width || "120") || 120;
          let height = parseFloat(row.height || "80") || 80;
          
          let labelText = row.text || row.label || row.content || row.title || `Komponen Miro ${idx + 1}`;
          labelText = decodeHtmlEntity(labelText).replace(/<[^>]*>/g, "").trim();

          let type: FlowNode["type"] = "rect";
          const parsedShape = (row.shape || row.type || "").toLowerCase();
          if (parsedShape.includes("circle") || parsedShape.includes("oval")) {
            type = "oval";
          } else if (parsedShape.includes("rhombus") || parsedShape.includes("diamond")) {
            type = "diamond";
          } else if (parsedShape.includes("cylinder") || parsedShape.includes("database")) {
            type = "cylinder";
          } else if (parsedShape.includes("cloud")) {
            type = "cloud";
          }

          extractedNodes.push({
            id: `miro-${id}`,
            type,
            x,
            y,
            label: labelText,
            color: "indigo",
            fontSize: 12,
            align: "center",
            width,
            height,
            borderStyle: "solid",
            strokeWidth: 2,
          });
          nodeIdsSet.add(`miro-${id}`);
        }
      });

      const validEdges = extractedEdges.filter(
        (e) => nodeIdsSet.has(e.fromNodeId) && nodeIdsSet.has(e.toNodeId)
      );

      return { nodes: extractedNodes, edges: validEdges };

    } else {
      const parsed = JSON.parse(fileContent);
      let items: any[] = [];

      if (Array.isArray(parsed)) {
        items = parsed;
      } else if (parsed.data && Array.isArray(parsed.data)) {
        items = parsed.data;
      } else if (parsed.widgets && Array.isArray(parsed.widgets)) {
        items = parsed.widgets;
      } else if (parsed.items && Array.isArray(parsed.items)) {
        items = parsed.items;
      } else {
        const potentialArray = Object.values(parsed).find((val) => Array.isArray(val));
        if (potentialArray) {
          items = potentialArray as any[];
        } else {
          items = [parsed];
        }
      }

      const extractedNodes: FlowNode[] = [];
      const extractedEdges: FlowEdge[] = [];
      const nodeIdsSet = new Set<string>();

      items.forEach((item: any, idx: number) => {
        if (!item) return;
        const id = item.id || `miro-item-${idx}`;
        const typeStr = (item.type || "").toLowerCase();
        
        const isConnector = typeStr === "connector" || typeStr === "line" || typeStr === "link" || item.start || item.from;

        if (!isConnector) {
          let x = 150;
          let y = 150;
          if (item.position) {
            x = typeof item.position.x === "number" ? item.position.x : parseFloat(item.position.x || "150");
            y = typeof item.position.y === "number" ? item.position.y : parseFloat(item.position.y || "150");
          } else if (typeof item.x === "number") {
            x = item.x;
            y = item.y ?? 150;
          }

          let width = 120;
          let height = 80;
          if (item.geometry) {
            width = item.geometry.width || 120;
            height = item.geometry.height || 80;
          } else if (item.width) {
            width = item.width;
            height = item.height || 80;
          }

          let text = "";
          if (item.data && typeof item.data.content === "string") {
            text = item.data.content;
          } else if (item.data && typeof item.data.text === "string") {
            text = item.data.text;
          } else if (typeof item.text === "string") {
            text = item.text;
          } else if (typeof item.title === "string") {
            text = item.title;
          } else if (typeof item.content === "string") {
            text = item.content;
          }

          text = decodeHtmlEntity(text)
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>/gi, "\n")
            .replace(/<[^>]*>/g, "")
            .trim();

          if (!text) {
            text = `Miro ${item.type || "Bentuk"}`;
          }

          let type: FlowNode["type"] = "rect";
          const shapeStyle = ((item.style && item.style.shapeType) || item.shape || "").toLowerCase();
          if (shapeStyle.includes("circle") || shapeStyle.includes("oval")) {
            type = "oval";
          } else if (shapeStyle.includes("rhombus") || shapeStyle.includes("diamond")) {
            type = "diamond";
          } else if (shapeStyle.includes("cylinder") || shapeStyle.includes("database")) {
            type = "cylinder";
          } else if (shapeStyle.includes("cloud")) {
            type = "cloud";
          }

          extractedNodes.push({
            id: `miro-${id}`,
            type,
            x,
            y,
            label: text,
            color: "indigo",
            fontSize: 12,
            align: "center",
            width,
            height,
            borderStyle: "solid",
            strokeWidth: 2,
          });
          nodeIdsSet.add(`miro-${id}`);
        } else {
          const fromNode = item.start?.id || item.startCell || item.from || item.source;
          const toNode = item.end?.id || item.endCell || item.to || item.target;

          if (fromNode && toNode) {
            let label = "";
            if (item.captions && Array.isArray(item.captions) && item.captions[0]) {
              label = item.captions[0].text || "";
            } else if (item.label) {
              label = item.label;
            }

            extractedEdges.push({
              id: `miro-edge-${id}`,
              fromNodeId: `miro-${fromNode}`,
              toNodeId: `miro-${toNode}`,
              label: label ? decodeHtmlEntity(label).replace(/<[^>]*>/g, "").trim() : undefined,
            });
          }
        }
      });

      const validEdges = extractedEdges.filter(
        (e) => nodeIdsSet.has(e.fromNodeId) && nodeIdsSet.has(e.toNodeId)
      );

      return { nodes: extractedNodes, edges: validEdges };
    }
  };

  const handleProcessImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        let result: { nodes: FlowNode[]; edges: FlowEdge[] } | null = null;
        let detectedType: typeof importType = "drawio";

        const fileName = file.name.toLowerCase();
        setParsedFilename(file.name);

        if (fileName.endsWith(".xml") || fileName.endsWith(".drawio")) {
          result = parseDrawIoXML(text);
          detectedType = "drawio";
        } else if (fileName.endsWith(".json")) {
          try {
            const parsedJson = JSON.parse(text);
            if (parsedJson && (parsedJson.nodes !== undefined || parsedJson.edges !== undefined)) {
              result = {
                nodes: Array.isArray(parsedJson.nodes) ? parsedJson.nodes : [],
                edges: Array.isArray(parsedJson.edges) ? parsedJson.edges : [],
              };
              detectedType = "native";
            } else {
              result = parseMiroContent(text, false);
              detectedType = "miro";
            }
          } catch (e) {
            throw new Error("File JSON tidak dapat dibaca atau rusak.");
          }
        } else if (fileName.endsWith(".csv")) {
          result = parseMiroContent(text, true);
          detectedType = "miro";
        } else {
          throw new Error("Format file tidak didukung. Silakan gunakan .xml, .drawio, .json, atau .csv.");
        }

        if (result && (result.nodes.length > 0 || result.edges.length > 0)) {
          setParsedImportData(result);
          setImportType(detectedType);
          toast.success(`Berhasil memuat file "${file.name}"! Ditemukan ${result.nodes.length} bentuk & ${result.edges.length} garis.`);
        } else {
          toast.error("Tidak ditemukan bentuk atau garis alur di dalam file ini.");
        }

      } catch (err: any) {
        toast.error(`Gagal membaca file: ${err.message || err}`);
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  // Auto-save debounced effect to preserve work
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedFlowId) {
        handleSaveWorkspace(true);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [nodes, edges, canvasTheme, selectedFlowId]);

  const handleApplyImportReplace = () => {
    if (!parsedImportData) return;
    setNodes(parsedImportData.nodes);
    setEdges(parsedImportData.edges);
    setHistoryStack([{ nodes: JSON.parse(JSON.stringify(parsedImportData.nodes)), edges: JSON.parse(JSON.stringify(parsedImportData.edges)) }]);
    setHistoryIndex(0);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setIsImportModalOpen(false);
    setParsedImportData(null);
    toast.success("Berhasil menggantikan kanvas dengan alur kerja yang diimpor! 🎉");
  };

  const handleApplyImportMerge = () => {
    if (!parsedImportData) return;
    
    let maxX = 0;
    nodes.forEach(n => {
      if (n.x > maxX) maxX = n.x;
    });

    const shiftX = maxX > 0 ? maxX + 180 : 0;
    const idMap: Record<string, string> = {};

    const finalNodes = parsedImportData.nodes.map(n => {
      const newId = `${n.id}-m-${Math.random().toString(36).substr(2, 5)}`;
      idMap[n.id] = newId;
      return {
        ...n,
        id: newId,
        x: n.x + shiftX,
      };
    });

    const finalEdges = parsedImportData.edges.map(e => ({
      ...e,
      id: `${e.id}-m-${Math.random().toString(36).substr(2, 5)}`,
      fromNodeId: idMap[e.fromNodeId] || e.fromNodeId,
      toNodeId: idMap[e.toNodeId] || e.toNodeId,
    }));

    const mergedNodes = [...nodes, ...finalNodes];
    const mergedEdges = [...edges, ...finalEdges];

    setNodes(mergedNodes);
    setEdges(mergedEdges);
    recordHistory(mergedNodes, mergedEdges);
    
    setIsImportModalOpen(false);
    setParsedImportData(null);
    toast.success("Berhasil menggabungkan diagram yang diimpor ke dalam kanvas Anda! 🚀");
  };

  // Wrapper handlers for undo/redo that apply to state
  const handleUndoClick = () => {
    const snapshot = handleUndo();
    if (snapshot) {
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
    }
  };

  const handleRedoClick = () => {
    const snapshot = handleRedo();
    if (snapshot) {
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
    }
  };

  // Auto layout mathematical alignment helper
  const handleAutoAlignNodes = () => {
    if (nodes.length === 0) {
      toast.error("Kanvas kosong, tidak ada bentuk untuk dirapikan.");
      return;
    }

    const incomingMap = new Map<string, string[]>();
    const outgoingMap = new Map<string, string[]>();

    edges.forEach(e => {
      const incoming = incomingMap.get(e.toNodeId) || [];
      incoming.push(e.fromNodeId);
      incomingMap.set(e.toNodeId, incoming);

      const outgoing = outgoingMap.get(e.fromNodeId) || [];
      outgoing.push(e.toNodeId);
      outgoingMap.set(e.fromNodeId, outgoing);
    });

    const nodeLevels = new Map<string, number>();
    const visited = new Set<string>();

    const startNodes = nodes.filter(n => !incomingMap.has(n.id));
    let queue: { id: string; level: number }[] = [];
    
    if (startNodes.length > 0) {
      startNodes.forEach(sn => queue.push({ id: sn.id, level: 0 }));
    } else {
      queue.push({ id: nodes[0].id, level: 0 });
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;
      visited.add(current.id);

      const currentLevel = Math.max(nodeLevels.get(current.id) || 0, current.level);
      nodeLevels.set(current.id, currentLevel);

      const children = outgoingMap.get(current.id) || [];
      children.forEach(childId => {
        queue.push({ id: childId, level: currentLevel + 1 });
      });
    }

    nodes.forEach(n => {
      if (!nodeLevels.has(n.id)) {
        nodeLevels.set(n.id, 0);
      }
    });

    const levelGroups = new Map<number, string[]>();
    nodeLevels.forEach((level, nodeId) => {
      const group = levelGroups.get(level) || [];
      group.push(nodeId);
      levelGroups.set(level, group);
    });

    const gapX = 260; 
    const gapY = 150; 
    const startX = 180;
    const startY = 160;

    const alignedNodes = nodes.map(node => {
      const level = nodeLevels.get(node.id) || 0;
      const group = levelGroups.get(level) || [];
      const indexInGroup = group.indexOf(node.id);

      const levelHeight = (group.length - 1) * gapY;
      const offsetY = indexInGroup * gapY - levelHeight / 2;

      return {
        ...node,
        x: startX + level * gapX,
        y: Math.max(60, startY + offsetY + 200) 
      };
    });

    setNodes(alignedNodes);
    recordHistory(alignedNodes, edges);
    toast.success("Auto-Layout Sukses! Diagram alur Anda berhasil dirapikan secara otomatis ✨");
  };

  // Sequential Live Flow Simulator Trace
  const handleSimulateFlow = async () => {
    if (nodes.length === 0) {
      toast.error("Kanvas kosong, tidak ada alur yang bisa disimulasikan.");
      return;
    }

    if (isSimulating) {
      simCancelRef.current = true;
      setIsSimulating(false);
      setActiveSimNodeId(null);
      toast.info("Simulasi Alur Kerja Dihentikan.");
      return;
    }
    
    simCancelRef.current = false;
    setIsSimulating(true);
    toast.success("Memulai Simulasi Langkah Hubungan Alur Kerja...", {
      description: "Sistem menelusuri alur kerja dari titik awal hingga akhir."
    });

    const incomingEdgeTargets = new Set(edges.map(e => e.toNodeId));
    let startNodes = nodes.filter(n => !incomingEdgeTargets.has(n.id));
    
    if (startNodes.length === 0) {
      startNodes = nodes.filter(n => n.type === "oval" || n.label.toLowerCase().includes("mulai") || n.label.toLowerCase().includes("start"));
    }
    if (startNodes.length === 0 && nodes.length > 0) {
      startNodes = [nodes[0]];
    }

    const visited = new Set<string>();
    let queue: string[] = startNodes.map(n => n.id);

    while (queue.length > 0 && !simCancelRef.current) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      setActiveSimNodeId(currentId);
      // Wait to capture animation effect
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (simCancelRef.current) break;

      const outEdges = edges.filter(e => e.fromNodeId === currentId);
      const childIds = outEdges.map(e => e.toNodeId);
      queue.push(...childIds);
    }

    setActiveSimNodeId(null);
    setIsSimulating(false);
    if (!simCancelRef.current) {
      toast.success("Simulasi Alur Kerja Selesai!");
    }
  };

  // Download JSON backup
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
      JSON.stringify({
        name: currentFlowMetadata?.name || "Flowchart Workspace",
        nodes,
        edges,
        theme: canvasTheme
      }, null, 2)
    );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${currentFlowMetadata?.name || 'flow_workspace'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("JSON Workspace Berhasil Diunduh!");
  };

  // Download JPG Snapshot
  const handleExportJPG = async () => {
    if (!canvasContainerRef.current) return;
    try {
      toast.info("Menyiapkan gambar...");
      const dataUrl = await toJpeg(canvasContainerRef.current, { backgroundColor: '#f4f7f9', quality: 0.95 });
      const link = document.createElement('a');
      link.download = `${currentFlowMetadata?.name || 'flow_workspace'}.jpg`;
      link.href = dataUrl;
      link.click();
      toast.success("Gambar JPG Berhasil Diunduh!");
    } catch (err) {
      console.error(err);
      toast.error("Gagal mendownload gambar.");
    }
  };

  // Import JSON backup
  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json && (Array.isArray(json.nodes) || Array.isArray(json.edges))) {
          const loadedNodes = Array.isArray(json.nodes) ? json.nodes : [];
          const loadedEdges = Array.isArray(json.edges) ? json.edges : [];
          
          setNodes(loadedNodes);
          setEdges(loadedEdges);
          if (json.theme) setCanvasTheme(json.theme);
          
          setHistoryStack([{ nodes: JSON.parse(JSON.stringify(loadedNodes)), edges: JSON.parse(JSON.stringify(loadedEdges)) }]);
          setHistoryIndex(0);
          
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
          
          toast.success("Workspace Diagram Berhasil Di-import! 🎉");
        } else {
          toast.error("Format JSON tidak valid untuk Diagram Flowchart.");
        }
      } catch (err) {
        toast.error("Gagal membaca file JSON!");
        console.error(err);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  // Clear entire whiteboard canvas with confirmation
  const handleClearWhiteboard = async () => {
    if (nodes.length === 0 && edges.length === 0) {
      toast.info("Kanvas sudah kosong.");
      return;
    }

    const isConfirmed = await confirmDeleteAlert(
      "Kosongkan Kanvas?",
      "Apakah Anda yakin ingin mengosongkan seluruh papan kerja flowchart ini? Semua bentuk dan garis hubung akan dihapus secara permanen."
    );

    if (!isConfirmed) return;

    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    recordHistory([], []);
    showSuccessAlert("Berhasil!", "Kanvas berhasil dikosongkan.");
  };

  // Filter Tasks which are "epics" to hook them up
  const availableEpics = tasks.filter(t => t.type === 'epic');

  // Canvas Native Event Listeners for smooth Wheel Zoom/Pan prevention of page scroll
  // Keyboard Shortcuts for extreme flexibility & high-speed diagramming
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts when the user is typing in a textarea or input field
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT" || activeEl.tagName === "SELECT")) {
        return;
      }

      // Spacebar hold to pan
      if (e.code === "Space") {
        e.preventDefault();
        setIsSpacePressed(true);
      }

      if (!isWorkspaceEditable) {
        if (e.key === "Escape") {
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
          setConnectSourceId(null);
          setCopiedNodes([]);
          setActiveTool("select");
        }
        return;
      }

      // 1. Delete or Backspace for selected items
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeId || copiedNodes.length > 0 || selectedEdgeId) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }

      // 2. Escape to deselect everything
      if (e.key === "Escape") {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setConnectSourceId(null);
        setCopiedNodes([]);
        setActiveTool("select");
      }

      // 3. Arrow Keys to nudge selected node (with snap support)
      if (selectedNodeId && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 20 : 5;
        setNodes(prev => prev.map(n => {
          if (n.id === selectedNodeId) {
            let nextX = n.x;
            let nextY = n.y;
            if (e.key === "ArrowUp") nextY -= step;
            if (e.key === "ArrowDown") nextY += step;
            if (e.key === "ArrowLeft") nextX -= step;
            if (e.key === "ArrowRight") nextX += step;
            
            // Constrain
            nextX = Math.max(10, Math.min(nextX, 3500));
            nextY = Math.max(10, Math.min(nextY, 2800));

            return { ...n, x: nextX, y: nextY };
          }
          return n;
        }));
      }

      // 4. Ctrl+D or Cmd+D to duplicate
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        if (selectedNodeId) {
          e.preventDefault();
          const nodeToDup = nodes.find(n => n.id === selectedNodeId);
          if (nodeToDup) {
            handleDuplicateNode(nodeToDup);
          }
        }
      }

      // Add: Ctrl+A / Cmd+A - Select All (Prepare state for copying)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setCopiedNodes(nodes);
        toast.info(nodes.length + " objek diblok siap disalin (Tekan Ctrl+C lalu Ctrl+V).");
      }

      // Add: Ctrl+C / Cmd+C - Copy
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (selectedNodeId) {
          e.preventDefault();
          const nodeToCopy = nodes.find(n => n.id === selectedNodeId);
          if (nodeToCopy) {
            setCopiedNodes([nodeToCopy]);
            toast.success("Objek disalin!");
          }
        } else if (copiedNodes.length > 0) {
           e.preventDefault();
           toast.success(copiedNodes.length + " objek disalin!");
        }
      }

      // Add: Ctrl+V / Cmd+V - Paste
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        if (copiedNodes.length > 0) {
          const newNodes = copiedNodes.map(n => ({
            ...n,
            id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            x: n.x + 30, // offset pasted copies
            y: n.y + 30
          }));
          setNodes(prev => [...prev, ...newNodes]);
          toast.success(newNodes.length + " objek ditempel!");
          if (newNodes.length === 1) {
            setSelectedNodeId(newNodes[0].id);
          }
        }
      }

      // 5. Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedoClick();
        } else {
          handleUndoClick();
        }
      }

      // 6. Ctrl+Y or Cmd+Y for redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedoClick();
      }

      // Add: Ctrl +/- for zooming canvas precisely instead of zooming native browser window
      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+" || e.key === "-")) {
        e.preventDefault();
        const zoomDelta = e.key === "-" ? -0.1 : 0.1;
        setZoomLevel(prev => Math.min(3.0, Math.max(0.2, prev + zoomDelta)));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedNodeId, selectedEdgeId, nodes, historyIndex, historyStack, copiedNodes]);

  // Global mousemove and mouseup listeners for incredibly smooth dragging, resizing, and panning
  const mouseMoveHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const mouseUpHandlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    mouseMoveHandlerRef.current = (e: MouseEvent) => {
      handleCanvasMouseMove(e as unknown as React.MouseEvent);
    };
    mouseUpHandlerRef.current = () => {
      handleCanvasMouseUp();
    };
  });

  useEffect(() => {
    const isInteractionActive = draggingNodeId !== null || resizingNodeId !== null || isPanning || marqueeBox !== null;
    if (!isInteractionActive) return;

    const onGlobalMouseMove = (e: MouseEvent) => {
      if (mouseMoveHandlerRef.current) {
        mouseMoveHandlerRef.current(e);
      }
    };

    const onGlobalMouseUp = () => {
      if (mouseUpHandlerRef.current) {
        mouseUpHandlerRef.current();
      }
    };

    // Use capturing phase and non-passive listeners for highly responsive tracking
    window.addEventListener("mousemove", onGlobalMouseMove, { capture: true, passive: true });
    window.addEventListener("mouseup", onGlobalMouseUp, { capture: true });

    return () => {
      window.removeEventListener("mousemove", onGlobalMouseMove, { capture: true });
      window.removeEventListener("mouseup", onGlobalMouseUp, { capture: true });
    };
  }, [draggingNodeId !== null, resizingNodeId !== null, isPanning, marqueeBox !== null]);

  // Load flowcharts list scoped by project ID on load
  useEffect(() => {
    const projId = selectedProject?.id || selectedProject?.key || 'default';
    const listKey = `lanpro_flowcharts_${projId}`;
    const saved = safeLocalStorage.getItem(listKey);
    let initialList: FlowchartData[] = [];
    if (saved) {
      try {
        initialList = JSON.parse(saved) as FlowchartData[];
      } catch (e) {
        console.error("Error parsing flowcharts list", e);
      }
    }

    setFlowcharts(initialList);
    setSelectedFlowId(null);
    setNodes([]);
    setEdges([]);

    // Sync from backend API documents
    if (selectedProject?.id) {
      fetchFlowcharts(selectedProject.id)
        .then((apiFlowcharts) => {
          if (apiFlowcharts.length > 0) {
            setFlowcharts(apiFlowcharts);
            safeLocalStorage.setItem(listKey, JSON.stringify(apiFlowcharts));
          }
        })
        .catch(err => {
          console.warn("Could not sync flowcharts from backend API:", err);
        });
    }
  }, [selectedProject?.id, selectedProject?.key]);

  // Init empty flowchart state
  const createDefaultInitialFlowchart = (currentList: FlowchartData[]) => {
    const projId = selectedProject?.id || selectedProject?.key || 'default';
    setFlowcharts(currentList);
    safeLocalStorage.setItem(`lanpro_flowcharts_${projId}`, JSON.stringify(currentList));
    
    // Set active flow states to empty (not pre-selected)
    setSelectedFlowId(null);
    setNodes([]);
    setEdges([]);
    setCanvasTheme("miro");
    setHistoryStack([]);
    setHistoryIndex(0);
    setRightViewMode("embed");
  };

  // Helper to transform Google Drive / Doc / Sheet / Slides / Figma / URL to interactive preview/embed mode
  const getEmbedUrl = (url?: string): string => {
    if (!url) return "";
    let trimmed = url.trim();
    
    // Google Drive File view link (e.g. drive.google.com/file/d/XYZ/view or /edit)
    if (trimmed.includes("drive.google.com/file/d/")) {
      if (trimmed.includes("/view")) {
        return trimmed.replace(/\/view.*$/, "/preview");
      }
      if (trimmed.includes("/edit")) {
        return trimmed.replace(/\/edit.*$/, "/preview");
      }
      if (!trimmed.endsWith("/preview")) {
        return trimmed + "/preview";
      }
      return trimmed;
    }

    // Google Drive Folder link (e.g. drive.google.com/drive/folders/XYZ)
    if (trimmed.includes("drive.google.com/drive/folders/")) {
      const folderId = trimmed.split("folders/")[1]?.split("?")[0];
      if (folderId) {
        return `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`;
      }
    }

    // Check if it's a Google Doc
    if (trimmed.includes("docs.google.com/document")) {
      if (trimmed.includes("/edit")) {
        return trimmed.split("/edit")[0] + "/preview";
      }
      if (!trimmed.includes("/preview")) {
        return trimmed + "/preview";
      }
      return trimmed;
    }
    
    // Check if it's a Google Spreadsheet
    if (trimmed.includes("docs.google.com/spreadsheets")) {
      if (trimmed.includes("/edit")) {
        return trimmed.split("/edit")[0] + "/preview?widget=true&headers=false";
      }
      return trimmed;
    }

    // Check if it's a Google Presentation/Slide
    if (trimmed.includes("docs.google.com/presentation")) {
      if (trimmed.includes("/edit")) {
        return trimmed.split("/edit")[0] + "/embed?start=false&loop=false&delayms=3000";
      }
      return trimmed;
    }

    // Figma URL converter
    if (trimmed.includes("figma.com/file/") || trimmed.includes("figma.com/design/")) {
      return `https://www.figma.com/embed?embed_host=lanpro&url=${encodeURIComponent(trimmed)}`;
    }

    // Return direct URL otherwise
    return trimmed;
  };

  // Select flowchart handler
  const handleSelectFlowchart = (id: string, listToUse?: FlowchartData[]) => {
    const list = listToUse || flowcharts;
    const found = list.find(f => f.id === id);
    if (found) {
      setSelectedFlowId(id);
      const loadedNodes = found.nodes || [];
      const loadedEdges = found.edges || [];
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setCanvasTheme(found.theme || "miro");
      setHistoryStack([{ nodes: JSON.parse(JSON.stringify(loadedNodes)), edges: JSON.parse(JSON.stringify(loadedEdges)) }]);
      setHistoryIndex(0);
      
      // Clean selections
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setConnectSourceId(null);
      setPanOffset({ x: 50, y: 50 });
      setZoomLevel(0.9);
      setRightViewMode("embed");
    }
  };

  // Open creation flow modal
  const openCreateModal = () => {
    const resolvedCreator = getResolvedAuthor();

    setModalMode("create");
    setFlowName("");
    setFlowEpicId("");
    setFlowDescription("");
    setFlowCategory("Panduan");
    setFlowCreator(resolvedCreator);
    setFlowExternalUrl("");
    setIsModalOpen(true);
  };

  // Upload Document Modal Handlers
  const openUploadDocumentModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadDocName("");
    setUploadDocFile(null);
    setUploadDocBase64("");
    setIsUploadDocModalOpen(true);
  };

  const closeUploadDocumentModal = () => {
    setIsUploadDocModalOpen(false);
    setUploadDocName("");
    setUploadDocFile(null);
    setUploadDocBase64("");
  };

  const handleDocumentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Validasi Tipe File (Excel, Word, PDF)
      const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
        toast.error("Format dokumen tidak sesuai! Harap unggah format Excel, Word, atau PDF.");
        return;
      }

      // Validasi max 5MB
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Ukuran dokumen tidak boleh melebihi 5 MB");
        return;
      }
      setUploadDocFile(file);
      if (!uploadDocName) {
        setUploadDocName(file.name);
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadDocBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveDocument = () => {
    if (!uploadDocName.trim() || !uploadDocFile || !uploadDocBase64) {
      toast.error("Nama dokumen dan file dokumen wajib diisi!");
      return;
    }

    if (!selectedFlowId) {
      toast.error("Pilih flowchart terlebih dahulu!");
      return;
    }

    const projId = selectedProject?.id || selectedProject?.key || 'default';
    
    const newDoc: FlowchartDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: uploadDocName.trim(),
      fileName: uploadDocFile.name,
      fileType: uploadDocFile.type,
      fileSize: uploadDocFile.size,
      fileData: uploadDocBase64,
      createdAt: new Date().toLocaleString("id-ID"),
      createdBy: getResolvedAuthor()
    };

    setFlowcharts(currentFlowcharts => {
      const updatedList = currentFlowcharts.map(f => {
        if (f.id === selectedFlowId) {
          return {
            ...f,
            documents: [...(f.documents || []), newDoc],
            lastEditedAt: new Date().toLocaleString("id-ID")
          };
        }
        return f;
      });
      try {
        safeLocalStorage.setItem(`lanpro_flowcharts_${projId}`, JSON.stringify(updatedList));
      } catch (err) {
        console.warn("Storage quota exceeded, could not save locally:", err);
      }
      return updatedList;
    });

    toast.success("Dokumen berhasil diunggah!");
    closeUploadDocumentModal();
  };

  // Open edit description modal
  const openEditModal = (flow: FlowchartData, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalMode("edit");
    setEditingFlowId(flow.id);
    setFlowName(flow.name);
    setFlowEpicId(flow.epicTaskId || "");
    setFlowDescription(flow.description || "");
    setFlowCategory(flow.category || "Panduan");
    setFlowCreator(flow.createdBy || getResolvedAuthor());
    setFlowExternalUrl(flow.externalUrl || "");
    setIsModalOpen(true);
  };

  // Save Flowchart list & current items to LocalStorage & Backend API
  const handleSaveWorkspace = async (isAutoSave = false) => {
    if (!selectedFlowId) return;

    const projId = selectedProject?.id || selectedProject?.key || 'default';
    setFlowcharts(currentFlowcharts => {
      const updatedList = currentFlowcharts.map(f => {
        if (f.id === selectedFlowId) {
          return {
            ...f,
            nodes,
            edges,
            theme: canvasTheme,
            lastEditedAt: new Date().toLocaleString("id-ID")
          };
        }
        return f;
      });
      try {
        safeLocalStorage.setItem(`lanpro_flowcharts_${projId}`, JSON.stringify(updatedList));
      } catch (err) {
        console.warn("Storage quota exceeded, could not save locally:", err);
      }
      return updatedList;
    });

    if (!isAutoSave) {
      if (onSaveFlowcharts) {
        try {
          const workspaceData = {
            projectId: projId,
            flowcharts: JSON.parse(safeLocalStorage.getItem(`lanpro_flowcharts_${projId}`) || "[]")
          };
          await onSaveFlowcharts(workspaceData);
        } catch (err) {
          console.warn("Could not sync flowchart workspace to API:", err);
        }
      }

      toast.success("Berhasil menyimpan seluruh skema alur flowchart Anda!");
    }
  };

  // Delete an entire flowchart diagram
  const handleDeleteFlowchart = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const isConfirmed = await confirmDeleteAlert(
      "Hapus Flowchart?",
      "Apakah Anda yakin ingin menghapus dokumentasi flowchart ini secara permanen?"
    );

    if (!isConfirmed) return;

    const projId = selectedProject?.id || selectedProject?.key || 'default';
    const remaining = flowcharts.filter(f => f.id !== id);
    setFlowcharts(remaining);
    safeLocalStorage.setItem(`lanpro_flowcharts_${projId}`, JSON.stringify(remaining));
    
    if (selectedFlowId === id) {
      if (remaining.length > 0) {
        handleSelectFlowchart(remaining[0].id, remaining);
      } else {
        setSelectedFlowId(null);
        setNodes([]);
        setEdges([]);
      }
    }
    
    showSuccessAlert("Berhasil!", "Flowchart berhasil dihapus.");

    if (selectedProject?.id && !id.startsWith("flow_")) {
      try {
        await deleteFlowchartApi(selectedProject.id, id);
      } catch (err) {
        console.warn("Could not delete flowchart from API:", err);
      }
    }
  };

  // Modal Submit (Create / Edit metadata)
  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flowName.trim()) {
      toast.error("Nama flowchart wajib diisi.");
      return;
    }

    const projId = selectedProject?.id || selectedProject?.key || 'default';
    const listKey = `lanpro_flowcharts_${projId}`;
    
    const currentAuthor = getResolvedAuthor();
    const currentTimestamp = new Date().toLocaleString("id-ID");

    if (modalMode === "create") {
      const newId = "flow_" + Date.now();
      const newFlow: FlowchartData = {
        id: newId,
        name: flowName.trim(),
        category: flowCategory,
        epicTaskId: flowEpicId,
        description: flowDescription,
        nodes: [
          { id: "node_start", type: "oval", x: 150, y: 150, label: "Mulai", color: "emerald", width: 140, height: 70, fontSize: 12 }
        ],
        edges: [],
        theme: "miro",
        createdAt: new Date().toLocaleDateString("id-ID"),
        createdBy: flowCreator || currentAuthor,
        lastEditedAt: currentTimestamp,
        externalUrl: flowExternalUrl
      };

      const updated = [newFlow, ...flowcharts];
      setFlowcharts(updated);
      safeLocalStorage.setItem(listKey, JSON.stringify(updated));
      setSelectedFlowId(null);
      setNodes([]);
      setEdges([]);
      setIsEditorActive(false);
      setCurrentPage(1);
      setSearchQuery("");
      setIsModalOpen(false);
      toast.success(`Berhasil membuat flowchart: ${flowName}`);

      // Async sync with backend API
      if (selectedProject?.id) {
        try {
          await createFlowchartApi(selectedProject.id, newFlow);
        } catch (apiErr) {
          console.warn("API sync error (saved locally):", apiErr);
        }
      }
    } else {
      // Edit
      const updated = flowcharts.map(f => {
        if (f.id === editingFlowId) {
          return {
            ...f,
            name: flowName.trim(),
            category: flowCategory,
            epicTaskId: flowEpicId,
            description: flowDescription,
            createdBy: flowCreator,
            externalUrl: flowExternalUrl,
            lastEditedAt: currentTimestamp
          };
        }
        return f;
      });

      setFlowcharts(updated);
      safeLocalStorage.setItem(listKey, JSON.stringify(updated));
      toast.success("Dokumentasi berhasil diperbarui!");
      setIsModalOpen(false);

      if (selectedProject?.id && editingFlowId && !editingFlowId.startsWith("flow_")) {
        try {
          const foundFlow = updated.find(f => f.id === editingFlowId);
          await updateFlowchartApi(selectedProject.id, editingFlowId, {
            name: flowName.trim(),
            nodes: foundFlow?.nodes || [],
            edges: foundFlow?.edges || [],
            externalUrl: flowExternalUrl,
          });
        } catch (apiErr) {
          console.warn("API sync error:", apiErr);
        }
      }
    }
  };

  // Floating Actions node parameters updates
  const handleUpdateActiveNode = (props: Partial<FlowNode>) => {
    if (!selectedNodeId) return;
    const updated = nodes.map(n => n.id === selectedNodeId ? { ...n, ...props } : n);
    setNodes(updated);
  };

  // Add flow symbol/shape to workspace
  const handleAddNewNode = (type: FlowNode["type"], customColor?: string) => {
    const id = "node_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    
    let defaultLabel = "Teks Baru";
    let defaultColor = customColor || "indigo";
    let width = 140;
    let height = 70;
    let fSize = 12;
    let fStyle: FlowNode["fontStyle"] = "sans";
    let alignment: FlowNode["align"] = "center";
    let bdStyle: FlowNode["borderStyle"] = "solid";

    switch (type) {
      case "sticky":
        defaultLabel = "Ide / Catatan Tempel Miro";
        defaultColor = customColor || "yellow";
        width = 110;
        height = 110;
        fSize = 13;
        fStyle = "serif";
        bdStyle = "none";
        break;
      case "oval":
        defaultLabel = "Mulai / Selesai";
        defaultColor = "emerald";
        width = 130;
        height = 65;
        break;
      case "rect":
        defaultLabel = "Proses Langkah Kerja";
        defaultColor = "indigo";
        width = 155;
        height = 70;
        break;
      case "diamond":
        defaultLabel = "Review & Audit?";
        defaultColor = "amber";
        width = 110;
        height = 110;
        break;
      case "cylinder":
        defaultLabel = "Database / Server";
        defaultColor = "sky";
        width = 125;
        height = 80;
        break;
      case "cloud":
        defaultLabel = "Cloud Architecture BNI";
        defaultColor = "violet";
        width = 160;
        height = 85;
        break;
      case "circle":
        defaultLabel = "Category";
        defaultColor = "pink";
        width = 90;
        height = 90;
        break;
      case "card":
        defaultLabel = "Story / Backlog Task";
        defaultColor = "slate";
        width = 180;
        height = 95;
        alignment = "left";
        break;
      case "text":
        defaultLabel = "Ketik penjelasan bebas...";
        defaultColor = "slate";
        width = 200;
        height = 50;
        bdStyle = "none";
        fSize = 14;
        break;
      case "parallelogram":
        defaultLabel = "Data Input / Output";
        defaultColor = "orange";
        width = 145;
        height = 70;
        break;
      case "document":
        defaultLabel = "Dokumen / File Laporan";
        defaultColor = "rose";
        width = 135;
        height = 75;
        break;
      case "subprocess":
        defaultLabel = "Sub-proses / Predefined";
        defaultColor = "blue";
        width = 155;
        height = 70;
        break;
      case "actor":
        defaultLabel = "Aktor / Role Pengguna";
        defaultColor = "green";
        width = 100;
        height = 100;
        break;
      case "folder":
        defaultLabel = "Penyimpanan / Folder";
        defaultColor = "amber";
        width = 140;
        height = 75;
        break;
      case "decision":
        defaultLabel = "Keputusan Kerja / Decision?";
        defaultColor = "orange";
        width = 110;
        height = 110;
        break;
      case "predefined":
        defaultLabel = "Sub-Prosedur / Fungsi Predef";
        defaultColor = "blue";
        width = 155;
        height = 70;
        break;
      case "database":
        defaultLabel = "Database Server BNI";
        defaultColor = "sky";
        width = 125;
        height = 80;
        break;
      case "triangle":
        defaultLabel = "Merge / Extract";
        defaultColor = "pink";
        width = 110;
        height = 100;
        break;
      case "pentagon":
        defaultLabel = "Pentagon Step";
        defaultColor = "blue";
        width = 110;
        height = 110;
        break;
      case "hexagon":
        defaultLabel = "Preparation / Hex";
        defaultColor = "indigo";
        width = 130;
        height = 90;
        break;
      case "octagon":
        defaultLabel = "Stop / Octagon";
        defaultColor = "rose";
        width = 110;
        height = 110;
        break;
      case "star":
        defaultLabel = "Highlight / Star";
        defaultColor = "yellow";
        width = 110;
        height = 110;
        break;
      case "arrowRight":
        defaultLabel = "Next Step";
        defaultColor = "slate";
        width = 140;
        height = 80;
        break;
      case "arrowLeft":
        defaultLabel = "Previous Step";
        defaultColor = "slate";
        width = 140;
        height = 80;
        break;
      case "arrowLeftRight":
        defaultLabel = "Bidirectional Hub";
        defaultColor = "slate";
        width = 140;
        height = 80;
        break;
      case "trapezoid":
        defaultLabel = "Manual Operation";
        defaultColor = "orange";
        width = 135;
        height = 75;
        break;
      case "cross":
        defaultLabel = "Summing Junction";
        defaultColor = "rose";
        width = 100;
        height = 100;
        break;
      case "curlyLeft":
        defaultLabel = "{ Grouping";
        defaultColor = "purple";
        width = 100;
        height = 140;
        bdStyle = "solid";
        break;
      case "curlyRight":
        defaultLabel = "Grouping }";
        defaultColor = "purple";
        width = 100;
        height = 140;
        bdStyle = "solid";
        break;
      case "chevron":
        defaultLabel = "Chevron Arrow";
        defaultColor = "indigo";
        width = 140;
        height = 75;
        break;
      case "delay":
        defaultLabel = "System Delay";
        defaultColor = "yellow";
        width = 130;
        height = 75;
        break;
      case "callout":
        defaultLabel = "Annotation / Callout";
        defaultColor = "sky";
        width = 140;
        height = 85;
        break;
      case "awsLambda":
        defaultLabel = "awsLambdaFn()";
        defaultColor = "orange";
        width = 110;
        height = 110;
        break;
      case "awsEc2":
        defaultLabel = "EC2 Server Node";
        defaultColor = "orange";
        width = 110;
        height = 110;
        break;
      case "awsS3":
        defaultLabel = "S3 Object Bucket";
        defaultColor = "green";
        width = 120;
        height = 120;
        break;
      case "awsVpc":
        defaultLabel = "VPC Region Container";
        defaultColor = "sky";
        width = 250;
        height = 180;
        break;
      case "awsRds":
        defaultLabel = "RDS DB Cluster";
        defaultColor = "blue";
        width = 135;
        height = 125;
        break;
      case "awsCloudwatch":
        defaultLabel = "CloudWatch Alarm";
        defaultColor = "rose";
        width = 110;
        height = 110;
        break;
      case "awsDynamo":
        defaultLabel = "DynamoDB NoSQL Table";
        defaultColor = "purple";
        width = 120;
        height = 120;
        break;
      case "umlClass":
        defaultLabel = "TaskController\n--\n- id: string\n- tasks: List<Task>\n--\n+ update()\n+ create()";
        defaultColor = "slate";
        width = 180;
        height = 140;
        break;
      case "umlInterface":
        defaultLabel = "<<Interface>>\nTaskListener\n--\n+ onCreated(t: Task)";
        defaultColor = "purple";
        width = 160;
        height = 120;
        break;
      case "umlUseCase":
        defaultLabel = "Create Daily Task Record";
        defaultColor = "blue";
        width = 160;
        height = 90;
        break;
      case "umlBoundary":
        defaultLabel = "User Portal Boundary";
        defaultColor = "slate";
        width = 140;
        height = 110;
        break;
      case "umlControl":
        defaultLabel = "Workspace Controller";
        defaultColor = "blue";
        width = 110;
        height = 110;
        break;
      case "umlEntity":
        defaultLabel = "TaskDBEntity";
        defaultColor = "green";
        width = 140;
        height = 110;
        break;
      case "umlNote":
        defaultLabel = "UML Class Note:\n- Event driven sync block\n- Active fallback system";
        defaultColor = "yellow";
        width = 180;
        height = 140;
        break;
      case "multiDocument":
        defaultLabel = "Multi-Doc Page List";
        defaultColor = "sky";
        width = 130;
        height = 100;
        break;
      case "manualInput":
        defaultLabel = "Manual Input Form";
        defaultColor = "slate";
        width = 140;
        height = 90;
        break;
      case "manualOperation":
        defaultLabel = "Manual Operation Step";
        defaultColor = "slate";
        width = 140;
        height = 90;
        break;
      case "preparation":
        defaultLabel = "Setup / Preparation";
        defaultColor = "purple";
        width = 140;
        height = 90;
        break;
      case "display":
        defaultLabel = "Status/Display Info";
        defaultColor = "blue";
        width = 130;
        height = 80;
        break;
      case "summingJunction":
        defaultLabel = "+";
        defaultColor = "slate";
        width = 80;
        height = 80;
        break;
      case "collate":
        defaultLabel = "Collate Data";
        defaultColor = "slate";
        width = 90;
        height = 90;
        break;
      case "connectorOr":
        defaultLabel = "OR";
        defaultColor = "slate";
        width = 80;
        height = 80;
        break;
      case "sort":
        defaultLabel = "Sort Record List";
        defaultColor = "slate";
        width = 100;
        height = 100;
        break;
      case "merge":
        defaultLabel = "Merge Branch Paths";
        defaultColor = "slate";
        width = 100;
        height = 90;
        break;
      case "azureUser":
        defaultLabel = "Azure User Account";
        defaultColor = "blue";
        width = 110;
        height = 110;
        break;
      case "azureSql":
        defaultLabel = "SQL Database Server";
        defaultColor = "blue";
        width = 120;
        height = 120;
        break;
      case "azureFunctions":
        defaultLabel = "Azure Function App";
        defaultColor = "orange";
        width = 110;
        height = 110;
        break;
      case "azureKeyVault":
        defaultLabel = "Azure Key Vault";
        defaultColor = "pink";
        width = 110;
        height = 110;
        break;
      case "azureCosmos":
        defaultLabel = "Cosmos NoSQL DB";
        defaultColor = "sky";
        width = 115;
        height = 115;
        break;
      case "azurePowerBi":
        defaultLabel = "PowerBI Report Dashboard";
        defaultColor = "yellow";
        width = 120;
        height = 120;
        break;
      case "azureVm":
        defaultLabel = "Virtual Machine Node";
        defaultColor = "indigo";
        width = 110;
        height = 110;
        break;
      case "azureStorage":
        defaultLabel = "Azure Blob Storage";
        defaultColor = "teal";
        width = 120;
        height = 120;
        break;
      case "bpmnActivity":
        defaultLabel = "BPMN Activity Task";
        defaultColor = "slate";
        width = 130;
        height = 95;
        break;
      case "bpmnEvent":
        defaultLabel = "Start Event Trigger";
        defaultColor = "green";
        width = 90;
        height = 90;
        break;
      case "bpmnGateway":
        defaultLabel = "BPMN Logical Gateway";
        defaultColor = "orange";
        width = 110;
        height = 110;
        break;
      case "bpmnDataStore":
        defaultLabel = "BPMN System Storage";
        defaultColor = "slate";
        width = 120;
        height = 105;
        break;
      case "bpmnDataObject":
        defaultLabel = "Data Object Document";
        defaultColor = "slate";
        width = 110;
        height = 120;
        break;
      case "bpmnEventEnd":
        defaultLabel = "Terminate End Event";
        defaultColor = "rose";
        width = 90;
        height = 90;
        break;
    }

    const container = canvasContainerRef.current;
    let spawnX = 200;
    let spawnY = 150;
    if (container) {
      const rect = container.getBoundingClientRect();
      spawnX = Math.round((rect.width / 2 - panOffset.x) / zoomLevel - width / 2) + (Math.random() * 40 - 20);
      spawnY = Math.round((rect.height / 2 - panOffset.y) / zoomLevel - height / 2) + (Math.random() * 40 - 20);
    }

    const newNode: FlowNode = {
      id,
      type,
      x: Math.max(20, spawnX),
      y: Math.max(20, spawnY),
      label: defaultLabel,
      color: defaultColor,
      width,
      height,
      fontSize: fSize,
      fontStyle: fStyle,
      align: alignment,
      borderStyle: bdStyle
    };

    const nextNodes = [...nodes, newNode];
    setNodes(nextNodes);
    recordHistory(nextNodes, edges);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    setIsShapeDropdownOpen(false);
    toast.success(`Ditambahkan: ${type === 'sticky' ? 'Miro Sticky Note' : type.toUpperCase()}`);
  };

  const handleAddNewNodeAtPosition = (type: FlowNode["type"], label: string, color: string, clientX: number, clientY: number) => {
    const id = "node_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const container = canvasContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const xOffset = clientX - rect.left;
    const yOffset = clientY - rect.top;

    let width = 140;
    let height = 70;
    let fSize = 12;
    let fStyle: FlowNode["fontStyle"] = "sans";
    let alignment: FlowNode["align"] = "center";
    let bdStyle: FlowNode["borderStyle"] = "solid";

    switch (type) {
      case "sticky":
        width = 110;
        height = 110;
        fSize = 13;
        fStyle = "serif";
        bdStyle = "none";
        break;
      case "oval":
        width = 130;
        height = 65;
        break;
      case "rect":
        width = 155;
        height = 70;
        break;
      case "diamond":
        width = 110;
        height = 110;
        break;
      case "cylinder":
      case "database":
        width = 125;
        height = 80;
        break;
      case "card":
        width = 180;
        height = 95;
        alignment = "left";
        break;
      case "document":
        width = 135;
        height = 75;
        break;
    }

    const canvasX = Math.round((xOffset - panOffset.x) / zoomLevel - width / 2);
    const canvasY = Math.round((yOffset - panOffset.y) / zoomLevel - height / 2);

    const newNode: FlowNode = {
      id,
      type,
      x: Math.max(20, Math.min(canvasX, 3500 - width)),
      y: Math.max(20, Math.min(canvasY, 2800 - height)),
      label,
      color,
      width,
      height,
      fontSize: fSize,
      fontStyle: fStyle,
      align: alignment,
      borderStyle: bdStyle
    };

    const nextNodes = [...nodes, newNode];
    setNodes(nextNodes);
    recordHistory(nextNodes, edges);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    toast.success(`Ditambahkan: ${label}`);
  };

  // Node Drags & Canvas Window Pans
  const handleNodeMouseDown = (e: React.MouseEvent, node: FlowNode) => {
    e.stopPropagation();

    // Do not initiate node dragging if clicking on an input/textarea
    // to allow standard text selection blocking with the cursor
    const target = e.target as HTMLElement;
    if (target.tagName.toLowerCase() === 'textarea' || target.tagName.toLowerCase() === 'input') {
      return;
    }

    if (!isWorkspaceEditable) {
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
      return;
    }

    if (activeTool === 'hand') {
      startCanvasPanning(e.clientX, e.clientY);
      return;
    }

    if (activeTool === 'connect') {
      handleConnectClick(node.id);
      return;
    }

    if (!copiedNodes.some(n => n.id === node.id)) {
      setCopiedNodes([]);
    }

    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setDraggingNodeId(node.id);

    const clientX = e.clientX;
    const clientY = e.clientY;
    
    setDragOffset({
      x: (clientX / zoomLevel) - node.x,
      y: (clientY / zoomLevel) - node.y
    });
  };


  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setCopiedNodes([]);
    
    if (activeTool === 'hand' || isSpacePressed || e.button === 1 || e.shiftKey) {
      startCanvasPanning(e.clientX, e.clientY);
    } else if (activeTool === 'select') {
      const rect = canvasContainerRef.current?.getBoundingClientRect();
      if (rect) {
        setMarqueeBox({
          startX: e.clientX,
          startY: e.clientY,
          currentX: e.clientX,
          currentY: e.clientY
        });
      }
    }
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isWorkspaceEditable) return;
    // Only spawn if click was on deep grid or container background
    const targetElement = e.target as HTMLElement;
    // If we click inside an input, textarea or interactive buttons, ignore spawn
    if (
      targetElement.closest("button") || 
      targetElement.closest("textarea") || 
      targetElement.closest("input") || 
      targetElement.closest("select") ||
      targetElement.closest(".absolute.z-20") // this targets the node item wrapper!
    ) {
      return;
    }

    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Convert screen coordinates block back into unpanned + unzoomed canvas space
    const canvasX = Math.round((clientX - panOffset.x) / zoomLevel);
    const canvasY = Math.round((clientY - panOffset.y) / zoomLevel);

    // Spawn standard sticky note
    const newNodeId = "node_" + Date.now();
    const newNode: FlowNode = {
      id: newNodeId,
      type: "sticky",
      x: Math.max(20, Math.min(canvasX - 55, 3350)),
      y: Math.max(20, Math.min(canvasY - 55, 2650)),
      label: "Ide Baru Miro 🤔",
      color: "yellow",
      width: 110,
      height: 110,
      fontSize: 12,
      borderStyle: "none"
    };

    const nextNodes = [...nodes, newNode];
    setNodes(nextNodes);
    setSelectedNodeId(newNodeId);
    recordHistory(nextNodes, edges);
    toast.success("Catatan Miro-style ditambahkan via klik ganda! 💡");
  };

  const handleResizeMouseDown = (e: React.MouseEvent, nodeId: string, direction: "se" | "e" | "s") => {
    e.stopPropagation();
    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setResizingNodeId(nodeId);
    setResizeStart({
      clientX: e.clientX,
      clientY: e.clientY,
      initialWidth: node.width || 130,
      initialHeight: node.height || 70,
      initialX: node.x,
      initialY: node.y,
      direction
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    // Track cursor coordinates relative to infinite canvas (Miro-style coordinate info HUD)
    if (canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const relativeY = e.clientY - rect.top;
      const boardX = Math.round((relativeX - panOffset.x) / zoomLevel);
      const boardY = Math.round((relativeY - panOffset.y) / zoomLevel);
      setHoverCoords({ x: boardX, y: boardY });
    }

    if (marqueeBox) {
      setMarqueeBox(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
      
      // Live marquee selection feedback
      if (canvasContainerRef.current) {
        const rect = canvasContainerRef.current.getBoundingClientRect();
        const left = Math.min(marqueeBox.startX, e.clientX);
        const right = Math.max(marqueeBox.startX, e.clientX);
        const top = Math.min(marqueeBox.startY, e.clientY);
        const bottom = Math.max(marqueeBox.startY, e.clientY);
        
        const canvasLeft = (left - rect.left - panOffset.x) / zoomLevel;
        const canvasRight = (right - rect.left - panOffset.x) / zoomLevel;
        const canvasTop = (top - rect.top - panOffset.y) / zoomLevel;
        const canvasBottom = (bottom - rect.top - panOffset.y) / zoomLevel;

        const intersected = nodes.filter(n => {
          const nw = n.width || 130;
          const nh = n.height || 70;
          return (n.x + nw > canvasLeft && n.x < canvasRight && n.y + nh > canvasTop && n.y < canvasBottom);
        });
        
        // Prevent continuous array recreation if length is same
        setCopiedNodes(prev => prev.length === intersected.length && prev.every(p => intersected.find(i => i.id === p.id)) ? prev : intersected);
      }
      return;
    }

    // 1. Handle Canvas Panning
    if (isPanning) {
      const newX = e.clientX - panStart.x;
      const newY = e.clientY - panStart.y;
      setPanOffset({ x: newX, y: newY });
      return;
    }

    // 2. Handle Shape Resizing
    if (resizingNodeId && resizeStart) {
      const deltaX = (e.clientX - resizeStart.clientX) / zoomLevel;
      const deltaY = (e.clientY - resizeStart.clientY) / zoomLevel;
      
      setNodes(prev => prev.map(n => {
        if (n.id === resizingNodeId) {
          let newWidth = resizeStart.initialWidth;
          let newHeight = resizeStart.initialHeight;

          if (resizeStart.direction.includes("e")) {
            newWidth = Math.max(50, resizeStart.initialWidth + deltaX);
          }
          if (resizeStart.direction.includes("s")) {
            newHeight = Math.max(40, resizeStart.initialHeight + deltaY);
          }

          if (isSnapToGrid) {
            const snapStep = canvasTheme === "miro" ? 20 : 15;
            newWidth = Math.round(newWidth / snapStep) * snapStep;
            newHeight = Math.round(newHeight / snapStep) * snapStep;
          }

          return {
            ...n,
            width: newWidth,
            height: newHeight
          };
        }
        return n;
      }));
      return;
    }

    // 3. Handle Shape Dragging
    if (!draggingNodeId) return;

    const newX = Math.round((e.clientX / zoomLevel) - dragOffset.x);
    const newY = Math.round((e.clientY / zoomLevel) - dragOffset.y);

    const boundedX = Math.max(10, Math.min(newX, 3500));
    const boundedY = Math.max(10, Math.min(newY, 2800));

    let finalX = boundedX;
    let finalY = boundedY;

    if (isSnapToGrid) {
      const snapStep = canvasTheme === "miro" ? 20 : 15;
      finalX = Math.round(boundedX / snapStep) * snapStep;
      finalY = Math.round(boundedY / snapStep) * snapStep;
    }

    const isMultiDragging = copiedNodes.some(n => n.id === draggingNodeId);

    setNodes(prev => {
      const draggedNodeState = prev.find(n => n.id === draggingNodeId);
      if (!draggedNodeState) return prev;
      
      const movedX = finalX - draggedNodeState.x;
      const movedY = finalY - draggedNodeState.y;

      if (movedX === 0 && movedY === 0) return prev;

      if (isMultiDragging) {
         return prev.map(n => {
           if (copiedNodes.some(copy => copy.id === n.id)) {
             return { ...n, x: n.x + movedX, y: n.y + movedY };
           }
           return n;
         });
      } else {
         return prev.map(n => n.id === draggingNodeId ? { ...n, x: finalX, y: finalY } : n);
      }
    });
  };

  const handleCanvasMouseUp = () => {
    if (marqueeBox && canvasContainerRef.current) {
      if (copiedNodes.length > 0) {
        toast.info(`${copiedNodes.length} objek diblok (siap digeser/disalin/dihapus).`);
      }
      setMarqueeBox(null);
    }

    if (isPanning) {
      stopCanvasPanning();
    }
    if (draggingNodeId) {
      setDraggingNodeId(null);
      recordHistory(nodes, edges);
    }
    if (resizingNodeId) {
      setResizingNodeId(null);
      setResizeStart(null);
      recordHistory(nodes, edges);
    }
  };

  // Edge link addition
  const handleConnectPortClick = (nodeId: string, portName: string) => {
    handleConnectClick(nodeId);
  };

  const handleConnectClick = (nodeId: string) => {
    if (!connectSourceId) {
      setConnectSourceId(nodeId);
      toast.info("Pilih bentuk TUJUAN untuk menyambung alur.");
    } else {
      if (connectSourceId === nodeId) {
        toast.error("Tidak dapat menghubungkan bentuk ke dirinya sendiri.");
        setConnectSourceId(null);
        return;
      }

      const relationExists = edges.some(edge => edge.fromNodeId === connectSourceId && edge.toNodeId === nodeId);
      if (relationExists) {
        toast.info("Hubungan sudah ada.");
      } else {
        const id = "edge_" + Date.now();
        const nextEdges = [...edges, { id, fromNodeId: connectSourceId, toNodeId: nodeId }];
        setEdges(nextEdges);
        recordHistory(nodes, nextEdges);
        toast.success("Anak panah alur berhasil ditambahkan!");
      }

      setConnectSourceId(null);
      setActiveTool('select');
    }
  };

  // Node / Arrow delete handler
  const handleDeleteSelected = () => {
    if (selectedNodeId) {
      const updatedNodes = nodes.filter(n => n.id !== selectedNodeId);
      const updatedEdges = edges.filter(edge => edge.fromNodeId !== selectedNodeId && edge.toNodeId !== selectedNodeId);
      setNodes(updatedNodes);
      setEdges(updatedEdges);
      recordHistory(updatedNodes, updatedEdges);
      setSelectedNodeId(null);
      toast.success("Komponen berhasil dikosongkan.");
    } else if (copiedNodes.length > 0) {
      const copiedIds = copiedNodes.map(n => n.id);
      const updatedNodes = nodes.filter(n => !copiedIds.includes(n.id));
      const updatedEdges = edges.filter(edge => !copiedIds.includes(edge.fromNodeId) && !copiedIds.includes(edge.toNodeId));
      setNodes(updatedNodes);
      setEdges(updatedEdges);
      recordHistory(updatedNodes, updatedEdges);
      setCopiedNodes([]);
      toast.success(`${copiedIds.length} blok komponen berhasil dihapus.`);
    } else if (selectedEdgeId) {
      const updatedEdges = edges.filter(edge => edge.id !== selectedEdgeId);
      setEdges(updatedEdges);
      recordHistory(nodes, updatedEdges);
      setSelectedEdgeId(null);
      toast.success("Hubungan alur dibatalkan.");
    } else {
      toast.info("Pilih bentuk atau garir alur terlebih dahulu untuk menghapusnya.");
    }
  };

  // Quick duplicate shape
  const handleDuplicateNode = (node: FlowNode) => {
    const id = "node_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const duplicated: FlowNode = {
      ...node,
      id,
      x: node.x + 35,
      y: node.y + 35,
      label: `${node.label} (Salinan)`
    };
    const nextNodes = [...nodes, duplicated];
    setNodes(nextNodes);
    recordHistory(nextNodes, edges);
    setSelectedNodeId(id);
    toast.success("Simbol diduplikat!");
  };

  // Right-click context menu specific handlers
  const handleContextMenuDeleteNode = (nodeId: string) => {
    const updatedNodes = nodes.filter(n => n.id !== nodeId);
    const updatedEdges = edges.filter(edge => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId);
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    recordHistory(updatedNodes, updatedEdges);
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
    toast.success("Komponen berhasil dihapus.");
  };

  const handleContextMenuEditProperties = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setIsRightSidebarOpen(true);
  };

  const handleContextMenuChangeColor = (nodeId: string, newColor: string) => {
    const updated = nodes.map(n => n.id === nodeId ? { ...n, color: newColor } : n);
    setNodes(updated);
    recordHistory(updated, edges);
    toast.success(`Warna komponen berhasil diubah ke ${newColor.toUpperCase()}.`);
  };

  const handleContextMenuDuplicate = (nodeId: string) => {
    const targetNode = nodes.find(n => n.id === nodeId);
    if (targetNode) {
      handleDuplicateNode(targetNode);
    }
  };

  // Position logic helper
  const getNodeCenter = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    
    const width = node.width || 140;
    const height = node.height || 70;
    
    return {
      x: node.x + width / 2,
      y: node.y + height / 2
    };
  };

  const getLinkedTaskDetails = (taskId?: string) => {
    if (!taskId) return null;
    return tasks.find(t => t.id === taskId);
  };

  const linkedEpic = currentFlowMetadata?.epicTaskId ? tasks.find(t => t.id === currentFlowMetadata.epicTaskId) : null;

  // Styling helper palettes
  const colorPalettes: Record<string, { bg: string; text: string; border: string; preview: string }> = {
    yellow: { bg: "bg-amber-50/85 border-amber-300", text: "text-amber-900", border: "border-amber-300", preview: "bg-amber-200" },
    orange: { bg: "bg-orange-50/80 border-orange-300", text: "text-orange-900", border: "border-orange-300", preview: "bg-orange-200" },
    pink: { bg: "bg-pink-50/80 border-pink-300", text: "text-pink-900", border: "border-pink-300", preview: "bg-pink-200" },
    blue: { bg: "bg-blue-50/80 border-blue-300", text: "text-blue-900", border: "border-blue-300", preview: "bg-blue-200" },
    green: { bg: "bg-emerald-50/80 border-emerald-300", text: "text-emerald-900", border: "border-emerald-300", preview: "bg-emerald-200" },
    purple: { bg: "bg-purple-50/80 border-purple-300", text: "text-purple-900", border: "border-purple-300", preview: "bg-purple-200" },
    indigo: { bg: "bg-indigo-50/80 border-indigo-300", text: "text-indigo-900", border: "border-indigo-300", preview: "bg-indigo-200" },
    sky: { bg: "bg-sky-50/80 border-sky-300", text: "text-sky-900", border: "border-sky-300", preview: "bg-sky-200" },
    amber: { bg: "bg-amber-50/80 border-amber-400", text: "text-amber-900", border: "border-amber-400", preview: "bg-amber-300" },
    rose: { bg: "bg-rose-50/80 border-rose-300", text: "text-rose-900", border: "border-rose-300", preview: "bg-rose-200" },
    violet: { bg: "bg-violet-50/80 border-violet-300", text: "text-violet-900", border: "border-violet-300", preview: "bg-violet-250" },
    slate: { bg: "bg-slate-50/80 border-slate-300", text: "text-slate-800", border: "border-slate-300", preview: "bg-slate-300" }
  };

  // Color HEX helper for precision SVG shapes
  const colorPaletteHexGlobal = colorPaletteHex; // Use the global one

  const getShapeThemeClasses = (node: FlowNode, isSelected: boolean) => {
    const palette = colorPalettes[node.color] || colorPalettes.indigo;
    const ringClass = isSelected ? "ring-4 ring-offset-2 ring-violet-500 z-30" : "";
    
    let base = "transition-all duration-300 flex flex-col justify-center items-center text-center p-3 select-none";
    let borderStyleClass = "border-2";
    if (node.borderStyle === "dashed") borderStyleClass = "border-2 border-dashed";
    if (node.borderStyle === "none") borderStyleClass = "border-0 shadow-none";

    if (customSvgTypes.includes(node.type as any) || node.type === "parallelogram" || node.type === "diamond" || node.type === "decision") {
      const customIsSelectedRing = isSelected ? "z-30" : "";
      return `transition-all duration-300 flex flex-col justify-center items-center text-center p-3 select-none ${palette.text} ${customIsSelectedRing} relative bg-transparent border-0`;
    }

    if (node.type === "sticky") {
      return `${base} justify-start text-left p-4 bg-yellow-150 ${palette.bg} ${palette.text} border-b-[3px] border-black/15 rounded-md ${ringClass}`;
    }

    if (node.type === "rect") {
      return `${base} ${borderStyleClass} rounded-xl ${palette.bg} ${palette.text} ${ringClass}`;
    }

    if (node.type === "oval") {
      return `${base} ${borderStyleClass} rounded-full px-6 ${palette.bg} ${palette.text} ${ringClass}`;
    }

    if (node.type === "circle") {
      return `${base} ${borderStyleClass} rounded-full aspect-square ${palette.bg} ${palette.text} ${ringClass}`;
    }

    if (node.type === "cylinder" || node.type === "database") {
      return `${base} ${borderStyleClass} rounded-t-[20px] rounded-b-[20px] ${palette.bg} ${palette.text} ${ringClass}`;
    }

    if (node.type === "cloud") {
      return `${base} ${borderStyleClass} rounded-[28px] ${palette.bg} ${palette.text} ${ringClass}`;
    }

    if (node.type === "card") {
      return `${base} border border-slate-200/80 rounded-xl text-left items-start p-4 bg-white/95 backdrop-blur-sm shadow-sm ${palette.text} ${ringClass}`;
    }

    if (node.type === "document") {
      return `${base} ${borderStyleClass} rounded-tl-lg rounded-tr-2xl rounded-b-lg ${palette.bg} ${palette.text} ${ringClass}`;
    }

    if (node.type === "subprocess" || node.type === "predefined") {
      return `${base} ${borderStyleClass} rounded-lg ${palette.bg} ${palette.text} ${ringClass}`;
    }

    if (node.type === "actor") {
      return `${base} ${borderStyleClass} rounded-full aspect-square ${palette.bg} ${palette.text} ${ringClass}`;
    }

    if (node.type === "folder") {
      return `${base} ${borderStyleClass} rounded-b-lg rounded-tr-lg ${palette.bg} ${palette.text} ${ringClass}`;
    }

    return `${base} ${palette.text} border-0 bg-transparent text-left items-start ${ringClass}`;
  };

  // --- DASHBOARD SEARCH, SORT & PAGINATION LOGIC ---
  const filteredFlowcharts = flowcharts.filter(fw => {
    const nameMatch = fw.name.toLowerCase().includes(searchQuery.toLowerCase());
    const descMatch = (fw.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || descMatch;
  });

  const sortedFlowcharts = [...filteredFlowcharts].sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    } else if (sortBy === "createdAt") {
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    } else {
      // Default: lastEditedAt
      const valA = a.lastEditedAt || a.createdAt || "";
      const valB = b.lastEditedAt || b.createdAt || "";
      return valB.localeCompare(valA);
    }
  });

  const totalItems = sortedFlowcharts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedFlowcharts.slice(indexOfFirstItem, indexOfLastItem);

  const getInitials = (name?: string) => {
    if (!name) return "LP";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handlePageChange = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, currentPage + 2);
      
      if (currentPage <= 3) {
        end = maxVisible;
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - maxVisible + 1;
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    return pages;
  };

  const renderDashboard = () => {
    return (
      <div className="flex-1 flex flex-col p-3 md:p-6 font-sans overflow-y-auto w-full bg-[#f4f7f9] animate-in fade-in duration-700">
        <div className="flex-1 flex flex-col bg-white border border-slate-200/80 rounded-lg shadow-sm overflow-hidden">
          {/* Dashboard Header matching Meeting Notes */}
          <div className="p-6 md:p-7 border-b border-slate-200/80 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-[#405189]/10 border border-[#405189]/20 rounded-md text-[#405189] shadow-2xs">
                <Workflow className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-medium text-slate-900 tracking-tight">Flowchart Editor</h3>
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  Manage interactive diagrams, process flows, and visual architecture.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <input
                  type="text"
                  placeholder="Search flowcharts by title..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50/60 border border-slate-200/80 rounded-md text-xs placeholder:text-slate-400 outline-none focus:bg-white focus:ring-1 focus:ring-[#405189]/20 focus:border-[#405189] transition-all text-slate-700 font-medium shadow-2xs"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>

              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#405189] hover:bg-[#364473] active:bg-[#2d3960] text-white rounded-md text-xs font-medium transition-all shadow-xs shadow-[#405189]/20 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" /> Add Flowchart
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-white">
            {/* Data Table */}
            <div className="flex-1 overflow-x-auto overflow-y-auto m-6 bg-white rounded-md border border-slate-200/60 shadow-xs">
              <ResponsiveTable className="w-full text-left border-collapse min-w-[880px]">
                <thead>
                  <tr className="bg-[#405189]/5 border-b border-[#405189]/15 text-[11px] font-semibold text-[#405189] uppercase tracking-wider whitespace-nowrap">
                    <th className="py-3.5 px-4 w-14 text-center">No</th>
                    <th className="py-3.5 px-4 min-w-[180px] max-w-[280px]">Flowchart Title</th>
                    <th className="py-3.5 px-4 w-36">Category</th>
                    <th className="py-3.5 px-4 min-w-[180px] max-w-[280px]">Description</th>
                    <th className="py-3.5 px-4 w-44">Linked Epic</th>
                    <th className="py-3.5 px-4 w-40">Author</th>
                    <th className="py-3.5 px-4 w-36">Last Updated</th>
                    <th className="py-3.5 px-4 w-28 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {currentItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-20 text-slate-400">
                        <div className="w-14 h-14 rounded-md bg-[#405189]/10 border border-[#405189]/20 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                          <Workflow className="w-6 h-6 text-[#405189]" />
                        </div>
                        <p className="font-medium text-slate-800 text-sm">No flowcharts found</p>
                        <p className="text-xs text-slate-400 mt-1 mb-4">Create a new flowchart or adjust your search keyword.</p>
                        <button
                          onClick={openCreateModal}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#405189] hover:bg-[#364473] active:bg-[#2d3960] text-white rounded-md text-xs font-medium transition-all shadow-xs shadow-[#405189]/20 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" /> Add Flowchart
                        </button>
                      </td>
                    </tr>
                  ) : (
                    currentItems.map((fw, index) => {
                      const srNo = (currentPage - 1) * itemsPerPage + index + 1;
                      const activeAuthor = getResolvedAuthor();
                      const rawAuthor = fw.createdBy;
                      const createdBy = (!rawAuthor || rawAuthor === "Azlan Irwan") ? activeAuthor : rawAuthor;
                      const formatDateSafe = (dateVal?: string) => {
                        if (!dateVal) return "-";
                        if (dateVal.includes(",") || dateVal.includes("/")) return dateVal;
                        const d = new Date(dateVal);
                        if (isNaN(d.getTime())) return dateVal;
                        return d.toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' });
                      };
                      const lastEditedAt = formatDateSafe(fw.lastEditedAt || fw.createdAt);
                      const initials = getInitials(createdBy);
                      const linkedEpic = tasks.find(t => t.id === fw.epicTaskId);

                      return (
                        <tr 
                          key={fw.id} 
                          onClick={() => {
                            handleSelectFlowchart(fw.id);
                            setIsEditorActive(true);
                          }}
                          className="hover:bg-slate-50/70 transition-colors duration-200 group cursor-pointer h-14 whitespace-nowrap"
                        >
                          <td className="py-3 px-4 text-center text-slate-400 font-medium whitespace-nowrap">
                            {String(srNo).padStart(2, "0")}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900 group-hover:text-[#405189] transition-colors max-w-[220px] truncate whitespace-nowrap">
                            {fw.name}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-block px-2.5 py-1 bg-indigo-50 text-[#405189] border border-indigo-200/80 text-[10px] font-medium rounded-md uppercase">
                              {fw.category || "Panduan"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-medium max-w-[260px] truncate whitespace-nowrap">
                            {fw.description ? fw.description : <span className="text-slate-300 italic">No description</span>}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {linkedEpic ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 border border-violet-200 text-[10px] font-medium rounded-md max-w-[180px] truncate" title={linkedEpic.title}>
                                🎯 {linkedEpic.title}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-normal text-xs">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#405189]/10 text-[#405189] flex items-center justify-center text-[10px] font-medium shrink-0">
                                {initials}
                              </div>
                              <span className="truncate max-w-[120px]">{createdBy}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-medium whitespace-nowrap">
                            {lastEditedAt}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  handleSelectFlowchart(fw.id);
                                  setIsEditorActive(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-[#405189] hover:bg-[#405189]/10 rounded-md transition-all cursor-pointer"
                                title="View flowchart canvas"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {canModifyFlowchart(fw) && (
                                <>
                                  <button
                                    onClick={() => {
                                      handleSelectFlowchart(fw.id);
                                      setIsEditorActive(true);
                                    }}
                                    className="p-1.5 text-slate-500 hover:text-[#405189] hover:bg-[#405189]/10 rounded-md transition-all cursor-pointer"
                                    title="Edit flowchart"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteFlowchart(fw.id, e)}
                                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                                    title="Delete flowchart"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </ResponsiveTable>
            </div>

            {/* Pagination Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500 font-medium">
                Showing {totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-md text-xs font-medium disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
                  >
                    Previous
                  </button>
                  <span className="px-3.5 py-1.5 bg-[#405189] text-white rounded-md text-xs font-medium shadow-xs">
                    {currentPage}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-md text-xs font-medium disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 w-full overflow-hidden relative">
      {!isEditorActive ? (
        renderDashboard()
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-slate-50 p-4 md:p-6 space-y-4 animate-in fade-in duration-500 font-sans">
      
      {/* VIEW-PORT UTAMA (DASHBOARD DENGAN EMBED VIEWER & TOGGLE KANVAS) */}
      <div className="flex-1 flex flex-col min-h-[600px] bg-transparent relative mb-8">
        {!selectedFlowId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="w-16 h-16 bg-white border border-slate-100 shadow-sm rounded-xl flex items-center justify-center mb-4 text-violet-600">
              <FileText className="w-6 h-6 animate-pulse" />
            </div>
            <h2 className="text-base font-medium text-slate-800 mb-1">Manajemen Dokumentasi</h2>
            <p className="text-xs text-slate-500 font-medium">Pilih dokumen di sidebar atau buat baru untuk melihat preview dan merancang alur.</p>
            <button 
              onClick={openCreateModal}
              className="mt-4 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-medium p-2.5 px-5 rounded-xl text-xs shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" /> Tambah Dokumen Baru
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 relative space-y-4">
            
            {/* Panel 1: Top Actions */}
            <div className="bg-white border border-slate-200 rounded-md p-4 flex items-center justify-between shadow-xs shrink-0">
              <button
                onClick={() => {
                  setIsEditorActive(false);
                  setSelectedFlowId(null);
                  setCurrentPage(1);
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-[#405189] bg-[#405189]/10 hover:bg-[#405189]/15 border border-[#405189]/20 px-3 py-1.5 rounded-md transition-all cursor-pointer shrink-0 shadow-2xs"
              >
                ← Back to Flowchart List
              </button>

              {/* Action Buttons & View Mode Toggle */}
              <div className="flex items-center flex-wrap gap-3 shrink-0">
                {/* View Mode Segmented Control Toggle */}
                <div className="bg-slate-100 p-1 rounded-md flex items-center border border-slate-200/60 shadow-inner">
                  <button
                    onClick={() => setRightViewMode("embed")}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                      rightViewMode === "embed"
                        ? "bg-white text-slate-900 shadow-2xs font-semibold"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <BookOpen className="w-3.5 h-3.5" /> Document List
                  </button>
                  <button
                    onClick={() => setRightViewMode("canvas")}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                      rightViewMode === "canvas"
                        ? "bg-white text-slate-900 shadow-2xs font-semibold"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <Workflow className="w-3.5 h-3.5" /> Flow Diagram
                  </button>
                </div>

                {/* Edit & Delete Action Buttons */}
                {currentFlowMetadata && canModifyFlowchart(currentFlowMetadata) && (
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-md border border-slate-200/60">
                    <button
                      onClick={(e) => openEditModal(currentFlowMetadata, e)}
                      className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 hover:text-[#405189] rounded-md transition-all cursor-pointer shadow-2xs border border-slate-200/80"
                      title="Edit document metadata"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteFlowchart(currentFlowMetadata.id, e)}
                      className="p-1.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-md transition-all cursor-pointer shadow-2xs border border-slate-200/80"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Panel 2: Meta Context & Title */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 md:p-6 shadow-sm shrink-0">
              <div className="flex flex-wrap items-center gap-2 select-none mb-3">
                {/* Category Badge */}
                {currentFlowMetadata?.category === "PRD" && (
                  <span className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200/80 rounded-full">
                    📄 PRD
                  </span>
                )}
                {currentFlowMetadata?.category === "Panduan" && (
                  <span className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/80 rounded-full">
                    📖 Panduan
                  </span>
                )}
                {currentFlowMetadata?.category === "Laporan" && (
                  <span className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full">
                    📊 Laporan
                  </span>
                )}
                {!currentFlowMetadata?.category && (
                  <span className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider bg-violet-50 text-violet-700 border border-violet-200/80 rounded-full">
                    ⚙️ Umum
                  </span>
                )}

                {/* Creator Info */}
                <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                  <User className="w-3 h-3" /> Oleh <strong className="text-slate-800">{currentFlowMetadata?.createdBy || "Azlan Irwan"}</strong>
                </span>

                <span className="text-slate-300">•</span>

                {/* Date */}
                <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                  Diperbarui {currentFlowMetadata?.lastEditedAt || currentFlowMetadata?.createdAt}
                </span>
                
                {linkedEpic && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-[10px] font-medium text-indigo-750 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full truncate max-w-[180px]" title={linkedEpic.title}>
                      🎯 Epic: {linkedEpic.title}
                    </span>
                  </>
                )}
              </div>

              <h2 className="text-xl md:text-2xl font-medium text-slate-900 tracking-tight leading-snug flex items-center gap-2">
                <Workflow className="w-6 h-6 text-violet-600 shrink-0" />
                <span className="truncate">{currentFlowMetadata?.name}</span>
              </h2>
              
              {currentFlowMetadata?.description && (
                <p className="text-xs text-slate-500 font-medium max-w-3xl leading-relaxed mt-2">
                  {currentFlowMetadata.description}
</p>
              )}
            </div>

            {/* Panel 3: Main Viewport (Canvas / Viewer) */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex-1 min-h-[600px] relative flex flex-col overflow-hidden">
              
              {rightViewMode === "embed" ? (
                /* 1. EMBED VIEWER (SPLIT PANE) */
                <div className="flex-1 flex flex-col min-h-0 bg-white">
                  
                  {/* LEFT PANE: Daftar Dokumen */}
                  <div className="w-full flex-1 bg-slate-50/50 flex flex-col">
                    {/* Header Left Pane */}
                    <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
                      <h4 className="text-sm font-medium text-slate-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-violet-600" />
                        Daftar Dokumen
                      </h4>
                      <button
                        onClick={openUploadDocumentModal}
                        className="p-2 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded text-xs transition-colors cursor-pointer shadow-sm active:scale-95 flex items-center gap-2"
                        title="Upload Dokumen Baru"
                      >
                        <Plus className="w-4 h-4" /> Tambah Dokumen
                      </button>
                    </div>
                    {/* List Items */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
                      {currentFlowMetadata?.documents && currentFlowMetadata.documents.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {currentFlowMetadata.documents.map((doc, idx) => (
                            <div 
                              key={doc.id}
                              className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col gap-4 shadow-sm hover:shadow hover:border-violet-300 transition-all group"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                                  <FileText className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col flex-1 min-w-0">
                                  <span className="text-sm font-medium text-slate-800 truncate">{doc.name}</span>
                                  <span className="text-xs text-slate-500 font-medium truncate mt-0.5">{doc.fileName}</span>
                                  {doc.fileSize && (
                                    <span className="text-[10px] text-slate-400 mt-1">{(doc.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                                  )}
                                </div>
                              </div>
                              <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                                <a 
                                  href={doc.fileData} 
                                  download={doc.fileName}
                                  className="flex items-center gap-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  <Download className="w-3.5 h-3.5" /> Download
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                          <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center mb-4">
                            <FileText className="w-8 h-8 text-slate-400 opacity-50" />
                          </div>
                          <h3 className="text-sm font-medium text-slate-700 mb-2">Belum Ada Dokumen</h3>
                          <span className="text-xs text-slate-500 font-medium max-w-sm">
                            Anda belum menambahkan dokumen apapun ke dalam flowchart ini. Silakan klik tombol "Tambah Dokumen" untuk mulai mengunggah file.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* 2. HIGH-FIDELITY MIRO CANVAS WORKSPACE (DIAGRAM ALUR) */
                <div className="flex-1 relative overflow-hidden bg-white flex flex-col h-full min-h-0">
                  
                  {/* FLOATING QUICK CANVAS CONTROL BAR ON TOP OF THE BOARD */}
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

                  {/* FLOATING MIRO TOOLBAR (SISI KIRI CANVAS) */}
        <div className={cn(
          "absolute top-28 md:top-24 z-20 flex flex-col gap-2.5 bg-white/70 hover:bg-white/85 backdrop-blur-md border border-slate-200/40 p-2.5 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] shrink-0 select-none items-center transition-all duration-300 left-4"
        )}>
            
            {/* Active tools selector */}
            <button 
              onClick={() => { setActiveTool('select'); setConnectSourceId(null); }}
              className={cn(
                "p-2 rounded-lg transition-all",
                activeTool === 'select' ? "bg-violet-650 text-white shadow-md scale-105" : "text-slate-650 hover:bg-slate-100"
              )}
              title="Pointer Selector tool"
            >
              <MousePointer className="w-4 h-4" />
            </button>

            <button 
              onClick={() => { setActiveTool('hand'); setConnectSourceId(null); }}
              className={cn(
                "p-2 rounded-lg transition-all",
                activeTool === 'hand' ? "bg-violet-650 text-white shadow-md scale-105" : "text-slate-650 hover:bg-slate-100"
              )}
              title="Hand Panner tool"
            >
              <Hand className="w-4 h-4" />
            </button>

            <div className="w-6 h-px bg-slate-200" />

            {/* Quick Sticky Note Adder */}
            <button 
              onClick={() => handleAddNewNode("sticky", "yellow")}
              className="p-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-lg transition-all flex flex-col items-center shrink-0 w-10"
              title="Quick Yellow Sticky Note"
            >
              <StickyNote className="w-4 h-4 text-amber-500 fill-amber-300" />
              <span className="text-[7.5px] font-medium uppercase tracking-tight text-amber-600 mt-0.5">Sticky</span>
            </button>

            {/* Shapes COLLECTION TRIGGER */}
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

            {/* Quick Link connection helper */}
            <button 
              onClick={() => {
                setActiveTool('connect');
                setConnectSourceId(null);
                toast.info("Mode Anak Panah Aktif. Klik bentuk asal di Canvas, lalu klik bentuk penerima.");
              }}
              className={cn(
                "p-2 rounded-lg transition-all flex flex-col items-center w-10 border border-slate-100",
                activeTool === 'connect' ? "bg-amber-505 bg-amber-400 text-slate-900" : "text-slate-650 hover:bg-slate-100"
              )}
              title="Anak Panah Penghubung shapes"
            >
              <ArrowRight className="w-4 h-4" />
              <span className="text-[7.5px] font-medium uppercase tracking-tight mt-0.5">Arrow</span>
            </button>

            <button 
              onClick={() => handleAddNewNode("text")}
              className="p-2 hover:bg-slate-100 text-slate-650 rounded-lg transition-all flex flex-col items-center w-10"
              title="Tambahkan Teks dokumentasi"
            >
              <Type className="w-4 h-4 text-slate-505" />
              <span className="text-[7.5px] font-medium uppercase tracking-tight mt-0.5">Text</span>
            </button>

            <div className="w-6 h-px bg-slate-200" />

            {/* Quick tutorial indicator */}
            <div className="text-slate-400 hover:text-violet-600 transition-colors cursor-pointer">
              <HelpCircle className="w-4 h-4" onClick={() => toast.info("Gunakan menu ini untuk menambahkan komponen ke visual whiteboard. Anda dapat mengubah isi teks dengan mengetik langsung diatas bentuk.")} />
            </div>

          </div>

          {/* ACTIVE DRAWING SHEET CANVAS (THE BASE BACKGROUND LAYER) */}
          <div 
            className={cn(
              "absolute inset-0 w-full h-full overflow-hidden z-0 transition-colors duration-300 rounded-xl",
              canvasTheme === 'miro' 
                ? "bg-[#faf9f6]/95 text-slate-850 grid-dots-light" 
                : "bg-[#0a1124] text-sky-100 grid-blueprint-dark border-slate-800"
            )}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onDoubleClick={handleCanvasDoubleClick}
            onContextMenu={(e) => {
              const targetElement = e.target as HTMLElement;
              if (
                targetElement.closest("button") || 
                targetElement.closest("textarea") || 
                targetElement.closest("input") || 
                targetElement.closest("select") ||
                targetElement.closest(".absolute.z-20") ||
                targetElement.closest(".z-50") ||
                targetElement.closest(".absolute.z-30")
              ) {
                return;
              }
              e.preventDefault();
              e.stopPropagation();
              setNodeContextMenu(null);
              if (isWorkspaceEditable) {
                setCanvasContextMenu({
                  x: e.clientX,
                  y: e.clientY
                });
              }
            }}
            ref={canvasContainerRef}
            style={{ 
              cursor: activeTool === 'hand' || isSpacePressed || isPanning ? (isPanning ? "grabbing" : "grab") : "default",
              backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
              backgroundSize: canvasTheme === 'miro' ? `${20 * zoomLevel}px ${20 * zoomLevel}px` : `${30 * zoomLevel}px ${30 * zoomLevel}px`
            }}
          >


            {/* Custom SVG styling injection */}
            <style dangerouslySetInnerHTML={{__html: `
              .grid-dots-light {
                background-image: radial-gradient(circle, rgba(148, 163, 184, 0.15) 1.5px, transparent 1.5px);
              }
              .grid-blueprint-dark {
                background-image: 
                  linear-gradient(to right, rgba(30, 58, 138, 0.15) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(30, 58, 138, 0.15) 1px, transparent 1px);
              }
              .sticky-handwriting {
                font-family: 'Georgia', 'Georgia Ref', serif;
                letter-spacing: -0.01em;
              }
              .custom-scrollbar::-webkit-scrollbar {
                width: 5px;
                height: 5px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb {
                background: #5c6270;
                border-radius: 4px;
              }
            `}} />

            {/* THE INFINITE ROTTABLE / TRANSLATABLE VIEWER PORT */}
            <div 
              style={{ 
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`, 
                transformOrigin: "top left",
                width: "3500px",
                height: "2800px"
              }}
              className="absolute inset-0 p-12 select-none"
              onDragOver={(e) => e.preventDefault()}
            >

              {/* RENDER MARQUEE SELECTION BOX */}
              {marqueeBox && (
                <div 
                  className="absolute border border-blue-500 bg-blue-500/10 z-[100] pointer-events-none"
                  style={{
                    left: (Math.min(marqueeBox.startX, marqueeBox.currentX) - (canvasContainerRef.current?.getBoundingClientRect().left || 0) - panOffset.x) / zoomLevel,
                    top: (Math.min(marqueeBox.startY, marqueeBox.currentY) - (canvasContainerRef.current?.getBoundingClientRect().top || 0) - panOffset.y) / zoomLevel,
                    width: Math.abs(marqueeBox.currentX - marqueeBox.startX) / zoomLevel,
                    height: Math.abs(marqueeBox.currentY - marqueeBox.startY) / zoomLevel,
                  }}
                />
              )}
              
              {/* CANVAS OVERLAY BEZIER ROUTERS */}
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
                          <div className="bg-white border border-slate-200 text-[9px] text-slate-800 font-medium px-1.5 py-0.5 rounded shadow-sm text-center truncate">
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

              {/* RENDER DYNAMIC SHAPES */}
              {nodes.map((node) => {
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
                    {isSelected && (
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
                    )}

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
              })}

            </div>

            {/* FLOATING FLOWCHART INTERACTIVE MINIMAP VIEW */}
            <FlowchartMinimap
              nodes={nodes}
              edges={edges}
              panOffset={panOffset}
              zoomLevel={zoomLevel}
              setPanOffset={setPanOffset}
              canvasContainerRef={canvasContainerRef}
              canvasTheme={canvasTheme}
            />

             {/* Miro Coordinate & Element Stats Hover HUD overlay (HIDDEN AS REQUESTED) */}
            {/* <div className={cn(
              "absolute bottom-16 z-30 p-1.5 px-3 bg-slate-900/95 backdrop-blur-sm border border-slate-800 text-slate-300 shadow-xl rounded-xl flex items-center gap-2 text-[10px] font-mono select-none transition-all duration-300",
              // HUD hidden coordinate info
              false ? "left-[356px]" : "left-4"
            )}>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] text-emerald-400 font-medium uppercase tracking-wider">Canvas</span>
              </span>
              <div className="w-px h-3.5 bg-slate-750" />
              <span className="font-medium">X: <span className="text-slate-100">{hoverCoords.x}</span> Y: <span className="text-slate-100">{hoverCoords.y}</span></span>
              <div className="w-px h-3.5 bg-slate-750" />
              <span className="text-violet-300 font-medium">{nodes.length} Objek</span>
            </div> */}

            {/* FLOATING ACTION FLAPS OVERLAYS FOR ZERO-CLICK SIDEBAR EXPANSION */}
            {/* Left sidebar flap toggle deleted as requested by user to make canvas full */}

            {/* Right sidebar flap toggle */}
            <button
              onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
              className={cn(
                "absolute bottom-4 z-30 p-2 bg-white/70 backdrop-blur hover:bg-white/85 border border-slate-200/40 text-slate-700 hover:text-violet-600 shadow-lg rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs font-medium transition-all duration-300",
                isRightSidebarOpen ? "right-[356px]" : "right-4"
              )}
              title="Toggle Panel Properti"
            >
              <Edit3 className="w-3.5 h-3.5 text-current" />
              <span className="text-[10px] uppercase tracking-wider">Editor Properti</span>
              <span>{isRightSidebarOpen ? "▶" : "◀"}</span>
            </button>

            {/* FLOATING CANVAS ACTION RIBBON (CENTER DOCK) */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-30 flex items-center gap-1.5 bg-white/70 hover:bg-white/85 backdrop-blur-md border border-slate-200/40 p-1.5 px-3 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] select-none max-w-[85%] md:max-w-full transition-all duration-300">
              
              {/* Undo Button */}
              <button
                onClick={handleUndoClick}
                disabled={historyIndex <= 0}
                className={cn(
                  "p-2 rounded-xl transition-all flex items-center justify-center",
                  historyIndex <= 0
                    ? "text-slate-300 cursor-not-allowed"
                    : "text-slate-750 hover:bg-slate-100 hover:text-violet-600 active:scale-95"
                )}
                title="Undo Gagal Langkah (Ctrl+Z)"
              >
                <Undo className="w-3.5 h-3.5" />
              </button>

              {/* Redo Button */}
              <button
                onClick={handleRedoClick}
                disabled={historyIndex >= historyStack.length - 1}
                className={cn(
                  "p-2 rounded-xl transition-all flex items-center justify-center",
                  historyIndex >= historyStack.length - 1
                    ? "text-slate-300 cursor-not-allowed"
                    : "text-slate-750 hover:bg-slate-100 hover:text-violet-600 active:scale-95"
                )}
                title="Redo Langkah Batal (Ctrl+Shift+Z)"
              >
                <Redo className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-5 bg-slate-200 mx-1" />

              {/* Auto-Align Layout Engine */}
              <button
                onClick={handleAutoAlignNodes}
                className="p-1 px-2 text-slate-700 hover:bg-slate-100 hover:text-violet-605 rounded-xl transition-all flex items-center gap-1 active:scale-95 text-[10px] font-medium"
                title="Otomatis merapikan format diagram secara horizontal & vertikal"
              >
                <Sparkles className="w-3.5 h-3.5 text-violet-600 fill-violet-200" />
                <span className="hidden sm:inline">Auto-Align</span>
              </button>

              {/* Live Flow Simulator */}
              <button
                onClick={handleSimulateFlow}
                className={cn(
                  "p-1 px-2 rounded-xl transition-all flex items-center gap-1 active:scale-95 text-[10px] font-medium",
                  isSimulating 
                    ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-150 shadow-sm" 
                    : "text-slate-700 hover:bg-slate-100 hover:text-emerald-600"
                )}
                title={isSimulating ? "Hentikan Simulasi" : "Jalankan Simulasi Alur Kerja Visual"}
              >
                <Play className={cn("w-3.5 h-3.5", isSimulating ? "text-red-500 fill-red-200 animate-pulse" : "text-emerald-500 fill-emerald-200")} />
                <span className="hidden sm:inline">{isSimulating ? "Stop Sim" : "Simulasikan"}</span>
              </button>

              <div className="w-px h-5 bg-slate-200 mx-1" />

              {/* Export JPG Image */}
              <button
                onClick={handleExportJPG}
                className="p-2 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 rounded-xl transition-all flex items-center justify-center active:scale-95"
                title="Unduh sebagai Gambar JPG"
              >
                <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
              </button>

              {/* Download JSON backup */}
              <button
                onClick={handleExportJSON}
                className="p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600 rounded-xl transition-all flex items-center justify-center active:scale-95"
                title="Ekspor Workspace ke JSON"
              >
                <Download className="w-3.5 h-3.5 text-blue-500" />
              </button>
              {/*
                Impor diagram dari Draw.io, Miro, atau JSON.
                Seluruh alurnya (modal, handler, dan parser Draw.io/Miro
                sepanjang ~700 baris) sudah ada sejak lama tetapi tidak pernah
                dapat dijangkau: openImportModal tidak pernah dipanggil dari
                mana pun, sehingga isImportModalOpen selalu false. Tombol ini
                yang menyambungkannya.
              */}
              <button
                onClick={openImportModal}
                className="p-2 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 rounded-xl transition-all flex items-center justify-center active:scale-95"
                title="Impor Diagram (Draw.io, Miro, atau JSON)"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-500" />
              </button>

              {/* Simpan Alur DB */}
              {isWorkspaceEditable ? (
                <button
                  onClick={() => handleSaveWorkspace()}
                  className="p-2 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                  title="Simpan seluruh flowchart ini ke database"
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="px-2.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl flex items-center gap-1 text-[10px] font-medium shadow-2xs">
                  <Eye className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden sm:inline">Mode Baca Saja</span>
                </div>
              )}

              <div className="w-px h-5 bg-slate-200 mx-1" />

              {/* Clear Canvas */}
              <button
                onClick={handleClearWhiteboard}
                className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all flex items-center justify-center active:scale-95"
                title="Bersihkan Semua Bentuk dan Garis Kanvas"
              >
                <RefreshCw className="w-3.5 h-3.5 text-rose-500" />
              </button>

              <div className="w-px h-5 bg-slate-200 mx-1" />
              
              {/* Zoom Controls */}
              <div className="flex items-center gap-0.5 bg-slate-50/50 rounded-xl p-0.5 border border-slate-200/60">
                <button
                  onClick={() => setZoomLevel(prev => Math.max(0.2, prev - 0.1))}
                  className="p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-lg transition-all active:scale-95"
                  title="Perkecil (-)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="px-2 text-[10px] font-medium text-slate-600 hover:text-violet-600 w-11 text-center font-mono cursor-pointer transition-colors"
                  title="Reset Zoom (100%)"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(3.0, prev + 0.1))}
                  className="p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-lg transition-all active:scale-95"
                  title="Perbesar (+)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="w-px h-5 bg-slate-200 mx-1" />

              {/* Keyboard assistance trigger */}
              <button
                onClick={() => setIsKeyboardHelpOpen(!isKeyboardHelpOpen)}
                className={cn(
                  "p-2 rounded-xl transition-all flex items-center justify-center",
                  isKeyboardHelpOpen ? "bg-amber-50 text-amber-600 border border-amber-250" : "text-slate-500 hover:bg-slate-100"
                )}
                title="Bantuan Navigasi & Pintasan Keyboard"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>

            </div>

            {/* KEYBOARD SHORTCUTS NAVIGATIONAL HELP PANELS */}
            {isKeyboardHelpOpen && (
              <div className="absolute left-4 right-4 md:left-auto md:right-4 bottom-20 z-40 bg-slate-900/95 backdrop-blur text-white p-4 rounded-xl border border-slate-750 shadow-2xl max-w-sm space-y-3 p-4 select-none">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <span className="font-medium uppercase tracking-widest text-[9.5px] text-violet-400">Pintasan Keyboard & Tips</span>
                  <button onClick={() => setIsKeyboardHelpOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-2 text-[11px] leading-relaxed">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium font-sans">Batal Aksi (Undo)</span>
                    <kbd className="bg-slate-800 text-slate-100 border border-slate-700 p-0.5 px-1.5 rounded-md font-mono text-[9px] font-medium">Ctrl + Z</kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium font-sans">Ulangi Aksi (Redo)</span>
                    <kbd className="bg-slate-800 text-slate-100 border border-slate-700 p-0.5 px-1.5 rounded-md font-mono text-[9px] font-medium">Ctrl + Y / Ctrl+Shift+Z</kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium font-sans">Duplikasi Bentuk</span>
                    <kbd className="bg-slate-800 text-slate-100 border border-slate-700 p-0.5 px-1.5 rounded-md font-mono text-[9px] font-medium">Ctrl + D</kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium font-sans">Geser Alur (Nudge)</span>
                    <kbd className="bg-slate-800 text-slate-100 border border-slate-700 p-0.5 px-1.5 rounded-md font-mono text-[9px] font-medium">Tombol Panah Arrow (↑↓←→)</kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium font-sans font-sans">Geser Kelompok Lebar</span>
                    <kbd className="bg-slate-800 text-slate-100 border border-slate-700 p-0.5 px-1.5 rounded-md font-mono text-[9px] font-medium">Shift + Panah</kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium font-sans">Batalkan Pilihan / Tool</span>
                    <kbd className="bg-slate-800 text-slate-100 border border-slate-700 p-0.5 px-1.5 rounded-md font-mono text-[9px] font-medium">Esc</kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium font-sans">Hapus Element Terpilih</span>
                    <kbd className="bg-slate-800 text-slate-100 border border-slate-700 p-0.5 px-1.5 rounded-md font-mono text-[9px] font-medium font-sans">Delete / Backspace</kbd>
                  </div>
                </div>
                <div className="h-px bg-slate-800 my-1" />
                <p className="text-[10px] text-slate-400 italic font-mono leading-relaxed">
                  💡 Tips BNI Doc: Aktifkan mode &ldquo;Arrow&rdquo; dari toolbar sebelah kiri, klik pada komponen awal, lalu klik pada komponen kedua untuk menyambung koneksi anak panah alur secara instan.
                </p>
              </div>
            )}

          </div>

          {/* RIGHT EDIT ATTRIBUTES PANEL - SHAPES DETAILS EDITOR (FLOATING SHEET OVERLAY) */}
          <div 
            className={cn(
              "absolute right-4 top-4 bottom-4 w-80 bg-white/70 hover:bg-white/85 backdrop-blur-md border border-slate-200/40 rounded-xl py-4 px-4 space-y-4 shrink-0 overflow-y-auto z-20 text-xs shadow-[0_12px_40px_rgba(0,0,0,0.08)] transition-all duration-300 flex flex-col",
              isRightSidebarOpen ? "translate-x-0 opacity-100 pointer-events-auto" : "translate-x-[360px] opacity-0 pointer-events-none"
            )}
          >
            
            {selectedNodeId ? (
              <div className="space-y-4">
                
                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-[8.5px] font-medium tracking-wider text-slate-550 text-slate-500 uppercase">Selected Component</span>
                    <div className="text-slate-900 font-medium capitalize flex items-center gap-1.5 mt-0.5 text-xs">
                      <div className="w-2 h-2 rounded bg-violet-500" />
                      {nodes.find(n => n.id === selectedNodeId)?.type || "Unknown"}
                    </div>
                  </div>
                  <button 
                    onClick={handleDeleteSelected}
                    className="p-2 bg-rose-50 rounded-lg hover:bg-rose-100 text-rose-600 transition-all active:scale-95 shadow-sm border border-rose-150"
                    title="Hapus shape"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Shape Type Dropper Selector (Miro Dynamic conversion) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-medium text-slate-550 text-slate-500 font-medium flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-violet-600" />
                    <span>Ubah Bentuk / Tipe Shape</span>
                  </label>
                  <select
                    value={nodes.find(n => n.id === selectedNodeId)?.type || "rect"}
                    onChange={(e) => {
                      const newType = e.target.value as FlowNode["type"];
                      handleUpdateActiveNode({ type: newType });
                      toast.success(`Mengubah bentuk komponen alur menjadi: ${newType.toUpperCase()}`);
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium transition-all"
                  >
                    <option value="rect">🔲 Proses (Rectangle)</option>
                    <option value="decision">🔶 Decision / Keputusan (Diamond)</option>
                    <option value="predefined">📋 Predefined Process (Double Border)</option>
                    <option value="database">🛢️ Database Server (Cylinder)</option>
                    <option value="oval">🟢 Start / End (Oval Boundary)</option>
                    <option value="circle">⚪ Bulatan Kategori (Circle)</option>
                    <option value="sticky">💛 Catatan Tempel Miro (Sticky)</option>
                    <option value="cloud">☁️ Arsitektur Awan (Cloud)</option>
                    <option value="parallelogram">📐 Input / Output (Parallelogram)</option>
                    <option value="document">📄 Dokumen Laporan (Document)</option>
                    <option value="actor">👤 Aktor Pengguna (User Actor)</option>
                    <option value="folder">📂 Folder Penyimpanan (Folder)</option>
                    <option value="card">🗂️ Story Backlog Card</option>
                    <option value="text">✏️ Tulisan Bebas (Plain Text)</option>
                  </select>
                </div>

                {/* Edit inline message */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-medium text-slate-550 text-slate-500 font-medium">Sunting Teks</label>
                  <textarea
                    value={nodes.find(n => n.id === selectedNodeId)?.label || ""}
                    onChange={(e) => handleUpdateActiveNode({ label: e.target.value })}
                    className="w-full h-16 text-xs bg-slate-50 border border-slate-200 rounded p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium transition-all"
                    placeholder="Masukkan label teks..."
                  />
                </div>

                {/* Shape Theme Colors (Miro aesthetics) */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-medium text-slate-550 text-slate-500 block font-medium">Warna Palette Miro</span>
                  <div className="grid grid-cols-6 gap-1.5">
                    {Object.keys(colorPalettes).map((colName) => {
                      const isActive = nodes.find(n => n.id === selectedNodeId)?.color === colName;
                      return (
                        <button
                          key={colName}
                          onClick={() => handleUpdateActiveNode({ color: colName })}
                          className={cn(
                            "h-5 rounded-md hover:scale-105 border transition-all",
                            colorPalettes[colName].preview,
                            isActive ? "border-slate-400 ring-2 ring-violet-500 scale-105" : "border-slate-200"
                          )}
                          title={colName}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Borders parameters styling */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-medium text-slate-500 block font-medium">Gaya Garis Bingkai</span>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { l: "Solid", val: "solid" },
                      { l: "Putus", val: "dashed" },
                      { l: "Tanpa Garis", val: "none" }
                    ].map((st) => {
                      const currentVal = nodes.find(n => n.id === selectedNodeId)?.borderStyle || "solid";
                      return (
                        <button
                          key={st.val}
                          onClick={() => handleUpdateActiveNode({ borderStyle: st.val as any })}
                          className={cn(
                            "p-1 rounded font-medium text-[10px] text-center border capitalize transition-all",
                            currentVal === st.val 
                              ? "bg-violet-50 text-violet-700 border-violet-200" 
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                          )}
                        >
                          {st.l}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dimension adjustments */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-medium text-slate-500 block font-medium">Dimensi Ukuran</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] text-slate-400 font-medium">Lebar (W)</span>
                      <input
                        type="number"
                        min="40"
                        max="500"
                        value={nodes.find(n => n.id === selectedNodeId)?.width || 120}
                        onChange={(e) => handleUpdateActiveNode({ width: parseInt(e.target.value) || 120 })}
                        className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded p-1 mt-0.5 text-center text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-medium"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-medium">Tinggi (H)</span>
                      <input
                        type="number"
                        min="40"
                        max="500"
                        value={nodes.find(n => n.id === selectedNodeId)?.height || 120}
                        onChange={(e) => handleUpdateActiveNode({ height: parseInt(e.target.value) || 120 })}
                        className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded p-1 mt-0.5 text-center text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Integration with Workspace tasks list (LINKING TASKS BACKLOG TO SHAPES) */}
                <div className="space-y-1.5 pt-2 border-t border-slate-200">
                  <label className="text-[10px] uppercase font-medium text-slate-500 flex items-center gap-1 font-medium">
                    <Workflow className="w-3.5 h-3.5 text-violet-600" />
                    <span>Link Task Backlog BNI</span>
                  </label>
                  <p className="text-[9px] text-slate-500 mb-2 font-medium">Hubungkan bentuk dengan sprint backlog agar status tersinkronisasi otomatis.</p>
                  
                  <select
                    value={nodes.find(n => n.id === selectedNodeId)?.taskId || ""}
                    onChange={(e) => handleUpdateActiveNode({ taskId: e.target.value || undefined })}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-medium"
                  >
                    <option value="">-- Hubungkan Task --</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        [{t.key}] {t.title} ({t.status})
                      </option>
                    ))}
                  </select>
                </div>

              </div>
            ) : selectedEdgeId ? (
              <div className="space-y-4">
                
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest block font-medium">Selected Relation</span>
                  <div className="text-slate-900 font-medium mt-1 text-xs">Garis Alur Penghubung</div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-medium text-slate-500 font-medium">Lebel pada Garis Alur</label>
                  <input
                    type="text"
                    value={edges.find(e => e.id === selectedEdgeId)?.label || ""}
                    onChange={(e) => {
                      const updated = edges.map(edge => edge.id === selectedEdgeId ? { ...edge, label: e.target.value } : edge);
                      setEdges(updated);
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium transition-all"
                    placeholder="Ya / Tidak / Proses..."
                  />
                </div>

                <button
                  onClick={handleDeleteSelected}
                  className="w-full p-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-medium rounded text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Putuskan Alur
                </button>

              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 space-y-3">
                <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-400 border border-slate-200 shadow-sm">
                  <MousePointer className="w-4 h-4 text-violet-600" />
                </div>
                <div className="text-[11px] font-medium text-slate-900">Tidak ada komponen dipilih</div>
                <p className="text-[10px] text-slate-500 max-w-[190px] mx-auto leading-relaxed">
                  Klik satu komponen bentuk, catatan tempel, atau anak panah alir di canvas untuk mengubah properti ornamen.
                </p>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  </div>
)}
</div>
</div>
)}

      {/* DETAILED POPUP DIALOG: MULTI-FORMAT DIAGRAM IMPORT (Draw.io, Miro, JSON) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
          <div className="bg-white border border-slate-200 w-full max-w-xl rounded-xl shadow-xl overflow-hidden flex flex-col text-slate-800 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]">
            
            {/* Modal Head */}
            <div className="px-5 py-4 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#405189]/10 text-[#405189] flex items-center justify-center">
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
      )}

      {/* DETAILED POPUP DIALOG: TAMBAH DATA / ADD DATA / EDIT INFO DESCRIPTION */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-xl shadow-xl overflow-hidden text-slate-800">
            
            {/* Modal Head */}
            <div className="px-5 py-4 bg-white border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#405189]/10 text-[#405189] flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="font-medium text-sm text-slate-900">
                  {modalMode === "create" ? "Tambah Data Flowchart" : "Sunting Detail Dokumen"}
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleModalSubmit} className="p-5 space-y-4 text-xs">
              
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-700">
                  Nama Dokumen / Flowchart <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Penetration Testing Requirements"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#405189] focus:ring-1 focus:ring-[#405189]/20 transition-all"
                />
              </div>

              {/* Kategori Select */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-700">
                  Kategori Dokumen <span className="text-rose-500">*</span>
                </label>
                <select
                  value={flowCategory}
                  onChange={(e) => setFlowCategory(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:outline-none focus:border-[#405189] focus:ring-1 focus:ring-[#405189]/20 transition-all"
                >
                  <option value="PRD">PRD (Product Requirements Document)</option>
                  <option value="Panduan">Panduan (Technical Guideline)</option>
                  <option value="Laporan">Laporan (Report / Audit)</option>
                </select>
              </div>

              {/* Tautan Eksternal Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-700">
                  Tautan Eksternal (Google Docs / Sheets / Slides / URL)
                </label>
                <input
                  type="url"
                  placeholder="https://docs.google.com/document/d/... atau URL lain"
                  value={flowExternalUrl}
                  onChange={(e) => setFlowExternalUrl(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#405189] focus:ring-1 focus:ring-[#405189]/20 transition-all"
                />
                <p className="text-[10px] text-slate-400 leading-normal">
                  Jika memasukkan link Google Docs/Sheets/Slides, sistem akan mengubah tautan secara otomatis ke mode preview interaktif.
                </p>
              </div>

              {/* Link Epic Option integration */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-700 flex items-center gap-1.5">
                  <Workflow className="w-3.5 h-3.5 text-[#405189]" /> Link Epic Terkait
                </label>
                <select
                  value={flowEpicId}
                  onChange={(e) => setFlowEpicId(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:outline-none focus:border-[#405189] focus:ring-1 focus:ring-[#405189]/20 transition-all"
                >
                  <option value="">-- Hubungkan dengan Epic --</option>
                  {availableEpics.map((epic) => (
                    <option key={epic.id} value={epic.id}>
                      [{epic.key}] {epic.title}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Hubungkan dengan epic utama dari backlog workspace agar dokumentasi diagram alur berkaitan erat dengan milestone tim.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-700">Deskripsi Arsitektur</label>
                <textarea
                  placeholder="Ketikan ringkasan atau batasan proses flowchart ini..."
                  value={flowDescription}
                  onChange={(e) => setFlowDescription(e.target.value)}
                  className="w-full h-24 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#405189] focus:ring-1 focus:ring-[#405189]/20 transition-all"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 flex justify-end items-center gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-medium text-slate-700 transition-all text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#405189] hover:bg-[#364574] text-white font-medium rounded-lg text-xs shadow-xs transition-all"
                >
                  {modalMode === "create" ? "Buat Dokumen" : "Simpan Perubahan"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {nodeContextMenu && (
        <NodeContextMenu
          x={nodeContextMenu.x}
          y={nodeContextMenu.y}
          nodeId={nodeContextMenu.nodeId}
          nodeColor={nodes.find(n => n.id === nodeContextMenu.nodeId)?.color || "indigo"}
          onClose={() => setNodeContextMenu(null)}
          onDelete={handleContextMenuDeleteNode}
          onEditProperties={handleContextMenuEditProperties}
          onChangeColor={handleContextMenuChangeColor}
          onDuplicate={handleContextMenuDuplicate}
        />
      )}

      {canvasContextMenu && (
        <CanvasContextMenu
          x={canvasContextMenu.x}
          y={canvasContextMenu.y}
          onClose={() => setCanvasContextMenu(null)}
          onAddNode={(type, label, color) => handleAddNewNodeAtPosition(type as any, label, color, canvasContextMenu.x, canvasContextMenu.y)}
          onZoomIn={() => setZoomLevel(prev => Math.min(3.0, prev + 0.1))}
          onZoomOut={() => setZoomLevel(prev => Math.max(0.2, prev - 0.1))}
          onResetZoom={() => {
            setZoomLevel(0.9);
            setPanOffset({ x: 50, y: 50 });
          }}
          onUndo={handleUndoClick}
          onRedo={handleRedoClick}
          onClear={handleClearWhiteboard}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < historyStack.length - 1}
        />
      )}

      {/* Upload Document Modal */}
      {isUploadDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-[#405189]/10 text-[#405189] flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-medium text-slate-900">
                  Upload Dokumen Baru
                </h3>
              </div>
              <button
                onClick={closeUploadDocumentModal}
                className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1.5">Nama Dokumen</label>
                <input
                  type="text"
                  value={uploadDocName}
                  onChange={(e) => setUploadDocName(e.target.value)}
                  placeholder="Contoh: Spesifikasi Teknis v1.2"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:bg-white focus:border-[#405189] focus:ring-1 focus:ring-[#405189]/20 outline-none transition-all placeholder:text-slate-400 text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1.5">Upload File (Max 5MB)</label>
                <div className="border border-dashed border-slate-300 rounded-md p-6 flex flex-col items-center justify-center bg-slate-50/50 relative overflow-hidden group hover:border-[#405189] transition-colors">
                  <input 
                    type="file" 
                    onChange={handleDocumentFileChange}
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-10 h-10 bg-white shadow-2xs border border-slate-200 rounded-full flex items-center justify-center mb-2.5 group-hover:scale-105 transition-all text-[#405189]">
                    <Upload className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-medium text-slate-700 mb-0.5">Pilih atau Seret File Kesini</p>
                  <p className="text-[10px] text-slate-400 font-medium">Mendukung PDF, Word, Excel (Max. 5MB)</p>
                  
                  {uploadDocFile && (
                    <div className="mt-3 p-2.5 bg-indigo-50/80 border border-indigo-100 rounded-md w-full flex items-center justify-between">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-[#405189] truncate">{uploadDocFile.name}</span>
                        <span className="text-[10px] text-slate-500 font-medium">{(uploadDocFile.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex justify-end items-center gap-2">
              <button
                onClick={closeUploadDocumentModal}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSaveDocument}
                disabled={!uploadDocName || !uploadDocFile}
                className="px-4 py-2 bg-[#405189] hover:bg-[#364473] active:bg-[#2d3960] disabled:opacity-50 text-white text-xs font-medium rounded-md transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                Upload & Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        confirmText="Ya, Hapus"
        cancelText="Batal"
        variant="danger"
      />

    </div>
  );
};
