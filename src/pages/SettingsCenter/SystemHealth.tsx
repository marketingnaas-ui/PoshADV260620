import React, { useState, useEffect } from 'react';
import { RefreshCw, DatabaseBackup, Cloud, Cpu, Smartphone } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function SystemHealth() {
  const { toast } = useApp();
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const start = Date.now();
      const res = await fetch('/api/health');
      const data = await res.json();
      const latency = Date.now() - start;
      setHealthData({ ...data, latency });
      toast("Health Check Complete", 'ok');
    } catch (e) {
      toast("Failed to ping APIs", 'err');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-6">
         <div><h2 className="text-2xl font-bold text-slate-800">System Health</h2><p className="text-slate-500 text-sm mt-1">ตรวจสอบสถานะการทำงานของ Service ต่างๆ แบบ Real-time</p></div>
         <button onClick={fetchHealth} disabled={loading} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh Ping</button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[
          { name: 'Firebase Realtime DB', status: healthData?.firebaseAvailable ? 'Online' : (healthData?.firebaseConfigured ? 'Offline/Error' : 'Not Configured'), latency: healthData?.latency ? `${healthData.latency}ms` : '-', icon: DatabaseBackup },
          { name: 'Cloud Storage (Files)', status: healthData?.storageBucket ? 'Online' : 'Not Configured', latency: healthData?.latency ? `${healthData.latency}ms` : '-', icon: Cloud },
          { name: 'Gemini OCR API', status: 'Active (Lazy loaded)', latency: '-', icon: Cpu },
          { name: 'API Server', status: healthData?.status === 'ok' ? 'Online' : 'Offline', latency: healthData?.latency ? `${healthData.latency}ms` : '-', icon: Smartphone },
        ].map((svc, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500"><svc.icon size={20}/></div>
               <div><h3 className="font-bold text-slate-800">{svc.name}</h3><p className="text-xs text-slate-400 font-mono mt-0.5">Latency: {svc.latency}</p></div>
            </div>
            <div className={`flex items-center gap-2 text-sm font-bold px-3 py-1 rounded-full ${svc.status === 'Online' || svc.status.includes('Active') ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'}`}>
              <span className={`w-2 h-2 rounded-full ${svc.status === 'Online' || svc.status.includes('Active') ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span> {svc.status}
            </div>
          </div>
        ))}
      </div>
      {healthData?.firebaseLastError && (
        <div className="mt-6 bg-rose-50 border border-rose-200 p-4 rounded-xl">
           <h4 className="font-bold text-rose-800 mb-2">Firebase Connection Error</h4>
           <p className="text-sm text-rose-600 font-mono text-xs">{healthData.firebaseLastError}</p>
        </div>
      )}
    </div>
  );
}
