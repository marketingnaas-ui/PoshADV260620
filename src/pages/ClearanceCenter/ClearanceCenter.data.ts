export interface AttachmentItem {
  id: string;
  file: File;
  url: string;
  name: string;
  docType?: string;
  otherTypeDesc?: string;
}

export interface ClearanceItem {
  id: number;
  name: string;
  qty: number;
  price: number;
  projectId: string;
  vatType: 'none' | 'exclude' | 'include' | string;
  whtRate: string;
  category?: string;
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

export const DOC_TYPES = [
  'ใบกำกับภาษีเต็มรูปแบบ',
  'ใบกำกับภาษีอย่างย่อ',
  'บิลเงินสด',
  'สลิปโอนเงิน',
  'ใบเสร็จรับเงิน',
  'ใบรับของ'
];

// Utility functions
export const formatNum = (num: number) => 
  Number(num || 0).toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
