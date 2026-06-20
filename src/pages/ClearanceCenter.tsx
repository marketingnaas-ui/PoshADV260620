import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Receipt } from '../types';
import { 
  AttachmentItem,
  ClearanceItem,
  VendorInfo,
  ReceiptExtras,
  PROJECTS,
  MOCK_ADVANCE,
  DOC_TYPES,
  formatNum
} from './ClearanceCenter/ClearanceCenter.data';
import { ClearanceVoucherPreview } from './ClearanceCenter/ClearanceVoucherPreview';

export function ClearanceCenter() {
  const { advances, updateAdvance, setPage, pageExtra } = useApp();
  
  // Local state for selected ID, initialized from pageExtra or default
  const [selectedId, setSelectedId] = useState<string>(pageExtra?.advId || MOCK_ADVANCE.advNo);

  useEffect(() => {
    if (pageExtra?.advId) {
        setSelectedId(pageExtra.advId);
    }
  }, [pageExtra?.advId]);
  
  const targetAdvance = advances.find(a => a.id === selectedId);
  const displayAdvance = targetAdvance || MOCK_ADVANCE;

  // Filter advances that are ready to be cleared
  const availableAdvances = advances.filter(a => a.status === 'WAITING_CLEARANCE' || a.id === selectedId);

  // --- STATES ---
  // Generate sequential CLR ID based on existing receipts
  const totalExistingReceipts = advances.reduce((acc, a) => acc + (a.receipts?.length || 0), 0);
  const [clrNo] = useState(`CLR-26${String(totalExistingReceipts + 1).padStart(4, '0')}`);
  const [isReviewMode, setIsReviewMode] = useState(false);
  
  // 1. Attachments & Preview
  const [mainAttachment, setMainAttachment] = useState<AttachmentItem | null>(null);
  const [extraAttachments, setExtraAttachments] = useState<AttachmentItem[]>([]);
  const mainFileRef = useRef<HTMLInputElement>(null);
  const extraFileRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  
  // Review Mode States
  const [previewTab, setPreviewTab] = useState<string>('evidence'); // 'evidence' | 'voucher'
  const [activeImgPreview, setActiveImgPreview] = useState<string>('main'); // 'main' or id

  // 2. Vendor & Doc Info
  const [vendorInfo, setVendorInfo] = useState<VendorInfo>({
    name: '', taxId: '', branch: '00000', docType: DOC_TYPES[0], docNo: '', docDate: new Date().toISOString().slice(0, 10)
  });

  // 3. Items & Projects
  const [projectMode, setProjectMode] = useState<string>('single'); 
  const [mainProject, setMainProject] = useState<string>(targetAdvance?.defaultProject || PROJECTS[0].id);
  const [items, setItems] = useState<ClearanceItem[]>([
    { id: 1, name: '', qty: 1, price: 0, projectId: targetAdvance?.defaultProject || PROJECTS[0].id, vatType: 'none', whtRate: '0' }
  ]);

  // 4. Receipt Extras (Discount, Others)
  const [receiptExtras, setReceiptExtras] = useState<ReceiptExtras>({
    discount: 0,
    otherLabel: 'ค่าใช้จ่ายอื่นๆ / ปรับปรุงยอด',
    otherAmount: 0
  });

  // 5. Submission
  const [isPartial, setIsPartial] = useState(false);

  // --- CALCULATIONS ---
  let sumRaw = 0; 
  let sumExcludeVatAdd = 0; 
  let totalVat = 0; 
  let totalWht = 0; 

  items.forEach(it => {
    const raw = Number(it.qty) * Number(it.price);
    sumRaw += raw;
    let base = raw;
    let vat = 0;

    if (it.vatType === 'include') {
      base = raw * 100 / 107;
      vat = raw - base;
    } else if (it.vatType === 'exclude') {
      vat = raw * 0.07;
      sumExcludeVatAdd += vat;
    }

    const wht = base * (Number(it.whtRate) / 100);
    totalVat += vat;
    totalWht += wht;
  });

  const subTotalAmount = sumRaw + sumExcludeVatAdd; 
  const discountAmount = Number(receiptExtras.discount);
  const afterDiscount = subTotalAmount - discountAmount;
  const otherAmount = Number(receiptExtras.otherAmount);
  
  const netTotal = afterDiscount + otherAmount - totalWht;
  const balance = (targetAdvance?.amount || MOCK_ADVANCE.advAmount) - netTotal;

  // --- HANDLERS ---
  const handleMainUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setMainAttachment({ id: 'main', file, url: URL.createObjectURL(file), name: file.name });
  };

  const handleExtraUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles = files.map(f => ({ file: f, url: URL.createObjectURL(f), name: f.name, id: `ext-${Date.now()}-${Math.random()}` }));
    setExtraAttachments([...extraAttachments, ...newFiles]);
  };

  const removeExtra = (id: string) => setExtraAttachments(extraAttachments.filter(a => a.id !== id));

  const handleAiScan = async () => {
    if (!mainAttachment || !mainAttachment.file) return alert('กรุณาแนบรูปภาพหลักฐานก่อนสแกนข้อมูล');
    setIsScanning(true);
    try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
            reader.readAsDataURL(mainAttachment.file);
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
                mimeType: mainAttachment.file.type || 'image/jpeg',
                fileName: mainAttachment.name 
            })
        });
        
        const result = await response.json();
        
        if (result.success && result.data) {
            const data = result.data;
            setVendorInfo({
                name: data.vendor, taxId: data.taxId, branch: '00000', 
                docType: DOC_TYPES[0], docNo: data.invoiceNo || data.receiptNo, docDate: data.date
            });
            interface ScannedItem {
              desc: string;
              qty: number;
              price: number;
              vat?: number;
              wht?: number;
            }
            setItems(data.items.map((it: ScannedItem, i: number) => ({
                id: Date.now() + i, 
                name: it.desc, 
                qty: it.qty, 
                price: it.price, 
                projectId: mainProject, 
                vatType: it.vat === 7 ? 'include' : 'none', 
                whtRate: String(it.wht || 0)
            })));
            alert('สแกนเสร็จสิ้น');
        } else {
            console.error(result);
            alert(result.errorMessage || 'สแกนไม่สำเร็จ');
        }
    } catch (err) {
        console.error(err);
        alert('เกิดข้อผิดพลาดในการสแกน');
    } finally {
        setIsScanning(false);
    }
  };

  const addItem = () => setItems([...items, { id: Date.now(), name: '', qty: 1, price: 0, projectId: projectMode === 'single' ? mainProject : PROJECTS[0].id, vatType: 'none', whtRate: '0' }]);
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
    if (activeImgPreview === 'main') return mainAttachment;
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
      receiptExtras={receiptExtras}
      netTotal={netTotal}
      balance={balance}
    />
  );

  // ==========================================
  // VIEW: REVIEW MODE (หน้าตรวจสอบ)
  // ==========================================
  if (isReviewMode) {
    return (
      <div className="flex h-screen bg-slate-50 font-['Noto_Sans_Thai'] text-[13px]">
        {/* ซ้าย: Document Viewer + Tabs */}
        <div className="w-1/2 flex flex-col bg-slate-100 border-r border-slate-200">
          <div className="flex bg-slate-200 px-4 pt-4 border-b border-slate-300 gap-2">
            <button className={`px-6 py-2 rounded-t-lg font-bold text-[13px] transition-colors ${previewTab === 'evidence' ? 'bg-white text-[#E75618] shadow-[0_-2px_5px_rgba(0,0,0,0.05)]' : 'bg-transparent text-slate-600 hover:bg-slate-300'}`} onClick={() => setPreviewTab('evidence')}>
              📸 เอกสารหลักฐาน
            </button>
            <button className={`px-6 py-2 rounded-t-lg font-bold text-[13px] transition-colors ${previewTab === 'voucher' ? 'bg-white text-[#E75618] shadow-[0_-2px_5px_rgba(0,0,0,0.05)]' : 'bg-transparent text-slate-600 hover:bg-slate-300'}`} onClick={() => setPreviewTab('voucher')}>
              📄 ใบสำคัญเคลียร์ (Preview)
            </button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto flex flex-col items-center custom-scrollbar relative bg-slate-800">
            {previewTab === 'evidence' ? (
              <>
                <div className="w-full flex-1 flex items-center justify-center min-h-[400px]">
                  {activeImg ? (
                    <img src={activeImg.url} alt="Evidence" className="max-w-full max-h-full object-contain rounded shadow-lg bg-white p-1" />
                  ) : (
                    <p className="text-slate-400">ไม่มีรูปภาพหลักฐาน</p>
                  )}
                </div>
                {/* Thumbnails Bar */}
                <div className="w-full mt-4 bg-black/50 p-3 rounded-xl flex gap-3 overflow-x-auto custom-scrollbar">
                  {mainAttachment && (
                    <button onClick={() => setActiveImgPreview('main')} className={`shrink-0 w-20 h-20 rounded border-2 overflow-hidden transition-all ${activeImgPreview === 'main' ? 'border-[#E75618] scale-105' : 'border-slate-600 opacity-60'}`}>
                      <img src={mainAttachment.url} className="w-full h-full object-cover" alt="Main" />
                    </button>
                  )}
                  {extraAttachments.map(ext => (
                    <button key={ext.id} onClick={() => setActiveImgPreview(ext.id)} className={`shrink-0 w-20 h-20 rounded border-2 overflow-hidden transition-all ${activeImgPreview === ext.id ? 'border-[#E75618] scale-105' : 'border-slate-600 opacity-60'}`}>
                      <img src={ext.url} className="w-full h-full object-cover" alt="Extra" />
                    </button>
                  ))}
                  {!mainAttachment && extraAttachments.length === 0 && <span className="text-slate-300 text-[12px] py-2 px-4">ไม่มีเอกสารแนบ</span>}
                </div>
              </>
            ) : (
               <div className="w-full transform scale-90 origin-top">
                {renderVoucher()}
              </div>
            )}
          </div>
        </div>

        {/* ขวา: ข้อมูลให้ตรวจสอบและแก้ไข (White Background Theme) */}
        <div className="w-1/2 p-8 overflow-y-auto bg-white custom-scrollbar">
          <div className="flex justify-between items-end mb-6 pb-4 border-b border-slate-200">
            <div>
              <h1 className="text-[14px] font-bold text-[#2E1105]">ตรวจสอบความถูกต้อง</h1>
              <p className="text-[#8A340F] mt-1 flex items-center gap-2">
                <span className="bg-[#FDEEE8] text-[#E75618] px-2 py-0.5 rounded text-[12px] border border-[#FADDD1]">{clrNo}</span>
                อ้างอิง: {MOCK_ADVANCE.advNo}
              </p>
            </div>
            <div className="text-right bg-white px-4 py-2 rounded-lg border border-[#FADDD1] shadow-sm">
              <p className="text-[12px] text-[#E75618] font-semibold mb-1">ยอดสุทธิ (Net Total)</p>
              <p className="text-[14px] font-bold text-[#E75618]">{formatNum(netTotal)} ฿</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* กล่องตรวจสอบ Vendor */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-bold text-white bg-[#E75618] px-3 py-1.5 rounded inline-block mb-4 text-[14px]">ข้อมูลร้านค้า / ใบกำกับภาษี</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-500 mb-1">ชื่อร้านค้า</label>
                  <input type="text" className="w-full border border-slate-300 p-2 rounded bg-white focus:border-[#E75618] focus:ring-1 focus:ring-[#E75618] outline-none text-[#2E1105]" value={vendorInfo.name} onChange={e => setVendorInfo({...vendorInfo, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-500 mb-1">เลขที่เอกสาร</label>
                  <input type="text" className="w-full border border-slate-300 p-2 rounded bg-white focus:border-[#E75618] focus:ring-1 focus:ring-[#E75618] outline-none text-[#2E1105]" value={vendorInfo.docNo} onChange={e => setVendorInfo({...vendorInfo, docNo: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-500 mb-1">Tax ID</label>
                  <input type="text" className="w-full border border-slate-300 p-2 rounded bg-white focus:border-[#E75618] focus:ring-1 focus:ring-[#E75618] outline-none text-[#2E1105]" value={vendorInfo.taxId} onChange={e => setVendorInfo({...vendorInfo, taxId: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-500 mb-1">วันที่</label>
                  <input type="date" className="w-full border border-slate-300 p-2 rounded bg-white focus:border-[#E75618] focus:ring-1 focus:ring-[#E75618] outline-none text-[#2E1105]" value={vendorInfo.docDate} onChange={e => setVendorInfo({...vendorInfo, docDate: e.target.value})} />
                </div>
              </div>
            </div>

            {/* กล่องตรวจสอบ Items สรุป */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-bold text-white bg-[#E75618] px-3 py-1.5 rounded inline-block mb-4 text-[14px]">สรุปรายการและต้นทุน (Read-only)</h3>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.id} className="flex justify-between items-center text-[13px] border-b border-slate-100 pb-2">
                    <div className="flex-1">
                      <p className="font-medium text-[#2E1105]">{idx + 1}. {item.name || 'ไม่ระบุ'}</p>
                      <p className="text-[12px] text-slate-500">VAT: {item.vatType} | WHT: {item.whtRate}%</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[#2E1105]">{formatNum(item.qty * item.price)} ฿</p>
                      <p className="text-[12px] text-slate-500">{item.qty} ชิ้น</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[12px] text-[#E75618] mt-2 italic">* หากต้องการแก้ไขรายการสินค้าหรือภาษี ให้กด "กลับไปแก้ไข" ด้านล่าง</p>
            </div>

            {/* Partial Clearance Checkbox */}
            <div className={`p-4 rounded-xl border-2 transition-colors ${isPartial ? 'border-[#E75618] bg-[#FDEEE8]' : 'border-slate-200 bg-white'}`}>
              <label className="flex gap-3 cursor-pointer items-start">
                <input type="checkbox" className="mt-1 w-5 h-5 text-[#E75618] rounded border-slate-300 focus:ring-[#E75618]" checked={isPartial} onChange={e => setIsPartial(e.target.checked)} />
                <div>
                  <span className="font-bold text-[#2E1105] block text-[13px]">เคลียร์บางส่วน (Partial Clearance)</span>
                  <span className="text-[#8A340F] text-[12px] mt-1 block leading-relaxed">
                    ติ๊กเลือกข้อนี้หากยังมีเอกสารที่ต้องส่งเพิ่มภายหลัง (ระบบจะบันทึกสถานะเป็น "เคลียร์บางส่วน" และแผนกบัญชีจะไม่สามารถปิดยอดยกยอด ADV นี้ได้จนกว่าจะครบ)
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-8 flex gap-4 pt-6 border-t border-slate-200">
            <button className="flex-1 py-3 px-4 border border-slate-300 text-slate-600 font-bold rounded-lg hover:bg-slate-50 transition" onClick={() => setIsReviewMode(false)}>
              ย้อนกลับไปแก้ไข
            </button>
            <button className="flex-1 py-3 px-4 bg-[#E75618] text-white font-bold rounded-lg hover:bg-[#B94513] shadow-md shadow-[#F5BBA3] transition" onClick={() => { 
                const newReceipt: Receipt = {
                   id: clrNo,
                   vendor: vendorInfo.name,
                   taxId: vendorInfo.taxId,
                   invoiceNo: vendorInfo.docNo,
                   receiptNo: vendorInfo.docNo,
                   date: vendorInfo.docDate,
                   items: items.map(it => ({
                     id: String(it.id),
                     desc: it.name,
                     qty: it.qty,
                     unit: 'ชิ้น',
                     price: it.price,
                     vat: it.vatType === 'none' ? 0 : 7,
                     wht: Number(it.whtRate),
                     category: 'ค่าใช้จ่ายทั่วไป',
                     status: 'PENDING'
                   })),
                   subtotal: subTotalAmount,
                   vatAmount: totalVat,
                   whtAmount: totalWht,
                   netTotal: netTotal,
                   matchScore: 100,
                   status: 'PENDING'
                };
                
                if (targetAdvance) {
                    updateAdvance(targetAdvance.id, {
                        ...targetAdvance,
                        receipts: [...(targetAdvance.receipts || []), newReceipt],
                        status: 'CLEARED_BY_EMPLOYEE'
                    });
                    alert('ส่งข้อมูลสำเร็จ'); 
                    setPage('clearinglist');
                } else {
                    alert('ไม่พบข้อมูลการเบิกเงินต้นทาง');
                }
            }}>
              ยืนยันการเคลียร์ยอด
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: DATA ENTRY MODE (หน้าฟอร์มปกติ White & Orange Theme)
  // ==========================================
  return (
    <div className="flex h-screen bg-white font-['Noto_Sans_Thai'] text-[13px] overflow-hidden">
      
      {/* ================= ซ้าย: แบบฟอร์ม (bg-white) ================= */}
      <div className="w-[55%] h-full overflow-y-auto p-8 z-10 flex flex-col custom-scrollbar border-r border-slate-200">
        
        {/* Select Advance Section */}
        <div className="mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <label className="block text-[12px] font-bold text-slate-500 mb-2">เลือกลำดับรายการเบิกที่ต้องการเคลียร์</label>
            <select 
                className="w-full border border-slate-300 p-2.5 rounded-lg bg-white text-[#2E1105] text-[13px] focus:border-[#E75618] focus:ring-1 focus:ring-[#E75618] outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={!!pageExtra?.advId}
            >
                {availableAdvances.map(a => (
                    <option key={a.id} value={a.id}>{a.id} - {a.empName} (จำนวน {formatNum(a.amount)} ฿)</option>
                ))}
            </select>
        </div>

        {/* แดชบอร์ดแบ่ง 3 ส่วน */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-t-4 border-t-[#FADDD1] flex flex-col justify-center">
            <div className="text-[10px] text-[#E75618] font-bold mb-1 bg-[#FDEEE8] w-max px-2 py-0.5 rounded">{displayAdvance.id || MOCK_ADVANCE.advNo}</div>
            <div className="text-[12px] text-slate-500 mb-1">ยอดที่เบิกมา (ADV)</div>
            <div className="text-[18px] font-black text-[#2E1105]">{formatNum(displayAdvance.amount || MOCK_ADVANCE.advAmount)} ฿</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-t-4 border-t-[#F09A75] flex flex-col justify-center">
            <div className="text-[10px] text-white font-bold mb-1 bg-[#F09A75] w-max px-2 py-0.5 rounded">{clrNo}</div>
            <div className="text-[12px] text-slate-500 mb-1">ยอดที่เคลียร์ในเอกสารนี้</div>
            <div className="text-[18px] font-black text-[#E75618]">{formatNum(netTotal)} ฿</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-t-4 border-t-[#E75618] flex flex-col justify-center">
            <div className="text-[10px] text-transparent select-none mb-1">-</div>
            <div className="text-[12px] text-slate-500 mb-1">ยอดคงค้าง (Balance)</div>
            <div className={`text-[18px] font-black ${balance < 0 ? 'text-red-500' : 'text-[#E75618]'}`}>
              {formatNum(Math.abs(balance))} ฿ {balance < 0 && <span className="text-[12px] font-normal ml-1">(เบิกเพิ่ม)</span>}
            </div>
          </div>
        </div>

        {/* 1. แนบรูปหลักฐาน */}
        <div className="mb-8">
          <h3 className="font-bold text-white bg-[#E75618] px-4 py-2.5 rounded-lg shadow-sm mb-4 flex items-center gap-2 text-[14px]">
            1. อัปโหลดเอกสารหลักฐาน (ใบเสร็จ/ใบกำกับภาษี)
          </h3>
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-5 bg-white flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                {mainAttachment ? <img src={mainAttachment.url} alt="Main doc" className="w-full h-full object-cover" /> : <span className="text-2xl opacity-50">📄</span>}
              </div>
              <div>
                <p className="font-bold text-[#2E1105]">{mainAttachment ? mainAttachment.name : 'ยังไม่ได้แนบเอกสารหลัก'}</p>
                <p className="text-[12px] text-slate-500 mt-1">รองรับ JPG, PNG, PDF ขนาดไม่เกิน 5MB</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input type="file" ref={mainFileRef} onChange={handleMainUpload} className="hidden" accept="image/*,.pdf" />
              <button className="px-4 py-2 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 font-semibold text-slate-600 transition" onClick={() => mainFileRef.current?.click()}>
                แนบไฟล์
              </button>
              <button className="px-4 py-2 bg-[#FDEEE8] text-[#E75618] border border-[#FADDD1] rounded-lg shadow-sm hover:bg-[#FADDD1] font-semibold flex items-center gap-2 transition" onClick={handleAiScan} disabled={isScanning}>
                {isScanning ? 'กำลังสแกน...' : '✨ สแกนข้อมูล'}
              </button>
            </div>
          </div>
        </div>

        {/* 2. ข้อมูลร้านค้า */}
        <div className="mb-8">
          <h3 className="font-bold text-white bg-[#E75618] px-4 py-2.5 rounded-lg shadow-sm mb-4 flex items-center gap-2 text-[14px]">
            2. ข้อมูลร้านค้าและเอกสาร
          </h3>
          <div className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-2 gap-4 shadow-sm">
            <div className="col-span-2">
              <label className="block text-[12px] font-bold text-slate-500 mb-1">ชื่อร้านค้า</label>
              <input type="text" className="w-full border border-slate-300 p-2.5 rounded-lg focus:border-[#E75618] focus:ring-1 focus:ring-[#E75618] outline-none bg-white text-[#2E1105] transition-all" value={vendorInfo.name} onChange={e => setVendorInfo({...vendorInfo, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-500 mb-1">เลขผู้เสียภาษี</label>
              <input type="text" className="w-full border border-slate-300 p-2.5 rounded-lg focus:border-[#E75618] focus:ring-1 focus:ring-[#E75618] outline-none bg-white text-[#2E1105] transition-all" value={vendorInfo.taxId} onChange={e => setVendorInfo({...vendorInfo, taxId: e.target.value})} />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-500 mb-1">สาขา</label>
              <input type="text" className="w-full border border-slate-300 p-2.5 rounded-lg focus:border-[#E75618] focus:ring-1 focus:ring-[#E75618] outline-none bg-white text-[#2E1105] transition-all" value={vendorInfo.branch} onChange={e => setVendorInfo({...vendorInfo, branch: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className="block text-[12px] font-bold text-slate-500 mb-1">ประเภทเอกสาร</label>
              <select className="w-full border border-slate-300 p-2.5 rounded-lg focus:border-[#E75618] focus:ring-1 focus:ring-[#E75618] outline-none bg-white text-[#2E1105] transition-all" value={vendorInfo.docType} onChange={e => setVendorInfo({...vendorInfo, docType: e.target.value})}>
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-500 mb-1">เลขที่เอกสารอ้างอิง</label>
              <input type="text" className="w-full border border-slate-300 p-2.5 rounded-lg focus:border-[#E75618] focus:ring-1 focus:ring-[#E75618] outline-none bg-white text-[#2E1105] transition-all" value={vendorInfo.docNo} onChange={e => setVendorInfo({...vendorInfo, docNo: e.target.value})} />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-500 mb-1">วันที่ในเอกสาร</label>
              <input type="date" className="w-full border border-slate-300 p-2.5 rounded-lg focus:border-[#E75618] focus:ring-1 focus:ring-[#E75618] outline-none bg-white text-[#2E1105] transition-all" value={vendorInfo.docDate} onChange={e => setVendorInfo({...vendorInfo, docDate: e.target.value})} />
            </div>
          </div>
        </div>

        {/* 3. รายการสินค้า ภาษี ส่วนลด */}
        <div className="mb-8 flex-1">
          <h3 className="font-bold text-white bg-[#E75618] px-4 py-2.5 rounded-lg shadow-sm mb-4 flex items-center gap-2 text-[14px]">
            3. รายการสินค้า, ภาษี และส่วนลด
          </h3>
          
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            {/* Project Mode Toggle */}
            <div className="mb-4 pb-4 border-b border-slate-100">
               <label className="block text-[12px] font-bold text-slate-500 mb-1">โหมดโครงการ</label>
               <select 
                  className="w-full border border-slate-300 p-2 rounded-lg bg-white text-[#2E1105] text-[12px] focus:border-[#E75618] focus:ring-1 focus:ring-[#E75618] outline-none" 
                  value={projectMode} 
                  onChange={(e) => handleProjectModeChange(e.target.value as 'single' | 'multiple')}
                >
                 <option value="single">ลงโครงการเดียวกันทั้งหมด</option>
                 <option value="multiple">แยกโครงการตามรายการสินค้า</option>
               </select>
            </div>
            
            {projectMode === 'single' && (
              <div className="mb-4">
                <label className="block text-[12px] font-bold text-slate-500 mb-1">เลือกโครงการหลัก</label>
                <select className="w-full border border-slate-300 p-2 rounded-lg bg-white text-[#2E1105] focus:border-[#E75618] focus:ring-1 focus:ring-[#E75618] outline-none" value={mainProject} onChange={e => handleMainProjectChange(e.target.value)}>
                  {PROJECTS.map(p => <option key={p.id} value={p.id}>{p.id} - {p.name}</option>)}
                </select>
              </div>
            )}

            {/* Items Data Entry Grid */}
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-2 gap-2 bg-white border border-slate-200 p-3 rounded-lg relative transition-all focus-within:ring-1 focus-within:ring-[#E75618] focus-within:border-[#E75618] shadow-sm">
                  <input type="text" className="col-span-2 border border-slate-300 p-2 rounded outline-none text-[13px] text-[#2E1105] bg-white focus:border-[#E75618]" placeholder={`รายการที่ ${idx + 1}`} value={item.name} onChange={e => updateItem(item.id, 'name', e.target.value)} />
                  <input type="number" min="1" className="border border-slate-300 p-2 rounded text-left outline-none text-[13px] text-[#2E1105] bg-white focus:border-[#E75618]" placeholder="จำนวน" value={item.qty} onChange={e => updateItem(item.id, 'qty', e.target.value)} />
                  <input type="number" min="0" className="border border-slate-300 p-2 rounded text-right outline-none text-[13px] text-[#2E1105] bg-white focus:border-[#E75618]" placeholder="ราคา/หน่วย" value={item.price} onChange={e => updateItem(item.id, 'price', e.target.value)} />
                  <select className="border border-slate-300 p-2 rounded outline-none text-[12px] bg-white text-slate-600 focus:border-[#E75618]" value={item.vatType} onChange={e => updateItem(item.id, 'vatType', e.target.value)}>
                      <option value="none">ไม่มีแวต</option>
                      <option value="exclude">มีแวต 7% (บวกเพิ่ม)</option>
                      <option value="include">รวมแวต 7% แล้ว</option>
                  </select>
                  <select className="border border-slate-300 p-2 rounded outline-none text-[12px] bg-white text-slate-600 focus:border-[#E75618]" value={item.whtRate} onChange={e => updateItem(item.id, 'whtRate', e.target.value)}>
                      <option value="0">ไม่มีหัก ณ ที่จ่าย</option>
                      <option value="1">หัก ณ ที่จ่าย 1%</option>
                      <option value="3">หัก ณ ที่จ่าย 3%</option>
                      <option value="5">หัก ณ ที่จ่าย 5%</option>
                  </select>
                  {projectMode === 'multiple' && (
                     <select className="col-span-2 border border-slate-300 p-2 rounded outline-none text-[12px] bg-white text-slate-600 truncate focus:border-[#E75618]" value={item.projectId} onChange={e => updateItem(item.id, 'projectId', e.target.value)}>
                      {PROJECTS.map(p => <option key={p.id} value={p.id}>{p.id} - {p.name}</option>)}
                    </select>
                  )}
                  {items.length > 1 && (
                    <button className="absolute top-3 right-3 text-red-500 bg-white border border-red-200 rounded p-1 hover:bg-red-50 transition shadow-sm" onClick={() => removeItem(item.id)} title="ลบรายการนี้">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              ))}
              <button className="mt-1 text-[13px] font-bold text-[#E75618] hover:text-[#B94513] flex items-center gap-1 bg-[#FDEEE8] px-3 py-1.5 rounded-md transition" onClick={addItem}>
                + เพิ่มรายการสินค้า
              </button>
            </div>

            {/* Receipt Summary Box */}
            <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col items-end">
              <div className="w-[320px] space-y-2 text-[13px] text-slate-600">
                <div className="flex justify-between items-center px-2 py-1">
                  <span>มูลค่าสินค้ารวม (Subtotal):</span>
                  <span className="font-semibold text-[#2E1105]">{formatNum(subTotalAmount)} ฿</span>
                </div>
                <div className="flex justify-between items-center px-2 py-1 bg-white rounded border border-slate-200 shadow-sm">
                  <span>ส่วนลด (Discount):</span>
                  <div className="relative">
                    <input type="number" className="w-24 border border-slate-300 p-1.5 text-right rounded outline-none focus:border-[#E75618] focus:ring-1 focus:ring-[#E75618] bg-white text-[#E75618]" placeholder="0" value={receiptExtras.discount || ''} onChange={e => setReceiptExtras({...receiptExtras, discount: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="flex justify-between items-center px-2 py-1">
                  <span>หลังหักส่วนลด:</span>
                  <span className="font-semibold text-[#2E1105]">{formatNum(afterDiscount)} ฿</span>
                </div>
                <div className="flex justify-between items-center px-2 py-1 text-slate-400 text-[12px]">
                  <span>(รวมภาษีมูลค่าเพิ่มในยอดข้างต้น:</span>
                  <span>{formatNum(totalVat)} ฿)</span>
                </div>
                <div className="flex justify-between items-center px-2 py-1 bg-white rounded border border-slate-200 shadow-sm">
                  <input type="text" className="w-32 border border-slate-300 p-1.5 rounded outline-none focus:border-[#E75618] focus:ring-1 focus:ring-[#E75618] text-[12px] bg-white text-slate-600" value={receiptExtras.otherLabel} onChange={e => setReceiptExtras({...receiptExtras, otherLabel: e.target.value})} placeholder="ระบุรายการ (+/-)" title="ระบุค่าใช้จ่ายอื่นๆ หรือปรับปรุงยอด" />
                  <input type="number" className="w-24 border border-slate-300 p-1.5 text-right rounded outline-none focus:border-[#E75618] focus:ring-1 focus:ring-[#E75618] bg-white text-[#E75618]" placeholder="0" value={receiptExtras.otherAmount || ''} onChange={e => setReceiptExtras({...receiptExtras, otherAmount: Number(e.target.value)})} />
                </div>
                <div className="flex justify-between items-center px-2 py-1">
                  <span>หัก ภาษี ณ ที่จ่ายรวม (WHT):</span>
                  <span className="text-red-500 font-semibold">-{formatNum(totalWht)} ฿</span>
                </div>
                <div className="flex justify-between items-center px-2 py-3 mt-2 border-t-2 border-[#E75618] font-bold text-[16px] text-[#E75618] bg-[#FDEEE8] rounded-b">
                  <span>ยอดสุทธิ (Net Total):</span>
                  <span>{formatNum(netTotal)} ฿</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. เอกสารเพิ่มเติม */}
        <div className="mb-10">
          <h3 className="font-bold text-white bg-[#E75618] px-4 py-2.5 rounded-lg shadow-sm mb-4 flex items-center gap-2 text-[14px]">
            4. แนบเอกสารเพิ่มเติมอื่นๆ (ถ้ามี)
          </h3>
          <input type="file" multiple ref={extraFileRef} onChange={handleExtraUpload} className="hidden" />
          <button className="px-4 py-2 border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 font-medium text-slate-600 text-[13px] flex gap-2 transition bg-white" onClick={() => extraFileRef.current?.click()}>
            <span>📎</span> เลือกไฟล์เพิ่มเติม...
          </button>
          {extraAttachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {extraAttachments.map(att => (
                <div key={att.id} className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] flex items-center gap-2 shadow-sm">
                  <span className="truncate max-w-[150px] font-medium text-slate-700">{att.name}</span>
                  <button className="text-red-500 font-bold hover:bg-red-50 px-1.5 rounded" onClick={() => removeExtra(att.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 p-4 -mx-8 mt-auto flex justify-between items-center shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
          <button className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-lg transition border border-transparent hover:border-slate-200">
            บันทึกร่าง
          </button>
          <button className="px-8 py-2.5 bg-[#E75618] text-white font-bold rounded-lg shadow-lg hover:bg-[#B94513] transition" onClick={() => setIsReviewMode(true)}>
            ตรวจสอบและส่งข้อมูล ➔
          </button>
        </div>
      </div>

      {/* ================= ขวา: PREVIEW ================= */}
      <div className="w-[45%] h-full p-6 overflow-y-auto bg-slate-100 flex justify-center items-start custom-scrollbar border-l border-slate-200">
        {renderVoucher()}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        @media print {
          .print-area { box-shadow: none !important; border: none !important; }
        }
      `}} />
    </div>
  );
}
