import React, { useState, useEffect } from 'react';
import { Settings, Save, ArrowLeft, RefreshCw, Layers } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useDocumentTemplates } from '../../components/document-engine/useDocumentTemplates';
import { DocumentRenderer } from '../../components/document-engine/DocumentRenderer';
import { FitPageViewer } from '../../components/document-engine/FitPageViewer';
import { cn } from '../../lib/utils';

export default function DocumentTemplates() {
  const { publishedTemplates, tplConfig, saveConfig } = useDocumentTemplates();
  const { toast } = useApp();
  
  const [activeTpl, setActiveTpl] = useState<string | null>(null);
  const [config, setConfig] = useState(tplConfig);
  const [isSaving, setIsSaving] = useState(false);

  // Sync when global config loads/changes
  useEffect(() => {
    setConfig(tplConfig);
  }, [tplConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    await saveConfig(config);
    setTimeout(() => {
      setIsSaving(false);
      toast('บันทึกการตั้งค่าแม่แบบเอกสารสำเร็จ', 'ok');
    }, 400);
  };

  const templates = [
    { id: 'advance', name: 'คำขอเบิกเงินทดรอง', desc: 'ADVANCE REQUISITION SHEET', tpl: publishedTemplates.advance },
    { id: 'clearance', name: 'รายงานเคลียร์เงิน', desc: 'ADVANCE CLEARANCE REPORT', tpl: publishedTemplates.clearance },
    { id: 'summaryReport', name: 'ใบสรุปยอดเงิน', desc: 'ADVANCE UTILIZATION SUMMARY REPORT', tpl: publishedTemplates.summaryReport },
  ];

  if (activeTpl) {
    const tplDef = templates.find(t => t.id === activeTpl);
    const templateObject = tplDef?.tpl;

    // Use dummy data to show the layout since AdvanceTemplateRenderer generates content based on it
    const dummyData = {
      advance: {
        id: 'ADV-2026-00100',
        reqDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 86400000*5).toISOString(),
        empName: 'คุณ ธนากร สวัสดี',
        empId: 'EMP-042',
        empDept: 'แผนกการตลาด',
        projName: 'โครงการปรับปรุงสำนักงาน',
        clrs: [],
        total: 15400,
        items: [
          { id: 1, d: 'ค่าจัดซื้ออุปกรณ์เครื่องเขียน', cat: 'C01', q: 2, u: 'กล่อง', p: 1500, t: 3000 },
          { id: 2, d: 'ค่าเดินทางและที่พัก (เชียงใหม่)', cat: 'C02', q: 1, u: 'รายการ', p: 12400, t: 12400 }
        ]
      },
      clearance: {
        id: 'CLR-2026-00050',
        advanceId: 'ADV-2026-00100',
        reqDate: new Date().toISOString(),
        empName: 'คุณ ธนากร สวัสดี',
        empId: 'EMP-042',
        projName: 'โครงการปรับปรุงสำนักงาน',
        items: [
          { id: 1, itemDate: new Date().toISOString(), d: 'ค่าจัดซื้ออุปกรณ์เครื่องเขียน', refNo: 'INV-001', vendor: 'OfficeMate', totalAmt: 2800 },
          { id: 2, itemDate: new Date().toISOString(), d: 'ค่าเดินทางและที่พัก', refNo: 'TX-452', vendor: 'Thai Airways', totalAmt: 12400 }
        ],
        advTotal: 15400,
        totalAmt: 15200,
        returnAmt: 200,
        reimburseAmt: 0
      },
      summaryReport: {
        id: 'ADV-2026-00100',
        empId: 'EMP-042',
        empName: 'คุณ ธนากร สวัสดี',
        empDept: 'แผนกการตลาด',
        projName: 'โครงการปรับปรุงสำนักงาน',
        total: 15400,
        clrs: [
          { id: 'CLR-2026-00050', clrNo: 'CLR-2026-00050', reqDate: new Date().toISOString(), totalAmt: 15200, vatAmount: 560, whtAmount: 240, discountAmount: 0 }
        ],
        savNo: 'SAV-2606-100',
        savDate: new Date().toISOString()
      }
    }[activeTpl] || {};

    return (
      <div className="flex flex-col lg:flex-row h-screen bg-slate-50 font-['Noto_Sans_Thai'] text-[13px] relative overflow-hidden">
        {/* Left Side: Settings Panel -- Increased left padding with lg:pl-32
            The sidebar covers the left part. Adding pl-32 gives plenty of space. */}
        <div className="w-full lg:w-[45%] h-full overflow-y-auto p-6 lg:pl-32 lg:border-r border-slate-200 bg-white z-10 custom-scrollbar shrink-0">
          
          <button 
            onClick={() => setActiveTpl(null)}
            className="mb-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold transition-colors"
          >
            <ArrowLeft size={16} /> กลับหน้าเลือกแม่แบบ
          </button>

          <h1 className="text-xl font-black text-slate-900 tracking-tight mb-2 flex items-center gap-2">
            <Settings size={20} className="text-orange-600" /> ตั้งค่าแม่แบบเอกสาร
          </h1>
          <p className="text-slate-500 mb-8">{tplDef?.name} - {tplDef?.desc}</p>

          <div className="space-y-6">
            <div className="p-5 border border-slate-200 rounded-xl bg-slate-50 space-y-4">
              <h3 className="font-bold text-slate-800 mb-2">ข้อมูลบริษัท (Company Information)</h3>
              
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-bold text-slate-500">ชื่อบริษัท (ภาษาไทย)</span>
                  <input type="text" className="mt-1 w-full" value={config.companyName || ''} onChange={e => setConfig({...config, companyName: e.target.value})} />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-500">ชื่อบริษัท (ภาษาอังกฤษ)</span>
                  <input type="text" className="mt-1 w-full" value={config.companyEngName || ''} onChange={e => setConfig({...config, companyEngName: e.target.value})} />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-500">เลขประจำตัวผู้เสียภาษี</span>
                  <input type="text" className="mt-1 w-full" value={config.companyTaxId || ''} onChange={e => setConfig({...config, companyTaxId: e.target.value})} />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-500">ที่อยู่สำนักงานใหญ่</span>
                  <textarea className="mt-1 w-full h-20 resize-none" value={config.companyAddress || ''} onChange={e => setConfig({...config, companyAddress: e.target.value})} />
                </label>
              </div>
            </div>

            <div className="p-5 border border-slate-200 rounded-xl bg-slate-50 space-y-4">
              <h3 className="font-bold text-slate-800 mb-2">รูปลักษณ์ (Appearance)</h3>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-bold text-slate-500">URL โลโก้กิจการ</span>
                  <input type="text" className="mt-1 w-full" value={config.logoUrl || ''} onChange={e => setConfig({...config, logoUrl: e.target.value})} />
                </label>
                <div className="flex gap-4">
                  <label className="block flex-1">
                    <span className="text-xs font-bold text-slate-500">สีหลัก (Primary)</span>
                    <input type="color" className="mt-1 w-full h-10 p-1 rounded border border-slate-300" value={config.color || '#000000'} onChange={e => setConfig({...config, color: e.target.value})} />
                  </label>
                  <label className="block flex-1">
                    <span className="text-xs font-bold text-slate-500">สีเน้น (Accent)</span>
                    <input type="color" className="mt-1 w-full h-10 p-1 rounded border border-slate-300" value={config.accentColor || '#E75618'} onChange={e => setConfig({...config, accentColor: e.target.value})} />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-200">
             <button
               onClick={handleSave}
               disabled={isSaving}
               className="w-full py-3 bg-[#E75618] hover:bg-[#B94513] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
             >
               {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
               บันทึกการตั้งค่า
             </button>
             <p className="text-center text-[11px] text-slate-400 mt-3">การเปลี่ยนแปลงคาดไว้ว่าจะมีผลกับทุกเอกสารที่ใช้แม่แบบนี้</p>
          </div>
        </div>

        {/* Right Side: Document Preview - increased padding to prevent menu overlap */}
        <div className="flex-1 bg-slate-200 h-full overflow-y-auto p-4 lg:p-12 lg:pl-12 border-l border-slate-300 custom-scrollbar flex items-start justify-center shadow-inner relative">
           
           <FitPageViewer pageWidth={794} pageHeight={1123}>
             {/* Delete studio config so DocumentRenderer uses AdvanceTemplateRenderer instead of StudioTemplateRenderer */}
             <DocumentRenderer 
               template={{ 
                 ...templateObject, 
                 studioConfig: undefined, 
                 config: { 
                   ...(templateObject?.config || {}), 
                   ...config, 
                   elements: undefined 
                 } 
               } as any}
               data={dummyData}
             />
           </FitPageViewer>
        </div>
      </div>
    );
  }

  // --- Main Template Selection Page ---
  return (
    <div className="p-8 lg:pl-32 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10 lg:ml-4 text-left space-y-2">
         <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
           <Layers className="text-orange-600" size={28} />
           แม่แบบเอกสารหลัก (Document Templates)
         </h1>
         <p className="text-slate-500 font-medium">ดูและตั้งค่าแม่แบบเอกสารที่ใช้พิมพ์จากหน้าจอการทำงาน</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:ml-4">
        {templates.map(tpl => (
          <div key={tpl.id} onClick={() => setActiveTpl(tpl.id)} className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-orange-200 transition-all duration-300 overflow-hidden flex flex-col cursor-pointer">
            <div className="h-44 bg-slate-50 border-b border-slate-100 flex items-center justify-center p-8 overflow-hidden relative">
               <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 opacity-50" />
               <div className="w-[140px] h-[200px] bg-white rounded shadow-md border border-slate-200 flex flex-col transition-transform duration-500 group-hover:-translate-y-2 relative z-10 p-2">
                  <div className="h-4 w-full border-b-2 border-orange-500 mb-2" />
                  <div className="flex-1 space-y-1">
                     <div className="h-1 w-1/2 bg-slate-200 rounded" />
                     <div className="h-1 w-3/4 bg-slate-100 rounded" />
                     <div className="h-10 w-full mt-2 bg-slate-50 border border-slate-100 rounded" />
                  </div>
               </div>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded tracking-wider uppercase">{tpl.desc}</span>
                <h3 className="text-lg font-bold text-slate-900 mt-2 group-hover:text-orange-600 transition-colors tracking-tight">{tpl.name}</h3>
              </div>
              <button 
                className="w-full py-2.5 bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-2 hover:bg-slate-900 hover:text-white transition-all"
              >
                ดูและปรับแต่งการตั้งค่า <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ArrowRight = ({ size, className }: any) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>;
