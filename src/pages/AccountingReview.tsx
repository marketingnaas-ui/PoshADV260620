import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Advance, Receipt, ReceiptItem, AuditLogItem, AccountingTransaction } from '../types';
import { fmt, fmtD, UserAvt } from '../lib/utils';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  ShieldCheck,
  FileText,
  Download,
  Printer,
  Lock,
  CheckSquare,
  History,
  TrendingDown,
  TrendingUp,
  Award,
  ChevronRight,
  Clock,
  Building2,
  User,
  Banknote,
  Receipt as ReceiptIcon,
  BarChart3,
  FileBadge,
  Save,
  ThumbsUp,
  ThumbsDown,
  FileQuestion,
  X,
  Eye,
  GripVertical,
  PanelBottomClose,
  PanelTopOpen,
} from 'lucide-react';

/* ─── Status helpers ─── */
const STATUS_TXT: Record<string, string> = {
  PENDING:          'รอตรวจสอบ',
  PARTIAL:          'ตรวจสอบบางส่วน',
  REJECTED_PARTIAL: 'ตีกลับบางส่วน',
  APPROVED:         'ตรวจสอบแล้ว',
  READY:            'พร้อมปิดยอด',
};

const STAT_COLORS: Record<string, string> = {
  PENDING:          'bg-amber-100  text-amber-800  border-amber-300',
  PARTIAL:          'bg-blue-100   text-blue-800   border-blue-300',
  REJECTED_PARTIAL: 'bg-rose-100   text-rose-800   border-rose-300',
  APPROVED:         'bg-emerald-100 text-emerald-800 border-emerald-300',
  READY:            'bg-teal-100   text-teal-800   border-teal-300',
};

const STAT_DOT: Record<string, string> = {
  PENDING:          'bg-amber-400',
  PARTIAL:          'bg-blue-400',
  REJECTED_PARTIAL: 'bg-rose-500',
  APPROVED:         'bg-emerald-500',
  READY:            'bg-teal-500',
};

type ReviewSectionKey =
  | 'queue'
  | 'trust'
  | 'case'
  | 'documents'
  | 'items'
  | 'summary'
  | 'settlement'
  | 'actions';

const REVIEW_SECTION_LABELS: Record<ReviewSectionKey, string> = {
  queue: 'Case Queue',
  trust: 'AI Trust',
  case: 'Case Summary',
  documents: 'Document Desk',
  items: 'Line Items',
  summary: 'Financials',
  settlement: 'Settlement',
  actions: 'Final Actions',
};

/* ─────────────────────────────────────── */
export const AccountingReview = () => {
  const { advances, updateAdvance, toast } = useApp();

  /* transactions: server-side */
  const [transactions, setTransactions] = useState<AccountingTransaction[]>([]);

  useEffect(() => {
    fetch('/api/store/review-transactions')
      .then(r => r.json())
      .then(rows => setTransactions(Array.isArray(rows) ? rows : []))
      .catch(() => toast('โหลดบัญชีแยกประเภทไม่สำเร็จ', 'err'));
  }, []);

  const saveTransactions = (rows: AccountingTransaction[]) => {
    setTransactions(rows);
    fetch('/api/store/review-transactions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rows),
    }).catch(() => toast('บันทึกบัญชีแยกประเภทไม่สำเร็จ', 'err'));
  };

  /* reviewable list */
  const reviewableList = advances.filter(a => a.status === 'CLEARED_BY_EMPLOYEE' || a.status === 'CLOSED');

  const [selectedAdvId,   setSelectedAdvId]   = useState<string>('');
  const [activeTab,       setActiveTab]       = useState<'attachments' | 'adv' | 'clr' | 'slip' | 'ocr' | 'audit'>('attachments');
  const [isMobile,        setIsMobile]        = useState(false);

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    handle();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  useEffect(() => {
    if (!selectedAdvId && reviewableList.length > 0) {
      const first = reviewableList.find(a => a.status === 'WAITING_CLEARANCE') || reviewableList[0];
      setSelectedAdvId(first.id);
    }
  }, [reviewableList, selectedAdvId]);

  const activeAdv = advances.find(a => a.id === selectedAdvId);

  /* Auto-seed receipts */
  useEffect(() => {
    if (activeAdv && !activeAdv.receipts && activeAdv.status === 'CLEARED_BY_EMPLOYEE') {
      updateAdvance(activeAdv.id, {
        receipts: generateSeedReceiptsForAdvance(activeAdv),
        reviewStatus: 'PENDING',
        reviewAuditLogs: [{
          id: `LOG-SEED-${Date.now()}`,
          advId: activeAdv.id,
          action: 'INITIAL_LOAD',
          detail: 'ฝ่ายบัญชีเปิดเอกสารและเตรียมวิเคราะห์สอบทาน',
          user: 'วิภา ทองสุข (ฝ่ายบัญชี)',
          timestamp: new Date().toISOString(),
        }],
      });
    }
  }, [activeAdv, updateAdvance]);

  const [selectedReceiptId,   setSelectedReceiptId]   = useState<string>('');
  const [overrideReason,      setOverrideReason]      = useState<string>('');
  const [showOverrideModal,   setShowOverrideModal]   = useState<boolean>(false);
  const [genericPrompt, setGenericPrompt] = useState<{
    show: boolean;
    title: string;
    placeholder: string;
    value: string;
    onSubmit: (val: string) => void;
  } | null>(null);

  const triggerPrompt = (title: string, placeholder: string, onSubmit: (val: string) => void, initial = '') => {
    setGenericPrompt({
      show: true,
      title,
      placeholder,
      value: initial,
      onSubmit
    });
  };

  const [rejectItemReason,    setRejectItemReason]    = useState<Record<string, string>>({});
  const [expandedItems,       setExpandedItems]       = useState<Record<string, boolean>>({});
  const [reviewOpen,          setReviewOpen]          = useState<Record<ReviewSectionKey, boolean>>({
    queue: true,
    trust: true,
    case: true,
    documents: true,
    items: true,
    summary: true,
    settlement: true,
    actions: true,
  });
  const [draggingReviewSection, setDraggingReviewSection] = useState<ReviewSectionKey | null>(null);
  const [reviewSectionOrder, setReviewSectionOrder] = useState<ReviewSectionKey[]>([
    'queue',
    'trust',
    'case',
    'documents',
    'items',
    'summary',
    'settlement',
    'actions',
  ]);

  const clientReceipts: Receipt[] = activeAdv?.receipts || [];

  useEffect(() => {
    if (clientReceipts.length > 0 && !selectedReceiptId) setSelectedReceiptId(clientReceipts[0].id);
  }, [clientReceipts, selectedReceiptId]);

  const selectedReceipt = clientReceipts.find(r => r.id === selectedReceiptId) || clientReceipts[0];

  /* Audit helper */
  const logAuditAction = (action: string, detail: string) => {
    if (!activeAdv) return;
    const log: AuditLogItem = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      advId: activeAdv.id, action, detail,
      user: 'วิภา ทองสุข (ฝ่ายบัญชี)',
      timestamp: new Date().toISOString(),
    };
    updateAdvance(activeAdv.id, { reviewAuditLogs: [log, ...(activeAdv.reviewAuditLogs || [])] });
  };

  /* Financials */
  const totalAdvance   = activeAdv?.appAmount  || 0;
  const transferAmount = activeAdv?.pay?.amount || 0;
  const currentCleared = clientReceipts.reduce((s, r) => s + r.netTotal, 0);

  const allItems = clientReceipts.flatMap(rc =>
    rc.items.map(it => ({ ...it, receiptId: rc.id, vendor: rc.vendor, taxId: rc.taxId, invoiceNo: rc.invoiceNo, date: rc.date, matchScore: rc.matchScore }))
  );

  const calcNet = (it: { qty: number; price: number; vat?: number; wht?: number }) => {
    const b = it.qty * it.price;
    return b + (it.vat ? b * (it.vat / 100) : 0) - (it.wht ? b * (it.wht / 100) : 0);
  };

  const approvedClearance = allItems.filter(i => i.status === 'APPROVED').reduce((s, i) => s + calcNet(i), 0);
  const rejectedAmount    = allItems.filter(i => i.status === 'REJECTED').reduce((s, i) => s + calcNet(i), 0);
  const pendingCount      = allItems.filter(i => i.status === 'PENDING').length;
  const remainingCalculated = Math.max(0, transferAmount - approvedClearance);

  let settlementCase: 1 | 2 | 3 = 1;
  let settlementMsg = '';
  let settlementAmount = 0;
  if (approvedClearance === transferAmount)       { settlementCase = 1; settlementMsg = 'ยอดตรง — ปิดบัญชีได้ทันที'; }
  else if (approvedClearance < transferAmount)    { settlementCase = 2; settlementMsg = 'พนักงานต้องคืนเงินบริษัท'; settlementAmount = transferAmount - approvedClearance; }
  else                                            { settlementCase = 3; settlementMsg = 'บริษัทต้องคืนเงินพนักงาน'; settlementAmount = approvedClearance - transferAmount; }

  const calculateTrustScore = (rc: Receipt) => {
    let base = rc.matchScore;
    if (!rc.taxId || rc.taxId.replace(/\D/g, '').length !== 13) base -= 10;
    if (!rc.invoiceNo) base -= 8;
    if (activeAdv) {
      const diff = Math.abs((new Date(rc.date).getTime() - new Date(activeAdv.reqDate).getTime()) / 86400000);
      if (diff > 45) base -= 15;
    }
    rc.items.forEach(it => { if (it.qty <= 0 || it.price <= 0) base -= 5; });
    const score = Math.max(10, Math.min(100, base));
    if (score >= 90) return { score, text: 'น่าเชื่อถือสูง',       badge: 'bg-emerald-500 text-white', color: '#10b981' };
    if (score >= 70) return { score, text: 'ควรตรวจเพิ่ม',         badge: 'bg-amber-500  text-white', color: '#f59e0b' };
    return              { score, text: 'เสี่ยง / ตรวจละเอียด', badge: 'bg-rose-500   text-white animate-pulse', color: '#ef4444' };
  };

  /* ── Actions ── */
  const approveReceipt = (rcId: string) => {
    if (!activeAdv) return;
    const up = clientReceipts.map(rc =>
      rc.id === rcId ? { ...rc, status: 'APPROVED' as const, items: rc.items.map(it => ({ ...it, status: 'APPROVED' as const })) } : rc
    );
    const allDone = up.every(r => r.status !== 'PENDING');
    const anyRej  = up.some(r  => r.status === 'REJECTED');
    updateAdvance(activeAdv.id, { receipts: up, reviewStatus: allDone ? (anyRej ? 'REJECTED_PARTIAL' : 'APPROVED') : 'PARTIAL' } as any);
    toast(`✅ อนุมัติเอกสาร ${rcId}`, 'ok');
    logAuditAction('APPROVE_RECEIPT', `อนุมัติใบเสร็จ ${rcId} ครบทุกรายการ`);
  };

  const rejectReceipt = (rcId: string, reason: string) => {
    if (!activeAdv) return;
    if (!reason) { toast('⚠️ กรุณาระบุเหตุผลการตีกลับ', 'warn'); return; }
    const up = clientReceipts.map(rc =>
      rc.id === rcId ? { ...rc, status: 'REJECTED' as const, reason, items: rc.items.map(it => ({ ...it, status: 'REJECTED' as const, reason })) } : rc
    );
    const allDone = up.every(r => r.status !== 'PENDING');
    updateAdvance(activeAdv.id, { receipts: up, reviewStatus: allDone ? 'REJECTED_PARTIAL' : 'PARTIAL' } as any);
    toast(`❌ ตีกลับเอกสาร ${rcId}`, 'err');
    logAuditAction('REJECT_RECEIPT', `ตีกลับ ${rcId}: ${reason}`);
  };

  const approveLineItem = (rcId: string, itemId: string) => {
    if (!activeAdv) return;
    const up = clientReceipts.map(rc => {
      if (rc.id !== rcId) return rc;
      const items = rc.items.map(it => it.id === itemId ? { ...it, status: 'APPROVED' as const, reason: undefined } : it);
      const allA = items.every(i => i.status === 'APPROVED');
      const anyR = items.some(i  => i.status === 'REJECTED');
      return { ...rc, items, status: (allA ? 'APPROVED' : anyR ? 'REJECTED' : 'PARTIAL') as any };
    });
    const allDone = up.every(r => r.status !== 'PENDING');
    updateAdvance(activeAdv.id, { receipts: up, reviewStatus: allDone ? (up.some(r => r.status === 'REJECTED' || r.status === 'PARTIAL') ? 'REJECTED_PARTIAL' : 'APPROVED') : 'PARTIAL' } as any);
    toast('✅ อนุมัติรายการ', 'ok');
    const ti = allItems.find(i => i.id === itemId);
    logAuditAction('APPROVE_ITEM', `อนุมัติ: ${ti?.desc} ฿${fmt(ti ? ti.qty * ti.price : 0)}`);
  };

  const rejectLineItem = (rcId: string, itemId: string, reason: string) => {
    if (!activeAdv) return;
    if (!reason) { toast('⚠️ กรุณากรอกเหตุผล', 'warn'); return; }
    const up = clientReceipts.map(rc => {
      if (rc.id !== rcId) return rc;
      return { ...rc, items: rc.items.map(it => it.id === itemId ? { ...it, status: 'REJECTED' as const, reason } : it), status: 'REJECTED' as const };
    });
    updateAdvance(activeAdv.id, { receipts: up, reviewStatus: 'REJECTED_PARTIAL' } as any);
    toast('❌ ตีกลับรายการ', 'err');
    const ti = allItems.find(i => i.id === itemId);
    logAuditAction('REJECT_ITEM', `ปฏิเสธ: ${ti?.desc} เหตุผล: ${reason}`);
    setRejectItemReason(p => ({ ...p, [itemId]: '' }));
  };

  const requestMoreEvidence = (rcId: string, itemId: string, reason: string) => {
    if (!activeAdv) return;
    if (!reason) { toast('⚠️ กรุณาระบุรายละเอียด', 'warn'); return; }
    const up = clientReceipts.map(rc => {
      if (rc.id !== rcId) return rc;
      return { ...rc, items: rc.items.map(it => it.id === itemId ? { ...it, status: 'MORE_EVIDENCE' as const, reason } : it), status: 'MORE_EVIDENCE' as const };
    });
    updateAdvance(activeAdv.id, { receipts: up, reviewStatus: 'PARTIAL' } as any);
    toast('💡 ส่งคำขอเอกสารเพิ่มแล้ว', 'info');
    const ti = allItems.find(i => i.id === itemId);
    logAuditAction('REQUEST_EVIDENCE', `ขอหลักฐานเพิ่ม: ${ti?.desc}: ${reason}`);
    setRejectItemReason(p => ({ ...p, [itemId]: '' }));
  };

  const handleManualOverride = () => {
    if (!activeAdv) return;
    if (!overrideReason) { toast('⚠️ กรุณาระบุมติ Override', 'warn'); return; }
    const up = clientReceipts.map(rc => ({ ...rc, status: 'APPROVED' as const, items: rc.items.map(it => ({ ...it, status: 'APPROVED' as const })) }));
    updateAdvance(activeAdv.id, { receipts: up, reviewStatus: 'APPROVED', overrideReason } as any);
    toast('🛡️ Manual Override เสร็จสิ้น', 'ok');
    logAuditAction('MANUAL_OVERRIDE', `Manual Override: ${overrideReason}`);
    setShowOverrideModal(false);
  };

  const saveReviewDraft = () => {
    if (!activeAdv) return;
    toast('💾 บันทึกแบบร่างเสร็จสิ้น', 'ok');
    logAuditAction('SAVE_DRAFT', 'บันทึกแบบร่างการสอบทาน');
  };

  const handleCloseAccount = () => {
    if (!activeAdv) return;
    if (allItems.some(it => it.status === 'PENDING'))                            { toast('❌ ยังมีรายการรอตรวจสอบ', 'err');                        return; }
    if (allItems.some(it => it.status === 'REJECTED' && !it.reason))             { toast('❌ รายการตีกลับยังไม่ระบุเหตุผล', 'err');                return; }
    if (Math.abs(Math.round(allItems.reduce((s, it) => s + calcNet(it), 0)) - Math.round(currentCleared)) > 5) {
      toast('❌ ยอดรวมไม่สมดุล', 'err'); return;
    }
    if (clientReceipts.some(rc => rc.matchScore < 70) && !activeAdv.overrideReason) { toast('❌ OCR Score ต่ำ — ต้องทำ Manual Override ก่อน', 'warn'); return; }

    logAuditAction('CLOSE_ACCOUNT', `ปิดยอดบัญชี อนุมัติ ฿${fmt(approvedClearance)} ตีกลับ ฿${fmt(rejectedAmount)}`);

    const reviewNo = `REV-2026-${activeAdv.id.split('-')[2]}`;
    const newTx: AccountingTransaction[] = allItems.map(it => {
      const line = it.qty * it.price;
      const vat  = it.vat ? line * (it.vat / 100) : 0;
      const wht  = it.wht ? line * (it.wht / 100) : 0;
      return {
        advNo: activeAdv.id, clrNo: activeAdv.clrs[0]?.id || `CLR-${activeAdv.id.split('-')[2]}`,
        employee: activeAdv.empName, project: activeAdv.pName, category: activeAdv.catName,
        vendor: it.vendor, taxId: it.taxId, docType: it.vat > 0 ? 'Tax Invoice' : 'Receipt',
        docNo: it.invoiceNo || 'N/A', docDate: it.date, desc: it.desc,
        qty: it.qty, unit: it.unit, price: it.price, lineTotal: line,
        subtotal: line, vatAmount: vat, whtAmount: wht, netAmount: line + vat - wht,
        approvedAmount: it.status === 'APPROVED' ? (line + vat - wht) : 0,
        rejectedAmount: it.status === 'REJECTED' ? (line + vat - wht) : 0,
        rejectReason: it.reason, transferBank: activeAdv.pay?.bank,
        transferAccountNo: 'N/A', transferAccountName: activeAdv.empName,
        transferDate: activeAdv.pay?.date, transferTime: activeAdv.pay?.ref,
        transferRef: activeAdv.pay?.ref, ocrScore: it.matchScore, aiTrustScore: it.matchScore,
      };
    });
    saveTransactions([...newTx, ...transactions]);

    const d1 = { id: `VF-${Date.now()}-A`, advId: activeAdv.id, clrId: reviewNo, date: '2026-06-18', type: 'ACCOUNTING_PACKET', fileName: `FINAL-CLOSING-${activeAdv.id}.pdf`, status: 'Booked' };
    const d2 = { id: `VF-${Date.now()}-B`, advId: activeAdv.id, clrId: reviewNo, date: '2026-06-18', type: 'AUDIT_REVIEW', fileName: `ACCOUNTING-REVIEW-${reviewNo}.pdf`, status: 'Archived' };
    fetch('/api/store/vault-docs').then(r => r.json()).then(docs =>
      fetch('/api/store/vault-docs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([d1, d2, ...(Array.isArray(docs) ? docs : [])]) })
    ).catch(() => toast('บันทึกเอกสารเข้าคลังไม่สำเร็จ', 'err'));

    updateAdvance(activeAdv.id, { status: 'CLOSED', clrAmount: approvedClearance, reviewStatus: 'READY' } as any);
    toast(`🎉 ปิดบัญชี ${activeAdv.id} เรียบร้อย`, 'ok');
  };

  const printAction = () => {
    window.print();
    toast('🖨️ เปิดหน้าต่างพิมพ์เอกสารบัญชีแล้ว', 'info');
  };

  /* Tab config */
  const TABS = [
    { id: 'attachments', label: 'เอกสารแนบ',    icon: <ReceiptIcon size={13} /> },
    { id: 'adv',         label: 'ใบเบิก ADV',    icon: <FileText    size={13} /> },
    { id: 'clr',         label: 'ใบเคลียร์ CLR', icon: <FileBadge   size={13} /> },
    { id: 'slip',        label: 'สลิปโอน',        icon: <Banknote    size={13} /> },
    { id: 'ocr',         label: 'AI / OCR',       icon: <BarChart3   size={13} /> },
    { id: 'audit',       label: 'Audit Trail',    icon: <History     size={13} /> },
  ] as const;

  const toggleReviewSection = (section: ReviewSectionKey) => {
    setReviewOpen(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const setAllReviewSections = (open: boolean) => {
    setReviewOpen({
      queue: open,
      trust: open,
      case: open,
      documents: open,
      items: open,
      summary: open,
      settlement: open,
      actions: open,
    });
  };

  const moveReviewSection = (from: ReviewSectionKey, to: ReviewSectionKey) => {
    if (from === to) return;
    setReviewSectionOrder(prev => {
      const next = prev.filter(section => section !== from);
      const targetIndex = next.indexOf(to);
      next.splice(targetIndex < 0 ? next.length : targetIndex, 0, from);
      return next;
    });
  };

  const reviewSectionOrderValue = (section: ReviewSectionKey) => {
    const index = reviewSectionOrder.indexOf(section);
    return index < 0 ? 99 : index;
  };

  const reviewCardClass = (section: ReviewSectionKey, base: string) =>
    `${base} accounting-section-card ${draggingReviewSection === section ? 'is-dragging' : ''}`;

  const reviewSectionHeaderProps = (section: ReviewSectionKey): React.HTMLAttributes<HTMLDivElement> => ({
    role: 'button',
    tabIndex: 0,
    draggable: true,
    title: 'Click to expand/collapse. Drag to reorder.',
    onClick: () => toggleReviewSection(section),
    onKeyDown: event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleReviewSection(section);
      }
    },
    onDragStart: event => {
      setDraggingReviewSection(section);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', section);
    },
    onDragOver: event => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    onDrop: event => {
      event.preventDefault();
      const from = (event.dataTransfer.getData('text/plain') || draggingReviewSection) as ReviewSectionKey | null;
      if (from) moveReviewSection(from, section);
      setDraggingReviewSection(null);
    },
    onDragEnd: () => setDraggingReviewSection(null),
  });

  /* ─────────────── RENDER ─────────────── */
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 accounting-review-v3">

      {/* ══ TOP HEADER ══ */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-700 text-white px-6 py-4 shadow-lg">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <CheckSquare size={20} className="text-emerald-200" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Accounting Review Center</h1>
              <p className="text-emerald-200 text-xs mt-0.5">ตรวจสอบเอกสารและสอบทานภาษี (VAT/WHT) ก่อนปิดบัญชีรายวัน</p>
            </div>
          </div>
          <div className="flex gap-2 self-end sm:self-auto">
            <button onClick={printAction}    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 transition">
              <Printer size={13} /> พิมพ์
            </button>
            <button onClick={saveReviewDraft} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 rounded-lg transition shadow">
              <Save size={13} /> บันทึกร่าง
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 pt-4">
        <div className="accounting-control-panel">
          <div className="accounting-control-head">
            <div className="accounting-control-title">
              <PanelTopOpen size={17} />
              <div>
                <strong>Workflow Sections</strong>
                <span>Click a card header to fold it. Drag headers to reorder the review desk.</span>
              </div>
            </div>
            <div className="accounting-control-actions">
              <button type="button" onClick={() => setAllReviewSections(true)}>
                <PanelTopOpen size={13} /> Expand all
              </button>
              <button type="button" onClick={() => setAllReviewSections(false)}>
                <PanelBottomClose size={13} /> Collapse all
              </button>
            </div>
          </div>
          <div className="accounting-section-map">
            {reviewSectionOrder.map(section => (
              <button
                key={section}
                type="button"
                onClick={() => toggleReviewSection(section)}
                aria-pressed={reviewOpen[section]}
                className={`accounting-step-pill ${reviewOpen[section] ? 'is-open' : 'is-closed'}`}
                style={{ order: reviewSectionOrderValue(section) }}
              >
                <GripVertical size={13} />
                <span>{REVIEW_SECTION_LABELS[section]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 py-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start accounting-review-grid">

        {/* ══ LEFT: CASE LIST ══ */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div
            data-open={reviewOpen.queue}
            className={reviewCardClass('queue', 'bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden')}
            style={{ order: reviewSectionOrderValue('queue') }}
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between accounting-section-header" {...reviewSectionHeaderProps('queue')}>
              <span className="text-sm font-bold text-slate-800">รายการรอตรวจสอบ</span>
              <span className="text-xs font-bold bg-teal-50 text-teal-700 border border-teal-100 px-2 py-0.5 rounded-full">
                {reviewableList.length} งาน
              </span>
            </div>
            <div className="divide-y divide-slate-50 max-h-[460px] overflow-y-auto">
              {reviewableList.map(a => {
                const isActive  = a.id === selectedAdvId;
                const isOverdue = a.dueDate && new Date(a.dueDate) < new Date('2026-06-17');
                const rstatus   = a.reviewStatus || 'PENDING';
                return (
                  <button
                    key={a.id}
                    onClick={() => { setSelectedAdvId(a.id); setSelectedReceiptId(''); }}
                    className={`w-full text-left px-4 py-3.5 transition-all ${isActive ? 'bg-teal-50 border-l-4 border-teal-600' : 'hover:bg-slate-50 border-l-4 border-transparent'}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <span className="text-xs font-bold font-mono text-slate-800 block">CLR-2026-{a.id.split('-')[2]}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{a.id}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold flex-shrink-0 ${STAT_COLORS[rstatus]}`}>
                        {STATUS_TXT[rstatus]}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        <User size={10} className="text-slate-400 flex-shrink-0" />
                        <span className="truncate font-medium">{a.empName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <Building2 size={10} className="text-slate-400 flex-shrink-0" />
                        <span className="truncate">{a.pName}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] mt-1.5">
                        <span className="font-bold text-teal-700">฿{fmt(a.pay?.amount || a.amount)}</span>
                        {isOverdue && <span className="text-[10px] bg-rose-50 text-rose-600 border border-rose-200 px-1.5 rounded font-bold">⚠ เกินกำหนด</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
              {reviewableList.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-xs px-4">
                  <CheckCircle2 size={28} className="mx-auto mb-2 text-slate-300" />
                  ไม่มีรายการรอตรวจสอบ
                </div>
              )}
            </div>
          </div>

          {/* AI Trust Score card */}
          {activeAdv && selectedReceipt && (() => {
            const ts = calculateTrustScore(selectedReceipt);
            const circumference = 2 * Math.PI * 24;
            return (
              <div
                data-open={reviewOpen.trust}
                className={reviewCardClass('trust', 'bg-gradient-to-br from-slate-900 to-teal-950 text-white rounded-2xl shadow-md p-4 border border-teal-800/40')}
                style={{ order: reviewSectionOrderValue('trust') }}
              >
                <div className="flex items-center gap-1.5 text-teal-400 text-[11px] font-bold uppercase tracking-wide mb-3 accounting-section-header accounting-section-header-dark" {...reviewSectionHeaderProps('trust')}>
                  <Award size={13} /> AI Document Trust Score
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="#1e3a3a" strokeWidth="5" />
                      <circle cx="28" cy="28" r="24" fill="none" stroke={ts.color}
                        strokeWidth="5"
                        strokeDasharray={`${(ts.score / 100) * circumference} ${circumference}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold font-mono">
                      {ts.score}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-slate-300 mb-1">คะแนนความน่าเชื่อถือ</div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${ts.badge}`}>{ts.text}</span>
                  </div>
                </div>
                <div className="bg-slate-800/70 rounded-xl p-3 text-[11px] text-slate-300 leading-relaxed border border-slate-700/50">
                  <span className="text-emerald-400 font-semibold block mb-1">🔍 AI Insights:</span>
                  {selectedReceipt.aiFeedback || 'ยอดรวม VAT/WHT ถูกต้องตามเกณฑ์สรรพากร ข้อมูล Tax ID ตรงกับคู่ค้า'}
                </div>
              </div>
            );
          })()}
        </div>

        {/* ══ CENTER: WORKSPACE ══ */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {activeAdv ? (
            <>
              {/* Case banner */}
              <div
                data-open={reviewOpen.case}
                className={reviewCardClass('case', 'bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4')}
                style={{ order: reviewSectionOrderValue('case') }}
              >
                <div className="accounting-section-header border-b border-slate-100 pb-3 mb-3" {...reviewSectionHeaderProps('case')}>
                  <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FileBadge size={15} className="text-teal-600" /> Case Summary
                  </span>
                  <span className="text-xs text-slate-500 font-mono">{activeAdv.id}</span>
                </div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-slate-900 font-mono">CLR-2026-{activeAdv.id.split('-')[2]}</span>
                      <ChevronRight size={14} className="text-slate-400" />
                      <span className="text-sm text-slate-500">{activeAdv.id}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${STAT_COLORS[activeAdv.reviewStatus || 'PENDING']}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STAT_DOT[activeAdv.reviewStatus || 'PENDING']}`} />
                        {STATUS_TXT[activeAdv.reviewStatus || 'PENDING']}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1"><User size={11} />{activeAdv.empName}</span>
                      <span className="flex items-center gap-1"><Building2 size={11} />{activeAdv.pName}</span>
                      <span className="flex items-center gap-1"><Clock size={11} />{activeAdv.reqDate}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-center">
                      <div className="text-sm font-bold font-mono text-emerald-700">฿{fmt(approvedClearance)}</div>
                      <div className="text-[10px] text-emerald-600">อนุมัติแล้ว</div>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-center">
                      <div className="text-sm font-bold font-mono text-rose-600">฿{fmt(rejectedAmount)}</div>
                      <div className="text-[10px] text-rose-500">ตีกลับ</div>
                    </div>
                    {pendingCount > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center">
                        <div className="text-sm font-bold font-mono text-amber-700">{pendingCount}</div>
                        <div className="text-[10px] text-amber-600">รอตรวจ</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tab workspace */}
              <div
                data-open={reviewOpen.documents}
                className={reviewCardClass('documents', 'bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden')}
                style={{ order: reviewSectionOrderValue('documents') }}
              >
                <div className="px-5 py-3 border-b border-slate-100 accounting-section-header" {...reviewSectionHeaderProps('documents')}>
                  <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <ReceiptIcon size={15} className="text-teal-600" /> Document Review Desk
                  </span>
                  <span className="text-xs text-slate-500">{selectedReceipt?.invoiceNo || `${clientReceipts.length} receipts`}</span>
                </div>
                <div className="flex border-b border-slate-100 overflow-x-auto">
                  {TABS.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-all border-b-2 flex-shrink-0 ${
                        activeTab === t.id
                          ? 'border-teal-600 text-teal-700 bg-teal-50'
                          : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>

                <div className="p-4">

                  {/* ── Attachments ── */}
                  {activeTab === 'attachments' && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {clientReceipts.map(rc => (
                          <button key={rc.id} onClick={() => setSelectedReceiptId(rc.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition font-medium ${
                              selectedReceiptId === rc.id ? 'bg-teal-700 text-white border-teal-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                            }`}>
                            📃 {rc.vendor}
                            {rc.status === 'APPROVED' && <CheckCircle2 size={11} className={selectedReceiptId === rc.id ? 'text-emerald-300' : 'text-emerald-500'} />}
                            {rc.status === 'REJECTED' && <XCircle     size={11} className={selectedReceiptId === rc.id ? 'text-rose-200'    : 'text-rose-500'}    />}
                          </button>
                        ))}
                      </div>

                      {selectedReceipt && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                          {/* Header */}
                          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-start flex-wrap gap-2">
                            <div>
                              <div className="font-bold text-sm text-slate-800">{selectedReceipt.vendor}</div>
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                Tax ID: {selectedReceipt.taxId} &nbsp;|&nbsp; เลขที่: {selectedReceipt.invoiceNo || 'N/A'} &nbsp;|&nbsp; วันที่: {selectedReceipt.date}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-base font-bold text-teal-800 font-mono">฿{fmt(selectedReceipt.netTotal)}</div>
                              <div className="text-[10px] text-slate-400">VAT: ฿{fmt(selectedReceipt.vatAmount)}</div>
                            </div>
                          </div>

                          {/* File strip */}
                          <div className="bg-white px-4 py-3 flex items-center gap-4 border-b border-slate-100">
                            <div className="w-12 h-14 bg-slate-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 border border-slate-200">🧾</div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-xs text-slate-800 truncate">{selectedReceipt.fileName || 'Document.pdf'}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">OCR Score {selectedReceipt.matchScore}%</div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-28 mt-1.5">
                                <div className={`h-full rounded-full ${selectedReceipt.matchScore >= 90 ? 'bg-emerald-500' : selectedReceipt.matchScore >= 70 ? 'bg-amber-400' : 'bg-rose-500'}`}
                                  style={{ width: `${selectedReceipt.matchScore}%` }} />
                              </div>
                            </div>
                            <button onClick={printAction} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 font-medium transition flex-shrink-0">
                              <Eye size={11} /> ดูไฟล์
                            </button>
                          </div>

                          {/* Quick approve/reject */}
                          <div className="px-4 py-3 bg-white border-b border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-slate-600">ตัดสินใจสำหรับเอกสารฉบับนี้:</span>
                              <span className={`text-[11px] font-semibold ${selectedReceipt.status === 'APPROVED' ? 'text-emerald-600' : selectedReceipt.status === 'REJECTED' ? 'text-rose-600' : 'text-amber-600'}`}>
                                {selectedReceipt.status === 'APPROVED' ? '✓ อนุมัติแล้ว' : selectedReceipt.status === 'REJECTED' ? '✗ ตีกลับแล้ว' : '⏳ รอพิจารณา'}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => approveReceipt(selectedReceipt.id)}
                                className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg shadow-sm transition">
                                <ThumbsUp size={12} /> อนุมัติทั้งเอกสาร
                              </button>
                              <button onClick={() => triggerPrompt('เหตุผลการปฏิเสธเอกสาร', 'ระบุเหตุผลการตีกลับเอกสารนี้...', (r) => rejectReceipt(selectedReceipt.id, r))}
                                className="flex-1 flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2 rounded-lg shadow-sm transition">
                                <ThumbsDown size={12} /> ตีกลับเอกสาร
                              </button>
                            </div>
                          </div>

                          {/* Line items */}
                          <div className="divide-y divide-slate-50">
                            {selectedReceipt.items.map((it, idx) => (
                              <div key={it.id} className="px-4 py-3 bg-white">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[10px] text-slate-400 font-mono w-4 flex-shrink-0">{idx + 1}.</span>
                                      <span className="text-xs font-medium text-slate-800">{it.desc}</span>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                                        it.status === 'APPROVED'      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                        it.status === 'REJECTED'      ? 'bg-rose-50 text-rose-600 border border-rose-200'         :
                                        it.status === 'MORE_EVIDENCE' ? 'bg-blue-50 text-blue-700 border border-blue-200'         :
                                        'bg-amber-50 text-amber-700 border border-amber-200'
                                      }`}>
                                        {it.status === 'APPROVED' ? 'อนุมัติ' : it.status === 'REJECTED' ? 'ตีกลับ' : it.status === 'MORE_EVIDENCE' ? 'ขอเพิ่ม' : 'รอตรวจ'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500 ml-6">
                                      <span>{it.qty} {it.unit} × ฿{fmt(it.price)}</span>
                                      {it.vat ? <span>VAT {it.vat}%</span> : null}
                                      {it.wht ? <span>WHT {it.wht}%</span> : null}
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <div className="text-xs font-bold font-mono text-slate-800">฿{fmt(Math.round(calcNet(it)))}</div>
                                    <button onClick={() => setExpandedItems(p => ({ ...p, [it.id]: !p[it.id] }))}
                                      className="text-[10px] text-teal-600 hover:text-teal-800 mt-0.5 block ml-auto">
                                      {expandedItems[it.id] ? '▲ ซ่อน' : '▼ จัดการ'}
                                    </button>
                                  </div>
                                </div>

                                {expandedItems[it.id] && (
                                  <div className="mt-2 ml-6 space-y-2">
                                    <div className="flex gap-1.5 flex-wrap">
                                      <button onClick={() => approveLineItem(selectedReceipt.id, it.id)}
                                        className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold rounded-lg transition shadow-sm">
                                        ✓ อนุมัติ
                                      </button>
                                      <button onClick={() => rejectLineItem(selectedReceipt.id, it.id, rejectItemReason[it.id] || '')}
                                        className="px-2.5 py-1 bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-bold rounded-lg transition shadow-sm">
                                        ✗ ตีกลับ
                                      </button>
                                      <button onClick={() => requestMoreEvidence(selectedReceipt.id, it.id, rejectItemReason[it.id] || '')}
                                        className="px-2.5 py-1 bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-bold rounded-lg transition shadow-sm">
                                        ? ขอเพิ่ม
                                      </button>
                                    </div>
                                    <input
                                      type="text"
                                      value={rejectItemReason[it.id] || ''}
                                      onChange={e => setRejectItemReason(p => ({ ...p, [it.id]: e.target.value }))}
                                      placeholder="ระบุเหตุผล (สำหรับตีกลับ / ขอเพิ่ม)..."
                                      className="w-full text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50"
                                    />
                                    {it.reason && (
                                      <div className="text-[10px] bg-rose-50 border border-rose-100 text-rose-700 px-2 py-1 rounded-lg">
                                        <strong>เหตุผล:</strong> {it.reason}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── ADV ── */}
                  {activeTab === 'adv' && activeAdv && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 font-mono text-[11px] leading-loose relative">
                      <div className="absolute right-5 top-5 text-xs font-bold text-teal-800 border-2 border-teal-500 px-2 py-1 rotate-6 rounded">APPROVED</div>
                      <div className="text-center font-bold text-sm mb-4 font-sans text-slate-900">ใบขออนุมัติเบิกเงินจ่ายทดรองต้นฉบับ</div>
                      <div className="space-y-1 text-slate-700">
                        <p><strong>เลขที่:</strong> {activeAdv.id}</p>
                        <p><strong>ผู้จัดทำ:</strong> {activeAdv.empName} — {activeAdv.empDept}</p>
                        <p><strong>โครงการ:</strong> {activeAdv.pName}</p>
                        <p><strong>วันที่ขอ:</strong> {activeAdv.reqDate}</p>
                        <p><strong>วัตถุประสงค์:</strong> {activeAdv.desc}</p>
                        <p><strong>วงเงินที่ขอ:</strong> ฿{fmt(activeAdv.amount)}</p>
                        <p><strong>วงเงินอนุมัติ:</strong> ฿{fmt(activeAdv.appAmount)}</p>
                        <p><strong>ผู้อนุมัติ:</strong> นฤมล ดวงแก้ว (ผู้บริหาร)</p>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button onClick={printAction} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition font-sans"><Printer size={11} /> พิมพ์</button>
                        <a href={`/api/export/advance/${encodeURIComponent(activeAdv.id)}.json`} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition font-sans"><Download size={11} /> ดาวน์โหลด</a>
                      </div>
                    </div>
                  )}

                  {/* ── CLR ── */}
                  {activeTab === 'clr' && activeAdv && (
                    <div className="space-y-3">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-[11px] leading-loose">
                        <div className="font-sans font-bold text-xs text-slate-800 border-b pb-2 mb-3">ใบเคลียร์เงินยืมทดรองจ่าย (CLR)</div>
                        <p><strong>รหัส CLR:</strong> CLR-2026-{activeAdv.id.split('-')[2]}</p>
                        <p><strong>อ้างอิง ADV:</strong> {activeAdv.id}</p>
                        <p><strong>ผู้ยื่น:</strong> {activeAdv.empName}</p>
                        <p><strong>ยอดรวมที่ยื่น:</strong> <span className="text-teal-800 font-bold">฿{fmt(currentCleared)}</span></p>
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 text-slate-500 font-semibold">
                            <tr>
                              <th className="px-3 py-2 text-left">รายการ</th>
                              <th className="px-3 py-2 text-right">จำนวน</th>
                              <th className="px-3 py-2 text-right">ราคา/หน่วย</th>
                              <th className="px-3 py-2 text-right">รวมสุทธิ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {allItems.map((it, i) => (
                              <tr key={i} className="bg-white hover:bg-slate-50">
                                <td className="px-3 py-2">{it.desc}</td>
                                <td className="px-3 py-2 text-right">{it.qty} {it.unit}</td>
                                <td className="px-3 py-2 text-right">฿{fmt(it.price)}</td>
                                <td className="px-3 py-2 text-right font-bold">฿{fmt(it.qty * it.price)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ── Slip ── */}
                  {activeTab === 'slip' && activeAdv && (
                    activeAdv.pay ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-blue-900 to-indigo-900 text-white rounded-xl p-4 text-xs shadow-lg">
                          <div className="flex justify-between font-bold border-b border-white/20 pb-2 mb-3">
                            <span>{activeAdv.pay.bank} App</span>
                            <span className="text-emerald-300">✓ โอนสำเร็จ</span>
                          </div>
                          <div className="text-center my-3">
                            <div className="text-slate-300 text-[10px]">จำนวนเงิน</div>
                            <div className="text-2xl font-bold">฿{fmt(activeAdv.pay.amount)}</div>
                          </div>
                          <div className="space-y-1 text-slate-300 text-[11px]">
                            <p>จาก: บจก. แอดวานซ์ พอช มีเดีย</p>
                            <p>ถึง: {activeAdv.empName}</p>
                            <p>วันที่: {activeAdv.pay.date}</p>
                            <p>Ref: {activeAdv.pay.ref}</p>
                          </div>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                          <div className="font-semibold text-slate-700 border-b pb-2">ข้อมูล OCR Extract</div>
                          <p><strong>ธนาคาร:</strong> {activeAdv.pay.bank}</p>
                          <p><strong>ผู้รับ:</strong> {activeAdv.empName}</p>
                          <p><strong>บัญชีบริษัท:</strong> xxx-x-x1420-x</p>
                          <p><strong>ยอดโอน:</strong> ฿{fmt(activeAdv.pay.amount)}</p>
                          <p><strong>Ref:</strong> {activeAdv.pay.ref}</p>
                          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg p-2 text-[10px] font-medium">
                            ✓ AI ยืนยัน — ยอดตรงกับหลักฐาน
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-10 text-slate-400 text-xs">ไม่มีหลักฐานการโอนเงิน</div>
                    )
                  )}

                  {/* ── OCR ── */}
                  {activeTab === 'ocr' && selectedReceipt && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                          <div className="font-bold text-slate-600 border-b pb-1 mb-2">ข้อมูลบนเอกสาร (OCR)</div>
                          <p className="font-mono text-[11px]">ยอดสุทธิ: ฿{fmt(selectedReceipt.netTotal)}</p>
                          <p className="font-mono text-[11px]">วันที่: {selectedReceipt.date}</p>
                          <p className="font-mono text-[11px]">ผู้ขาย: {selectedReceipt.vendor}</p>
                          <p className="font-mono text-[11px]">Tax ID: {selectedReceipt.taxId}</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                          <div className="font-bold text-slate-600 border-b pb-1 mb-2">ข้อมูลใบขอเบิก (ADV)</div>
                          <p className="font-mono text-[11px]">วงเงินอนุมัติ: ฿{fmt(activeAdv?.appAmount)}</p>
                          <p className="font-mono text-[11px]">วันที่ขอ: {activeAdv?.reqDate}</p>
                          <p className="font-mono text-[11px]">โครงการ: {activeAdv?.pName}</p>
                          <p className="font-mono text-[11px]">หมวดหมู่: {activeAdv?.catName}</p>
                        </div>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <div className="font-bold text-emerald-800 text-xs mb-2">🛡️ ผลการวิเคราะห์เชิงลึก:</div>
                        <ul className="list-disc pl-4 text-[11px] text-emerald-800 space-y-1">
                          <li>การใช้จ่ายสอดคล้องกับงบวัสดุก่อสร้าง</li>
                          <li>วันที่ในใบเสร็จถูกต้องตามวงจรชีวิตสินค้า</li>
                          <li>VAT 7% ถูกต้องตามกฎสรรพากร</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* ── Audit ── */}
                  {activeTab === 'audit' && activeAdv && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <History size={14} /> Audit Log — {activeAdv.id}
                      </div>
                      <div className="border-l-2 border-teal-200 pl-3 space-y-3 max-h-80 overflow-y-auto">
                        {(activeAdv.reviewAuditLogs || []).map((log, i) => (
                          <div key={log.id || i} className="text-[11px]">
                            <div className="flex justify-between text-slate-400 text-[10px] font-mono">
                              <span>{log.user}</span>
                              <span>{new Date(log.timestamp).toLocaleString('th-TH')}</span>
                            </div>
                            <div className="text-slate-800 mt-0.5">
                              <span className="font-bold text-teal-700">[{log.action}]</span> {log.detail}
                            </div>
                          </div>
                        ))}
                        {(activeAdv.reviewAuditLogs || []).length === 0 && (
                          <p className="text-slate-400 text-xs py-6 text-center">ไม่มีประวัติการดำเนินการ</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Full item table */}
              <div
                data-open={reviewOpen.items}
                className={reviewCardClass('items', 'bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden')}
                style={{ order: reviewSectionOrderValue('items') }}
              >
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between accounting-section-header" {...reviewSectionHeaderProps('items')}>
                  <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-500" /> รายการสินค้า / บริการทั้งหมด
                  </span>
                  <span className="text-xs text-slate-500">{allItems.length} รายการ</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-left w-8">#</th>
                        <th className="px-3 py-2 text-left">รายการ</th>
                        <th className="px-3 py-2 text-left">ผู้ขาย</th>
                        <th className="px-3 py-2 text-right">สุทธิ</th>
                        <th className="px-3 py-2 text-center">สถานะ</th>
                        <th className="px-3 py-2 text-center w-28">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {allItems.map((it, idx) => (
                        <tr key={it.id || idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-3 py-2.5 text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2.5">
                            <div className="font-medium text-slate-800">{it.desc}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{it.qty} {it.unit} × ฿{fmt(it.price)} | VAT {it.vat}% WHT {it.wht}%</div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 text-[11px]">{it.vendor}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">฿{fmt(Math.round(calcNet(it)))}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              it.status === 'APPROVED'      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              it.status === 'REJECTED'      ? 'bg-rose-50 text-rose-600 border border-rose-200'         :
                              it.status === 'MORE_EVIDENCE' ? 'bg-blue-50 text-blue-700 border border-blue-200'         :
                              'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {it.status === 'APPROVED' ? 'อนุมัติ' : it.status === 'REJECTED' ? 'ตีกลับ' : it.status === 'MORE_EVIDENCE' ? 'ขอเพิ่ม' : 'รอตรวจ'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => approveLineItem(it.receiptId, it.id)} title="อนุมัติ"
                                className="w-6 h-6 rounded-md bg-emerald-100 hover:bg-emerald-500 hover:text-white text-emerald-700 flex items-center justify-center transition">
                                <CheckCircle2 size={12} />
                              </button>
                              <button onClick={() => triggerPrompt('เหตุผลตีกลับ', 'ระบุเหตุผลในการตีกลับรายการนี้...', (r) => rejectLineItem(it.receiptId, it.id, r))} title="ตีกลับ"
                                className="w-6 h-6 rounded-md bg-rose-100 hover:bg-rose-500 hover:text-white text-rose-600 flex items-center justify-center transition">
                                <XCircle size={12} />
                              </button>
                              <button onClick={() => triggerPrompt('ขอหลักฐานเพิ่มเติม', 'ระบุสิ่งที่ต้องการเพิ่มเติม...', (r) => requestMoreEvidence(it.receiptId, it.id, r))} title="ขอเพิ่ม"
                                className="w-6 h-6 rounded-md bg-blue-100 hover:bg-blue-500 hover:text-white text-blue-600 flex items-center justify-center transition">
                                <HelpCircle size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center h-64 text-slate-400 text-sm">
              เลือกรายการจากด้านซ้ายเพื่อเริ่มตรวจสอบ
            </div>
          )}
        </div>

        {/* ══ RIGHT: DECISION PANEL ══ */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {activeAdv && (
            <>
              {/* Financial summary */}
              <div
                data-open={reviewOpen.summary}
                className={reviewCardClass('summary', 'bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden')}
                style={{ order: reviewSectionOrderValue('summary') }}
              >
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 accounting-section-header" {...reviewSectionHeaderProps('summary')}>
                  <Banknote size={14} className="text-teal-600" />
                  <span className="text-sm font-bold text-slate-800">สรุปยอดทางการเงิน</span>
                </div>
                <div className="px-4 py-3 space-y-2.5">
                  {[
                    { label: 'ยอดขอเบิกที่อนุมัติ',  value: totalAdvance,       color: 'text-slate-700'   },
                    { label: 'ยอดที่โอนจริง (สลิป)', value: transferAmount,     color: 'text-slate-700'   },
                    { label: 'ยอดเคลียร์รวม',         value: currentCleared,    color: 'text-teal-700'    },
                    { label: 'อนุมัติแล้ว',            value: approvedClearance, color: 'text-emerald-600' },
                    { label: 'ตีกลับ',                 value: rejectedAmount,    color: 'text-rose-500'    },
                    { label: 'ยอดค้างเคลียร์',         value: remainingCalculated, color: 'text-indigo-600' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">{label}</span>
                      <span className={`font-bold font-mono ${color}`}>฿{fmt(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Settlement */}
              <div
                data-open={reviewOpen.settlement}
                className={reviewCardClass('settlement', `rounded-2xl border-2 p-4 ${
                settlementCase === 1 ? 'bg-emerald-50 border-emerald-300' :
                settlementCase === 2 ? 'bg-amber-50   border-amber-300'   :
                                       'bg-rose-50    border-rose-300'
              }`)}
                style={{ order: reviewSectionOrderValue('settlement') }}
              >
                <div className={`flex items-center gap-2 font-bold text-sm mb-2 accounting-section-header ${
                  settlementCase === 1 ? 'text-emerald-800' : settlementCase === 2 ? 'text-amber-800' : 'text-rose-800'
                }`} {...reviewSectionHeaderProps('settlement')}>
                  {settlementCase === 1 ? <CheckCircle2 size={16} className="text-emerald-600" /> :
                   settlementCase === 2 ? <TrendingDown size={16} className="text-amber-600"   /> :
                                         <TrendingUp   size={16} className="text-rose-600"     />}
                  {settlementMsg}
                </div>
                {settlementAmount > 0 && (
                  <div className={`flex justify-between items-center bg-white/70 rounded-xl px-3 py-2 text-xs font-bold ${
                    settlementCase === 2 ? 'text-amber-900' : 'text-rose-900'
                  }`}>
                    <span>{settlementCase === 2 ? 'พนักงานคืน:' : 'บริษัทคืน:'}</span>
                    <span className="font-mono text-sm">฿{fmt(settlementAmount)}</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div
                data-open={reviewOpen.actions}
                className={reviewCardClass('actions', 'bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2.5')}
                style={{ order: reviewSectionOrderValue('actions') }}
              >
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-1 accounting-section-header" {...reviewSectionHeaderProps('actions')}>
                  <Lock size={11} /> การดำเนินการ
                </div>

                <button onClick={() => approveReceipt(selectedReceiptId)}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-sm transition">
                  <ThumbsUp size={13} /> อนุมัติเอกสารที่เลือก
                </button>

                <button onClick={() => triggerPrompt('เหตุผลตีกลับเอกสาร', 'กรุณาระบุเหตุผลการตีกลับเอกสารที่เลือก...', (r) => rejectReceipt(selectedReceiptId, r))}
                  className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-sm transition">
                  <ThumbsDown size={13} /> ตีกลับเอกสารที่เลือก
                </button>

                <button onClick={() => {
                  triggerPrompt('ขอเอกสารเพิ่มเติม', 'ระบุรายละเอียดหรือความต้องการด้านเอกสารที่ต้องการให้ผู้เบิกแนบเพิ่ม...', (r) => {
                    toast(`💡 ขอเอกสารเพิ่ม: "${r}"`, 'info');
                    logAuditAction('REQUEST_MORE_DOCS', `ขอ: ${r}`);
                  });
                }}
                  className="w-full flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold text-xs py-2.5 rounded-xl transition">
                  <FileQuestion size={13} /> ขอเอกสารเพิ่มเติม
                </button>

                <button onClick={() => setShowOverrideModal(true)}
                  className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold text-xs py-2.5 rounded-xl transition">
                  <ShieldCheck size={13} /> Manual Override
                </button>

                <div className="border-t border-slate-100 pt-3">
                  <button
                    onClick={handleCloseAccount}
                    disabled={activeAdv?.status === 'CLOSED'}
                    className={`w-full font-bold text-xs py-3.5 rounded-xl transition text-center uppercase tracking-wider shadow-md ${
                      activeAdv?.status === 'CLOSED'
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-teal-800 hover:bg-teal-900 active:scale-95 text-white border-b-4 border-teal-950'
                    }`}
                  >
                    {activeAdv?.status === 'CLOSED' ? '✓ CLOSED & BOOKED' : '🔒 ปิดบัญชีและลงบัญชี (Final Close)'}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center mt-2 leading-tight">
                    จะจัดเก็บไฟล์ลง Document Vault ตราสารอิเล็กทรอนิกส์
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══ OVERRIDE MODAL ══ */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border-t-4 border-teal-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-teal-900 flex items-center gap-2">
                <ShieldCheck size={18} className="text-teal-700" /> Manual Override
              </h3>
              <button onClick={() => setShowOverrideModal(false)} className="text-slate-400 hover:text-slate-700 transition">
                <X size={18} />
              </button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-800 leading-relaxed">
              ⚠️ คุณกำลังใช้สิทธิ์ผู้ตรวจสอบอาวุโสเพื่อข้ามกระบวนการ — มตินี้จะอนุมัติเอกสารทุกฉบับโดยอัตโนมัติและบันทึกใน Audit Log
            </div>
            <textarea
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 mb-4 h-24 bg-slate-50 resize-none"
              placeholder="ระบุมติที่ประชุมหรือเหตุผล Override... (เช่น ได้รับอนุมัติจากผู้อำนวยการฝ่ายการคลัง)"
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowOverrideModal(false)}
                className="flex-1 text-xs font-semibold py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
                ยกเลิก
              </button>
              <button type="button" onClick={handleManualOverride}
                className="flex-1 text-xs font-bold py-2.5 rounded-xl bg-teal-800 hover:bg-teal-900 text-white transition shadow">
                ยืนยัน Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ GENERIC INTERACTIVE PROMPT MODAL ══ */}
      {genericPrompt && genericPrompt.show && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setGenericPrompt(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border-t-4 border-slate-700" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900 mb-2">{genericPrompt.title}</h3>
            <textarea
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 mb-4 h-24 bg-slate-50 resize-none"
              placeholder={genericPrompt.placeholder}
              value={genericPrompt.value}
              onChange={e => setGenericPrompt(p => p ? { ...p, value: e.target.value } : null)}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setGenericPrompt(null)}
                className="flex-1 text-xs font-semibold py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
                ยกเลิก
              </button>
              <button type="button" onClick={() => {
                if (!genericPrompt.value.trim()) return;
                genericPrompt.onSubmit(genericPrompt.value.trim());
                setGenericPrompt(null);
              }}
                className="flex-1 text-xs font-bold py-2.5 rounded-xl bg-slate-800 hover:bg-slate-950 text-white transition shadow">
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Mock receipt seeder ─── */
function generateSeedReceiptsForAdvance(a: Advance): Receipt[] {
  if (a.id === 'ADV-2026-001') {
    return [{
      id: `REC-${a.id}-1`,
      vendor: 'บริษัท เอสซีจี แมททีเรียลส์ จำกัด',
      taxId: '0105554001234', invoiceNo: 'SCG-52890', receiptNo: 'REC-90321', date: '2026-05-18',
      subtotal: 35000, vatAmount: 2450, whtAmount: 0, netTotal: 37450, matchScore: 98,
      status: 'PENDING', fileName: 'SCG_Cement_Steel.pdf',
      aiFeedback: 'สลีปการโอนและชื่อผู้ขาย บจก. เอสซีจี สอดคล้องกัน 100%',
      items: [
        { id: `IT-${a.id}-s1`, desc: 'เหล็กเส้น SD40 ขนาด 12 มม.', qty: 50, unit: 'เส้น', price: 350, vat: 7, wht: 0, category: 'C02', status: 'PENDING' },
        { id: `IT-${a.id}-s2`, desc: 'ปูนซีเมนต์ปอร์ตแลนด์ ตราช้าง', qty: 100, unit: 'ถุง', price: 150, vat: 7, wht: 0, category: 'C02', status: 'PENDING' },
      ],
    }];
  }
  if (a.id === 'ADV-2026-003') {
    return [{
      id: `REC-${a.id}-1`,
      vendor: 'บริษัท สยาม ไดกิ้น เซลส์ จำกัด',
      taxId: '0105531002345', invoiceNo: 'DK-2026-891', receiptNo: 'DK-REC-00213', date: '2026-05-10',
      subtotal: 60000, vatAmount: 4200, whtAmount: 1800, netTotal: 62400, matchScore: 94,
      status: 'PENDING', fileName: 'Daikin_Compressors.pdf',
      aiFeedback: 'ตรวจพบ WHT 3% สอดคล้องกับค่าติดตั้งเครื่องปรับอากาศ',
      items: [
        { id: `IT-${a.id}-s1`, desc: 'เครื่องแอร์ Daikin 36000 BTU', qty: 4, unit: 'เครื่อง', price: 15000, vat: 7, wht: 3, category: 'C04', status: 'PENDING' },
      ],
    }];
  }
  return [{
    id: `REC-${a.id}-default`,
    vendor: 'บจก. ไทวัสดุ ค้าปลีกก่อสร้างอาคาร',
    taxId: '1234567890123', invoiceNo: `INV-${a.id.split('-')[2]}`, receiptNo: `RC-${a.id.split('-')[2]}`, date: '2026-06-12',
    subtotal: Math.round(a.appAmount * 0.93),
    vatAmount: Math.round(a.appAmount * 0.93 * 0.07),
    whtAmount: 0, netTotal: a.appAmount, matchScore: 89,
    status: 'PENDING', fileName: 'ThaiWatsadu_Receipt.jpg',
    aiFeedback: 'บิลเงินสดมียอดสุทธิตรงตามสเกลที่โอนจากเบิกเงินทดรอง',
    items: [
      { id: `IT-${a.id}-it1`, desc: a.desc || 'รายการอะไหล่และอุปกรณ์เสริมงานวิศวกรรมอาคาร', qty: 1, unit: 'ชุด', price: Math.round(a.appAmount * 0.93), vat: 7, wht: 0, category: a.catId || 'C02', status: 'PENDING' },
    ],
  }];
}
