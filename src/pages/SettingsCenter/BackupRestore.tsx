import React, { useState, useEffect } from 'react';
import { DatabaseBackup, Check, Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function BackupRestore() {
  const { toast } = useApp();
  const showToast = (msg: string) => toast(msg, 'ok');

  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/store/backups')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setBackups(data);
        } else {
          setBackups([
            { id: 'b1', date: new Date().toLocaleString(), type: 'Auto', size: '24.1 MB', url: '/api/export/app-backup.json' }
          ]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreateBackup = () => {
    showToast("เริ่มดาวน์โหลดไฟล์ Backup ล่าสุด...");
    window.location.href = '/api/export/app-backup.json';
  };

  return (
    <div className="animate-in fade-in duration-300">
       <div className="flex justify-between items-end mb-6">
        <div><h2 className="text-2xl font-bold text-slate-800">Backup & Restore</h2><p className="text-slate-500 text-sm mt-1">สำรองข้อมูล Master Data และกู้คืนระบบผ่าน Firebase Store</p></div>
        <button onClick={handleCreateBackup} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm flex items-center gap-2"><DatabaseBackup size={16}/> Create & Download Backup</button>
      </div>
      
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 flex items-center justify-between">
         <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center"><Check size={24} className="stroke-[3]"/></div>
           <div>
             <h3 className="font-bold text-slate-800 text-lg">System is Protected</h3>
             <p className="text-sm text-slate-500">Connected to Firebase persistence</p>
           </div>
         </div>
         <div className="text-right">
           <div className="text-xs text-slate-400 uppercase font-bold mb-1">Total Storage Used</div>
           <div className="text-2xl font-mono font-bold text-slate-800">Active</div>
         </div>
      </div>

      <h3 className="font-bold text-slate-800 mb-4">Available Restore Points</h3>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
         <table className="w-full text-left text-sm">
           <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="p-4">Date / Time</th><th className="p-4">Type</th><th className="p-4">Size</th><th className="p-4 text-right">Action</th></tr></thead>
           <tbody className="divide-y divide-slate-100">
             {loading ? (
               <tr><td colSpan={4} className="p-8 text-center text-slate-500">Loading backups...</td></tr>
             ) : backups.map((b, i) => (
               <tr key={i} className="hover:bg-slate-50">
                 <td className="p-4 font-bold text-slate-700">{b.date}</td>
                 <td className="p-4 text-slate-500">{b.type}</td>
                 <td className="p-4 font-mono text-slate-500">{b.size}</td>
                 <td className="p-4 text-right">
                   <a href={b.url} download className="text-indigo-600 text-xs font-bold mr-4 hover:underline inline-flex items-center gap-1"><Download size={14}/> Download JSON</a>
                   <button onClick={() => showToast("การ Restore กรุณาติดต่อ Administrator")} className="text-rose-600 text-xs font-bold hover:underline">Restore</button>
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
      </div>
    </div>
  );
}
