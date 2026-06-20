import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Upload, Clipboard } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge, getAvatar } from './shared';

export default function ProjectSettings() {
  const { toast, masterProjects, saveMasterProjects } = useApp();
  const showToast = (msg: string) => toast(msg, 'ok');

  const [projectForm, setProjectForm] = useState<any>(null);

  // Bulk import states
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [parsedImportRows, setParsedImportRows] = useState<any[]>([]);

  const handleSaveProject = async () => {
    if (!projectForm.name) return showToast("กรุณากรอกชื่อโครงการ");
    const isExisting = masterProjects.find(p => p.code === projectForm.code);
    const nextList = isExisting 
       ? masterProjects.map(p => p.code === projectForm.code ? projectForm : p)
       : [...masterProjects, projectForm];
    await saveMasterProjects(nextList);
    setProjectForm(null);
    showToast("บันทึกข้อมูลโครงการเรียบร้อยแล้ว");
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`ลบข้อมูล ${name}?`)) {
      await saveMasterProjects(masterProjects.filter(p => p.code !== id));
      showToast("ลบข้อมูลสำเร็จ");
    }
  };

  const handleParseImport = (text: string) => {
    setImportText(text);
    if (!text.trim()) {
      setParsedImportRows([]);
      return;
    }
    const lines = text.split('\n');
    let currentIdx = masterProjects.length;

    const parsed: any[] = [];
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Check header line
      if (trimmed.toLowerCase().includes('ชื่อโครงการ') || trimmed.toLowerCase().includes('project name')) {
        return;
      }

      // Try tab first, then fall back to comma
      const tabSplit = trimmed.split('\t');
      const commaSplit = trimmed.split(',');
      const parts = tabSplit.length >= 2 ? tabSplit : commaSplit;

      // Clean each part
      const cleanedParts = parts.map(p => p.trim().replace(/^"|"$/g, ''));

      if (cleanedParts[0]) {
        currentIdx++;
        const name = cleanedParts[0];
        const owner = cleanedParts[1] || 'สมมาตร มีสุข';
        const budget = cleanedParts[2] || '100000';
        const start = cleanedParts[3] || '01/01/2026';
        const end = cleanedParts[4] || '31/12/2026';
        const status = cleanedParts[5] || 'Active';
        let code = cleanedParts[6] || '';
        let short = cleanedParts[7] || '';

        if (!code) {
          code = `PRJ-AUTO-${String(currentIdx).padStart(3, '0')}`;
        }
        if (!short) {
          // generate short code
          const shortWord = name.replace(/[^ก-๙a-zA-Z]/g, '').slice(0, 4).toUpperCase();
          short = shortWord || `P${currentIdx}`;
        }

        parsed.push({
          code,
          id: code,
          short,
          name,
          owner,
          start,
          end,
          budget: budget.replace(/[^0-9.-]/g, '') || '0',
          status: ['Active', 'Completed', 'On Hold'].includes(status) ? status : 'Active'
        });
      }
    });
    setParsedImportRows(parsed);
  };

  const handleSaveImportData = async () => {
    if (parsedImportRows.length === 0) {
      toast('⚠️ ไม่มีข้อมูลที่สามารถนำเข้าได้', 'err');
      return;
    }
    const mergedList = [...masterProjects];
    let addedCount = 0;
    let updatedCount = 0;

    parsedImportRows.forEach(row => {
      const idx = mergedList.findIndex(p => p.code === row.code);
      if (idx !== -1) {
        mergedList[idx] = row;
        updatedCount++;
      } else {
        mergedList.push(row);
        addedCount++;
      }
    });

    await saveMasterProjects(mergedList);
    setImportModalOpen(false);
    setImportText('');
    setParsedImportRows([]);
    toast(`📥 นำเข้าโครงการสำเร็จ! เพิ่มใหม่ ${addedCount} รายการ, แก้ไข ${updatedCount} รายการ`, 'ok');
  };

  const totalBudget = masterProjects.reduce((sum, p) => {
    const rawVal = String(p.budget || '').replace(/[^0-9.-]/g, '');
    const parsedVal = parseFloat(rawVal);
    return sum + (isNaN(parsedVal) ? 0 : parsedVal);
  }, 0);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-6">
        <div><h2 className="text-2xl font-bold text-slate-800">Project Settings</h2><p className="text-slate-500 text-sm mt-1">บริหารจัดการโครงการ งบประมาณ และสถานะ</p></div>
        <div className="flex gap-2">
          <button 
            onClick={() => setImportModalOpen(true)} 
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-sm font-semibold text-slate-700 shadow-sm transition-colors"
          >
            <Upload size={16} /> นำเข้าข้อมูล
          </button>
          <button onClick={() => setProjectForm({ code: `PRJ-2606-${String(masterProjects.length + 1).padStart(3, '0')}`, short: '', name: '', owner: 'สมมาตร มีสุข', start: '01/01/2026', end: '31/12/2026', budget: '100000', status: 'Active' })} className="flex items-center gap-2 px-4 py-2 bg-[#f4ac5c] hover:bg-[#e09b4b] rounded-lg text-sm font-bold text-white shadow-sm transition-colors"><Plus size={16} /> Add Project</button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Projects</div><div className="text-2xl font-bold text-slate-800">{masterProjects.length}</div></div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm border-t-4 border-t-emerald-500"><div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Active</div><div className="text-2xl font-bold text-emerald-600">{masterProjects.filter(p=>p.status==='Active').length}</div></div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm border-t-4 border-t-amber-500"><div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">On Hold</div><div className="text-2xl font-bold text-amber-600">{masterProjects.filter(p=>p.status==='On Hold').length}</div></div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm bg-orange-50/50"><div className="text-[#f4ac5c] text-xs font-bold uppercase tracking-wider mb-1">Total Budget</div><div className="text-2xl font-bold text-[#f4ac5c]">฿{totalBudget.toLocaleString()}</div></div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
            <tr><th className="p-4">Project</th><th className="p-4">Owner</th><th className="p-4">Timeline</th><th className="p-4">Budget</th><th className="p-4 text-center">Status</th><th className="p-4 text-center">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {masterProjects.map((proj) => (
              <tr key={proj.code} className="hover:bg-slate-50 group">
                <td className="p-4"><div className="font-mono text-xs text-[#f4ac5c] mb-0.5">{proj.code} ({proj.short})</div><div className="font-bold text-slate-800">{proj.name}</div></td>
                <td className="p-4 text-slate-600 flex items-center gap-2"><img src={getAvatar(proj.owner, '-')} className="w-6 h-6 rounded-full" alt="owner"/>{proj.owner}</td>
                <td className="p-4 text-xs text-slate-500">{proj.start} - {proj.end}</td>
                <td className="p-4 font-mono font-medium text-slate-700">฿{parseFloat(String(proj.budget || '').replace(/[^0-9.-]/g, '') || '0').toLocaleString()}</td>
                <td className="p-4 text-center"><Badge type={proj.status === 'Active' ? 'active' : proj.status === 'Completed' ? 'gray' : 'warning'}>{proj.status || 'Active'}</Badge></td>
                <td className="p-4 text-center">
                   <div className="flex justify-center gap-2 transition-opacity">
                    <button onClick={() => setProjectForm(proj)} className="p-1.5 text-slate-800 hover:text-[#f4ac5c] bg-white border border-slate-300 rounded shadow-sm" title="แก้ไข"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(proj.code, proj.name)} className="p-1.5 text-slate-800 hover:text-rose-600 bg-white border border-slate-300 rounded shadow-sm" title="ลบ"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {projectForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setProjectForm(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-[500px] flex flex-col animate-in zoom-in-95">
             <div className="p-5 border-b border-slate-100 flex justify-between bg-slate-50 rounded-t-2xl"><h3 className="font-bold text-slate-800">Project Data</h3><button onClick={() => setProjectForm(null)}><X size={20}/></button></div>
             <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="flex gap-4">
                   <div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">Project Code</label><input type="text" value={projectForm.code || ''} readOnly className="w-full px-3 py-2 bg-slate-100 border rounded-lg text-sm font-mono text-slate-500" /></div>
                   <div className="w-1/3"><label className="block text-xs font-bold text-slate-500 mb-1">Short Code</label><input type="text" value={projectForm.short || ''} onChange={e=>setProjectForm({...projectForm, short: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">Project Name</label><input type="text" value={projectForm.name || ''} onChange={e=>setProjectForm({...projectForm, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">Project Owner</label><input type="text" value={projectForm.owner || ''} onChange={e=>setProjectForm({...projectForm, owner: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div className="flex gap-4">
                   <div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">Start Date</label><input type="text" value={projectForm.start || ''} onChange={e=>setProjectForm({...projectForm, start: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. 01/01/2026" /></div>
                   <div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">End Date</label><input type="text" value={projectForm.end || ''} onChange={e=>setProjectForm({...projectForm, end: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. 31/12/2026" /></div>
                </div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">Budget Amount (THB)</label><input type="text" value={projectForm.budget || ''} onChange={e=>setProjectForm({...projectForm, budget: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">Status</label><select value={projectForm.status || 'Active'} onChange={e=>setProjectForm({...projectForm, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="Active">Active</option><option value="Completed">Completed</option><option value="On Hold">On Hold</option></select></div>
             </div>
             <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl"><button onClick={handleSaveProject} className="px-6 py-2 text-sm text-white bg-[#f4ac5c] hover:bg-[#e09b4b] rounded-lg font-bold transition-all shadow-sm">Save Project</button></div>
          </div>
        </div>
      )}

      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setImportModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-[600px] flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Upload size={18} className="text-[#f4ac5c]"/> นำเข้าข้อมูลโครงการความละเอียดสูง</h3>
                <p className="text-xs text-slate-500 mt-0.5">รองรับการคัดลอกจาก Excel, Google Sheet หรือไฟล์ CSV</p>
              </div>
              <button onClick={() => setImportModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="bg-[#fcf8f3] border border-[#fbe9d0] rounded-xl p-3 text-[11.5px] text-[#935e1d] leading-relaxed">
                <b>💡 คำแนะนำแถวคอลัมน์:</b> วางข้อมูลที่มีคอลัมน์ตามลำดับดังนี้:<br/>
                <code className="bg-white/80 px-1 py-0.5 rounded border border-[#fddbb0] font-mono text-xs">ชื่อโครงการ, ชื่อผู้รับผิดชอบ, งบประมาณ, วันเริ่มต้น, วันสิ้นสุด, สถานะ, รหัสโครงการ (เว้นได้), ตัวย่อโครงการ (เว้นได้)</code><br/>
                *หากไม่ได้กรอกรหัสโครงการหรือชื่อย่อมา ระบบจะคำนวณและคิดให้โดยอัตโนมัติอ้างอิงจากลำดับโปรเจกต์
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 flex justify-between">
                  <span>ช่องกรอกข้อมูล / วางแถวตาราง</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.readText().then(text => handleParseImport(text));
                    }} 
                    className="flex items-center gap-1 text-[11px] text-[#f4ac5c] hover:underline"
                    type="button"
                  >
                    <Clipboard size={12} /> กดเพื่อวางจากคลิปบอร์ด
                  </button>
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => handleParseImport(e.target.value)}
                  placeholder="ตัวอย่าง:&#13;โครงการพัฒนาระบบหลังบ้าน,สมศักดิ์ คมคาย,500000,01/01/2026,30/06/2026,Active&#13;โครงการจัดงานนิทรรศการไอที,พิมพ์ชนก ตั้งตน,250000,10/02/2026,12/03/2026,Active"
                  className="w-full h-[180px] p-3 text-xs border rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-[#f4ac5c]"
                />
              </div>

              {parsedImportRows.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">ตัวอย่างข้อมูลที่จะนำเข้า ({parsedImportRows.length} รายการ)</label>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[160px] overflow-y-auto text-[11px]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 border-b text-[10px] uppercase">
                        <tr>
                          <th className="p-2">Code (Auto)</th>
                          <th className="p-2">Name</th>
                          <th className="p-2">Owner</th>
                          <th className="p-2">Budget</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white text-xs">
                        {parsedImportRows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2 font-mono text-[#f4ac5c]">{r.code} ({r.short})</td>
                            <td className="p-2 font-bold text-slate-800">{r.name}</td>
                            <td className="p-2 text-slate-600">{r.owner}</td>
                            <td className="p-2 font-mono">฿{parseFloat(r.budget).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
              <button 
                onClick={() => setImportModalOpen(false)} 
                className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-slate-50 text-slate-600 transition-colors"
                type="button"
              >
                ยกเลิก
              </button>
              <button 
                disabled={parsedImportRows.length === 0}
                onClick={handleSaveImportData} 
                className="px-6 py-2 text-sm text-white bg-[#f4ac5c] hover:bg-[#e09b4b] disabled:bg-slate-200 disabled:text-slate-400 rounded-lg font-bold transition-all shadow-sm"
                type="button"
              >
                ยืนยันการนำเข้าข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
