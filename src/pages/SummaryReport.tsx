import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useDocumentTemplates } from '../components/document-engine/useDocumentTemplates';
import { DocumentRenderer } from '../components/document-engine/DocumentRenderer';
import { FitPageViewer } from '../components/document-engine/FitPageViewer';
import { Printer, Download, FileText, ChevronRight, PenTool } from 'lucide-react';
import { SignatureInput } from './SettingsCenter/shared';

export const SummaryReport: React.FC = () => {
  const { advances, masterUsers } = useApp();
  const { publishedTemplates } = useDocumentTemplates();
  const [selectedAdvId, setSelectedAdvId] = useState<string>('');
  const [overrides, setOverrides] = useState<{
    requesterSignature?: string;
    accountantSignature?: string;
    approverSignature?: string;
  }>({});
  const { openDrawer, closeDrawer } = useApp();

  // Filter advances that are fully CLOSED
  const finalizedAdvances = useMemo(() => 
    advances.filter(a => a.status === 'CLOSED'), 
    [advances]
  );

  // Default to the first available finalized advance if not picked yet
  React.useEffect(() => {
    if (finalizedAdvances.length > 0 && !selectedAdvId) {
      setSelectedAdvId(finalizedAdvances[0].id);
    }
  }, [finalizedAdvances, selectedAdvId]);

  const activeAdv = finalizedAdvances.find(a => a.id === selectedAdvId) || finalizedAdvances[0];

  const [savNo, setSavNo] = useState<string>('');

  useEffect(() => {
    if (activeAdv) {
      const idParts = activeAdv.id?.split('-') || [];
      const lastPart = idParts.length > 0 ? idParts[idParts.length - 1] : '0';
      const numOnly = lastPart.replace(/[^0-9]/g, '') || '0';
      const initialSav = activeAdv.savNo || activeAdv.ravNo || `SAV-2606-${String(parseInt(numOnly, 10)).padStart(3, '0')}`;
      setSavNo(initialSav);
    }
  }, [activeAdv]);

  useEffect(() => {
    let active = true;
    if (activeAdv && !activeAdv.savNo && !activeAdv.ravNo) {
      fetch('/api/generate-running-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'SAV' })
      })
        .then(r => r.json())
        .then(d => {
          if (active && d.number) {
            setSavNo(d.number);
          }
        })
        .catch(console.error);
    }
    return () => { active = false; };
  }, [activeAdv]);

  const handlePrint = () => {
    window.print();
  };

  if (!activeAdv) {
    return (
      <div className="card text-center p-12 max-w-xl mx-auto mt-8 bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="text-4xl mb-4">📂</div>
        <h3 className="text-lg font-bold text-slate-800">ไม่มีข้อมูลใบเบิกที่ปิดบัญชีเสร็จสิ้น</h3>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          รายงานวิเคราะห์และสรุปยอดคงค้าง (TPL3 SAV) จะแสดงขึ้นเมื่อแผนกบัญชีคัดกรองคลิกตรวจสอบและปิดยอด "Close Account" เป็นที่สำเร็จลุล่วงแล้วเท่านั้น
        </p>
      </div>
    );
  }

  const requester = masterUsers.find(u => u.id === activeAdv.empId || u.name === activeAdv.empName);
  const approver = masterUsers.find(u => u.name === activeAdv.appBy);
  const accountant = masterUsers.find(u => u.role === 'Accounting' || u.role === 'ฝ่ายบัญชี');

  // Map the domain advance data into the TPL3 layout schema
  const summaryReportData = {
    reportNo: savNo,
    reportDate: activeAdv.ravDate ? new Date(activeAdv.ravDate).toISOString() : new Date().toISOString(),
    id: activeAdv.id,
    employeeName: activeAdv.empName,
    employeeId: activeAdv.empId || 'EMP-045',
    employeeDept: activeAdv.empDept || 'ฝ่ายปฏิบัติการภาคสนาม',
    projectName: activeAdv.pName || 'โครงการทั่วไป',
    appAmount: activeAdv.appAmount || activeAdv.amount,
    clrAmount: activeAdv.clrAmount || activeAdv.clearanceAmount || 0,
    status: activeAdv.status,
    requesterSignature: overrides.requesterSignature || requester?.signatureData,
    accountantName: (accountant?.name || 'น.ส. พิชญาภา วงศ์ศิริ'),
    accountantSignature: overrides.accountantSignature || accountant?.signatureData,
    approverName: (approver?.name || activeAdv.appBy || 'นาย ณัฐวุฒิ ศรีสุวรรณ'),
    approverSignature: overrides.approverSignature || approver?.signatureData,
    receipts: activeAdv.receipts || [],
    clrs: (activeAdv.clrs || []).map((c: any, idx: number) => {
      const idParts = activeAdv.id?.split('-') || [];
      const lastPart = idParts.length > 0 ? idParts[idParts.length - 1] : '0';
      const numOnly = lastPart.replace(/[^0-9]/g, '') || '0';
      return {
        id: c.clrNo || c.id || `CLR-2606-${numOnly}-0${idx + 1}`,
        note: c.note || c.description || 'เอกสารจัดซื้อบิลวัสดุก่อสร้างจริง',
        amount: c.amount || c.clrAmount || 0,
        vat: c.vat || 0,
        wht: c.wht || 0,
        discount: c.discount || 0,
        date: c.date || new Date().toISOString(),
      };
    }),
    categorySummary: [
      { name: 'ค่าจัดซื้อเศษวัสดุและเครื่องมือ', amount: (activeAdv.clrAmount || activeAdv.clearanceAmount || 0) * 0.6 },
      { name: 'ค่าใช้จ่ายและค่าน้ำมันนอกสถานที่', amount: (activeAdv.clrAmount || activeAdv.clearanceAmount || 0) * 0.25 },
      { name: 'ค่าใช้สอยจิปาถะทั่วไปหน้างาน', amount: (activeAdv.clrAmount || activeAdv.clearanceAmount || 0) * 0.15 },
    ],
  };

  return (
    <div className="summary-report-container animate-fade-in">
      <div className="ph no-print flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-black text-slate-900">Advance Utilization Summary Report</h2>
          <p className="text-sm text-slate-500">รายงานสรุปวงเงินทดรองจ่ายและการส่งบิลล้างหนี้สะสมแบบบูรณาการ (TPL3)</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              openDrawer(
                <div className="flex items-center gap-2"><PenTool size={18} /> จัดการลงนามดิจิทัล (Overrides)</div>,
                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-800 border-b pb-2">ผู้เบิก (Requester)</h4>
                    <SignatureInput 
                      value={overrides.requesterSignature || requester?.signatureData} 
                      onChange={(val: string) => setOverrides(o => ({ ...o, requesterSignature: val }))} 
                    />
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-800 border-b pb-2">ฝ่ายบัญชี (Accountant)</h4>
                    <SignatureInput 
                      value={overrides.accountantSignature || accountant?.signatureData} 
                      onChange={(val: string) => setOverrides(o => ({ ...o, accountantSignature: val }))} 
                    />
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-800 border-b pb-2">ผู้อนุมัติ (Approver)</h4>
                    <SignatureInput 
                      value={overrides.approverSignature || approver?.signatureData} 
                      onChange={(val: string) => setOverrides(o => ({ ...o, approverSignature: val }))} 
                    />
                  </div>
                </div>,
                <div className="p-4 border-t border-slate-100 flex justify-end">
                  <button onClick={closeDrawer} className="btn btn-p px-8 py-2 bg-indigo-600 text-white rounded-lg font-bold">บันทึกและปิด</button>
                </div>
              );
            }} 
            className="btn flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-all shadow-sm"
          >
            <PenTool size={14} /> จัดการลงนาม (Sign)
          </button>
          <button onClick={handlePrint} className="btn btn-p flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm">
            <Printer size={14} /> พิมพ์รายงาน (Print layout)
          </button>
        </div>
      </div>

      <div className="flex flex-col no-print mb-8">
        {/* Top selector menu */}
        <div className="card p-4 bg-white border border-slate-200 rounded-xl space-y-4 mb-6">
          <div className="text-xs font-black uppercase text-slate-400 tracking-wider">เลือกรายการใบเบิกเงินทดรอง (เฉพาะสถานะ CLOSED)</div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {finalizedAdvances.map((adv) => {
              const active = adv.id === selectedAdvId;
              return (
                <button
                  key={adv.id}
                  onClick={() => setSelectedAdvId(adv.id)}
                  className={`flex-shrink-0 text-left p-3 rounded-lg border text-xs transition-all flex items-center gap-3 ${
                    active 
                      ? 'border-indigo-200 bg-indigo-50/50 text-indigo-900 font-bold' 
                      : 'border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <FileText size={16} className={active ? 'text-indigo-500' : 'text-slate-400'} />
                  <div>
                    <div className="font-mono">{adv.id}</div>
                    <div className="opacity-75 truncate max-w-[120px] mt-0.5">{adv.empName}</div>
                  </div>
                </button>
              );
            })}
            {finalizedAdvances.length === 0 && (
              <div className="text-xs text-slate-400 py-2">ไม่มีใบเบิกคงเหลือสะสม</div>
            )}
          </div>
        </div>

        {/* Live Preview Display using standard document renderer */}
        <div className="flex flex-col items-center bg-slate-100 p-0 lg:p-4 rounded-2xl border-none lg:border border-slate-200 min-h-[400px] overflow-auto">
          <FitPageViewer pageWidth={1123} pageHeight={794}>
            <DocumentRenderer 
              template={publishedTemplates.summaryReport} 
              data={summaryReportData} 
            />
          </FitPageViewer>
        </div>
      </div>


      {/* Actual Print Only Layout - Full scale for default windows printing */}
      <div className="hidden print:block font-sans">
        <DocumentRenderer 
          template={publishedTemplates.summaryReport} 
          data={summaryReportData} 
        />
      </div>
    </div>
  );
};

export default SummaryReport;
