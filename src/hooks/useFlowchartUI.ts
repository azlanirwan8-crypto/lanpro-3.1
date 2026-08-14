import { useState } from "react";

/**
 * useFlowchartUI
 * Manages all UI modal and sidebar states
 * Handles: modals, sidebars, keyboard help, shape dropdown, import controls
 */
export function useFlowchartUI() {
  // Popup Modal States for Creating/Editing flowchart metadata
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);

  // Modal Fields
  const [flowName, setFlowName] = useState<string>("");
  const [flowEpicId, setFlowEpicId] = useState<string>("");
  const [flowDescription, setFlowDescription] = useState<string>("");
  const [flowCategory, setFlowCategory] = useState<string>("Panduan");
  const [flowCreator, setFlowCreator] = useState<string>("");
  const [flowExternalUrl, setFlowExternalUrl] = useState<string>("");

  // Upload Document Modal States
  const [isUploadDocModalOpen, setIsUploadDocModalOpen] = useState(false);
  const [uploadDocName, setUploadDocName] = useState("");
  const [uploadDocFile, setUploadDocFile] = useState<File | null>(null);
  const [uploadDocBase64, setUploadDocBase64] = useState("");
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  // Right Side View mode ('embed' | 'canvas')
  const [rightViewMode, setRightViewMode] = useState<'embed' | 'canvas'>('embed');

  // Collapsible Responsive Sidebars
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(false);

  // Sidebar controls
  const [isShapeDropdownOpen, setIsShapeDropdownOpen] = useState<boolean>(false);
  const [shapeSearchQuery, setShapeSearchQuery] = useState<string>("");
  const [selectedAddColor, setSelectedAddColor] = useState<string>("indigo");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "Basic Shapes": true,
    "Flowchart": true,
    "Callouts": false,
    "My Shapes": false,
    "AWS": false,
    "UML": false,
  });

  // Keyboard Help & Hover Info
  const [isKeyboardHelpOpen, setIsKeyboardHelpOpen] = useState<boolean>(false);
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Multi-format Importer State
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importType, setImportType] = useState<"native" | "drawio" | "miro">("drawio");
  const [parsedImportData, setParsedImportData] = useState<{ nodes: any[]; edges: any[] } | null>(null);
  const [parsedFilename, setParsedFilename] = useState<string>("");
  const [dragOverImport, setDragOverImport] = useState<boolean>(false);

  // Modal open/close helpers
  const openCreateFlowModal = () => {
    setModalMode('create');
    resetFlowFormFields();
    setIsModalOpen(true);
  };

  const openEditFlowModal = (flowId: string, name: string, description: string, category: string, epicId: string, externalUrl: string, creator: string) => {
    setModalMode('edit');
    setEditingFlowId(flowId);
    setFlowName(name);
    setFlowDescription(description);
    setFlowCategory(category);
    setFlowEpicId(epicId);
    setFlowExternalUrl(externalUrl);
    setFlowCreator(creator);
    setIsModalOpen(true);
  };

  const closeFlowModal = () => {
    setIsModalOpen(false);
    resetFlowFormFields();
  };

  const resetFlowFormFields = () => {
    setFlowName("");
    setFlowDescription("");
    setFlowCategory("Panduan");
    setFlowEpicId("");
    setFlowExternalUrl("");
    setFlowCreator("");
    setEditingFlowId(null);
  };

  // Upload document modal helpers
  const openUploadDocumentModal = () => {
    setIsUploadDocModalOpen(true);
  };

  const closeUploadDocumentModal = () => {
    setIsUploadDocModalOpen(false);
    setUploadDocName("");
    setUploadDocFile(null);
    setUploadDocBase64("");
  };

  // Sidebar toggles
  const toggleLeftSidebar = () => setIsLeftSidebarOpen(prev => !prev);
  const toggleRightSidebar = () => setIsRightSidebarOpen(prev => !prev);
  const toggleShapeDropdown = () => setIsShapeDropdownOpen(prev => !prev);

  // Shape group expansion
  const toggleGroupExpanded = (title: string) => {
    setExpandedGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  // Keyboard help toggle
  const toggleKeyboardHelp = () => setIsKeyboardHelpOpen(prev => !prev);

  // Import modal helpers
  const openImportModal = () => {
    setIsImportModalOpen(true);
    setParsedImportData(null);
    setParsedFilename("");
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false);
    setParsedImportData(null);
    setParsedFilename("");
    setDragOverImport(false);
  };

  return {
    // Create/Edit Modal
    isModalOpen,
    setIsModalOpen,
    modalMode,
    setModalMode,
    editingFlowId,
    setEditingFlowId,
    flowName,
    setFlowName,
    flowEpicId,
    setFlowEpicId,
    flowDescription,
    setFlowDescription,
    flowCategory,
    setFlowCategory,
    flowCreator,
    setFlowCreator,
    flowExternalUrl,
    setFlowExternalUrl,

    // Upload Document Modal
    isUploadDocModalOpen,
    setIsUploadDocModalOpen,
    uploadDocName,
    setUploadDocName,
    uploadDocFile,
    setUploadDocFile,
    uploadDocBase64,
    setUploadDocBase64,
    activeDocumentId,
    setActiveDocumentId,

    // Right View Mode
    rightViewMode,
    setRightViewMode,

    // Sidebars
    isLeftSidebarOpen,
    setIsLeftSidebarOpen,
    isRightSidebarOpen,
    setIsRightSidebarOpen,

    // Shape Controls
    isShapeDropdownOpen,
    setIsShapeDropdownOpen,
    shapeSearchQuery,
    setShapeSearchQuery,
    selectedAddColor,
    setSelectedAddColor,
    expandedGroups,
    setExpandedGroups,

    // Keyboard Help & Hover Info
    isKeyboardHelpOpen,
    setIsKeyboardHelpOpen,
    hoverCoords,
    setHoverCoords,

    // Import Modal
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

    // Helpers
    openCreateFlowModal,
    openEditFlowModal,
    closeFlowModal,
    resetFlowFormFields,
    openUploadDocumentModal,
    closeUploadDocumentModal,
    toggleLeftSidebar,
    toggleRightSidebar,
    toggleShapeDropdown,
    toggleGroupExpanded,
    toggleKeyboardHelp,
    openImportModal,
    closeImportModal
  };
}
