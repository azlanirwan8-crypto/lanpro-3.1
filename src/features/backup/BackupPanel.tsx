import React, { useRef, useState, useEffect } from 'react';
import { HardDrive, Download, Upload, AlertTriangle, Loader2, CheckCircle2, Clock, FileText, Trash2 } from 'lucide-react';
import { Project, Task, Sprint, UserProfile, MasterData, ActivityLog } from '../../types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { apiRequest } from '../../lib/api';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';

interface ExportItem {
  id: string;
  filename: string;
  createdAt: Date;
  sizeBytes: number;
  status: 'processing' | 'completed' | 'failed';
  progress: number; // 0 to 100
  data?: any;
}

export const BackupPanel = ({
  selectedProject,
  tasks,
  sprints,
  projectMembers,
  activityLogs,
  masterData
}: {
  selectedProject: Project | null;
  tasks: Task[];
  sprints: Sprint[];
  projectMembers: UserProfile[];
  activityLogs: ActivityLog[];
  masterData: MasterData[];
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFileToRestore, setSelectedFileToRestore] = useState<File | null>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [exportHistory, setExportHistory] = useState<ExportItem[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Simulate progress interval for processing items
  useEffect(() => {
    const timer = setInterval(() => {
      setExportHistory(prev => prev.map(item => {
        if (item.status === 'processing') {
          const nextProgress = item.progress + 15;
          if (nextProgress >= 95) {
            return item; // wait for API response
          }
          return { ...item, progress: nextProgress };
        }
        return item;
      }));
    }, 300);
    return () => clearInterval(timer);
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const exportProjectBackup = async () => {
    const timestampStr = format(new Date(), 'yyyyMMdd_HHmmss');
    const filename = `system_backup_${timestampStr}.json`;
    const newItem: ExportItem = {
      id: crypto.randomUUID(),
      filename,
      createdAt: new Date(),
      sizeBytes: 0,
      status: 'processing',
      progress: 20
    };
    
    setExportHistory(prev => [newItem, ...prev]);
    toast.info('Memulai proses export database...');

    try {
      const result = await apiRequest('/api/system/backup');
      if (result.status !== 'success') throw new Error(result.message);
      
      const jsonString = JSON.stringify(result.data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const sizeBytes = blob.size;
      const url = URL.createObjectURL(blob);

      setExportHistory(prev => prev.map(item => item.id === newItem.id ? {
        ...item,
        status: 'completed',
        progress: 100,
        sizeBytes,
        data: result.data
      } : item));

      // Auto download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('System Backup berhasil diexport & diunduh');
    } catch (e: any) {
      console.error(e);
      setExportHistory(prev => prev.map(item => item.id === newItem.id ? {
        ...item,
        status: 'failed',
        progress: 100
      } : item));
      toast.error('Gagal export backup: ' + e.message);
    }
  };

  const handleDownloadItem = (item: ExportItem) => {
    if (!item.data) return;
    const blob = new Blob([JSON.stringify(item.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('File backup berhasil diunduh');
  };

  const handleDeleteItem = (id: string) => {
    setExportHistory(prev => prev.filter(item => item.id !== id));
    toast.success('Riwayat backup berhasil dihapus');
  };

  const handleRestoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileToRestore(file);
    setIsRestoreConfirmOpen(true);
  };

  const executeRestore = async () => {
    if (!selectedFileToRestore) return;
    setIsRestoring(true);
    try {
      const text = await selectedFileToRestore.text();
      const data = JSON.parse(text);
      
      const result = await apiRequest('/api/system/restore', {
        method: 'POST',
        body: { data }
      });
      
      if (result.status !== 'success') throw new Error(result.message);
      
      toast.success('System restore berhasil! Memuat ulang aplikasi...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal restore backup: ' + err.message);
    } finally {
      setIsRestoring(false);
      setIsRestoreConfirmOpen(false);
      setSelectedFileToRestore(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const cancelRestore = () => {
    setIsRestoreConfirmOpen(false);
    setSelectedFileToRestore(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex-1 overflow-auto p-4 md:p-5 bg-slate-50/60 animate-in fade-in duration-300 custom-scrollbar w-full space-y-4">
      {/* Top Cards: Export & Restore */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Export Box */}
        <div className="bg-white border border-slate-200/80 rounded-lg p-5 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-md flex items-center justify-center shrink-0">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-medium text-slate-800 uppercase tracking-wide">Export Database Backup</h2>
                <p className="text-xs text-slate-500 mt-0.5">Unduh snapshot lengkap seluruh tabel database dalam format JSON.</p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <button 
              onClick={exportProjectBackup}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-xs transition-all shadow-2xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Project Backup</span>
            </button>
          </div>
        </div>

        {/* Restore Box */}
        <div className="bg-white border border-slate-200/80 rounded-lg p-5 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-rose-50 text-rose-600 rounded-md flex items-center justify-center shrink-0">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-medium text-slate-800 uppercase tracking-wide">Restore Database Backup</h2>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Timpa data sistem dengan file backup JSON.</span>
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <button 
               onClick={() => fileInputRef.current?.click()}
               className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-md font-medium text-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Backup File</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleRestoreChange} 
              accept="application/json" 
              className="hidden" 
            />
          </div>
        </div>
      </div>

      {/* Export History DataTable */}
      <div className="bg-white border border-slate-200/80 rounded-lg shadow-2xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wider">Hasil Export Database (DataTable)</h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Total: {exportHistory.length} file</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100/70 text-slate-700 border-b border-slate-200/80 font-medium uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3.5">Waktu Export</th>
                <th className="py-2.5 px-3.5">Nama File Backup</th>
                <th className="py-2.5 px-3.5">Ukuran</th>
                <th className="py-2.5 px-3.5">Status Proses</th>
                <th className="py-2.5 px-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {exportHistory.length > 0 ? (
                exportHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3.5 text-slate-600 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {format(item.createdAt, 'dd MMM yyyy, HH:mm:ss')}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-slate-700 font-medium">{item.filename}</td>
                    <td className="py-2.5 px-3.5 text-slate-600 font-mono">{item.status === 'completed' ? formatSize(item.sizeBytes) : '-'}</td>
                    <td className="py-2.5 px-3.5">
                      {item.status === 'processing' && (
                        <div className="space-y-1 w-48">
                          <div className="flex justify-between text-[10px] text-amber-700 font-medium">
                            <span className="flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                              Exporting...
                            </span>
                            <span>{item.progress}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-amber-500 h-full rounded-full transition-all duration-300 ease-out" 
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {item.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Selesai
                        </span>
                      )}
                      {item.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          Gagal
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-right space-x-1.5">
                      {item.status === 'completed' && (
                        <button
                          onClick={() => handleDownloadItem(item)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-[11px] transition-all shadow-2xs inline-flex items-center gap-1 cursor-pointer active:scale-95"
                          title="Download Backup"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-medium text-[11px] transition-all shadow-2xs inline-flex items-center gap-1 cursor-pointer active:scale-95"
                        title="Hapus riwayat"
                      >
                        <Trash2 className="w-3 h-3" />
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 italic text-xs">
                    Belum ada riwayat export backup. Klik tombol <strong className="font-medium text-slate-600">"Export Project Backup"</strong> di atas untuk membuat backup baru.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isRestoreConfirmOpen && (
        <ConfirmationModal
          isOpen={isRestoreConfirmOpen}
          onClose={cancelRestore}
          onConfirm={executeRestore}
          title="Konfirmasi Restore Database"
          message="Apakah Anda yakin ingin melakukan restore? Tindakan ini akan menimpa seluruh data saat ini dengan data dari file backup. Tindakan ini tidak dapat dibatalkan!"
          confirmText="Ya, Restore Sekarang"
          cancelText="Batal"
          variant="danger"
          isLoading={isRestoring}
        />
      )}
    </div>
  );
};
