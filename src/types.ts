export interface User { id: string; name: string; dept: string; role: string; bank: string; bankNo: string; ini: string; nickname?: string; position?: string; bankAccountName?: string; lineId?: string; hasSignature?: boolean; status?: 'ใช้งาน' | 'ปิดใช้งาน'; tel?: string; email?: string; signatureData?: string; }
export interface Project { id: string; name: string; budget: number; shortCode?: string; createdAt?: string; status?: 'ดำเนินการอยู่' | 'ไม่ได้ดำเนินการแล้ว'; }
export interface Category { id: string; name: string; color: string; }
export interface AdvItem { id?: number; d: string; q: number; u: string; p: number; t: number; cat?: string; }
export interface Clearance { id: string; date: string; amount: number; note: string; receipts?: Receipt[]; }
export interface Payment { bank: string; amount: number; date: string; ref: string; slip: string; slipFileId?: string; slipUrl?: string; mimeType?: string; }

export interface StoredFile {
  id: string;
  fileName: string;
  originalName: string;
  storedName?: string;
  mimeType: string;
  size: number;
  relatedId?: string;
  relatedType?: string;
  source?: string;
  createdAt: string;
  url: string;
  isImage: boolean;
}

export type AdvanceAttachment = string | StoredFile;

export type Status = 'PENDING_APPROVAL' | 'WAITING_TRANSFER' | 'WAITING_CLEARANCE' | 'CLEARED_BY_EMPLOYEE' | 'CLOSED' | 'REJECTED' | 'RETURNED' | 'บันทึกร่าง' | 'รออนุมัติ' | 'DRAFT' | 'DRAFT_CLEARANCE' | 'PARTIAL_CLEARANCE' | 'WAITING_PHYSICAL_DOCS';

export interface ReceiptItem {
  id: string;
  desc: string;
  qty: number;
  unit: string;
  price: number;
  vat: number; // e.g. 7 for 7%
  wht: number; // e.g. 3 for 3%
  category: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MORE_EVIDENCE';
  reason?: string;
}

export interface Receipt {
  id: string;
  vendor: string;
  taxId: string;
  invoiceNo: string;
  receiptNo: string;
  date: string;
  items: ReceiptItem[];
  subtotal: number;
  vatAmount: number;
  whtAmount: number;
  netTotal: number;
  matchScore: number;
  fileName?: string;
  fileId?: string;
  fileUrl?: string;
  mimeType?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MORE_EVIDENCE';
  reason?: string;
  aiFeedback?: string;
  isSlipValid?: boolean;
}

export interface AuditLogItem {
  id: string;
  advId: string;
  action: string;
  detail: string;
  user: string;
  timestamp: string;
}

export interface SystemAuditLog {
  id: string;
  timestamp: string;
  channel: 'Web App' | 'LINE LIFF' | 'Google Sheets' | 'System';
  actor: string;
  method: string;
  action: string;
  refDoc: string;
  status: 'SUCCESS' | 'FAILED';
  before?: string;
  after?: string;
}

export interface AccountingTransaction {
  advNo: string;
  clrNo: string;
  employee: string;
  project: string;
  category: string;
  vendor: string;
  taxId: string;
  docType: string;
  docNo: string;
  docDate: string;
  desc: string;
  qty: number;
  unit: string;
  price: number;
  lineTotal: number;
  subtotal: number;
  vatAmount: number;
  whtAmount: number;
  netAmount: number;
  approvedAmount: number;
  rejectedAmount: number;
  rejectReason?: string;
  transferBank?: string;
  transferAccountNo?: string;
  transferAccountName?: string;
  transferDate?: string;
  transferTime?: string;
  transferRef?: string;
  ocrScore: number;
  aiTrustScore: number;
}

export interface DocumentTrackingItem {
  type: string;
  attached: boolean;
  physical: boolean;
  receivedDate: string | null;
  remark?: string;
}

export interface TrackingRecord {
  id: string;
  status: 'Not Started' | 'Partially Received' | 'Completed' | 'Overdue' | 'Ready For Accounting' | 'ERP Posted';
  documents: DocumentTrackingItem[];
  timeline: {
    date: string;
    action: string;
    status: 'completed' | 'waiting' | 'overdue';
  }[];
  dueDate: string;
  completedDate?: string;
  completedBy?: string;
}

export interface Advance {
  id: string; empId: string; empName: string; empDept: string;
  pIds: string[]; pName: string; reqDate: string; dueDate: string;
  appDate: string | null; appBy: string | null;
  status: Status;
  amount: number; appAmount: number; clrAmount: number;
  catId: string; catName: string; desc: string;
  payeeBank?: string; payeeBankNo?: string; payeeAccountName?: string;
  items: AdvItem[]; files: AdvanceAttachment[]; clrs: Clearance[];
  pay: Payment | null; rejReason?: string;
  receipts?: Receipt[];             // Current pending or active receipts for accounting review
  reviewStatus?: 'PENDING' | 'PARTIAL' | 'REJECTED_PARTIAL' | 'APPROVED' | 'READY';
  reviewAuditLogs?: AuditLogItem[];  // Local audit trail for this advance review flow
  overrideReason?: string;
  trackingRecord?: TrackingRecord;
}

