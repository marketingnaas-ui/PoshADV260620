import React from 'react';
import { Advance } from '../../types';
import { 
  ClearanceItem, 
  VendorInfo, 
  ReceiptExtras, 
  formatNum, 
  MOCK_ADVANCE 
} from './ClearanceCenter.data';

interface ClearanceVoucherPreviewProps {
  clrNo: string;
  targetAdvance: Advance | undefined;
  displayAdvance: any;
  vendorInfo: VendorInfo;
  items: ClearanceItem[];
  subTotalAmount: number;
  discountAmount: number;
  totalVat: number;
  totalWht: number;
  receiptExtras: ReceiptExtras;
  netTotal: number;
  balance: number;
}

export const ClearanceVoucherPreview: React.FC<ClearanceVoucherPreviewProps> = ({
  clrNo,
  targetAdvance,
  displayAdvance,
  vendorInfo,
  items,
  subTotalAmount,
  discountAmount,
  totalVat,
  totalWht,
  receiptExtras,
  netTotal,
  balance,
}) => {
  return (
    <div className="bg-white w-[210mm] h-[297mm] shadow-lg p-12 pr-14 pl-14 flex flex-col mx-auto font-['Noto_Sans_Thai'] text-[12px] border border-slate-200 print-area relative overflow-hidden" id="clearance-voucher-preview">
      
      {/* HEADER & DOC INFO */}
      <div className="absolute top-10 right-12 text-right text-[12px]" id="clearance-doc-meta">
        <div className="flex items-center gap-2 justify-end">
          <span className="text-[#8A340F]">เลขที่เอกสาร:</span>
          <span className="font-bold text-[#5C220A]">{clrNo}</span>
        </div>
        <div className="flex items-center gap-2 justify-end mt-0.5">
          <span className="text-[#8A340F]">วันที่พิมพ์:</span>
          <span className="text-[#8A340F]">{new Date().toLocaleDateString('th-TH')}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6 pt-2" id="clearance-header">
        <div className="w-1/4">
          <img 
            src="https://img1.pic.in.th/images/Photoroom_25690616_0140025790561e35abda48.png" 
            className="w-[90px] h-[90px] object-cover" 
            alt="Logo" 
          />
        </div>
        <div className="w-1/2 text-center">
          <h1 className="text-[14px] font-bold text-[#5C220A] mb-1">Clearance Voucher</h1>
          <p className="text-[#8A340F] text-[12px] font-semibold">ใบสำคัญเคลียร์เงินทดรองจ่าย</p>
        </div>
        <div className="w-1/4"></div>
      </div>

      <hr className="border-t-2 border-[#5C220A] mb-6"/>

      {/* INFO BOX */}
      <div className="bg-[#FCF8F6] rounded-xl p-5 mb-8 border border-[#FDEEE8]" id="clearance-info-box">
        <div className="grid grid-cols-2 gap-y-3 text-[#5C220A] text-[12px]">
          <div className="flex">
            <span className="w-28 text-[#8A340F]">ชื่อผู้ขอเบิกเงิน:</span> 
            <span className="font-semibold">{targetAdvance?.empName || MOCK_ADVANCE.empName}</span>
          </div>
          <div className="flex">
            <span className="w-32 text-[#8A340F]">อ้างอิง ADV:</span> 
            <span className="font-semibold">{targetAdvance?.id || MOCK_ADVANCE.advNo}</span>
          </div>
          <div className="flex">
            <span className="w-28 text-[#8A340F]">ร้านค้า:</span> 
            <span className="font-semibold">{vendorInfo.name || '-'}</span>
          </div>
          <div className="flex">
            <span className="w-32 text-[#8A340F]">วันที่บิล:</span> 
            <span className="font-semibold">
              {vendorInfo.docDate ? new Date(vendorInfo.docDate).toLocaleDateString('th-TH') : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <table className="w-full text-[12px] text-[#5C220A] mb-6" id="clearance-items-table">
        <thead>
          <tr className="border-y-2 border-[#FADDD1]">
            <th className="py-3 px-2 text-left font-bold text-[#8A340F]">รายการ</th>
            <th className="py-3 px-2 text-center font-bold text-[#8A340F]">หมวดภาษี</th>
            <th className="py-3 px-2 text-right font-bold text-[#8A340F]">ราคาต่อหน่วย</th>
            <th className="py-3 px-2 text-center font-bold text-[#8A340F]">จำนวน</th>
            <th className="py-3 px-2 text-right font-bold text-[#8A340F]">รวมเงิน</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const raw = item.qty * item.price;
            let displayVat = item.vatType === 'include' 
              ? 'รวม VAT' 
              : item.vatType === 'exclude' 
                ? 'แยก VAT' 
                : 'ไม่มี VAT';
            return (
              <tr key={item.id} className="border-b border-[#FDEEE8]">
                <td className="py-3 px-2">{item.name || 'ไม่มีชื่อรายการ'}</td>
                <td className="py-3 px-2 text-center">{displayVat}</td>
                <td className="py-3 px-2 text-right">{formatNum(item.price)}</td>
                <td className="py-3 px-2 text-center">{item.qty}</td>
                <td className="py-3 px-2 text-right font-bold">{formatNum(raw)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* BIG SUMMARY BOX */}
      <div className="border-2 border-[#E75618] bg-[#FCF8F6] rounded-xl p-5 mb-8" id="clearance-summary-card">
        <div className="space-y-2 text-[#5C220A] text-[12px] mb-4">
          <div className="grid grid-cols-[1fr,auto] gap-x-4">
            <span>รวม (Subtotal)</span>
            <span className="text-right">฿{formatNum(subTotalAmount)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="grid grid-cols-[1fr,auto] gap-x-4 text-[#E75618]">
              <span>หัก ส่วนลด</span>
              <span className="text-right">-฿{formatNum(discountAmount)}</span>
            </div>
          )}
          <div className="grid grid-cols-[1fr,auto] gap-x-4">
            <span>ภาษีมูลค่าเพิ่ม (VAT 7%)</span>
            <span className="text-right">฿{formatNum(totalVat)}</span>
          </div>
          {totalWht > 0 && (
            <div className="grid grid-cols-[1fr,auto] gap-x-4 text-[#E75618]">
              <span>หัก ภาษี ณ ที่จ่าย (WHT)</span>
              <span className="text-right">-฿{formatNum(totalWht)}</span>
            </div>
          )}
          {receiptExtras.otherAmount !== 0 && (
            <div className="grid grid-cols-[1fr,auto] gap-x-4">
              <span>{receiptExtras.otherLabel || 'รายการอื่นๆ'}</span>
              <span className="text-right">฿{formatNum(receiptExtras.otherAmount)}</span>
            </div>
          )}
        </div>
        
        <div className="border-t border-[#F5BBA3] my-4 pt-4 space-y-2">
          <div className="grid grid-cols-[1fr,auto] gap-x-4 items-center">
            <span className="font-bold text-[#8A340F]">ยอดเงินทดรองจ่ายที่ยกมา (ADVANCE)</span>
            <span className="font-bold text-[#5C220A] text-[12px] text-right">
              ฿{formatNum(targetAdvance?.amount || displayAdvance.amount || MOCK_ADVANCE.advAmount)}
            </span>
          </div>
          <div className="grid grid-cols-[1fr,auto] gap-x-4 items-center">
            <span className="font-bold text-[#8A340F]">ยอดรวมที่เคลียร์ในเอกสารนี้ (CLEARED)</span>
            <span className="font-bold text-[#E75618] text-[12px] text-right">฿{formatNum(netTotal)}</span>
          </div>
          <hr className="border-t border-dashed border-[#F5BBA3] my-2"/>
          <div className="grid grid-cols-[1fr,auto] gap-x-4 items-center">
            <span className={`font-bold text-[12px] ${balance < 0 ? 'text-red-500' : 'text-[#E75618]'}`}>
              {balance < 0 ? 'ยอดที่บริษัทต้องจ่ายเพิ่ม (REIMBURSEMENT)' : 'ยอดคงเหลือส่งคืนบริษัท (BALANCE RETURN)'}
            </span>
            <span className={`font-bold text-[12px] text-right ${balance < 0 ? 'text-red-500' : 'text-[#E75618]'}`}>
              ฿{formatNum(Math.abs(balance))}
            </span>
          </div>
        </div>
      </div>

      {/* SIGNATURES */}
      <div className="mt-auto grid grid-cols-2 gap-10 pt-10 text-[12px]" id="clearance-signatures">
        <div className="text-center font-semibold">
          <div className="mb-10 text-[#8A340F]">ผู้ขอเบิก</div>
          <div className="border-b border-dashed border-[#5C220A] mx-8 mb-3"></div>
        </div>
        <div className="text-center font-semibold">
          <div className="mb-10 text-[#8A340F]">ผู้อนุมัติ</div>
          <div className="border-b border-dashed border-[#5C220A] mx-8 mb-3"></div>
        </div>
      </div>
    </div>
  );
};
