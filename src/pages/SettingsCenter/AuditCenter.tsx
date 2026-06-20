import React, { useState, useEffect } from 'react';
import { Download, FileCode, X, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge } from './shared';

export default function AuditCenter() {
  const { toast } = useApp();
  const showToast = (msg: string) => toast(msg, 'ok');

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/store/audit-logs')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAuditLogs(data);
        } else {
          setAuditLogs([
            { id: 'A1', time: new Date().toLocaleString(), actor: 'System', module: 'Initialization', action: 'DB_CREATED', ip: '-', detail: '{"status": "Ready", "db": "Firebase/Local"}' }
          ]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const [auditDetail, setAuditDetail] = useState<any>(null);
  const [filter, setFilter] = useState('');

  const filteredLogs = auditLogs.filter(log => !filter || log.module.toLowerCase().includes(filter.toLowerCase()) || log.action.toLowerCase().includes(filter.toLowerCase()) || log.actor.toLowerCase().includes(filter.toLowerCase()));

  if (loading) return <div className="p-8 text-center text-slate-500">Loading Audit Logs...</div>;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-6">
        <div><h2 className="text-2xl font-bold text-slate-800">Audit Center</h2><p className="text-slate-500 text-sm mt-1">ประวัติการเปลี่ยนแปลงข้อมูลเชิงลึก (JSON Diff Logs)</p></div>
        <button onClick={() => showToast("เริ่มส่งออกประวัติ Audit เป็นไฟล์ Excel")} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2"><Download size={16}/> Export Logs</button>
      </div>
      
      <div className="flex gap-3 mb-6 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search logs by actor, module, action..." className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm outline-none" />
        </div>
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none"><option>All Modules</option><option>Staff</option><option>Project</option></select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
            <tr><th className="p-4">Timestamp</th><th className="p-4">Actor</th><th className="p-4">Module / Action</th><th className="p-4">IP Address</th><th className="p-4 text-center">Detail</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLogs.map(log => (
               <tr key={log.id} className="hover:bg-slate-50">
                 <td className="p-4 font-mono text-slate-500 text-xs">{log.time}</td>
                 <td className="p-4 font-bold text-slate-800">{log.actor}</td>
                 <td className="p-4"><Badge type={log.module === 'Backup' ? 'active' : 'info'}>{log.module}</Badge> <span className="text-slate-600 ml-2">{log.action}</span></td>
                 <td className="p-4 font-mono text-xs text-slate-400">{log.ip || '-'}</td>
                 <td className="p-4 text-center"><button onClick={() => setAuditDetail(log)} className="text-indigo-600 font-bold text-xs hover:underline"><FileCode size={16} className="inline mr-1"/> View JSON</button></td>
               </tr>
            ))}
          </tbody>
        </table>
      </div>

      {auditDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setAuditDetail(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-[600px] flex flex-col animate-in zoom-in-95">
             <div className="p-5 border-b border-slate-100 flex justify-between bg-slate-50 rounded-t-2xl"><h3 className="font-bold text-slate-800">Audit Detail JSON</h3><button onClick={() => setAuditDetail(null)}><X size={20}/></button></div>
             <div className="p-6">
                <pre className="bg-slate-900 text-emerald-400 p-4 rounded-lg text-sm font-mono overflow-auto max-h-96 whitespace-pre-wrap">
                  {typeof auditDetail.detail === 'string' ? auditDetail.detail : JSON.stringify(auditDetail.detail, null, 2)}
                </pre>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
