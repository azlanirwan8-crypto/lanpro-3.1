import { safeLocalStorage, safeSessionStorage } from "../../lib/safeStorage";
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { 
  Book, 
  Plus, 
  Edit2, 
  Trash2, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  Upload, 
  Link as LinkIcon, 
  Download, 
  X, 
  Calendar, 
  User,
  Filter,
  Eye,
  FileCheck,
  FileSpreadsheet,
  Layers,
  Search,
  ExternalLink,
  BookOpen,
  Paperclip,
  CheckCircle,
  Clock,
  Sparkles,
  Info,
  AlertTriangle,
  Maximize2,
  Minimize2,
  MessageSquare,
  Send
} from 'lucide-react';
import { ResponsiveTable } from "../../components/ResponsiveTable";
import { toast } from 'sonner';
import { validateFileClient } from '../../lib/fileSecurity';
import Markdown from 'react-markdown';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { WikiEmptyState } from './components/WikiEmptyState';
import { hasPermission } from '../../lib/permissions';
import { confirmDeleteAlert, showSuccessAlert } from '../../lib/sweetalert';

import type { DocumentModel, WikiViewProps } from './types';
import {
  resolveUserId,
  fetchDocuments as fetchDocumentsApi,
  createDocument as createDocumentApi,
  updateDocument as updateDocumentApi,
  deleteDocument as deleteDocumentApi,
  downloadDocument as downloadDocumentApi,
} from './services/wiki.service';

export const WikiView: React.FC<WikiViewProps> = ({
  projectId,
  users,
  currentUser,
  masterData = [],
}) => {
  // Core states for storing documents and loading feedback
  const [documents, setDocuments] = useState<DocumentModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [dragActive, setDragActive] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);

  /* 
    ===================================================================
    STATE PENANGANAN MODAL & ACTIVE VIEW
    ===================================================================
    1. activeDocId: ID dari dokumen yang sedang terpilih untuk dibaca di panel kanan
    2. showFormModal: Flag boolean untuk mengontrol munculnya pop-up form Create/Edit
    3. showDeleteConfirmModal: Flag boolean untuk mengontrol pop-up alert konfirmasi hapus
    4. selectedDocForDelete: Menyimpan objek dokumen yang akan dihapus
    5. activeTab: Mengontrol sub-tab visual detail teks vs live preview iframe
    6. mobileActiveView: Navigasi responsif pada mobile ('list' atau 'detail')
  */
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'detail' | 'preview'>('detail');
  const [mobileActiveView, setMobileActiveView] = useState<'list' | 'detail'>('list');

  // Permission states & BOLA Check (LanPro v1.4)
  const effectiveUser = currentUser || (() => {
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

  const isAuthor = (doc: DocumentModel) => {
    if (!doc || !effectiveUser) return false;
    const author = String(doc.createdBy || '').trim().toLowerCase();
    const curId = String(effectiveUser.id || '').trim().toLowerCase();
    const curUid = String(effectiveUser.uid || '').trim().toLowerCase();
    const curUser = String(effectiveUser.username || '').trim().toLowerCase();
    const curEmail = String(effectiveUser.email || '').trim().toLowerCase();
    const curName = String(effectiveUser.name || '').trim().toLowerCase();
    const curDisplay = String(effectiveUser.displayName || '').trim().toLowerCase();
    return author !== "" && (
      author === curId ||
      author === curUid ||
      author === curUser ||
      author === curEmail ||
      author === curName ||
      author === curDisplay
    );
  };
  const canModifyDoc = (doc: DocumentModel) => isAuthor(doc) || isAdmin;

  const canCreate = useMemo(() => {
    return true;
  }, [currentUser]);

  const canUpdate = useMemo(() => {
    return true;
  }, [currentUser]);

  const canDelete = useMemo(() => {
    return true;
  }, [currentUser]);

  // Split-Pane & Preview Interactive States
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const commentsStorageKey = `lanpro_doc_comments_${projectId}`;
  const [docCommentsMap, setDocCommentsMap] = useState<Record<string, Array<{id: string, userId: string, userName: string, text: string, createdAt: string}>>>(() => {
    try {
      const saved = safeLocalStorage.getItem(commentsStorageKey);
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.error(err);
    }
    return {};
  });
  const [newDocCommentText, setNewDocCommentText] = useState("");
  const [isSendingDocComment, setIsSendingDocComment] = useState(false);

  const handleSendDocComment = () => {
    if (!activeDocId || !newDocCommentText.trim()) return;
    const userName = currentUser?.displayName || currentUser?.username || (currentUser as any)?.nama_lengkap || (currentUser as any)?.name || "Administrator";
    const newComment = {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      docId: activeDocId,
      userId: currentUser?.uid || currentUser?.id || 'anon',
      userName,
      text: newDocCommentText.trim(),
      createdAt: new Date().toISOString()
    };
    const updatedMap = {
      ...docCommentsMap,
      [activeDocId]: [...(docCommentsMap[activeDocId] || []), newComment]
    };
    setDocCommentsMap(updatedMap);
    try {
      safeLocalStorage.setItem(commentsStorageKey, JSON.stringify(updatedMap));
    } catch (e) {
      console.error(e);
    }
    setNewDocCommentText("");
    showSuccessAlert("Berhasil!", "Catatan / komentar berhasil dikirim!");
  };
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFileData, setPreviewFileData] = useState<string | null>(null);
  const directFileInputRef = useRef<HTMLInputElement>(null);

  // Form State (Untuk Modal Create/Edit)
  const [isNew, setIsNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState('PRD');
  const [editLink, setEditLink] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [shouldRemoveFile, setShouldRemoveFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editingDoc = useMemo(() => {
    if (!editId) return null;
    return documents.find(d => d.id === editId) || null;
  }, [editId, documents]);

  const isFormEditable = useMemo(() => {
    if (isNew) return true;
    if (!editingDoc) return true;
    return canModifyDoc(editingDoc);
  }, [isNew, editingDoc, canModifyDoc]);

  // Direct upload handler for active document in Main View
  const handleDirectUpload = async (file: File) => {
    const activeDocObj = documents.find(d => d.id === activeDocId);
    if (!activeDocObj) return;
    setLoading(true);
    try {
      const fileData = await fileToBase64(file);
      const payload = {
        title: activeDocObj.title,
        description: activeDocObj.description || "",
        type: activeDocObj.type,
        link: activeDocObj.link || "",
        createdBy: activeDocObj.createdBy,
        fileData: fileData,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream'
      };
      const effectiveUserId = resolveUserId(currentUser);
      const data = await updateDocumentApi(projectId, effectiveUserId, activeDocObj.id, payload);
      if (data.status === 'success') {
        showSuccessAlert("Berhasil!", "Berkas spesifikasi berhasil diunggah!");
        await fetchDocuments();
      } else {
        toast.error(data.message || "Gagal mengunggah berkas");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengunggah berkas");
    } finally {
      setLoading(false);
    }
  };

  // Helper to convert base64/dataURL string into a safe Blob URL for iframe rendering
  const base64ToBlobUrl = (base64: string, defaultMime: string = 'application/pdf'): string => {
    try {
      let bytes = base64;
      let mimeType = defaultMime;
      
      if (base64.startsWith('data:')) {
        const parts = base64.split(',');
        bytes = parts[1] || '';
        const mimeMatch = parts[0].match(/:(.*?);/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }
      }
      
      const byteCharacters = atob(bytes);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error("Gagal mengonversi base64 ke Blob URL:", err);
      return base64; // Fallback ke data-uri jika konversi gagal
    }
  };

  // Effect to handle Active Document preview data loading and notes selection
  useEffect(() => {
    if (!activeDocId) {
      setPreviewFileData(prev => {
        if (prev && prev.startsWith('blob:')) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
      setNotesText("");
      setIsEditingNotes(false);
      setIsFullscreenPreview(false);
      return;
    }
    const activeDocObj = documents.find(d => d.id === activeDocId);
    if (activeDocObj) {
      setNotesText(activeDocObj.description || "");
      setIsEditingNotes(false);
      setIsFullscreenPreview(false);

      if (activeDocObj.fileName) {
        setPreviewLoading(true);
        const effectiveUserId = resolveUserId(currentUser);
        downloadDocumentApi(projectId, effectiveUserId, activeDocId)
          .then(data => {
            if (data.status === 'success' && data.data && data.data.fileData) {
              const blobUrl = base64ToBlobUrl(data.data.fileData, data.data.fileType || 'application/pdf');
              setPreviewFileData(prev => {
                if (prev && prev.startsWith('blob:')) {
                  URL.revokeObjectURL(prev);
                }
                return blobUrl;
              });
            } else {
              setPreviewFileData(prev => {
                if (prev && prev.startsWith('blob:')) {
                  URL.revokeObjectURL(prev);
                }
                return null;
              });
            }
          })
          .catch(err => {
            console.error("Gagal memuat pratinjau dokumen:", err);
            setPreviewFileData(prev => {
              if (prev && prev.startsWith('blob:')) {
                URL.revokeObjectURL(prev);
              }
              return null;
            });
          })
          .finally(() => {
            setPreviewLoading(false);
          });
      } else {
        setPreviewFileData(prev => {
          if (prev && prev.startsWith('blob:')) {
            URL.revokeObjectURL(prev);
          }
          return null;
        });
      }
    }

    return () => {
      setPreviewFileData(prev => {
        if (prev && prev.startsWith('blob:')) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
    };
  }, [activeDocId, projectId, documents]);

  // Interactive Notes auto-save or click-to-save handler
  const handleSaveNotes = async () => {
    if (!activeDoc) return;
    setSavingNotes(true);
    try {
      const payload = {
        title: activeDoc.title,
        description: notesText,
        type: activeDoc.type,
        link: activeDoc.link || "",
        createdBy: activeDoc.createdBy
      };
      const effectiveUserId = resolveUserId(currentUser);
      const data = await updateDocumentApi(projectId, effectiveUserId, activeDoc.id, payload);
      if (data.status === 'success') {
        showSuccessAlert("Berhasil!", "Catatan berhasil disimpan!");
        await fetchDocuments();
        setIsEditingNotes(false);
      } else {
        toast.error(data.message || "Gagal menyimpan catatan");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan catatan");
    } finally {
      setSavingNotes(false);
    }
  };

  // Fetch documents from database
  const fetchDocuments = async () => {
    const effectiveUserId = resolveUserId(currentUser);
    try {
      const data = await fetchDocumentsApi(projectId, effectiveUserId);
      if (data.status === 'success') {
        setDocuments(data.data);
      }
    } catch (e: any) {
      console.error("Gagal memuat dokumen:", e);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // Reset selection states on project switch
    setActiveDocId(null);
    setShowFormModal(false);
    setMobileActiveView('list');
  }, [projectId]);



  // Grid layout catalog defaults to showing all documents at once

  // Determine standard document categories
  const documentTypes = useMemo(() => {
    const types = masterData.filter(d => d.type === 'jenis_dokumen');
    if (types.length === 0) {
      return [
        { label: 'PRD', value: 'PRD' },
        { label: 'Panduan', value: 'Panduan' },
        { label: 'Laporan', value: 'Laporan' },
        { label: 'Spesifikasi', value: 'Spesifikasi' },
        { label: 'Lainnya', value: 'Lainnya' }
      ];
    }
    const map = new Map<string, { label: string; value: string }>();
    types.sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(t => {
      if (!map.has(t.label)) {
        map.set(t.label, { label: t.label, value: t.label });
      }
    });
    return Array.from(map.values());
  }, [masterData]);

  const categoriesList = useMemo(() => {
    const set = new Set<string>(['Semua']);
    documentTypes.forEach(t => set.add(t.value));
    return Array.from(set);
  }, [documentTypes]);

  // Filter documents based on search keyword & selected category
  const filteredDocs = useMemo(() => {
    return documents.filter(d => {
      const matchSearch = d.title.toLowerCase().includes(search.toLowerCase()) || 
                          (d.description && d.description.toLowerCase().includes(search.toLowerCase()));
      const matchCategory = selectedCategory === 'Semua' || d.type === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [documents, search, selectedCategory]);

  const totalItems = filteredDocs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentDocs = filteredDocs.slice(indexOfFirstItem, indexOfLastItem);

  // Active viewed document computed object
  const activeDoc = useMemo(() => {
    return documents.find(d => d.id === activeDocId) || null;
  }, [documents, activeDocId]);

  // Trigger modal for Creating new documentation
  const handleCreateNew = () => {
    setIsNew(true);
    setEditId(null);
    setEditTitle('');
    setEditDescription('');
    setEditType(documentTypes.length > 0 ? documentTypes[0].value : 'PRD');
    setEditLink('');
    setEditFile(null);
    setShouldRemoveFile(false);
    setShowFormModal(true);
  };

  // Trigger modal for Editing existing documentation (Pre-filled)
  const handleEditClick = (doc: DocumentModel, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsNew(false);
    setEditId(doc.id);
    setEditTitle(doc.title);
    setEditDescription(doc.description || '');
    setEditType(doc.type || 'PRD');
    setEditLink(doc.link || '');
    setEditFile(null);
    setShouldRemoveFile(false);
    setShowFormModal(true);
  };

  // Trigger Confirmation Dialog for Deleting documentation
  const handleDeleteClick = async (doc: DocumentModel, e: React.MouseEvent) => {
    e.stopPropagation();
    const isConfirmed = await confirmDeleteAlert(
      "Apakah Anda Yakin?",
      `Dokumen "${doc.title}" akan dihapus secara permanen dan tidak dapat dikembalikan!`
    );
    if (!isConfirmed) return;

    setLoading(true);
    const effectiveUserId = resolveUserId(currentUser);
    try {
      const data = await deleteDocumentApi(projectId, effectiveUserId, doc.id);
      if (data.status === 'success') {
        showSuccessAlert("Berhasil!", "Data dokumen berhasil dihapus.");
        if (activeDocId === doc.id) {
          const remaining = documents.filter(d => d.id !== doc.id);
          setActiveDocId(remaining.length > 0 ? remaining[0].id : null);
          setMobileActiveView('list');
        }
        await fetchDocuments();
      } else {
        toast.error(data.message || "Gagal menghapus dokumen");
      }
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan saat menghapus");
    } finally {
      setLoading(false);
    }
  };

  // Helper to convert uploaded files to Base64 format
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Handle Form Submission (Save or Update)
  const handleSave = async () => {
    if (!editTitle.trim()) {
      toast.error("Judul dokumen wajib diisi");
      return;
    }
    setLoading(true);
    try {
      let fileData = null;
      let fileName = shouldRemoveFile ? "" : (editId ? (documents.find(d => d.id === editId)?.fileName || "") : "");
      let fileTypeStr = shouldRemoveFile ? "" : (editId ? (documents.find(d => d.id === editId)?.fileType || "") : "");

      if (editFile) {
        fileData = await fileToBase64(editFile);
        fileName = editFile.name;
        fileTypeStr = editFile.type || 'application/octet-stream';
      }

      const payload: any = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        type: editType,
        link: editLink.trim(),
        createdBy: currentUser?.id || currentUser?.uid || (users.length > 0 ? users[0].id : "3")
      };

      if (editFile) {
        payload.fileData = fileData;
        payload.fileName = fileName;
        payload.fileType = fileTypeStr;
      } else if (shouldRemoveFile) {
        payload.fileData = null;
        payload.fileName = "";
        payload.fileType = "";
      }

      const effectiveUserId = resolveUserId(currentUser);
      if (isNew) {
        const data = await createDocumentApi(projectId, effectiveUserId, payload);
        if (data.status === 'success') {
          showSuccessAlert("Berhasil!", "Dokumen baru berhasil dibuat!");
          setShowFormModal(false);
          setActiveDocId(null);
          setCurrentPage(1);
          await fetchDocuments();
        } else {
          toast.error(data.message || "Gagal menyimpan dokumen");
        }
      } else if (editId) {
        const data = await updateDocumentApi(projectId, effectiveUserId, editId, payload);
        if (data.status === 'success') {
          showSuccessAlert("Berhasil!", "Dokumen berhasil diperbarui!");
          setShowFormModal(false);
          setActiveDocId(null);
          setCurrentPage(1);
          await fetchDocuments();
        } else {
          toast.error(data.message || "Gagal mengupdate dokumen");
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Terjadi kesalahan sistem saat menyimpan");
    } finally {
      setLoading(false);
    }
  };

  // Download logic for attached files
  const handleDownload = async (docId: string, fName: string) => {
    toast.info("Mendownload berkas lampiran...");
    const effectiveUserId = resolveUserId(currentUser);
    try {
      const data = await downloadDocumentApi(projectId, effectiveUserId, docId);
      if (data.status === 'success' && data.data && data.data.fileData) {
        const link = document.createElement("a");
        link.href = data.data.fileData;
        link.download = fName || "Document";
        link.click();
        fetchDocuments(); // Update download statistics
      } else {
        toast.error("File tidak ditemukan di server");
      }
    } catch (e: any) {
      toast.error(e.message || "Gagal mengunduh file");
    }
  };

  // Helper UI methods
  const getUserName = (id?: string) => {
    if (!id || id === "guest" || id === "admin" || id === currentUser?.id || id === currentUser?.uid) {
      return currentUser?.displayName || currentUser?.username || "Administrator";
    }
    const list = Array.isArray(users) ? users : [];
    const u = list.find(u => u && (u.id === id || u.uid === id || u.username === id || u.email === id));
    return u?.displayName || u?.username || currentUser?.displayName || "Administrator";
  };

  const getUserInitials = (id: string) => {
    const name = getUserName(id);
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';
  };

  const getEmbedUrl = (url?: string): string => {
    if (!url) return "";
    let trimmed = url.trim();
    if (trimmed.includes("docs.google.com/document")) {
      if (trimmed.includes("/edit")) {
        return trimmed.split("/edit")[0] + "/preview";
      }
      return trimmed;
    }
    if (trimmed.includes("docs.google.com/spreadsheets")) {
      if (trimmed.includes("/edit")) {
        return trimmed.split("/edit")[0] + "/preview?widget=true&headers=false";
      }
      return trimmed;
    }
    if (trimmed.includes("docs.google.com/presentation")) {
      if (trimmed.includes("/edit")) {
        return trimmed.split("/edit")[0] + "/embed?start=false&loop=false&delayms=3000";
      }
      return trimmed;
    }
    return trimmed;
  };

  // Drag and drop events for file uploading
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setEditFile(e.dataTransfer.files[0]);
      setShouldRemoveFile(false);
      showSuccessAlert("Berhasil!", `File terpilih: ${e.dataTransfer.files[0].name}`);
    }
  };

  // Color classes map for document categories
  const getCategoryStyles = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'PRD':
        return {
          bg: 'bg-indigo-50 border-indigo-100 text-primary hover:bg-indigo-100/50',
          badge: 'bg-indigo-50 text-primary border border-indigo-100 text-xs sm:text-[10px] font-medium px-2.5 py-0.5 rounded-md tracking-wider uppercase whitespace-nowrap inline-block',
          accent: 'border-primary'
        };
      case 'PANDUAN':
        return {
          bg: 'bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100/50',
          badge: 'bg-blue-50 text-blue-700 border border-blue-100 text-xs sm:text-[10px] font-medium px-2.5 py-0.5 rounded-md tracking-wider uppercase whitespace-nowrap inline-block',
          accent: 'border-blue-500'
        };
      case 'LAPORAN':
        return {
          bg: 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100/50',
          badge: 'bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs sm:text-[10px] font-medium px-2.5 py-0.5 rounded-md tracking-wider uppercase whitespace-nowrap inline-block',
          accent: 'border-emerald-500'
        };
      case 'SPESIFIKASI':
        return {
          bg: 'bg-purple-50 border-purple-100 text-purple-700 hover:bg-purple-100/50',
          badge: 'bg-purple-50 text-purple-700 border border-purple-100 text-xs sm:text-[10px] font-medium px-2.5 py-0.5 rounded-md tracking-wider uppercase whitespace-nowrap inline-block',
          accent: 'border-purple-500'
        };
      default:
        return {
          bg: 'bg-surface-sunken border-border-faint text-content-body hover:bg-surface-muted/50',
          badge: 'bg-surface-sunken text-content-body border border-border-subtle text-xs sm:text-[10px] font-medium px-2.5 py-0.5 rounded-md tracking-wider uppercase whitespace-nowrap inline-block',
          accent: 'border-slate-500'
        };
    }
  };

  const getCategoryIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'PRD':
        return <Layers className="w-3.5 h-3.5 text-indigo-600 group-hover:scale-110 transition-transform duration-300" />;
      case 'PANDUAN':
        return <BookOpen className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform duration-300" />;
      case 'LAPORAN':
        return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform duration-300" />;
      case 'SPESIFIKASI':
        return <FileCheck className="w-3.5 h-3.5 text-violet-600 group-hover:scale-110 transition-transform duration-300" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-content-muted group-hover:scale-110 transition-transform duration-300" />;
    }
  };

  const getCategoryGlow = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'PRD':
        return 'from-indigo-400/80 via-indigo-500/80 to-indigo-400/80';
      case 'PANDUAN':
        return 'from-blue-400/80 via-blue-500/80 to-blue-400/80';
      case 'LAPORAN':
        return 'from-emerald-400/80 via-emerald-500/80 to-emerald-400/80';
      case 'SPESIFIKASI':
        return 'from-violet-400/80 via-violet-500/80 to-violet-400/80';
      default:
        return 'from-slate-400/80 via-slate-500/80 to-slate-400/80';
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 overflow-hidden relative">
      {!activeDocId ? (
        <div className="w-full flex-1 flex flex-col p-3 md:p-6 min-h-0 overflow-hidden bg-[#f4f7f9] text-left font-sans">
        <div className="flex-1 flex flex-col min-h-0 bg-surface border border-border-subtle/80 rounded-lg shadow-soft overflow-hidden">
          
          <div className="flex-1 flex flex-col min-h-0 bg-surface">
            {/* Header / Action Bar */}
            <div className="p-5 md:p-6 border-b border-border-subtle/80 bg-surface flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-md text-primary shadow-2xs">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-content tracking-tight">Documentation</h3>
                  <p className="text-xs font-medium text-content-muted mt-0.5">
                    Kelola dokumentasi proyek, PRD, spesifikasi teknis, dan panduan tim.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-72">
                  <input
                    type="text"
                    placeholder="Cari dokumentasi..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-9 pr-3.5 py-1.5 bg-surface border border-border-subtle rounded-md text-xs placeholder:text-content-subtle outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-content-strong font-medium shadow-2xs"
                  />
                  <Search className="w-3.5 h-3.5 text-content-subtle absolute left-3 top-1/2 -translate-y-1/2" />
                </div>

                {canCreate && (
                  <button
                    onClick={handleCreateNew}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-hover active:bg-primary-active text-white rounded-md text-xs font-medium transition-all shadow-xs cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" /> Add Document
                  </button>
                )}
              </div>
            </div>

            {/* Datatable Container */}
            <div className="flex-1 overflow-x-auto overflow-y-auto m-5 bg-surface rounded-md border border-border-subtle/80 shadow-2xs">
              <ResponsiveTable className="w-full text-left border-collapse min-w-[880px]">
                <thead>
                  <tr className="bg-primary/5 border-b border-primary/15 text-xs sm:text-[11px] font-semibold text-primary uppercase tracking-wider whitespace-nowrap">
                    <th className="py-3 px-4 w-14 text-center">No</th>
                    <th className="py-3 px-4 min-w-[200px] max-w-[320px]">Document Title</th>
                    <th className="py-3 px-4 w-44">Category</th>
                    <th className="py-3 px-4 w-44">Document File</th>
                    <th className="py-3 px-4 w-40">Author</th>
                    <th className="py-3 px-4 w-36">Last Updated</th>
                    <th className="py-3 px-4 w-28 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-faint text-xs font-medium text-content-body">
                  {currentDocs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-content-subtle">
                        <div className="w-12 h-12 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-3 text-primary shadow-2xs">
                          <FileText className="w-5 h-5" />
                        </div>
                        <p className="font-medium text-content-strong text-sm">Dokumen tidak ditemukan</p>
                        <p className="text-xs text-content-subtle mt-1">Buat dokumen baru atau sesuaikan kata kunci pencarian Anda.</p>
                      </td>
                    </tr>
                  ) : (
                    currentDocs.map((doc, index) => {
                      const srNo = (currentPage - 1) * itemsPerPage + index + 1;
                      const creatorName = getUserName(doc.createdBy);
                      const style = getCategoryStyles(doc.type);
                      const lastEdited = doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' }) : "-";

                      return (
                        <tr
                          key={doc.id}
                          onClick={() => {
                            setActiveDocId(doc.id);
                            setMobileActiveView('detail');
                          }}
                          className="hover:bg-surface-sunken/80 transition-colors duration-150 group cursor-pointer whitespace-nowrap h-12"
                        >
                          <td className="py-2.5 px-4 text-center text-content-subtle font-medium whitespace-nowrap">
                            {String(srNo).padStart(2, "0")}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-content group-hover:text-primary transition-colors max-w-[320px]">
                            <div className="truncate">{doc.title}</div>
                            {doc.description && (
                              <div className="text-content-subtle font-normal text-xs sm:text-[11px] truncate mt-0.5">
                                {doc.description}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className={style.badge}>
                              {doc.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            {doc.fileName ? (
                              <button
                                onClick={() => handleDownload(doc.id, doc.fileName)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md text-xs font-medium transition-all cursor-pointer group/file shadow-2xs"
                                title="Klik untuk mengunduh berkas"
                              >
                                <Download className="w-3.5 h-3.5 shrink-0 text-emerald-600 group-hover/file:scale-110 transition-transform" />
                                <span className="truncate max-w-[130px]">{doc.fileName}</span>
                              </button>
                            ) : (
                              <span className="text-slate-300 italic text-xs">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-content-body font-medium whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                uid={doc.createdBy}
                                members={users}
                                name={creatorName}
                                className="w-6 h-6 text-xs sm:text-[10px]"
                              />
                              <span className="truncate max-w-[130px]">{creatorName}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-content-muted font-medium whitespace-nowrap">
                            {lastEdited}
                          </td>
                          <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setActiveDocId(doc.id);
                                  setMobileActiveView('detail');
                                }}
                                className="p-1.5 text-content-subtle hover:text-primary hover:bg-indigo-50 rounded-md transition-all cursor-pointer"
                                title="Lihat detail dokumen"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {canModifyDoc(doc) && (
                                <>
                                  <button
                                    onClick={(e) => handleEditClick(doc, e)}
                                    className="p-1.5 text-content-subtle hover:text-primary hover:bg-indigo-50 rounded-md transition-all cursor-pointer"
                                    title="Edit dokumen"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteClick(doc, e)}
                                    className="p-1.5 text-content-subtle hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                                    title="Hapus dokumen"
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

            {/* Table Footer / Pagination */}
            <div className="px-6 py-4 border-t border-border-subtle bg-surface-sunken/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-content-muted font-medium">
                Showing {totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 bg-surface border border-border-subtle text-content-secondary hover:bg-surface-sunken rounded-md text-xs font-medium disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-medium px-2 text-content-secondary">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 bg-surface border border-border-subtle text-content-secondary hover:bg-surface-sunken rounded-md text-xs font-medium disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
      ) : (
        <div className="w-full flex-1 flex flex-col min-h-0 bg-surface-sunken text-left font-sans">
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 md:p-6 space-y-4 animate-in fade-in duration-300">
            {activeDoc ? (
              <>
                
                {/* Panel 1: Top Actions */}
                <div className="bg-surface border border-border-subtle rounded-lg p-3.5 md:p-4 flex items-center justify-between shadow-2xs shrink-0">
                  <button
                    onClick={() => setActiveDocId(null)}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-100 px-3 py-1.5 rounded-md transition-all cursor-pointer shrink-0 shadow-2xs"
                    title="Kembali ke Daftar Dokumen"
                  >
                    <ChevronLeft className="w-4 h-4" /> Daftar
                  </button>

                  <div className="flex items-center gap-2 shrink-0 z-10 select-none">
                    {/* Download button if document has a file */}
                    {activeDoc.fileName && (
                      <button
                        onClick={() => handleDownload(activeDoc.id, activeDoc.fileName)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium text-xs border border-emerald-200 rounded-md transition-all cursor-pointer whitespace-nowrap shadow-2xs"
                        title="Unduh Lampiran Berkas"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Unduh</span>
                      </button>
                    )}

                    {/* Fullscreen Toggle */}
                    {(activeDoc.fileName || activeDoc.link) && (
                      <button
                        onClick={() => setIsFullscreenPreview(!isFullscreenPreview)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 font-medium text-xs border rounded-md transition-all cursor-pointer whitespace-nowrap shadow-2xs",
                          isFullscreenPreview 
                            ? "bg-slate-900 border-slate-900 text-white hover:bg-slate-800" 
                            : "bg-surface border-border-subtle text-content-body hover:bg-surface-sunken"
                        )}
                        title={isFullscreenPreview ? "Keluar Layar Penuh" : "Pratinjau Layar Penuh"}
                      >
                        {isFullscreenPreview ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">{isFullscreenPreview ? "Normal" : "Layar Penuh"}</span>
                      </button>
                    )}

                    {/* Edit & Delete Action Row */}
                    {activeDoc && canModifyDoc(activeDoc) && (
                      <>
                        <button
                          onClick={(e) => handleEditClick(activeDoc, e)}
                          className="p-1.5 text-content-muted hover:text-primary hover:bg-indigo-50 rounded-md transition-all cursor-pointer border border-border-subtle bg-surface shadow-2xs"
                          title="Ubah Judul & Kategori"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(activeDoc, e)}
                          className="p-1.5 text-content-muted hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer border border-border-subtle bg-surface shadow-2xs"
                          title="Hapus Dokumentasi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Panel 2: Meta Context & Title */}
                <div className="bg-surface border border-border-subtle rounded-lg p-5 md:p-6 shadow-2xs shrink-0">
                  <div className="flex flex-wrap items-center gap-2 select-none mb-3">
                    <span className={getCategoryStyles(activeDoc.type).badge}>
                      {activeDoc.type}
                    </span>
                    <span className="text-xs sm:text-[10px] text-content-subtle font-medium flex items-center gap-1">
                      <User className="w-3 h-3 text-content-subtle" /> {getUserName(activeDoc.createdBy)}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs sm:text-[10px] text-content-subtle font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-content-subtle" /> 
                      {new Date(activeDoc.createdAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  <h2 className="text-xl md:text-2xl font-medium text-content tracking-tight leading-snug flex items-center gap-2.5">
                    <FileText className="w-6 h-6 text-primary shrink-0" />
                    <span className="truncate">{activeDoc.title}</span>
                  </h2>
                </div>

                {/* Panel 3: Split-Pane Dual Workspace Layout */}
                <div className="bg-surface border border-border-subtle rounded-lg shadow-2xs flex-1 flex flex-col md:flex-row min-h-[600px] overflow-hidden p-3 gap-3">
                  
                  {/* LEFT PANE / MAIN VIEW (DOCUMENT VIEWER) */}
                  <div className="flex-1 bg-surface border border-border-subtle/80 rounded-lg flex flex-col min-h-0 overflow-hidden relative shadow-2xs">
                  {/* Title Bar Left Pane */}
                  <div className="px-4 py-2.5 bg-surface-sunken border-b border-border-subtle/80 flex items-center justify-between shrink-0 select-none">
                    <span className="text-xs sm:text-[10px] font-medium text-content-muted uppercase tracking-wider flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-primary" />
                      Pratinjau Dokumen Utama
                    </span>
                    {activeDoc.fileName && (
                      <span className="text-xs sm:text-[10px] sm:text-[8px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        Disematkan: {activeDoc.fileType.split('/')[1]?.toUpperCase() || 'FILE'}
                      </span>
                    )}
                  </div>

                  {/* Left Pane Workspace View State */}
                  <div className="flex-1 min-h-0 relative bg-surface-sunken/50 flex flex-col">
                    {previewLoading ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
                        <p className="text-xs font-medium text-content-muted">Memuat pratinjau dokumen...</p>
                      </div>
                    ) : previewFileData ? (
                      /* Embedded Document Viewer with Bulletproof Safe View Actions */
                      <div className="flex-1 flex flex-col relative bg-surface-sunken min-h-0 overflow-hidden">
                        {/* Safe View Toolbar Info Bar */}
                        <div className="bg-amber-50/90 border-b border-amber-200/60 p-3 sm:px-4 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs z-10 shrink-0">
                          <div className="flex items-start gap-2.5">
                            <span className="p-1 bg-amber-100 text-amber-800 rounded-md mt-0.5 shrink-0">
                              <Info className="w-3.5 h-3.5" />
                            </span>
                            <div>
                              <p className="font-medium text-amber-950 leading-tight">Pratinjau PDF Terbatas di Iframe</p>
                              <p className="text-xs sm:text-[10px] text-amber-800/90 font-medium mt-0.5 leading-normal">
                                Keamanan browser memblokir pratinjau PDF blob langsung. Klik tombol di samping untuk membuka atau mengunduh.
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                            <a
                              href={previewFileData}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-hover active:bg-primary-active text-white font-medium text-xs sm:text-[10px] uppercase tracking-wide rounded-md shadow-xs transition-all cursor-pointer whitespace-nowrap"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Buka di Tab Baru
                            </a>

                            <button
                              onClick={() => handleDownload(activeDoc.id, activeDoc.fileName)}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-surface-sunken text-content-body font-medium text-xs sm:text-[10px] uppercase tracking-wide border border-border-subtle rounded-md shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                            >
                              <Download className="w-3 h-3 text-primary" />
                              Unduh PDF
                            </button>
                          </div>
                        </div>

                        {/* PDF Frame */}
                        <div className="flex-1 relative min-h-0 bg-surface">
                          <iframe
                            src={previewFileData}
                            className="w-full h-full border-none absolute inset-0 bg-surface"
                            title={activeDoc.title}
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>
                    ) : activeDoc.link ? (
                      /* Embed Google Doc Preview */
                      <iframe
                        src={getEmbedUrl(activeDoc.link)}
                        className="w-full h-full border-none absolute inset-0 bg-surface"
                        title={activeDoc.title}
                        referrerPolicy="no-referrer"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      />
                    ) : (
                      /* Empty State: Drag-Drop File Uploader */
                      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface-sunken/40">
                        <div 
                          onDragEnter={handleDrag}
                          onDragOver={handleDrag}
                          onDragLeave={handleDrag}
                          onDrop={handleDrop}
                          onClick={() => {
                            if (canUpdate) directFileInputRef.current?.click();
                          }}
                          className={cn(
                            "border-2 border-dashed rounded-md p-5 max-w-sm w-full flex flex-col items-center justify-center gap-3 text-center group transition-all bg-surface shadow-2xs",
                            canUpdate 
                              ? "cursor-pointer hover:border-primary hover:bg-indigo-50/10" 
                              : "cursor-not-allowed opacity-70 border-border-subtle"
                          )}
                        >
                          <div className="w-12 h-12 bg-indigo-50 text-primary rounded-md flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform duration-200">
                            <Upload className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-xs font-medium text-content-strong tracking-tight group-hover:text-primary transition-colors">
                              Belum Ada Lampiran Berkas
                            </h4>
                            <p className="text-xs sm:text-[10px] text-content-subtle font-medium leading-normal mt-1 max-w-xs mx-auto">
                              {canUpdate 
                                ? "Seret & lepaskan file PDF spesifikasi teknis di sini, atau klik untuk memilih file dari komputer Anda." 
                                : "Pengguna dengan akses edit dapat mengunggah dokumen PDF spesifikasi di sini."}
                            </p>
                          </div>
                          
                          {canUpdate && (
                            <input 
                              type="file" 
                              ref={directFileInputRef} 
                              className="hidden" 
                              accept=".pdf"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  const selected = e.target.files[0];
                                  const check = validateFileClient(selected);
                                  if (!check.valid) {
                                    toast.error(check.error || "Gagal Mengunggah Dokumen: Format file tidak didukung atau ukuran melebihi batas maksimum (Max 10MB).");
                                    return;
                                  }
                                  handleDirectUpload(selected);
                                }
                              }}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT PANE / SIDE WIDGET (CATATAN & KOMENTAR CHAT BUBBLE) */}
                <div className={cn(
                  "w-full md:w-[350px] lg:w-[400px] shrink-0 bg-surface border border-border-subtle/80 rounded-lg flex flex-col min-h-0 overflow-hidden shadow-2xs transition-all duration-300",
                  isFullscreenPreview ? "hidden md:hidden" : "flex"
                )}>
                  {/* Side Pane Header */}
                  <div className="px-4 py-3 bg-surface-sunken border-b border-border-subtle/80 flex items-center justify-between shrink-0 select-none">
                    <span className="text-xs sm:text-[11px] font-medium text-content-body uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      Catatan & Komentar Diskusi
                    </span>
                    <span className="text-xs sm:text-[10px] font-medium text-content-muted bg-slate-200/60 px-2 py-0.5 rounded-full">
                      {(activeDocId ? (docCommentsMap[activeDocId] || []) : []).length} Catatan
                    </span>
                  </div>

                  {/* Comments Chat Bubbles Area */}
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 bg-surface-sunken/30">
                    {(!activeDocId || (docCommentsMap[activeDocId] || []).length === 0) ? (
                      <div className="text-center py-12 px-4 my-auto">
                        <div className="w-12 h-12 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-3 text-primary shadow-2xs">
                          <MessageSquare className="w-6 h-6" />
                        </div>
                        <h4 className="text-xs font-medium text-content-strong">Belum Ada Catatan / Komentar</h4>
                        <p className="text-xs sm:text-[11px] text-content-subtle font-medium mt-1 leading-normal">
                          Siapa pun dapat memberikan catatan teknis, instruksi rilis, atau umpan balik untuk dokumen ini.
                        </p>
                      </div>
                    ) : (
                      (docCommentsMap[activeDocId] || []).map((comment) => {
                        const isMine = currentUser && (comment.userId === currentUser.uid || comment.userId === currentUser.id || comment.userName === currentUser.displayName);
                        return (
                          <div key={comment.id} className={cn("flex w-full mb-2", isMine ? "justify-end" : "justify-start")}>
                            <div className={cn(
                              "flex flex-col max-w-[85%] md:max-w-xl",
                              isMine ? "items-end" : "items-start"
                            )}>
                              {!isMine && (
                                <span className="text-xs sm:text-[10px] font-medium text-content-muted mb-0.5 ml-1">{comment.userName}</span>
                              )}
                              <div className={cn(
                                "px-3.5 py-2.5 rounded-md relative shadow-2xs group",
                                isMine ? "bg-primary text-white" : "bg-surface text-content-strong border border-border-subtle"
                              )}>
                                <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words min-w-[50px] pb-3.5">
                                  {comment.text}
                                </p>
                                <span className={cn(
                                  "absolute bottom-1 right-3 text-xs sm:text-[11px] sm:text-[9px] font-medium tracking-tight",
                                  isMine ? "text-indigo-200" : "text-content-subtle"
                                )}>
                                  {new Date(comment.createdAt).toLocaleTimeString("id-ID", {
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Input Bar for Comments */}
                  <div className="p-3 border-t border-border-subtle bg-surface shrink-0">
                    <div className="flex items-center gap-2 bg-surface-sunken rounded-md px-3 py-1 border border-border-subtle focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                      <input
                        type="text"
                        placeholder="Tulis catatan atau komentar..."
                        value={newDocCommentText}
                        onChange={(e) => setNewDocCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isSendingDocComment && newDocCommentText.trim()) {
                            handleSendDocComment();
                          }
                        }}
                        className="w-full bg-transparent border-0 focus:ring-0 outline-none text-xs text-content-strong placeholder:text-content-subtle py-1 font-medium"
                      />
                      <button
                        onClick={handleSendDocComment}
                        disabled={!newDocCommentText.trim()}
                        className="p-1.5 bg-primary hover:bg-primary-hover text-white disabled:opacity-40 cursor-pointer rounded-md transition-all shrink-0 shadow-2xs flex items-center justify-center"
                        title="Kirim Catatan"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
            ) : (
              /* Workspace Empty State */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface border border-border-subtle rounded-lg shadow-2xs select-none">
                <div className="w-14 h-14 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4 text-primary shadow-2xs">
                  <BookOpen className="w-7 h-7" />
                </div>
                <h2 className="text-sm font-medium text-content-strong tracking-tight">
                  Pilih atau Buat Dokumentasi
                </h2>
                <p className="text-xs font-medium text-content-subtle mt-1 max-w-sm leading-relaxed mx-auto">
                  Pilih salah satu dokumen di panel kiri atau klik tombol tambah untuk membuat dokumen baru.
                </p>
                {canCreate && (
                  <button
                    onClick={handleCreateNew}
                    className="mt-5 px-4 py-2 bg-primary hover:bg-primary-hover active:bg-primary-active text-white rounded-md text-xs font-medium shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> TAMBAH DOKUMEN BARU
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* OVERLAY PORT (MODALS) */}
      <AnimatePresence>
        
        {/* ==============================================================
            A. FORM MODAL (POP-UP FORM UNTUK CREATE & EDIT)
            ============================================================== */}
        {showFormModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-surface rounded-lg shadow-xl border border-border-subtle max-w-2xl w-full flex flex-col relative overflow-hidden my-auto max-h-[90vh]"
            >
              {/* Modal header decor */}
              <div className="bg-surface-sunken/80 px-5 py-3.5 border-b border-border-faint flex justify-between items-center select-none">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-indigo-50 border border-indigo-100 text-primary rounded-md flex items-center justify-center shadow-2xs">
                    {isNew ? <Plus className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-xs md:text-sm font-medium text-content tracking-tight">
                      {isNew ? 'Tambah Dokumen Baru' : 'Ubah Data Dokumentasi'}
                    </h3>
                    <p className="text-xs sm:text-[10px] font-medium text-content-subtle uppercase tracking-wider mt-0.5">Formulir Dokumentasi Proyek</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowFormModal(false)}
                  className="p-1 hover:bg-surface-muted text-content-subtle hover:text-content-strong rounded-md transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form entries body */}
              <div className="p-5 md:p-6 overflow-y-auto space-y-4">
                
                {/* Title Input */}
                <div className="space-y-1">
                  <label className="text-xs sm:text-[10px] font-medium text-content-muted uppercase tracking-wider block">
                    Judul Dokumen <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Contoh: PRD Fitur Pembayaran, SOP Server Production, dll"
                    className="w-full bg-surface border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary/20 px-3 py-2 rounded-md text-xs font-medium text-content-strong outline-none transition-all placeholder:text-content-subtle shadow-2xs"
                  />
                </div>

                {/* Markdown Text Description Input */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center select-none">
                    <label className="text-xs sm:text-[10px] font-medium text-content-muted uppercase tracking-wider block">
                      Rangkuman / Catatan Dokumentasi
                    </label>
                    <span className="text-xs sm:text-[11px] sm:text-[9px] font-medium text-content-subtle bg-surface-sunken px-1.5 py-0.5 rounded border border-border-subtle">
                      Mendukung Markdown 📝
                    </span>
                  </div>
                  <textarea 
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Tuliskan spesifikasi detail, instruksi instalasi, atau memo kerja di sini..."
                    className="w-full bg-surface border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary/20 px-3 py-2 rounded-md text-xs font-medium text-content-body outline-none transition-all placeholder:text-content-subtle min-h-[100px] resize-y font-sans shadow-2xs"
                  />
                </div>

                {/* Dropdowns & Links Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Type drop-down selection */}
                  <div className="space-y-1">
                    <label className="text-xs sm:text-[10px] font-medium text-content-muted uppercase tracking-wider block">
                      Jenis Kategori
                    </label>
                    <div className="relative">
                      <select 
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                        className="w-full bg-surface border border-border-subtle pl-3 pr-8 py-2 rounded-md text-xs font-medium text-content-body outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 appearance-none cursor-pointer transition-all shadow-2xs"
                      >
                        {documentTypes.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <ChevronRight className="w-3.5 h-3.5 text-content-subtle absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none rotate-90" />
                    </div>
                  </div>

                  {/* External URL Link */}
                  <div className="space-y-1">
                    <label className="text-xs sm:text-[10px] font-medium text-content-muted uppercase tracking-wider block">
                      Tautan Google Docs / Slides (Opsional)
                    </label>
                    <input 
                      type="url" 
                      value={editLink}
                      onChange={(e) => setEditLink(e.target.value)}
                      placeholder="https://docs.google.com/document/..."
                      className="w-full bg-surface border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary/20 px-3 py-2 rounded-md text-xs font-medium text-content-body outline-none transition-all placeholder:text-content-subtle font-mono shadow-2xs"
                    />
                  </div>
                </div>

                {/* File Uploading Drag-Drop Sandbox */}
                <div className="space-y-1">
                  <label className="text-xs sm:text-[10px] font-medium text-content-muted uppercase tracking-wider block">
                    Lampiran Berkas (PDF / DOCX / XLSX)
                  </label>
                  
                  <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center gap-2 cursor-pointer text-center group transition-all",
                      dragActive 
                        ? "border-primary bg-indigo-50/50" 
                        : "border-border-subtle bg-surface-sunken/50 hover:border-primary hover:bg-indigo-50/10"
                    )}
                  >
                    <Upload className={cn("w-5 h-5 text-content-subtle group-hover:text-primary transition-colors", dragActive && "text-primary")} />

                    {editFile ? (
                      <div>
                        <p className="text-xs sm:text-[11px] font-medium text-primary bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-md inline-flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          {editFile.name}
                        </p>
                        <p className="text-xs sm:text-[10px] sm:text-[8px] font-medium text-content-subtle uppercase tracking-wider mt-1">
                          Klik untuk mengganti berkas lampiran
                        </p>
                      </div>
                    ) : (isNew === false && editId && documents.find(d => d.id === editId)?.fileName && !shouldRemoveFile) ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 bg-surface-muted border border-border-subtle px-2.5 py-1 rounded-md justify-center w-max mx-auto">
                          <FileText className="w-3 h-3 text-content-muted" />
                          <p className="text-xs sm:text-[11px] font-medium text-content-body max-w-[150px] truncate">
                            {documents.find(d => d.id === editId)?.fileName}
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <p className="text-xs sm:text-[10px] sm:text-[8px] font-medium text-content-subtle uppercase tracking-wider">
                            Klik area untuk mengunggah berkas baru
                          </p>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShouldRemoveFile(true);
                              toast.info("Lampiran lama akan terhapus setelah disimpan");
                            }}
                            className="text-xs sm:text-[10px] sm:text-[8px] font-medium text-rose-600 bg-rose-50 border border-rose-100 p-0.5 px-1.5 rounded hover:bg-rose-100 transition-colors"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-medium text-content-body group-hover:text-primary transition-colors">
                          Pilih berkas dari komputer Anda
                        </h4>
                        <p className="text-xs sm:text-[11px] sm:text-[9px] text-content-subtle font-medium leading-normal">
                          Seret & lepaskan berkas di sini (Maks 10MB)
                        </p>
                      </div>
                    )}

                    {shouldRemoveFile && !editFile && (
                      <div className="p-0.5 px-2 bg-rose-50 text-rose-700 border border-rose-100 rounded text-xs sm:text-[10px] sm:text-[8px] font-medium">
                        Lampiran lama akan terhapus
                      </div>
                    )}

                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept=".pdf,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const selected = e.target.files[0];
                          const check = validateFileClient(selected);
                          if (!check.valid) {
                            toast.error(check.error || "Gagal Mengunggah Dokumen: Format file tidak didukung atau ukuran melebihi batas maksimum (Max 10MB).");
                            return;
                          }
                          setEditFile(selected);
                          setShouldRemoveFile(false);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="px-5 py-3.5 bg-surface-sunken border-t border-border-faint flex items-center justify-end gap-2.5 shrink-0 select-none rounded-b-lg">
                <button 
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 bg-surface hover:bg-surface-muted border border-border-subtle text-content-secondary hover:text-content rounded-md text-xs font-medium transition-all cursor-pointer shadow-2xs"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSave} 
                  disabled={loading}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover active:bg-primary-active text-white rounded-md text-xs font-medium shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{loading ? "Menyimpan..." : "Simpan Dokumen"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}

      </AnimatePresence>
    </div>
  );
};
