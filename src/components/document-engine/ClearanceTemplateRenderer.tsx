import React, { useRef, useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  User, 
  Store, 
  FileCheck2, 
  LayoutDashboard,
  CheckCircle2,
  Paperclip,
  CloudLightning
} from 'lucide-react';
import { PublishedTemplate } from './useDocumentTemplates';
import { useApp } from '../../context/AppContext';

interface ClearanceTemplateRendererProps {
  template: PublishedTemplate;
  data: any;
}

export const ClearanceTemplateRenderer: React.FC<ClearanceTemplateRendererProps> = ({ template, data }) => {
  const appState: any = useApp() || {};
  
  // Normalize data to handle both types of inputs (direct Advance object or mapped data)
  const activeAdv = {
    id: data.id || data.clrNo || 'ADV-2606-XXX',
    advId: data.advId || data.id || 'ADV-2606-XXX',
    clrNo: data.clrNo || data.id || 'CLR-2606-XXX',
    empDept: data.employeeDept || data.empDept || 'แผนกโครงการ',
    empName: data.employeeName || data.empName || 'สรารัตน์ เตียวตระกูล',
    empPosition: data.empPosition || 'Interior Designer',
    projectName: data.projectName || data.project || 'KCL',
    projectFullName: data.projectFullName || data.projectName || "K'Chang Lumlukka",
    vendorName: data.vendorName || data.vendor || 'บจก. พอช แมนเนอร์',
    vendorTaxId: data.vendorTaxId || data.taxId || '0105562122416',
    vendorBranch: data.vendorBranch || 'สำนักงานใหญ่',
    docType: data.docType || 'ใบกำกับภาษี/ใบเสร็จ',
    docNo: data.docNo || 'INV-2026-00052',
    docDate: data.docDate || data.clearanceDate || '22/06/2026',
    paymentTerm: data.paymentTerm || 'โอนเงิน',
    appAmount: Number(data.advancedCash || data.appAmount || data.amount || 10000),
    clrAmount: Number(data.totals?.grandTotal || data.clrAmount || data.amount || 0),
    vatTotal: Number(data.totals?.totalVat || data.vatTotal || 0),
    whtTotal: Number(data.totals?.totalWht || data.whtTotal || 0),
    subtotal: Number(data.totals?.subtotal || data.subtotal || 0),
    discountTotal: Number(data.discountTotal || 0),
    clrs: (data.clrs && data.clrs.length > 0) ? data.clrs : (data.items && data.items.length > 0 ? data.items : []),
    receipts: data.receipts || [],
    createdAt: data.createdAt || data.date || new Date().toISOString(),
    startDate: data.startDate || '22/06/2026',
    appBySignature: data.appBySignature || null,
    appBy: data.appBy || 'นาย ณัฐวุฒิ ศรีสุวรรณ',
    reqDate: data.reqDate || '2026-06-23'
  };

  const fmt = (n?: number) => {
    if (n === undefined || isNaN(n)) return '0.00';
    return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fmtD = (s?: string | null) => {
    if (!s) return '–';
    try {
      const d = new Date(s);
      if (isNaN(d.getTime())) return s;
      return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' });
    } catch (e) {
      return s;
    }
  };

  const parseNum = (val: any): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const str = String(val).replace(/,/g, '').trim();
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  // Logic for page calculation
  const ITEMS_PER_PAGE = 5;
  const clearanceItems = (data.vaultData?.itemsSnap || activeAdv.clrs || []).map((item: any, idx: number) => ({
    id: idx + 1,
    date: item.date || activeAdv.docDate,
    clrNo: item.clrNo || item.id || activeAdv.clrNo,
    project: item.project || activeAdv.projectName,
    category: item.category || 'ทั่วไป',
    description: item.desc || item.note || item.description || '-',
    vat: fmt(parseNum(item.vat)),
    wht: fmt(parseNum(item.wht)),
    discount: fmt(parseNum(item.discount)),
    net: fmt(parseNum(item.net || item.amount || item.lineTotal || 0))
  }));

  const totalPages = Math.ceil(clearanceItems.length / ITEMS_PER_PAGE) || 1;

  // Calculate totals dynamically from items to link everything perfectly 100%
  const totalDiscountAll = data.totals?.discountTotal !== undefined 
    ? Number(data.totals.discountTotal) 
    : ((activeAdv as any).discountTotal || clearanceItems.reduce((acc: number, item: any) => acc + parseNum(item.discount), 0));
    
  const totalOtherAll = data.totals?.otherAmount !== undefined 
    ? Number(data.totals.otherAmount) 
    : ((activeAdv as any).otherAmount || 0);
    
  const otherLabelText = data.totals?.otherLabel || (activeAdv as any).otherLabel || 'ปรับปรุงยอดอื่น ๆ';

  const totalVatAll = data.totals?.totalVat !== undefined 
    ? Number(data.totals.totalVat) 
    : clearanceItems.reduce((acc: number, item: any) => acc + parseNum(item.vat), 0);
    
  const totalWhtAll = data.totals?.totalWht !== undefined 
    ? Number(data.totals.totalWht) 
    : clearanceItems.reduce((acc: number, item: any) => acc + parseNum(item.wht), 0);

  const totalNetAll = data.totals?.grandTotal !== undefined 
    ? Number(data.totals.grandTotal) 
    : (clearanceItems.reduce((acc: number, item: any) => acc + parseNum(item.net || item.amount), 0) + (data.globalVatType === 'exclude' ? totalVatAll : 0) - totalWhtAll - totalDiscountAll + totalOtherAll);
  
  const advAmount = activeAdv.appAmount;
  const balAmount = advAmount - totalNetAll;

  // Project Summary Calculation
  const projectSummary = React.useMemo(() => {
    const summary: Record<string, { name: string, total: number, fullName: string }> = {};
    clearanceItems.forEach((item: any) => {
      const pCode = item.project || 'OTHER';
      if (!summary[pCode]) {
        const pNames: Record<string, string> = {
          'KCL': "K'Chang Lumlukka",
          'WEL': 'Wellness Avenue',
          'GRE': 'Green Living',
          'URB': 'Urban Work Hub',
          'RIV': 'Riverfront'
        };
        summary[pCode] = { name: pCode, total: 0, fullName: pNames[pCode] || 'Other Project' };
      }
      summary[pCode].total += parseNum(item.net);
    });
    return summary;
  }, [clearanceItems]);

  // Evidence files logic
  const evidenceFiles = (data.vaultData?.receiptsSnap || activeAdv.receipts || []).map((r: any, idx: number) => ({
    id: idx + 1,
    type: r.docType || 'RECEIPT',
    label: r.vendor || r.desc || r.description || 'หลักฐานการชำระเงิน',
    name: r.fileName || `${activeAdv.clrNo}-EV-${idx + 1}`
  })).slice(0, 10);

  // ResizeObserver for elegant responsive scale fitting 
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!containerRef.current) return;
    
    let active = true;
    const handleResize = () => {
      if (!active) return;
      const parent = containerRef.current?.parentElement;
      if (parent) {
        const parentWidth = parent.clientWidth;
        // 210mm in A4 is exactly 794px at 96 DPI. Let's scale if container is narrower than A4 plus margins.
        requestAnimationFrame(() => {
          if (!active) return;
          if (parentWidth < 840) {
            const newScale = (parentWidth - 24) / 794;
            setScale(Math.max(0.15, newScale));
          } else {
            setScale(1);
          }
        });
      }
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    const parent = containerRef.current.parentElement;
    if (parent) {
      observer.observe(parent);
    }
    window.addEventListener('resize', handleResize);
    return () => {
      active = false;
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const pageHeight = 1123; // 297mm in pixels at 96 DPI
  const gap = 24; // gap-6 matches 24px spacing between pages
  const totalUnscaledHeight = (totalPages * pageHeight) + ((totalPages - 1) * gap);
  const scaledHeight = totalUnscaledHeight * scale;

  return (
    <div 
      className="w-full flex justify-center bg-gray-200/50 py-4 print:bg-white print:py-0 overflow-hidden" 
      style={{ 
        fontFamily: "'Noto Sans Thai', sans-serif",
        height: scale === 1 ? 'auto' : `${scaledHeight + 32}px`
      }}
    >
      {/* Import Noto Sans Thai Font and Print Overrides */}
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap');
          @media print {
            body { background: white !important; }
            .no-print { display: none !important; }
            .a4-print-container {
              transform: none !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              width: auto !important;
              height: auto !important;
            }
            .a4-page {
              transform: none !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              width: 210mm !important;
              height: 297mm !important;
              page-break-after: always !important;
              page-break-inside: avoid !important;
            }
          }
        `}
      </style>

      {/* Scaled Responsive Page Container */}
      <div 
        ref={containerRef}
        className="a4-print-container origin-top transition-all duration-200 flex flex-col gap-6"
        style={{ 
          transform: `scale(${scale})`,
          width: '794px',
          height: `${totalUnscaledHeight}px`
        }}
      >
        {Array.from({ length: totalPages }).map((_, pageIndex) => {
          const startIndex = pageIndex * ITEMS_PER_PAGE;
          const currentItems = clearanceItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
          const currentPage = pageIndex + 1;
          
          const emptyRowsCount = ITEMS_PER_PAGE - currentItems.length;
          const emptyRows = Array.from({ length: emptyRowsCount });

          return (
            <div 
              key={pageIndex}
              className="a4-page bg-white shadow-2xl relative mx-auto box-border flex flex-col justify-between overflow-hidden shrink-0 border border-slate-250 print:border-none print:shadow-none print:m-0"
              style={{ width: '210mm', height: '297mm', padding: '8mm' }}
            >
              {/* 1. Header Section */}
              <div>
                <div className="flex justify-between items-start border-b-2 border-blue-200 pb-2">
                  <div className="flex-1 pr-2">
                    <h1 className="text-xl font-bold text-blue-900 mb-0.5">ใบเคลียร์ยอด (Advance Clearance Report)</h1>
                    <h2 className="text-xs text-blue-800 font-medium mb-0.5">บันทึกรายการเคลียร์เงินทดรองจ่าย</h2>
                    <p className="text-[9px] text-gray-500">
                      ระยะเวลาที่ใช้ในการเคลียร์ยอด : {activeAdv.reqDate ? Math.max(0, Math.round((new Date().getTime() - new Date(activeAdv.reqDate).getTime()) / (1000 * 3600 * 24))) : 0} วัน
                    </p>
                  </div>
                  <div className="text-right flex items-center justify-end">
                    <img 
                      src="https://s13.gifyu.com/images/bd3qB.png" 
                      alt="Logo" 
                      className="h-10 w-auto object-contain"
                    />
                  </div>
                </div>

                {/* 2. Reference Numbers */}
                <div className="flex gap-3 my-2.5">
                  <div className="flex-1 flex items-center border border-blue-100 rounded-lg p-2 bg-[#f4f7fa]">
                    <div className="text-blue-800 mr-2">
                      <FileText size={20} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-[8px] text-blue-900 mb-0.5 font-medium">อ้างอิงใบเบิกเงินทดรองจ่ายเดียวกัน</p>
                      <p className="text-xs font-bold text-blue-900">{activeAdv.advId}</p>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center border border-blue-100 rounded-lg p-2 bg-[#f4f7fa]">
                    <div className="text-blue-800 mr-2">
                      <Search size={20} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-[8px] text-blue-900 mb-0.5 font-medium">เลขที่ใบเคลียร์ยอดเดียวกันสำหรับทุกรายการ</p>
                      <p className="text-xs font-bold text-blue-900">{activeAdv.clrNo}</p>
                    </div>
                  </div>
                </div>

                {/* 3. Info Cards */}
                <div className="grid grid-cols-3 gap-2.5 mb-2.5">
                  <div className="border rounded-lg p-2 border-gray-200 bg-white shadow-xs">
                    <div className="flex items-center gap-1 mb-1.5 text-blue-900">
                      <User size={12} />
                      <h3 className="font-bold text-[10px]">ข้อมูลผู้เบิก <span className="text-[7px] font-normal">(REQUESTER)</span></h3>
                    </div>
                    <div className="space-y-1 text-[9px]">
                      <div className="grid grid-cols-3"><span className="text-gray-500">ผู้เบิก</span><span className="col-span-2 text-gray-800 font-medium truncate">{activeAdv.empName}</span></div>
                      <div className="grid grid-cols-3"><span className="text-gray-500">ตำแหน่ง</span><span className="col-span-2 text-gray-800 truncate">{activeAdv.empPosition}</span></div>
                      <div className="grid grid-cols-3"><span className="text-gray-500">วันที่เบิก</span><span className="col-span-2 text-gray-800">{fmtD(activeAdv.reqDate)}</span></div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-2 border-gray-200 bg-white shadow-xs">
                    <div className="flex items-center gap-1 mb-1.5 text-blue-900">
                      <Store size={12} />
                      <h3 className="font-bold text-[10px]">ข้อมูลผู้ขาย <span className="text-[7px] font-normal">(VENDOR)</span></h3>
                    </div>
                    <div className="space-y-1 text-[9px]">
                      <div className="grid grid-cols-3"><span className="text-gray-500">ชื่อร้าน</span><span className="col-span-2 text-gray-800 truncate" title={activeAdv.vendorName}>{activeAdv.vendorName}</span></div>
                      <div className="grid grid-cols-3"><span className="text-gray-500">ผู้เสียภาษี</span><span className="col-span-2 text-gray-800 font-mono text-[8px]">{activeAdv.vendorTaxId}</span></div>
                      <div className="grid grid-cols-3"><span className="text-gray-500">สาขา</span><span className="col-span-2 text-gray-800 truncate">{activeAdv.vendorBranch}</span></div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-2 border-gray-200 bg-white shadow-xs">
                    <div className="flex items-center gap-1 mb-1.5 text-blue-900">
                      <FileCheck2 size={12} />
                      <h3 className="font-bold text-[10px]">ข้อมูลเอกสาร <span className="text-[7px] font-normal">(DOCUMENT)</span></h3>
                    </div>
                    <div className="space-y-1 text-[9px]">
                      <div className="grid grid-cols-3"><span className="text-gray-500">ประเภท</span><span className="col-span-2 text-gray-800 leading-tight truncate">{activeAdv.docType}</span></div>
                      <div className="grid grid-cols-3"><span className="text-gray-500">เลขที่</span><span className="col-span-2 text-gray-800 font-mono text-[8px] truncate">{activeAdv.docNo}</span></div>
                      <div className="grid grid-cols-3"><span className="text-gray-500">ชำระด้วย</span><span className="col-span-2 text-gray-800 truncate">{activeAdv.paymentTerm}</span></div>
                    </div>
                  </div>
                </div>

                {/* 4. Project Summary */}
                <div className="border rounded-lg p-2 border-gray-200 mb-2.5 bg-white shadow-xs">
                  <div className="flex items-center gap-1 mb-1 text-blue-900">
                    <LayoutDashboard size={12} />
                    <h3 className="font-bold text-[10px]">สรุปการใช้จ่ายรายโครงการที่ชำระรวมกัน <span className="text-[7px] font-normal">(PROJECT SUMMARY)</span></h3>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-y-1 px-1">
                    {Object.entries(projectSummary).map(([pCode, pData]: [string, any], pIdx: number) => (
                      <React.Fragment key={`${pCode}-${pIdx}`}>
                        <div className="flex items-center gap-1.5">
                          <div className="bg-[#1e3a8a] text-white text-[8px] font-bold py-0.5 px-1.5 rounded">{pCode}</div>
                          <div>
                            <p className="text-[7px] text-blue-800 leading-none mb-0.5">{pData.fullName}</p>
                            <p className="font-bold text-[10px] text-blue-900 leading-none">{pData.total.toLocaleString()} <span className="text-[7px] font-normal text-gray-500">บาท</span></p>
                          </div>
                        </div>
                        <div className="h-4 w-px bg-gray-200"></div>
                      </React.Fragment>
                    ))}
                    <div className="text-right">
                      <p className="text-[7px] text-gray-500 leading-none">ยอดรวมทั้งหมด</p>
                      <p className="font-bold text-[11px] text-blue-900 leading-none">{totalNetAll.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[7px] font-normal text-gray-500">บาท</span></p>
                    </div>
                  </div>
                </div>

                {/* 5. Clearance Table */}
                <div className="border rounded-lg overflow-hidden border-gray-200 mb-2 shadow-xs">
                  <div className="bg-white p-2 pb-1 flex items-center justify-between text-blue-900 border-b border-gray-100">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      <h3 className="font-bold text-[10px]">รายละเอียดการเคลียร์ยอด (หน้าที่ {currentPage}/{totalPages})</h3>
                    </div>
                  </div>
                  <table className="w-full text-[8px] table-fixed border-collapse">
                    <thead className="bg-[#4b6a9c] text-white">
                      <tr>
                        <th className="py-1 px-1 font-medium w-[5%] text-center">ลำดับ</th>
                        <th className="py-1 px-1 font-medium w-[10%] text-center">วันที่</th>
                        <th className="py-1 px-1 font-medium w-[14%] text-center">CLR No.</th>
                        <th className="py-1 px-1 font-medium w-[8%] text-center">โครงการ</th>
                        <th className="py-1 px-1 font-medium w-[11%] text-left">หมวดหมู่</th>
                        <th className="py-1 px-1 font-medium text-left w-[22%]">รายการสินค้า / บริการ</th>
                        <th className="py-1 px-1 font-medium text-right w-[6%]">VAT</th>
                        <th className="py-1 px-1 font-medium text-right w-[5%]">WHT</th>
                        <th className="py-1 px-1 font-medium text-right w-[5%]">ส่วนลด</th>
                        <th className="py-1 px-2 font-medium text-right w-[9%]">รวมสุทธิ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((item, idx) => (
                        <tr key={`${item.id}-${idx}`} className="bg-white hover:bg-slate-50 border-b border-gray-100 last:border-0">
                          <td className="py-1.5 px-1 text-center text-gray-600">{startIndex + idx + 1}</td>
                          <td className="py-1.5 px-1 text-center text-blue-800">{fmtD(item.date)}</td>
                          <td className="py-1.5 px-1 text-center text-gray-600 font-bold">{item.clrNo}</td>
                          <td className="py-1.5 px-1 text-center text-gray-600 font-bold text-blue-900">{item.project}</td>
                          <td className="py-1.5 px-1 text-left text-gray-600 truncate">{item.category}</td>
                          <td className="py-1.5 px-1 text-left text-gray-600 break-words text-[7px] leading-tight pr-1">{item.description}</td>
                          <td className="py-1.5 px-1 text-right text-gray-600 font-mono">{item.vat}</td>
                          <td className="py-1.5 px-1 text-right text-gray-600 font-mono">{item.wht}</td>
                          <td className="py-1.5 px-1 text-right text-red-500 font-semibold font-mono">{item.discount !== '0.00' ? `-${item.discount}` : '0.00'}</td>
                          <td className="py-1.5 px-2 text-right text-gray-800 font-bold font-mono">{item.net}</td>
                        </tr>
                      ))}
                      {emptyRows.map((_, idx) => (
                        <tr key={`empty-${idx}`} className="bg-white border-b border-gray-50 last:border-0">
                          <td colSpan={10} className="py-1.5 px-1 text-transparent">-</td>
                        </tr>
                      ))}
                    </tbody>
                    {pageIndex === totalPages - 1 && (
                      <tfoot className="bg-[#eef2f6]">
                        {totalDiscountAll > 0 && (
                          <tr className="bg-white border-b border-gray-100 font-sans text-[8px]">
                            <td colSpan={6} className="py-1 px-2 text-right text-gray-500 font-semibold border-t border-gray-200">
                              ส่วนลดท้ายบิล (Discount):
                            </td>
                            <td className="py-1 px-1 text-right text-gray-400 font-mono border-t border-gray-200">0.00</td>
                            <td className="py-1 px-1 text-right text-gray-400 font-mono border-t border-gray-200">0.00</td>
                            <td className="py-1 px-1 text-right text-red-600 font-semibold font-mono border-t border-gray-200">-{fmt(totalDiscountAll)}</td>
                            <td className="py-1 px-2 text-right text-red-600 font-semibold font-mono border-t border-gray-200">-{fmt(totalDiscountAll)}</td>
                          </tr>
                        )}
                        {totalOtherAll !== 0 && (
                          <tr className="bg-white border-b border-gray-100 font-sans text-[8px]">
                            <td colSpan={6} className="py-1 px-2 text-right text-gray-500 font-semibold border-t border-gray-100">
                              ปรับปรุงยอด: {otherLabelText || 'ปรับปรุงยอดอื่น ๆ'} ({totalOtherAll > 0 ? 'บวกเพิ่ม' : 'หักลด'}):
                            </td>
                            <td className="py-1 px-1 text-right text-gray-400 font-mono border-t border-gray-100">0.00</td>
                            <td className="py-1 px-1 text-right text-gray-400 font-mono border-t border-gray-100">0.00</td>
                            <td className="py-1 px-1 text-right text-gray-400 font-mono border-t border-gray-100">0.00</td>
                            <td className={`py-1 px-2 text-right font-bold font-mono border-t border-gray-100 ${totalOtherAll > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {totalOtherAll > 0 ? '+' : ''}{fmt(totalOtherAll)}
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td colSpan={6} className="py-2 px-2 text-center font-bold text-blue-900 border-t border-gray-300 text-[11px]">
                            รวมผลการเคลียร์ยอดทั้งหมด (รวมสุทธิเอกสาร)
                          </td>
                          <td className="py-2 px-1 text-right border-t border-gray-300 font-bold text-blue-900 text-[10px] font-mono">{fmt(totalVatAll)}</td>
                          <td className="py-2 px-1 text-right border-t border-gray-300 font-bold text-blue-900 text-[10px] font-mono">{fmt(totalWhtAll)}</td>
                          <td className="py-2 px-1 text-right border-t border-gray-300 font-bold text-red-600 text-[10px] font-mono">-{fmt(totalDiscountAll)}</td>
                          <td className="py-2 px-2 text-right border-t border-gray-300 font-bold text-blue-900 text-[10px] font-mono">
                            {fmt(totalNetAll)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* 6. Remarks Section */}
              <div className="border border-slate-200 rounded-lg p-2 bg-slate-50/50 mb-2">
                <p className="text-[9px] font-bold text-blue-900 mb-1">หมายเหตุการทำรายการ (REMARKS)</p>
                <p className="text-[8px] text-slate-600 leading-relaxed italic">
                  * เอกสารฉบับนี้จัดทำขึ้นโดยการตรวจสอบจากฝ่ายบัญชีและการตรวจสอบผ่านระบบ AI-OCR อ้างอิงรายการใบเบิกเลขที่ {activeAdv.advId} 
                  ข้อมูลสอดคล้องกับหลักฐานที่แนบในระบบ Google Drive ทั้งสิ้น
                </p>
              </div>

              {/* 7. Evidence Files Section */}
              {pageIndex === 0 ? (
                <div className="mb-2.5">
                  <div className="flex items-center justify-between border-b border-blue-200 pb-1 mb-1.5">
                    <h3 className="font-bold text-[10px] text-blue-900 flex items-center gap-1">
                      <Paperclip size={12} className="text-blue-700" />
                      หลักฐานการชำระเงินที่จัดเก็บใน Google Drive
                    </h3>
                    <span className="text-[7px] text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <CloudLightning size={8} /> Auto Synced to Google Drive
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 max-h-[85px] overflow-y-auto pr-1">
                    {evidenceFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between bg-[#f8fafc] p-1.5 rounded border border-blue-100 text-[8px] h-[26px]">
                        <div className="truncate max-w-[130px]" title={file.label}><span className="font-bold text-slate-500">[{file.type.toUpperCase()}]</span> {file.label}</div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[7.5px] text-blue-700 bg-blue-50 px-1 py-0.5 rounded font-semibold truncate max-w-[150px] font-mono">{file.name}</span>
                          <span className="text-green-600 font-bold">✓</span>
                        </div>
                      </div>
                    ))}
                    {evidenceFiles.length === 0 && (
                      <p className="col-span-2 text-center text-gray-400 py-2 italic text-[8px]">ไม่มีไฟล์หลักฐานแนบ</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-0 mb-0"></div>
              )}

              {/* 8. Financial Summary */}
              <div className="border-t border-slate-200 pt-2">
                <h3 className="font-bold text-[9px] text-blue-900 mb-1.5">สรุปยอดบัญชีการเงินรวม <span className="text-[7px] font-normal">(FINANCIAL SUMMARY)</span></h3>
                <div className="flex gap-2.5">
                  <div className="flex-1 grid grid-cols-4 gap-1">
                    <div className="bg-[#f8fafc] border border-gray-200 rounded p-1 text-center flex flex-col justify-center">
                      <p className="text-[7px] text-gray-500 leading-tight">ยอดตามใบเบิก</p>
                      <p className="font-bold text-blue-900 text-[10px] font-mono">{fmt(advAmount)}</p>
                    </div>
                    <div className="bg-[#f8fafc] border border-gray-200 rounded p-1 text-center flex flex-col justify-center">
                      <p className="text-[7px] text-gray-500 leading-tight">ยอดเบิกสุทธิ</p>
                      <p className="font-bold text-blue-900 text-[10px] font-mono">{fmt(advAmount)}</p>
                    </div>
                    <div className="bg-[#f8fafc] border border-gray-200 rounded p-1 text-center flex flex-col justify-center">
                      <p className="text-[7px] text-gray-500 leading-tight">สินค้า (ถอด VAT)</p>
                      <p className="font-bold text-blue-900 text-[10px] font-mono">{fmt(totalNetAll - totalVatAll)}</p>
                    </div>
                    <div className="bg-[#f8fafc] border border-gray-200 rounded p-1 text-center flex flex-col justify-center">
                      <p className="text-[7px] text-gray-500 leading-tight">VAT สะสมรวม</p>
                      <p className="font-bold text-blue-900 text-[10px] font-mono">{fmt(totalVatAll)}</p>
                    </div>
                    <div className="bg-[#f8fafc] border border-gray-200 rounded p-1 text-center flex flex-col justify-center">
                      <p className="text-[7px] text-gray-500 leading-tight">ส่วนลดรวม</p>
                      <p className="font-bold text-blue-900 text-[10px] font-mono">{fmt(totalDiscountAll)}</p>
                    </div>
                    <div className="bg-[#f8fafc] border border-gray-200 rounded p-1 text-center flex flex-col justify-center">
                      <p className="text-[7px] text-gray-500 leading-tight">หัก ณ ที่จ่าย (WHT)</p>
                      <p className="font-bold text-blue-900 text-[10px] font-mono">{fmt(totalWhtAll)}</p>
                    </div>
                    <div className="bg-[#f8fafc] border border-gray-200 rounded p-1 text-center flex flex-col justify-center">
                      <p className="text-[7px] text-gray-500 leading-none truncate" title={otherLabelText}>{otherLabelText || 'อื่นๆ'}</p>
                      <p className={`font-bold text-[10px] font-mono ${totalOtherAll > 0 ? 'text-emerald-600' : totalOtherAll < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                        {totalOtherAll > 0 ? '+' : ''}{fmt(totalOtherAll)}
                      </p>
                    </div>
                    <div className="bg-[#eef2f6] border border-blue-200 rounded p-1 text-center flex flex-col justify-center">
                      <p className="text-[7px] text-blue-800 leading-tight font-medium">ยอดรวมสุทธิในเอกสารนี้</p>
                      <p className="font-bold text-blue-900 text-[10px] font-mono">{fmt(totalNetAll)}</p>
                    </div>
                  </div>
                  <div className="w-[30%] border-[1.5px] border-blue-900 rounded-lg p-1.5 bg-[#fcfdff] flex flex-col justify-center shrink-0">
                    <h3 className="font-bold text-blue-900 text-center text-[9px] mb-1">สรุปผลการเคลียร์ยอด <span className="text-[6px] font-normal">(RESULT)</span></h3>
                    <div className="text-center mb-1">
                      <p className="text-[8px] text-gray-500 leading-none font-medium">ยอดเบิกทั้งหมด</p>
                      <p className="font-bold text-xs text-blue-900 leading-tight font-mono">{fmt(advAmount)} <span className="text-[7px] font-normal text-gray-500 font-sans">บาท</span></p>
                    </div>
                    <div className="border-b border-dashed border-gray-200 w-3/4 mx-auto mb-1"></div>
                    <div className="text-center mb-1">
                      <p className="text-[8px] text-gray-500 leading-none font-medium">ยอดเคลียร์รวม</p>
                      <p className="font-bold text-xs text-blue-900 leading-tight font-mono">{fmt(totalNetAll)} <span className="text-[7px] font-normal text-gray-500 font-sans">บาท</span></p>
                    </div>
                    <div className="border-b border-dashed border-gray-300 w-3/4 mx-auto mb-1"></div>
                    <div className="text-center">
                      <p className="text-[7px] text-gray-500 leading-none mb-0.5 font-semibold">
                        ผลต่างโดยใช้ยอดเบิกทั้งหมดลบยอดเคลียร์รวม
                      </p>
                      <p className={`font-bold text-xs font-mono leading-none ${balAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {fmt(Math.abs(balAmount))} <span className="text-[7px] font-normal text-gray-500 font-sans">บาท</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 9. Signatures Section */}
              <div className="mt-3 pt-1.5 border-t border-gray-100 shrink-0">
                <div className="grid grid-cols-3 gap-3 text-center text-[8px] mb-1.5">
                  <div>
                    <div className="flex justify-center text-blue-800 mb-0.5"><User size={12} /></div>
                    <div className="border-b border-dotted border-gray-400 mx-5 mb-0.5"></div>
                    <p className="font-bold text-blue-900 text-[9px] leading-tight">ผู้เบิก</p>
                    <p className="text-[8px] text-gray-600 mt-0.5 truncate font-sans">{activeAdv.empName}</p>
                    <div className="border-b border-dotted border-gray-300 mx-8 mt-1 mt-0.5"></div>
                    <p className="text-[7px] text-gray-400">วันที่ {fmtD(new Date().toISOString())}</p>
                  </div>
                  <div>
                    <div className="flex justify-center text-blue-800 mb-0.5"><FileCheck2 size={12} /></div>
                    <div className="border-b border-dotted border-gray-400 mx-5 mb-0.5"></div>
                    <p className="font-bold text-blue-900 text-[9px] leading-tight">ฝ่ายบัญชี</p>
                    <p className="text-[8px] text-gray-600 mt-0.5 font-sans">น.ส. พิชญาภา วงศ์ศิริ</p>
                    <div className="border-b border-dotted border-gray-300 mx-8 mt-1 mt-0.5"></div>
                    <p className="text-[7px] text-gray-400">วันที่ {fmtD(new Date().toISOString())}</p>
                  </div>
                  <div>
                    <div className="flex justify-center text-blue-800 mb-0.5"><User size={12} /></div>
                    <div className="h-4 flex items-center justify-center">
                      {activeAdv.appBySignature ? (
                        <img src={activeAdv.appBySignature} alt="sig" className="max-h-4" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="border-b border-dotted border-gray-400 w-full mx-5"></div>
                      )}
                    </div>
                    <p className="font-bold text-blue-900 text-[9px] leading-tight">ผู้บริหาร / ผู้อนุมัติ</p>
                    <p className="text-[8px] text-gray-600 mt-0.5 font-sans">{activeAdv.appBy}</p>
                    <div className="border-b border-dotted border-gray-300 mx-8 mt-1 mt-0.5"></div>
                    <p className="text-[7px] text-gray-400">วันที่ {fmtD(new Date().toISOString())}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center text-[7px] text-gray-400 pt-1 border-t border-gray-200">
                  <p><span className="font-bold text-gray-500">หมายเหตุ:</span> เอกสารนี้จัดทำในระบบดิจิทัล (NAAS v2) เชื่อมโยง ISO 27001</p>
                  <p>พิมพ์วันที่: {new Date().toLocaleDateString('th-TH')} {new Date().toLocaleTimeString('th-TH')}</p>
                  <p className="font-bold text-slate-600">POSH MANOR CO., LTD. (หน้า {currentPage} / {totalPages})</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
