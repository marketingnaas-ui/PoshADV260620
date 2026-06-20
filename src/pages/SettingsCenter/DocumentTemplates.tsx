import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Palette, CheckSquare, PenTool, Upload, FileSignature, X, Image as ImageIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Toggle } from './shared';

export default function DocumentTemplates() {
  const { toast } = useApp();
  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => toast(msg, type);

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([
    { id: 'TPL1', name: 'Advance Request', desc: 'ใบขอเบิกเงินทดรองจ่าย', status: 'Active' },
    { id: 'TPL2', name: 'Clearance Report', desc: 'ใบเคลียร์เงินทดรองจ่าย', status: 'Active' },
    { id: 'TPL3', name: 'Expense Claim', desc: 'ใบเบิกค่าใช้จ่าย', status: 'Draft' },
  ]);

  const [templateForm, setTemplateForm] = useState<any>(null);
  
  const [tplConfig, setTplConfig] = useState<any>({
    style: 'Standard',
    color: '#4f46e5',
    signatures: 3,
    sections: {
      header: true, docInfo: true, employee: true, project: true,
      table: true, vat: true, wht: false, qrcode: true
    },
    tableCols: {
      desc: true, qty: true, unit: true, price: true, amount: true, vat: false, wht: false, costCenter: false
    }
  });

  useEffect(() => {
    fetch('/api/store/document-templates-config')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          if (data.templates) setTemplates(data.templates);
          if (data.tplConfig) setTplConfig(data.tplConfig);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaveTemplate = async () => {
    const updatedTemplates = templates.map(t => t.id === templateForm.id ? { ...t, status: 'Active' } : t);
    
    const payload = {
      templates: updatedTemplates,
      tplConfig
    };

    try {
      const res = await fetch('/api/store/document-templates-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setTemplates(updatedTemplates);
        setTemplateForm(null);
        showToast("Publish Template เรียบร้อยแล้ว", 'ok');
      } else {
        throw new Error();
      }
    } catch (e) {
      showToast("เกิดข้อผิดพลาดในการเผยแพร่เทมเพลต", 'err');
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading Document Templates...</div>;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-6">
        <div><h2 className="text-2xl font-bold text-slate-800">Document Templates</h2><p className="text-slate-500 text-sm mt-1">ตั้งค่าและออกแบบหน้าตาเอกสาร PDF (Template Presets & Section Builder)</p></div>
      </div>
      
      <div className="grid grid-cols-3 gap-6">
        {templates.map((tpl) => (
          <div key={tpl.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden group hover:border-indigo-400 transition-all flex flex-col">
            <div className={`h-2 ${tpl.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <div className="p-6 flex-1">
               <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                 <FileSignature size={24} />
               </div>
               <h3 className="font-bold text-slate-800 text-lg mb-1">{tpl.name}</h3>
               <p className="text-sm text-slate-500 mb-6">{tpl.desc}</p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 mt-auto">
               <button 
                  onClick={() => setTemplateForm(tpl)} 
                  className="w-full py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-lg hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors flex items-center justify-center gap-2"
               >
                 <LayoutDashboard size={16} /> Use Template Wizard
               </button>
            </div>
          </div>
        ))}
      </div>

      {templateForm && (
         <div className="fixed inset-0 z-[60] bg-[#f0f2f5] flex flex-col animate-in slide-in-from-bottom-4">
            <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
               <div className="flex items-center gap-4">
                 <button onClick={() => setTemplateForm(null)} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg"><X size={20}/></button>
                 <div>
                   <h2 className="font-bold text-slate-800">{templateForm.name}</h2>
                   <div className="text-[11px] text-slate-500 font-medium">Template Wizard (Level 1)</div>
                 </div>
               </div>
               <div className="flex gap-3">
                 <button onClick={() => showToast("กำลังสร้างตัวอย่าง PDF ม็อบอัป...", "ok")} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Preview PDF</button>
                 <button onClick={handleSaveTemplate} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 transition-colors">Publish to System</button>
               </div>
            </div>

            <div className="flex flex-1 overflow-hidden animate-in fade-in duration-300">
               <div className="w-[400px] bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
                 <div className="p-6 space-y-8">
                   <section>
                     <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><LayoutDashboard size={14}/> Layout Preset</h3>
                     <div className="grid grid-cols-2 gap-3">
                       {['Standard', 'Construction', 'Accounting', 'Minimal'].map(style => (
                         <button 
                           key={style} onClick={() => setTplConfig({...tplConfig, style})}
                           className={`p-3 border rounded-xl text-left transition-all ${tplConfig.style === style ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-200 hover:border-indigo-300'}`}
                         >
                           <div className={`font-bold text-sm ${tplConfig.style === style ? 'text-indigo-700' : 'text-slate-700'}`}>{style}</div>
                         </button>
                       ))}
                     </div>
                   </section>

                   <section>
                     <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><CheckSquare size={14}/> Section Builder</h3>
                     <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 space-y-1">
                        {[
                          { id: 'header', label: 'Company Header' },
                          { id: 'docInfo', label: 'Document Information' },
                          { id: 'employee', label: 'Employee Information' },
                          { id: 'project', label: 'Project Information' },
                          { id: 'table', label: 'Expense Table' },
                          { id: 'vat', label: 'VAT Summary' },
                          { id: 'wht', label: 'WHT Summary' },
                          { id: 'qrcode', label: 'QR Verification' }
                        ].map(sec => (
                          <label key={sec.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                            <span className="text-sm font-medium text-slate-700">{sec.label}</span>
                            <Toggle active={(tplConfig.sections as any)[sec.id]} onClick={() => setTplConfig({...tplConfig, sections: {...tplConfig.sections, [sec.id]: !(tplConfig.sections as any)[sec.id]}})} />
                          </label>
                        ))}
                     </div>
                   </section>

                   <section className={tplConfig.sections.table ? 'block' : 'hidden opacity-50 pointer-events-none'}>
                     <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Expense Table Columns</h3>
                     <div className="flex flex-wrap gap-2">
                       {[
                         { id: 'desc', label: 'Description' }, { id: 'qty', label: 'Qty' }, { id: 'unit', label: 'Unit' }, 
                         { id: 'price', label: 'Unit Price' }, { id: 'amount', label: 'Amount' }, { id: 'vat', label: 'VAT' }, 
                         { id: 'wht', label: 'WHT' }, { id: 'costCenter', label: 'Cost Center' }
                       ].map(col => (
                         <label key={col.id} className={`px-3 py-1.5 border rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center gap-2 ${((tplConfig.tableCols as any)[col.id]) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                           <input type="checkbox" className="hidden" checked={(tplConfig.tableCols as any)[col.id]} onChange={() => setTplConfig({...tplConfig, tableCols: {...tplConfig.tableCols, [col.id]: !(tplConfig.tableCols as any)[col.id]}})} />
                           {col.label}
                         </label>
                       ))}
                     </div>
                   </section>

                   <section>
                     <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><PenTool size={14}/> Signature Flow</h3>
                     <div className="flex bg-slate-100 p-1 rounded-xl">
                       {[1, 2, 3, 4].map(num => (
                         <button 
                           key={num} onClick={() => setTplConfig({...tplConfig, signatures: num})}
                           className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tplConfig.signatures === num ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                         >
                           {num} Sign{num > 1 ? 's' : ''}
                         </button>
                       ))}
                     </div>
                   </section>

                   <section>
                     <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Palette size={14}/> Branding Preset</h3>
                     <div className="space-y-4">
                       <button onClick={() => showToast("ฟีเจอร์อัปโหลดโลโก้อยู่ระหว่างเชื่อมเครือข่ายทดลอง", "ok")} className="w-full p-3 border border-dashed border-slate-300 rounded-xl text-sm font-bold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center gap-2 transition-colors"><Upload size={16}/> Upload Logo (PNG/JPG)</button>
                       <div>
                         <div className="text-xs text-slate-500 mb-2">Theme Color</div>
                         <div className="flex gap-3">
                           {['#0f172a', '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#e11d48'].map(color => (
                             <button key={color} onClick={() => setTplConfig({...tplConfig, color})} className={`w-8 h-8 rounded-full shadow-sm border-2 transition-transform ${tplConfig.color === color ? 'border-slate-400 scale-110' : 'border-transparent'}`} style={{ backgroundColor: color }} />
                           ))}
                         </div>
                       </div>
                     </div>
                   </section>
                 </div>
               </div>

               <div className="flex-1 overflow-y-auto p-10 flex justify-center pb-20">
                  <div className="w-full max-w-[794px] bg-white shadow-2xl rounded-sm aspect-[1/1.414] border border-slate-300 flex flex-col relative overflow-hidden" style={{ minHeight: '1123px' }}>
                    <div className="h-3 w-full" style={{ backgroundColor: tplConfig.color }} />
                    <div className="p-12 flex flex-col h-full">
                      <div className="flex justify-between items-start mb-8">
                        {tplConfig.sections.header ? (
                          <div className="flex gap-4 items-center animate-in fade-in">
                            <div className="w-16 h-16 rounded bg-slate-100 flex items-center justify-center text-slate-300"><ImageIcon size={24}/></div>
                            <div><div className="h-5 w-40 bg-slate-200 rounded mb-2"/><div className="h-3 w-64 bg-slate-100 rounded"/></div>
                          </div>
                        ) : <div/>}
                        
                        {tplConfig.sections.docInfo && (
                          <div className="text-right animate-in fade-in">
                             <h1 className="text-2xl font-black mb-2" style={{ color: tplConfig.color }}>{templateForm.name.toUpperCase()}</h1>
                             <div className="h-4 w-32 bg-slate-100 rounded ml-auto mb-1"/><div className="h-4 w-24 bg-slate-100 rounded ml-auto"/>
                          </div>
                        )}
                      </div>

                      <div className={`grid gap-6 mb-8 ${tplConfig.sections.employee && tplConfig.sections.project ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {tplConfig.sections.employee && (
                          <div className="border border-slate-200 p-4 rounded-lg animate-in fade-in">
                            <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: tplConfig.color }}>Employee Info</div>
                            <div className="space-y-2"><div className="h-3 w-3/4 bg-slate-100 rounded"/><div className="h-3 w-1/2 bg-slate-100 rounded"/><div className="h-3 w-2/3 bg-slate-100 rounded"/></div>
                          </div>
                        )}
                        {tplConfig.sections.project && (
                          <div className="border border-slate-200 p-4 rounded-lg animate-in fade-in">
                            <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: tplConfig.color }}>Project Info</div>
                            <div className="space-y-2"><div className="h-3 w-full bg-slate-100 rounded"/><div className="h-3 w-3/4 bg-slate-100 rounded"/></div>
                          </div>
                        )}
                      </div>

                      {tplConfig.sections.table && (
                        <div className="mb-6 animate-in fade-in">
                           <table className="w-full text-left text-xs border-collapse">
                             <thead>
                               <tr className="border-y-2 border-slate-800 text-slate-800">
                                 <th className="py-2">No.</th>
                                 {tplConfig.tableCols.desc && <th className="py-2">Description</th>}
                                 {tplConfig.tableCols.qty && <th className="py-2 text-center">Qty</th>}
                                 {tplConfig.tableCols.unit && <th className="py-2 text-center">Unit</th>}
                                 {tplConfig.tableCols.price && <th className="py-2 text-right">Unit Price</th>}
                                 {tplConfig.tableCols.vat && <th className="py-2 text-right">VAT</th>}
                                 {tplConfig.tableCols.wht && <th className="py-2 text-right">WHT</th>}
                                 {tplConfig.tableCols.costCenter && <th className="py-2">Cost Center</th>}
                                 {tplConfig.tableCols.amount && <th className="py-2 text-right">Amount</th>}
                               </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-100">
                               {[1, 2, 3].map(row => (
                                 <tr key={row}>
                                   <td className="py-3 text-slate-400">0{row}</td>
                                   {tplConfig.tableCols.desc && <td className="py-3"><div className="h-3 w-full bg-slate-100 rounded"/></td>}
                                   {tplConfig.tableCols.qty && <td className="py-3 text-center"><div className="h-3 w-4 bg-slate-100 rounded mx-auto"/></td>}
                                   {tplConfig.tableCols.unit && <td className="py-3 text-center"><div className="h-3 w-8 bg-slate-100 rounded mx-auto"/></td>}
                                   {tplConfig.tableCols.price && <td className="py-3"><div className="h-3 w-12 bg-slate-100 rounded ml-auto"/></td>}
                                   {tplConfig.tableCols.vat && <td className="py-3"><div className="h-3 w-8 bg-slate-100 rounded ml-auto"/></td>}
                                   {tplConfig.tableCols.wht && <td className="py-3"><div className="h-3 w-8 bg-slate-100 rounded ml-auto"/></td>}
                                   {tplConfig.tableCols.costCenter && <td className="py-3"><div className="h-3 w-16 bg-slate-100 rounded"/></td>}
                                   {tplConfig.tableCols.amount && <td className="py-3"><div className="h-3 w-16 bg-slate-200 rounded ml-auto"/></td>}
                                 </tr>
                               ))}
                             </tbody>
                           </table>
                        </div>
                      )}

                      <div className="flex justify-end gap-6 mb-8 mt-auto">
                        {tplConfig.sections.vat && (
                          <div className="w-40 border-t-2 border-slate-200 pt-2 text-right animate-in fade-in">
                             <div className="text-[10px] text-slate-400 font-bold mb-1">VAT SUMMARY</div><div className="h-4 w-24 bg-slate-100 rounded ml-auto"/>
                          </div>
                        )}
                        {tplConfig.sections.wht && (
                          <div className="w-40 border-t-2 border-slate-200 pt-2 text-right animate-in fade-in">
                             <div className="text-[10px] text-slate-400 font-bold mb-1">WHT SUMMARY</div><div className="h-4 w-24 bg-slate-100 rounded ml-auto"/>
                          </div>
                        )}
                        <div className="w-48 border-t-2 pt-2 text-right" style={{ borderColor: tplConfig.color }}>
                           <div className="text-xs font-bold mb-1" style={{ color: tplConfig.color }}>NET TOTAL</div><div className="h-6 w-32 bg-slate-200 rounded ml-auto"/>
                        </div>
                      </div>

                      <div className={`grid gap-4 w-full border-t border-slate-200 pt-8 mt-4`} style={{ gridTemplateColumns: `repeat(${tplConfig.signatures}, minmax(0, 1fr))` }}>
                        {Array.from({ length: tplConfig.signatures }).map((_, i) => (
                           <div key={i} className="text-center animate-in fade-in">
                              <div className="h-12 w-full border-b border-dashed border-slate-300 mb-2 relative">
                                {i === 0 && <span className="absolute bottom-1 right-2 text-slate-200"><PenTool size={12}/></span>}
                              </div>
                              <div className="text-[10px] text-slate-500 font-bold mb-1">
                                {i === 0 ? 'REQUESTER' : i === tplConfig.signatures - 1 ? 'AUTHORIZER' : `APPROVER 0${i}`}
                              </div>
                              <div className="h-2 w-1/2 bg-slate-100 rounded mx-auto"/>
                           </div>
                        ))}
                      </div>
                      
                      {tplConfig.sections.qrcode && (
                        <div className="absolute bottom-6 left-12 opacity-50 flex items-center gap-2 animate-in fade-in">
                           <div className="w-12 h-12 border-2 border-slate-800 p-1 flex items-center justify-center"><div className="w-full h-full bg-slate-800"/></div>
                           <div className="text-[8px] text-slate-400 font-mono leading-tight">SCAN TO VERIFY<br/>DOC-2026-X8F9</div>
                        </div>
                      )}
                    </div>
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
