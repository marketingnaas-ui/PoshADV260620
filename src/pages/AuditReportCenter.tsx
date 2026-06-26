import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Search, ChevronRight, ArrowLeft, RefreshCw, Filter, Calendar, User, Briefcase, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import AuditReport from '../components/AuditReport';

interface VaultDoc {
  id: string;
  advId: string;
  timestamp: string;
  type: 'closed' | 'partial';
  totalApproved: number;
  totalUnapproved: number;
  balanceToClear: number;
  itemsSnap: any[];
  by: string;
}

export const AuditReportCenter: React.FC = () => {
  const { advances, updateAdvance, toast } = useApp();
  const [vaultDocs, setVaultDocs] = useState<VaultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'closed' | 'partial'>('all');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Fetch vaulted audit reports from generic store API
  const fetchVaultDocs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/store/vault-docs?t=' + Date.now());
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setVaultDocs(data);
        }
      }
    } catch (e) {
      toast('ไม่สามารถโหลดรายงานการตรวจสอบใบเคลียร์ได้', 'err');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVaultDocs();
  }, []);

  // Map vaulted documents with advance data for a complete record view
  const mappedDocs = useMemo(() => {
    const clearanceReports = vaultDocs.filter(doc => doc.isClearanceReport === true || doc.id?.startsWith('AUD-'));
    return clearanceReports.map(doc => {
      const parentAdv = advances.find(a => a.id === doc.advId);
      const vaultData = doc.vaultData || {};
      const totalApproved = typeof vaultData.totalApproved === 'number' ? vaultData.totalApproved : (typeof doc.totalApproved === 'number' ? doc.totalApproved : 0);
      const totalUnapproved = typeof vaultData.totalUnapproved === 'number' ? vaultData.totalUnapproved : (typeof doc.totalUnapproved === 'number' ? doc.totalUnapproved : 0);
      const balanceToClear = typeof vaultData.balanceToClear === 'number' ? vaultData.balanceToClear : (typeof doc.balanceToClear === 'number' ? doc.balanceToClear : 0);
      const type = vaultData.type || doc.type || 'partial';
      const timestamp = vaultData.timestamp || doc.timestamp || doc.date || 'ไม่ระบุ';
      const itemsSnap = doc.itemsSnap || vaultData.itemsSnap || [];

      return {
        ...doc,
        totalApproved,
        totalUnapproved,
        balanceToClear,
        type,
        timestamp,
        itemsSnap,
        employeeName: parentAdv?.empName || 'ไม่ระบุพนักงาน',
        employeeDept: parentAdv?.empDept || 'ทั่วไป',
        projectName: parentAdv?.projectName || parentAdv?.pName || 'KCL',
        originalAmount: parentAdv?.amount || 0,
        parentAdvStatus: parentAdv?.status || 'UNKNOWN'
      };
    });
  }, [vaultDocs, advances]);

  // Apply filters
  const filteredDocs = useMemo(() => {
    return mappedDocs.filter(doc => {
      // Search matches
      const matchesSearch = 
        doc.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.advId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.projectName.toLowerCase().includes(searchTerm.toLowerCase());

      // Status matches
      const matchesStatus = 
        statusFilter === 'all' ? true : 
        statusFilter === 'closed' ? doc.type === 'closed' : 
        doc.type === 'partial';

      return matchesSearch && matchesStatus;
    });
  }, [mappedDocs, searchTerm, statusFilter]);

  // Find selected vaulted doc
  const selectedDoc = useMemo(() => {
    return mappedDocs.find(d => d.id === selectedDocId);
  }, [mappedDocs, selectedDocId]);

  // Find selected active advance
  const activeAdv = useMemo(() => {
    if (!selectedDoc) return null;
    return advances.find(a => a.id === selectedDoc.advId);
  }, [advances, selectedDoc]);

  // Generate data structure matching AuditReport interface
  const auditReportData = useMemo(() => {
    if (!selectedDoc || !activeAdv) return null;

    // Calculate brought forward balance
    // Find all audits for this specific advance to arrange in chronological order
    const advVaultDocs = [...mappedDocs]
      .filter(v => v.advId === activeAdv.id)
      .sort((a, b) => a.id.localeCompare(b.id));

    const currentDocIndex = advVaultDocs.findIndex(v => v.id === selectedDoc.id);
    const broughtForwardBalance = currentDocIndex > 0 
      ? advVaultDocs[currentDocIndex - 1].balanceToClear 
      : (activeAdv.amount || 0);

    const mappedItems = (selectedDoc.itemsSnap || []).map((it: any, idx: number) => {
      const reqAmt = typeof it.net === 'string' 
        ? parseFloat(it.net.replace(/,/g, '')) || 0 
        : parseFloat(it.net) || 0;
      
      return {
        id: it.id || idx,
        detail: it.description || 'รายการค่าใช้จ่าย',
        project: it.project || activeAdv.projectName || 'KCL',
        requested: reqAmt,
        status: it.action === 'approved' ? 'Approved' : it.action === 'rejected' ? 'Rejected' : 'Pending',
        approved: it.action === 'approved' ? reqAmt : 0,
        rejected: it.action === 'rejected' ? reqAmt : 0,
        note: it.rejectReason || it.reason || '-'
      };
    });

    const trk = activeAdv.trackingRecord;
    const mappedTrackingDocs = trk?.documents?.map((d: any, idx: number) => {
      let typeThai = d.type;
      if (d.type === 'Receipt') typeThai = 'ใบเสร็จรับเงิน / บิลเงินสด';
      else if (d.type === 'Tax Invoice') typeThai = 'ใบกำกับภาษีเต็มรูป';
      else if (d.type === 'Delivery Note') typeThai = 'ใบส่งของ / ใบกำกับสินค้า';
      else if (d.type === 'WHT Certificate') typeThai = 'หนังสือรับรองการหักภาษี ณ ที่จ่าย (WHT)';

      return {
        id: idx,
        type: typeThai,
        ref_no: trk.id || `TRK-${activeAdv.id.substring(4)}`,
        hasCopy: d.attached,
        originalReceived: d.physical
      };
    }) || [];

    const clearanceHistory = advVaultDocs.slice(0, currentDocIndex + 1).map((v, idx) => {
      let vatSum = 0;
      let whtSum = 0;
      let discountSum = 0;
      let otherSum = 0;

      if (Array.isArray(v.itemsSnap)) {
        v.itemsSnap.forEach((it: any) => {
          if (it.action === 'approved') {
            vatSum += parseFloat(it.vat) || 0;
            whtSum += parseFloat(it.wht) || 0;
            discountSum += parseFloat(it.discount) || 0;
          }
        });
      }

      const approvedItemsList = Array.isArray(v.itemsSnap)
        ? v.itemsSnap
            .filter((it: any) => it.action === 'approved')
            .map((it: any) => it.description)
            .join(', ') || 'ไม่มีรายการที่อนุมัติ'
        : 'ไม่มีรายการที่อนุมัติ';

      return {
        round: idx + 1,
        date: v.timestamp ? v.timestamp.split(' ')[0] : 'ไม่ระบุ',
        clr_id: `CLR-${v.id.substring(4, 12)}`,
        items: approvedItemsList,
        vat: vatSum,
        wht: whtSum,
        discount: discountSum,
        other: otherSum,
        net: v.totalApproved
      };
    });

    const historyTotals = clearanceHistory.reduce((acc, curr) => ({
      vat: acc.vat + curr.vat,
      wht: acc.wht + curr.wht,
      discount: acc.discount + curr.discount,
      other: acc.other + curr.other,
      net: acc.net + curr.net
    }), { vat: 0, wht: 0, discount: 0, other: 0, net: 0 });

    return {
      auditData: {
        audit_id: selectedDoc.id,
        clearance_id: activeAdv.clrNo || `CLR-${activeAdv.id.substring(4)}`,
        ref_claim_id: activeAdv.id,
        employee_name: activeAdv.empName,
        audit_date: selectedDoc.timestamp ? selectedDoc.timestamp.split(' ')[0] : new Date().toLocaleDateString('th-TH'),
        status: selectedDoc.type === 'closed' ? 'Closed' : 'Partial',
        financials: {
          original_claim_amount: activeAdv.amount || 0,
          brought_forward_balance: broughtForwardBalance,
          total_requested_this_round: mappedItems.reduce((acc, curr) => acc + curr.requested, 0),
          total_approved: selectedDoc.totalApproved,
          total_rejected: selectedDoc.totalUnapproved,
          pending_clearance_balance: broughtForwardBalance - selectedDoc.totalApproved
        },
        items: mappedItems
      },
      documents: mappedTrackingDocs,
      clearanceHistory,
      historyTotals
    };
  }, [selectedDoc, activeAdv, vaultDocs]);

  // Toggle physical document received status
  const handleToggleOriginalReceived = (idx: number) => {
    if (!activeAdv || !activeAdv.trackingRecord) return;
    const trk = activeAdv.trackingRecord;
    const nextDocs = [...trk.documents];
    const target = nextDocs[idx];
    target.physical = !target.physical;
    target.receivedDate = target.physical ? new Date().toISOString() : null;
    
    const nReceived = nextDocs.filter((d: any) => d.physical).length;
    const totalDocs = nextDocs.length;
    let nextStatus = trk.status;
    if (nReceived === totalDocs) nextStatus = 'Completed';
    else if (nReceived > 0) nextStatus = 'Partially Received';
    else if (new Date() > new Date(trk.dueDate)) nextStatus = 'Overdue';
    else nextStatus = 'Not Started';

    const tl = [...(trk.timeline || [])];
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

    toast('อัปเดตสถานะเอกสารตัวจริงเรียบร้อยแล้ว', 'ok');
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300" id="audit-report-center">
      
      {/* 1. Header Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          {selectedDocId ? (
            <button 
              onClick={() => setSelectedDocId(null)}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600"
              title="กลับไปหน้ารายการ"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
              <FileText size={24} />
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {selectedDocId ? `รายงานตรวจสอบใบเคลียร์ - ${selectedDocId}` : 'ระบบตรวจสอบใบเคลียร์ (Audit Report Center)'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedDocId ? 'แสดงรายงานประมวลผลทางบัญชีและการรับเอกสารบิลตัวจริง' : 'ศูนย์ควบคุมและพิมพ์รายงานตรวจสอบภาษี หัก ณ ที่จ่าย และวงเงินคงเหลือรายครั้ง'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={fetchVaultDocs}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1.5 text-xs font-bold"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> รีเฟรช
          </button>
        </div>
      </div>

      {selectedDocId && auditReportData ? (
        // DETAIL VIEW MODE
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <button 
              onClick={() => setSelectedDocId(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} /> ย้อนกลับ
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">เลขที่ใบเบิกที่เกี่ยวข้อง:</span>
              <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                {auditReportData.auditData.ref_claim_id}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <AuditReport 
              data={auditReportData.auditData}
              documents={auditReportData.documents}
              toggleOriginalStatus={handleToggleOriginalReceived}
              clearanceHistory={auditReportData.clearanceHistory}
              historyTotals={auditReportData.historyTotals}
            />
          </div>
        </div>
      ) : (
        // LIST VIEW MODE
        <div className="space-y-6">
          
          {/* Filters & Search bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="ค้นหาตามรหัส Audit, เลขที่ใบเบิก, พนักงาน หรือโครงการ..." 
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none transition-all font-sans"
              />
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  statusFilter === 'all' 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                ทั้งหมด
              </button>
              <button 
                onClick={() => setStatusFilter('closed')}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  statusFilter === 'closed' 
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <CheckCircle size={13} /> ปิดยอดแล้ว (Closed)
              </button>
              <button 
                onClick={() => setStatusFilter('partial')}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  statusFilter === 'partial' 
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <AlertCircle size={13} /> บางส่วน (Partial)
              </button>
            </div>
          </div>

          {/* Table list */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="animate-spin inline mr-2 text-indigo-500" size={24} />
                <span>กำลังโหลดข้อมูลรายงานการตรวจสอบ...</span>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center">
                <FileText size={48} className="opacity-25 mb-3" />
                <p className="text-sm font-bold">ไม่พบข้อมูลรายงานการตรวจสอบใบเคลียร์</p>
                <p className="text-xs text-slate-400 mt-1">ลองล้างตัวกรองหรือใช้คำค้นหาใหม่อีกครั้ง</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-4">รหัสรายงาน Audit / วันที่</th>
                      <th className="px-6 py-4">เลขที่ใบเบิกที่เกี่ยวข้อง</th>
                      <th className="px-6 py-4">พนักงาน / โครงการ</th>
                      <th className="px-6 py-4 text-right">วงเงินเบิกเริ่มต้น</th>
                      <th className="px-6 py-4 text-right text-emerald-700">หักล้างเคลียร์สุทธิ</th>
                      <th className="px-6 py-4 text-center">สถานะ</th>
                      <th className="px-6 py-4 text-center">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900 font-mono text-xs">{doc.id}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Calendar size={11} /> {doc.timestamp}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg">
                            {doc.advId}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                            <User size={12} className="text-slate-400" /> {doc.employeeName}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1 font-mono">
                            <Briefcase size={11} className="text-slate-400" /> {doc.projectName} ({doc.employeeDept})
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-xs font-medium text-slate-600">
                          {doc.originalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} ฿
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-xs font-bold text-emerald-600">
                          -{doc.totalApproved.toLocaleString(undefined, {minimumFractionDigits: 2})} ฿
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            doc.type === 'closed' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                              : 'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}>
                            {doc.type === 'closed' ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                            {doc.type === 'closed' ? 'Closed' : 'Partial'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => setSelectedDocId(doc.id)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                          >
                            เปิดรายงาน <ChevronRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
