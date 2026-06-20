import React, { useState } from 'react';
import { Upload, Plus, Edit2, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge } from './shared';

export default function Categories() {
  const { toast, masterCategories, saveMasterCategories } = useApp();
  const showToast = (msg: string) => toast(msg, 'ok');

  const [categoryForm, setCategoryForm] = useState<any>(null);

  const handleSaveCategory = async () => {
    if (!categoryForm.name) return showToast("กรุณากรอกชื่อหมวดหมู่");
    const isExisting = masterCategories.find(c => c.id === categoryForm.id);
    const nextList = isExisting 
       ? masterCategories.map(c => c.id === categoryForm.id ? categoryForm : c)
       : [...masterCategories, categoryForm];
    await saveMasterCategories(nextList);
    setCategoryForm(null);
    showToast("บันทึกหมวดหมู่เรียบร้อยแล้ว");
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`ลบข้อมูล ${name}?`)) {
      await saveMasterCategories(masterCategories.filter(c => c.id !== id));
      showToast("ลบข้อมูลสำเร็จ");
    }
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-6">
        <div><h2 className="text-2xl font-bold text-slate-800">Category Management</h2><p className="text-slate-500 text-sm mt-1">ตั้งค่าหมวดหมู่ค่าใช้จ่าย ภาษี และหัก ณ ที่จ่ายเริ่มต้น</p></div>
        <div className="flex gap-2">
           <button onClick={() => showToast("เปิดหน้าต่าง Import Excel...")} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"><Upload size={16} /> Bulk Import</button>
            <button onClick={() => setCategoryForm({ id: `CAT-${String(masterCategories.length + 1).padStart(3, '0')}`, name: '', vat: '7', wht: '0', status: 'Active' })} className="flex items-center gap-2 px-4 py-2 bg-[#f4ac5c] hover:bg-[#e09b4b] rounded-lg text-sm font-bold text-white shadow-sm transition-colors"><Plus size={16} /> Add Category</button>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
            <tr><th className="p-4">Category Name</th><th className="p-4 text-center">Default VAT</th><th className="p-4 text-center">Default WHT</th><th className="p-4 text-center">Status</th><th className="p-4 text-center">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {masterCategories.map((cat) => (
              <tr key={cat.id} className="hover:bg-slate-50 group">
                <td className="p-4 font-bold text-slate-800"><span className="text-xs text-slate-400 font-mono mr-2">{cat.id}</span>{cat.name}</td>
                <td className="p-4 text-center font-mono">{cat.vat}%</td>
                <td className="p-4 text-center font-mono">{cat.wht}%</td>
                <td className="p-4 text-center"><Badge type={cat.status === 'Active' ? 'active' : 'inactive'}>{cat.status || 'Active'}</Badge></td>
                <td className="p-4 text-center">
                  <div className="flex justify-center gap-2 transition-opacity">
                    <button onClick={() => setCategoryForm(cat)} className="p-1.5 text-slate-800 hover:text-[#f4ac5c] bg-white border border-slate-300 rounded shadow-sm" title="แก้ไข"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(cat.id, cat.name)} className="p-1.5 text-slate-800 hover:text-rose-600 bg-white border border-slate-300 rounded shadow-sm" title="ลบ"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {categoryForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setCategoryForm(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-[400px] flex flex-col animate-in zoom-in-95">
             <div className="p-5 border-b border-slate-100 flex justify-between bg-slate-50 rounded-t-2xl"><h3 className="font-bold text-slate-800">Category Config</h3><button onClick={() => setCategoryForm(null)}><X size={20}/></button></div>
             <div className="p-6 space-y-4">
                <div><label className="block text-xs font-bold text-slate-500 mb-1">Category Name</label><input type="text" value={categoryForm.name || ''} onChange={e=>setCategoryForm({...categoryForm, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div className="flex gap-4">
                   <div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">Default VAT (%)</label><input type="number" value={categoryForm.vat || ''} onChange={e=>setCategoryForm({...categoryForm, vat: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                   <div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">Default WHT (%)</label><input type="number" value={categoryForm.wht || ''} onChange={e=>setCategoryForm({...categoryForm, wht: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
             </div>
             <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end rounded-b-2xl"><button onClick={handleSaveCategory} className="px-6 py-2 text-sm text-white bg-[#f4ac5c] hover:bg-[#e09b4b] rounded-lg font-bold transition-all shadow-sm">Save Category</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
