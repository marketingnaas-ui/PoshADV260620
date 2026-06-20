export interface AttachmentItem {
  id: string;
  file: File;
  url: string;
  name: string;
}

export interface ClearanceItem {
  id: number;
  name: string;
  qty: number;
  price: number;
  projectId: string;
  vatType: 'none' | 'exclude' | 'include' | string;
  whtRate: string;
}

export interface VendorInfo {
  name: string;
  taxId: string;
  branch: string;
  docType: string;
  docNo: string;
  docDate: string;
}

export interface ReceiptExtras {
  discount: number;
  otherLabel: string;
  otherAmount: number;
}

// --- MOCK DATA ---
export const PROJECTS = [
  { id: 'PRJ-001', name: 'งานติดตั้งระบบเน็ตเวิร์ก สนง.ใหญ่' },
  { id: 'PRJ-002', name: 'แคมเปญการตลาดออนไลน์ Q3' },
  { id: 'PRJ-003', name: 'ปรับปรุงพื้นที่ส่วนกลางสาขาลาดพร้าว' },
];

export const MOCK_ADVANCE = {
  advNo: 'ADV-2026-0089',
  empName: 'สมชาย ใจดี (EMP001)',
  advAmount: 25000.00,
  defaultProject: 'PRJ-001'
};

export const DOC_TYPES = [
  'ใบกำกับภาษีเต็มรูป (Tax Invoice)',
  'ใบเสร็จรับเงิน (Receipt)',
  'บิลเงินสด (Cash Sale)'
];

// Utility functions
export const formatNum = (num: number) => 
  Number(num || 0).toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
