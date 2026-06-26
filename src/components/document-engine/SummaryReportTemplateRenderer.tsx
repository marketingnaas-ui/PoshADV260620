import React from 'react';

interface SummaryReportTemplateRendererProps {
  template: any;
  data: any;
}

export const SummaryReportTemplateRenderer: React.FC<SummaryReportTemplateRendererProps> = ({ template, data }) => {
  const reportData = data || {};
  const clrs = reportData.clrs || [];
  
  // Calculate totals
  const totalAmt = clrs.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);
  const totalVat = clrs.reduce((sum: number, c: any) => sum + (Number(c.vat) || Number(c.vatAmount) || 0), 0);
  const totalWht = clrs.reduce((sum: number, c: any) => sum + (Number(c.wht) || Number(c.whtAmount) || 0), 0);
  const totalDiscount = clrs.reduce((sum: number, c: any) => sum + (Number(c.discount) || Number(c.discountAmount) || 0), 0);
  const advTotal = Number(reportData.appAmount) || 0;
  const balance = advTotal - totalAmt;

  const fmt = (num: any) => {
    const n = Number(num);
    return isNaN(n) ? '0.00' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      // Handle DD/MM/YY or ISO
      if (dateStr.includes('/')) return dateStr;
      const d = new Date(dateStr);
      return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="bg-gray-100 p-0 flex justify-center text-gray-800 print:bg-white no-print:p-8" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
      {/* Import Noto Sans Thai Font */}
      <style>
        {`
          @media print {
            @page {
              size: A4 landscape;
              margin: 0;
            }
            body {
              -webkit-print-color-adjust: exact;
            }
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      {/* A4 Landscape Container */}
      <div 
        className="bg-white shadow-lg relative mx-auto box-border flex flex-col print:shadow-none print:m-0"
        style={{ width: '297mm', minHeight: '210mm', padding: '12mm' }}
      >
        
        {/* Header Section */}
        <div className="flex justify-between items-start border-b-2 border-purple-200 pb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#1b1464] mb-1">
              รายงานสรุปการใช้เงินทดรองจ่าย
            </h1>
            <h2 className="text-sm font-semibold text-[#1b1464] mb-2">
              (Advance Utilization Summary Report)
            </h2>
            <p className="text-xs text-gray-600 mb-4">
              สรุปผลการเคลียร์เงินทดรองจ่ายทั้งหมดภายใต้เลขที่ใบเบิกเดียวกัน
            </p>
            
            {/* Reference Badges */}
            <div className="flex gap-4">
              <div className="flex items-center border border-purple-200 rounded-lg px-4 py-2 bg-purple-50/30">
                <div className="text-purple-600 mr-3">
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">อ้างอิงใบเบิกเงินทดรองจ่าย</div>
                  <div className="text-sm font-bold text-[#392e8a]">{reportData.id || '-'}</div>
                </div>
              </div>
              <div className="flex items-center border border-purple-200 rounded-lg px-4 py-2 bg-purple-50/30">
                <div className="text-purple-600 mr-3">
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
                  </svg>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">เลขที่รายงาน (SAV)</div>
                  <div className="text-sm font-bold text-[#392e8a]">{reportData.reportNo || '-'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Logo & Checkboxes */}
          <div className="w-[300px]">
            <div className="text-right mb-4">
              <span className="text-xl font-serif tracking-widest text-gray-800">[ P O S H ]</span>
              <div className="text-[8px] tracking-[0.3em] text-gray-400 mt-1">M A N O R</div>
            </div>
            <div className="border border-purple-100 rounded-lg p-3 bg-white space-y-2">
              <div className="flex items-center space-x-2 text-[10px] text-gray-700">
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${balance < 0 ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-300'}`}>
                  {balance < 0 && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5" /></svg>}
                </div>
                <span>พนักงานคืนยอดที่เหลือให้ทางบริษัทแล้ว</span>
              </div>
              <div className="flex items-center space-x-2 text-[10px] text-gray-700">
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${balance > 0 ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-300'}`}>
                  {balance > 0 && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5" /></svg>}
                </div>
                <span>บริษัทจ่ายเพิ่มให้พนักงานแล้ว</span>
              </div>
              <div className="flex items-center space-x-2 text-[10px] text-gray-700">
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${balance === 0 ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-300'}`}>
                  {balance === 0 && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5" /></svg>}
                </div>
                <span>ยอดเคลียร์ค่าใช้จ่ายพอดีกับยอดเบิก</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area: Left & Right Columns */}
        <div className="grid grid-cols-12 gap-2 mt-2 flex-1">
          
          {/* --- LEFT COLUMN --- */}
          <div className="col-span-7 flex flex-col gap-2">
            
            {/* Employee & Project Info */}
            <div className="border border-purple-100 rounded-xl px-3 pt-3 pb-2 bg-white shadow-sm flex flex-col h-fit text-left">
              <div className="grid grid-cols-2 gap-3 text-xs">
                
                {/* Left Column Data */}
                <div className="grid grid-cols-[90px_1fr] gap-y-2 items-start">
                  <span className="font-bold text-[#1b1464] whitespace-nowrap">พนักงานผู้เบิก</span>
                  <span className="text-gray-700 line-clamp-2">{reportData.employeeName || '-'}</span>
                  
                  <span className="font-bold text-[#1b1464] whitespace-nowrap">แผนก</span>
                  <span className="text-gray-700 line-clamp-2">{reportData.employeeDept || '-'}</span>
                  
                  <span className="font-bold text-[#1b1464] whitespace-nowrap">โครงการ</span>
                  <div className="text-gray-700 leading-tight line-clamp-2">
                    <div>{reportData.projectName || '-'}</div>
                  </div>
                  
                  <span className="font-bold text-[#1b1464] whitespace-nowrap">หมายเหตุ</span>
                  <span className="text-gray-700 line-clamp-2">{reportData.note || '-'}</span>
                </div>
                
                {/* Right Column Data */}
                <div className="grid grid-cols-[135px_1fr] gap-y-3 items-center">
                  <span className="font-bold text-[#1b1464] whitespace-nowrap">วันที่เริ่มเบิก</span>
                  <span className="text-gray-700 whitespace-nowrap">{formatDate(reportData.startDate || reportData.reqDate)}</span>
                  
                  <span className="font-bold text-[#1b1464] whitespace-nowrap">วันที่สรุปรายงาน</span>
                  <span className="text-gray-700 whitespace-nowrap">{formatDate(reportData.reportDate)}</span>
                  
                  <span className="font-bold text-[#1b1464] whitespace-nowrap">จำนวนครั้งที่เคลียร์</span>
                  <span className="text-gray-700 whitespace-nowrap">{clrs.length} ครั้ง</span>
                  
                  <span className="font-bold text-[#1b1464] whitespace-nowrap">สถานะ:</span>
                  <div className="flex items-center whitespace-nowrap">
                    <span className="bg-gray-600 text-white px-3 py-1 rounded-full text-[10px] inline-block">
                      {reportData.status === 'CLOSED' ? 'ปิดยอด' : reportData.status || '-'}
                    </span>
                  </div>
                </div>

              </div>
              
              <div className="mt-2 pt-2 border-t border-gray-100 flex justify-around text-[10px] font-bold text-[#1b1464]">
                <span>{reportData.projCode ? `${reportData.projCode} = ${fmt(totalAmt)}` : ''}</span>
              </div>
            </div>

            {/* Table History */}
            <div className="border border-purple-100 rounded-xl p-3 bg-white shadow-sm overflow-hidden flex flex-col flex-1 text-left">
              <h3 className="text-sm font-bold text-[#392e8a] mb-2">ประวัติการเคลียร์ยอดทั้งหมด</h3>
              <div className="flex-1 overflow-hidden flex flex-col justify-between">
                <table className="w-full text-[9px] text-center border-collapse">
                  <thead>
                    <tr className="text-[#1b1464] border-b border-gray-200">
                      <th className="pb-2 font-semibold whitespace-nowrap">ครั้งที่</th>
                      <th className="pb-2 font-semibold whitespace-nowrap">วันที่</th>
                      <th className="pb-2 font-semibold whitespace-nowrap">CLR No.</th>
                      <th className="pb-2 font-semibold text-left">รายการสินค้า / บริการ</th>
                      <th className="pb-2 font-semibold text-right whitespace-nowrap">VAT</th>
                      <th className="pb-2 font-semibold text-right leading-tight whitespace-nowrap">ภาษี ณ ที่จ่าย<br/>(WHT)</th>
                      <th className="pb-2 font-semibold text-right whitespace-nowrap">ส่วนลด</th>
                      <th className="pb-2 font-semibold text-right whitespace-nowrap">รวมสุทธิ</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    {clrs.map((c: any, i: number) => (
                      <tr key={`${c.id}-${i}`} className="border-b border-gray-100">
                        <td className="py-2">{i + 1}</td>
                        <td>{formatDate(c.date)}</td>
                        <td>{c.id || c.clrNo}</td>
                        <td className="text-left font-sans">{c.note || c.description}</td>
                        <td className="text-right">{fmt(c.vat)}</td>
                        <td className="text-right">{fmt(c.wht)}</td>
                        <td className="text-right">{fmt(c.discount)}</td>
                        <td className="text-right">{fmt(c.amount)}</td>
                      </tr>
                    ))}
                    {/* Fill empty rows to maintain layout if few items */}
                    {[...Array(Math.max(0, 5 - clrs.length))].map((_, i) => (
                      <tr key={'empty-' + i} className="border-b border-gray-100 h-8">
                        <td colSpan={8}></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Footer attached to the bottom of the table container */}
                <table className="w-full text-[9px] text-center mt-auto border-collapse">
                  <tfoot>
                    <tr className="text-[#392e8a] font-bold bg-purple-50/50">
                      <td className="py-2 text-center rounded-bl-lg w-[40%]">รวมทั้งสิ้น</td>
                      <td className="text-right w-[10%]"></td> 
                      <td className="text-right w-[10%]"></td>
                      <td className="text-right w-[10%]">{fmt(totalVat)}</td>
                      <td className="text-right w-[10%]">{fmt(totalWht)}</td>
                      <td className="text-right w-[10%]">{fmt(totalDiscount)}</td>
                      <td className="text-right rounded-br-lg pr-2 w-[10%]">{fmt(totalAmt)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

          </div>

          {/* --- RIGHT COLUMN --- */}
          <div className="col-span-5 flex flex-col gap-2">
            
            {/* Advance Accumulation Summary */}
            <div className="border border-purple-100 rounded-xl p-3 bg-white shadow-sm flex flex-col h-fit text-left">
              <h3 className="text-sm font-bold text-[#392e8a] mb-2">สรุปยอดการใช้เงินทดรองจ่ายสะสม</h3>
              <div className="grid grid-cols-2 gap-2 text-xs flex-1">
                <div className="bg-[#f8fafc] border border-gray-200 rounded p-2 flex flex-col justify-center">
                  <div className="text-[10px] text-gray-600 mb-1 whitespace-nowrap"><span className="text-purple-400 mr-1">🛒</span>ยอดรวมค่าสินค้า/บริการ</div>
                  <div className="font-bold text-[#1b1464] text-right text-sm">{fmt(totalAmt - totalVat)}</div>
                </div>
                <div className="bg-[#f8fafc] border border-gray-200 rounded p-2 flex flex-col justify-center">
                  <div className="text-[10px] text-gray-600 mb-1 whitespace-nowrap"><span className="text-purple-400 mr-1">%</span>VAT สะสม</div>
                  <div className="font-bold text-[#1b1464] text-right text-sm">{fmt(totalVat)}</div>
                </div>
                <div className="bg-[#f8fafc] border border-gray-200 rounded p-2 flex flex-col justify-center">
                  <div className="text-[10px] text-gray-600 mb-1 whitespace-nowrap"><span className="text-purple-400 mr-1">📄</span>หัก ณ ที่จ่ายรวม</div>
                  <div className="font-bold text-[#1b1464] text-right text-sm">{fmt(totalWht)}</div>
                </div>
                <div className="bg-[#f8fafc] border border-gray-200 rounded p-2 flex flex-col justify-center">
                  <div className="text-[10px] text-gray-600 mb-1 whitespace-nowrap"><span className="text-purple-400 mr-1">🏷️</span>ส่วนลดรวม</div>
                  <div className="font-bold text-[#1b1464] text-right text-sm">{fmt(totalDiscount)}</div>
                </div>
                <div className="bg-[#f8fafc] border border-gray-200 rounded p-2 flex flex-col justify-center">
                  <div className="text-[10px] text-gray-600 mb-1 whitespace-nowrap"><span className="text-purple-400 mr-1">🛢️</span>อื่น ๆ</div>
                  <div className="font-bold text-[#1b1464] text-right text-sm">0.00</div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-purple-100 flex justify-between items-center">
                <span className="text-[#392e8a] font-bold text-sm">ยอดรวมสุทธิ</span>
                <span className="text-[#392e8a] font-bold text-xl">{fmt(totalAmt)}</span>
              </div>
            </div>

            {/* Settlement Section */}
            <div className="grid grid-cols-2 gap-2 flex-1">
              <div className="border border-purple-100 rounded-xl p-3 bg-white shadow-sm flex flex-col justify-center space-y-3 text-left">
                <div>
                  <div className="flex items-center text-[10px] text-gray-500 mb-0.5">
                    <span className="text-purple-600 mr-2 text-sm">👛</span>เงินทดรองจ่ายทั้งหมด
                  </div>
                  <div className="text-[#1b1464] font-bold text-lg"><span className="text-xl">{fmt(advTotal)}</span> <span className="text-[10px] font-normal">บาท</span></div>
                </div>
                <div>
                  <div className="flex items-center text-[10px] text-gray-500 mb-0.5">
                    <span className="text-purple-600 mr-2 text-sm">🧾</span>เคลียร์แล้ว
                  </div>
                  <div className="text-[#392e8a] font-bold text-lg"><span className="text-xl">{fmt(totalAmt)}</span> <span className="text-[10px] font-normal">บาท</span></div>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center text-[10px] text-gray-500 mb-0.5">
                    <span className="text-purple-600 mr-2 text-sm">⚖️</span>ผลต่าง
                  </div>
                  <div className={`font-bold text-lg ${balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    <span className="text-xl">{fmt(balance)}</span> <span className="text-[10px] font-normal">บาท</span>
                  </div>
                </div>
              </div>

              <div className={`border-2 rounded-xl p-3 shadow-sm flex flex-col justify-center items-center text-center ${balance < 0 ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'}`}>
                <div className={`text-xs font-bold mb-2 leading-relaxed ${balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {balance < 0 ? 'บริษัทต้องจ่ายเพิ่ม\nให้พนักงานเป็นเงิน' : 'พนักงานต้องคืนเงิน\nให้ทางบริษัทเป็นเงิน'}
                </div>
                <div className={`text-3xl font-bold my-1 ${balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {fmt(Math.abs(balance))}
                </div>
                <div className={`text-sm font-bold ${balance < 0 ? 'text-red-600' : 'text-green-600'}`}>บาท</div>
              </div>
            </div>

          </div>

        </div>

        {/* Signatures Footer */}
        <div className="grid grid-cols-3 gap-8 mt-auto pt-6 text-center text-xs">
          <div>
            <div className="font-bold text-[#1b1464] mb-0">ผู้เบิก</div>
            <div className="h-16 flex items-center justify-center relative">
              {reportData.requesterSignature && (
                <img 
                  src={reportData.requesterSignature} 
                  alt="Requester Signature" 
                  className="h-full max-w-full object-contain" 
                  referrerPolicy="no-referrer" 
                />
              )}
            </div>
            <div className="text-[#392e8a] mb-2">{reportData.employeeName || '...........................................'}</div>
            <div className="border-b border-dotted border-gray-400 w-3/4 mx-auto mb-2"></div>
            <div className="text-gray-500">วันที่ {formatDate(reportData.reportDate)}</div>
          </div>
          <div>
            <div className="font-bold text-[#1b1464] mb-0">ฝ่ายบัญชี</div>
            <div className="h-16 flex items-center justify-center relative">
              {reportData.accountantSignature && (
                <img 
                  src={reportData.accountantSignature} 
                  alt="Accountant Signature" 
                  className="h-full max-w-full object-contain" 
                  referrerPolicy="no-referrer" 
                />
              )}
            </div>
            <div className="text-[#392e8a] mb-2">{reportData.accountantName || 'น.ส. พิชญาภา วงศ์ศิริ'}</div>
            <div className="border-b border-dotted border-gray-400 w-3/4 mx-auto mb-2"></div>
            <div className="text-gray-500">วันที่ {formatDate(reportData.reportDate)}</div>
          </div>
          <div>
            <div className="font-bold text-[#1b1464] mb-0">ผู้บริหาร</div>
            <div className="h-16 flex items-center justify-center relative">
              {reportData.approverSignature && (
                <img 
                  src={reportData.approverSignature} 
                  alt="Approver Signature" 
                  className="h-full max-w-full object-contain" 
                  referrerPolicy="no-referrer" 
                />
              )}
            </div>
            <div className="text-[#392e8a] mb-2">{reportData.approverName || 'นาย ณัฐวุฒิ ศรีสุวรรณ'}</div>
            <div className="border-b border-dotted border-gray-400 w-3/4 mx-auto mb-2"></div>
            <div className="text-gray-500">วันที่ {formatDate(reportData.reportDate)}</div>
          </div>
        </div>

      </div>
    </div>
  );
};

