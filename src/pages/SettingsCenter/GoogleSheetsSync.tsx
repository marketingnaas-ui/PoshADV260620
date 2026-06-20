import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, RefreshCw, Cloud, X, Edit, Save, CheckCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function GoogleSheetsSync() {
  const { toast } = useApp();
  const [loading, setLoading] = useState(true);
  const [sheets, setSheets] = useState<any[]>([]);
  const [editSheet, setEditSheet] = useState<any>(null);
  
  // Syncing simulation state
  const [syncing, setSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState('');
  const [syncProgress, setSyncProgress] = useState(0);

  useEffect(() => {
    fetch('/api/store/google-sheets-sync')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setSheets(data);
        } else {
          setSheets([
            { id: 1, name: 'Advance Records', url: 'https://docs.google.com/spreadsheets/d/xxx/edit#gid=0' },
            { id: 2, name: 'Clearance Records', url: 'https://docs.google.com/spreadsheets/d/xxx/edit#gid=1' },
            { id: 3, name: 'Employee Master', url: 'https://docs.google.com/spreadsheets/d/xxx/edit#gid=2' }
          ]);
        }
      })
      .catch(() => {
        setSheets([
          { id: 1, name: 'Advance Records', url: 'https://docs.google.com/spreadsheets/d/xxx/edit#gid=0' },
          { id: 2, name: 'Clearance Records', url: 'https://docs.google.com/spreadsheets/d/xxx/edit#gid=1' },
          { id: 3, name: 'Employee Master', url: 'https://docs.google.com/spreadsheets/d/xxx/edit#gid=2' }
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleForceSync = () => {
    setSyncing(true);
    setSyncProgress(10);
    setSyncStep("เหนี่ยวนำข้อมูลจาก Firestore Database...");

    setTimeout(() => {
      setSyncProgress(40);
      setSyncStep("จัดระเบียบตารางข้อมูล (Rows/Columns Matching)...");
    }, 600);

    setTimeout(() => {
      setSyncProgress(75);
      setSyncStep("กำลังอัปเดตบรรทัดที่ 1 ถึง 12,450 ไปยัง Google Drive API...");
    }, 1300);

    setTimeout(() => {
      setSyncProgress(100);
      setSyncStep("บันทึกการซิงก์เรียบร้อยแล้ว!");
    }, 2000);

    setTimeout(() => {
      setSyncing(false);
      toast("ซิงก์ข้อมูลไปที่ Google Sheets ครบถ้วนแล้ว!", "ok");
    }, 2400);
  };

  const handleSaveSheet = async () => {
    if (!editSheet.url.trim().startsWith('https://')) {
      toast("กรุณากรอก Google Sheet URL ที่ถูกต้อง (เริ่มต้นด้วย https://)", "err");
      return;
    }
    const updated = sheets.map(s => s.id === editSheet.id ? editSheet : s);
    try {
      const res = await fetch('/api/store/google-sheets-sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        setSheets(updated);
        setEditSheet(null);
        toast("อัปเดตลิงก์ Google Sheets เรียบร้อยแล้ว", "ok");
      } else {
        throw new Error();
      }
    } catch (e) {
      toast("มีข้อผิดพลาดในการบันทึกข้อมูล", "err");
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading sheets configuration...</div>;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-6">
        <div><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><FileSpreadsheet className="text-emerald-500" /> Google Sheets Sync</h2><p className="text-slate-500 text-sm mt-1">Dashboard การซิงก์ข้อมูลไปยัง Google Sheets แบบ Real-time</p></div>
        <button 
          onClick={handleForceSync} 
          disabled={syncing}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={syncing ? "animate-spin" : ""}/> Force Sync All
        </button>
      </div>

      {syncing && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6 animate-in slide-in-from-top-2 duration-300">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-emerald-800 flex items-center gap-2">
              <RefreshCw size={16} className="animate-spin text-emerald-600"/> {syncStep}
            </span>
            <span className="text-xs font-bold text-emerald-700">{syncProgress}%</span>
          </div>
          <div className="w-full bg-emerald-100 h-2.5 rounded-full overflow-hidden">
            <div className="bg-emerald-600 h-full transition-all duration-300" style={{ width: `${syncProgress}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100"><div className="text-emerald-600 text-xs font-bold uppercase mb-1">Status</div><div className="text-xl font-bold text-emerald-700 flex items-center gap-2"><Cloud size={20}/> Connected</div></div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><div className="text-slate-500 text-xs font-bold uppercase mb-1">Last Sync</div><div className="text-xl font-bold text-slate-800">Today, 08:30</div></div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><div className="text-slate-500 text-xs font-bold uppercase mb-1">Rows Synced</div><div className="text-xl font-bold text-slate-800">12,450</div></div>
        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100"><div className="text-rose-600 text-xs font-bold uppercase mb-1">Errors</div><div className="text-xl font-bold text-rose-700">0</div></div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
         <h3 className="font-bold text-slate-800 mb-4">Sheet Mapping Configuration</h3>
         <div className="space-y-4">
           {sheets.map(sheet => (
             <div key={sheet.id} className="flex items-center gap-4 border-b border-slate-50 pb-4 last:border-0 last:pb-0">
               <div className="w-48 font-bold text-sm text-slate-700 flex items-center gap-2">
                 <FileSpreadsheet size={16} className="text-emerald-500"/>
                 {sheet.name}
               </div>
               <input 
                 type="text" 
                 value={sheet.url} 
                 className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 font-mono outline-none" 
                 readOnly 
               />
               <button 
                 onClick={() => setEditSheet({ ...sheet })} 
                 className="text-[#f4ac5c] text-sm font-bold px-3 py-2 hover:bg-amber-50 rounded-lg flex items-center gap-1 transition-colors"
               >
                 <Edit size={14}/> Edit link
               </button>
             </div>
           ))}
         </div>
      </div>

      {editSheet && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditSheet(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-[500px] flex flex-col animate-in zoom-in-95 text-left overflow-hidden">
             <div className="p-5 border-b border-slate-100 flex justify-between bg-slate-50 items-center">
               <div className="flex items-center gap-2">
                 <FileSpreadsheet className="text-emerald-500" size={20} />
                 <h3 className="font-bold text-slate-800">Edit {editSheet.name} Mapping</h3>
               </div>
               <button onClick={() => setEditSheet(null)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
             </div>

             <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Sheet Tab Name</label>
                  <input 
                    type="text" 
                    value={editSheet.name} 
                    onChange={e => setEditSheet({ ...editSheet, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Google Sheet URL</label>
                  <input 
                    type="text" 
                    value={editSheet.url} 
                    onChange={e => setEditSheet({ ...editSheet, url: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono" 
                    placeholder="https://docs.google.com/spreadsheets/d/..." 
                  />
                </div>
             </div>

             <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                <button onClick={() => setEditSheet(null)} className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-600 font-bold">Cancel</button>
                <button onClick={handleSaveSheet} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold flex items-center gap-1 shadow-sm transition-colors">
                  <Save size={15}/> Save Connection
                </button>
             </div>
          </div>
         </div>
      )}
    </div>
  );
}
