import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  History, 
  Search, 
  Filter, 
  Calendar, 
  ArrowRight, 
  X, 
  CheckCircle2, 
  Trash2, 
  FileText, 
  Layers, 
  ArrowUpRight,
  User as UserIcon,
  RefreshCw,
  Clock,
  LayoutDashboard,
  Zap,
  Activity,
  ArrowDown
} from 'lucide-react';
import { AuditLog, Project, UserProfile } from '../../types';
import { DiffViewer } from './DiffViewer';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { io } from 'socket.io-client';

import { fetchAuditLogs } from './services/audit.service';

interface EnterpriseAuditDashboardProps {
  selectedProject?: Project | null;
  currentUser: UserProfile | null;
}

/**
 * Enterprise Audit Dashboard Component
 * Designed for LanPro v1.2+, production-ready with real-time prepend and modular architecture.
 */
export const EnterpriseAuditDashboard: React.FC<EnterpriseAuditDashboardProps> = ({ selectedProject, currentUser }) => {
  // --- STATE MANAGEMENT ---
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filtering States
  const [entityFilter, setEntityFilter] = useState<string>('All');
  const [actionFilter, setActionFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState(50);
  
  // Real-time Indicators
  const [newActivityIncoming, setNewActivityIncoming] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // --- DATA FETCHING ---
  const fetchLogs = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await fetchAuditLogs({
        limit,
        projectId: selectedProject?.id,
        entityName: entityFilter,
      });
      
      if (data.status === 'success') {
        setLogs(data.data);
        setNewActivityIncoming(false);
      } else {
        toast.error('Gagal memuat log audit enterprise');
      }
    } catch (err: any) {
      console.error(err);
      // Hardening v1.5: Better error reporting for HTML vs JSON
      toast.error(err.message || 'Kesalahan koneksi saat menyinkronkan data audit');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedProject, entityFilter, limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // --- SOCKET.IO REAL-TIME INTEGRATION ---
  useEffect(() => {
    let socket: any;
    try {
      socket = io();
      
      // Safe handlers to prevent unhandled rejections
      socket.on("error", (err: any) => {
        console.warn("[SOCKET ERROR] Safe enterprise socket error caught internally:", err);
      });
      socket.on("connect_error", (err: any) => {
        console.warn("[SOCKET ERROR] Safe enterprise socket connect_error caught internally:", err);
      });
      
      socket.onerror = (err: any) => {
        console.warn("[SOCKET ERROR] Native-like enterprise socket onerror caught internally:", err);
      };
      socket.onclose = () => {

      };

      if (socket.io) {
        socket.io.on("error", (err: any) => {
          console.warn("[SOCKET IO ERROR] Enterprise engine.io error suppressed:", err);
        });
      }
      if (socket.io && socket.io.engine) {
        socket.io.engine.on("error", (err: any) => {
          console.warn("[SOCKET ENGINE ERROR] Enterprise engine error suppressed:", err);
        });
        socket.io.engine.onerror = (err: any) => {
          console.warn("[SOCKET ENGINE ERROR] Enterprise engine onerror suppressed:", err);
        };
        socket.io.engine.onclose = () => {

        };
      }
    } catch (err) {
      console.error("[SOCKET FATAL] Failed to initialize enterprise socket safely:", err);
    }

    if (socket) {
      // Join project room for targeted updates
      if (selectedProject) {
        socket.emit('join_project', { projectId: selectedProject.id });
      }

      // Listen to specify enterprise event name
      socket.on('AUDIT_LOG_ADDED', (newLog: AuditLog) => {
        // Validate project affinity
        if (!selectedProject || newLog.projectId === selectedProject.id) {
          // Prepend new log with a small visual notification indicator
          setLogs(prev => [newLog, ...prev.slice(0, 99)]); // Max 100 on real-time view
          setNewActivityIncoming(true);
          
          toast.success(`Log Real-time: ${newLog.userName || 'Sistem'} melakukan ${newLog.actionType || 'Aksi'}`, {
              icon: <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
          });
        }
      });
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [selectedProject]);

  // --- UI HELPERS ---
  const getActionStyles = (action: string) => {
    switch (action) {
      case 'CREATE': return 'text-emerald-700 bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20';
      case 'UPDATE': return 'text-amber-700 bg-amber-50 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20';
      case 'DELETE': return 'text-rose-700 bg-rose-50 border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20';
      default: return 'text-content-secondary bg-surface-sunken border-border-faint';
    }
  };

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case 'Tasks': return <CheckCircle2 className="w-4 h-4" />;
      case 'Sprints': return <Layers className="w-4 h-4" />;
      case 'Projects': return <LayoutDashboard className="w-4 h-4" />;
      case 'Wiki': return <FileText className="w-4 h-4" />;
      case 'Milestones': return <ArrowUpRight className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesAction = actionFilter === 'All' || log.actionType === actionFilter;
    const matchesSearch = log.userName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         log.entityId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAction && matchesSearch;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#f3f3f9] p-4 md:p-5 gap-4 text-left animate-in fade-in duration-300">
      {/* 1. Header & Summary Section */}
      <div className="bg-surface p-4 md:p-5 rounded-lg border border-border-subtle/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs sm:text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100/60">System Audit</span>
            <span className="text-xs text-content-subtle font-medium">• Enterprise Control Center</span>
          </div>
          <h1 className="text-base font-medium text-content-strong tracking-tight">Dashboard Audit Enterprise</h1>
          <p className="text-xs text-content-muted font-medium mt-0.5">Riwayat aktivitas infrastruktur LanPro (Real-time & Immutable)</p>
        </div>

        <div className="flex items-center gap-3">
           <div className="flex bg-surface-sunken rounded-md p-2 border border-border-subtle/80 items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                 <span className="text-xs sm:text-[10px] font-medium text-content-subtle uppercase tracking-wider">Total Log:</span>
                 <span className="font-medium text-content-strong">{logs.length}</span>
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <div className="flex items-center gap-1.5">
                 <span className="text-xs sm:text-[10px] font-medium text-content-subtle uppercase tracking-wider">Status:</span>
                 <div className="flex items-center gap-1 text-emerald-600 font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Live</span>
                 </div>
              </div>
           </div>
           <button 
              onClick={() => { setIsRefreshing(true); fetchLogs(); }}
              disabled={isRefreshing}
              className="h-8 w-8 bg-surface hover:bg-surface-sunken border border-border-subtle/80 rounded-md text-content-secondary flex items-center justify-center shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              title="Refresh Audit Logs"
           >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </div>

      {/* 2. Advanced Filtering Control Bar */}
      <div className="bg-surface p-3.5 rounded-lg border border-border-subtle/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-subtle" />
          <input 
            type="text"
            placeholder="Cari berdasarkan User, Entity ID, atau Kata Kunci..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-surface-sunken border border-border-subtle rounded-md text-xs font-medium focus:bg-surface focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
          <div className="flex bg-surface-muted p-0.5 rounded-md border border-border-subtle/80">
            {['All', 'Tasks', 'Sprints', 'Wiki', 'Milestones'].map(ent => (
              <button
                key={ent}
                onClick={() => setEntityFilter(ent)}
                className={`px-3 py-1 text-xs font-medium rounded transition-all ${entityFilter === ent ? 'bg-surface text-indigo-700 shadow-2xs font-medium' : 'text-content-muted hover:text-content-strong'}`}
              >
                {ent === 'All' ? 'Semua Entitas' : ent}
              </button>
            ))}
          </div>

          <div className="flex bg-surface-muted p-0.5 rounded-md border border-border-subtle/80">
            {['All', 'CREATE', 'UPDATE', 'DELETE'].map(act => (
              <button
                key={act}
                onClick={() => setActionFilter(act)}
                className={`px-3 py-1 text-xs font-medium rounded transition-all ${actionFilter === act ? 'bg-surface text-indigo-700 shadow-2xs font-medium' : 'text-content-muted hover:text-content-strong'}`}
              >
                 {act === 'All' ? 'Semua Akses' : act}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Activity Timeline Body */}
      <div className="flex-1 bg-surface rounded-lg border border-border-subtle/80 shadow-2xs overflow-hidden flex flex-col min-h-0 relative">
        <AnimatePresence>
          {newActivityIncoming && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-20"
            >
              <button 
                onClick={() => { fetchLogs(true); scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-xs font-medium shadow-md flex items-center gap-1.5 hover:bg-indigo-700 transition-all border border-indigo-400 cursor-pointer"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>Log Baru Terdeteksi</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-content-subtle">
               <div className="relative mb-4">
                  <div className="w-12 h-12 border-3 border-indigo-100 rounded-full animate-pulse" />
                  <div className="absolute inset-0 w-12 h-12 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
               </div>
               <p className="text-xs font-medium animate-pulse uppercase tracking-wider text-content-secondary">Menyinkronkan Gudang Data</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-content-subtle">
               <Activity className="w-12 h-12 mb-3 opacity-20" />
               <p className="text-sm font-medium text-content-body">Data Log Kosong</p>
               <p className="text-xs text-content-subtle">Belum ada aktivitas yang tercatat untuk proyek/filter ini.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLogs.map((log, index) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index < 10 ? index * 0.03 : 0 }}
                  className="group relative"
                >
                  {/* Log Unified Row Card */}
                  <div 
                    className="p-3.5 bg-surface border border-border-subtle/80 rounded-lg hover:border-indigo-300 shadow-2xs transition-all cursor-pointer group flex items-start gap-3.5"
                    onClick={() => setSelectedLog(log)}
                  >
                     {/* Action Type Icon Badge */}
                     <div className={cn(
                       "w-9 h-9 rounded-md border flex items-center justify-center shrink-0 shadow-2xs mt-0.5",
                       log.actionType === 'CREATE' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                       log.actionType === 'UPDATE' ? "bg-amber-50 text-amber-600 border-amber-200" :
                       "bg-rose-50 text-rose-600 border-rose-200"
                     )}>
                        {log.actionType === 'CREATE' && <Zap className="w-4 h-4" />}
                        {log.actionType === 'UPDATE' && <RefreshCw className="w-4 h-4" />}
                        {log.actionType === 'DELETE' && <Trash2 className="w-4 h-4" />}
                     </div>

                     <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                           <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <div className="w-5 h-5 bg-indigo-50 rounded flex items-center justify-center text-indigo-600 shrink-0">
                                <UserIcon className="w-3 h-3" />
                              </div>
                              <span className="text-xs font-medium text-content-strong truncate">{log.userName}</span>
                              <span className="text-xs sm:text-[10px] bg-indigo-50 text-indigo-700 font-medium px-2 py-0.2 rounded border border-indigo-100 uppercase flex items-center gap-1">
                                 {getEntityIcon(log.entityName)}
                                 {log.entityName}
                              </span>
                           </div>
                           <div className="text-xs sm:text-[11px] font-medium text-content-subtle flex items-center gap-1 shrink-0">
                             <Clock className="w-3 h-3 text-slate-300" />
                             {formatDate(log.createdAt)}
                           </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-content-secondary font-medium flex-wrap">
                           <span>
                             Melakukan aksis <span className={cn(
                               "font-medium uppercase px-1.5 py-0.2 rounded text-xs sm:text-[10px]",
                               log.actionType === 'CREATE' ? "bg-emerald-50 text-emerald-700" :
                               log.actionType === 'UPDATE' ? "bg-amber-50 text-amber-700" :
                               "bg-rose-50 text-rose-700"
                             )}>{log.actionType}</span> pada entitas {log.entityName} dengan referensi ID: 
                           </span>
                           <span className="font-mono text-xs sm:text-[11px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100/60">
                             {log.entityId}
                           </span>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-border-faint">
                           <div className="flex items-center gap-2">
                              {log.oldValues && Object.keys(log.oldValues).length > 0 && (
                                <span className="px-1.5 py-0.2 bg-rose-50 border border-rose-100 rounded text-xs sm:text-[11px] sm:text-[9px] font-medium text-rose-600 uppercase">Sebelum: {Object.keys(log.oldValues).length} keys</span>
                              )}
                              {log.newValues && Object.keys(log.newValues).length > 0 && (
                                <span className="px-1.5 py-0.2 bg-emerald-50 border border-emerald-100 rounded text-xs sm:text-[11px] sm:text-[9px] font-medium text-emerald-600 uppercase">Sesudah: {Object.keys(log.newValues).length} keys</span>
                              )}
                           </div>
                           <span className="text-xs sm:text-[11px] font-medium text-indigo-600 group-hover:text-indigo-700 flex items-center gap-1 group-hover:gap-1.5 transition-all">
                              Lihat detail perubahan <ArrowRight className="w-3 h-3" />
                           </span>
                        </div>
                     </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. Diff Viewer Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 bg-slate-900/80 backdrop-blur-md"
               onClick={() => setSelectedLog(null)}
             />
             
             <motion.div
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="relative bg-surface w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-white/20"
             >
                {/* Modal Header */}
                <div className="p-8 border-b border-border-faint flex items-center justify-between bg-surface-sunken/50">
                   <div className="flex items-center gap-5">
                      <div className={`p-4 rounded-xl border shadow-soft-lg ${getActionStyles(selectedLog.actionType)}`}>
                         {getEntityIcon(selectedLog.entityName)}
                      </div>
                      <div>
                         <h3 className="text-2xl font-medium text-content-strong tracking-tight">Detail Perubahan Audit</h3>
                         <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs font-medium text-content-muted uppercase tracking-widest">{selectedLog.entityName}</span>
                            <span className="text-slate-300">•</span>
                            <code className="text-xs sm:text-[10px] font-medium bg-slate-200/50 text-content-secondary px-2 py-0.5 rounded">{selectedLog.entityId}</code>
                         </div>
                      </div>
                   </div>
                   <button 
                     onClick={() => setSelectedLog(null)}
                     className="p-3 bg-surface rounded-xl text-content-subtle hover:text-rose-500 hover:bg-rose-50 transition-all border border-border-subtle"
                   >
                     <X className="w-6 h-6" />
                   </button>
                </div>                {/* Modal Info Stats */}
                <div className="grid grid-cols-2 bg-surface-sunken/30 border-b border-border-faint">
                    <div className="p-6 border-r border-border-faint">
                       <p className="text-xs sm:text-[10px] font-medium text-content-subtle uppercase tracking-widest mb-2">Aktivitas Penulis</p>
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-medium">
                             {(selectedLog.userName || "U")[0]}
                          </div>
                          <div>
                             <p className="text-sm font-medium text-content-strong">{selectedLog.userName || "Unknown User"}</p>
                             <p className="text-xs sm:text-[10px] font-medium text-content-muted uppercase tracking-tighter">Akses Auditor Sistem</p>
                          </div>
                       </div>
                    </div>
                    <div className="p-6">
                       <p className="text-xs sm:text-[10px] font-medium text-content-subtle uppercase tracking-widest mb-2">Tanda Waktu (WIB)</p>
                       <div className="flex items-center gap-3 text-content-strong font-medium">
                          <Calendar className="w-5 h-5 text-indigo-500" />
                          <span className="text-sm">{new Date(selectedLog.createdAt).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium'})}</span>
                       </div>
                    </div>
                </div>

                {/* Diff Engine */}
                <div className="flex-1 overflow-y-auto p-8 bg-surface custom-scrollbar">
                   <div className="mb-6 flex items-center gap-2">
                      <div className="h-5 w-1 bg-indigo-500 rounded-full" />
                      <h4 className="text-xs font-medium text-content uppercase tracking-widest">Komparasi Perubahan Objek</h4>
                   </div>
                   <DiffViewer 
                     oldValues={selectedLog.oldValues} 
                     newValues={selectedLog.newValues} 
                   />
                   
                   {/* Raw JSON fallback (Optional for high technical audit) */}
                   <details className="mt-12 group">
                      <summary className="text-xs sm:text-[10px] font-medium text-content-subtle cursor-pointer uppercase hover:text-content-secondary transition-colors">
                        Tampilkan Raw Technical Trace (JSON)
                      </summary>
                      <div className="mt-4 p-4 rounded-xl bg-slate-900 text-indigo-400 font-mono text-xs sm:text-[10px] overflow-x-auto border border-slate-800">
                         <pre>{JSON.stringify(selectedLog, null, 2)}</pre>
                      </div>
                   </details>
                </div>

                {/* Footer */}
                <div className="p-8 bg-surface-sunken border-t border-border-faint flex justify-between items-center">
                   <p className="text-xs sm:text-[10px] font-medium text-content-subtle italic">ID_JEJAK: {selectedLog.id}</p>
                   <button 
                     onClick={() => setSelectedLog(null)}
                     className="px-8 py-3 bg-slate-900 text-white text-xs font-medium rounded-xl hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl shadow-slate-200 active:scale-95"
                   >
                     SELESAI MENINJAU
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
