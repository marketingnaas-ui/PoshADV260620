import React from 'react';
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Paperclip, 
  Printer, 
  CheckSquare,
  Square,
  History,
  Calculator
} from 'lucide-react';

interface AuditReportProps {
  data: {
    audit_id: string;
    clearance_id: string;
    ref_claim_id: string;
    employee_name: string;
    audit_date: string;
    status: string;
    financials: {
      original_claim_amount: number;
      brought_forward_balance: number;
      total_requested_this_round: number;
      total_approved: number;
      total_rejected: number;
      pending_clearance_balance: number;
    };
    items: Array<{
      id: string | number;
      detail: string;
      project: string;
      requested: number;
      status: string;
      approved: number;
      rejected: number;
      note: string;
    }>;
  };
  documents?: Array<{
    id: any;
    ref_no: string;
    type: string;
    hasCopy?: boolean;
    originalReceived: boolean;
  }>;
  toggleOriginalStatus?: (id: any) => void;
  clearanceHistory?: Array<{
    round: number;
    date: string;
    clr_id: string;
    items: string;
    vat: number;
    wht: number;
    discount: number;
    other: number;
    net: number;
  }>;
  historyTotals?: {
    vat: number;
    wht: number;
    discount: number;
    other: number;
    net: number;
  };
}

const AuditReport: React.FC<AuditReportProps> = ({ 
  data: auditData, 
  documents = [], 
  toggleOriginalStatus,
  clearanceHistory = [],
  historyTotals = { vat: 0, wht: 0, discount: 0, other: 0, net: 0 }
}) => {

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Approved': 
        return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[11px] font-medium flex items-center gap-1 w-max mx-auto"><CheckCircle size={12}/> อนุมัติ</span>;
      case 'Rejected': 
        return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[11px] font-medium flex items-center gap-1 w-max mx-auto"><XCircle size={12}/> ไม่อนุมัติ</span>;
      default: 
        return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-[11px] font-medium flex items-center gap-1 w-max mx-auto">รอตรวจสอบ</span>;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full bg-gray-100 py-6 font-sans print:py-0 print:bg-white flex justify-center">
      <div className="w-full max-w-[950px] bg-white shadow-lg print:shadow-none print:border-none border border-gray-200 rounded-xl print:rounded-none p-6 sm:p-8 space-y-6">
        
        {/* Header Section */}
        <div className="flex justify-between items-end pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FileText className="text-indigo-600" size={22} />
              รายงานการตรวจสอบใบเคลียร์ (Audit Report)
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              สถานะเอกสาร: <span className={`font-semibold ${auditData.status === 'Closed' ? 'text-green-600' : 'text-yellow-600'}`}>
                {auditData.status === 'Closed' ? 'ปิดยอดบัญชีเรียบร้อย (Closed)' : 'บันทึกการเคลียร์บางส่วน (Partial)'}
              </span>
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button 
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            >
              <Printer size={14} /> พิมพ์รายงาน
            </button>
          </div>
        </div>

        {/* ข้อมูลทั่วไป & สรุปยอดเงิน */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50/50 p-4 rounded-xl border border-gray-200 col-span-1">
            <h3 className="text-xs font-bold text-gray-800 mb-3 pb-2 border-b">ข้อมูลอ้างอิงเอกสาร</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">เลขที่ Audit:</span>
                <span className="font-semibold text-gray-900">{auditData.audit_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">เลขที่ใบเคลียร์:</span>
                <span className="font-semibold text-indigo-600">{auditData.clearance_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">เลขที่ใบเบิก:</span>
                <span className="font-semibold text-blue-600">{auditData.ref_claim_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ชื่อพนักงาน:</span>
                <span className="font-medium text-gray-900 truncate max-w-[140px]" title={auditData.employee_name}>{auditData.employee_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">วันที่ตรวจสอบ:</span>
                <span className="font-medium text-gray-900">{auditData.audit_date}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50/50 p-4 rounded-xl border border-gray-200 col-span-2">
            <h3 className="text-xs font-bold text-gray-800 mb-3 pb-2 border-b flex items-center gap-1.5">
              <Calculator size={14} className="text-gray-500"/>
              สรุปตรรกะตัดยอดเงินคงค้างสะสม (Financial Breakdown)
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-500 mb-0.5">วงเงินเบิกเริ่มต้น</p>
                <p className="text-sm font-bold text-gray-800">{auditData.financials.original_claim_amount.toLocaleString(undefined, {minimumFractionDigits: 2})} ฿</p>
              </div>
              <div className="bg-yellow-50/80 p-2.5 rounded-lg border border-yellow-100">
                <p className="text-[10px] text-yellow-700 mb-0.5">ยอดยกมา (ค้างตั้งต้นรอบนี้)</p>
                <p className="text-sm font-bold text-yellow-700">{auditData.financials.brought_forward_balance.toLocaleString(undefined, {minimumFractionDigits: 2})} ฿</p>
              </div>
              
              <div className="bg-indigo-50/80 p-3 rounded-lg border border-indigo-100 sm:row-span-2 flex flex-col justify-center items-center text-center">
                <p className="text-[11px] text-indigo-700 mb-1 font-semibold">ยอดคงค้างยกไป (Balance)</p>
                <p className="text-lg font-bold text-indigo-700 leading-none">
                  {auditData.financials.pending_clearance_balance.toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-xs">฿</span>
                </p>
              </div>

              <div className="bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-100">
                <p className="text-[10px] text-emerald-700 mb-0.5">อนุมัติหักล้างรอบนี้ (-)</p>
                <p className="text-sm font-bold text-emerald-700">-{auditData.financials.total_approved.toLocaleString(undefined, {minimumFractionDigits: 2})} ฿</p>
              </div>
              <div className="bg-rose-50/80 p-2.5 rounded-lg border border-rose-100">
                <p className="text-[10px] text-rose-700 mb-0.5">ไม่อนุมัติ/ตีคืนยอดค้าง (+)</p>
                <p className="text-sm font-bold text-rose-700">+{auditData.financials.total_rejected.toLocaleString(undefined, {minimumFractionDigits: 2})} ฿</p>
              </div>
            </div>
          </div>
        </div>

        {/* ตารางรายละเอียดรายการเคลียร์ */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-200 bg-slate-50/80 flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-800">รายละเอียดรายการเคลียร์ในรอบนี้ (Item Details)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-gray-600">
              <thead className="text-[10px] text-gray-700 uppercase bg-slate-100/60 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 font-semibold">รายการสินค้า/บริการ</th>
                  <th className="px-4 py-2 font-semibold">โครงการ</th>
                  <th className="px-4 py-2 text-right font-semibold">ยอดขอเคลียร์ (฿)</th>
                  <th className="px-4 py-2 text-center font-semibold">สถานะการตรวจ</th>
                  <th className="px-4 py-2 text-right font-semibold text-green-700">อนุมัติจริง (฿)</th>
                  <th className="px-4 py-2 text-right font-semibold text-red-700">ไม่อนุมัติ (฿)</th>
                  <th className="px-4 py-2 font-semibold">หมายเหตุ / เหตุผลตีคืน</th>
                </tr>
              </thead>
              <tbody>
                {auditData.items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-2 font-medium text-gray-800">{item.detail}</td>
                    <td className="px-4 py-2 text-indigo-600">{item.project}</td>
                    <td className="px-4 py-2 text-right font-mono">{(item.requested || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-4 py-2 text-center">{getStatusBadge(item.status)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-emerald-600 font-mono">{(item.approved || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-4 py-2 text-right font-semibold text-rose-600 font-mono">{(item.rejected || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-4 py-2 text-gray-500 text-[11px]">{item.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ตารางตรวจสอบหลักฐานการชำระเงิน */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-200 bg-indigo-50/40 flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <Paperclip size={14} className="text-indigo-600"/>
              ตรวจสอบหลักฐานการชำระเงินตัวจริง (Document Physical Tracking)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-gray-600">
              <thead className="text-[10px] text-gray-700 uppercase bg-slate-100/60 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 font-semibold">รหัสอ้างอิง / Tracking ID</th>
                  <th className="px-4 py-2 font-semibold">ประเภทหลักฐานการชำระเงิน</th>
                  <th className="px-4 py-2 text-center font-semibold">สถานะรับเอกสารตัวจริง</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-2 font-mono font-medium text-gray-800">{doc.ref_no}</td>
                    <td className="px-4 py-2">{doc.type}</td>
                    <td className="px-4 py-2 text-center">
                      <button 
                        type="button"
                        onClick={() => toggleOriginalStatus && toggleOriginalStatus(doc.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border ${
                          doc.originalReceived 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        {doc.originalReceived ? (
                          <><CheckSquare size={13}/> ได้รับตัวจริงแล้ว</>
                        ) : (
                          <><Square size={13}/> รอรับตัวจริง</>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
                {documents.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-gray-400">ไม่มีรายการเอกสารแนบที่ต้องการหลักฐานตัวจริง</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ตารางประวัติการบันทึกยอดใบเคลียร์สะสม */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-200 bg-slate-50/80 flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <History size={14} className="text-indigo-600" />
              ประวัติการบันทึกยอดใบเคลียร์สะสม (Clearance History Ledger)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-gray-600">
              <thead className="text-[10px] text-gray-700 uppercase bg-slate-100/60 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 font-semibold text-center">ครั้งที่</th>
                  <th className="px-4 py-2 font-semibold">วันที่</th>
                  <th className="px-4 py-2 font-semibold">เลขที่ใบเคลียร์</th>
                  <th className="px-4 py-2 font-semibold">รายการค่าใช้จ่ายที่อนุมัติ</th>
                  <th className="px-4 py-2 text-right font-semibold">VAT (฿)</th>
                  <th className="px-4 py-2 text-right font-semibold">WHT (฿)</th>
                  <th className="px-4 py-2 text-right font-semibold">ส่วนลด (฿)</th>
                  <th className="px-4 py-2 text-right font-semibold">อื่นๆ (฿)</th>
                  <th className="px-4 py-2 text-right font-semibold">รวมสุทธิ (฿)</th>
                </tr>
              </thead>
              <tbody>
                {clearanceHistory.map((hist, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-2 text-center font-bold text-gray-700">{hist.round}</td>
                    <td className="px-4 py-2">{hist.date}</td>
                    <td className="px-4 py-2 font-semibold text-indigo-600 font-mono">{hist.clr_id}</td>
                    <td className="px-4 py-2 max-w-[200px] truncate" title={hist.items}>{hist.items}</td>
                    <td className="px-4 py-2 text-right font-mono">{(hist.vat || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-4 py-2 text-right font-mono">{(hist.wht || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-4 py-2 text-right font-mono">{(hist.discount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-4 py-2 text-right font-mono">{(hist.other || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-800 font-mono">{(hist.net || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  </tr>
                ))}
                {clearanceHistory.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-gray-400">ไม่มีประวัติการบันทึกยอดสะสมสำหรับใบเบิกนี้</td>
                  </tr>
                )}
              </tbody>
              {clearanceHistory.length > 0 && (
                <tfoot className="bg-slate-50 font-bold border-t border-gray-200">
                  <tr className="text-gray-800">
                    <td colSpan={4} className="px-4 py-2.5 text-right font-bold">รวมยอดสะสม (Cumulative Total):</td>
                    <td className="px-4 py-2.5 text-right text-indigo-700 font-mono">{(historyTotals.vat || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-4 py-2.5 text-right text-indigo-700 font-mono">{(historyTotals.wht || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-4 py-2.5 text-right text-indigo-700 font-mono">{(historyTotals.discount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-4 py-2.5 text-right text-indigo-700 font-mono">{(historyTotals.other || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-700 font-mono">{(historyTotals.net || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AuditReport;
