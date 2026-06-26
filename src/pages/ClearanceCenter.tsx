import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Receipt } from '../types';
import { uploadFileToServer } from '../lib/files';
import { 
  AttachmentItem,
  ClearanceItem,
  VendorInfo,
  ReceiptExtras,
  DOC_TYPES,
  formatNum
} from './ClearanceCenter/ClearanceCenter.data';
import { ClearanceVoucherPreview } from './ClearanceCenter/ClearanceVoucherPreview';
import { FitPageViewer } from '../components/document-engine/FitPageViewer';
import { 
  Upload, 
  Sparkles, 
  Store, 
  FileText, 
  Tags, 
  Calculator, 
  Check, 
  Trash2, 
  Plus, 
  Minus, 
  Eye, 
  ChevronRight, 
  ChevronLeft,
  X,
  FileCheck,
  Percent,
  Calendar,
  AlertTriangle,
  Save
} from 'lucide-react';

const sanitizeDateToYYYYMMDD = (dStr: any): string => {
  if (!dStr) return new Date().toISOString().slice(0, 10);
  const clean = String(dStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(clean)) return clean.replace(/\//g, '-');
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  } catch (e) {}
  return new Date().toISOString().slice(0, 10);
};

interface VoucherTab {
  id: string;
  title: string;
  vendorInfo: VendorInfo;
  items: ClearanceItem[];
  globalVatType: 'none' | 'include' | 'exclude';
  globalWhtRate: string;
  receiptExtras: ReceiptExtras;
  otherSign: '+' | '-';
  selectedAdvId: string;
  clrNo: string;
}

export function ClearanceCenter() {
  const { advances, updateAdvance, updateMultipleAdvances, setPage, pageExtra, toast, masterCategories = [], masterProjects = [] } = useApp();
  
  // Local state for selected ID, initialized from pageExtra or empty by default
  const [selectedId, setSelectedId] = useState<string>(pageExtra?.advId || "");
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');
  const [mobileStep, setMobileStep] = useState<number>(1); // Step 1: Upload, Step 2: Vendor, Step 3: Items

  useEffect(() => {
    if (pageExtra?.advId) {
        setSelectedId(pageExtra.advId);
    }
  }, [pageExtra?.advId]);
  
  const targetAdvance = advances.find(a => a.id === selectedId);
  const displayAdvance = targetAdvance || { id: '', amount: 0, empName: '', dept: '' };

  // Filter advances that are ready to be cleared
  const availableAdvances = advances.filter(a => a.status === 'WAITING_CLEARANCE' || a.id === selectedId);

  // Dynamic projects from database
  const projectsToUse = masterProjects || [];
  const defaultProjId = projectsToUse[0]?.id || projectsToUse[0]?.code || '';

  // --- STATES ---
  // Generate sequential CLR ID based on existing receipts in CLR-YYMM-001 format
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const totalExistingReceipts = advances.reduce((acc, a) => acc + (a.receipts?.length || 0), 0);
  
  const generateClrNo = (offsetIndex: number) => {
    return `CLR-${yy}${mm}-${String(totalExistingReceipts + 1 + offsetIndex).padStart(3, '0')}`;
  };

  const [clrNo, setClrNoState] = useState<string>(generateClrNo(0));
  const [isReviewMode, setIsReviewMode] = useState(false);
  
  // 1. Attachments & Preview
  const [mainAttachments, setMainAttachments] = useState<AttachmentItem[]>([]);
  const [extraAttachments, setExtraAttachments] = useState<AttachmentItem[]>([]);
  const mainFileRef = useRef<HTMLInputElement>(null);
  const extraFileRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Review Mode States
  const [previewTab, setPreviewTab] = useState<string>('evidence'); // 'evidence' | 'voucher'
  const [activeImgPreview, setActiveImgPreview] = useState<string>('main'); // 'main' or id
  
  // 2. Vendor & Doc Info
  const [vendorInfo, setVendorInfo] = useState<VendorInfo>({
    name: '', taxId: '', branch: '00000', docType: DOC_TYPES[0], docNo: '', docDate: new Date().toISOString().slice(0, 10)
  });

  // 4. Receipt Extras (Discount, Others)
  const [receiptExtras, setReceiptExtras] = useState<ReceiptExtras>({
    discount: 0,
    otherLabel: 'ค่าใช้จ่ายอื่นๆ / ปรับปรุงยอด',
    otherAmount: 0
  });
  const [otherSign, setOtherSign] = useState<'+' | '-'>('+');

  // Global Tax States - set at bottom of document (ท้ายเอกสาร) for easier client/broker clearance
  const [globalVatType, setGlobalVatType] = useState<'none' | 'include' | 'exclude'>('none');
  const [globalWhtRate, setGlobalWhtRate] = useState<string>('0');

  // 3. Items & Projects
  const [projectMode, setProjectMode] = useState<string>('single'); 
  const [mainProject, setMainProject] = useState<string>(defaultProjId);
  const [items, setItems] = useState<ClearanceItem[]>([
    { id: 1, name: '', qty: 1, price: 0, projectId: defaultProjId, vatType: 'none', whtRate: '0', category: masterCategories[0]?.id || 'C01' }
  ]);

  // Voucher/Receipt Tabs for when multiple documents with different merchants are uploaded
  const [tabs, setTabs] = useState<VoucherTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Synchronize main project, items, and tabs when document is selected
  useEffect(() => {
    if (tabs.length > 0 && tabs.some(t => t.selectedAdvId)) {
      return;
    }

    const defaultCat = masterCategories[0]?.id || 'C01';
    const projId = targetAdvance?.defaultProject || defaultProjId;
    
    const initialVendor = {
      name: '', taxId: '', branch: '00000', docType: DOC_TYPES[0], docNo: '', docDate: new Date().toISOString().slice(0, 10)
    };
    const initialItems = [
      { id: 1, name: '', qty: 1, price: 0, projectId: projId, vatType: 'none', whtRate: '0', category: defaultCat }
    ];

    setMainProject(projId);
    setVendorInfo(initialVendor);
    setItems(initialItems);
    setGlobalVatType('none');
    setGlobalWhtRate('0');
    setReceiptExtras({
      discount: 0,
      otherLabel: 'ค่าใช้จ่ายอื่นๆ / ปรับปรุงยอด',
      otherAmount: 0
    });
    setOtherSign('+');

    const defaultTab: VoucherTab = {
      id: 'tab-default',
      title: 'ข้อมูลใบเสร็จ',
      vendorInfo: initialVendor,
      items: initialItems,
      globalVatType: 'none',
      globalWhtRate: '0',
      receiptExtras: {
        discount: 0,
        otherLabel: 'ค่าใช้จ่ายอื่นๆ / ปรับปรุงยอด',
        otherAmount: 0
      },
      otherSign: '+',
      selectedAdvId: selectedId,
      clrNo: clrNo
    };

    setTabs([defaultTab]);
    setActiveTabId('tab-default');
  }, [selectedId, targetAdvance, masterCategories, defaultProjId]);

  // Synchronize editing states back into the active tab inside the tabs list
  useEffect(() => {
    if (!activeTabId) return;
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === activeTabId);
      if (idx === -1) return prev;
      const current = prev[idx];
      if (
        current.vendorInfo === vendorInfo &&
        current.items === items &&
        current.globalVatType === globalVatType &&
        current.globalWhtRate === globalWhtRate &&
        current.receiptExtras === receiptExtras &&
        current.otherSign === otherSign &&
        current.selectedAdvId === selectedId &&
        current.clrNo === clrNo
      ) {
        return prev;
      }
      const updated = [...prev];
      updated[idx] = {
        ...current,
        vendorInfo,
        items,
        globalVatType,
        globalWhtRate,
        receiptExtras,
        otherSign,
        selectedAdvId: selectedId,
        clrNo: clrNo
      };
      return updated;
    });
  }, [activeTabId, vendorInfo, items, globalVatType, globalWhtRate, receiptExtras, otherSign, selectedId, clrNo]);

  const switchTab = (nextTabId: string) => {
    const targetTab = tabs.find(t => t.id === nextTabId);
    if (!targetTab) return;
    
    setActiveTabId(null);
    setVendorInfo(targetTab.vendorInfo);
    setItems(targetTab.items);
    setGlobalVatType(targetTab.globalVatType);
    setGlobalWhtRate(targetTab.globalWhtRate);
    setReceiptExtras(targetTab.receiptExtras);
    setOtherSign(targetTab.otherSign);
    setSelectedId(targetTab.selectedAdvId || '');
    setClrNoState(targetTab.clrNo);
    setActiveTabId(nextTabId);
  };

  const addNewTab = () => {
    const defaultCat = masterCategories[0]?.id || 'C01';
    const newId = `tab-custom-${Date.now()}`;
    const nextOffset = tabs.length;
    const tabClrNo = generateClrNo(nextOffset);

    const newTab: VoucherTab = {
      id: newId,
      title: `บิลใบที่ ${tabs.length + 1}`,
      vendorInfo: {
        name: '', taxId: '', branch: '00000', docType: DOC_TYPES[0], docNo: '', docDate: new Date().toISOString().slice(0, 10)
      },
      items: [{ id: Date.now(), name: '', qty: 1, price: 0, projectId: mainProject, vatType: 'none', whtRate: '0', category: defaultCat }],
      globalVatType: 'none',
      globalWhtRate: '0',
      receiptExtras: {
        discount: 0,
        otherLabel: 'ค่าใช้จ่ายอื่นๆ / ปรับปรุงยอด',
        otherAmount: 0
      },
      otherSign: '+',
      selectedAdvId: selectedId,
      clrNo: tabClrNo
    };
    setTabs([...tabs, newTab]);
    switchTab(newId);
  };

  const deleteTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) {
      toast('ไม่สามารถลบแท็บสุดท้ายได้', 'err');
      return;
    }
    const filtered = tabs.filter(t => t.id !== tabId);
    setTabs(filtered);
    if (activeTabId === tabId) {
      const nextTab = filtered[0];
      switchTab(nextTab.id);
    }
  };

  // 5. Submission
  const [isPartial, setIsPartial] = useState(false);

  // --- CALCULATIONS ---
  let sumRaw = 0; 

  items.forEach(it => {
    sumRaw += Number(it.qty) * Number(it.price);
  });

  const discountAmount = Number(receiptExtras.discount) || 0;
  const signedOtherAmount = otherSign === '+' 
    ? Math.abs(Number(receiptExtras.otherAmount) || 0) 
    : -Math.abs(Number(receiptExtras.otherAmount) || 0);

  // The base amount to apply VAT and WHT on
  const totalAfterDiscountAndOther = sumRaw - discountAmount + signedOtherAmount;
  
  let totalVat = 0;
  let totalWht = 0;
  let preVatBase = totalAfterDiscountAndOther;
  let netTotalBeforeWht = totalAfterDiscountAndOther;

  if (globalVatType === 'include') {
    preVatBase = totalAfterDiscountAndOther * 100 / 107;
    totalVat = totalAfterDiscountAndOther - preVatBase;
    netTotalBeforeWht = totalAfterDiscountAndOther;
  } else if (globalVatType === 'exclude') {
    totalVat = totalAfterDiscountAndOther * 0.07;
    preVatBase = totalAfterDiscountAndOther;
    netTotalBeforeWht = totalAfterDiscountAndOther + totalVat;
  }

  totalWht = preVatBase * (Number(globalWhtRate) / 100);
  
  const subTotalAmount = sumRaw;
  const netTotal = selectedId ? (netTotalBeforeWht - totalWht) : 0;
  const advanceAmount = selectedId ? (targetAdvance?.amount || 0) : 0;
  const balance = selectedId ? (advanceAmount - netTotal) : 0;

  // --- HANDLERS ---
  const handleMainUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles = files.map((f: any) => ({ id: `main-${Date.now()}-${Math.random()}`, file: f, url: URL.createObjectURL(f), name: f.name }));
    setMainAttachments([...mainAttachments, ...newFiles]);
  };

  const removeMainAttachment = (id: string) => {
    setMainAttachments(mainAttachments.filter(a => a.id !== id));
    if (activeImgPreview === id) setActiveImgPreview('main');
  };

  const handleExtraUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles = files.map((f: any) => ({ file: f, url: URL.createObjectURL(f), name: f.name, id: `ext-${Date.now()}-${Math.random()}` }));
    setExtraAttachments([...extraAttachments, ...newFiles]);
  };

  const removeExtra = (id: string) => setExtraAttachments(extraAttachments.filter(a => a.id !== id));

  const updateExtraAttachment = (id: string, field: string, value: string) => {
    setExtraAttachments(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const handleAiScan = async () => {
    if (mainAttachments.length === 0) return toast('กรุณาแนบรูปภาพหลักฐานก่อนสแกนข้อมูล', 'err');
    setIsScanning(true);
    
    try {
      const scanResults: { attachment: any; data: any }[] = [];
      
      for (const attachment of mainAttachments) {
        if (!attachment.file) continue;
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
            reader.readAsDataURL(attachment.file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
        
        const dataUrl = await base64Promise;
        const base64Data = dataUrl.split(',')[1];
        
        const response = await fetch('/api/gemini/analyze-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                base64Data, 
                mimeType: attachment.file.type || 'image/jpeg',
                fileName: attachment.name 
            })
        });
        
        const result = await response.json();
        
        if (result.success && result.data) {
            scanResults.push({
              attachment,
              data: result.data
            });
        }
      }

      if (scanResults.length === 0) {
        toast('ไม่สามารถวิเคราะห์ข้อมูลจากเอกสารที่แนบมาได้', 'err');
        return;
      }

      const isSameVendor = (name1: string, name2: string) => {
        if (!name1 || !name2) return false;
        const n1 = name1.trim().toLowerCase().replace(/\s+/g, '');
        const n2 = name2.trim().toLowerCase().replace(/\s+/g, '');
        return n1 === n2 || n1.includes(n2) || n2.includes(n1);
      };

      // Group scan results by vendor
      const groups: { vendorName: string; results: any[] }[] = [];
      scanResults.forEach(res => {
        const vName = res.data.vendor || 'ร้านค้าทั่วไป';
        const existingGroup = groups.find(g => isSameVendor(g.vendorName, vName));
        if (existingGroup) {
          existingGroup.results.push(res);
        } else {
          groups.push({ vendorName: vName, results: [res] });
        }
      });

      const newTabs: VoucherTab[] = groups.map((g, index) => {
        let groupItems: any[] = [];
        let groupVat = 0;
        let groupDiscount = 0;
        const firstVendorData = g.results[0]?.data;
        
        g.results.forEach(res => {
          if (res.data.items && Array.isArray(res.data.items)) {
            groupItems = [...groupItems, ...res.data.items];
          }
          if (res.data.vat) groupVat += Number(res.data.vat);
          if (res.data.discount) groupDiscount += Number(res.data.discount);
        });

        const mappedItems = groupItems.map((it: any, i: number) => {
          let selectedCategory = masterCategories[0]?.id || 'C01';
          if (it.category) {
            const cleanedScanned = it.category.trim().toUpperCase();
            const exactMatch = masterCategories.find(c => c.id.toUpperCase() === cleanedScanned);
            if (exactMatch) {
              selectedCategory = exactMatch.id;
            } else {
              const standardMapping: Record<string, string> = {
                'C01': 'C01', 'C02': 'C02', 'C03': 'C03', 'C04': 'C04', 'C05': 'C05'
              };
              const standardId = standardMapping[cleanedScanned];
              if (standardId) {
                const partialMatch = masterCategories.find(c => c.id.toUpperCase().includes(standardId));
                if (partialMatch) {
                  selectedCategory = partialMatch.id;
                }
              }
            }
          }
          return {
            id: Date.now() + index * 1000 + i,
            name: it.desc || 'รายการสินค้า / บริการ',
            qty: Number(it.qty) || 1,
            price: Number(it.price) || 0,
            projectId: mainProject,
            vatType: it.vat === 7 ? 'include' : 'none',
            whtRate: String(it.wht || 0),
            category: selectedCategory
          };
        });

        const hasVat = groupItems.some((it: any) => it.vat === 7 || (it.vat && it.vat > 0));
        const firstWht = groupItems.find((it: any) => it.wht && it.wht > 0);

        return {
          id: `tab-${Date.now()}-${index}`,
          title: `บิล: ${g.vendorName || `ร้านค้าที่ ${index+1}`}`,
          vendorInfo: {
            name: g.vendorName || '',
            taxId: firstVendorData?.taxId || '',
            branch: '00000',
            docType: DOC_TYPES[0],
            docNo: firstVendorData?.invoiceNo || firstVendorData?.receiptNo || '',
            docDate: sanitizeDateToYYYYMMDD(firstVendorData?.date)
          },
          items: mappedItems.length > 0 ? mappedItems : [
            { id: Date.now() + index * 1000, name: 'ค่าใช้จ่ายทั่วไป', qty: 1, price: 0, projectId: mainProject, vatType: 'none', whtRate: '0', category: masterCategories[0]?.id || 'C01' }
          ],
          globalVatType: hasVat ? 'include' : 'none',
          globalWhtRate: firstWht ? String(firstWht.wht) : '0',
          receiptExtras: {
            discount: groupDiscount,
            otherLabel: 'ค่าใช้จ่ายอื่นๆ / ปรับปรุงยอด',
            otherAmount: 0
          },
          otherSign: '+',
          selectedAdvId: selectedId,
          clrNo: generateClrNo(index)
        };
      });

      if (newTabs.length > 0) {
        setTabs(newTabs);
        const firstTab = newTabs[0];
        setActiveTabId(null);
        setVendorInfo(firstTab.vendorInfo);
        setItems(firstTab.items);
        setGlobalVatType(firstTab.globalVatType);
        setGlobalWhtRate(firstTab.globalWhtRate);
        setReceiptExtras(firstTab.receiptExtras);
        setOtherSign(firstTab.otherSign);
        setSelectedId(firstTab.selectedAdvId || '');
        setClrNoState(firstTab.clrNo);
        setActiveTabId(firstTab.id);
        
        if (newTabs.length > 1) {
          toast(`✓ ค้นพบร้านค้าแตกต่างกันทั้งหมด ${newTabs.length} ร้านค้า จึงทำการสร้างแท็บแบ่งกรอกข้อมูลให้เรียบร้อยแล้ว`, 'tok');
        } else {
          toast('✓ สแกนใบเสร็จสำเร็จ AI ป้อนข้อมูลให้คุณแล้ว', 'tok');
        }
        setMobileStep(2);
      }
    } catch (err) {
        console.error(err);
        toast('เกิดข้อผิดพลาดในการสแกน', 'err');
    } finally {
        setIsScanning(false);
    }
  };

  const addItem = () => setItems([...items, { id: Date.now(), name: '', qty: 1, price: 0, projectId: projectMode === 'single' ? mainProject : defaultProjId, vatType: 'none', whtRate: '0', category: masterCategories[0]?.id || 'C01' }]);
  const removeItem = (id: number) => setItems(items.filter(i => i.id !== id));
  
  const updateItem = (id: number, field: string, value: any) => setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));

  const handleProjectModeChange = (mode: string) => {
    setProjectMode(mode);
    if (mode === 'single') setItems(items.map(i => ({ ...i, projectId: mainProject })));
  };

  const handleMainProjectChange = (val: string) => {
    setMainProject(val);
    setItems(items.map(i => ({ ...i, projectId: val })));
  };

  const getActiveImgData = () => {
    if (activeImgPreview.startsWith('main')) {
      return mainAttachments.find(a => a.id === activeImgPreview) || mainAttachments[0];
    }
    return extraAttachments.find(a => a.id === activeImgPreview);
  };

  const activeImg = getActiveImgData();

  // --- REUSABLE COMPONENT: A4 VOUCHER (Clean Paprika Theme matching image layout) ---
  const renderVoucher = () => (
    <ClearanceVoucherPreview
      clrNo={clrNo}
      targetAdvance={targetAdvance}
      displayAdvance={displayAdvance}
      vendorInfo={vendorInfo}
      items={items}
      subTotalAmount={subTotalAmount}
      discountAmount={discountAmount}
      totalVat={totalVat}
      totalWht={totalWht}
      receiptExtras={{
        ...receiptExtras,
        otherAmount: signedOtherAmount
      }}
      netTotal={netTotal}
      balance={balance}
      globalVatType={globalVatType}
      globalWhtRate={globalWhtRate}
      projectMode={projectMode}
      mainProject={mainProject}
      mainAttachment={mainAttachments[0] || null}
      extraAttachments={extraAttachments}
    />
  );

  // ==========================================
  // VIEW: REVIEW MODE (หน้าตรวจสอบเอกสารเพื่อยืนยันส่ง)
  // ==========================================
  if (isReviewMode) {
    return (
      <div className="flex flex-col lg:flex-row h-screen bg-slate-50 font-['Noto_Sans_Thai'] text-[13px] overflow-auto lg:overflow-hidden relative no-print">
        {/* ซ้าย(Desktop) / บน(Mobile): Document Viewer + Tabs */}
        <div className="w-full lg:w-1/2 flex flex-col bg-slate-100 border-b lg:border-b-0 lg:border-r border-slate-200 h-[50vh] lg:h-full shrink-0">
          <div className="flex bg-slate-200 px-4 pt-3 border-b border-slate-300 gap-2 shrink-0">
            <button className={`px-5 py-2 rounded-t-lg font-bold text-xs transition-all ${previewTab === 'evidence' ? 'bg-white text-[#E75618] shadow-sm' : 'bg-transparent text-slate-600'}`} onClick={() => setPreviewTab('evidence')}>
              📸 รูปถ่ายหลักฐานใบเสร็จ
            </button>
            <button className={`px-5 py-2 rounded-t-lg font-bold text-xs transition-all ${previewTab === 'voucher' ? 'bg-white text-[#E75618] shadow-sm' : 'bg-transparent text-slate-600'}`} onClick={() => setPreviewTab('voucher')}>
              📄 ใบสำคัญเคลียร์ (Preview)
            </button>
          </div>

          <div className="flex-1 p-3 lg:p-6 overflow-y-auto flex flex-col items-center relative bg-slate-800">
            {previewTab === 'evidence' ? (
              <div className="p-2 w-full h-full flex flex-col">
                <div className="w-full flex-1 flex items-center justify-center min-h-[50%]">
                  {activeImg ? (
                    <img src={activeImg.url} alt="Evidence" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl bg-white p-1" />
                  ) : (
                    <p className="text-slate-400">ไม่มีรูปภาพหลักฐาน</p>
                  )}
                </div>
                {/* Thumbnails Bar */}
                <div className="w-full mt-3 bg-black/40 p-2.5 rounded-xl flex gap-2.5 overflow-x-auto shrink-0">
                  {mainAttachments.map(main => (
                    <button key={main.id} onClick={() => setActiveImgPreview(main.id)} className={`shrink-0 w-16 h-16 rounded-lg border-2 overflow-hidden transition-all ${activeImgPreview === main.id ? 'border-[#E75618] scale-105' : 'border-slate-600 opacity-60'}`}>
                      <img src={main.url} className="w-full h-full object-cover" alt="Main" />
                    </button>
                  ))}
                  {extraAttachments.map(ext => (
                    <button key={ext.id} onClick={() => setActiveImgPreview(ext.id)} className={`shrink-0 w-16 h-16 rounded-lg border-2 overflow-hidden transition-all ${activeImgPreview === ext.id ? 'border-[#E75618] scale-105' : 'border-slate-600 opacity-60'}`}>
                      <img src={ext.url} className="w-full h-full object-cover" alt="Extra" />
                    </button>
                  ))}
                  {mainAttachments.length === 0 && extraAttachments.length === 0 && <span className="text-slate-400 text-xs py-2 px-3">ไม่มีเอกสารแนบเพิ่มเติม</span>}
                </div>
              </div>
            ) : (
              <FitPageViewer pageWidth={794} pageHeight={1123}>
                {renderVoucher()}
              </FitPageViewer>
            )}
          </div>
        </div>

        {/* ขวา(Desktop) / ล่าง(Mobile): ข้อมูลให้ตรวจสอบและแก้ไข (White Background Theme) */}
        <div className="w-full lg:w-1/2 p-4 lg:p-8 overflow-y-auto bg-white h-full flex flex-col">
          <div className="flex justify-between items-end mb-6 pb-4 border-b border-slate-200">
            <div>
              <h1 className="text-[15px] font-black text-[#2E1105]">ตรวจสอบข้อมูลและความถูกต้อง</h1>
              <p className="text-[#8A340F] mt-1 flex items-center gap-2 text-xs">
                <span className="bg-[#FDEEE8] text-[#E75618] px-2 py-0.5 rounded font-black border border-[#FADDD1]">{clrNo}</span>
                อ้างอิง: {displayAdvance.id || displayAdvance.advNo}
              </p>
            </div>
            <div className="text-right bg-amber-50/50 px-4 py-2.5 rounded-xl border border-[#FADDD1]">
              <p className="text-[10px] text-[#E75618] font-bold uppercase tracking-wider mb-0.5">ยอดสุทธิที่เคลียร์ (CLR Total)</p>
              <p className="text-lg font-black text-[#E75618]">{formatNum(netTotal)} ฿</p>
            </div>
          </div>

          {/* Voucher Tabs Bar in Review Mode */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
            <p className="text-[11px] font-black text-[#2E1105] mb-2">เลือกตรวจสอบทีละบิล/ใบเสร็จ ({tabs.length} บิล):</p>
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {tabs.map((tab, idx) => {
                const isActive = tab.id === activeTabId;
                return (
                  <div
                    key={tab.id}
                    onClick={() => switchTab(tab.id)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-lg border text-[11px] font-black cursor-pointer transition-all ${
                      isActive
                        ? 'bg-[#E75618] border-[#E75618] text-white shadow-md scale-102'
                        : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    {tab.vendorInfo.name || `บิลใบที่ ${idx + 1}`}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-5 flex-1">
            {/* กล่องตรวจสอบ Vendor */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <h3 className="font-bold text-xs text-white bg-[#E75618] px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 mb-4">
                <Store size={14} /> ข้อมูลร้านค้า / เลขผู้เสียภาษี
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">ชื่อร้านค้า (Vendor)</label>
                  <input type="text" className="w-full border border-slate-200 p-2 rounded-lg text-xs font-semibold focus:border-[#E75618] text-[#2E1105]" value={vendorInfo.name} onChange={e => setVendorInfo({...vendorInfo, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">เลขที่เอกสารอ้างอิง</label>
                  <input type="text" className="w-full border border-slate-200 p-2 rounded-lg text-xs font-semibold focus:border-[#E75618] text-[#2E1105]" value={vendorInfo.docNo} onChange={e => setVendorInfo({...vendorInfo, docNo: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">เลขผู้เสียภาษี (Tax ID)</label>
                  <input type="text" className="w-full border border-slate-200 p-2 rounded-lg text-xs font-semibold focus:border-[#E75618] text-[#2E1105]" value={vendorInfo.taxId} onChange={e => setVendorInfo({...vendorInfo, taxId: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">วันที่ในเอกสาร</label>
                  <input type="date" className="w-full border border-slate-200 p-2 rounded-lg text-xs font-semibold focus:border-[#E75618] text-[#2E1105]" value={sanitizeDateToYYYYMMDD(vendorInfo.docDate)} onChange={e => setVendorInfo({...vendorInfo, docDate: e.target.value})} />
                </div>
              </div>
            </div>

            {/* กล่องตรวจสอบ Items สรุป */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-x-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-xs text-white bg-[#E75618] px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5">
                  <Calculator size={14} /> รายการเคลียร์ยอด (สามารถแก้ไขได้)
                </h3>
                <button type="button" onClick={addItem} className="text-xs font-bold text-[#E75618] flex items-center gap-1 bg-[#FDEEE8] px-2 py-1 rounded">
                  <Plus size={12} /> เพิ่มรายการ
                </button>
              </div>
              <table className="w-full text-xs text-left whitespace-nowrap min-w-[600px]">
                <thead className="bg-slate-50 border-y border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="p-2 w-10 text-center">ลำดับ</th>
                    <th className="p-2 min-w-[150px]">รายการวัสดุ/ค่าบริการ</th>
                    <th className="p-2 w-24 text-right">จำนวน</th>
                    <th className="p-2 w-28 text-right">ราคาต่อหน่วย</th>
                    <th className="p-2 w-28 text-right">รวมราคา</th>
                    <th className="p-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={`${item.id}-${idx}`}>
                      <td className="p-2 text-center text-slate-400 font-bold">{idx + 1}</td>
                      <td className="p-2">
                        <input type="text" className="w-full border border-slate-200 p-1.5 rounded focus:border-[#E75618] outline-none" value={item.name} onChange={e => updateItem(item.id, 'name', e.target.value)} />
                      </td>
                      <td className="p-2">
                        <input type="number" min="1" className="w-full border border-slate-200 p-1.5 rounded text-right focus:border-[#E75618] outline-none" value={item.qty} onChange={e => updateItem(item.id, 'qty', Number(e.target.value) || 1)} />
                      </td>
                      <td className="p-2">
                        <input type="number" min="0" className="w-full border border-slate-200 p-1.5 rounded text-right focus:border-[#E75618] outline-none" value={item.price} onChange={e => updateItem(item.id, 'price', e.target.value)} />
                      </td>
                      <td className="p-2">
                        <input type="number" min="0" className="w-full border border-slate-200 p-1.5 rounded text-right font-bold text-[#E75618] focus:border-[#E75618] outline-none" value={item.qty * item.price === 0 ? '' : item.qty * item.price} onChange={e => {
                          const newTotal = Number(e.target.value) || 0;
                          const currentQty = Number(item.qty) || 1;
                          updateItem(item.id, 'price', newTotal / currentQty);
                        }} />
                      </td>
                      <td className="p-2 text-center">
                        <button type="button" onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Partial Clearance Checkbox */}
            <div className={`p-4 rounded-2xl border-2 transition-all ${isPartial ? 'border-[#E75618] bg-[#FDEEE8]' : 'border-slate-200 bg-white'}`}>
              <label className="flex gap-3 cursor-pointer items-start">
                <input type="checkbox" className="mt-1 w-5 h-5 text-[#E75618] rounded-md border-slate-300 focus:ring-[#E75618]" checked={isPartial} onChange={e => setIsPartial(e.target.checked)} />
                <div>
                  <span className="font-black text-[#2E1105] block text-xs">เคลียร์ยอดบางส่วน (Partial Clearance)</span>
                  <span className="text-slate-500 text-[11px] mt-0.5 block leading-relaxed">
                    เลือกกรณีนี้เมื่อคุณยังมีบิลใบเสร็จอื่นๆ ที่เกี่ยวข้องกับใบเบิกเงินทดรองจ่ายนี้ที่จะมาส่งเคลียร์เพิ่มภายหลัง (ระบบจะค้างยอดที่เหลือให้เบิกต่อ)
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-6 flex gap-3 pt-4 border-t border-slate-200 shrink-0">
            <button className="flex-1 py-3 px-4 border-2 border-slate-200 hover:border-slate-300 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition text-center" onClick={() => setIsReviewMode(false)}>
              ย้อนกลับไปแก้ไข
            </button>
            <button 
              disabled={isSubmitting}
              className={`flex-1 py-3 px-4 text-white font-bold rounded-xl shadow-md transition text-center flex items-center justify-center gap-1.5 ${
                isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-[#E75618] hover:bg-[#B94513]'
              }`} 
              onClick={async () => {
                if (isSubmitting) return;
                setIsSubmitting(true);
                try {
                  // Pre-validate that all tabs have references selected
                  for (let i = 0; i < tabs.length; i++) {
                    const tab = tabs[i];
                    const tabAdvId = tab.selectedAdvId || selectedId;
                    if (!tabAdvId) {
                      toast(`❌ กรุณาเลือกเอกสารเงินทดรองที่อ้างอิงสำหรับบิลใบที่ ${i + 1} ("${tab.vendorInfo.name || 'บิลใบเสร็จ'}")`, 'err');
                      setIsSubmitting(false);
                      return;
                    }
                  }

                  const receiptsToSubmit: (Receipt & { advId: string })[] = [];
                  const vaultDocsToSubmit: any[] = [];
                  
                  for (let i = 0; i < tabs.length; i++) {
                    const tab = tabs[i];
                    const tabAdvId = tab.selectedAdvId || selectedId;
                    const tabAdvance = advances.find(a => a.id === tabAdvId);
                    if (!tabAdvance) {
                      toast(`❌ ไม่พบข้อมูลการเบิกเงินทดรองสำหรับบิลใบที่ ${i + 1}`, 'err');
                      setIsSubmitting(false);
                      return;
                    }

                    let currentClrNo = `${clrNo}-${i+1}`;
                    try {
                      const res = await fetch('/api/generate-running-number', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'CLR' })
                      });
                      const data = await res.json();
                      if (data.number) currentClrNo = data.number;
                    } catch (err) {}
                    
                    const tabSumRaw = tab.items.reduce((acc, it) => acc + (Number(it.qty) * Number(it.price)), 0);
                    const tabDiscount = Number(tab.receiptExtras.discount) || 0;
                    const tabSignedOther = tab.otherSign === '+' 
                      ? Math.abs(Number(tab.receiptExtras.otherAmount) || 0)
                      : -Math.abs(Number(tab.receiptExtras.otherAmount) || 0);
                    const tabAfterExtras = tabSumRaw - tabDiscount + tabSignedOther;
                    
                    let tabVat = 0;
                    let tabPreVatBase = tabAfterExtras;
                    if (tab.globalVatType === 'include') {
                      tabPreVatBase = tabAfterExtras * 100 / 107;
                      tabVat = tabAfterExtras - tabPreVatBase;
                    } else if (tab.globalVatType === 'exclude') {
                      tabVat = tabAfterExtras * 0.07;
                      tabPreVatBase = tabAfterExtras;
                    }
                    const tabWht = tabPreVatBase * (Number(tab.globalWhtRate) / 100);
                    const tabNet = tabAfterExtras + (tab.globalVatType === 'exclude' ? tabVat : 0) - tabWht;
                    
                    const receipt: Receipt & { advId: string } = {
                      id: currentClrNo,
                      advId: tabAdvId,
                      vendor: tab.vendorInfo.name || 'ร้านค้าทั่วไป',
                      taxId: tab.vendorInfo.taxId,
                      invoiceNo: tab.vendorInfo.docNo,
                      receiptNo: tab.vendorInfo.docNo,
                      date: tab.vendorInfo.docDate,
                      items: tab.items.map(it => {
                        const catId = it.category || masterCategories[0]?.id || 'C01';
                        const matchedCat = masterCategories.find(c => c.id === catId);
                        return {
                          id: String(it.id),
                          desc: it.name,
                          qty: Number(it.qty),
                          unit: 'ชิ้น',
                          projectId: projectMode === 'multiple' ? it.projectId : mainProject,
                          price: Number(it.price),
                          vat: tab.globalVatType === 'none' ? 0 : 7,
                          wht: Number(tab.globalWhtRate),
                          category: matchedCat ? matchedCat.name : 'ค่าใช้จ่ายทั่วไป',
                          status: 'PENDING'
                        };
                      }),
                      subtotal: tabSumRaw,
                      vatAmount: tabVat,
                      whtAmount: tabWht,
                      netTotal: tabNet,
                      matchScore: 100,
                      status: 'PENDING'
                    };
                    
                    receiptsToSubmit.push(receipt);
                    
                    const clrDocId = `VLT-CLR-${Date.now()}-${i}`;
                    vaultDocsToSubmit.push({
                      id: clrDocId,
                      advId: tabAdvId,
                      clrId: currentClrNo,
                      date: new Date().toISOString(),
                      type: 'ใบเคลียร์ยอด (Advance Clearance)',
                      fileName: `${currentClrNo}-Clearance.pdf`,
                      status: 'CLEARED_BY_EMPLOYEE',
                      isClearanceReport: true,
                      itemsSnap: receipt.items,
                      vaultData: {
                        ...tabAdvance,
                        receipts: [receipt]
                      }
                    });
                  }
                  
                  let nextAdvances = [...advances];
                  const uniqueReferencedAdvIds = Array.from(new Set(receiptsToSubmit.map(r => r.advId)));
                  
                  for (const advId of uniqueReferencedAdvIds) {
                    const tabReceipts = receiptsToSubmit.filter(r => r.advId === advId);
                    const advIndex = nextAdvances.findIndex(a => a.id === advId);
                    if (advIndex !== -1) {
                      const currentAdv = nextAdvances[advIndex];
                      nextAdvances[advIndex] = {
                        ...currentAdv,
                        receipts: [...(currentAdv.receipts || []), ...tabReceipts],
                        status: 'CLEARED_BY_EMPLOYEE'
                      };
                    }
                  }

                  await updateMultipleAdvances(nextAdvances);
                  
                  try {
                    const response = await fetch('/api/store/vault-docs');
                    const loaded = await response.json().catch(() => []);
                    const next = [...vaultDocsToSubmit, ...(Array.isArray(loaded) ? loaded : [])];
                    
                    await fetch('/api/store/vault-docs', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(next)
                    });
                  } catch (err) {
                    console.error('Failed to save clearance to Document Vault', err);
                  }

                  toast('✓ ส่งเคลียร์ยอดและยื่นใบสำคัญสำเร็จ สถานะ: ส่งเอกสารเคลียร์แล้ว', 'tok'); 
                  setPage('clearinglist');
                } catch (submitErr: any) {
                  toast(`❌ มีข้อผิดพลาดเกิดขึ้น: ${submitErr.message || submitErr}`, 'err');
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              <FileCheck size={16} /> {isSubmitting ? 'กำลังส่งข้อมูล...' : 'ยืนยันการส่งเคลียร์ยอด'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: DATA ENTRY MODE (หน้าฟอร์มกรอกข้อมูล & อัปโหลดรูป)
  // ==========================================
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-['Noto_Sans_Thai'] text-[13px] relative pb-20">
      
      {/* Page header (desktop only, hidden on mobile-first display) */}
      <div className="hidden lg:flex ph mb-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
        <div>
          <h2 className="text-[#2E1105] font-black text-lg">Clearance Center (ห้องเคลียร์ยอดเงินทดรอง)</h2>
          <p className="text-slate-500">แนบใบเสร็จ แตะสแกนข้อมูลอัจฉริยะผ่าน AI Vision และตรวจสอบใบสำคัญ</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-[#FDEEE8] text-[#E75618] px-3 py-1.5 rounded-xl text-xs border border-[#FADDD1] font-black">เลขเอกสาร: {clrNo}</span>
          <button 
            onClick={() => setActiveTab(activeTab === 'form' ? 'preview' : 'form')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition"
          >
            {activeTab === 'form' ? 'ดู Preview เอกสาร' : 'กลับมาป้อนข้อมูล'}
          </button>
        </div>
      </div>

      {/* Interactive Mobile Header Progress indicators */}
      <div className="lg:hidden p-4 bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-[14px] font-black text-[#2E1105]">ห้องเคลียร์เงินทดรอง</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">แนบใบเสร็จสแกน AI รวดเร็วผ่านมือถือ</p>
          </div>
          <div className="bg-[#FDEEE8] text-[#E75618] px-2 py-0.5 rounded-lg text-[10px] border border-[#FADDD1] font-black">{clrNo}</div>
        </div>
        
        {/* Step pill buttons for mobile-first user experience */}
        <div className="grid grid-cols-3 gap-2 mt-1">
          <button 
            onClick={() => setMobileStep(1)} 
            className={`py-2 px-1 rounded-xl text-[10.5px] font-black border transition-all text-center ${mobileStep === 1 ? 'bg-[#E75618] border-[#E75618] text-white shadow-sm' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
          >
            1. แนบรูป & สแกน
          </button>
          <button 
            onClick={() => setMobileStep(2)} 
            className={`py-2 px-1 rounded-xl text-[10.5px] font-black border transition-all text-center ${mobileStep === 2 ? 'bg-[#E75618] border-[#E75618] text-white shadow-sm' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
          >
            2. ข้อมูลร้านค้า
          </button>
          <button 
            onClick={() => setMobileStep(3)} 
            className={`py-2 px-1 rounded-xl text-[10.5px] font-black border transition-all text-center ${mobileStep === 3 ? 'bg-[#E75618] border-[#E75618] text-white shadow-sm' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
          >
            3. รายการ & แวต
          </button>
        </div>
      </div>

      {/* Desktop/Mobile split containers */}
      <div className="flex flex-col lg:flex-row gap-0 lg:gap-6 flex-1 lg:h-[calc(100vh-120px)] lg:overflow-hidden relative p-0 lg:p-6">
        
        {/* ================= ซ้าย: แบบฟอร์มป้อนข้อมูลหลัก ================= */}
        <div className={`w-full lg:w-1/2 lg:h-full overflow-y-auto p-4 lg:p-0 z-10 flex flex-col custom-scrollbar ${activeTab === 'preview' ? 'hidden lg:flex' : 'flex'}`}>
          
          {/* Select Target Advance Request (Always visible on Form, crucial state) */}
          {mobileStep === 1 && (
            <div className="mb-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm transition-all hover:border-[#E75618]/20">
                <label className="block text-xs font-black text-[#2E1105] mb-2 flex items-center gap-1">
                  <Tags size={14} className="text-[#E75618]" /> เลือกลำดับรายการเบิกที่ต้องการส่งใบเสร็จเคลียร์ยอด
                </label>
                <select 
                    className="w-full border-2 border-slate-200 p-2.5 rounded-xl bg-white text-[#2E1105] text-xs font-semibold focus:border-[#E75618] outline-none disabled:bg-slate-100 disabled:cursor-not-allowed cursor-pointer"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    disabled={!!pageExtra?.advId}
                >
                    <option value="">-- กรุณาเลือกรายการเงินทดรองจ่าย --</option>
                    {availableAdvances.map((a, idx) => (
                      <option key={`${a.id}-${idx}`} value={a.id}>🧾 {a.id} - {a.empName} (วงเงินเบิก: {formatNum(a.amount)} ฿)</option>
                    ))}
                </select>
            </div>
          )}

          {/* Quick Dashboard Widget (Summary of the money flow) */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-[#FADDD1] flex flex-col justify-center text-center">
              <span className="text-[10px] text-slate-400 font-bold block mb-1">ยอดเงินทดรอง</span>
              <span className="text-sm font-black text-[#2E1105] truncate">{formatNum(advanceAmount)} ฿</span>
            </div>
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-[#F09A75] flex flex-col justify-center text-center">
              <span className="text-[10px] text-slate-400 font-bold block mb-1">ยอดเคลียร์รวม</span>
              <span className="text-sm font-black text-[#E75618] truncate">{formatNum(netTotal)} ฿</span>
            </div>
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-[#E75618] flex flex-col justify-center text-center">
              <span className="text-[10px] text-slate-400 font-bold block mb-1">ผลต่าง (ยอดเบิกทั้งหมด - ยอดเคลียร์รวม)</span>
              <span className={`text-sm font-black truncate ${balance < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                {balance >= 0 ? '+' : ''}{formatNum(balance)} ฿
              </span>
            </div>
          </div>

          {!selectedId ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center flex flex-col items-center justify-center my-6 shadow-sm min-h-[350px]">
              <div className="w-16 h-16 bg-[#FDEEE8] text-[#E75618] rounded-full flex items-center justify-center mb-5 border border-[#FADDD1] animate-pulse">
                <FileText size={28} />
              </div>
              <h3 className="font-black text-[#2E1105] text-sm mb-2 font-['Noto_Sans_Thai']">ยังไม่ได้เลือกรายการเงินทดรองจ่าย</h3>
              <p className="text-slate-500 text-xs max-w-sm leading-relaxed font-['Noto_Sans_Thai']">
                กรุณาเลือกเอกสารใบขอเบิกเงินทดรองจ่ายที่คุณต้องการทำรายการ จากเมนูดรอปดาวน์ด้านบน หรือไปที่หน้าหลักเพื่อคลิก "ส่งเคลียร์ยอด" จากรายการที่ต้องการ เพื่อเริ่มอัปโหลดใบเสร็จและทำรายการบันทึกบัญชี
              </p>
            </div>
          ) : (
            <>
              {/* ================= VOUCHER TABS BAR ================= */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-[#2E1105]">รายการบิลใบเสร็จที่แยกสแกน ({tabs.length})</span>
                    <span className="bg-amber-100 text-[#E75618] text-[9px] font-bold px-2 py-0.5 rounded-full">AI แยกยอดอัตโนมัติ</span>
                  </div>
                  <button
                    type="button"
                    onClick={addNewTab}
                    className="px-3 py-1.5 bg-[#E75618]/10 hover:bg-[#E75618]/20 text-[#E75618] font-bold text-[11px] rounded-xl flex items-center gap-1 transition"
                  >
                    <Plus size={12} /> เพิ่มใบเสร็จ
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
                  {tabs.map((tab, idx) => {
                    const isActive = tab.id === activeTabId;
                    return (
                      <div
                        key={tab.id}
                        onClick={() => switchTab(tab.id)}
                        className={`group shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-black cursor-pointer transition-all ${
                          isActive
                            ? 'bg-[#E75618] border-[#E75618] text-white shadow-md'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="truncate max-w-[120px]" title={tab.vendorInfo.name || `บิลใบที่ ${idx + 1}`}>
                          {tab.vendorInfo.name || `บิลใบที่ ${idx + 1}`}
                        </span>
                        {tabs.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => deleteTab(tab.id, e)}
                            className={`p-0.5 rounded hover:bg-black/10 transition ${
                              isActive ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-red-500'
                            }`}
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 font-medium mt-1.5">
                  * หากแนบหลายรูปที่มีรายชื่อผู้รับเงิน/ร้านค้าต่างกัน AI จะทำการจำแนกและแยกแบ่งหน้าจอออกเป็นแถบ (Tabs) ด้านบนนี้ให้โดยอัตโนมัติ
                </p>
              </div>

              {/* ================= MOBILE STEP 1: แนบรูปและสแกน AI ================= */}
              <div className={`space-y-4 ${mobileStep === 1 || window.innerWidth >= 1024 ? 'block' : 'hidden lg:block'}`}>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                  <h3 className="font-black text-xs text-[#2E1105] bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl inline-flex items-center gap-1.5 mb-3">
                <Upload size={14} className="text-[#E75618]" /> 1. อัปโหลดใบเสร็จ & สแกนด้วย AI Vision
              </h3>
              
              <div className="border-2 border-dashed border-slate-200 hover:border-[#E75618] rounded-2xl p-5 bg-slate-50/50 flex flex-col items-center justify-center gap-4 text-center transition">
                {mainAttachments.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto py-2 w-full max-w-full">
                    {mainAttachments.map((att, idx) => (
                      <div key={att.id} className="relative shrink-0 w-40 aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 bg-black flex items-center justify-center shadow-md">
                        <img src={att.url} alt={`Receipt ${idx}`} className="max-w-full max-h-full object-contain" />
                        
                        {isScanning && (
                          <div className="absolute inset-0 bg-[#E75618]/10 flex flex-col items-center justify-center">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#E75618] to-transparent animate-bounce shadow-[0_0_15px_#E75618]" style={{ animationDuration: '2s' }} />
                            <div className="bg-slate-900/90 text-white text-[10px] font-black py-1.5 px-3 rounded-xl border border-[#E75618]/30 flex items-center gap-1.5 animate-pulse">
                              <Sparkles size={12} className="text-amber-400 animate-spin" /> AI Vision...
                            </div>
                          </div>
                        )}

                        <button 
                          type="button" 
                          onClick={() => removeMainAttachment(att.id)}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition"
                          title="ลบภาพนี้"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-4 cursor-pointer" onClick={() => mainFileRef.current?.click()}>
                    <span className="text-4xl opacity-75 mb-2">📸</span>
                    <p className="text-xs font-bold text-slate-700">แตะตรงนี้เพื่อเลือกรูปหรือถ่ายรูปใบเสร็จ</p>
                    <p className="text-[10px] text-slate-400 mt-1">รองรับกล้องมือถือ, รูปภาพ JPEG, PNG, หรือไฟล์ PDF</p>
                    <p className="text-[10px] text-[#E75618] font-bold mt-1">(อัปโหลดได้หลายเอกสาร)</p>
                  </div>
                )}

                <div className="w-full flex gap-2">
                  <input type="file" ref={mainFileRef} onChange={handleMainUpload} className="hidden" multiple accept="image/*,.pdf" />
                  <button 
                    className="flex-1 py-2.5 px-4 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 font-black text-xs text-slate-600 flex items-center justify-center gap-1.5 shadow-sm transition" 
                    onClick={() => mainFileRef.current?.click()}
                  >
                    เพิ่มรูปภาพ/ถ่ายภาพ
                  </button>
                  <button 
                    className={`flex-1 py-2.5 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition whitespace-nowrap ${
                      mainAttachments.length > 0 
                        ? 'bg-[#E75618] hover:bg-[#B94513] text-white' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                    onClick={handleAiScan}
                    disabled={isScanning || mainAttachments.length === 0}
                  >
                    <Sparkles size={14} /> {isScanning ? 'กำลังสแกน...' : 'สแกนอัตโนมัติ (AI)'}
                  </button>
                </div>
                </div>
              </div>
            </div>

            {/* Mobile Next controller */}
            <div className="lg:hidden mt-3">
              <button 
                type="button" 
                onClick={() => setMobileStep(2)}
                className="w-full py-3 bg-[#E75618] text-white font-black text-xs rounded-xl flex items-center justify-center gap-1 shadow-sm"
              >
                ถัดไป: ข้อมูลร้านค้า & เลขผู้เสียภาษี <ChevronRight size={14} />
              </button>
            </div>

          {/* ================= MOBILE STEP 2: ข้อมูลร้านค้าและเอกสาร ================= */}
          <div className={`space-y-4 ${mobileStep === 2 || window.innerWidth >= 1024 ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <h3 className="font-black text-xs text-[#2E1105] bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl inline-flex items-center gap-1.5 mb-3">
                <Store size={14} className="text-[#E75618]" /> 2. ข้อมูลร้านค้าและประเภทบิลเอกสาร
              </h3>

              <div className="mb-4 bg-amber-50 p-3.5 rounded-2xl border border-amber-100">
                <label className="block text-[11px] font-black text-[#2E1105] mb-1.5 flex items-center gap-1">
                  <Tags size={13} className="text-[#E75618]" /> อ้างอิงใบเบิกทดรองจ่ายสำหรับบิลใบนี้ (อ้างอิงแยกใบกันได้)
                </label>
                <select 
                    className="w-full border-2 border-amber-200 p-2.5 rounded-xl bg-white text-[#2E1105] text-xs font-black focus:border-[#E75618] outline-none disabled:bg-slate-100 disabled:cursor-not-allowed cursor-pointer"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    disabled={!!pageExtra?.advId}
                >
                    <option value="">-- กรุณาเลือกรายการเงินทดรองจ่าย --</option>
                    {availableAdvances.map((a, idx) => (
                      <option key={`${a.id}-${idx}`} value={a.id}>🧾 {a.id} - {a.empName} (วงเงินเบิก: {formatNum(a.amount)} ฿)</option>
                    ))}
                </select>
                <p className="text-[10px] text-amber-800/80 mt-1 font-bold">* บัญชีจะเห็นและตรวจสอบใบเคลียร์แยกกันตามเลขที่ใบเคลียร์ยอด</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3.5">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ชื่อร้านค้าที่ออกใบเสร็จ (Vendor Name)</label>
                  <input type="text" className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-xs font-semibold focus:border-[#E75618] outline-none transition-all" placeholder="เช่น หจก.วิศวกรรมไฟฟ้า หรือ แม็คโคร" value={vendorInfo.name} onChange={e => setVendorInfo({...vendorInfo, name: e.target.value})} />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">เลขผู้เสียภาษี 13 หลัก (Tax ID)</label>
                  <input type="text" className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-xs font-semibold focus:border-[#E75618] outline-none transition-all" placeholder="เช่น 0105560124567" value={vendorInfo.taxId} onChange={e => setVendorInfo({...vendorInfo, taxId: e.target.value})} />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">รหัสสาขา</label>
                  <input type="text" className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-xs font-semibold focus:border-[#E75618] outline-none transition-all text-center" value={vendorInfo.branch} onChange={e => setVendorInfo({...vendorInfo, branch: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ประเภทเอกสาร</label>
                  <select className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-xs font-bold focus:border-[#E75618] outline-none bg-white cursor-pointer" value={vendorInfo.docType} onChange={e => setVendorInfo({...vendorInfo, docType: e.target.value})}>
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">เลขที่เอกสาร / เลขที่ใบเสร็จ</label>
                  <input type="text" className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-xs font-semibold focus:border-[#E75618] outline-none transition-all" placeholder="เช่น INV-2026-901" value={vendorInfo.docNo} onChange={e => setVendorInfo({...vendorInfo, docNo: e.target.value})} />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">วันที่ในบิลเอกสาร</label>
                  <input type="date" className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-xs font-semibold focus:border-[#E75618] outline-none transition-all" value={sanitizeDateToYYYYMMDD(vendorInfo.docDate)} onChange={e => setVendorInfo({...vendorInfo, docDate: e.target.value})} />
                </div>
              </div>
            </div>

            {/* Mobile step navigator */}
            <div className="lg:hidden flex gap-2">
              <button 
                type="button" 
                onClick={() => setMobileStep(1)}
                className="flex-1 py-3 bg-white border border-slate-300 text-slate-600 font-bold text-xs rounded-xl"
              >
                ย้อนกลับ
              </button>
              <button 
                type="button" 
                onClick={() => setMobileStep(3)}
                className="flex-1 py-3 bg-[#E75618] text-white font-bold text-xs rounded-xl"
              >
                ถัดไป: ป้อนรายการสินค้า <ChevronRight size={14} className="inline ml-0.5" />
              </button>
            </div>
          </div>

          {/* ================= MOBILE STEP 3: รายการสินค้า แวต และโครงการ ================= */}
          <div className={`space-y-4 ${mobileStep === 3 || window.innerWidth >= 1024 ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <h3 className="font-black text-xs text-[#2E1105] bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl inline-flex items-center gap-1.5 mb-3">
                <Calculator size={14} className="text-[#E75618]" /> 3. ข้อมูลรายจ่ายภาษี และโครงการ
              </h3>
              
              {/* Project settings in Clearance */}
              <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-2">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">โหมดการลงโครงการ</label>
                  <select 
                    className="w-full border border-slate-200 p-2 rounded-lg bg-white text-xs font-bold focus:border-[#E75618] outline-none" 
                    value={projectMode} 
                    onChange={(e) => handleProjectModeChange(e.target.value as 'single' | 'multiple')}
                  >
                    <option value="single">โครงการเดียวทั้งใบ</option>
                    <option value="multiple">แยกโครงการตามรายการสินค้า</option>
                  </select>
                </div>
                
                {projectMode === 'single' && (
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">ระบุโครงการหลัก</label>
                    <select className="w-full border border-slate-200 p-2 rounded-lg bg-white text-xs font-semibold focus:border-[#E75618] outline-none" value={mainProject} onChange={e => handleMainProjectChange(e.target.value)}>
                      {projectsToUse.map(p => {
                        const id = p.id || p.code;
                        const isTarget = targetAdvance?.pIds?.includes(id);
                        return <option key={id} value={id} className={isTarget ? 'bg-amber-100 font-bold text-[#E75618]' : ''}>
                          {isTarget ? '📌 ' : ''}{p.name} {isTarget ? '(อ้างอิงจากใบเบิก)' : ''}
                        </option>;
                      })}
                    </select>
                  </div>
                )}
              </div>

              {/* Items Container: highly polished cards on mobile for quick and touch-friendly editing */}
              <div className="space-y-3.5">
                {items.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="p-3 bg-slate-50/50 border-2 border-slate-200 hover:border-[#E75618]/30 rounded-2xl relative transition-all shadow-sm">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 mb-3">
                      <span className="text-[11px] font-black text-[#E75618]">รายการที่ {idx + 1}</span>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(item.id)} className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition" title="ลบรายการนี้">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {/* Name */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-0.5">รายการวัสดุ/ค่าบริการ</label>
                        <input type="text" className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-semibold focus:border-[#E75618] outline-none bg-white text-[#2E1105]" placeholder="เช่น ค่าอะไหล่ท่อทองแดง, ค่าซ่อมบิลแอร์" value={item.name} onChange={e => updateItem(item.id, 'name', e.target.value)} />
                      </div>

                      {/* Flex grid for numericals */}
                      <div className="grid grid-cols-3 gap-2">
                        {/* Price */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-0.5">ราคาต่อหน่วย</label>
                          <input type="number" min="0" className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-right focus:border-[#E75618] outline-none bg-white" placeholder="0.00" value={item.price === 0 ? '' : item.price} onChange={e => updateItem(item.id, 'price', e.target.value)} />
                        </div>

                        {/* Quantity Stepper (Mobile-First tactile) */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-0.5 text-center">จำนวน</label>
                          <div className="flex items-center justify-between bg-white px-1.5 py-1.5 rounded-xl border border-slate-200">
                            <button 
                              type="button" 
                              onClick={() => updateItem(item.id, 'qty', Math.max(1, (Number(item.qty) || 1) - 1))}
                              className="w-6 h-6 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center font-bold"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="w-5 text-center text-xs font-black text-slate-800">{item.qty || 1}</span>
                            <button 
                              type="button" 
                              onClick={() => updateItem(item.id, 'qty', (Number(item.qty) || 1) + 1)}
                              className="w-6 h-6 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center font-bold"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Total Price Link */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-0.5">รวมราคา</label>
                          <input type="number" min="0" className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-black text-[#E75618] text-right focus:border-[#E75618] outline-none bg-white" placeholder="0.00" value={item.qty * item.price === 0 ? '' : item.qty * item.price} onChange={e => {
                            const newTotal = Number(e.target.value) || 0;
                            const currentQty = Number(item.qty) || 1;
                            updateItem(item.id, 'price', newTotal / currentQty);
                          }} />
                        </div>
                      </div>

                      {/* Expense Category Select (Always visible for every item!) */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-0.5">หมวดหมู่ค่าใช้จ่าย</label>
                        <select 
                          className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-semibold bg-white cursor-pointer focus:border-[#E75618] outline-none transition" 
                          value={item.category || masterCategories[0]?.id || ''} 
                          onChange={e => updateItem(item.id, 'category', e.target.value)}
                        >
                          {masterCategories.map(ct => (
                            <option key={ct.id} value={ct.id}>🏷️ {ct.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Project Level Select (only visible when in multiple projects mode) */}
                      {projectMode === 'multiple' && (
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-0.5">ระบุโครงการสำหรับรายการนี้</label>
                          <select className="w-full border border-slate-200 p-2 rounded-xl text-xs font-semibold bg-white cursor-pointer" value={item.projectId} onChange={e => updateItem(item.id, 'projectId', e.target.value)}>
                            {projectsToUse.map(p => {
                              const id = p.id || p.code;
                              const isTarget = targetAdvance?.pIds?.includes(id);
                              return <option key={id} value={id} className={isTarget ? 'bg-amber-100 font-bold text-[#E75618]' : ''}>
                                {isTarget ? '📌 ' : ''}{p.name} {isTarget ? '(อ้างอิงจากใบเบิก)' : ''}
                              </option>;
                            })}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add item button */}
              <button 
                type="button" 
                onClick={addItem}
                className="w-full py-2.5 bg-slate-50 border-2 border-dashed border-slate-200 text-[#E75618] hover:bg-[#FDEEE8] rounded-2xl font-bold text-xs mt-4 flex items-center justify-center gap-1 transition"
              >
                <Plus size={14} /> เพิ่มรายการบิลใช้จ่ายใหม่
              </button>
            </div>

            {/* ภาษี ส่วนลด และรายการปรับปรุงท้ายเอกสาร (Bottom-of-Doc Adjustments & Automatic Split) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
              <h3 className="font-black text-xs text-[#2E1105] bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl inline-flex items-center gap-1.5 w-full">
                <Percent size={14} className="text-[#E75618]" /> ภาษี ส่วนลด และรายการปรับปรุงท้ายเอกสาร
              </h3>

              <div className="space-y-4">
                {/* Row 1: ส่วนลดท้ายบิล */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ส่วนลดท้ายบิล (฿)</label>
                  <input 
                    type="number" 
                    min="0" 
                    className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-right focus:border-[#E75618] outline-none bg-slate-50 hover:bg-slate-50/50 focus:bg-white" 
                    value={receiptExtras.discount === 0 ? '' : receiptExtras.discount} 
                    onChange={e => setReceiptExtras({...receiptExtras, discount: Number(e.target.value)})} 
                    placeholder="0.00"
                  />
                </div>

                {/* Section: รายการปรับปรุงยอดอื่นๆ */}
                <div className="border-t border-dashed border-slate-200 pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-700">รายการปรับปรุงยอดอื่น ๆ (ระบุเอง)</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">ระบุหัวข้อ / รายละเอียดที่ปรับยอด</label>
                    <input 
                      type="text" 
                      className="w-full border-2 border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 focus:border-[#E75618] outline-none bg-slate-50 hover:bg-slate-50/50 focus:bg-white" 
                      value={receiptExtras.otherLabel || ''} 
                      onChange={e => setReceiptExtras({...receiptExtras, otherLabel: e.target.value})} 
                      placeholder="เช่น ค่าขนส่งด่วน, ค่าธรรมเนียม, ปรับเศษสตางค์"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">ประเภทรายการ</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setOtherSign('+')}
                          className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all text-center flex items-center justify-center gap-1 ${
                            otherSign === '+' 
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-sm font-black">+</span> บวกเพิ่ม
                        </button>
                        <button
                          type="button"
                          onClick={() => setOtherSign('-')}
                          className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all text-center flex items-center justify-center gap-1 ${
                            otherSign === '-' 
                              ? 'bg-red-600 border-red-600 text-white shadow-sm' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-sm font-black">-</span> หักออก
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">จำนวนเงินปรับปรุง (฿)</label>
                      <input 
                        type="number" 
                        min="0"
                        className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-right focus:border-[#E75618] outline-none bg-slate-50 hover:bg-slate-50/50 focus:bg-white" 
                        value={receiptExtras.otherAmount === 0 ? '' : receiptExtras.otherAmount} 
                        onChange={e => setReceiptExtras({...receiptExtras, otherAmount: Math.abs(Number(e.target.value))})} 
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Global VAT Toggles */}
              <div className="pt-2 border-t border-slate-100">
                <label className="text-[11px] font-bold text-slate-500 block mb-1.5">ภาษีมูลค่าเพิ่มท้ายบิล (VAT 7%)</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { key: 'none', label: 'ไม่มี VAT' },
                    { key: 'include', label: 'รวม VAT 7% ในราคาแล้ว' },
                    { key: 'exclude', label: 'แยก VAT 7% บวกเพิ่ม' },
                  ].map(opt => {
                    const isSel = globalVatType === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setGlobalVatType(opt.key as any)}
                        className={`py-2 px-1 rounded-xl text-[10.5px] font-bold border transition-all text-center ${
                          isSel 
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Global WHT Toggles */}
              <div className="pt-2 border-t border-slate-100">
                <label className="text-[11px] font-bold text-slate-500 block mb-1.5">ภาษีหัก ณ ที่จ่ายท้ายบิล (Withholding Tax)</label>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { key: '0', label: 'ไม่มีหัก' },
                    { key: '1', label: 'หัก 1% (ขนส่ง)' },
                    { key: '3', label: 'หัก 3% (บริการ)' },
                    { key: '5', label: 'หัก 5% (ค่าเช่า)' },
                  ].map(opt => {
                    const isSel = globalWhtRate === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setGlobalWhtRate(opt.key)}
                        className={`py-2 px-0.5 rounded-xl text-[10.5px] font-bold border transition-all text-center ${
                          isSel 
                            ? 'bg-purple-700 border-purple-700 text-white shadow-sm' 
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Automatic Split Table (ตารางแจกแจงรายการและภาษีแยกตามสัดส่วนราคาอัตโนมัติ) */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[11px] font-bold text-[#E75618] flex items-center gap-1">
                    <Sparkles size={11} className="animate-pulse text-[#E75618]" /> ระบบแยกรายการและภาษีให้อัตโนมัติ ตามราคา
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Auto-Itemized</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 overflow-x-auto">
                  <table className="w-full text-[10.5px] text-left">
                    <thead>
                      <tr className="text-slate-400 font-bold border-b border-slate-200 pb-1">
                        <th className="pb-1 text-slate-500">ชื่อรายการ</th>
                        <th className="pb-1 text-right text-slate-500">ฐานค่าสินค้า</th>
                        <th className="pb-1 text-right text-slate-500">VAT (7%)</th>
                        <th className="pb-1 text-right text-slate-500">WHT ({globalWhtRate}%)</th>
                        <th className="pb-1 text-right text-slate-500">ยอดสุทธิ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((it, i) => {
                        const raw = Number(it.qty) * Number(it.price);
                        let base = raw;
                        let vat = 0;

                        if (globalVatType === 'include') {
                          base = raw * 100 / 107;
                          vat = raw - base;
                        } else if (globalVatType === 'exclude') {
                          vat = raw * 0.07;
                        }

                        const wht = base * (Number(globalWhtRate) / 100);
                        const itemNet = raw + (globalVatType === 'exclude' ? vat : 0) - wht;

                        return (
                          <tr key={it.id || i} className="text-slate-700 hover:bg-slate-100/50">
                            <td className="py-1.5 font-semibold truncate max-w-[100px]" title={it.name || 'ไม่มีชื่อรายการ'}>
                              {it.name || `รายการที่ ${i+1}`}
                            </td>
                            <td className="py-1.5 text-right font-medium text-slate-600">
                              {formatNum(base)} ฿
                            </td>
                            <td className="py-1.5 text-right font-semibold text-emerald-600">
                              {vat > 0 ? `+${formatNum(vat)}` : '0.00'}
                            </td>
                            <td className="py-1.5 text-right font-semibold text-purple-600">
                              {wht > 0 ? `-${formatNum(wht)}` : '0.00'}
                            </td>
                            <td className="py-1.5 text-right font-black text-[#2E1105]">
                              {formatNum(itemNet)} ฿
                            </td>
                          </tr>
                        );
                      })}
                      
                      {/* Summary Row */}
                      <tr className="border-t border-slate-200 bg-slate-100/30 font-bold">
                        <td className="py-1.5 pl-1 text-[#2E1105]">รวมทั้งสิ้น ({items.length} รายการ)</td>
                        <td className="py-1.5 text-right text-slate-700">
                          {formatNum(items.reduce((acc, it) => {
                            const raw = Number(it.qty) * Number(it.price);
                            return acc + (globalVatType === 'include' ? raw * 100 / 107 : raw);
                          }, 0))} ฿
                        </td>
                        <td className="py-1.5 text-right text-emerald-600">
                          {totalVat > 0 ? `+${formatNum(totalVat)}` : '0.00'}
                        </td>
                        <td className="py-1.5 text-right text-purple-600">
                          {totalWht > 0 ? `-${formatNum(totalWht)}` : '0.00'}
                        </td>
                        <td className="py-1.5 text-right text-[#E75618] font-black pr-1">
                          {formatNum(items.reduce((acc, it) => {
                            const raw = Number(it.qty) * Number(it.price);
                            let base = raw;
                            let vat = 0;
                            if (globalVatType === 'include') {
                              base = raw * 100 / 107;
                              vat = raw - base;
                            } else if (globalVatType === 'exclude') {
                              vat = raw * 0.07;
                            }
                            const wht = base * (Number(globalWhtRate) / 100);
                            return acc + raw + (globalVatType === 'exclude' ? vat : 0) - wht;
                          }, 0))} ฿
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Step-by-Step Pricing Breakdown Visualizer */}
              <div className="mt-4 bg-amber-50/50 border border-amber-100 rounded-xl p-3.5 space-y-3">
                <div className="text-xs font-black text-[#2E1105] flex items-center gap-1">
                  📊 ลำดับขั้นตอนการคำนวณและปันส่วนบัญชีภาษี
                </div>
                
                <div className="space-y-2 text-[11px]">
                  {/* Step 1: สินค้า/บริการ */}
                  <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-1.5 font-bold text-slate-600">
                      <span className="w-4 h-4 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center text-[9px]">1</span>
                      <span>ราคารวมเฉพาะค่าสินค้า / บริการ (Subtotal):</span>
                    </div>
                    <span className="font-bold text-[#2E1105]">{formatNum(subTotalAmount)} ฿</span>
                  </div>

                  {/* Step 2: ส่วนลด */}
                  <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-1.5 font-bold text-slate-600">
                      <span className="w-4 h-4 bg-red-50 text-red-600 rounded-full flex items-center justify-center text-[9px]">2</span>
                      <span>หัก ส่วนลดท้ายบิล:</span>
                    </div>
                    <span className="font-bold text-red-500">-{formatNum(discountAmount)} ฿</span>
                  </div>

                  {/* Step 3: ปรับปรุงอื่นๆ */}
                  {Number(receiptExtras.otherAmount) > 0 && (
                    <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-1.5 font-bold text-slate-600">
                        <span className="w-4 h-4 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-[9px]">3</span>
                        <span>{receiptExtras.otherLabel || 'ปรับปรุงยอดอื่นๆ'}:</span>
                      </div>
                      <span className={`font-bold ${otherSign === '+' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {otherSign === '+' ? '+' : '-'}{formatNum(receiptExtras.otherAmount)} ฿
                      </span>
                    </div>
                  )}

                  {/* Step 4: VAT */}
                  <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-1.5 font-bold text-slate-600">
                      <span className="w-4 h-4 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-[9px]">{Number(receiptExtras.otherAmount) > 0 ? '4' : '3'}</span>
                      <span>ภาษีมูลค่าเพิ่ม (VAT 7% - {globalVatType === 'include' ? 'รวมในราคาแล้ว' : globalVatType === 'exclude' ? 'แยก VAT บวกเพิ่ม' : 'ไม่มี VAT'}):</span>
                    </div>
                    <span className="font-bold text-emerald-600">
                      {globalVatType === 'exclude' ? '+' : ''}{formatNum(totalVat)} ฿
                    </span>
                  </div>

                  {/* Step 5: WHT */}
                  <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-1.5 font-bold text-slate-600">
                      <span className="w-4 h-4 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center text-[9px]">{Number(receiptExtras.otherAmount) > 0 ? '5' : '4'}</span>
                      <span>ภาษีหัก ณ ที่จ่าย (Withholding Tax {globalWhtRate}%):</span>
                    </div>
                    <span className="font-bold text-purple-600">-{formatNum(totalWht)} ฿</span>
                  </div>

                  {/* Step 6: ยอดรวมสุทธิ */}
                  <div className="flex justify-between items-center bg-amber-100/60 p-2.5 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-1.5 font-black text-[#2E1105] text-[11px]">
                      <span className="w-4 h-4 bg-[#E75618] text-white rounded-full flex items-center justify-center text-[9px] font-bold">✓</span>
                      <span>ยอดสุทธิที่ต้องเคลียร์ (Net Total):</span>
                    </div>
                    <span className="font-black text-[#E75618] text-xs">{formatNum(netTotal)} ฿</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Additional Documents (Option) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <h3 className="font-black text-xs text-[#2E1105] bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl inline-flex items-center gap-1.5 mb-3">
                <FileCheck size={14} className="text-[#E75618]" /> แนบไฟล์รูปภาพเอกสารอื่นๆ เสริม
              </h3>
              <div className="border border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/50 text-center cursor-pointer" onClick={() => extraFileRef.current?.click()}>
                <span className="text-xl opacity-60">📁</span>
                <p className="text-[11px] font-bold text-slate-500 mt-1">อัปโหลดภาพใบเสร็จย่อย / สลิปโอนที่เกี่ยวข้อง</p>
                <input type="file" ref={extraFileRef} onChange={handleExtraUpload} className="hidden" multiple accept="image/*,.pdf" />
              </div>
              
              {extraAttachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {extraAttachments.map(ext => (
                    <div key={ext.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-600 truncate max-w-[200px]" title={ext.name}>{ext.name}</span>
                        <button type="button" onClick={() => removeExtra(ext.id)} className="text-red-500 text-xs font-bold px-2 py-0.5 hover:bg-red-50 rounded">ลบ</button>
                      </div>
                      <div>
                        <select 
                          className="w-full text-[11px] p-1.5 border border-slate-200 rounded text-slate-700 bg-white"
                          value={ext.docType || ''}
                          onChange={(e) => updateExtraAttachment(ext.id, 'docType', e.target.value)}
                        >
                          <option value="">-- ระบุประเภทเอกสาร --</option>
                          {['ใบกำกับภาษีเต็มรูปแบบ', 'ใบกำกับภาษีอย่างย่อ', 'ใบเสร็จรับเงิน', 'บิลเงินสด', 'ใบรับของ', 'รูปถ่ายร้าน', 'สำเนาบัตรประชาชน', 'สำเนาหน้าสมุดธนาคาร', 'อื่นๆ (ระบุได้)'].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      {ext.docType === 'อื่นๆ (ระบุได้)' && (
                        <div>
                          <input 
                            type="text" 
                            className="w-full text-[11px] p-1.5 border border-slate-200 rounded text-slate-700 bg-white" 
                            placeholder="ระบุประเภทเอกสาร..."
                            value={ext.otherTypeDesc || ''}
                            onChange={(e) => updateExtraAttachment(ext.id, 'otherTypeDesc', e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile step navigator */}
            <div className="lg:hidden flex gap-2">
              <button 
                type="button" 
                onClick={() => setMobileStep(2)}
                className="flex-1 py-3 bg-white border border-slate-300 text-slate-600 font-bold text-xs rounded-xl"
              >
                ย้อนกลับ
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setActiveTab('preview');
                  toast('✨ สลับมาแสดง Live Clearance Voucher Preview แล้ว', 'info');
                }}
                className="flex-1 py-3 bg-[#E75618] text-white font-bold text-xs rounded-xl"
              >
                ดูพรีวิวใบสำคัญบิล <ChevronRight size={14} className="inline ml-0.5" />
              </button>
            </div>
          </div>
        </>
        )}
      </div>

        {/* ================= ขวา: Live Voucher Preview (Sticky / adapt) ================= */}
        <div className={`w-full lg:w-1/2 lg:h-full overflow-y-auto flex flex-col custom-scrollbar ${activeTab === 'preview' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="flex flex-col bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden h-full">
            <div className="p-4 border-b border-slate-150 bg-slate-50/50 flex flex-wrap justify-between items-center shrink-0 gap-3 no-print">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Eye size={16} className="text-sky-500" />
                  แสดงตัวอย่างเอกสารอ้างอิง (50%)
                </h2>
                <span className="text-[9px] text-purple-700 bg-purple-50 px-2 py-1 rounded-full border border-purple-100 hidden sm:inline-block">Live Viewer</span>
              </div>
              <button 
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-bold rounded-lg transition shadow-sm"
              >
                พิมพ์เอกสาร
              </button>
            </div>

            <div className="flex-1 bg-slate-100/80 p-6 overflow-y-auto custom-scrollbar flex flex-col items-center gap-8 relative">
              <style>
                {`
                  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap');
                  .font-noto-thai { font-family: 'Noto Sans Thai', sans-serif !important; }
                  .font-noto-thai * { font-family: 'Noto Sans Thai', sans-serif !important; }
                `}
              </style>
              <div className="w-full flex justify-center py-4 bg-slate-100 min-h-full overflow-x-hidden">
                {!selectedId ? (
                  <div className="w-full flex flex-col items-center justify-center text-center p-8 py-20 bg-white rounded-3xl border border-slate-200 shadow-sm min-h-[500px]">
                    <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                      <Sparkles size={24} />
                    </div>
                    <h4 className="font-bold text-slate-700 text-xs mb-1 font-['Noto_Sans_Thai']">ระบบพร้อมแสดงพรีวิว</h4>
                    <p className="text-slate-400 text-[11px] max-w-xs leading-normal font-['Noto_Sans_Thai']">
                      ใบสำคัญเคลียร์ยอดเงินทดรอง (Clearance Voucher) จะแสดงตัวอย่างแบบพิมพ์ A4 จริงแบบเรียลไทม์หลังจากท่านทำการเลือกรายการเงินทดรองจ่ายด้านซ้ายเรียบร้อยแล้ว
                    </p>
                  </div>
                ) : (
                  <div className="pdf-p shadow-md bg-white border border-slate-200 rounded-3xl overflow-hidden p-0 md:p-6 lg:p-8 flex justify-center items-start min-h-[500px] w-full max-w-[794px]">
                    <FitPageViewer pageWidth={794} pageHeight={1123}>
                      {renderVoucher()}
                    </FitPageViewer>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Sticky Actions Bar (Mobile touch-friendly footer) */}
      <div className="sbar fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 shadow-[0_-10px_25px_rgba(0,0,0,0.05)] lg:shadow-none flex justify-end no-print">
        <div className="flex gap-3 max-w-7xl mx-auto w-full lg:w-auto">
          <button 
            type="button" 
            className="flex-1 lg:flex-none py-3 px-6 border-2 border-slate-200 text-slate-600 hover:text-[#E75618] hover:border-[#E75618] bg-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
            onClick={() => {
              setPage('clearinglist');
              toast('ย้อนกลับไปหน้ารายการเคลียร์', 'info');
            }}
          >
            ย้อนกลับ
          </button>
          
          {selectedId && (
            <button 
              type="button" 
              className="flex-1 lg:flex-none py-3 px-6 border-2 border-slate-200 text-slate-600 hover:text-[#E75618] hover:border-[#E75618] bg-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
              onClick={async () => {
                if (targetAdvance) {
                  await updateAdvance(targetAdvance.id, {
                    ...targetAdvance,
                    status: 'DRAFT_CLEARANCE'
                  });
                  toast('บันทึกร่างรายการเคลียร์เรียบร้อย', 'ok');
                  setPage('clearinglist');
                }
              }}
            >
              <Save size={14} /> บันทึกร่าง
            </button>
          )}
          
          {selectedId && (
            <button 
              type="button" 
              className="flex-1 lg:flex-none py-3 px-8 bg-[#E75618] hover:bg-[#B94513] text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md transition"
              onClick={() => {
                for (let idx = 0; idx < tabs.length; idx++) {
                  const t = tabs[idx];
                  if (!t.vendorInfo.name) {
                    return toast(`กรุณากรอกชื่อร้านค้าให้ครบถ้วนใน บิลใบที่ ${idx + 1}`, 'err');
                  }
                  if (t.items.some(it => !it.name || !it.price)) {
                    return toast(`กรุณากรอกรายละเอียดและราคาต่อหน่วยในรายการสินค้าใน บิลใบที่ ${idx + 1}`, 'err');
                  }
                }
                setIsReviewMode(true);
                toast('✨ ประมวลผลเข้าระบบกรอกข้อมูลใบสำคัญสำหรับทุกบิลเรียบร้อยแล้ว', 'ok');
              }}
            >
              <Eye size={14} /> ตรวจสอบความถูกต้อง (Preview)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
