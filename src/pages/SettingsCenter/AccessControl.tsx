import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, Plus, Settings2, Trash2, CheckCircle, X } from 'lucide-react';
import { Badge } from './shared';
import { useApp } from '../../context/AppContext';

const AVAILABLE_PERMISSIONS = [
  { id: 'dashboard', label: 'Executive Dashboard' },
  { id: 'datacenter', label: 'Advance Data Center' },
  { id: 'list', label: 'Advance List' },
  { id: 'clearinglist', label: 'Clearing List' },
  { id: 'create', label: 'สร้างใบเบิก' },
  { id: 'approval', label: 'อนุมัติ & โอนเงิน' },
  { id: 'clearance', label: 'Clearance Center' },
  { id: 'accounting', label: 'Accounting Review' },
  { id: 'vault', label: 'Document Vault' },
  { id: 'reports', label: 'Reports & Analytics' },
  { id: 'settings', label: 'การตั้งค่าทั้งหมด' }
];

const LINE_PERMISSIONS_OPTIONS = [
  { id: 'line_approve_req', label: 'อนุมัติใบขอเบิกเงินทดรอง (Approve via LINE Group)' },
  { id: 'line_reject_req', label: 'ปฏิเสธคำขอจากส่วนกลาง (Reject via LINE Group)' },
  { id: 'line_view_balance', label: 'ตรวจสอบยอดวงเงินเบิกผ่านแชทบอท (Check Balance via Chatbot)' },
  { id: 'line_get_statements', label: 'เรียกไฟล์ใบขออนุมัติ PDF อัตโนมัติ (Get PDFs via Bot)' },
  { id: 'line_receive_status', label: 'รับข้อความแจ้งแจ้งผลโอนเรียลไทม์ (Receive Transfer Notices)' }
];

export default function AccessControl() {
  const { toast } = useApp();
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = () => {
    setLoading(true);
    fetch('/api/store/roles')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setRoles(data);
        } else {
          const defaultRoles = [
            { id: 'R1', name: 'Administrator', users: 3, type: 'Full Access', desc: 'เข้าถึงได้ทุกระบบและการตั้งค่า', password: 'admin123', permissions: AVAILABLE_PERMISSIONS.map(p => p.id), lineUserIds: 'U991823abf77cda8, U23a4b5c6d', linePermissions: ['line_approve_req', 'line_reject_req', 'line_view_balance', 'line_get_statements', 'line_receive_status'] },
            { id: 'R2', name: 'Accounting', users: 8, type: 'Custom', desc: 'สิทธิ์เฉพาะโมดูลการเงินและการตรวจสอบบัญชี', password: 'acc123', permissions: ['dashboard', 'datacenter', 'list', 'clearinglist', 'accounting', 'vault', 'reports'], lineUserIds: 'U118833ad88f76fa', linePermissions: ['line_view_balance', 'line_get_statements', 'line_receive_status'] },
            { id: 'R3', name: 'Employee / Requester', users: 131, type: 'Custom', desc: 'ขอเบิกเงินทดรองจ่ายและส่งงานเคลียร์ค่าใช้จ่าย', password: 'emp123', permissions: ['dashboard', 'list', 'clearinglist', 'create'], lineUserIds: '', linePermissions: ['line_receive_status'] },
          ];
          setRoles(defaultRoles);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const [roleForm, setRoleForm] = useState<any>(null);

  const handleSaveRole = async () => {
    if (!roleForm.name) {
      toast("กรุณากรอกชื่อสิทธิ์ (Role Name)", "err");
      return;
    }

    // Validate LINE User IDs start with U
    if (roleForm.lineUserIds && roleForm.lineUserIds.trim().length > 0) {
      const ids = roleForm.lineUserIds.split(',').map((id: string) => id.trim());
      const invalidIds = ids.filter((id: string) => id.length > 0 && !id.startsWith('U'));
      if (invalidIds.length > 0) {
        toast(`⚠️ LINE User ID ต้องขึ้นต้นด้วยตัว U ใหญ่ เสมอ (พบ ID ผิดพลาด: ${invalidIds.join(', ')})`, "err");
        return;
      }
    }

    let nextRoles = [];
    const isNew = roleForm.id === 'NEW' || !roles.some(r => r.id === roleForm.id);
    
    let savingForm = { ...roleForm };
    if (savingForm.id === 'NEW') {
      savingForm.id = 'ROLE-' + Date.now();
    }

    if (isNew) {
      nextRoles = [...roles, savingForm];
    } else {
      nextRoles = roles.map(r => r.id === savingForm.id ? savingForm : r);
    }

    try {
      const res = await fetch('/api/store/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextRoles)
      });
      if (!res.ok) throw new Error();
      setRoles(nextRoles);
      setRoleForm(null);
      toast("บันทึกสิทธิ์การเข้าถึงเรียบร้อยแล้ว", "ok");

      // Log to Audit Center
      const auditPayload = {
        id: 'A-' + Date.now(),
        time: new Date().toLocaleString(),
        actor: 'Administrator',
        module: 'Access Control',
        action: isNew ? 'CREATE_ROLE' : 'UPDATE_ROLE',
        ip: '127.0.0.1',
        detail: JSON.stringify(savingForm)
      };
      
      const logsRes = await fetch('/api/store/audit-logs');
      const curLogs = await logsRes.json().catch(() => []);
      await fetch('/api/store/audit-logs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([auditPayload, ...(Array.isArray(curLogs) ? curLogs : [])])
      });

    } catch (e) {
      toast("เกิดข้อผิดพลาดในการบันทึกสิทธิ์", "err");
    }
  };

  const toggleLinePermission = (permId: string) => {
    const currentLinePerms = roleForm.linePermissions || [];
    if (currentLinePerms.includes(permId)) {
      setRoleForm({
        ...roleForm,
        linePermissions: currentLinePerms.filter((p: string) => p !== permId)
      });
    } else {
      setRoleForm({
        ...roleForm,
        linePermissions: [...currentLinePerms, permId]
      });
    }
  };

  const handleDeleteRole = async (id: string, name: string) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ที่จะลบสิทธิ์ "${name}"?`)) return;

    const nextRoles = roles.filter(r => r.id !== id);
    try {
      const res = await fetch('/api/store/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextRoles)
      });
      if (!res.ok) throw new Error();
      setRoles(nextRoles);
      setRoleForm(null);
      toast("ลบสิทธิ์เรียบร้อยแล้ว", "ok");

      // Log to Audit Center
      const auditPayload = {
        id: 'A-' + Date.now(),
        time: new Date().toLocaleString(),
        actor: 'Administrator',
        module: 'Access Control',
        action: 'DELETE_ROLE',
        ip: '127.0.0.1',
        detail: JSON.stringify({ id, name })
      };
      const logsRes = await fetch('/api/store/audit-logs');
      const curLogs = await logsRes.json().catch(() => []);
      await fetch('/api/store/audit-logs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([auditPayload, ...(Array.isArray(curLogs) ? curLogs : [])])
      });
    } catch (e) {
      toast("ไม่สามารถลบสิทธิ์ได้", "err");
    }
  };

  const togglePermission = (permId: string) => {
    const currentPerms = roleForm.permissions || [];
    if (currentPerms.includes(permId)) {
      setRoleForm({
        ...roleForm,
        permissions: currentPerms.filter((p: string) => p !== permId)
      });
    } else {
      setRoleForm({
        ...roleForm,
        permissions: [...currentPerms, permId]
      });
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading Roles...</div>;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Role & Access Control</h2>
        <p className="text-slate-500 text-sm mt-1">จัดการกลุ่มผู้ใช้งาน (Roles) และสิทธิ์การเข้าถึงระบบแบบเจาะลึกเฉพาะโมดูล</p>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {roles.map((role) => (
          <div key={role.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-[#f4ac5c] hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between" onClick={() => setRoleForm({ ...role, permissions: role.permissions || [], linePermissions: role.linePermissions || [] })}>
             <div>
               <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#f4ac5c] flex items-center justify-center"><ShieldCheck size={20}/></div>
                  <Badge type={role.type === 'Full Access' ? 'info' : 'gray'}>{role.type}</Badge>
               </div>
               <h3 className="text-lg font-bold text-slate-800">{role.name}</h3>
               <p className="text-sm text-slate-500 mt-1 mb-3 min-h-[40px]">{role.desc}</p>
               
               {/* LINE Approval Column info section */}
               <div className="text-xs text-slate-600 bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 mb-4 space-y-1">
                 <div className="font-bold text-emerald-800 flex items-center gap-1">
                   <span>🟢 สิทธิ์อนุมัติทาง LINE</span>
                 </div>
                 <div className="text-[11px] font-mono leading-relaxed truncate" title={role.lineUserIds}>
                   📌 <b>LINE IDs:</b> {role.lineUserIds ? role.lineUserIds : 'ยังไม่ได้ผูกไอดี'}
                 </div>
                 <div className="text-[10px] text-slate-500">
                   ⚡ ติ๊กเปิดสิทธิ์: <b>{(role.linePermissions || []).length} / 5 รายการ</b>
                 </div>
               </div>
             </div>

             <div className="flex justify-between items-center text-xs text-slate-500 pt-4 border-t border-slate-100 mt-2">
                <span className="flex items-center gap-1"><Users size={14}/> {role.users || 0} Users</span>
                <span className="text-[#f4ac5c] font-medium group-hover:underline">Edit Policy</span>
             </div>
          </div>
        ))}
        <div onClick={() => setRoleForm({ id: 'NEW', name: '', type: 'Custom', desc: '', users: 0, permissions: [] })} className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:text-[#f4ac5c] hover:border-[#f4ac5c] hover:bg-amber-50/10 transition-colors cursor-pointer min-h-[200px]">
          <Plus size={32} className="mb-2"/>
          <span className="font-bold">Create New Role</span>
        </div>
      </div>

      {roleForm && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setRoleForm(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-[600px] flex flex-col max-h-[85vh] animate-in zoom-in-95 overflow-hidden">
             <div className="p-5 border-b border-slate-100 flex justify-between bg-slate-50 items-center">
               <div className="flex items-center gap-2">
                 <Settings2 className="text-[#f4ac5c]" size={20} />
                 <h3 className="font-bold text-slate-800">{roleForm.id === 'NEW' ? 'Create New Role' : 'Edit Access Policy'}</h3>
               </div>
               <button onClick={() => setRoleForm(null)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
             </div>
             
             <div className="p-6 overflow-y-auto space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Role Name *</label>
                  <input type="text" value={roleForm.name} onChange={e => setRoleForm({ ...roleForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="เช่น Finance Controller" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Role Access Type (ทำเครื่องหมายเลือกประเภทสิทธิ์)</label>
                    <div className="flex flex-col gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                      <label className="flex items-center gap-2 p-1 rounded cursor-pointer hover:bg-white text-slate-700 text-xs font-semibold">
                        <input 
                          type="checkbox" 
                          checked={roleForm.type === 'Custom'} 
                          onChange={() => setRoleForm({ ...roleForm, type: 'Custom' })} 
                          className="rounded text-[#f4ac5c] focus:ring-[#f4ac5c] cursor-pointer"
                        />
                        <span>Custom Permissions</span>
                      </label>
                      <label className="flex items-center gap-2 p-1 rounded cursor-pointer hover:bg-white text-slate-700 text-xs font-semibold">
                        <input 
                          type="checkbox" 
                          checked={roleForm.type === 'Full Access'} 
                          onChange={() => setRoleForm({ ...roleForm, type: 'Full Access' })} 
                          className="rounded text-[#f4ac5c] focus:ring-[#f4ac5c] cursor-pointer"
                        />
                        <span>Full Access</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">No. of Active Users</label>
                    <input type="number" value={roleForm.users} onChange={e => setRoleForm({ ...roleForm, users: Number(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Description</label>
                  <textarea value={roleForm.desc} onChange={e => setRoleForm({ ...roleForm, desc: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="ระบุขอบเขตความรับผิดชอบของตำแหน่งนี้..." />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">รหัสผ่านสำหรับอนุมัติ/ตรวจสอบ (Audit Password) *</label>
                  <input type="password" value={roleForm.password || ''} onChange={e => setRoleForm({ ...roleForm, password: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm font-mono bg-white outline-none" placeholder="ระบุรหัสประจำกลุ่มเพื่อสิทธิ์ตรวจสอบปุ่ม" />
                </div>

                {/* LINE Integration Section in role permissions */}
                <div className="border-t border-slate-100 pt-4">
                  <div className="bg-emerald-50/55 border border-emerald-100 rounded-2xl p-4 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-emerald-800 mb-1 flex items-center gap-1.5">
                        🟢 LINE User ID ผู้มีสิทธิ์อนุมัติสิทธิ์ทาง LINE (ที่ขึ้นต้นด้วย U)
                      </label>
                      <input 
                        type="text" 
                        value={roleForm.lineUserIds || ''} 
                        onChange={e => setRoleForm({ ...roleForm, lineUserIds: e.target.value })} 
                        className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-xs font-mono bg-white focus:border-[#00B900] focus:ring-1 focus:ring-[#00B900] outline-none" 
                        placeholder="เช่น U88ad7721ab982cd67a7, U9911bbdd (คั่นด้วยสัญลักษณ์ , เมื่อต้องการพิมพ์หลายไอดี)" 
                      />
                      <p className="text-[10px] text-slate-500 mt-1 font-medium">✨ บัญชีที่มี ID ตรงกันนี้ จะได้สิทธิ์อนุมัติ คัดค้าน หรือดึงรายงานเอกสารผ่านกลุ่ม LINE / แชทบอทหลัก</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-emerald-800 mb-1.5">
                        สิทธิ์อนุมัติและการสั่งการทาง LINE (LINE Approval Checklist Options)
                      </label>
                      <div className="bg-white border border-emerald-100 rounded-xl p-3 grid grid-cols-1 gap-1.5">
                        {LINE_PERMISSIONS_OPTIONS.map(opt => {
                          const isChecked = (roleForm.linePermissions || []).includes(opt.id);
                          return (
                            <label key={opt.id} className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-colors hover:bg-emerald-50/40 text-slate-700`}>
                              <input 
                                type="checkbox" 
                                checked={isChecked} 
                                onChange={() => toggleLinePermission(opt.id)} 
                                className="rounded text-[#00B900] focus:ring-[#00B900] cursor-pointer" 
                              />
                              <span className="text-xs font-semibold">{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">Module Permissions & Screens</label>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto">
                    {AVAILABLE_PERMISSIONS.map(perm => {
                      const isChecked = roleForm.type === 'Full Access' || (roleForm.permissions || []).includes(perm.id);
                      return (
                        <label key={perm.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${isChecked ? 'bg-amber-100/10 text-[#f4ac5c]' : 'hover:bg-slate-100 text-slate-600'}`}>
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            disabled={roleForm.type === 'Full Access'}
                            onChange={() => togglePermission(perm.id)} 
                            className="rounded text-[#f4ac5c] focus:ring-[#f4ac5c] cursor-pointer" 
                          />
                          <span className="text-xs font-semibold">{perm.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
             </div>

             <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                {roleForm.id !== 'NEW' ? (
                  <button onClick={() => handleDeleteRole(roleForm.id, roleForm.name)} className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1 font-bold">
                    <Trash2 size={15}/> Delete Role
                  </button>
                ) : <div/>}
                
                <div className="flex gap-2 ml-auto">
                  <button onClick={() => setRoleForm(null)} className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-600 font-bold">Cancel</button>
                  <button onClick={handleSaveRole} className="px-6 py-2 text-sm text-white bg-[#f4ac5c] hover:bg-[#e09b4b] rounded-lg font-bold transition-all shadow-sm flex items-center gap-1">
                    <CheckCircle size={15}/> Save Access Policy
                  </button>
                </div>
             </div>
          </div>
         </div>
      )}
    </div>
  );
}