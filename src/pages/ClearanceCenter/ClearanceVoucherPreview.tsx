import React from 'react';
import { Advance } from '../../types';
import { 
  ClearanceItem, 
  VendorInfo, 
  ReceiptExtras
} from './ClearanceCenter.data';
import { useDocumentTemplates } from '../../components/document-engine/useDocumentTemplates';
import { DocumentRenderer } from '../../components/document-engine/DocumentRenderer';
import { useApp } from '../../context/AppContext';

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
  globalVatType?: 'none' | 'include' | 'exclude';
  globalWhtRate?: string;
  projectMode?: string;
  mainProject?: string;
  mainAttachment?: any;
  extraAttachments?: any[];
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
  globalVatType = 'none',
  globalWhtRate = '0',
  projectMode = 'single',
  mainProject = 'PRJ-001',
  mainAttachment = null,
  extraAttachments = [],
}) => {
  const { publishedTemplates } = useDocumentTemplates();
  const { masterCategories = [], masterProjects = [] } = useApp() || {};

  // Adapt the component props to normalized clearance data schema for the renderer
  const clearanceData = {
    clrNo,
    advId: targetAdvance?.id || displayAdvance?.id || '',
    clearanceDate: vendorInfo.docDate ? new Date(vendorInfo.docDate).toISOString() : new Date().toISOString(),
    startDate: targetAdvance?.reqDate || displayAdvance?.reqDate || new Date().toISOString(),
    employeeName: targetAdvance?.empName || displayAdvance?.empName || '',
    employeeDept: targetAdvance?.empDept || '',
    employeePosition: targetAdvance?.empPosition || '',
    projectName: targetAdvance?.pNames?.[0] || targetAdvance?.pName || 'KCL',
    projectFullName: targetAdvance?.pNames?.join(', ') || targetAdvance?.pName || 'โครงการตกแต่งภายใน',
    vendorName: vendorInfo.name || '-',
    vendorTaxId: vendorInfo.taxId || '-',
    vendorBranch: vendorInfo.branch || 'สำนักงานใหญ่',
    docType: vendorInfo.docType || 'ใบกำกับภาษี/ใบเสร็จ',
    docNo: vendorInfo.docNo || '-',
    paymentTerm: 'โอนเงิน',
    items: items.map((it) => {
      const raw = it.qty * it.price;
      const effectiveVatType = globalVatType;
      const effectiveWhtRate = globalWhtRate;

      let base = raw;
      let vat = 0;
      if (effectiveVatType === 'include') {
        base = raw * 100 / 107;
        vat = raw - base;
      } else if (effectiveVatType === 'exclude') {
        vat = raw * 0.07;
      }

      const wht = base * (Number(effectiveWhtRate) / 100);

      // Find selected category name
      const catId = it.category || (masterCategories[0]?.id || 'C01');
      const matchedCat = masterCategories.find(c => c.id === catId);
      const categoryName = matchedCat ? matchedCat.name : 'ค่าใช้จ่ายทั่วไป';

      // Find project display name (code / name)
      const prjId = projectMode === 'multiple' ? it.projectId : (mainProject || 'PRJ-001');
      const matchedProj = masterProjects.find(p => (p.id || p.code) === prjId);
      const projectDisplay = matchedProj ? matchedProj.name : prjId;

      return {
        desc: it.name || 'ไม่มีชื่อรายการ',
        category: categoryName,
        price: it.price,
        qty: it.qty,
        amount: raw,
        vat,
        wht,
        project: projectDisplay
      };
    }),
    totals: {
      subtotal: subTotalAmount,
      totalVat,
      totalWht,
      grandTotal: netTotal,
      discountTotal: discountAmount,
      otherAmount: receiptExtras.otherAmount,
      otherLabel: receiptExtras.otherLabel,
    },
    advancedCash: targetAdvance?.amount || displayAdvance?.amount || 0,
    receipts: [
      ...(mainAttachment ? [{
        id: 'main',
        vendor: vendorInfo.name || 'เอกสารหลัก',
        taxId: vendorInfo.taxId || '',
        invoiceNo: vendorInfo.docNo || '',
        receiptNo: vendorInfo.docNo || '',
        date: vendorInfo.docDate || '',
        fileName: mainAttachment.name || 'main_attachment',
        items: [],
        subtotal: subTotalAmount,
        vatAmount: totalVat,
        whtAmount: totalWht,
        netTotal: netTotal,
        matchScore: 100,
        status: 'PENDING'
      }] : []),
      ...extraAttachments.map((att: any, idx: number) => ({
        id: att.id || `extra-${idx}`,
        vendor: 'เอกสารแนบเพิ่มเติม',
        taxId: '',
        invoiceNo: '',
        receiptNo: '',
        date: '',
        fileName: att.name || `extra_attachment_${idx + 1}`,
        items: [],
        subtotal: 0,
        vatAmount: 0,
        whtAmount: 0,
        netTotal: 0,
        matchScore: 100,
        status: 'PENDING'
      }))
    ],
  };

  return (
    <div id="clearance-voucher-preview" className="max-w-full">
      <DocumentRenderer 
        template={publishedTemplates.clearance} 
        data={clearanceData} 
      />
    </div>
  );
};
