import React, { useState, useEffect } from 'react';
import { Server, CheckCircle2, Wifi, Loader2, Database, Save, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '../../lib/api';

export const ConnectPanel = () => {
  const [config, setConfig] = useState({
    host: 'localhost',
    port: '3306',
    user: 'app_user',
    password: 'app_password',
    database: 'app_database'
  });
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'idle'|'success'|'error', message: string }>({ status: 'idle', message: '' });

  useEffect(() => {
    const fetchActiveConfig = async () => {
      try {
        const json = await apiRequest('/api/system/db-config');
        if (json.status === 'success' && json.data) {
          setConfig({
            host: json.data.host || 'localhost',
            port: String(json.data.port || '3306'),
            user: json.data.user || 'app_user',
            password: json.data.password || 'app_password',
            database: json.data.database || 'app_database'
          });
        }
      } catch (err) {
        console.error('Failed to load active database config:', err);
      }
    };
    fetchActiveConfig();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTestResult({ status: 'idle', message: '' });
    
    try {
      const data = await apiRequest('/api/system/db-config', {
        method: 'POST',
        body: config
      });
      
      if (data.status === 'success') {
        setTestResult({ status: 'success', message: 'Koneksi Berhasil tersambung ke MySQL!' });
        toast.success('Kredensial database valid.');
      } else {
        throw new Error(data.message || 'Koneksi gagal.');
      }
    } catch (err: any) {
      setTestResult({ status: 'error', message: err.message });
      toast.error('Gagal menghubungkan dengan konfigurasi yang dimasukkan');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConnection = async () => {
    setSaveLoading(true);
    setTestResult({ status: 'idle', message: '' });
    
    try {
      const data = await apiRequest('/api/system/db-config/save', {
        method: 'POST',
        body: config
      });
      
      if (data.status === 'success') {
        setTestResult({ status: 'success', message: 'Konfigurasi database berhasil disimpan & diubah secara Live!' });
        toast.success('Kredensial berhasil disimpan dan diaplikasikan ke server.');
      } else {
        throw new Error(data.message || 'Gagal menyimpan konfigurasi.');
      }
    } catch (err: any) {
      setTestResult({ status: 'error', message: err.message });
      toast.error('Gagal menyimpan konfigurasi: ' + err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/60 relative overflow-hidden">        
      <div className="flex-1 overflow-auto p-4 md:p-5 relative z-10 w-full space-y-4">
        {/* Help Banner - Velzon Style */}
        <div className="bg-white p-4 rounded-lg border border-emerald-200/80 shadow-2xs flex items-start gap-3">
          <div className="bg-emerald-100 text-emerald-700 p-2 rounded-md mt-0.5 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-medium text-slate-800 uppercase tracking-wide">Active MySQL Connection Help</h3>
            <p className="text-slate-600 mt-1 text-xs leading-relaxed">
              Aplikasi terhubung aktif ke backend MySQL. Anda dapat menguji (Test) maupun menyimpan dan mengaktifkan (Save & Apply Live) konfigurasi database baru secara live tanpa restart manual.
            </p>
          </div>
        </div>

        {/* Config Form Card */}
        <div className="bg-white shadow-2xs rounded-lg border border-slate-200/80 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200/80 bg-slate-50/80 flex justify-between items-center">
            <h2 className="text-xs font-medium text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" />
              Konfigurasi Database MySQL
            </h2>
          </div>
          
          <form onSubmit={handleTestConnection} className="p-4 md:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Database Host (DB_HOST)</label>
                <input 
                  name="host" 
                  value={config.host} 
                  onChange={handleChange} 
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Database Port (DB_PORT)</label>
                <input 
                  name="port" 
                  value={config.port} 
                  onChange={handleChange} 
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Database Name (DB_NAME)</label>
              <input 
                name="database" 
                value={config.database} 
                onChange={handleChange} 
                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500" 
              />
              <div className="bg-amber-50/80 rounded-md p-3 border border-amber-200 mt-2 flex gap-2.5 text-amber-800 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-amber-900">⚠️ Solusi Penting: Mengatasi "Unknown database" / ER_BAD_DB_ERROR</p>
                  <p className="leading-relaxed">
                    Error ini terjadi karena salah ketik (typo) nama database. Konfigurasi default MySQL di Google Cloud / Aiven biasanya menggunakan nama database <strong className="font-medium underline text-amber-900 bg-amber-100 px-1 py-0.5 rounded">defaultdb</strong>.
                  </p>
                  <p className="text-slate-600">
                    Pastikan Anda <span className="text-red-600 font-medium line-through">tidak mengetik "defaultdbj" atau "defaultd"</span> di atas. Ubahlah kembali menjadi <strong className="font-medium text-emerald-700">defaultdb</strong> lalu klik <strong>Save & Apply Live</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Username (DB_USER)</label>
                <input 
                  name="user" 
                  value={config.user} 
                  onChange={handleChange} 
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Password (DB_PASSWORD)</label>
                <input 
                  type="password"
                  name="password" 
                  value={config.password} 
                  onChange={handleChange} 
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                />
              </div>
            </div>

            {testResult.status !== 'idle' && (
              <div className={`p-3 rounded-md text-xs font-medium border ${testResult.status === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                {testResult.message}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-3 justify-end">
              <button 
                type="submit" 
                disabled={loading || saveLoading}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium py-2 px-4 rounded-md transition-all flex items-center justify-center text-xs cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>
                    <Wifi className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                    Test Connection
                  </>
                )}
              </button>

              <button 
                type="button"
                onClick={handleSaveConnection}
                disabled={loading || saveLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-5 rounded-md shadow-2xs active:scale-95 transition-all flex items-center justify-center text-xs cursor-pointer disabled:opacity-50"
              >
                {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    Save & Apply Live
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
