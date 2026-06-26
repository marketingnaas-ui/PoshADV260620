import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { FileText, Clock, CheckCircle, AlertCircle, Phone, Mail, Send, Check, MessageCircle, ChevronLeft, RefreshCw, Search, Filter, Download, MoreHorizontal } from 'lucide-react';
import { Advance, TrackingRecord, DocumentTrackingItem } from '../types';
import * as XLSX from 'xlsx';

export function DocumentTracking() {
  const { advances, updateAdvance, setPage, pageExtra, toast } = useApp();
  const [selectedAdvId, setSelectedAdvId] = useState<string | null>(pageExtra?.advId || null);

  useEffect(() => {
    if (pageExtra?.advId) {
      setSelectedAdvId(pageExtra.advId);
    }
  }, [pageExtra]);

  const trackingAdvances = advances.filter(a => a.trackingRecord != null);
  const activeAdv = advances.find(a => a.id === selectedAdvId);

  // Auto overdue logic check
  useEffect(() => {
    let hasUpdates = false;
    trackingAdvances.forEach(adv => {
      if (adv.trackingRecord) {
        const today = new Date();
        const dueDate = new Date(adv.trackingRecord.dueDate);
        const isOverdue = today > dueDate && adv.trackingRecord.status !== 'Completed' && adv.trackingRecord.status !== 'Ready For Accounting' && adv.trackingRecord.status !== 'ERP Posted';
        if (isOverdue && adv.trackingRecord.status !== 'Overdue') {
          updateAdvance(adv.id, {
            trackingRecord: {
              ...adv.trackingRecord,
              status: 'Overdue'
            }
          });
          hasUpdates = true;
        }
      }
    });
  }, [trackingAdvances, updateAdvance]);

  if (!activeAdv) {
    return (
      <DocumentTrackingDashboard 
        advances={trackingAdvances} 
        onSelect={(id) => setSelectedAdvId(id)}
        toast={toast}
      />
    );
  }

  const trk = activeAdv.trackingRecord;
  if (!trk) return null;

  const totalDocs = trk.documents.length;
  const receivedDocs = trk.documents.filter(d => d.physical).length;
  const progressPercent = totalDocs > 0 ? Math.round((receivedDocs / totalDocs) * 100) : 0;
  const isComplete = receivedDocs === totalDocs && totalDocs > 0;

  const handleToggleDoc = (idx: number) => {
    const nextDocs = [...trk.documents];
    const target = nextDocs[idx];
    target.physical = !target.physical;
    target.receivedDate = target.physical ? new Date().toISOString() : null;
    
    // Auto status
    const nReceived = nextDocs.filter(d => d.physical).length;
    let nextStatus = trk.status;
    if (nReceived === totalDocs) nextStatus = 'Completed';
    else if (nReceived > 0) nextStatus = 'Partially Received';
    else if (new Date() > new Date(trk.dueDate)) nextStatus = 'Overdue';
    else nextStatus = 'Not Started';

    // Auto timeline
    const tl = [...trk.timeline];
    if (target.physical) {
      tl.push({ date: new Date().toISOString(), action: `${target.type} Received`, status: 'completed' });
    }

    updateAdvance(activeAdv.id, {
      trackingRecord: {
        ...trk,
        documents: nextDocs,
        status: nextStatus,
        timeline: tl
      }
    });
  };

  const handleCompleteCollection = () => {
    updateAdvance(activeAdv.id, {
      status: 'CLOSED',
      trackingRecord: {
        ...trk,
        status: 'Ready For Accounting',
        completedDate: new Date().toISOString(),
        completedBy: 'Accounting Officer',
        timeline: [
          ...trk.timeline,
          { date: new Date().toISOString(), action: 'Collection Completed', status: 'completed' }
        ]
      }
    });
    toast('เปลี่ยนสถานะเป็น ปิดยอด และบันทึกว่าได้รับเอกสารครบถ้วนเรียบร้อย', 'success');
  };

  const handleSendReminder = () => {
    const missingDocs = trk.documents.filter(d => !d.physical).map(d => d.type).join('\n• ');
    toast(`ส่งแจ้งเตือนผ่าน LINE OA สำเร็จ: \nรอเอกสาร\n• ${missingDocs}`, 'success');
  };

  return (
    <div className="p-4 sm:p-8 animate-in fade-in max-w-5xl mx-auto pb-32">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedAdvId(null)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-800">{trk.id}</h1>
              <span className={`px-2.5 py-1 text-xs font-bold rounded-md ${
                  trk.status === 'Not Started' ? 'bg-slate-100 text-slate-600' :
                  trk.status === 'Partially Received' ? 'bg-yellow-100 text-yellow-700' :
                  trk.status === 'Overdue' ? 'bg-red-100 text-red-700' : 
                  'bg-green-100 text-green-700'
                }`}>
                {trk.status === 'Not Started' ? '⚪ Not Started' : 
                 trk.status === 'Partially Received' ? '🟡 Partially Received' : 
                 trk.status === 'Overdue' ? '🔴 Overdue' : '🟢 ' + trk.status}
              </span>
            </div>
            <p className="text-slate-500 mt-1 text-sm">Document Tracking Detail</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          
          {/* Section 1: Clearance Summary */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">Clearance Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-2 text-sm">
              <div><span className="block text-slate-400 text-xs">CLR Number</span><strong className="text-slate-700">{trk.id.replace('TRK', 'CLR')}</strong></div>
              <div><span className="block text-slate-400 text-xs">ADV Number</span><strong className="text-slate-700">{activeAdv.id}</strong></div>
              <div><span className="block text-slate-400 text-xs">Clearance Amount</span><strong className="text-blue-600">฿{activeAdv.clrAmount?.toLocaleString() || '0'}</strong></div>
              <div><span className="block text-slate-400 text-xs">Employee</span><strong className="text-slate-700">{activeAdv.empName}</strong></div>
              <div><span className="block text-slate-400 text-xs">Department</span><strong className="text-slate-700">{activeAdv.empDept}</strong></div>
              <div><span className="block text-slate-400 text-xs">Project</span><strong className="text-slate-700">{activeAdv.pName}</strong></div>
              <div><span className="block text-slate-400 text-xs">Approval Date</span><strong className="text-slate-700">{new Date(trk.timeline.find(t => t.action.includes('Approved'))?.date || Date.now()).toLocaleDateString('th-TH')}</strong></div>
              <div><span className="block text-slate-400 text-xs">Due Date</span><strong className="text-red-600">{new Date(trk.dueDate).toLocaleDateString('th-TH')}</strong></div>
              <div><span className="block text-slate-400 text-xs">Accounting Officer</span><strong className="text-slate-700">{trk.completedBy || 'System'}</strong></div>
            </div>
          </div>

          {/* Section 2 & 3: Document Collection Progress & Matrix */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">Document Collection</h3>
            
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-end mb-2">
                <div>
                  <span className="text-3xl font-bold text-slate-800">{progressPercent}%</span>
                  <span className="text-sm text-slate-500 ml-2">{receivedDocs} / {totalDocs} Documents</span>
                </div>
                {isComplete && <div className="text-green-600 font-bold flex items-center gap-1 text-sm"><CheckCircle size={16} /> Completed</div>}
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div className={`h-2.5 rounded-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${progressPercent}%` }}></div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-100">
                    <th className="pb-3 font-medium">Document Type</th>
                    <th className="pb-3 font-medium text-center">Attached</th>
                    <th className="pb-3 font-medium text-center">Received Physical</th>
                    <th className="pb-3 font-medium">Received Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trk.documents.map((doc, idx) => (
                    <tr key={idx} className="group">
                      <td className="py-3 font-medium text-slate-700">{doc.type}</td>
                      <td className="py-3 text-center">
                        {doc.attached ? <Check className="inline text-green-500" size={16} /> : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-3 text-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={doc.physical}
                            onChange={() => handleToggleDoc(idx)}
                            disabled={trk.status === 'Ready For Accounting' || trk.status === 'ERP Posted'}
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </td>
                      <td className="py-3 text-slate-500 text-xs">
                        {doc.receivedDate ? new Date(doc.receivedDate).toLocaleDateString('th-TH') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isComplete && trk.status === 'Completed' && (
              <div className="mt-6">
                <button onClick={handleCompleteCollection} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
                  <CheckCircle size={18} /> Complete Document Collection
                </button>
              </div>
            )}
            {(trk.status === 'Ready For Accounting' || trk.status === 'ERP Posted') && (
              <div className="mt-6 bg-green-50 border border-green-200 p-4 rounded-xl text-green-800 text-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <FileText className="text-green-600" size={20} />
                </div>
                <div>
                  <div className="font-bold">Advance Clearance Package Created</div>
                  <p className="opacity-80">ระบบสร้างชุดเอกสาร ERP Preparation Package เรียบร้อยแล้ว</p>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Expense Items Review Status */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">Expense Items & Status</h3>
            <div className="space-y-3">
              {(activeAdv.receipts || []).flatMap(r => r.items || []).map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 gap-3">
                  <div>
                    <div className="font-bold text-slate-700 text-sm">{item.desc}</div>
                    <div className="text-slate-500 text-xs mt-0.5">ยอดสุทธิ: ฿{item.netAmount?.toLocaleString() || 0}</div>
                  </div>
                  <div className={`px-3 py-1 rounded-md text-xs font-bold self-start sm:self-auto ${
                    item.status === 'APPROVED' ? (isComplete ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700') :
                    item.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {item.status === 'APPROVED' ? (isComplete ? 'Approved' : 'Waiting Physical Document') : item.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
        </div>

        <div className="space-y-6">
          
          {/* Section 6: Employee Follow Up */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">Employee Follow Up</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                {activeAdv.empName.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-slate-800">{activeAdv.empName}</div>
                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span> LINE Connected
                </div>
              </div>
            </div>
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex items-center gap-2 text-slate-600"><Phone size={14} /> 089-XXX-XXXX</div>
              <div className="flex items-center gap-2 text-slate-600"><Mail size={14} /> {activeAdv.empId.toLowerCase()}@poshmanor.co.th</div>
            </div>
            <button 
              onClick={handleSendReminder}
              disabled={isComplete}
              className="w-full bg-[#00B900] hover:bg-[#009900] text-white font-bold py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MessageCircle size={16} /> Send LINE Reminder
            </button>
          </div>

          {/* Section 5: Timeline */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">Event Timeline</h3>
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:to-transparent">
              {trk.timeline.map((ev, i) => (
                <div key={i} className="relative flex items-start gap-4">
                  <div className={`w-5 h-5 rounded-full shrink-0 mt-0.5 border-2 ${ev.status === 'completed' ? 'bg-blue-500 border-blue-100' : 'bg-slate-200 border-white'} z-10`} />
                  <div>
                    <div className="font-bold text-slate-700 text-sm">{ev.action}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{new Date(ev.date).toLocaleDateString('th-TH')} {new Date(ev.date).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}</div>
                  </div>
                </div>
              ))}
              {!isComplete && (
                <div className="relative flex items-start gap-4 opacity-50">
                  <div className="w-5 h-5 rounded-full bg-slate-200 border-2 border-white shrink-0 mt-0.5 z-10" />
                  <div>
                    <div className="font-bold text-slate-500 text-sm">Collection Completed</div>
                    <div className="text-slate-400 text-xs mt-0.5">Waiting for physical documents</div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function DocumentTrackingDashboard({ advances, onSelect, toast }: { advances: Advance[], onSelect: (id: string) => void, toast: any }) {
  const [statusFilter, setStatusFilter] = useState('สถานะทั้งหมด');
  const [projectFilter, setProjectFilter] = useState('โครงการ: ทั้งหมด');
  const [search, setSearch] = useState('');

  // calculate stats
  const notStarted = advances.filter(a => a.trackingRecord?.status === 'Not Started').length;
  const partial = advances.filter(a => a.trackingRecord?.status === 'Partially Received').length;
  const completed = advances.filter(a => a.trackingRecord?.status === 'Ready For Accounting' || a.trackingRecord?.status === 'Completed' || a.trackingRecord?.status === 'ERP Posted').length;
  const overdue = advances.filter(a => a.trackingRecord?.status === 'Overdue').length;

  // extract projects
  const uniqueProjects = Array.from(new Set(advances.map(a => a.pName))).filter(Boolean);

  // calculate docs progress
  let receiptTotal = 0, receiptReceived = 0;
  let taxTotal = 0, taxReceived = 0;
  let delTotal = 0, delReceived = 0;
  let whtTotal = 0, whtReceived = 0;

  advances.forEach(a => {
    a.trackingRecord?.documents?.forEach(d => {
      if (d.type.includes('Receipt')) { receiptTotal++; if (d.physical) receiptReceived++; }
      if (d.type.includes('Tax')) { taxTotal++; if (d.physical) taxReceived++; }
      if (d.type.includes('Delivery')) { delTotal++; if (d.physical) delReceived++; }
      if (d.type.includes('WHT')) { whtTotal++; if (d.physical) whtReceived++; }
    });
  });

  const filteredAdvances = useMemo(() => {
    return advances.filter(a => {
      let pass = true;
      if (statusFilter !== 'สถานะทั้งหมด') {
        const s = a.trackingRecord?.status;
        if (statusFilter === 'รอติดตาม' && s !== 'Not Started') pass = false;
        if (statusFilter === 'ได้รับบางส่วน' && s !== 'Partially Received') pass = false;
        if (statusFilter === 'เกินกำหนด' && s !== 'Overdue') pass = false;
      }
      if (projectFilter !== 'โครงการ: ทั้งหมด') {
        if (a.pName !== projectFilter) pass = false;
      }
      if (search) {
        const q = search.toLowerCase();
        const id = a.id.toLowerCase();
        const emp = (a.empName || '').toLowerCase();
        const proj = (a.pName || '').toLowerCase();
        if (!id.includes(q) && !emp.includes(q) && !proj.includes(q)) pass = false;
      }
      return pass;
    });
  }, [advances, statusFilter, projectFilter, search]);

  const handleExportExcel = () => {
    const dataToExport = filteredAdvances.map(a => {
      const dReceived = a.trackingRecord?.documents.filter(d => d.physical).length || 0;
      const dTotal = a.trackingRecord?.documents.length || 1;
      const missingDocs = a.trackingRecord?.documents.filter(d => !d.physical).map(d => d.type).join(', ') || '-';
      const isOverdue = a.trackingRecord?.status === 'Overdue';
      const overdueDays = isOverdue ? Math.floor((Date.now() - new Date(a.trackingRecord?.dueDate || Date.now()).getTime()) / (1000 * 60 * 60 * 24)) : 0;

      return {
        'เลขที่ใบเบิก': a.id,
        'เลขที่ใบเคลียร์': 'CLR-' + a.id.replace('ADV-', ''),
        'ชื่อผู้เบิก': a.empName,
        'โครงการ': a.pName,
        'ยอดเคลียร์': a.clrAmount || 0,
        'สถานะเอกสาร': a.trackingRecord?.status || 'N/A',
        'จำนวนเอกสารครบ': `${dReceived}/${dTotal}`,
        'เอกสารที่ขาด': missingDocs,
        'ครบกำหนด': new Date(a.trackingRecord?.dueDate || Date.now()).toLocaleDateString('th-TH'),
        'ค้าง (วัน)': overdueDays,
        'ผู้รับผิดชอบ': a.trackingRecord?.completedBy || 'System'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Document Tracking');
    XLSX.writeFile(workbook, 'Document_Tracking_Export.xlsx');
    toast('ส่งออกไฟล์ Excel สำเร็จ', 'success');
  };

  const handleSendAllLine = () => {
    const target = filteredAdvances.filter(a => a.trackingRecord?.status === 'Overdue' || a.trackingRecord?.status === 'Not Started' || a.trackingRecord?.status === 'Partially Received');
    if (target.length === 0) {
      toast('ไม่มีรายการที่ต้องส่งเตือน', 'info');
      return;
    }
    toast(`ส่งเตือน LINE จำนวน ${target.length} รายการสำเร็จ`, 'success');
  };

  return (
    <div className="p-4 sm:p-6 animate-in fade-in bg-slate-50 min-h-full pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <div>
           <h1 className="text-2xl font-bold text-slate-800">Document Tracking Center</h1>
           <p className="text-slate-500 text-sm mt-1">ระบบติดตามเอกสารตัวจริงของใบเคลียร์ยอด</p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <button className="bg-white flex items-center justify-center gap-2 text-sm text-slate-600 border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors font-medium">
            <RefreshCw size={16} /> รีเฟรช
          </button>
          <button onClick={handleSendAllLine} className="bg-blue-600 hover:bg-blue-700 transition-colors text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 shadow-sm">
            <MessageCircle size={16} /> ส่งเตือน LINE ทั้งหมด
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="เอกสารรอติดตาม" count={notStarted} icon={<FileText size={24} />} color="blue" />
        <StatCard title="ได้รับบางส่วน" count={partial} icon={<Clock size={24} />} color="yellow" />
        <StatCard title="ได้รับครบแล้ว" count={completed} icon={<CheckCircle size={24} />} color="green" />
        <StatCard title="เกินกำหนด" count={overdue} icon={<AlertCircle size={24} />} color="red" />
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6">
         <div className="flex justify-between items-center mb-6">
           <h3 className="font-bold text-slate-800 text-sm">ความคืบหน้าการได้รับเอกสารตัวจริงแยกตามประเภท</h3>
           <button className="text-xs text-blue-600 font-bold flex items-center gap-1 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">ดูรายละเอียดตามประเภท ▾</button>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-4 gap-x-8 gap-y-6">
           <ProgressItem label="Receipt" sublabel="(ใบเสร็จรับเงิน)" received={receiptReceived} total={receiptTotal} color="bg-green-500" />
           <ProgressItem label="Tax Invoice" sublabel="(ใบกำกับภาษี)" received={taxReceived} total={taxTotal} color="bg-blue-500" />
           <ProgressItem label="Delivery Note" sublabel="(ใบส่งของ)" received={delReceived} total={delTotal} color="bg-orange-500" />
           <ProgressItem label="WHT Certificate" sublabel="(หนังสือรับรองหัก ณ ที่จ่าย)" received={whtReceived} total={whtTotal} color="bg-purple-500" />
         </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
         <div className="flex flex-wrap items-center gap-3">
           <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-blue-100">
             <option>สถานะทั้งหมด</option>
             <option>รอติดตาม</option>
             <option>ได้รับบางส่วน</option>
             <option>เกินกำหนด</option>
           </select>
           <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-blue-100">
             <option>โครงการ: ทั้งหมด</option>
             {uniqueProjects.map(p => <option key={p} value={p}>{p}</option>)}
           </select>
         </div>
         
         <div className="flex items-center gap-3 w-full sm:w-auto">
           <div className="relative flex-1 sm:w-64">
             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาเลขที่ใบเคลียร์, ผู้เบิก, โครงการ..." className="border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-blue-100 w-full" />
           </div>
           <button onClick={() => { setStatusFilter('สถานะทั้งหมด'); setProjectFilter('โครงการ: ทั้งหมด'); setSearch(''); }} className="text-blue-600 text-sm font-medium hover:underline shrink-0">ล้างตัวกรอง</button>
           <button onClick={handleExportExcel} className="border border-slate-200 bg-white px-3 py-2 rounded-lg text-sm text-green-700 font-bold flex items-center justify-center gap-2 shrink-0 hover:bg-slate-50 transition-colors shadow-sm">
             <FileText size={16} className="text-green-600" /> ส่งออก Excel
           </button>
         </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">รายการใบเคลียร์ที่ยังได้รับเอกสารตัวจริงไม่ครบ <span className="text-red-500">({filteredAdvances.length} ฉบับ)</span></h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">เลขที่ใบเคลียร์</th>
                <th className="px-4 py-3">ผู้เบิก</th>
                <th className="px-4 py-3 text-center">โครงการ</th>
                <th className="px-4 py-3 text-right">ยอดเคลียร์ (บาท)</th>
                <th className="px-4 py-3 w-40">สถานะเอกสาร</th>
                <th className="px-4 py-3 text-center">เอกสารที่ยังขาด</th>
                <th className="px-4 py-3">ครบกำหนด</th>
                <th className="px-4 py-3 text-center">อายุค้าง (วัน)</th>
                <th className="px-4 py-3">ผู้รับผิดชอบ</th>
                <th className="px-4 py-3 text-center">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {filteredAdvances.map(adv => {
                 const dReceived = adv.trackingRecord?.documents.filter(d => d.physical).length || 0;
                 const dTotal = adv.trackingRecord?.documents.length || 1;
                 const pct = Math.round((dReceived/dTotal)*100);
                 const status = adv.trackingRecord?.status;
                 const isOverdue = status === 'Overdue';
                 
                 return (
                  <tr key={adv.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-3">
                       <div className="font-bold text-slate-800">CLR-{adv.id.replace('ADV-', '')}</div>
                       <div className="text-xs text-slate-400 mt-0.5">{adv.id}</div>
                    </td>
                    <td className="px-4 py-3">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center font-bold text-slate-500 text-xs shrink-0">
                           <img src={`https://ui-avatars.com/api/?name=${adv.empName}&background=random`} alt="av" className="w-full h-full object-cover" />
                         </div>
                         <div>
                           <div className="font-bold text-slate-700 text-xs">{adv.empName}</div>
                           <div className="text-[10px] text-slate-500 mt-0.5">Site Engineer</div>
                         </div>
                       </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-purple-100 text-purple-700">{adv.pName.substring(0,3).toUpperCase()}</span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800 text-right">
                      {adv.clrAmount?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                    <td className="px-4 py-3">
                       <div className="flex flex-col gap-1.5 w-full">
                         <div className="flex items-end justify-between text-xs">
                           <span className={isOverdue ? 'text-red-600 font-bold' : status === 'Partially Received' ? 'text-orange-600 font-bold' : status === 'Not Started' ? 'text-slate-600 font-bold' : 'text-green-600 font-bold'}>
                             {status === 'Partially Received' ? 'ได้รับบางส่วน' : 
                              isOverdue ? 'เกินกำหนด' :
                              status === 'Not Started' ? 'รอติดตาม' : 'ได้รับครบแล้ว'}
                           </span>
                           <span className="text-[10px] text-slate-500 font-medium">
                             {dReceived}/{dTotal} เอกสาร
                           </span>
                         </div>
                         <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex items-center relative">
                           <div className={`h-full absolute left-0 top-0 transition-all duration-500 ${isOverdue ? 'bg-red-500' : 'bg-orange-400'}`} style={{width: `${pct}%`}}></div>
                         </div>
                         <div className="text-[9px] text-right text-slate-400 font-bold mt-0.5">{pct}%</div>
                       </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {adv.trackingRecord?.documents.map((d: any, idx: number) => {
                          const isMissing = !d.physical;
                          return (
                            <div key={idx} className="flex flex-col items-center gap-1.5" title={d.type}>
                              <div className={`w-6 h-6 rounded-md flex items-center justify-center ${isMissing ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-green-50 text-green-500 border border-green-100'} shadow-sm`}>
                                {isMissing ? (isOverdue ? <AlertCircle size={12} strokeWidth={3} /> : <Clock size={12} strokeWidth={3} />) : <Check size={14} strokeWidth={4} />}
                              </div>
                              <span className="text-[8.5px] text-slate-500 truncate w-14 text-center font-medium leading-tight">{d.type.split(' ')[0]}</span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                       <span className={`font-bold text-xs ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                         {new Date(adv.trackingRecord?.dueDate || Date.now()).toLocaleDateString('en-GB')}
                       </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                       <span className={`font-bold text-sm ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                         {isOverdue ? Math.floor((Date.now() - new Date(adv.trackingRecord?.dueDate || Date.now()).getTime()) / (1000 * 60 * 60 * 24)) : '-'}
                       </span>
                    </td>
                    <td className="px-4 py-3">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full border border-slate-200 overflow-hidden shrink-0">
                           <img src={`https://ui-avatars.com/api/?name=${adv.trackingRecord?.completedBy || 'เปรมวดี หัวอริย'}&background=random`} alt="av" className="w-full h-full object-cover" />
                         </div>
                         <div>
                           <div className="font-bold text-slate-700 text-xs">{adv.trackingRecord?.completedBy || 'เปรมวดี หัวอริย'}</div>
                           <div className="text-[10px] text-slate-500 mt-0.5">Accounting Manager</div>
                         </div>
                       </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button className="bg-white border border-blue-200 text-blue-600 text-xs px-4 py-1.5 rounded-full hover:bg-blue-50 font-bold transition-colors shadow-sm" onClick={() => onSelect(adv.id)}>
                          ดูรายละเอียด
                        </button>
                        <button className="bg-white border border-slate-200 text-slate-400 text-xs p-1.5 rounded-full hover:bg-slate-50 transition-colors shadow-sm">
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
               )})}
            </tbody>
          </table>
        </div>
        
        {advances.length > 20 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500 bg-slate-50">
            <div>แสดงรายการทั้งหมด {advances.length} รายการ</div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({title, count, icon, color}: any) {
  const colorMap: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    yellow: 'bg-orange-50 text-orange-600 border-orange-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200'
  };
  return (
    <div className={`p-5 rounded-xl border shadow-sm ${colorMap[color] || 'bg-white'}`}>
      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-sm ${color === 'blue' ? 'bg-blue-500 text-white' : color === 'yellow' ? 'bg-orange-400 text-white' : color === 'green' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {icon}
        </div>
        <div>
          <div className="text-sm font-bold opacity-90 mb-0.5">{title}</div>
          <div className="text-3xl font-black">{count} <span className="text-sm font-medium opacity-70 ml-1">ฉบับ</span></div>
        </div>
      </div>
    </div>
  );
}

function ProgressItem({label, sublabel, received, total, color}: any) {
  const pct = total > 0 ? Math.round((received/total)*100) : 0;
  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <div>
          <div className="font-bold text-slate-800 text-[13px]">{label} <span className="text-slate-500 font-medium ml-1">{sublabel}</span></div>
        </div>
        <div className={`text-lg font-bold ${color.replace('bg-', 'text-')}`}>{pct}%</div>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2 overflow-hidden shadow-inner">
        <div className={`h-2.5 rounded-full ${color} transition-all duration-500`} style={{width: `${pct}%`}}></div>
      </div>
      <div className="text-xs text-slate-500 font-medium">ได้รับแล้ว {received} / {total} ฉบับ</div>
    </div>
  );
}
