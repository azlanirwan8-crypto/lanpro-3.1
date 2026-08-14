import { useState } from "react";

export interface FlowchartDocument {
  id: string;
  name: string;
  fileData?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  createdAt: string;
  createdBy: string;
}

export interface FlowchartData {
  id: string;
  name: string;
  category?: string;
  externalUrl?: string;
  documents?: FlowchartDocument[];
  epicTaskId?: string;
  description: string;
  nodes: any[];
  edges: any[];
  theme: "miro" | "blueprint";
  createdAt: string;
  createdBy?: string;
  lastEditedAt?: string;
}

/**
 * useFlowchartList
 * Manages saved flowchart list, search, sort, pagination, and deletion
 * Handles flowchart CRUD operations and confirmation modals
 */
export function useFlowchartList() {
  // List of saved flowcharts
  const [flowcharts, setFlowcharts] = useState<FlowchartData[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);

  // Dashboard controls
  const [isEditorActive, setIsEditorActive] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(5);
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'lastEditedAt'>('lastEditedAt');

  // Confirmation modal for deletion
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  // Get current selected flowchart metadata
  const getCurrentFlowchart = (): FlowchartData | null => {
    return flowcharts.find(f => f.id === selectedFlowId) || null;
  };

  // Add new flowchart to list
  const addFlowchart = (flowchart: FlowchartData) => {
    setFlowcharts(prev => [flowchart, ...prev]);
  };

  // Update existing flowchart
  const updateFlowchart = (flowId: string, updates: Partial<FlowchartData>) => {
    setFlowcharts(prev =>
      prev.map(f => f.id === flowId ? { ...f, ...updates, lastEditedAt: new Date().toISOString() } : f)
    );
  };

  // Delete flowchart with confirmation
  const deleteFlowchart = (flowId: string, onConfirm: () => void) => {
    const flowchart = flowcharts.find(f => f.id === flowId);
    if (!flowchart) return;

    setConfirmModal({
      isOpen: true,
      title: "Hapus Diagram Alur",
      message: `Apakah Anda yakin ingin menghapus diagram "${flowchart.name}"? Aksi ini tidak dapat dibatalkan.`,
      onConfirm: () => {
        setFlowcharts(prev => prev.filter(f => f.id !== flowId));
        if (selectedFlowId === flowId) {
          setSelectedFlowId(null);
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      }
    });
  };

  // Close confirmation modal
  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  // Filter and sort flowcharts
  const getFilteredFlowcharts = (): FlowchartData[] => {
    let filtered = flowcharts;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(f =>
        f.name.toLowerCase().includes(query) ||
        f.description?.toLowerCase().includes(query) ||
        f.category?.toLowerCase().includes(query)
      );
    }

    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'createdAt':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'lastEditedAt':
          return new Date(b.lastEditedAt || b.createdAt).getTime() -
                 new Date(a.lastEditedAt || a.createdAt).getTime();
        default:
          return 0;
      }
    });

    return sorted;
  };

  // Get paginated flowcharts
  const getPaginatedFlowcharts = (): FlowchartData[] => {
    const filtered = getFilteredFlowcharts();
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    return filtered.slice(startIdx, endIdx);
  };

  // Get total pages
  const getTotalPages = (): number => {
    const filtered = getFilteredFlowcharts();
    return Math.ceil(filtered.length / itemsPerPage);
  };

  // Get total count (for display)
  const getTotalCount = (): number => {
    return getFilteredFlowcharts().length;
  };

  // Reset pagination
  const resetPagination = () => {
    setCurrentPage(1);
  };

  // Select flowchart and enter editor
  const selectFlowchart = (flowId: string) => {
    setSelectedFlowId(flowId);
    setIsEditorActive(true);
  };

  // Exit editor and return to list
  const exitEditor = () => {
    setIsEditorActive(false);
    setSelectedFlowId(null);
  };

  // Toggle editor state
  const toggleEditor = () => {
    setIsEditorActive(prev => !prev);
  };

  // Reset search and pagination
  const resetFilters = () => {
    setSearchQuery("");
    setCurrentPage(1);
    setSortBy('lastEditedAt');
  };

  // Add document to flowchart
  const addDocumentToFlowchart = (flowId: string, doc: FlowchartDocument) => {
    updateFlowchart(flowId, {
      documents: [...(flowcharts.find(f => f.id === flowId)?.documents || []), doc]
    });
  };

  // Remove document from flowchart
  const removeDocumentFromFlowchart = (flowId: string, docId: string) => {
    const flowchart = flowcharts.find(f => f.id === flowId);
    if (!flowchart) return;

    updateFlowchart(flowId, {
      documents: (flowchart.documents || []).filter(d => d.id !== docId)
    });
  };

  return {
    // State
    flowcharts,
    setFlowcharts,
    selectedFlowId,
    setSelectedFlowId,
    isEditorActive,
    setIsEditorActive,
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    sortBy,
    setSortBy,
    confirmModal,
    setConfirmModal,

    // Flowchart CRUD
    addFlowchart,
    updateFlowchart,
    deleteFlowchart,
    closeConfirmModal,
    getCurrentFlowchart,

    // Filtering & Pagination
    getFilteredFlowcharts,
    getPaginatedFlowcharts,
    getTotalPages,
    getTotalCount,
    resetPagination,
    resetFilters,

    // Navigation
    selectFlowchart,
    exitEditor,
    toggleEditor,

    // Document management
    addDocumentToFlowchart,
    removeDocumentFromFlowchart
  };
}
