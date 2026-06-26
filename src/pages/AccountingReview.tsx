import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  User, 
  Store, 
  FileCheck2,
  LayoutDashboard,
  CloudLightning,
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Edit3, 
  Calendar, 
  Paperclip, 
  Check, 
  ClipboardCheck, 
  TrendingUp, 
  CheckSquare, 
  Send, 
  Database, 
  Sparkles,
  Info,
  ChevronRight,
  ShieldCheck,
  CheckSquare2,
  HelpCircle,
  FileSpreadsheet,
  Eye,
  Maximize2,
  Save,
  FileImage,
  FileBadge,
  Lock,
  Unlock,
  AlertTriangle,
  Building,
  DollarSign,
  FolderLock,
  Download,
  Share2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ClearanceTemplateRenderer } from '../components/document-engine/ClearanceTemplateRenderer';
import { DocumentRenderer } from '../components/document-engine/DocumentRenderer';
import { FitPageViewer } from '../components/document-engine/FitPageViewer';
import { useDocumentTemplates } from '../components/document-engine/useDocumentTemplates';
import AuditReport from '../components/AuditReport';

// --- MAIN APPLICATION ---
export const AccountingReview = () => {
  const { advances, updateAdvance, setPage, masterProjects = [], masterCategories = [], masterUsers = [] } = useApp();
  const { publishedTemplates } = useDocumentTemplates();

  // Find and sort candidates (clearance records / CLR documents)
  const candidates = React.useMemo(() => {
    const list: any[] = [];
    advances.forEach((a: any) => {
      // Find all unique CLR IDs inside this advance
      const clrIds = new Set<string>();
      if (a.receipts && a.receipts.length > 0) {
        a.receipts.forEach((rc: any) => {
          if (rc.id) clrIds.add(rc.id);
        });
      }
      if (a.clrs && a.clrs.length > 0) {
        a.clrs.forEach((c: any) => {
          if (c.id) clrIds.add(c.id);
        });
      }

      // If no receipts/clrs exist yet but status is clearable, show a pending CLR ID
      if (clrIds.size === 0 && (a.status === 'WAITING_CLEARANCE' || a.status === 'CLEARED_BY_EMPLOYEE')) {
        clrIds.add(`CLR-${a.id.substring(4)}`);
      }

      clrIds.forEach((clrId) => {
        // Calculate total amount for this specific CLR
        let clrAmount = 0;
        let latestDate = 0;

        if (a.receipts && a.receipts.length > 0) {
          const matchingReceipts = a.receipts.filter((rc: any) => rc.id === clrId || !rc.id);
          clrAmount = matchingReceipts.reduce((sum: number, rc: any) => sum + (rc.netTotal || rc.subtotal || 0), 0);
          matchingReceipts.forEach((rc: any) => {
            if (rc.date) {
               const d = new Date(rc.date).getTime();
               if (!isNaN(d) && d > latestDate) latestDate = d;
            }
          });
        } else if (a.clrs && a.clrs.length > 0) {
          const matchingClrs = a.clrs.filter((c: any) => c.id === clrId || !c.id);
          clrAmount = matchingClrs.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
          matchingClrs.forEach((c: any) => {
            if (c.date) {
               const d = new Date(c.date).getTime();
               if (!isNaN(d) && d > latestDate) latestDate = d;
            }
          });
        } else {
          clrAmount = a.clrAmount || a.appAmount || a.amount || 0;
        }

        if (latestDate === 0) {
           const fallbackDate = new Date(a.appDate || a.reqDate || Date.now()).getTime();
           if (!isNaN(fallbackDate)) latestDate = fallbackDate;
        }

        list.push({
          id: clrId, // CLR ID e.g., CLR-2606-009
          advId: a.id,
          empName: a.empName || 'ไม่ระบุชื่อ',
          empDept: a.empDept || 'แผนกทั่วไป',
          amount: clrAmount,
          advanceAmount: a.appAmount || a.amount || 0,
          status: a.status,
          reviewStatus: a.reviewStatus,
          latestDate,
          advance: a
        });
      });
    });

    // Sort to prioritize items waiting for clearance at the top, then by latest cleared date
    return list.filter(c => c.status !== 'CLOSED').sort((a, b) => {
      const score = (cand: any) => {
        if (cand.status === 'CLEARED_BY_EMPLOYEE' || cand.status === 'WAITING_CLEARANCE') return 2;
        return 1;
      };
      const scoreDiff = score(b) - score(a);
      if (scoreDiff !== 0) return scoreDiff;
      
      // Secondary sort: latest cleared first
      return b.latestDate - a.latestDate;
    });
  }, [advances]);

  // Track currently selected Clearance (CLR) ID
  const [selectedId, setSelectedId] = useState<string>('');

  const activeCand = React.useMemo(() => {
    if (!selectedId) return undefined;
    return candidates.find(c => c.id === selectedId);
  }, [candidates, selectedId]);

  const activeAdv = activeCand?.advance;

  // Dynamic document control numbers and total amounts
  const COMMON_ADV_NO = selectedId && activeAdv ? activeAdv.id : '-';
  const COMMON_CLR_NO = selectedId && activeCand ? activeCand.id : '-';
  const advanceAmount = selectedId && activeAdv ? (activeAdv.appAmount || activeAdv.amount) : 0;

  // --- 1. STATE FOR NOTIFICATIONS (TOAST) ---
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'warning' | 'info' }>({
    show: false,
    message: '',
    type: 'success'
  });

  // --- 2. STATE FOR DOCUMENT FLOW STATUS ---
  // 'reviewing' = กำลังตรวจสอบ, 'partial' = เคลียร์บางส่วน, 'closed' = ปิดยอดถาวร (Lock และเซ็นครบ)
  const [advanceFlowStatus, setAdvanceFlowStatus] = useState<'reviewing' | 'partial' | 'closed'>('reviewing');

  // --- 3. STATE FOR CLEARANCE ITEMS ACTION & EDITING ---
  const [items, setItems] = useState<any[]>([]);

  // States สำหรับโหมดแก้ไข Inline Edit
  const [editingId, setEditingId] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

  // --- 4. STATE FOR DOCUMENT CHECKLIST & PREVIEW ---
  const [documents, setDocuments] = useState<any[]>([]);

  // --- 5. STATE FOR DOCUMENT VAULT ---
  const [vaultedDocs, setVaultedDocs] = useState<Array<{
    id: string;
    timestamp: string;
    type: 'partial' | 'closed';
    totalApproved: number;
    totalUnapproved: number;
    balanceToClear: number;
    itemsSnap: Array<any>;
    googleDrivePath: string;
  }>>([]);

  // แท็บเอกสารทั้งหมดสำหรับ Preview ด้านซ้าย
  const [activePreview, setActivePreview] = useState<any>({ 
    id: 'clr', 
    name: 'ใบเคลียร์ยอด (CLR)', 
    type: 'system', 
    icon: FileSpreadsheet, 
    fileLabel: COMMON_CLR_NO, 
    colorTheme: 'pastel-purple' 
  });

  // --- Synchronize component states when selected advance shifts ---
  useEffect(() => {
    if (!activeAdv) {
      setItems([]);
      setDocuments([]);
      setReceivedDate('2026-06-23');
      setVaultedDocs([]);
      setAdvanceFlowStatus('reviewing');
      setAccountingStatus('incomplete');
      return;
    }

    // 1. Set advance flow status based on database status
    if (activeAdv.status === 'CLOSED') {
      setAdvanceFlowStatus('closed');
      setAccountingStatus('complete');
    } else if (activeAdv.status === 'PARTIAL_CLEARANCE' || activeAdv.status === 'WAITING_PHYSICAL_DOCS' || activeAdv.reviewStatus === 'PARTIAL') {
      setAdvanceFlowStatus('partial');
      setAccountingStatus('incomplete');
    } else {
      setAdvanceFlowStatus('reviewing');
      setAccountingStatus('incomplete');
    }

    // 2. Map and flatten database receipts & items to display table items
    const flattenedItems: any[] = [];
    let itemCounter = 1;
    if (activeAdv.receipts && activeAdv.receipts.length > 0) {
      activeAdv.receipts.forEach((rc: any) => {
        const rItems = rc.items || [];
        if (rItems.length > 0) {
          rItems.forEach((it: any) => {
            flattenedItems.push({
              id: it.id || `item-${itemCounter++}`,
              receiptId: rc.id,
              date: rc.date || activeAdv.reqDate || '22/06/26',
              clrNo: rc.id || 'CLR-PENDING',
              project: (() => {
                if (it.projectId) {
                  const matchedProj = masterProjects.find((p: any) => p.id === it.projectId || p.code === it.projectId);
                  if (matchedProj) return matchedProj.name;
                  const standardProjects = [
                    { id: 'PRJ-001', name: 'POSH-HQ (สำนักงานใหญ่)' },
                    { id: 'PRJ-002', name: 'POSH-KCL (ปรับปรุงสายการผลิต)' },
                    { id: 'PRJ-003', name: 'POSH-WEL (ศูนย์กระจายสินค้า)' },
                    { id: 'PRJ-004', name: 'POSH-GRE (คลังสินค้ากรีนเลค)' },
                    { id: 'PRJ-005', name: 'POSH-URB (โครงการเออเบินแลนด์)' },
                    { id: 'PRJ-006', name: 'POSH-RIV (โครงการริเวอร์ไซด์)' }
                  ];
                  const stdProj = standardProjects.find(p => p.id === it.projectId);
                  if (stdProj) return stdProj.name;
                  return it.projectId;
                }
                return activeAdv.pName || 'KCL';
              })(),
              category: it.category || activeAdv.catName || 'ค่าใช้จ่าย',
              description: it.desc || 'รายการค่าใช้จ่าย',
              vat: (((it.price * it.qty) * (it.vat || 0)) / 100).toFixed(2),
              wht: (((it.price * it.qty) * (it.wht || 0)) / 100).toFixed(2),
              discount: '0.00',
              net: (it.price * it.qty).toLocaleString(undefined, { minimumFractionDigits: 2 }),
              action: it.status === 'APPROVED' ? 'approved' : it.status === 'REJECTED' ? 'rejected' : null,
              rejectReason: it.rejectReason || it.reason || ''
            });
          });
        } else {
          flattenedItems.push({
            id: rc.id || `item-${itemCounter++}`,
            receiptId: rc.id,
            date: rc.date || activeAdv.reqDate || '22/06/26',
            clrNo: rc.id || 'CLR-PENDING',
            project: activeAdv.pName || 'KCL',
            category: activeAdv.catName || 'ค่าใช้จ่าย',
            description: rc.vendor || 'บิลไม่มีรายการย่อย',
            vat: (rc.vatAmount || 0).toFixed(2),
            wht: (rc.whtAmount || 0).toFixed(2),
            discount: '0.00',
            net: (rc.netTotal || rc.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
            action: rc.status === 'APPROVED' ? 'approved' : rc.status === 'REJECTED' ? 'rejected' : null,
            rejectReason: rc.rejectReason || rc.reason || ''
          });
        }
      });
    } else if (activeAdv.clrs && activeAdv.clrs.length > 0) {
      activeAdv.clrs.forEach((clr: any, idx: number) => {
        flattenedItems.push({
          id: clr.id || `item-fallback-${idx}`,
          clrNo: clr.id || 'CLR-PENDING',
          date: clr.date || activeAdv.reqDate || '22/06/26',
          project: activeAdv.pName || 'KCL',
          category: activeAdv.catName || 'ค่าใช้จ่าย',
          description: clr.note || 'การเคลียร์เงินทดรองจ่าย',
          vat: '0.00',
          wht: '0.00',
          discount: '0.00',
          net: (clr.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
          action: activeAdv.status === 'CLOSED' ? 'approved' : null,
          rejectReason: clr.rejectReason || clr.reason || ''
        });
      });
    } else {
      // Intentionally left blank: do not add fallback mock items
    }
    setItems(flattenedItems);

    // 3. Map physical attachments and receipts to the checklist documents
    const initialDocs: any[] = [];
    let docCounter = 1;
    if (activeAdv.receipts && activeAdv.receipts.length > 0) {
      activeAdv.receipts.forEach((rc: any) => {
        initialDocs.push({
          id: docCounter++,
          receiptId: rc.id,
          type: `ใบเสร็จ/ใบกำกับภาษี (${rc.vendor || 'ไม่ระบุร้านค้า'})`,
          fileLabel: rc.fileName || `บิลเลขที่ ${rc.receiptNo || rc.id || 'REC-1'}`,
          name: rc.fileName || `${rc.id || 'REC-1'}.pdf`,
          url: rc.fileUrl || '',
          aiDetected: true,
          originalReceived: rc.status === 'APPROVED',
          remark: rc.aiFeedback || ''
        });
      });
    }

    // Fetch and sync real files from API in real-time
    console.log("Fetching files for advance:", activeAdv.id);
    fetch(`/api/files?relatedId=${activeAdv.id}`)
      .then(r => {
        console.log("Fetch response status:", r.status);
        return r.ok ? r.json() : [];
      })
      .then((realFiles: any[]) => {
        console.log("Fetched files:", realFiles);
        const dbDocs = [...initialDocs];
        if (realFiles && realFiles.length > 0) {
          realFiles.forEach((f: any) => {
            if (!dbDocs.some(d => d.name === f.originalName || d.url === f.url)) {
              let docType = 'เอกสารแนบ';
              if (f.relatedType === 'CLEARANCE_MAIN') docType = 'ใบเสร็จหลัก';
              else if (f.relatedType === 'CLEARANCE_EXTRA') docType = 'เอกสารประกอบ';
              else if (f.relatedType === 'ADVANCE_REQUEST') docType = 'เอกสารขอเบิก';

              dbDocs.push({
                id: f.id || `file-${docCounter++}`,
                type: docType,
                fileLabel: f.originalName || f.fileName,
                name: f.originalName || f.fileName,
                url: f.url,
                mimeType: f.mimeType,
                isImage: f.isImage,
                aiDetected: true,
                originalReceived: true,
                remark: f.source ? `อัปโหลดผ่านหน้า ${f.source}` : 'คลังข้อมูลดิจิทัล'
              });
            }
          });
        }
        setDocuments(dbDocs);
      })
      .catch(err => {
        console.error("Error fetching files for advance:", err);
        if (err instanceof Error) {
            console.error("Error message:", err.message);
            console.error("Error stack:", err.stack);
        }
        setDocuments(initialDocs);
      });

    // 4. Reset viewer pane to show Clearance Report (CLR) by default
    setActivePreview({ 
      id: 'clr', 
      name: 'ใบเคลียร์ยอด (CLR)', 
      type: 'system', 
      icon: FileSpreadsheet, 
      fileLabel: activeAdv.clrNo || 'CLR-PENDING', 
      colorTheme: 'pastel-purple' 
    });

    setReceivedDate(activeAdv.reqDate || '2026-06-23');
    setVaultedDocs(activeAdv.vaultedDocs || []);

  }, [activeAdv?.id]);

  // แท็บเอกสารทั้งหมดสำหรับ Preview ด้านซ้าย
  const allPreviews = [
    { id: 'clr', name: 'ใบเคลียร์ยอด (CLR)', type: 'system', icon: FileSpreadsheet, fileLabel: COMMON_CLR_NO, colorTheme: 'pastel-purple' },
    { id: 'adv', name: 'ใบเบิกเงิน (ADV)', type: 'system', icon: FileText, fileLabel: COMMON_ADV_NO, colorTheme: 'pastel-blue' },
    ...documents.map(d => ({ 
      id: `doc-${d.id}`, 
      name: d.type.split(' ')[0], 
      type: 'evidence', 
      icon: Paperclip, 
      fileLabel: d.fileLabel, 
      fullName: d.name,
      url: d.url,
      mimeType: d.mimeType,
      isImage: d.isImage,
      colorTheme: typeof d.id === 'number' && d.id % 2 === 0 ? 'pastel-pink' : 'pastel-yellow'
    })),
    ...vaultedDocs.map(v => ({
      id: `vault-${v.id}`,
      name: `รายงาน-${v.id.substring(13)}`,
      type: 'vault',
      icon: FolderLock,
      fileLabel: v.id,
      colorTheme: 'pastel-purple',
      vaultData: v
    }))
  ];

  // --- 6. STATE FOR ACCOUNTING STATUS VERDICT ---
  const [accountingStatus, setAccountingStatus] = useState<'complete' | 'incomplete' | 'more_docs'>('incomplete');
  const [receivedDate, setReceivedDate] = useState('2026-06-23');
  const [receiverName, setReceiverName] = useState('นางสาวเบญจวรรณ นิ่มสุข');

  const currentAdv = advances.find((a: any) => a.id === activeAdv?.advId);

  // กรองรายการค่าใช้จ่ายให้แสดงผลเฉพาะบิลเคลียร์ยอดที่เลือกในแถบซ้าย (CLR ที่เลือก)
  const currentClrItems = React.useMemo(() => {
    // ถ้าไม่มี clrNo ให้ถือว่าผ่านการกรอง (เป็นรายการทั่วไปหรือ fallback) หรือตรงกับ COMMON_CLR_NO
    return items.filter((it: any) => !it.clrNo || it.clrNo === COMMON_CLR_NO || it.clrNo === 'CLR-PENDING');
  }, [items, COMMON_CLR_NO]);

  // --- 7. CALCULATIONS WITH NEW BUSINESS LOGIC (ยึดตามรายการที่อนุมัติเท่านั้น) ---
  // ยอดรวมทั้งหมดที่ยื่นเข้ามาเคลียร์ (Submitted Amount)
  const totalSubmittedNet = currentClrItems.reduce((acc, item) => acc + parseFloat((item.net || '0').replace(/,/g, '')), 0);
  
  // ยอดรวม "เฉพาะรายการที่บัญชีกดอนุมัติ" เท่านั้น (Approved Cleared Amount)
  const totalApprovedNet = currentClrItems
    .filter(item => item.action === 'approved')
    .reduce((acc, item) => acc + parseFloat((item.net || '0').replace(/,/g, '')), 0);

  // ยอด VAT และ WHT สะสมของรายการที่ได้รับการอนุมัติแล้วเท่านั้น
  const totalApprovedVat = currentClrItems
    .filter(item => item.action === 'approved')
    .reduce((acc, item) => acc + parseFloat((item.vat || '0').replace(/,/g, '')), 0);

  const totalApprovedWht = currentClrItems
    .filter(item => item.action === 'approved')
    .reduce((acc, item) => acc + parseFloat((item.wht || '0').replace(/,/g, '')), 0);

  const totalNetAll = currentClrItems.reduce((acc, item) => acc + parseFloat((item.net || '0').replace(/,/g, '')), 0);
  const totalVatAll = currentClrItems.reduce((acc, item) => acc + parseFloat((item.vat || '0').replace(/,/g, '')), 0);
  const totalWhtAll = currentClrItems.reduce((acc, item) => acc + parseFloat((item.wht || '0').replace(/,/g, '')), 0);
  const totalDiscountAll = currentClrItems.reduce((acc, item) => acc + parseFloat((item.discount || '0').replace(/,/g, '')), 0);
  const totalOthersAll = 0; // Currently not in data, but placeholder for template compatibility

  // --- NEW: Template Data Helpers ---
  const projectSummary = React.useMemo(() => {
    const summary: Record<string, { name: string, total: number, fullName: string }> = {};
    currentClrItems.forEach(item => {
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
      summary[pCode].total += parseFloat((item.net || '0').replace(/,/g, ''));
    });
    return summary;
  }, [currentClrItems]);

  const evidenceFilesList = React.useMemo(() => {
    return documents.map(d => ({
      id: d.id,
      type: (d.type || 'etc').split(' ')[0].toLowerCase(),
      label: d.fileLabel,
      name: d.name
    }));
  }, [documents]);

  const ITEMS_PER_PAGE = 5;
  const totalPages = Math.max(1, Math.ceil(currentClrItems.length / ITEMS_PER_PAGE));
  // ----------------------------------

  // ยอดเงินที่ยังไม่ได้รับอนุมัติ (รวมถึงปฏิเสธ, รอแก้ไข หรือยังไม่ได้ตรวจ) 
  // ซึ่งจะถูกตีกลับไปเป็นยอดที่พนักงานต้องรับผิดชอบนำส่งหลักฐานเพิ่ม หรือต้องโอนเงินคืนคลัง
  const pendingOrRejectedNet = totalSubmittedNet - totalApprovedNet;

  // ยอดเงินคงค้างที่พนักงานต้องเคลียร์เพิ่ม หรือส่งคืนคลังทั้งหมด 
  // สูตรการคำนวณ: วงเงินล่วงหน้าทั้งหมดที่เบิกไป (10,000.00) หักลบด้วยยอดที่บัญชี 'อนุมัติผ่าน' แล้วเท่านั้น
  const balanceAmount = advanceAmount - totalApprovedNet;

  // --- TRIGGER ALIGNMENT STATUS LOGIC ---
  useEffect(() => {
    if (documents.length === 0 || items.length === 0) return;
    const allDocsChecked = documents.every(doc => doc.originalReceived);
    const allItemsApproved = items.every(item => item.action === 'approved');
    if (allDocsChecked && allItemsApproved && advanceFlowStatus === 'reviewing') {
      setAccountingStatus('complete');
    }
  }, [documents, items]);

  const showToast = (message: string, type: 'success' | 'warning' | 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => { setToast(prev => ({ ...prev, show: false })); }, 4500);
  };

  // --- HANDLERS FOR TABLE ACTIONS ---
  const toggleItemAction = (itemId: any, actionType: 'approved' | 'rejected') => {
    if (advanceFlowStatus === 'closed') {
      showToast('ไม่สามารถเปลี่ยนสถานะรายการได้ เนื่องจากบัญชีได้ปิดยอดและล็อกเอกสารชุดนี้ไปแล้ว', 'warning');
      return;
    }
    if (editingId === itemId) return; 
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, action: item.action === actionType ? null : actionType };
      }
      return item;
    }));
  };

  // --- HANDLERS FOR INLINE EDITING ---
  const startEdit = (item: any) => {
    if (advanceFlowStatus === 'closed') {
      showToast('ไม่สามารถแก้ไขข้อมูลได้ เนื่องจากบัญชีได้ปิดยอดและล็อกเอกสารชุดนี้ไปแล้ว', 'warning');
      return;
    }
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = () => {
    setItems(prev => prev.map(item => item.id === editingId ? { ...editForm, action: null } : item));
    setEditingId(null);
    setEditForm(null);
    showToast('บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว รายการถูกรีเซ็ตสถานะให้ตรวจสอบใหม่', 'success');
  };

  const handleEditChange = (field: string, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  // --- HANDLERS FOR DOCUMENTS ---
  const handleOriginalCheckbox = (docId: number) => {
    if (advanceFlowStatus === 'closed') {
      showToast('ไม่สามารถทำรายการได้ เนื่องจากบัญชีได้ทำการปิดยอดเรียบร้อยแล้ว', 'warning');
      return;
    }
    setDocuments(prev => prev.map(doc => doc.id === docId ? { ...doc, originalReceived: !doc.originalReceived } : doc));
  };

  const handleDocRemark = (docId: number, remarkText: string) => {
    setDocuments(prev => prev.map(doc => doc.id === docId ? { ...doc, remark: remarkText } : doc));
  };

  // --- NEW LOGIC: AUTOMATIC DOCUMENT GENERATION & SYNCHRONIZATION ---
  const createAuditDocument = async (type: 'partial' | 'closed') => {
    const reportSeq = vaultedDocs.length + 1;
    const auditId = `AUD-${COMMON_CLR_NO.substring(4)}-${String(reportSeq).padStart(2, '0')}`;
    const timestamp = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
    const googleDrivePath = `Google Drive/POSH/CLR-2606-009/${auditId}.pdf`;

    const newAuditReport = {
      id: auditId,
      timestamp: `${new Date().toLocaleDateString('th-TH')} ${timestamp}`,
      type,
      totalApproved: totalApprovedNet,
      totalUnapproved: pendingOrRejectedNet,
      balanceToClear: balanceAmount,
      itemsSnap: JSON.parse(JSON.stringify(currentClrItems)), // คัดลอก Snapshot รายการ ณ วินาทีนั้น
      googleDrivePath
    };

    setVaultedDocs(prev => [newAuditReport, ...prev]);

    // สลับฝั่ง Preview ซ้ายไปแสดงไฟล์ผลงานตรวจสอบที่พึ่งเจเนอเรตขึ้นมาใหม่ทันที
    const previewObj = {
      id: `vault-${auditId}`,
      name: `รายงาน-${reportSeq}`,
      type: 'vault',
      icon: FolderLock,
      fileLabel: auditId,
      colorTheme: 'pastel-purple',
      vaultData: newAuditReport
    };
    setActivePreview(previewObj);

    if (activeAdv) {
      try {
        const docId = `VLT-${Date.now()}`;
        const vaultDoc = {
          id: docId,
          advId: activeAdv.id,
          clrId: COMMON_CLR_NO,
          date: new Date().toISOString(),
          type: type === 'partial' ? 'รายงานตรวจสอบใบเคลียร์บางส่วน (Audit)' : 'รายงานตรวจสอบใบเคลียร์ปิดยอด (Audit)',
          fileName: `${auditId}.pdf`,
          status: type === 'partial' ? 'PARTIAL_CLEARANCE' : 'CLOSED',
          isClearanceReport: true,
          itemsSnap: newAuditReport.itemsSnap,
          vaultData: newAuditReport
        };
        
        const response = await fetch('/api/store/vault-docs');
        const loaded = await response.json().catch(() => []);
        const next = [vaultDoc, ...(Array.isArray(loaded) ? loaded : [])];
        
        await fetch('/api/store/vault-docs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next)
        });
      } catch (err) {
        console.error('Failed to save to Document Vault', err);
      }
    }
  };

  const handleSavePartial = () => {
    if (!activeAdv) return;
    setAdvanceFlowStatus('partial');
    createAuditDocument('partial');

    // Update global database state
    const updatedReceipts = activeAdv.receipts?.map((rc: any) => {
      const rcItems = rc.items || [];
      const nextItems = rcItems.map((it: any) => {
        const matchingItem = items.find((f: any) => f.id === it.id);
        if (matchingItem) {
          return { 
            ...it, 
            status: matchingItem.action === 'approved' ? 'APPROVED' : matchingItem.action === 'rejected' ? 'REJECTED' : 'PENDING',
            rejectReason: matchingItem.rejectReason || '',
            reason: matchingItem.rejectReason || ''
          };
        }
        return it;
      });
      const allApproved = nextItems.every((it: any) => it.status === 'APPROVED');
      const anyRejected = nextItems.some((it: any) => it.status === 'REJECTED');
      const receiptStatus = allApproved ? 'APPROVED' : anyRejected ? 'REJECTED' : 'PENDING';
      
      const matchingRcItem = items.find((f: any) => f.id === rc.id);
      const rcRejectReason = matchingRcItem ? (matchingRcItem.rejectReason || '') : '';

      return {
        ...rc,
        items: nextItems,
        status: receiptStatus,
        rejectReason: rcRejectReason,
        reason: rcRejectReason
      };
    }) || [];

    const newTrackingRecord = {
      id: `TRK-${COMMON_CLR_NO.substring(4)}`,
      status: 'Not Started',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      documents: [
        { type: 'Receipt', attached: true, physical: false, receivedDate: null },
        { type: 'Tax Invoice', attached: true, physical: false, receivedDate: null },
        { type: 'Delivery Note', attached: false, physical: false, receivedDate: null },
        { type: 'WHT Certificate', attached: false, physical: false, receivedDate: null }
      ],
      timeline: [
        { date: new Date().toISOString(), action: 'Submit Clearance', status: 'completed' },
        { date: new Date().toISOString(), action: 'Accounting Approved', status: 'completed' }
      ]
    };

    updateAdvance(activeAdv.id, {
      status: 'PARTIAL_CLEARANCE',
      reviewStatus: 'PARTIAL',
      receipts: updatedReceipts,
      clrAmount: totalApprovedNet,
      trackingRecord: newTrackingRecord as any
    });

    showToast(`บันทึกสถานะ "บันทึกการเคลียร์บางส่วน" สำเร็จ! และสร้าง Document Tracking อัตโนมัติ`, 'success');
    setTimeout(() => {
      setPage('document-tracking', { advId: activeAdv.id });
    }, 1500);
  };

  const handleWaitPhysicalDocs = () => {
    if (!activeAdv) return;
    const uncheckedItems = currentClrItems.some(item => item.action === null);
    if (uncheckedItems) {
      showToast('กรุณากดตรวจสอบอนุมัติ / ปฏิเสธ รายการค่าใช้จ่ายทั้งหมดก่อนบันทึกสถานะรอเอกสารตัวจริง', 'warning');
      return;
    }
    setAdvanceFlowStatus('partial');
    setAccountingStatus('incomplete');
    createAuditDocument('partial');

    // Update global database state
    const updatedReceipts = activeAdv.receipts?.map((rc: any) => {
      const rcItems = rc.items || [];
      const nextItems = rcItems.map((it: any) => {
        const matchingItem = items.find((f: any) => f.id === it.id);
        if (matchingItem) {
          return { 
            ...it, 
            status: matchingItem.action === 'approved' ? 'APPROVED' : 'REJECTED',
            rejectReason: matchingItem.rejectReason || '',
            reason: matchingItem.rejectReason || ''
          };
        }
        return it;
      });
      const allApproved = nextItems.every((it: any) => it.status === 'APPROVED');
      const anyRejected = nextItems.some((it: any) => it.status === 'REJECTED');
      const receiptStatus = allApproved ? 'APPROVED' : anyRejected ? 'REJECTED' : 'PENDING';
      
      const matchingRcItem = items.find((f: any) => f.id === rc.id);
      const rcRejectReason = matchingRcItem ? (matchingRcItem.rejectReason || '') : '';

      return {
        ...rc,
        items: nextItems,
        status: receiptStatus,
        rejectReason: rcRejectReason,
        reason: rcRejectReason
      };
    }) || [];

    const newTrackingRecord = {
      id: `TRK-${COMMON_CLR_NO.substring(4)}`,
      status: 'Not Started',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      documents: [
        { type: 'Receipt', attached: true, physical: false, receivedDate: null },
        { type: 'Tax Invoice', attached: true, physical: false, receivedDate: null },
        { type: 'Delivery Note', attached: false, physical: false, receivedDate: null },
        { type: 'WHT Certificate', attached: false, physical: false, receivedDate: null }
      ],
      timeline: [
        { date: new Date().toISOString(), action: 'Submit Clearance', status: 'completed' },
        { date: new Date().toISOString(), action: 'Accounting Approved (Wait Physical Docs)', status: 'completed' }
      ]
    };

    updateAdvance(activeAdv.id, {
      status: 'WAITING_PHYSICAL_DOCS',
      reviewStatus: 'PARTIAL',
      receipts: updatedReceipts,
      clrAmount: totalApprovedNet,
      trackingRecord: newTrackingRecord as any
    });

    showToast(`บันทึกสถานะ "รอเอกสารตัวจริง" สำเร็จ! และสร้าง Document Tracking อัตโนมัติ`, 'success');
    setTimeout(() => {
      setPage('document-tracking', { advId: activeAdv.id });
    }, 1500);
  };

  const handleFinalClose = () => {
    const uncheckedItems = currentClrItems.some(item => item.action === null);
    if (uncheckedItems) {
      showToast('กรุณากดตรวจสอบอนุมัติ / ปฏิเสธ รายการค่าใช้จ่ายทั้งหมดก่อนทำการปิดยอดบัญชี', 'warning');
      return;
    }
    setAdvanceFlowStatus('closed');
    setAccountingStatus('complete');
    createAuditDocument('closed');

    // Update global database state
    if (activeAdv) {
      const updatedReceipts = activeAdv.receipts?.map((rc: any) => {
        const rcItems = rc.items || [];
        const nextItems = rcItems.map((it: any) => {
          const matchingItem = items.find((f: any) => f.id === it.id);
          if (matchingItem) {
            return { 
              ...it, 
              status: matchingItem.action === 'approved' ? 'APPROVED' : 'REJECTED',
              rejectReason: matchingItem.rejectReason || '',
              reason: matchingItem.rejectReason || ''
            };
          }
          return { ...it, status: 'APPROVED' };
        });
        const allApproved = nextItems.every((it: any) => it.status === 'APPROVED');
        
        const matchingRcItem = items.find((f: any) => f.id === rc.id);
        const rcRejectReason = matchingRcItem ? (matchingRcItem.rejectReason || '') : '';

        return {
          ...rc,
          items: nextItems,
          status: allApproved ? 'APPROVED' : 'REJECTED',
          rejectReason: rcRejectReason,
          reason: rcRejectReason
        };
      }) || [];

      const newTrackingRecord = {
        id: `TRK-${COMMON_CLR_NO.substring(4)}`,
        status: 'Not Started',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        documents: [
          { type: 'Receipt', attached: true, physical: false, receivedDate: null },
          { type: 'Tax Invoice', attached: true, physical: false, receivedDate: null },
          { type: 'Delivery Note', attached: false, physical: false, receivedDate: null },
          { type: 'WHT Certificate', attached: false, physical: false, receivedDate: null }
        ],
        timeline: [
          { date: new Date().toISOString(), action: 'Submit Clearance', status: 'completed' },
          { date: new Date().toISOString(), action: 'Accounting Approved', status: 'completed' }
        ]
      };

    if (!activeAdv) return;
    updateAdvance(activeAdv.id, {
      status: 'CLOSED',
      reviewStatus: 'APPROVED',
      receipts: updatedReceipts,
      clrAmount: totalApprovedNet,
      trackingRecord: newTrackingRecord as any
    });
    }

    showToast(`ปิดยอดเรียบร้อย! สร้าง Document Tracking อัตโนมัติ`, 'success');
    setTimeout(() => {
      setPage('document-tracking', { advId: activeAdv?.id });
    }, 1500);
  };

  const handleReturnDocument = () => {
    if (!activeAdv) return;
    
    // Check if there's any remark/reason given for return
    const hasRejections = items.some(item => item.action === 'rejected' && item.rejectReason);
    if (!hasRejections) {
      showToast('กรุณาระบุรายการที่ไม่อนุมัติพร้อมเหตุผล ก่อนทำการตีกลับเอกสาร', 'warning');
      return;
    }

    // Update global database state
    const updatedReceipts = activeAdv.receipts?.map((rc: any) => {
      const rcItems = rc.items || [];
      const nextItems = rcItems.map((it: any) => {
        const matchingItem = items.find((f: any) => f.id === it.id);
        if (matchingItem) {
          return { 
            ...it, 
            status: matchingItem.action === 'approved' ? 'APPROVED' : matchingItem.action === 'rejected' ? 'REJECTED' : 'PENDING',
            rejectReason: matchingItem.rejectReason || '',
            reason: matchingItem.rejectReason || ''
          };
        }
        return it;
      });
      const allApproved = nextItems.every((it: any) => it.status === 'APPROVED');
      const anyRejected = nextItems.some((it: any) => it.status === 'REJECTED');
      const receiptStatus = allApproved ? 'APPROVED' : anyRejected ? 'REJECTED' : 'PENDING';
      
      const matchingRcItem = items.find((f: any) => f.id === rc.id);
      const rcRejectReason = matchingRcItem ? (matchingRcItem.rejectReason || '') : '';

      return {
        ...rc,
        items: nextItems,
        status: receiptStatus,
        rejectReason: rcRejectReason,
        reason: rcRejectReason
      };
    }) || [];

    updateAdvance(activeAdv.id, {
      status: 'RETURNED',
      reviewStatus: 'REJECTED',
      receipts: updatedReceipts,
    });

    showToast(`ตีกลับเอกสารสำเร็จ ระบบได้แจ้งไปยังผู้เบิกแล้ว`, 'success');
    setTimeout(() => {
      setPage('dashboard');
    }, 1500);
  };

  const handleReset = () => {
    if (!activeAdv) return;

    // Reset current receipts to PENDING status in global state
    const updatedReceipts = activeAdv.receipts?.map((rc: any) => {
      const rcItems = rc.items || [];
      const nextItems = rcItems.map((it: any) => ({ ...it, status: 'PENDING' }));
      return { ...rc, items: nextItems, status: 'PENDING' };
    }) || [];

    updateAdvance(activeAdv.id, {
      status: 'WAITING_CLEARANCE',
      reviewStatus: 'PENDING',
      receipts: updatedReceipts,
      clrAmount: 0
    });

    setItems(prev => prev.map(item => ({ ...item, action: null })));
    setDocuments(prev => prev.map(doc => ({ ...doc, originalReceived: false, remark: '' })));
    setAccountingStatus('incomplete');
    setAdvanceFlowStatus('reviewing');
    setVaultedDocs([]);
    setActivePreview({ id: 'adv', name: 'ใบเบิกเงิน (ADV)', type: 'system', icon: FileText, fileLabel: COMMON_ADV_NO, colorTheme: 'pastel-blue' });
    showToast('รีเซ็ตข้อมูลและสถานะการตรวจสอบบัญชีเรียบร้อยแล้ว', 'info');
  };

  return (
    <div className="bg-[#fcfdfe] min-h-screen text-slate-700 flex flex-col justify-between animate-fade-in" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap');`}</style>

      {/* --- TOAST ALERTS --- */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-50 animate-bounce shadow-xl flex items-center gap-3 bg-white border-l-4 border-sky-400 text-slate-800 rounded-xl p-4 max-w-md border border-slate-100">
          {toast.type === 'success' ? <div className="bg-sky-100 p-1.5 rounded-full text-sky-600"><CheckCircle2 size={18} /></div>
           : toast.type === 'warning' ? <div className="bg-pink-100 p-1.5 rounded-full text-pink-600"><AlertCircle size={18} /></div>
           : <div className="bg-purple-100 p-1.5 rounded-full text-purple-600"><Sparkles size={18} /></div>}
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-800">ระบบตรวจสอบบัญชี</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{toast.message}</p>
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <header className="border-b border-slate-100 bg-white/95 backdrop-blur sticky top-0 z-40 px-6 py-3 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-300 via-purple-300 to-pink-300 flex items-center justify-center shadow-sm animate-pulse">
              <ClipboardCheck className="text-white" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold text-slate-850">Accounting Review Portal</h1>
                <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">ADV REGULATION v2</span>
              </div>
              <p className="text-[11px] text-slate-400">ระบบคัดแยกยอดเงินเคลียร์และเจเนอเรตรายงานตรวจสอบคู่ขนาน 50:50</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
              <label htmlFor="clearance-select" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">เลือกรายการเคลียร์ยอด:</label>
              <select
                id="clearance-select"
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  if (e.target.value) {
                    showToast('โหลดข้อมูลรายการ ' + e.target.value + ' สำเร็จ', 'info');
                  }
                }}
                className="bg-white border border-slate-200 text-xs font-bold py-1 px-2.5 rounded-lg text-slate-700 outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all cursor-pointer min-w-[220px]"
              >
                <option value="">-- กรุณาเลือกรายการเคลียร์ยอด --</option>
                {candidates.map(cand => {
                  const d = new Date(cand.latestDate);
                  const dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
                  return (
                    <option key={`${cand.id}-${cand.advId}`} value={cand.id}>
                      {cand.id} - {cand.empName || 'ไม่ระบุผู้เบิก'} ({cand.amount?.toLocaleString()} บาท) {dateStr ? `[${dateStr}]` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            
            <button 
              onClick={handleReset}
              className="bg-white hover:bg-slate-50 text-slate-400 border border-slate-200 text-[10px] font-semibold py-2 px-2.5 rounded-xl transition-all"
              title="รีเซ็ตสเตตัสเอกสารนี้"
            >
              รีเซ็ต
            </button>
          </div>
        </div>
      </header>

      {/* --- MAIN BODY --- */}
      <main className="flex-1 px-4 py-6 max-w-[1600px] w-full mx-auto space-y-6">

        {/* --- SECTION: SUMMARY CARD & GENERAL INFO (PASTEL SECTIONS) --- */}
        {!selectedId ? (
          <div className="bg-[#FFF8F5] border border-dashed border-[#FAD6C5] rounded-2xl p-8 text-center flex flex-col items-center justify-center py-12 shadow-sm animate-fade-in">
            <div className="w-12 h-12 bg-[#FFF3EE] text-[#E75618] rounded-full flex items-center justify-center mb-3.5 border border-[#FDE3D8]">
              <Sparkles size={22} className="text-[#E75618]" />
            </div>
            <h3 className="font-bold text-slate-750 text-sm mb-1.5 font-['Noto_Sans_Thai']">หากยังไม่ได้กดเลือกรายการเคลียร์ยอด ข้อมูลในส่วนนี้จะยังไม่ปรากฏในหน้าแรก</h3>
            <p className="text-slate-500 text-xs max-w-md leading-normal font-['Noto_Sans_Thai']">
              กรุณาคลิกเลือกเอกสารใบเคลียร์ยอดจากเมนูดรอปดาวน์ **"เลือกรายการเคลียร์ยอด"** ด้านบน เพื่อเปิดแสดงรายละเอียดข้อมูลสรุป ผู้รับผิดชอบ และข้อมูลร้านค้าคู่ค้าที่ตรวจจับด้วย AI
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Card 1: Document Reference */}
            <div className="bg-purple-50/40 rounded-2xl border border-purple-100 p-5 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-bold text-purple-700 tracking-wider bg-purple-100/60 px-3 py-1 rounded-full border border-purple-200">รหัสใบงานและสถานะ</span>
                  {activeAdv.status === 'CLOSED' ? (
                    <span className="text-[9px] font-bold text-pink-700 bg-pink-100 px-2 py-0.5 rounded-full border border-pink-200 flex items-center gap-1">
                      <Lock size={10} /> LOCK อนุมัติปิดยอดแล้ว
                    </span>
                  ) : activeAdv.status === 'WAITING_PHYSICAL_DOCS' ? (
                    <span className="text-[9px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                      <FileText size={10} /> รอเอกสารตัวจริง
                    </span>
                  ) : activeAdv.status === 'PARTIAL_CLEARANCE' ? (
                    <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                      <Unlock size={10} /> เคลียร์บางส่วน
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full border border-sky-200 flex items-center gap-1">
                      <Unlock size={10} /> อยู่ระหว่างตรวจสอบ
                    </span>
                  )}
                </div>
                <h3 className="text-xs text-purple-500 mb-1 font-bold font-sans">ใบเคลียร์ยอดเงินทดรองจ่าย (Clearance Report)</h3>
                <p className="text-lg font-bold text-purple-900 tracking-tight">{COMMON_CLR_NO}</p>
                
                <div className="border-t border-purple-200/50 my-3.5"></div>
                
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-purple-600">
                    <span>ใบเบิกล่วงหน้าควบคุม (ADV):</span>
                    <span className="font-mono text-purple-900 font-bold">{COMMON_ADV_NO}</span>
                  </div>
                  <div className="flex justify-between text-purple-600">
                    <span>สถานะการควบคุมเงินเบิก:</span>
                    {advanceFlowStatus === 'closed' ? (
                      <span className="text-pink-600 font-bold">🔒 ปิดบัญชีถาวร (ห้ามเคลียร์ต่อ)</span>
                    ) : (
                      <span className="text-emerald-600 font-bold">🔓 เปิดรับเคลียร์รอบย่อยต่อเนื่อง</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 bg-purple-100/30 p-2.5 rounded-lg border border-purple-200/40 flex items-center gap-2">
                <Info size={14} className="text-purple-500 shrink-0" />
                <p className="text-[10px] text-purple-600 leading-normal">
                  หากพนักงานนำบิลมาส่งเคลียร์ไม่ครบตามยอดเบิก ระบบจะนำยอดบิลที่ไม่ผ่านกลับไปรวมเป็นยอดเงินที่ต้องนำส่งใหม่
                </p>
              </div>
            </div>

            {/* Card 2: ผู้รับผิดชอบงานด้านบน + สรุปยอดบัญชีการเงินด้านล่าง (ตามคำสั่งใหม่เรื่องยอดคงค้างแปรผันเรียลไทม์) */}
            <div className="bg-sky-50/40 rounded-2xl border border-sky-100 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] font-bold text-sky-700 tracking-wider bg-sky-100/60 px-3 py-1 rounded-full border border-sky-200">ผู้รับผิดชอบงาน & ยอดบัญชี</span>
                  <span className="text-[10px] text-sky-400 font-mono">STAFF & BUDGET CONTROL</span>
                </div>

                {/* ข้อมูลผู้รับผิดชอบงาน */}
                <div className="flex items-center gap-3 bg-white/80 p-2.5 rounded-xl border border-sky-100 shadow-xs mb-3">
                  <div className="h-8 w-8 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center text-[10px] font-bold border border-pink-200 shrink-0">
                    {selectedId && activeAdv?.empName ? activeAdv.empName.substring(0, 2).toUpperCase() : '-'}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-xs">{selectedId ? (activeAdv?.empName || '-') : '-'}</p>
                    <p className="text-[10px] text-slate-400">{selectedId ? (activeAdv?.empDept || '-') : '-'} (ผู้ยื่นขอใบเคลียร์)</p>
                  </div>
                </div>

                <div className="border-t border-sky-100 my-2.5"></div>
                
                {/* รายละเอียดสรุปยอดบัญชีการเงินเดิม พร้อมคำนวณแยกส่วนตามรายการที่อนุมัติเท่านั้น */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold">วงเงินเบิกฉุกเฉินล่วงหน้า</p>
                    <p className="text-sm font-bold text-slate-800 font-mono">{advanceAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                    <span className="text-[9px] text-slate-450">บาท (THB)</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-emerald-600 font-bold">ยอดอนุมัติผ่าน (CLR)</p>
                    <p className="text-sm font-bold text-emerald-700 font-mono">{totalApprovedNet.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                    <span className="text-[9px] text-emerald-500">บาท (รวม VAT ที่ผ่านเกณฑ์)</span>
                  </div>
                </div>
              </div>

              {/* ส่วนคืนคลัง / เคลียร์เพิ่ม (คำนวณจากยอดที่บัญชี 'ยังไม่ได้อนุมัติ' ทั้งหมด) */}
              {(() => {
                const isClosed = activeAdv?.status === 'CLOSED' || advanceFlowStatus === 'closed';
                const finalClrAmount = activeAdv?.clrAmount ?? totalApprovedNet;
                const originalAmount = activeAdv?.appAmount ?? activeAdv?.amount ?? 0;
                const diff = originalAmount - finalClrAmount;

                if (isClosed) {
                  if (diff > 0) {
                    return (
                      <div className="mt-3 flex justify-between items-center bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                        <div>
                          <p className="text-[10px] text-emerald-800 font-bold leading-tight">ยอดที่พนักงานโอนคืนบริษัท (ปิดยอดสำเร็จ)</p>
                          <p className="text-[9px] text-emerald-600">พนักงานโอนคืนเศษเงินเหลือจ่ายเข้าระบบเรียบร้อย</p>
                        </div>
                        <span className="text-xs font-bold font-mono px-3 py-1.5 rounded-lg text-emerald-700 bg-emerald-100 border border-emerald-300">
                          {diff.toLocaleString(undefined, {minimumFractionDigits: 2})} บ.
                        </span>
                      </div>
                    );
                  } else if (diff < 0) {
                    return (
                      <div className="mt-3 flex justify-between items-center bg-blue-50 p-2.5 rounded-xl border border-blue-200">
                        <div>
                          <p className="text-[10px] text-blue-800 font-bold leading-tight">ยอดที่บริษัทโอนคืนพนักงาน (ปิดยอดสำเร็จ)</p>
                          <p className="text-[9px] text-blue-600">บริษัทจ่ายชดเชยค่าใช้จ่ายเกินวงเงินเรียบร้อย</p>
                        </div>
                        <span className="text-xs font-bold font-mono px-3 py-1.5 rounded-lg text-blue-700 bg-blue-100 border border-blue-300">
                          {Math.abs(diff).toLocaleString(undefined, {minimumFractionDigits: 2})} บ.
                        </span>
                      </div>
                    );
                  } else {
                    return (
                      <div className="mt-3 flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <div>
                          <p className="text-[10px] text-slate-800 font-bold leading-tight">ยอดเคลียร์ค่าใช้จ่ายพอดีวงเงิน (ปิดยอดสำเร็จ)</p>
                          <p className="text-[9px] text-slate-500">ไม่มีการโอนคืนเงินส่วนต่างระหว่างบริษัทและพนักงาน</p>
                        </div>
                        <span className="text-xs font-bold font-mono px-3 py-1.5 rounded-lg text-slate-700 bg-slate-100 border border-slate-300">
                          0.00 บ.
                        </span>
                      </div>
                    );
                  }
                } else {
                  // Currently in review / open
                  if (balanceAmount > 0) {
                    return (
                      <div className="mt-3 flex justify-between items-center bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                        <div>
                          <p className="text-[10px] text-amber-800 font-bold leading-tight">ยอดประมาณการที่พนักงานต้องโอนคืนบริษัท</p>
                          <p className="text-[9px] text-amber-600">คำนวณจากวงเงินล่วงหน้าหักลบยอดบิลที่อนุมัติ</p>
                        </div>
                        <span className="text-xs font-bold font-mono px-3 py-1.5 rounded-lg text-amber-700 bg-amber-100 border border-amber-300">
                          {balanceAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} บ.
                        </span>
                      </div>
                    );
                  } else if (balanceAmount < 0) {
                    return (
                      <div className="mt-3 flex justify-between items-center bg-pink-50 p-2.5 rounded-xl border border-pink-200">
                        <div>
                          <p className="text-[10px] text-pink-800 font-bold leading-tight">ยอดประมาณการที่บริษัทต้องจ่ายเพิ่มให้พนักงาน</p>
                          <p className="text-[9px] text-pink-600">ค่าใช้จ่ายที่อนุมัติเกินวงเงินล่วงหน้า</p>
                        </div>
                        <span className="text-xs font-bold font-mono px-3 py-1.5 rounded-lg text-pink-700 bg-pink-100 border border-pink-300">
                          {Math.abs(balanceAmount).toLocaleString(undefined, {minimumFractionDigits: 2})} บ.
                        </span>
                      </div>
                    );
                  } else {
                    return (
                      <div className="mt-3 flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <div>
                          <p className="text-[10px] text-slate-800 font-bold leading-tight">ยอดประมาณการค่าใช้จ่ายเท่ากับวงเงินเบิก</p>
                          <p className="text-[9px] text-slate-500">สมดุลยอดคงค้างเป็นศูนย์พอดี</p>
                        </div>
                        <span className="text-xs font-bold font-mono px-3 py-1.5 rounded-lg text-slate-700 bg-slate-100 border border-slate-300">
                          0.00 บ.
                        </span>
                      </div>
                    );
                  }
                }
              })()}
            </div>

            {/* Card 3: ข้อมูลร้านค้า / ผู้ขายที่สแกนด้วย AI */}
            <div className="bg-yellow-50/40 rounded-2xl border border-yellow-100 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] font-bold text-yellow-800 tracking-wider bg-yellow-100/60 px-3 py-1 rounded-full border border-yellow-200">ข้อมูลร้านค้า (สแกนหลักฐาน)</span>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-0.5">
                    <Sparkles size={8} /> AI-OCR Verified
                  </span>
                </div>
                
                {/* ข้อมูลร้านค้าที่ได้จากการที่ AI ตรวจสอบและอ่านจากไฟล์เอกสารของผู้ใช้งาน */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2.5 bg-white/80 p-2.5 rounded-xl border border-yellow-100 shadow-xs">
                    <Store size={18} className="text-yellow-600 mt-0.5 shrink-0" />
                    <div className="space-y-1 flex-1">
                      <p className="font-bold text-slate-800 text-xs">{selectedId ? (activeAdv?.receipts?.[0]?.vendor || '-') : '-'}</p>
                      <div className="grid grid-cols-3 text-[10px] gap-y-1 text-slate-500">
                        <span>เลขผู้เสียภาษี:</span>
                        <span className="col-span-2 font-mono text-slate-700 font-semibold">{selectedId ? (activeAdv?.receipts?.[0]?.taxId || '-') : '-'}</span>
                        <span>สาขา:</span>
                        <span className="col-span-2 text-slate-700">{selectedId ? 'สำนักงานใหญ่ (HQ)' : '-'}</span>
                        <span>ช่องทางจ่าย:</span>
                        <span className="col-span-2 text-slate-700">{selectedId ? 'โอนเงินเข้าบัญชีร้านค้า' : '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-3 bg-yellow-100/30 p-2 rounded-lg border border-yellow-200/40 text-[9px] text-yellow-800 leading-tight">
                <span className="font-bold">หมายเหตุ AI:</span> ตรวจสอบยอดพนักงานจ่ายตรงใบเสร็จ สามารถนำยอดหักสะสมเหล่านี้ไปออกเอกสารภาษีหรือลงงบค่าใช้จ่ายของบริษัทต่อได้ทันที
              </div>
            </div>

          </div>
        )}

        {/* --- SECTION 1: SPLIT SCREEN (LEFT: PREVIEW 50%, RIGHT: INTERACTIVE TABLE 50%) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-auto lg:h-[750px]">
          
          {/* L E F T   P A N E L  :  D O C U M E N T   P R E V I E W (50% WIDTH) */}
          <div className="flex flex-col bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden h-full">
            <div className="p-4 border-b border-slate-150 bg-slate-50/50 flex justify-between items-center shrink-0">
              <h2 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Eye size={16} className="text-sky-500" />
                แสดงตัวอย่างเอกสารอ้างอิง (50%)
              </h2>
              <span className="text-[9px] text-purple-700 bg-purple-50 px-2 py-1 rounded-full border border-purple-100">Live Viewer</span>
            </div>

            {/* Pastel Tabs Selection */}
            <div className="px-4 pt-3 pb-2 flex gap-2 overflow-x-auto shrink-0 custom-scrollbar bg-slate-50/10 border-b border-slate-100">
              {allPreviews.map(preview => {
                const Icon = preview.icon;
                const isActive = activePreview.id === preview.id;
                
                let colorClass = "bg-white text-slate-500 border-slate-200 hover:bg-slate-50";
                if (isActive) {
                  if (preview.colorTheme === 'pastel-blue') {
                    colorClass = "bg-sky-50 text-sky-700 border-sky-300 font-bold";
                  } else if (preview.colorTheme === 'pastel-purple') {
                    colorClass = "bg-purple-50 text-purple-700 border-purple-300 font-bold";
                  } else if (preview.colorTheme === 'pastel-pink') {
                    colorClass = "bg-pink-50 text-pink-700 border-pink-300 font-bold";
                  } else {
                    colorClass = "bg-yellow-50 text-yellow-850 border-yellow-300 font-bold";
                  }
                }

                return (
                  <button 
                    key={preview.id}
                    onClick={() => setActivePreview(preview)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] whitespace-nowrap transition-all border ${colorClass}`}
                  >
                    <Icon size={12} />
                    {preview.name}
                  </button>
                );
              })}
            </div>

            {/* Dynamic Document Mockup Content Viewer */}
            <div className="flex-1 bg-slate-100/80 p-6 overflow-y-auto custom-scrollbar flex flex-col items-center gap-8">
              <style>
                {`
                  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap');
                  .font-noto-thai { font-family: 'Noto Sans Thai', sans-serif !important; }
                  .font-noto-thai * { font-family: 'Noto Sans Thai', sans-serif !important; }
                `}
              </style>
              
              {activePreview.id === 'clr' ? (
                /* 
                   --- REUSABLE CENTRALIZED TEMPLATE: ADVANCE CLEARANCE REPORT ---
                   Using the specialized renderer with responsive scaling to fit preview pane.
                */
                <div className="w-full flex justify-center py-4 bg-slate-100 min-h-full overflow-x-hidden">
                  {activeAdv ? (
                    <ClearanceTemplateRenderer 
                      template={{ id: 'clr-std', name: 'Standard Clearance', type: 'CLEARANCE', version: '2.0', status: 'published', createdAt: new Date().toISOString() } as any} 
                      data={{
                        ...activeAdv,
                        items: currentClrItems,
                        vaultData: activePreview.vaultData,
                        projectFullName: activeAdv?.projectName === 'KCL' ? "K'Chang Lumlukka" : activeAdv?.projectName
                      }} 
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                      <Search size={48} strokeWidth={1} />
                      <p className="text-sm">ไม่พบข้อมูลใบเบิกที่เลือก</p>
                    </div>
                  )}
                </div>
              ) : activePreview.id === 'adv' ? (
                /* ACTUAL IDENTICAL ADVANCE PREVIEW SHEET USING DOCUMENT RENDERER */
                <div className="w-full flex justify-center py-4 bg-slate-100 min-h-full overflow-x-hidden font-sans">
                  {activeAdv ? (
                    <div className="pdf-p shadow-md bg-white border border-slate-200 rounded-3xl overflow-hidden p-0 md:p-6 lg:p-8 flex justify-center items-start min-h-[500px] w-full max-w-[794px]">
                      <FitPageViewer pageWidth={794} pageHeight={1123}>
                        <DocumentRenderer 
                          template={publishedTemplates.advance} 
                          data={{
                            advNo: activeAdv.id,
                            reqDate: activeAdv.reqDate || new Date().toISOString(),
                            employeeName: activeAdv.empName,
                            employeeDept: activeAdv.empDept || activeAdv.position || 'พนักงาน',
                            employeeBank: activeAdv.bankName || 'ธนาคารกสิกรไทย',
                            employeeAccount: activeAdv.bankNo || '000-0-00000-0',
                            projectName: Array.isArray(activeAdv.projects) 
                              ? activeAdv.projects.map((pid: string) => masterProjects.find((p: any) => p.id === pid)?.name || pid).join(', ')
                              : activeAdv.pName || activeAdv.projectName,
                            desc: activeAdv.purpose || activeAdv.desc || 'ไม่มีรายละเอียดหมายเหตุเสริม',
                            items: Array.isArray(activeAdv.items) && activeAdv.items.length > 0
                              ? activeAdv.items.map((it: any) => ({
                                  desc: it.d || it.desc || it.name,
                                  category: masterCategories.find((ct: any) => ct.id === it.cat || ct.name === it.category)?.name || it.category || 'ค่าใช้จ่ายทั่วไป',
                                  qty: it.q || it.qty || 1,
                                  price: it.p || it.price || 0,
                                  unit: it.u || it.unit || 'ชุด',
                                  amount: it.t || (it.q * it.p) || it.amount || 0
                                }))
                              : [{
                                  desc: activeAdv.purpose || 'วงเงินสำรองฉุกเฉินสำหรับงานระบบและโครงสร้างหน้างาน',
                                  category: 'ค่าใช้จ่ายทั่วไป',
                                  qty: 1,
                                  price: activeAdv.amount || 0,
                                  unit: 'ครั้ง',
                                  amount: activeAdv.amount || 0
                                }],
                            totals: {
                              subtotal: activeAdv.amount || 0,
                              totalVat: 0,
                              totalWht: 0,
                              grandTotal: activeAdv.amount || 0
                            },
                            emp: { name: activeAdv.empName, position: activeAdv.empDept, bank: activeAdv.bankName, bankNo: activeAdv.bankNo }
                          }} 
                        />
                      </FitPageViewer>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                      <Search size={48} strokeWidth={1} />
                      <p className="text-sm">ไม่พบข้อมูลใบเบิกที่เลือก</p>
                    </div>
                  )}
                </div>
              ) : activePreview.type === 'vault' ? (
                /* GORGEOUS AUDIT REPORT COMPONENT */
                <div className="w-full flex justify-center py-4 bg-slate-100 min-h-full overflow-x-hidden">
                  {(() => {
                    const vaultData = activePreview.vaultData;
                    if (!vaultData) return null;

                    const sortedVaultDocs = [...vaultedDocs].reverse();
                    const currentDocIndex = sortedVaultDocs.findIndex(v => v.id === vaultData.id);
                    const broughtForwardBalance = currentDocIndex > 0 
                      ? sortedVaultDocs[currentDocIndex - 1].balanceToClear 
                      : (activeAdv?.amount || 0);

                    const mappedItems = (vaultData.itemsSnap || []).map((it: any, idx: number) => {
                      const reqAmt = typeof it.net === 'string' 
                        ? parseFloat(it.net.replace(/,/g, '')) || 0 
                        : parseFloat(it.net) || 0;
                      
                      return {
                        id: it.id || idx,
                        detail: it.description || 'รายการค่าใช้จ่าย',
                        project: it.project || activeAdv?.projectName || 'KCL',
                        requested: reqAmt,
                        status: it.action === 'approved' ? 'Approved' : it.action === 'rejected' ? 'Rejected' : 'Pending',
                        approved: it.action === 'approved' ? reqAmt : 0,
                        rejected: it.action === 'rejected' ? reqAmt : 0,
                        note: it.rejectReason || it.reason || '-'
                      };
                    });

                    const trk = activeAdv?.trackingRecord;
                    const mappedDocs = trk?.documents?.map((d: any, idx: number) => {
                      let typeThai = d.type;
                      if (d.type === 'Receipt') typeThai = 'ใบเสร็จรับเงิน / บิลเงินสด';
                      else if (d.type === 'Tax Invoice') typeThai = 'ใบกำกับภาษีเต็มรูป';
                      else if (d.type === 'Delivery Note') typeThai = 'ใบส่งของ / ใบกำกับสินค้า';
                      else if (d.type === 'WHT Certificate') typeThai = 'หนังสือรับรองการหักภาษี ณ ที่จ่าย (WHT)';

                      return {
                        id: idx,
                        type: typeThai,
                        ref_no: trk.id || `TRK-${activeAdv?.id?.substring(4)}`,
                        hasCopy: d.attached,
                        originalReceived: d.physical
                      };
                    }) || [];

                    const toggleOriginalStatus = (idx: number) => {
                      if (!activeAdv || !trk) return;
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
                    };

                    const clearanceHistory = sortedVaultDocs.map((v, idx) => {
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

                    const auditData = {
                      audit_id: vaultData.id,
                      clearance_id: activeAdv?.clrNo || COMMON_CLR_NO,
                      ref_claim_id: activeAdv?.id || '',
                      employee_name: activeAdv?.empName || 'ไม่ระบุพนักงาน',
                      audit_date: vaultData.timestamp ? vaultData.timestamp.split(' ')[0] : new Date().toLocaleDateString('th-TH'),
                      status: vaultData.type === 'closed' ? 'Closed' : 'Partial',
                      financials: {
                        original_claim_amount: activeAdv?.amount || 0,
                        brought_forward_balance: broughtForwardBalance,
                        total_requested_this_round: mappedItems.reduce((acc: number, curr: any) => acc + curr.requested, 0),
                        total_approved: vaultData.totalApproved,
                        total_rejected: vaultData.totalUnapproved,
                        pending_clearance_balance: broughtForwardBalance - vaultData.totalApproved
                      },
                      items: mappedItems
                    };

                    return (
                      <AuditReport 
                        data={auditData} 
                        documents={mappedDocs} 
                        toggleOriginalStatus={toggleOriginalStatus}
                        clearanceHistory={clearanceHistory}
                        historyTotals={historyTotals}
                      />
                    );
                  })()}
                </div>
              ) : (
                /* OTHER TABS: Standard Single Page Mockup with Noto Sans Thai Styling */
                <div className="w-full max-w-[450px] min-h-[580px] bg-white rounded-xl shadow-md p-6 border border-slate-200 relative flex flex-col justify-between font-noto-thai">
                  {/* 1. Header of Mock Document */}
                  <div>
                    <div className="flex justify-between items-start border-b border-slate-200 pb-3 mb-4">
                      <div>
                        <span className="text-[14px] font-bold text-slate-800 block">POSH MANOR CO., LTD.</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">บริษัท พอช แมนเนอร์ จำกัด (สำนักงานใหญ่)</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-bold text-indigo-700 block bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {activePreview.type === 'system' ? 'ใบเบิกเงินทดรองจ่าย' : activePreview.type === 'vault' ? 'รายงานตรวจสอบใบเคลียร์' : 'เอกสารแนบผู้ขาย'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 block mt-1 font-sans">{activePreview.fileLabel}</span>
                      </div>
                    </div>

                    {/* 2. Body of Mock Document - Changes based on selected tab */}

                    {/* Evidence Viewers */}
                    {activePreview.type === 'evidence' && (
                      <div className="space-y-3 text-[11px] w-full">
                        <div className="border border-sky-100 rounded-lg p-3 bg-sky-50/40 text-sky-800">
                          <p className="font-bold uppercase">เอกสาร: {activePreview.fullName || 'Attachment'}</p>
                          <p className="text-[10px] text-sky-600 mt-1">อ้างอิงรายการเบิก {activeAdv?.advId}</p>
                        </div>
                        {activePreview.url ? (
                          <div className="space-y-4">
                            {/* Check if it is an image */}
                            {(activePreview.isImage || 
                              activePreview.mimeType?.startsWith('image/') || 
                              /\.(jpg|jpeg|png|gif|webp)$/i.test(activePreview.fullName || '')) ? (
                              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex justify-center items-center p-2 max-h-[420px] shadow-inner">
                                <img 
                                  src={activePreview.url} 
                                  alt={activePreview.fullName} 
                                  className="max-w-full max-h-[400px] object-contain rounded-lg shadow-sm"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ) : (
                              <div className="border border-slate-200 rounded-xl bg-slate-50 p-6 text-center flex flex-col items-center justify-center gap-3">
                                <FileText size={48} className="text-[#4E958D]" />
                                <div>
                                  <p className="text-xs font-bold text-slate-800">{activePreview.fullName}</p>
                                  <p className="text-[10px] text-slate-400 mt-1">ไฟล์เอกสารแนบในฐานข้อมูลจริง</p>
                                </div>
                                <a 
                                  href={activePreview.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="bg-[#4E958D] text-white hover:bg-[#3d756e] font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all inline-flex"
                                >
                                  <Eye size={12} />
                                  ดาวน์โหลด / เปิดดูไฟล์ตัวจริงในแท็บใหม่
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 mt-6 flex flex-col items-center justify-center">
                            <FileImage size={40} className="text-sky-300 mb-2" />
                            <span className="text-[11px] font-bold text-slate-700 font-sans">{activePreview.fullName}</span>
                            <span className="text-[10px] text-slate-400 mt-1 font-sans">Verified by NAAS v2 Security (ไฟล์จำลองสถานะทดสอบ)</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-100 pt-3 mt-6 flex justify-between items-center text-[9px] text-slate-400 font-mono font-sans">
                    <span>จัดเก็บสำเนาไปยัง Google Drive อัตโนมัติ</span>
                    <span>System ID: {activeAdv?.id}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* R I G H T   P A N E L  :  R E V I E W   T A B L E (50% WIDTH) */}
          <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm h-full overflow-hidden relative">
            
            {/* Overlay Lock Screen when Document is Closed */}
            {advanceFlowStatus === 'closed' && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-[1.5px] z-30 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                <div className="bg-pink-50 border border-pink-200 rounded-2xl p-6 shadow-xl max-w-sm">
                  <Lock size={44} className="text-pink-500 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-pink-900 mb-1">ปิดยอดและตรวจสอบสำเร็จแล้ว</h3>
                  <p className="text-xs text-pink-700 leading-normal mb-4">
                    เอกสารเคลียร์รหัส {COMMON_CLR_NO} และใบเบิก {COMMON_ADV_NO} ได้รับการปิดงบดุลและลงลายเซ็นดิจิทัลโดยสมบูรณ์แล้ว ระบบไม่ให้แก้ไขข้อมูล
                  </p>
                  <button 
                    onClick={() => {
                      setAdvanceFlowStatus('reviewing');
                      showToast('ปลดล็อกเอกสารชุดนี้กลับสู่ขั้นตอนรีวิวชั่วคราว', 'info');
                    }}
                    className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[10px] px-4 py-2 rounded-lg font-bold transition-all shadow-sm"
                  >
                    🔓 ปลดล็อกเพื่อแก้ไขใหม่
                  </button>
                </div>
              </div>
            )}

            <div className="p-4 border-b border-slate-150 bg-slate-50/50 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-sky-500" />
                  ส่วนที่ 1: รายการค่าใช้จ่ายและผลการตรวจสอบ (50%)
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">เฉพาะรายการที่กด "อนุมัติ (ปุ่มเช็คสีฟ้า)" เท่านั้นที่จะถูกนำมาคิดในยอดหักล้างเคลียร์เงินทดรองจ่าย</p>
              </div>
            </div>

            {/* Table Area (Scrollable) */}
            <div className="flex-1 overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                <thead className="bg-slate-50/80 text-slate-600 sticky top-0 z-10 border-b border-slate-150">
                  <tr>
                    <th className="p-3 w-[5%] text-center">No.</th>
                    <th className="p-3 w-[20%]">โครงการ/หมวดหมู่</th>
                    <th className="p-3">รายละเอียดค่าใช้จ่าย</th>
                    <th className="p-3 w-[22%] text-right">VAT / ยอดสุทธิ</th>
                    <th className="p-3 w-[23%] text-center">จัดการ (Action)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentClrItems.map((item, index) => {
                    const isEditing = editingId === item.id;
                    const status = item.action;

                    // ROW FOR NORMAL DISPLAY
                    if (!isEditing) {
                      return (
                        <tr key={`${item.id}-${index}`} className={`transition-colors ${
                          status === 'approved' ? 'bg-sky-50/40 hover:bg-sky-100/30 border-l-4 border-sky-300' : 
                          status === 'rejected' ? 'bg-pink-50/40 hover:bg-pink-100/30 border-l-4 border-pink-300' : 'hover:bg-slate-50/30'
                        }`}>
                          <td className="p-3 text-center text-slate-400 font-mono">{index + 1}</td>
                          <td className="p-3">
                            <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded font-mono text-[9px] inline-block mb-1 border border-slate-150">
                              {item.project}
                            </span>
                            <p className="text-[11px] text-purple-700 font-bold">{item.category}</p>
                          </td>
                          <td className="p-3 text-slate-600 text-[11px] leading-relaxed pr-4">
                            <div>{item.description}</div>
                            {status === 'rejected' && (
                              <div className="mt-2.5 bg-pink-50/60 border border-pink-100 rounded-lg p-2.5 animate-fade-in text-left">
                                <label className="block text-[10px] font-bold text-pink-700 mb-1 flex items-center gap-1">
                                  <AlertTriangle size={11} className="text-pink-500" />
                                  ระบุหมายเหตุ / เหตุผลที่ไม่อนุมัติ:
                                </label>
                                <input
                                  type="text"
                                  placeholder="ระบุเหตุผล เช่น บิลไม่ชัดเจน, ไม่เกี่ยวเนื่องกับโครงการ..."
                                  value={item.rejectReason || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setItems(prev => prev.map(it => it.id === item.id ? { ...it, rejectReason: val } : it));
                                  }}
                                  className="w-full bg-white border border-pink-200 rounded-md px-2 py-1 text-[11px] text-slate-850 outline-none focus:ring-1 focus:ring-pink-300 focus:border-pink-300 transition-all placeholder:text-slate-400"
                                />
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="text-[9px] text-slate-400 mb-0.5">VAT: <span className="font-mono font-medium text-slate-600">{item.vat}</span></div>
                            <div className="font-mono font-bold text-slate-850">{item.net}</div>
                          </td>
                          <td className="p-3">
                            {/* Action Buttons using Pastels */}
                            <div className="flex justify-center gap-1.5">
                              {/* อนุมัติ (Pastel Blue) */}
                              <button 
                                onClick={() => toggleItemAction(item.id, 'approved')} 
                                className={`p-1.5 rounded-lg transition-all border ${
                                  status === 'approved' 
                                  ? 'bg-sky-400 text-white border-transparent shadow-sm' 
                                  : 'bg-sky-50 text-sky-600 hover:bg-sky-100 border-sky-100 hover:border-sky-200'
                                }`} 
                                title="อนุมัติ"
                              >
                                <Check size={13} strokeWidth={3} />
                              </button>
                              {/* ไม่อนุมัติ (Pastel Pink) */}
                              <button 
                                onClick={() => toggleItemAction(item.id, 'rejected')} 
                                className={`p-1.5 rounded-lg transition-all border ${
                                  status === 'rejected' 
                                  ? 'bg-pink-400 text-white border-transparent shadow-sm' 
                                  : 'bg-pink-50 text-pink-600 hover:bg-pink-100 border-pink-100 hover:border-pink-200'
                                }`} 
                                title="ไม่อนุมัติ"
                              >
                                <XCircle size={13} />
                              </button>
                              {/* แก้ไข (Pastel Yellow) */}
                              <button 
                                onClick={() => startEdit(item)} 
                                className="p-1.5 rounded-lg bg-yellow-50 text-yellow-800 hover:bg-yellow-100 border border-yellow-200 hover:border-yellow-300 transition-all flex items-center gap-1 text-[10px] px-2 font-bold" 
                                title="แก้ไขข้อมูล"
                              >
                                <Edit3 size={11} /> แก้ไข
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // ROW FOR INLINE EDITING (PASTEL PURPLE EDIT THEME)
                    return (
                      <tr key={`edit-${item.id}-${index}`} className="bg-purple-50/40 border-l-4 border-purple-400 shadow-inner">
                        <td className="p-3 text-center text-purple-600 font-mono font-bold">{index + 1}</td>
                        <td className="p-3 space-y-2 align-top">
                          <input 
                            type="text" value={editForm.project} 
                            onChange={(e) => handleEditChange('project', e.target.value)}
                            className="w-full bg-white border border-purple-200 rounded px-2 py-1 text-[10px] text-slate-800 outline-none focus:border-purple-400 transition-colors"
                            placeholder="รหัสโครงการ"
                          />
                          <input 
                            type="text" value={editForm.category} 
                            onChange={(e) => handleEditChange('category', e.target.value)}
                            className="w-full bg-white border border-purple-200 rounded px-2 py-1 text-[10px] text-slate-800 outline-none focus:border-purple-400 transition-colors"
                            placeholder="หมวดหมู่"
                          />
                        </td>
                        <td className="p-3 align-top">
                          <textarea 
                            value={editForm.description} 
                            onChange={(e) => handleEditChange('description', e.target.value)}
                            rows={3}
                            className="w-full bg-white border border-purple-200 rounded px-2 py-1 text-[11px] text-slate-800 outline-none focus:border-purple-400 resize-none transition-colors"
                            placeholder="รายละเอียดสินค้า/บริการ"
                          />
                        </td>
                        <td className="p-3 space-y-2 align-top">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-500 w-6">VAT</span>
                            <input 
                              type="text" value={editForm.vat} 
                              onChange={(e) => handleEditChange('vat', e.target.value)}
                              className="w-full bg-white border border-purple-200 rounded px-2 py-1 text-[10px] text-slate-800 outline-none focus:border-purple-400 text-right font-mono transition-colors"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-500 w-6">NET</span>
                            <input 
                              type="text" value={editForm.net} 
                              onChange={(e) => handleEditChange('net', e.target.value)}
                              className="w-full bg-white border border-purple-200 rounded px-2 py-1 text-[10px] text-slate-800 outline-none focus:border-purple-400 text-right font-mono font-bold transition-colors"
                            />
                          </div>
                        </td>
                        <td className="p-3 align-middle">
                          <div className="flex flex-col gap-1.5 items-center justify-center">
                            <button onClick={saveEdit} className="bg-purple-400 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 w-full transition-all shadow-sm">
                              <Save size={11}/> บันทึก
                            </button>
                            <button onClick={cancelEdit} className="bg-white hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 w-full transition-all border border-slate-200">
                              <XCircle size={11}/> ยกเลิก
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Table Footer / Summary (คำนวณแยกเพื่อสะท้อนยอดที่บัญชีอนุมัติจริง) */}
            <div className="bg-slate-50 border-t border-slate-200 p-4 shrink-0 flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[10px] text-slate-450 border-b border-slate-100 pb-1.5">
                <span>ยอดส่งคำร้องเคลียร์รวมทั้งสิ้น (จากพนักงาน):</span>
                <span className="font-mono font-semibold text-slate-600">{totalSubmittedNet.toLocaleString(undefined, {minimumFractionDigits: 2})} THB</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-sky-700 font-bold flex items-center gap-1">
                  <CheckCircle2 size={13} /> ยอดอนุมัติเคลียร์ผ่านจริงในรอบนี้:
                </span>
                <div className="text-right">
                  <span className="text-[10px] text-sky-600 mr-3">VAT ของรายการที่อนุมัติ: <span className="font-mono font-semibold">{totalApprovedVat.toFixed(2)}</span></span>
                  <span className="text-sm font-bold text-sky-700 font-mono bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100 inline-block">
                    {totalApprovedNet.toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-[9px] font-sans font-normal text-sky-600">THB</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- SECTION 2: CHECKLIST (PASTEL MIX TABLE) --- */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mt-6 relative">
          
          {/* Overlay Lock for Checklist when document is closed */}
          {advanceFlowStatus === 'closed' && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-20 cursor-not-allowed"></div>
          )}

          <div className="p-4 border-b border-slate-150 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <CheckSquare2 size={16} className="text-sky-500" />
              ส่วนที่ 2: เช็กลิสต์ตรวจรับเอกสารตัวจริง (Document Checklist)
            </h2>
            <div className="text-xs text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-2 shadow-sm">
              <span>สถานะตรวจรับตัวจริง:</span>
              <span className="text-purple-700 font-bold bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100">{documents.filter(d => d.originalReceived).length} / {documents.length} ฉบับ</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-150">
                  <th className="p-3 w-[28%]">เอกสารหลักฐานแนบ</th>
                  <th className="p-3 w-[18%] text-center">AI ตรวจพบออนไลน์</th>
                  <th className="p-3 w-[22%] text-center">บันทึกรับตัวจริง (Tick)</th>
                  <th className="p-3 w-[12%] text-center">สถานะ</th>
                  <th className="p-3 w-[20%]">หมายเหตุเพิ่มเติม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {documents.map((doc, idx) => (
                  <tr key={`${doc.id}-${idx}`} className="hover:bg-slate-50/30 transition-colors">
                    <td className="p-3">
                      <p className="font-bold text-slate-700 text-[11px]">{doc.type}</p>
                      <span className="text-[10px] text-slate-400 font-mono leading-relaxed">{doc.fileLabel}</span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-sky-100">
                        <CheckCircle2 size={12} /> ตรวจพบเรียบร้อย
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 transition-all">
                        <input 
                          type="checkbox" checked={doc.originalReceived} 
                          onChange={() => handleOriginalCheckbox(doc.id)}
                          disabled={advanceFlowStatus === 'closed'}
                          className="rounded border-slate-300 text-purple-600 w-4 h-4 bg-white cursor-pointer focus:ring-offset-0 focus:ring-purple-400/55 disabled:opacity-50"
                        />
                        <span className="text-[10px] text-slate-600 font-bold">ได้รับตัวจริงแล้ว</span>
                      </label>
                    </td>
                    <td className="p-3 text-center">
                      {doc.originalReceived 
                        ? <span className="bg-sky-50 text-sky-700 font-bold px-2.5 py-0.5 rounded-full text-[10px] border border-sky-200">ครบถ้วน</span>
                        : <span className="bg-pink-50 text-pink-700 font-bold px-2.5 py-0.5 rounded-full text-[10px] border border-pink-200">รอรับตัวจริง</span>}
                    </td>
                    <td className="p-3">
                      <input 
                        type="text" value={doc.remark} onChange={(e) => handleDocRemark(doc.id, e.target.value)}
                        disabled={advanceFlowStatus === 'closed'}
                        placeholder="ลงบันทึกหมายเหตุ..."
                        className="w-full bg-white border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 disabled:bg-slate-50 disabled:text-slate-450"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- SECTION 3: AUTOMATED DOCUMENT VAULT (คลังเอกสารตรวจสอบที่เซฟอัตโนมัติ) --- */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mt-6">
          <div className="border-b border-slate-150 pb-3 mb-4">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <FolderLock size={16} className="text-purple-500" />
              คลังเอกสารตรวจสอบดิจิทัล (Document Vault - Synced to Google Drive)
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">ระบบจะสร้างเอกสารด้านล่างนี้อัตโนมัติเมื่อกด "บันทึกเคลียร์บางส่วน" หรือ "ปิดยอดและตรวจสอบ" เพื่อนำไปยื่นต่อสรรพากรหรือจัดเก็บในสารบบ Google Drive</p>
          </div>

          {vaultedDocs.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <FileSpreadsheet size={28} className="mx-auto mb-2 text-slate-300" />
              ยังไม่มีประวัติการส่งตรวจสอบระบบ กรุณากดดำเนินการตรวจสอบที่กล่องอนุมัติด้านล่าง
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vaultedDocs.map((vDoc, idx) => (
                <div key={`${vDoc.id}-${idx}`} className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 hover:border-purple-200 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        vDoc.type === 'closed' ? 'bg-pink-100 text-pink-700 border border-pink-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {vDoc.type === 'closed' ? 'Closed' : 'Partial'}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">{vDoc.timestamp}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 font-mono">{vDoc.id}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5 truncate">{vDoc.googleDrivePath}</p>
                    
                    <div className="grid grid-cols-2 gap-2 mt-3 text-[10px] border-t border-slate-100 pt-2 text-slate-500">
                      <div>ยอดอนุมัติ: <strong className="text-sky-700 font-mono">{vDoc.totalApproved.toLocaleString()} บ.</strong></div>
                      <div>ยอดตีกลับค้าง: <strong className="text-pink-600 font-mono">{vDoc.totalUnapproved.toLocaleString()} บ.</strong></div>
                    </div>
                  </div>
                  
                  <div className="flex gap-1.5 mt-3 pt-2.5 border-t border-slate-100">
                    <button 
                      onClick={() => {
                        const prevObj = {
                          id: `vault-${vDoc.id}`,
                          name: `รายงาน-${vDoc.id.substring(13)}`,
                          type: 'vault',
                          icon: FolderLock,
                          fileLabel: vDoc.id,
                          colorTheme: 'pastel-purple',
                          vaultData: vDoc
                        };
                        setActivePreview(prevObj);
                        showToast(`แสดงพรีวิวไฟล์ตรวจสอบ ${vDoc.id} ที่ฝั่งซ้ายมือแล้ว`, 'info');
                      }}
                      className="flex-1 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 text-[10px] py-1.5 rounded-md font-bold transition-all flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Eye size={11} /> ดูในพรีวิวซ้าย
                    </button>
                    <button 
                      onClick={() => showToast(`จำลองการดาวน์โหลดไฟล์ ${vDoc.id}.pdf ลงเครื่องสำเร็จ`, 'success')}
                      className="bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 p-1.5 rounded-md transition-all"
                      title="ดาวน์โหลด PDF"
                    >
                      <Download size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- SECTION 4: ACCOUNTING STATUS & CONTROL BUTTONS --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          
          {/* Left panel: Verification Status Selection & Controls */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
            <div className="border-b border-slate-150 pb-3">
              <h2 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck size={16} className="text-blue-500" />
                สถานะการตรวจสอบของฝ่ายบัญชี (Accounting Review Panel)
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">เลือกบันทึกผลการประเมินสเตตัสเอกสารเพื่อสะท้อนสถานะกลับเข้าคลังระบบ</p>
            </div>

            {/* Layout Grid ถอดแบบตามรูปภาพแนบ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              {/* Box ซ้าย: ปุ่มวิทยุพาสเทล (ฟ้า-ชมพู-เหลือง) */}
              <div className="space-y-2.5 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">ผลประเมินสรุปทางบัญชี</label>
                
                {/* 1. ได้รับเอกสารครบถ้วน (Pastel Blue) */}
                <label className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer border transition-all ${
                  accountingStatus === 'complete' 
                    ? 'bg-sky-50 border-sky-300 text-sky-850' 
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700'
                }`}>
                  <input 
                    type="radio" name="accountingStatus" value="complete" checked={accountingStatus === 'complete'}
                    onChange={() => setAccountingStatus('complete')}
                    disabled={advanceFlowStatus === 'closed'}
                    className="text-sky-500 border-slate-300 focus:ring-sky-400 bg-white"
                  />
                  <div className="flex-1 flex justify-between items-center text-[11px]">
                    <span className="font-bold">ได้รับเอกสารครบ</span>
                    <span className="text-sky-600 text-[10px] font-bold bg-sky-100 px-1.5 py-0.2 rounded">✓ ครบ</span>
                  </div>
                </label>

                {/* 2. เอกสารไม่ครบ (Pastel Pink) */}
                <label className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer border transition-all ${
                  accountingStatus === 'incomplete' 
                    ? 'bg-pink-50 border-pink-300 text-pink-850' 
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700'
                }`}>
                  <input 
                    type="radio" name="accountingStatus" value="incomplete" checked={accountingStatus === 'incomplete'}
                    onChange={() => setAccountingStatus('incomplete')}
                    disabled={advanceFlowStatus === 'closed'}
                    className="text-pink-500 border-slate-300 focus:ring-pink-400 bg-white"
                  />
                  <div className="flex-1 flex justify-between items-center text-[11px]">
                    <span className="font-bold">เอกสารไม่ครบ</span>
                    <span className="text-pink-600 text-[9px] font-bold bg-pink-100 px-1.5 py-0.2 rounded">Hold</span>
                  </div>
                </label>

                {/* 3. ขอเอกสารเพิ่มเติม (Pastel Yellow) */}
                <label className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer border transition-all ${
                  accountingStatus === 'more_docs' 
                    ? 'bg-yellow-50 border-yellow-300 text-yellow-900' 
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700'
                }`}>
                  <input 
                    type="radio" name="accountingStatus" value="more_docs" checked={accountingStatus === 'more_docs'}
                    onChange={() => setAccountingStatus('more_docs')}
                    disabled={advanceFlowStatus === 'closed'}
                    className="text-yellow-600 border-yellow-300 focus:ring-yellow-400 bg-white"
                  />
                  <div className="flex-1 flex justify-between items-center text-[11px]">
                    <span className="font-bold">ขอเอกสารเพิ่มเติม</span>
                    <span className="text-yellow-700 text-[9px] font-bold bg-yellow-100 px-1.5 py-0.2 rounded">Pending</span>
                  </div>
                </label>
              </div>

              {/* Box ขวา: วันที่รับ และผู้ตรวจสอบ */}
              <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200 flex flex-col justify-center">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">วันที่แจ้งผลสรุปตรวจ</label>
                  <div className="relative">
                    <input 
                      type="text" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)}
                      disabled={advanceFlowStatus === 'closed'}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-700 focus:border-purple-400 outline-none disabled:opacity-75"
                    />
                    <Calendar size={14} className="absolute right-3 top-2.5 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">ผู้รีวิวเอกสาร</label>
                  <input 
                    type="text" value={receiverName} onChange={(e) => setReceiverName(e.target.value)}
                    disabled={advanceFlowStatus === 'closed'}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:border-purple-400 outline-none disabled:opacity-75"
                  />
                </div>
              </div>

            </div>

            {/* ส่วนควบคุมสถานะความต่อเนื่องของรหัส ADV */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-2 justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-slate-600 leading-tight">ระบบควบคุมวงเงิน ADV</p>
                <p className="text-[9px] text-slate-400">ควบคุมการคืนเศษเงินและการดึงรหัสไปเคลียร์ต่อ</p>
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <button
                  onClick={handleReturnDocument}
                  disabled={advanceFlowStatus === 'closed'}
                  className="flex-1 sm:flex-initial bg-pink-100 hover:bg-pink-200 text-pink-800 border border-pink-300 text-[10px] font-bold py-2 px-3 rounded-lg transition-all shadow-sm flex items-center gap-1 justify-center disabled:opacity-50"
                  title="ตีกลับเอกสารเพื่อขอเอกสารเพิ่มเติม"
                >
                  <XCircle size={11} /> เอกสารตีกลับ
                </button>
                <button
                  onClick={handleSavePartial}
                  disabled={advanceFlowStatus === 'closed'}
                  className="flex-1 sm:flex-initial bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 text-[10px] font-bold py-2 px-3 rounded-lg transition-all shadow-sm flex items-center gap-1 justify-center disabled:opacity-50"
                  title="พนักงานจะยังดึงรหัส ADV เดิมนี้ไปแนบบิลเพิ่มครั้งถัดไปได้"
                >
                  <Unlock size={11} /> บันทึกเคลียร์บางส่วน
                </button>
                <button
                  onClick={handleWaitPhysicalDocs}
                  disabled={advanceFlowStatus === 'closed'}
                  className="flex-1 sm:flex-initial bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-300 text-[10px] font-bold py-2 px-3 rounded-lg transition-all shadow-sm flex items-center gap-1 justify-center disabled:opacity-50"
                  title="รอรับเอกสารต้นฉบับ/ตัวจริง"
                >
                  <FileText size={11} /> รอเอกสารตัวจริง
                </button>
                <button
                  onClick={handleFinalClose}
                  disabled={advanceFlowStatus === 'closed'}
                  className="flex-1 sm:flex-initial bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold py-2 px-3 rounded-lg transition-all shadow-sm flex items-center gap-1 justify-center disabled:opacity-50"
                  title="ล็อกรหัส ADV ทันที ลายเซ็นอนุมัติจะปรากฏสมบูรณ์"
                >
                  <Lock size={11} /> ปิดยอดและตรวจสอบ
                </button>
              </div>
            </div>
          </div>

          {/* Right panel: Digital Signatures Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
            
            {/* Watermark/Placeholder when document is in "reviewing" status */}
            {advanceFlowStatus === 'reviewing' && (
              <div className="absolute inset-0 bg-white/95 z-20 flex flex-col items-center justify-center p-4 text-center animate-fade-in">
                <AlertTriangle size={32} className="text-yellow-400 mb-2 animate-pulse" />
                <h4 className="text-xs font-bold text-slate-800 mb-1">ยังไม่ประทับลายเซ็นระบบ</h4>
                <p className="text-[10px] text-slate-400 max-w-[250px] leading-relaxed">
                  ลายเซ็นอนุมัติระบบจะถูกปิดไว้ชั่วคราว จนกว่าฝ่ายบัญชีจะยืนยันการกด **"บันทึกเคลียร์บางส่วน"** หรือ **"ปิดยอดและตรวจสอบ"** ด้านซ้ายมือ
                </p>
              </div>
            )}

            {/* Stamp Indicator overlay when Closed */}
            {advanceFlowStatus === 'closed' && (
              <div className="absolute top-4 right-4 z-10 transform rotate-12 border-2 border-dashed border-sky-400 bg-sky-50/80 text-sky-600 text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg animate-bounce">
                APPROVED & LOCKED
              </div>
            )}
            {advanceFlowStatus === 'partial' && (
              <div className="absolute top-4 right-4 z-10 transform -rotate-12 border-2 border-dashed border-purple-400 bg-purple-50/80 text-purple-600 text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg">
                PARTIAL APPROVED
              </div>
            )}

            <div className="border-b border-slate-150 pb-3 mb-4">
              <h2 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <CheckSquare2 size={16} className="text-purple-500" />
                ลายเซ็นอนุมัติระบบ (Authorized Signatures)
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">ประทับลายเซ็นอนุมัติหลังตรวจเอกสารสอดคล้องตามสถานะ</p>
            </div>

            {/* Signatures Row */}
            <div className="grid grid-cols-3 gap-3 text-center text-[10px]">
              
              {/* Site Engineer */}
              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between h-[150px]">
                <p className="text-[9px] text-slate-400 font-bold uppercase">ผู้เคลียร์ยอด (พนักงาน)</p>
                <div className="my-2 flex justify-center items-center h-[50px]">
                  <svg className="w-24 h-12 stroke-sky-500 fill-none" viewBox="0 0 100 50">
                    <path d="M10,25 Q30,10 50,30 T90,20 M30,30 Q45,5 60,35" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <div className="border-b border-dashed border-slate-200 mx-2 mb-1"></div>
                  <p className="font-bold text-slate-700">นายสมชาย ใจดี</p>
                  <p className="text-[8px] text-slate-400">Site Engineer</p>
                  <p className="text-[8px] text-sky-500 font-mono mt-0.5">12/06/2026</p>
                </div>
              </div>

              {/* Accountant */}
              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between h-[150px]">
                <p className="text-[9px] text-slate-400 font-bold uppercase">ผู้รับเอกสาร (บัญชี)</p>
                <div className="my-2 flex justify-center items-center h-[50px]">
                  <svg className="w-24 h-12 stroke-purple-500 fill-none" viewBox="0 0 100 50">
                    <path d="M15,35 Q40,15 55,20 T85,35 M50,15 C40,40 60,40 70,25" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <div className="border-b border-dashed border-slate-200 mx-2 mb-1"></div>
                  <p className="font-bold text-slate-700">{receiverName || 'เบญจวรรณ นิ่มสุข'}</p>
                  <p className="text-[8px] text-slate-400">Accountant</p>
                  <p className="text-[8px] text-purple-500 font-mono mt-0.5">12/06/2026</p>
                </div>
              </div>

              {/* Managing Director */}
              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between h-[150px] relative">
                {advanceFlowStatus === 'partial' && (
                  <div className="absolute inset-0 bg-white/95 rounded-xl flex flex-col items-center justify-center p-2 text-center z-10 animate-fade-in">
                    <span className="text-[14px] text-amber-500 font-bold font-mono">PARTIAL</span>
                    <p className="text-[8px] text-slate-400 mt-0.5">ละเว้นลายเซ็นผู้บริหาร เนื่องจากเป็นการเคลียร์ยอดบางส่วน</p>
                  </div>
                )}
                
                <p className="text-[9px] text-slate-400 font-bold uppercase">ผู้อนุมัติ (ผู้บริหาร)</p>
                <div className="my-2 flex justify-center items-center h-[50px]">
                  <svg className="w-24 h-12 stroke-pink-500 fill-none" viewBox="0 0 100 50">
                    <path d="M10,20 L30,40 L45,15 L70,35 L90,10" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <div className="border-b border-dashed border-pink-200 mx-2 mb-1"></div>
                  <p className="font-bold text-pink-850">ณัฐวุฒิ ทองหล่อ</p>
                  <p className="text-[8px] text-pink-400">Managing Director</p>
                  <p className="text-[8px] text-pink-500 font-mono mt-0.5">12/06/2026</p>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* --- SYSTEM ACTIONS SECTION --- */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Database size={16} className="text-purple-400" />
                ระบบเชื่อมต่อข้อมูล (Cloud & ERP Connection Panel)
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                จัดการส่งผลประเมินเอกสารทางบัญชีไปยังวิศวกรไซต์งานผ่านระบบ LINE OA หรือนำเข้าโปรแกรม ERP บัญชีรับเหมาก่อสร้างโดยตรง
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Action 1: Send LINE notification */}
              <button
                onClick={() => showToast(`ส่งรายงานสรุปยอด${advanceFlowStatus === 'partial' ? 'เคลียร์บางส่วน' : 'ปิดยอด'}และหมายเหตุเอกสาร ไปหา "สรารัตน์ เตียวตระกูล" เรียบร้อยแล้ว (LINE OA)`, 'success')}
                className="flex items-center justify-center gap-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-850 px-4 py-2.5 rounded-xl border border-yellow-200 text-xs font-semibold transition-all shadow-sm w-full sm:w-auto"
              >
                <Send size={13} className="text-yellow-600" />
                ส่งผลตรวจเข้า LINE OA พนักงาน
              </button>

              {/* Action 2: Post to ERP system */}
              <button
                onClick={() => {
                  if (accountingStatus !== 'complete') {
                    showToast('ไม่สามารถส่งยอดเข้า ERP ได้ เนื่องจากระบบตรวจพบว่า "สถานะเอกสารยังไม่ครบถ้วน"', 'warning');
                  } else {
                    showToast(`บันทึกสถานะการทำรายการ ${advanceFlowStatus === 'partial' ? `ยอดเคลียร์บางส่วน ${totalApprovedNet.toLocaleString()} บาท` : 'ปิดยอดเบิกถาวร 10,000.00 บาท'} เข้าระบบ ERP สำเร็จ!`, 'success');
                  }
                }}
                className="flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm w-full sm:w-auto"
              >
                <Database size={13} />
                นำเข้าระบบ ERP บัญชีแยกประเภท
              </button>
            </div>
          </div>
        </div>

      </main>

      {/* --- FOOTER --- */}
      <footer className="border-t border-slate-100 bg-slate-50 py-4 px-6 mt-8">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-[10px] text-slate-400">
          <p>© 2026 POSH MANOR CORP. All rights reserved. • ISO 27001 Certified System</p>
          <div className="flex gap-4">
            <span className="hover:text-slate-600 cursor-pointer">เอกสารการฝึกอบรมบัญชี</span>
            <span className="hover:text-slate-600 cursor-pointer">ติดต่อผู้พัฒนาระบบ</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
