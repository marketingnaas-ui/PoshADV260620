import React, { useState, useEffect } from 'react';
import { Upload, Download, Plus, Edit2, Trash2, X, Clipboard, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge, getAvatar, SignatureInput } from './shared';

export default function StaffDirectory() {
  const { toast, masterUsers, saveMasterUsers } = useApp();
  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => toast(msg, type);

  const [staffForm, setStaffForm] = useState<any>(null);
  
  const [availableRoles, setAvailableRoles] = useState<string[]>(['Administrator', 'Accounting', 'Employee / Requester']);

  useEffect(() => {
    fetch('/api/store/roles')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAvailableRoles(data.map((r: any) => r.name || r.id));
        }
      })
      .catch(() => {});
  }, []);

  
  // Bulk import states
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [parsedImportRows, setParsedImportRows] = useState<any[]>([]);

  const handleSaveStaff = async () => {
    if (!staffForm.name) return showToast("กรุณากรอกชื่อพนักงาน", "err");
    const isExisting = masterUsers.find(s => s.id === staffForm.id);
    const nextList = isExisting 
      ? masterUsers.map(s => s.id === staffForm.id ? staffForm : s)
      : [...masterUsers, staffForm];
    
    await saveMasterUsers(nextList);
    setStaffForm(null);
    showToast("บันทึกข้อมูลพนักงานเรียบร้อยแล้ว", "ok");
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`ลบข้อมูล ${name}?`)) {
      await saveMasterUsers(masterUsers.filter(s => s.id !== id));
      showToast("ลบข้อมูลสำเร็จ", "ok");
    }
  };

  // Helper to generate dynamic ID SEM-xxxx
  const handleOpenAddStaff = () => {
    const prefix = 'SEM-';
    const maxIdx = masterUsers.reduce((max, u) => {
      const parsedNum = parseInt(u.id.replace(prefix, ''), 10);
      return isNaN(parsedNum) ? max : Math.max(max, parsedNum);
    }, 0);
    const nextId = `${prefix}${String(maxIdx + 1).padStart(4, '0')}`;

    setStaffForm({
      id: nextId,
      name: '',
      nickname: '',
      position: 'พนักงาน',
      role: 'Employee / Requester',
      bank: 'KBank',
      bankNo: '',
      bankAccountName: '',
      lineId: '',
      hasSignature: false,
      status: 'ใช้งาน',
      pin: ''
    });
  };


  // Real Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Name', 'Position', 'Bank', 'BankNo', 'BankAccountName', 'LineId', 'Status'];
    const rows = masterUsers.map(u => [
      u.id,
      u.name || '',
      u.position || '',
      u.bank || '',
      u.bankNo || '',
      u.bankAccountName || '',
      u.lineId || '',
      u.status || 'ใช้งาน'
    ]);
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Staff_Directory_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("ดาวน์โหลดไฟล์ CSV เรียบร้อยแล้ว", "ok");
  };

  // Real Import spreadsheet / csv parsing logic
  const handleParseImport = (text: string) => {
    setImportText(text);
    if (!text.trim()) {
      setParsedImportRows([]);
      return;
    }
    const lines = text.split('\n');
    const prefix = 'SEM-';
    
    // Determine last index dynamically to pre-calculate continuous incremental IDs
    let currentMaxIdx = masterUsers.reduce((max, u) => {
      const parsedNum = parseInt(u.id.replace(prefix, ''), 10);
      return isNaN(parsedNum) ? max : Math.max(max, parsedNum);
    }, 0);

    const parsed: any[] = [];
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      // Try tab first, then fall back to comma
      const tabSplit = trimmed.split('\t');
      const commaSplit = trimmed.split(',');
      const parts = tabSplit.length >= 2 ? tabSplit : commaSplit;
      
      // Clean each part
      const cleanedParts = parts.map(p => p.trim().replace(/^"|"$/g, ''));
      
      if (cleanedParts[0]) {
        currentMaxIdx++;
        const name = cleanedParts[0];
        const position = cleanedParts[1] || 'พนักงาน';
        const bank = cleanedParts[2] || 'KBank';
        const bankNo = cleanedParts[3] || '';
        const bankAccountName = cleanedParts[4] || name;
        const lineId = cleanedParts[5] || '';
        const role = cleanedParts[6] || 'Employee / Requester';
        
        parsed.push({
          id: `${prefix}${String(currentMaxIdx).padStart(4, '0')}`,
          name,
          nickname: '',
          position,
          role,
          bank,
          bankNo,
          bankAccountName,
          lineId,
          hasSignature: false,
          status: 'ใช้งาน'
        });
      }

    });
    setParsedImportRows(parsed);
  };

  const handleSaveImportData = async () => {
    if (parsedImportRows.length === 0) {
      showToast("ไม่มีข้อมูลที่จะอิมพอร์ต", "err");
      return;
    }
    const mergedList = [...masterUsers, ...parsedImportRows];
    await saveMasterUsers(mergedList);
    setParsedImportRows([]);
    setImportText('');
    setImportModalOpen(false);
    showToast(`อิมพอร์ตข้อมูลพนักงานจำนวน ${parsedImportRows.length} รายการสำเร็จแล้ว!`, "ok");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) handleParseImport(text);
      };
      reader.readAsText(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) handleParseImport(text);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-6">
        <div><h2 className="text-2xl font-bold text-slate-800">Staff Directory</h2><p className="text-slate-500 text-sm mt-1">จัดการพนักงาน, ข้อมูลธนาคาร และลายเซ็น</p></div>
        <div className="flex gap-2">
          <button onClick={() => setImportModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"><Upload size={16} /> Bulk Import</button>
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"><Download size={16} /> Export CSV</button>
          <button onClick={handleOpenAddStaff} className="flex items-center gap-2 px-4 py-2 bg-[#f4ac5c] hover:bg-[#e09b4b] rounded-lg text-sm font-bold text-white shadow-sm transition-colors"><Plus size={16} /> Add Employee</button>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm align-middle">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider animate-in fade-in">
            <tr><th className="p-4 w-24 text-center">Pic</th><th className="p-4">Employee</th><th className="p-4">Position</th><th className="p-4">Role</th><th className="p-4">Bank Account</th><th className="p-4 text-center">Status</th><th className="p-4 text-center">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {masterUsers.map((staff) => (
              <tr key={staff.id} className="hover:bg-amber-50/10 group align-middle">
                <td className="p-4 text-center"><img src={getAvatar(staff.name, staff.lineId)} alt="avatar" className="w-16 h-16 rounded-full mx-auto object-cover border-2 border-slate-200 shadow-sm hover:scale-110 transition-transform duration-200 cursor-zoom-in" /></td>
                <td className="p-4">
                  <div className="font-mono text-xs text-[#f4ac5c] font-bold mb-0.5">
                    {staff.id} {staff.pin ? `· 🔑 [PIN: ${staff.pin}]` : '· (ไม่มีระบบรหัส)'}
                  </div>
                  <div className="font-bold text-slate-800">{staff.name}</div>
                </td>
                <td className="p-4 text-slate-600">{staff.position || staff.dept}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-block border ${
                    staff.role === 'Administrator' ? 'bg-red-50 text-red-700 border-red-100' :
                    staff.role === 'Accounting' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                    'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    {staff.role || 'Employee / Requester'}
                  </span>
                </td>
                <td className="p-4"><div className="font-bold text-slate-700 text-xs">{staff.bank} <span className="font-mono font-normal text-slate-500 ml-1">{staff.bankNo}</span></div><div className="text-xs text-slate-500 mt-0.5">{staff.bankAccountName || '-'}</div></td>
                <td className="p-4 text-center"><Badge type={staff.status === 'ใช้งาน' ? 'active' : 'inactive'}>{staff.status || 'ใช้งาน'}</Badge></td>

                <td className="p-4 text-center">
                  <div className="flex justify-center gap-2 transition-opacity">
                    <button onClick={() => setStaffForm(staff)} className="p-1.5 text-slate-800 hover:text-[#f4ac5c] bg-white border border-slate-300 rounded shadow-sm" title="แก้ไขข้อมูล"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(staff.id, staff.name)} className="p-1.5 text-slate-800 hover:text-rose-600 bg-white border border-slate-300 rounded shadow-sm" title="ลบข้อมูล"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {staffForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setStaffForm(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-[700px] flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="text-lg font-bold text-slate-800">{masterUsers.find(s => s.id === staffForm.id) ? 'Edit Employee' : 'Add Employee'}</h3>
              <button onClick={() => setStaffForm(null)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-[2]">
                    <label className="block text-xs font-bold text-slate-500 mb-1">Full Name (ชื่อ-นามสกุล) *</label>
                    <input type="text" value={staffForm.name || ''} onChange={e => setStaffForm({...staffForm, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 mb-1 text-amber-600">รหัสลงนาม (PIN / Code) *</label>
                    <input type="text" placeholder="รหัสผ่านทำธุรกรรม" value={staffForm.pin || ''} onChange={e => setStaffForm({...staffForm, pin: e.target.value})} className="w-full px-3 py-2 border-2 border-amber-200 rounded-lg text-sm font-mono text-center" />
                  </div>
                </div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">Position</label><input type="text" value={staffForm.position || ''} onChange={e => setStaffForm({...staffForm, position: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">LINE ID</label><input type="text" value={staffForm.lineId || ''} onChange={e => setStaffForm({...staffForm, lineId: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div className="flex gap-3">
                  <div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">Bank</label><input type="text" value={staffForm.bank || ''} onChange={e => setStaffForm({...staffForm, bank: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">Account No.</label><input type="text" value={staffForm.bankNo || ''} onChange={e => setStaffForm({...staffForm, bankNo: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" /></div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-[2]"><label className="block text-xs font-bold text-slate-500 mb-1">Account Name</label><input type="text" value={staffForm.bankAccountName || ''} onChange={e => setStaffForm({...staffForm, bankAccountName: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
                    <select value={staffForm.status || 'ใช้งาน'} onChange={e => setStaffForm({...staffForm, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">
                      <option value="ใช้งาน">ใช้งาน</option><option value="ปิดใช้งาน">ปิดใช้งาน</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">Role / เข้าถึงระบบสิทธิ์ * (ทำเครื่องหมายเลือกบทบาทกลุ่ม)</label>
                  <div className="grid grid-cols-1 gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3">
                    {availableRoles.map((r: string) => {
                      const isChecked = (staffForm.role || 'Employee / Requester') === r;
                      return (
                        <label key={r} className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${isChecked ? 'bg-[#f4ac5c]/10 text-slate-900 border border-[#f4ac5c]/30' : 'hover:bg-white text-slate-600 border border-transparent'}`}>
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => setStaffForm({...staffForm, role: r})} 
                            className="rounded text-[#f4ac5c] focus:ring-[#f4ac5c] cursor-pointer" 
                          />
                          <span className="text-xs font-bold">{r}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-4"><h4 className="font-bold text-indigo-900 border-b pb-2">E-Signature</h4><SignatureInput value={staffForm.signatureData || (staffForm.hasSignature ? 'imported' : null)} onChange={(data: any) => setStaffForm({...staffForm, signatureData: data, hasSignature: !!data})} /></div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
              <button onClick={() => setStaffForm(null)} className="px-4 py-2 text-sm bg-white border rounded-lg">Cancel</button>
              <button onClick={handleSaveStaff} className="px-6 py-2 text-sm text-white bg-[#f4ac5c] hover:bg-[#e09b4b] rounded-lg font-bold transition-colors shadow-sm">Save Employee</button>
            </div>
          </div>
        </div>
      )}

      {/* BULK IMPORT MODAL */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setImportModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-[850px] max-w-[95vw] flex flex-col max-h-[90vh] animate-in zoom-in-95 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <Clipboard className="text-[#f4ac5c]" size={20} />
                <h3 className="text-lg font-bold text-slate-800">Bulk Import Employees</h3>
              </div>
              <button onClick={() => setImportModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-500">Paste spreadsheet columns or CSV text</label>
                    <span className="text-[10px] text-slate-400">Columns: Name, Position, Bank, Acct No, Acct Name, Line ID</span>
                  </div>
                  <textarea 
                    value={importText}
                    onChange={(e) => handleParseImport(e.target.value)}
                    rows={8}
                    className="w-full p-3 font-mono text-xs border rounded-xl outline-none focus:border-[#f4ac5c]" 
                    placeholder="Example (pasted directly from Excel/Google Sheets):&#10;สมชาย มั่นใจ	วิศวกรอาวุโส	SCB	1234567890	สมชาย มั่นใจ	line_somchai&#10;สมศรี มีสุข	ผู้จัดการการเงิน	KBank	9876543210	สมศรี มีสุข	line_somsri"
                  />

                  <div className="mt-4">
                    <div 
                      onDragOver={handleDragOver}
                      onDrop={handleDropFile}
                      className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center bg-slate-50 hover:bg-amber-50/10 hover:border-[#f4ac5c] transition-colors cursor-pointer relative"
                    >
                      <input 
                        type="file" 
                        accept=".csv,.txt"
                        onChange={handleFileInputChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <Upload className="mx-auto text-slate-400 mb-2" size={24} />
                      <span className="block text-xs md:text-sm font-bold text-slate-600">หรือลากไฟล์ .csv / .txt มาวางที่นี่</span>
                      <span className="block text-[10px] text-slate-400 mt-1">UTF-8 Encoded CSV format recommended</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col">
                  <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1"><Sparkles size={14} className="text-yellow-500"/> Real-time Parsing Preview ({parsedImportRows.length} rows detected)</div>
                  <div className="flex-1 min-h-[220px] bg-slate-50 border border-slate-200 rounded-xl overflow-y-auto text-xs p-1">
                    {parsedImportRows.length === 0 ? (
                      <div className="text-center text-slate-400 py-16">ป้อนข้อมูลหรือวางเพื่อพรีวิวแถว</div>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="bg-slate-100 border-b text-[10px] text-slate-500 font-bold">
                          <tr>
                            <th className="p-2">Name</th>
                            <th className="p-2">Pos</th>
                            <th className="p-2">Bank</th>
                            <th className="p-2">Acct No</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parsedImportRows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-amber-50/10">
                              <td className="p-2 font-bold text-slate-700 truncate max-w-[120px]">{row.name}</td>
                              <td className="p-2 text-slate-500 truncate max-w-[100px]">{row.position}</td>
                              <td className="p-2 text-slate-600 font-bold">{row.bank}</td>
                              <td className="p-2 font-mono text-slate-500">{row.bankNo || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => {
                  setImportText('');
                  setParsedImportRows([]);
                  setImportModalOpen(false);
                }} 
                className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-600 font-bold"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveImportData}
                disabled={parsedImportRows.length === 0}
                className="px-6 py-2 text-sm text-white bg-[#f4ac5c] hover:bg-[#e09b4b] rounded-lg font-bold flex items-center gap-1 shadow-sm transition-all disabled:opacity-50"
              >
                Import {parsedImportRows.length} Employees
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
