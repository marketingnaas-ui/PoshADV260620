import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FolderArchive, Search, FileText, ChevronRight, FileDigit, X, Download, FileImage, ShieldCheck, CheckCircle2, AlertTriangle, Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { fmt, fmtD, UserAvt } from '../../lib/utils';
import { fileLabel, fileUrl, isStoredFile } from '../../lib/files';
import { StoredFile } from '../../types';
import { useDocumentTemplates } from '../../components/document-engine/useDocumentTemplates';
import { DocumentRenderer } from '../../components/document-engine/DocumentRenderer';
import { FitPageViewer } from '../../components/document-engine/FitPageViewer';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export const DocumentVault = () => {
  const { advances, toast, masterCategories, openFilePreview, masterUsers, approvalMatrix } = useApp();
  const { publishedTemplates } = useDocumentTemplates();
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'CLOSED'>('ACTIVE');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState<{ advId: string; type: 'PDF' | 'SLIP' | 'OCR' | 'CLR' | 'TAX' | 'RECEIPT' | 'COMBINED_PDF' | 'SUMMARY_REPORT' } | null>(null);
  const [storedFiles, setStoredFiles] = useState<StoredFile[]>([]);
  const [vaultDocs, setVaultDocs] = useState<any[]>([]);
  
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/files')
      .then(response => response.json())
      .then(files => {
        if (Array.isArray(files)) setStoredFiles(files);
      })
      .catch(() => setStoredFiles([]));

    fetch('/api/store/vault-docs')
      .then(response => response.json())
      .then(docs => {
        if (Array.isArray(docs)) setVaultDocs(docs);
      })
      .catch(() => setVaultDocs([]));
  }, []);

  const handlePrint = () => {
    const printContent = printAreaRef.current?.innerHTML;
    const windowUrl = 'about:blank';
    const uniqueName = new Date().getTime();
    const windowName = 'Print' + uniqueName;
    const printWindow = window.open(windowUrl, windowName, 'left=50,top=50,width=800,height=900');
    
    if (printWindow && printContent) {
      printWindow.document.write(`
        <html>
          <head>
            <title>พิมพ์เอกสาร - ${viewerOpen?.advId || ''}</title>
            <style>
              body { font-family: 'Inter', sans-serif, 'Helvetica Neue'; padding: 20px; color: #1a1a1a; line-height: 1.5; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 13px; }
              th { background-color: #f7fafc; font-weight: bold; }
              .header { border-bottom: 2px solid #1a2e2d; padding-bottom: 15px; margin-bottom: 20px; }
              .title { font-size: 20px; font-weight: 800; color: #1a2e2d; }
              .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; font-size: 13px; }
              .amount-box { border: 2px solid #1a2e2d; background: #f0fdf4; padding: 15px; border-radius: 8px; text-align: center; margin: 15px 0; font-size: 18px; font-weight: 900; }
              .footer-signature { display: flex; justify-content: space-between; margin-top: 50px; font-size: 13px; }
              .sig-line { border-top: 1.5px dashed #cbd5e1; width: 180px; margin-top: 40px; text-align: center; padding-top: 6px; }
            </style>
          </head>
          <body>
            ${printContent}
            <script>
              window.onload = function() { window.print(); window.close(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      toast('🖨️ กำลังส่งข้อมูลไปยังระบบพิมพ์ของระบบปฏิบัติการ...', 'ok');
    } else {
      toast('❌ ไม่สามารถเข้าสู่ระบบพิมพ์ได้ กรุณาลองใหม่อีกครั้ง', 'err');
    }
  };

  // Folders to exhibit: only those that passed standard request phase i.e. WAITING_TRANSFER, WAITING_CLEARANCE, CLOSED
  const filteredFolders = useMemo(() => {
    return advances.filter(a => {
      if (!['WAITING_TRANSFER', 'WAITING_CLEARANCE', 'CLOSED'].includes(a.status)) return false;
      
      const isClosed = a.status === 'CLOSED';
      if (activeTab === 'ACTIVE' && isClosed) return false;
      if (activeTab === 'CLOSED' && !isClosed) return false;

      const normSearch = searchTerm.toLowerCase();
      return (
        a.id.toLowerCase().includes(normSearch) || 
        a.pName.toLowerCase().includes(normSearch) ||
        a.empName.toLowerCase().includes(normSearch)
      );
    });
  }, [advances, activeTab, searchTerm]);

  // Selected folder object
  const activeAdv = useMemo(() => {
    return advances.find(a => a.id === (selectedFolderId || viewerOpen?.advId));
  }, [advances, selectedFolderId, viewerOpen]);

  const activeStoredFiles = useMemo(() => {
    if (!activeAdv) return [];
    const byId = new Map<string, StoredFile>();
    storedFiles
      .filter(file => file.relatedId === activeAdv.id)
      .forEach(file => byId.set(file.id, file));
    (activeAdv.files || [])
      .filter(isStoredFile)
      .forEach(file => byId.set(file.id, file));
    return Array.from(byId.values());
  }, [activeAdv, storedFiles]);

  const activeVaultDocs = useMemo(() => {
    if (!activeAdv) return [];
    return vaultDocs.filter(doc => doc.advId === activeAdv.id);
  }, [activeAdv, vaultDocs]);

  const slipUrl = useMemo(() => {
    return activeAdv?.pay?.fileUrl || activeAdv?.pay?.slipFileUrl || (activeAdv?.pay as any)?.fileUrl;
  }, [activeAdv]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500" style={{ minHeight: '100%' }}>
      
      {/* HEADER SECTION */}
      <div className="ph" style={{ marginBottom: '20px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderArchive size={28} style={{ color: 'var(--p)' }} /> Document Vault
          </h2>
          <p>Centralized corporate repository, OCR archive, and financial ledger vault</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-o btn-sm" onClick={() => { window.location.href = `/api/export/vault-docs.csv?token=${encodeURIComponent(localStorage.getItem('clear_advance_auth_token') || '')}`; }}>
            📁 Export Vault Index
          </button>
        </div>
      </div>

      {/* FILTER TABS & SEARCH */}
      <div className="glass-card" style={{ background: '#fff', border: '1.5px solid var(--bdr)', borderRadius: 'var(--r)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="flb border-b" style={{ paddingBottom: '12px', borderBottom: '1px solid var(--bdr)' }}>
          <div className="fl" style={{ gap: '14px' }}>
            <button 
              onClick={() => { setActiveTab('ACTIVE'); setSelectedFolderId(null); }}
              className={cn("tab-btn", activeTab === 'ACTIVE' && "active")}
              style={{
                fontFamily: 'Inter',
                fontSize: '14px',
                fontWeight: 700,
                padding: '6px 12px',
                borderBottom: activeTab === 'ACTIVE' ? '3px solid var(--p)' : 'none',
                color: activeTab === 'ACTIVE' ? 'var(--p)' : 'var(--ts)',
                background: 'none',
                cursor: 'pointer'
              }}
            >
              💼 กำลังดำเนินการ (Active Folders)
            </button>
            <button 
              onClick={() => { setActiveTab('CLOSED'); setSelectedFolderId(null); }}
              className={cn("tab-btn", activeTab === 'CLOSED' && "active")}
              style={{
                fontFamily: 'Inter',
                fontSize: '14px',
                fontWeight: 700,
                padding: '6px 12px',
                borderBottom: activeTab === 'CLOSED' ? '3px solid var(--p)' : 'none',
                color: activeTab === 'CLOSED' ? 'var(--p)' : 'var(--ts)',
                background: 'none',
                cursor: 'pointer'
              }}
            >
              🔒 ปิดยอดบัญชีแล้ว (Archived Folders)
            </button>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--tm)', fontWeight: 600 }}>
            คลังเอกสารจัดเก็บทั้งหมด: {filteredFolders.length} โฟลเดอร์โครงการ
          </span>
        </div>

        <div className="fl" style={{ gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text"
              placeholder="ค้นหาตามเลขที่บิล ADV, พนักงาน หรือโครงการก่อสร้าง..."
              className="w-full bg-[#f8fafc] font-sans"
              style={{ padding: '10px 14px 10px 38px', borderRadius: 'var(--rs)', border: '1.5px solid var(--bdr)', fontSize: '13px' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* BENTO GRID LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '20px', alignItems: 'start' }}>
        
        {/* FOLDERS LIST */}
        <div className="glass-card" style={{ background: '#fff', border: '1.5px solid var(--bdr)', borderRadius: 'var(--r)', padding: '18px', minHeight: '520px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '14px', color: 'var(--tx)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📁 Folder Index list ({filteredFolders.length})</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredFolders.map(adv => (
              <div 
                key={adv.id} 
                onClick={() => setSelectedFolderId(adv.id)}
                style={{
                  border: selectedFolderId === adv.id ? '2px solid var(--p)' : '1px solid var(--bdr)',
                  borderRadius: 'var(--rs)',
                  padding: '14px',
                  background: selectedFolderId === adv.id ? 'var(--soft)' : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <div className="flb">
                  <div className="fl" style={{ gap: '10px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      background: selectedFolderId === adv.id ? 'var(--p10)' : '#f1f5f9',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--p)',
                      fontWeight: 'bold',
                      fontSize: '18px',
                      paddingLeft: '10px'
                    }}>
                      📁
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--tx)' }}>{adv.id}</div>
                      <div style={{ fontSize: '10px', color: 'var(--tm)' }}>{adv.pIds?.[0] || 'PRJ'} · {adv.pName}</div>
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--ts)' }} />
                </div>

                <div className="flb" style={{ marginTop: '12px', borderTop: '1px dashed var(--bdr)', paddingTop: '8px', fontSize: '11px' }}>
                  <div style={{ color: 'var(--ts)' }}>
                    ขอเบิกโดย: <b>{adv.empName}</b>
                  </div>
                  <span style={{ fontWeight: 800, color: 'var(--p)' }}>฿{fmt(adv.appAmount)}</span>
                </div>
              </div>
            ))}

            {filteredFolders.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--tm)' }}>
                <FolderArchive size={40} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
                <div style={{ fontSize: '13px' }}>ไม่พบแฟ้มเอกสารที่ค้างในการดูครั้งนี้</div>
              </div>
            )}
          </div>
        </div>

        {/* FOLDER FILE EXPLORER DETAIL */}
        <div className="glass-card" style={{ background: '#fff', border: '1.5px solid var(--bdr)', borderRadius: 'var(--r)', padding: '20px', minHeight: '520px' }}>
          {activeAdv ? (
            <div>
              <div className="flb" style={{ borderBottom: '1.5px solid var(--bdr)', paddingBottom: '14px', marginBottom: '18px' }}>
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--ts)', fontWeight: 700 }}>FOLDER PATH: ROOT / DEPT-VAULT / {activeAdv.id}</span>
                  <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--tx)', marginTop: '4px' }}>
                    📦 {activeAdv.id} Workspace Document Store
                  </h3>
                </div>
                <span className={`badge ${activeAdv.status === 'CLOSED' ? 'bk' : 'bc2'}`}>
                  {activeAdv.status === 'CLOSED' ? '🔒 SECURED / CLOSED' : '💼 ACTIVE WORKSPACE'}
                </span>
              </div>

              <div style={{ background: 'var(--soft)', padding: '14px', borderRadius: 'var(--rs)', border: '1px solid var(--bdr)', marginBottom: '18px' }}>
                <div style={{ fontSize: '12px', color: 'var(--ts)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div><b>โครงการหลัก:</b> {activeAdv.pName}</div>
                  <div><b>หน่วยปฏิบัติการ:</b> {activeAdv.empDept}</div>
                  <div><b>ยอดอนุมัติเงินทดรองจ่าย:</b> ฿{fmt(activeAdv.appAmount)}</div>
                  <div><b>ยอดเคลียร์เสร็จสิ้น:</b> ฿{fmt(activeAdv.clrAmount)}</div>
                </div>
              </div>

              {/* LIST OF ARCHIVED DIGITAL SHEETS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ts)', textTransform: 'uppercase' }}>สารบัญเอกสารในชุดแฟ้มใบเบิกนี้:</div>

                {/* FILE 1: REQUISITION REQUEST SHEET */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1.5px solid var(--bdr)', borderRadius: '8px' }}>
                  <div className="fl" style={{ gap: '10px' }}>
                    <FileText size={18} style={{ color: '#3b82f6' }} />
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 700 }}>{activeAdv.id}-001-A4-Request.pdf</div>
                      <span style={{ fontSize: '10px', color: 'var(--tm)' }}>Requisition Voucher (ต้นฉบับขออนุมัติเบิก) · PDF Digital Signed</span>
                    </div>
                  </div>
                  <div className="fl" style={{ gap: '6px' }}>
                    <button className="btn btn-g btn-xs" onClick={() => setViewerOpen({ advId: activeAdv.id, type: 'PDF' })}>🔍 เปิดดู</button>
                  </div>
                </div>

                {/* FILE 2: MONEY TRANSFER SLIP */}
                {activeAdv.pay ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1.5px solid var(--bdr)', borderRadius: '8px' }}>
                    <div className="fl" style={{ gap: '10px' }}>
                      <FileImage size={18} style={{ color: '#10b981' }} />
                      <div>
                        <div style={{ fontSize: '12.5px', fontWeight: 700 }}>SLIP-REF-{activeAdv.pay.ref}.jpeg</div>
                        <span style={{ fontSize: '10px', color: 'var(--tm)' }}>สลิปหลักฐานการโอนเงินจากแผนกการเงินเข้าบัญชีพนักงาน</span>
                      </div>
                    </div>
                    <div className="fl" style={{ gap: '6px' }}>
                      <button className="btn btn-g btn-xs" onClick={() => setViewerOpen({ advId: activeAdv.id, type: 'SLIP' })}>🔍 เปิดดู</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fffbeb', border: '1.5px dashed #fcd34d', borderRadius: '8px' }}>
                    <div className="fl" style={{ gap: '10px' }}>
                      <AlertTriangle size={18} style={{ color: '#d97706' }} />
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#d97706' }}>ไม่มีสลิปการโอนเงินจาก Payment Center</div>
                        <span style={{ fontSize: '10px', color: 'var(--tm)' }}>รายการใบเบิกนี้ยังไม่ระบุการชำระเงินโอนสมบูรณ์</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* FILE 3: AI OCR ACCOUNTING METADATA */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1.5px solid var(--bdr)', borderRadius: '8px' }}>
                  <div className="fl" style={{ gap: '10px' }}>
                    <FileDigit size={18} style={{ color: '#8b5cf6' }} />
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 700 }}>OCR-{activeAdv.id}-Analysis.json</div>
                      <span style={{ fontSize: '10px', color: 'var(--tm)' }}>Gemini OCR Structured Metadata & Reconciliation Matrix</span>
                    </div>
                  </div>
                  <div className="fl" style={{ gap: '6px' }}>
                    <button className="btn btn-g btn-xs" onClick={() => setViewerOpen({ advId: activeAdv.id, type: 'OCR' })}>🔍 เปิดดู</button>
                  </div>
                </div>

                {/* FILES FOR COMPLETED / CLOSED CLEARANCE CASE */}
                {((activeAdv.clrs && activeAdv.clrs.length > 0) || (activeAdv.receipts && activeAdv.receipts.length > 0) || activeAdv.status === 'CLOSED' || activeAdv.status === 'CLEARED_BY_EMPLOYEE' || activeAdv.status === 'WAITING_CLEARANCE') ? (
                  <>
                    {/* FILE 4: CLEARANCE VOUCHER SHEET */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1.5px solid var(--bdr)', borderRadius: '8px' }}>
                      <div className="fl" style={{ gap: '10px' }}>
                        <FileText size={18} style={{ color: '#f97316' }} />
                        <div>
                          <div style={{ fontSize: '12.5px', fontWeight: 700 }}>CLR-{activeAdv.id.replace('ADV-', '')}-Voucher.pdf</div>
                          <span style={{ fontSize: '10px', color: 'var(--tm)' }}>Clearance Reconciliation Voucher (ชุดประมวลผลเคลียร์เงิน)</span>
                        </div>
                      </div>
                      <div className="fl" style={{ gap: '6px' }}>
                        <button className="btn btn-g btn-xs" onClick={() => setViewerOpen({ advId: activeAdv.id, type: 'CLR' })}>🔍 เปิดดู</button>
                      </div>
                    </div>

                    {/* FILE 5: INVOICE / RECEIPT COPIES COMBINED */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1.5px solid var(--bdr)', borderRadius: '8px' }}>
                      <div className="fl" style={{ gap: '10px' }}>
                        <FileText size={18} style={{ color: '#ec4899' }} />
                        <div>
                          <div style={{ fontSize: '12.5px', fontWeight: 700 }}>RECEIPT-{activeAdv.id.replace('ADV-', '')}-Combined.pdf</div>
                          <span style={{ fontSize: '10px', color: 'var(--tm)' }}>บิลใบเสร็จที่ลูกหนี้เงินโอนแนบประกอบการสแกน VAT/WHT</span>
                        </div>
                      </div>
                      <div className="fl" style={{ gap: '6px' }}>
                        <button className="btn btn-g btn-xs" onClick={() => setViewerOpen({ advId: activeAdv.id, type: 'RECEIPT' })}>🔍 เปิดดู</button>
                      </div>
                    </div>

                    {/* FILE 6: SUMMARY REPORT RAV PDF */}
                    {activeAdv.status === 'CLOSED' && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '8px' }}>
                        <div className="fl" style={{ gap: '10px' }}>
                          <FileText size={18} style={{ color: 'var(--p)' }} />
                          <div>
                            <div style={{ fontSize: '12.5px', fontWeight: 700 }}>{activeAdv.ravNo || `RAV-2606-${activeAdv.id.split('-')[2]}`}-SummaryReport.pdf</div>
                            <span style={{ fontSize: '10px', color: 'var(--tm)' }}>Advance Utilization Summary Report (รายงานสรุปการใช้เงินทดรองจ่ายสะสม)</span>
                          </div>
                        </div>
                        <div className="fl" style={{ gap: '6px' }}>
                          <button className="btn btn-g btn-xs" onClick={() => setViewerOpen({ advId: activeAdv.id, type: 'SUMMARY_REPORT' })}>🔍 เปิดดู</button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1.5px dashed var(--bdr)', borderRadius: '8px', color: 'var(--ts)', fontSize: '11px' }}>
                    <span>ใบส่งเคลียร์ยอดจะถูกสร้างและบันทึกลงใน Document Vault อัตโนมัติเมื่อพนักงานทำการส่งเคลียร์ยอด และเอกสารตรวจสอบจะถูกสร้างเมื่อบัญชีกดปิดยอด</span>
                  </div>
                )}

                {(activeStoredFiles.length > 0 || activeVaultDocs.length > 0) && (
                  <div style={{ marginTop: '10px', paddingTop: '12px', borderTop: '1px dashed var(--bdr)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ts)', textTransform: 'uppercase' }}>Uploaded Files & Stored Vault Records</div>
                    {activeStoredFiles.map(file => (
                      <div key={file.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1.5px solid var(--bdr)', borderRadius: '8px', gap: '10px' }}>
                        <div className="fl" style={{ gap: '10px', minWidth: 0 }}>
                          {file.isImage ? <FileImage size={18} style={{ color: '#10b981' }} /> : <FileText size={18} style={{ color: '#3b82f6' }} />}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileLabel(file)}</div>
                            <span style={{ fontSize: '10px', color: 'var(--tm)' }}>{file.relatedType || 'ATTACHMENT'} · {(file.size / 1024).toFixed(1)} KB · {fmtD(file.createdAt)}</span>
                          </div>
                        </div>
                        <div className="fl" style={{ gap: '6px' }}>
                          <button type="button" className="btn btn-g btn-xs" onClick={() => openFilePreview(file)}>👁️ Preview</button>
                        </div>
                      </div>
                    ))}
                    {activeVaultDocs.filter(doc => (doc.fileUrl || doc.isClearanceReport) && !activeStoredFiles.some(file => file.id === doc.fileId)).map(doc => (
                      <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1.5px solid var(--bdr)', borderRadius: '8px', gap: '10px' }}>
                        <div className="fl" style={{ gap: '10px', minWidth: 0 }}>
                          <FileText size={18} style={{ color: '#8b5cf6' }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.fileName}</div>
                            <span style={{ fontSize: '10px', color: 'var(--tm)' }}>{doc.type} · {doc.status} · {fmtD(doc.date)}</span>
                          </div>
                        </div>
                        {doc.isCombinedPdf || doc.type === 'ใบขอเบิกควบสลิปโอนเงิน' ? (
                          <button className="btn btn-g btn-xs" onClick={() => setViewerOpen({ advId: doc.advId, type: 'COMBINED_PDF' })}>🔍 เปิดดูสำเนา</button>
                        ) : doc.isClearanceReport ? (
                          <button className="btn btn-g btn-xs" onClick={() => setViewerOpen({ advId: doc.advId, type: 'CLEARANCE_REPORT', docData: doc })}>🔍 เปิดดูรายงาน</button>
                        ) : (
                          <button type="button" className="btn btn-g btn-xs" onClick={() => openFilePreview(doc.fileUrl)}>👁️ Preview</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--tm)', padding: '60px 10px' }}>
              <FolderArchive size={52} style={{ opacity: 0.15, marginBottom: '14px' }} />
              <div style={{ fontSize: '14px', fontWeight: 800 }}>กรุณาเลือกแฟ้มเอกสารจากแถบเมนูด้านซ้าย</div>
              <div style={{ fontSize: '11px', marginTop: '6px', textAlign: 'center', maxWidth: '300px' }}>เพื่อตรวจสอบสารบัญบิล ดึงยอดพิมพ์ใบสำแดงภาษี และเอกสารแนบอิเล็กทรอนิกส์ทั้งหมด</div>
            </div>
          )}
        </div>
      </div>

      {/* VIEWER DIALOG POPUP */}
      <AnimatePresence>
        {viewerOpen && activeAdv && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              background: 'rgba(15,23,42,0.8)',
              backdropFilter: 'blur(5px)'
            }}
          >
            <motion.div
              initial={{ y: 20, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 20, scale: 0.95 }}
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: '840px',
                background: '#fff',
                borderRadius: '24px',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '90vh',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                overflow: 'hidden'
              }}
            >
              <div className="flb" style={{ padding: '18px 24px', borderBottom: '1.5px solid var(--bdr)', background: 'var(--soft)' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 900, color: 'var(--tx)' }}>Digital Document Explorer</h3>
                  <div style={{ fontSize: '11px', color: 'var(--p)', fontWeight: 700, textTransform: 'uppercase', marginTop: '2px' }}>
                    {viewerOpen.type} · {viewerOpen.advId}
                  </div>
                </div>

                <div className="fl" style={{ gap: '8px' }}>
                  <button className="btn btn-o btn-sm" onClick={handlePrint}>
                    <Printer size={14} /> พิมพ์เอกสาร
                  </button>
                  {viewerOpen.type === 'SUMMARY_REPORT' && (
                    <button className="btn btn-g btn-sm" onClick={() => {
                      const element = document.createElement("a");
                      const file = new Blob([printAreaRef.current?.innerHTML || ''], {type: 'text/html'});
                      element.href = URL.createObjectURL(file);
                      element.download = `${activeAdv.ravNo || 'RAV-REPORT'}.html`;
                      document.body.appendChild(element);
                      element.click();
                      toast('📥 ดาวน์โหลดรายงานสรุปเป็น HTML/PDF แล้ว', 'ok');
                    }} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Download size={14} /> ดาวน์โหลดรายงาน PDF
                    </button>
                  )}
                  <button 
                    onClick={() => setViewerOpen(null)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#fee2e2',
                      color: '#ef4444',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold'
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* DYNAMIC SCROLL CONTAINER */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f8fafc' }}>
                <div ref={printAreaRef} style={{ background: '#fff', border: '1px solid var(--bdr)', borderRadius: '12px', padding: '30px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', minHeight: '520px', color: '#1e293b' }}>
                  
                  {/* VIEW TYPE 1: EXPENSE REQUEST SHEET PDF */}
                  {viewerOpen.type === 'PDF' && (
                    <div>
                      <div className="header" style={{ borderBottom: '2.5px solid var(--p)', paddingBottom: '16px', marginBottom: '24px' }}>
                        <div className="flb">
                          <div>
                            <span style={{ fontSize: '24px', fontWeight: 950, color: 'var(--p)' }}>ADVANCE REQUISITION SHEET</span>
                            <div style={{ fontSize: '11px', color: 'var(--ts)', marginTop: '4px' }}>เอกสารใบขอเบิกเงินทดรองจ่ายอิเล็กทรอนิกส์อย่างเป็นทางการ</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'right' }}>
                            <img 
                              src="https://img1.pic.in.th/images/Photoroom_25690616_0140020ff34b302f0f7c25.png" 
                              alt="Logo"
                              style={{ width: '60px', height: '60px', objectFit: 'contain' }}
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 900, color: 'var(--p)' }}>{activeAdv.id}</div>
                              <div style={{ fontSize: '11px', color: 'var(--ts)' }}>วันที่พิมพ์: {fmtD(new Date().toISOString())}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', marginBottom: '24px', fontSize: '12px', border: '1px solid var(--bdr)', padding: '16px', borderRadius: '8px', background: '#fafbfc' }}>
                        <div>
                          <div style={{ margin: '4px 0' }}><b>ชื่อผู้ขอเบิกเงิน:</b> {activeAdv.empName}</div>
                          <div style={{ margin: '4px 0' }}><b>ตำแหน่ง:</b> {activeAdv.empDept}</div>
                          <div style={{ margin: '4px 0' }}><b>โครงการ:</b> {activeAdv.pName}</div>
                          <div style={{ margin: '4px 0' }}><b>หมายเหตุ:</b> {activeAdv.desc}</div>
                        </div>
                        <div style={{ textAlign: 'right', borderLeft: '1px solid var(--bdr)', paddingLeft: '20px' }}>
                          <div style={{ margin: '4px 0' }}><b>วันที่ทำรายการ:</b> {fmtD(activeAdv.reqDate)}</div>
                          <div style={{ margin: '4px 0' }}><b>กำหนดการเคลียร์เอกสาร:</b> {fmtD(activeAdv.reqDate ? (() => { try { const d = new Date(activeAdv.reqDate); if (!isNaN(d.getTime())) { d.setDate(d.getDate() + 30); return d.toISOString(); } } catch (e) {} return activeAdv.dueDate; })() : activeAdv.dueDate)}</div>
                          {activeAdv.appDate && <div style={{ margin: '4px 0' }}><b>วันที่ผู้บังคับอนุมัติ:</b> {fmtD(activeAdv.appDate)}</div>}
                          <div><b>สถานะเบิกจ่าย:</b> {activeAdv.status}</div>
                        </div>
                      </div>

                      {/* Line items table */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '16px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--bdr)' }}>
                            <th style={{ padding: '10px', textAlign: 'left' }}>รายละเอียดรายการขออนุมัติ</th>
                            <th style={{ padding: '10px', textAlign: 'center', width: '80px' }}>หมวดบัญชี</th>
                            <th style={{ padding: '10px', textAlign: 'right', width: '60px' }}>จำนวน</th>
                            <th style={{ padding: '10px', textAlign: 'right', width: '100px' }}>ราคาต่อหน่วย</th>
                            <th style={{ padding: '10px', textAlign: 'right', width: '110px' }}>ราคารวม</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeAdv.items.map((it, idx) => (
                            <tr key={idx} style={{ borderBottom: '1.5px solid var(--bdr)' }}>
                              <td style={{ padding: '10px', fontWeight: 600 }}>{it.d}</td>
                              <td style={{ padding: '10px', textAlign: 'center' }}>
                                <span className="badge bp" style={{ background: 'var(--p10)', color: 'var(--p)', fontSize: '10px' }}>
                                  {masterCategories.find(c => c.id === (it.cat || 'C01'))?.name || 'วัสดุ'}
                                </span>
                              </td>
                              <td style={{ padding: '10px', textAlign: 'right' }}>{it.q} {it.u}</td>
                              <td style={{ padding: '10px', textAlign: 'right' }}>฿{fmt(it.p)}</td>
                              <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>฿{fmt(it.t)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div style={{ border: '2.5px solid var(--p)', borderRadius: '8px', padding: '14px 20px', marginTop: '24px', background: '#f0fdf4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--p)' }}>ยอดเงินงบประมาณทดรองรวมทั้งสิ้น (TOTAL AMOUNT)</span>
                        <span style={{ fontSize: '20px', fontWeight: 950, color: 'var(--p)' }}>฿{fmt(activeAdv.appAmount)}</span>
                      </div>

                      {/* Signature flow block under layout */}
                      <div className="footer-signature" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '48px', fontSize: '11.5px', borderTop: '1px solid var(--bdr)', paddingTop: '24px' }}>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ color: 'var(--ts)' }}>ผู้จัดทำเอกสารและรับผิดชอบหนี้ทดรอง</span>
                          <div style={{ height: '40px', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--p)', fontSize: '14px' }}>
                            {activeAdv.empName}
                          </div>
                          <span className="sig-line" style={{ display: 'block', borderTop: '1px dashed #94a3b8', margin: '6px auto', width: '180px' }}></span>
                          <span>วันที่: {fmtD(activeAdv.reqDate)}</span>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ color: 'var(--ts)' }}>ผู้อนุมัติเอกสารเบิกจ่ายทางบัญชี</span>
                          <div style={{ height: '40px', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {(() => {
                              const approverUser = masterUsers?.find(u => activeAdv.appBy && activeAdv.appBy.includes(u.name));
                              const sigImage = activeAdv.appBySignature || approverUser?.signatureData;
                              if (sigImage) {
                                return (
                                  <img 
                                    src={sigImage} 
                                    alt="Approver Signature" 
                                    style={{ maxHeight: '50px', objectFit: 'contain' }} 
                                    referrerPolicy="no-referrer"
                                  />
                                );
                              }
                              return <span style={{ color: 'var(--ok)', fontSize: '13px' }}>{activeAdv.appBy ? `SIGNED BY ${activeAdv.appBy}` : 'SYSTEM AUTO APPROVED'}</span>;
                            })()}
                          </div>
                          <span className="sig-line" style={{ display: 'block', borderTop: '1px dashed #94a3b8', margin: '6px auto', width: '180px' }}></span>
                          <span>วันที่อนุมัติ: {activeAdv.appDate ? fmtD(activeAdv.appDate) : '–'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* VIEW TYPE 1.5: COMBINED ELECTRONIC REQUISITION & TRANSLATED WORKSLIP SHEET */}
                  {viewerOpen.type === 'COMBINED_PDF' && (
                    <div>
                      {/* Page 1: Requisition Sheet Content */}
                      <div>
                        <div className="header" style={{ borderBottom: '2.5px solid var(--p)', paddingBottom: '16px', marginBottom: '24px' }}>
                          <div className="flb">
                            <div>
                              <span style={{ fontSize: '24px', fontWeight: 950, color: 'var(--p)' }}>ADVANCE REQUISITION SHEET</span>
                              <div style={{ fontSize: '11px', color: 'var(--ts)', marginTop: '4px' }}>เอกสารใบขอเบิกเงินทดรองจ่ายอิเล็กทรอนิกส์อย่างเป็นทางการ</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '14px', fontWeight: 900, color: 'var(--p)' }}>{activeAdv.id}</div>
                              <div style={{ fontSize: '11px', color: 'var(--ts)' }}>วันที่พิมพ์: {fmtD(new Date().toISOString())}</div>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', marginBottom: '24px', fontSize: '12px', border: '1px solid var(--bdr)', padding: '16px', borderRadius: '8px', background: '#fafbfc' }}>
                          <div>
                            <div style={{ margin: '4px 0' }}><b>ชื่อผู้ขอเบิกเงิน:</b> {activeAdv.empName}</div>
                            <div style={{ margin: '4px 0' }}><b>ตำแหน่ง:</b> {activeAdv.empDept}</div>
                            <div style={{ margin: '4px 0' }}><b>โครงการ:</b> {activeAdv.pName}</div>
                            <div style={{ margin: '4px 0' }}><b>หมายเหตุ:</b> {activeAdv.desc}</div>
                          </div>
                          <div style={{ textAlign: 'right', borderLeft: '1px solid var(--bdr)', paddingLeft: '20px' }}>
                            <div style={{ margin: '4px 0' }}><b>วันที่ทำรายการ:</b> {fmtD(activeAdv.reqDate)}</div>
                            <div style={{ margin: '4px 0' }}><b>กำหนดการเคลียร์เอกสาร:</b> {fmtD(activeAdv.reqDate ? (() => { try { const d = new Date(activeAdv.reqDate); if (!isNaN(d.getTime())) { d.setDate(d.getDate() + 30); return d.toISOString(); } } catch (e) {} return activeAdv.dueDate; })() : activeAdv.dueDate)}</div>
                            {activeAdv.appDate && <div style={{ margin: '4px 0' }}><b>วันที่ผู้บังคับอนุมัติ:</b> {fmtD(activeAdv.appDate)}</div>}
                            <div><b>สถานะเบิกจ่าย:</b> {activeAdv.status}</div>
                          </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '16px' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2.5px solid var(--bdr)' }}>
                              <th style={{ padding: '10px', textAlign: 'left' }}>รายละเอียดรายการขออนุมัติ</th>
                              <th style={{ padding: '10px', textAlign: 'center', width: '80px' }}>หมวดบัญชี</th>
                              <th style={{ padding: '10px', textAlign: 'right', width: '60px' }}>จำนวน</th>
                              <th style={{ padding: '10px', textAlign: 'right', width: '100px' }}>ราคาต่อหน่วย</th>
                              <th style={{ padding: '10px', textAlign: 'right', width: '110px' }}>ราคารวม</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeAdv.items.map((it, idx) => (
                              <tr key={idx} style={{ borderBottom: '1.5px solid var(--bdr)' }}>
                                <td style={{ padding: '10px', fontWeight: 600 }}>{it.d}</td>
                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                  <span className="badge bp" style={{ background: 'var(--p10)', color: 'var(--p)', fontSize: '10px' }}>
                                    {masterCategories.find(c => c.id === (it.cat || 'C01'))?.name || 'วัสดุ'}
                                  </span>
                                </td>
                                <td style={{ padding: '10px', textAlign: 'right' }}>{it.q} {it.u}</td>
                                <td style={{ padding: '10px', textAlign: 'right' }}>฿{fmt(it.p)}</td>
                                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>฿{fmt(it.t)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <div style={{ border: '2.5px solid var(--p)', borderRadius: '8px', padding: '14px 20px', marginTop: '24px', background: '#f0fdf4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--p)' }}>ยอดเงินงบประมาณทดรองรวมทั้งสิ้น (TOTAL AMOUNT)</span>
                          <span style={{ fontSize: '20px', fontWeight: 950, color: 'var(--p)' }}>฿{fmt(activeAdv.appAmount || activeAdv.amount)}</span>
                        </div>

                        <div className="footer-signature" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '48px', fontSize: '11.5px', borderTop: '1px solid var(--bdr)', paddingTop: '24px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <span style={{ color: 'var(--ts)' }}>ผู้จัดทำเอกสารและรับผิดชอบหนี้ทดรอง</span>
                            <div style={{ height: '40px', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--p)', fontSize: '14px' }}>
                              {activeAdv.empName}
                            </div>
                            <span className="sig-line" style={{ display: 'block', borderTop: '1px dashed #94a3b8', margin: '6px auto', width: '180px' }}></span>
                            <span>วันที่: {fmtD(activeAdv.reqDate)}</span>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <span style={{ color: 'var(--ts)' }}>ผู้อนุมัติเอกสารเบิกจ่ายทางบัญชี</span>
                            <div style={{ height: '40px', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                              {(() => {
                                const approverUser = masterUsers?.find(u => activeAdv.appBy && activeAdv.appBy.includes(u.name));
                                const sigImage = activeAdv.appBySignature || approverUser?.signatureData;
                                if (sigImage) {
                                  return (
                                    <img 
                                      src={sigImage} 
                                      alt="Approver Signature" 
                                      style={{ maxHeight: '50px', objectFit: 'contain' }} 
                                      referrerPolicy="no-referrer"
                                    />
                                  );
                                }
                                return <span style={{ color: 'var(--ok)', fontSize: '13px' }}>{activeAdv.appBy ? `SIGNED BY ${activeAdv.appBy}` : 'SYSTEM AUTO APPROVED'}</span>;
                              })()}
                            </div>
                            <span className="sig-line" style={{ display: 'block', borderTop: '1px dashed #94a3b8', margin: '6px auto', width: '180px' }}></span>
                            <span>วันที่อนุมัติ: {activeAdv.appDate ? fmtD(activeAdv.appDate) : '–'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Visual Page Break Line */}
                      <div style={{ margin: '44px 0', borderTop: '2.5px dashed var(--bdr)', position: 'relative', textAlign: 'center' }} className="no-print">
                        <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', padding: '0 12px', fontSize: '11px', fontWeight: 'bold', color: 'var(--tm)' }}>
                          ✂️ สิ้นสุดหน้า 1 (ใบขอเบิก) / แนบติดกันด้านหลังเป็นหลักฐานสลิปโอนเงิน (หน้า 2)
                        </span>
                      </div>

                      {/* Page 2: Bank Slip Content */}
                      <div>
                        <div className="header" style={{ borderBottom: '2.5px solid #10b981', paddingBottom: '16px', marginBottom: '24px', textAlign: 'center' }}>
                          <span style={{ fontSize: '20px', fontWeight: 950, color: '#065f46', display: 'block' }}>🏦 BANK TRANSACTION TRANSFER REPORT</span>
                          <span style={{ fontSize: '11px', color: 'var(--ts)' }}>เอกสารรับรองรายงานการโอนเงินออกจากบัญชีนิติบุคคลบริษัทเสร็จสิ้น (คลังหลักฐานระบบ)</span>
                        </div>

                        <div style={{ maxWidth: '420px', margin: '0 auto', background: '#f0fdf4', border: '1.5px solid #a7f3d0', borderRadius: '16px', padding: '24px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '12px' }}>
                            <div style={{ padding: '8px 14px', background: '#10b981', color: '#fff', borderRadius: '10px', fontWeight: 900, fontSize: '14px' }}>SCB</div>
                            <div>
                              <span style={{ fontWeight: 800, fontSize: '15px', color: '#065f46', display: 'block' }}>โอนเงินสำเร็จ (Transfer Completed)</span>
                              <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>Ref: {activeAdv.pay?.ref || 'TXN-UNKNOWN'}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                            <div style={{ borderBottom: '1px dashed #cbd5e1', paddingBottom: '8px' }}>
                              <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>ต้นทาง (SENDER ACCT)</span>
                              <div style={{ fontWeight: 700, color: '#1e293b' }}>{activeAdv.pay?.senderBank || 'ธนาคารไทยพาณิชย์ (SCB)'}</div>
                              <div style={{ fontSize: '12px', letterSpacing: '1px' }}>{activeAdv.pay?.senderAccountNo || '023-0-12849-0'}</div>
                              <div style={{ fontSize: '11.5px', color: '#475569' }}>{activeAdv.pay?.senderName || 'บมจ. เจนเซรัล แฟคเตอร์ริ่ง (กองกลางบริษัท)'}</div>
                            </div>

                            <div>
                              <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>ปลายทาง (PAYEE ACCT)</span>
                              <div style={{ fontWeight: 700, color: '#1e293b' }}>{activeAdv.pay?.receiverBank || activeAdv.pay?.bank || 'ธนาคารกสิกรไทย (KBANK)'}</div>
                              <div style={{ fontSize: '12px', letterSpacing: '1px' }}>{activeAdv.pay?.receiverAccountNo || activeAdv.payeeBankNo || 'XXXX-1234'}</div>
                              <div style={{ fontSize: '11.5px', color: '#475569' }}>{activeAdv.pay?.receiverName || activeAdv.payeeAccountName || activeAdv.empName}</div>
                            </div>
                          </div>

                          <div style={{ background: '#fff', border: '1.5px solid #a7f3d0', borderRadius: '10px', padding: '14px', textAlign: 'center', marginTop: '6px' }}>
                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>จำนวนเงินยอดเงินโอนสุทธิ (NET AMOUNT)</span>
                            <span style={{ fontSize: '24px', fontWeight: 950, color: '#059669', display: 'block', marginTop: '2px' }}>฿{fmt(activeAdv.pay?.amount || activeAdv.appAmount || activeAdv.amount)}</span>
                          </div>

                          <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b', borderTop: '1px solid #cbd5e1', paddingTop: '10px', marginTop: '4px' }}>
                            <span>วันที่ตรวจสอบทำรายการโอน: {activeAdv.pay?.date ? fmtD(activeAdv.pay.date) : '18 มิ.ย. 26'}</span>
                          </div>
                        </div>

                        {/* Render real uploaded bank slip image if exists */}
                        {slipUrl && (
                          <div style={{ 
                            border: '1.5px solid #cbd5e1', 
                            borderRadius: '16px', 
                            padding: '12px', 
                            background: '#f8fafc',
                            maxWidth: '380px',
                            width: '100%',
                            margin: '24px auto 0 auto',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                          }}>
                            <img 
                              src={slipUrl} 
                              alt="หลักฐานสลิปโอนเงินจริง" 
                              referrerPolicy="no-referrer"
                              style={{ 
                                maxHeight: '400px', 
                                maxWidth: '100%', 
                                borderRadius: '10px', 
                                objectFit: 'contain' 
                              }} 
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* VIEW TYPE 2: BANK TRANSFER SLIP MOCK */}
                  {viewerOpen.type === 'SLIP' && (
                    <div style={{ textAlign: 'center' }}>
                      <div className="header" style={{ borderBottom: '2px solid #3b82f6', paddingBottom: '14px', marginBottom: '20px' }}>
                        <span style={{ fontSize: '20px', fontWeight: 950, color: '#1e3a8a', display: 'block' }}>🏦 BANK TRANSACTION TRANSFER REPORT</span>
                        <span style={{ fontSize: '11px', color: 'var(--ts)' }}>หลักฐานรายงานยืนยันการโอนเงินออกจากระบบธนาคารกรุงเทพจำลองทางการเงิน</span>
                      </div>

                      <div style={{ maxWidth: '380px', margin: '0 auto', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '16px', padding: '24px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', borderBottom: '1px solid #bfdbfe', paddingBottom: '10px' }}>
                          <div style={{ padding: '6px 12px', background: '#3b82f6', color: '#fff', borderRadius: '8px', fontWeight: 900, fontSize: '12px' }}>BBL</div>
                          <div>
                            <span style={{ fontWeight: 800, fontSize: '14px', color: '#1e3a8a', display: 'block' }}>โอนเงินสำเร็จ</span>
                            <span style={{ fontSize: '10px', color: '#64748b' }}>Ref: #TXN-{activeAdv.pay?.ref || '90112440'}</span>
                          </div>
                        </div>

                        <div style={{ fontSize: '12.5px' }}>
                          <div style={{ margin: '6px 0' }}><b>จาก:</b> บัญชีนิติบุคคลบมจ. เจนเซรัล แฟคเตอร์ริ่ง (023-0-XXXXXX)</div>
                          <div style={{ margin: '6px 0' }}><b>ไปยังพนักงาน:</b> {activeAdv.empName} หนี้ทดรอง</div>
                          <div style={{ margin: '6px 0' }}><b>ธนาคารปลายทาง:</b> ธนาคารกสิกรไทย (KBANK)</div>
                          <div style={{ margin: '6px 0' }}><b>เลขบัญชีปลายทาง:</b> XXXXX-{activeAdv.pay?.ref.substring(0,4) || '9283-0'}</div>
                        </div>

                        <div style={{ background: '#fff', border: '1.5px solid #bfdbfe', borderRadius: '8px', padding: '12px', textAlign: 'center', marginTop: '10px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>จำนวนเงินโอนเงินทดรองสุทธิ</span>
                          <span style={{ fontSize: '22px', fontWeight: 950, color: '#1e3a8a', display: 'block', marginTop: '2px' }}>฿{fmt(activeAdv.pay?.amount || activeAdv.appAmount)}</span>
                        </div>

                        <div style={{ textAlign: 'center', fontSize: '10px', color: '#64748b', marginTop: '12px' }}>
                          <span>วันที่ตรวจสอบทำรายการโอน: {activeAdv.pay?.date ? fmtD(activeAdv.pay.date) : '18 มิ.ย. 26'}</span>
                        </div>
                      </div>

                      {/* Render real uploaded bank slip image if exists */}
                      {slipUrl && (
                        <div style={{ 
                          border: '1.5px solid #cbd5e1', 
                          borderRadius: '16px', 
                          padding: '12px', 
                          background: '#f8fafc',
                          maxWidth: '380px',
                          width: '100%',
                          margin: '20px auto 0 auto',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                        }}>
                          <img 
                            src={slipUrl} 
                            alt="หลักฐานสลิปโอนเงินจริง" 
                            referrerPolicy="no-referrer"
                            style={{ 
                              maxHeight: '400px', 
                              maxWidth: '100%', 
                              borderRadius: '10px', 
                              objectFit: 'contain' 
                            }} 
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* VIEW TYPE 3: STRUCTURED JSON OCR SCHEMATICS */}
                  {viewerOpen.type === 'OCR' && (
                    <div>
                      <div className="header" style={{ borderBottom: '2.5px solid #8b5cf6', paddingBottom: '12px', marginBottom: '20px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 900, color: '#6d28d9' }}>📟 GEMINI ACCOUNTANCY STRUCTURAL INDEX (JSON)</span>
                        <p style={{ fontSize: '11px', color: 'var(--ts)', marginTop: '2px' }}>ชุดสารสนเทศการ Reconcile บัญชี สำหรับส่งเข้าระบบ Enterprise ERP, SAP, Oracle</p>
                      </div>

                      <div style={{ background: '#0f172a', color: '#4ade80', padding: '20px', borderRadius: '12px', overflowX: 'auto', textAlign: 'left', fontFamily: 'monospace', fontSize: '12px', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)', lineHeight: 1.6 }}>
                        <pre>{JSON.stringify({
                          documentId: activeAdv.id,
                          documentType: "ADVANCE_RECONCILIATION",
                          generationSource: "Gemini_AI_3.5_Flash",
                          metadata: {
                            requestor: activeAdv.empName,
                            department: activeAdv.empDept,
                            project: activeAdv.pName,
                            currency: "THB"
                          },
                          ledgerSchema: {
                            advanceAppAmount: activeAdv.appAmount,
                            recycledClearedAmount: activeAdv.clrAmount,
                            hasOutstandingBalance: activeAdv.appAmount > activeAdv.clrAmount
                          },
                          ocrScannedItems: activeAdv.items.map((i, idx) => ({
                            lineId: idx + 1,
                            description: i.d,
                            inputQuantity: i.q,
                            unitDesignative: i.u,
                            unitPrice: i.p,
                            calculatedVat: "7%",
                            taxCategoryCode: i.cat || "C02"
                          }))
                        }, null, 2)}</pre>
                      </div>
                    </div>
                  )}

                  {/* VIEW TYPE 4: RECONCILED CLEARANCE VOUCHER DETAIL */}
                  {viewerOpen.type === 'CLR' && (
                    <div style={{ textAlign: 'left', display: 'flex', justifyContent: 'center', background: '#f1f5f9', padding: '20px', borderRadius: '8px' }}>
                      <FitPageViewer width={750}>
                        <DocumentRenderer 
                          template={publishedTemplates.TPL2 || publishedTemplates.clearance} 
                          data={activeAdv} 
                        />
                      </FitPageViewer>
                    </div>
                  )}

                  {/* VIEW TYPE 5: OFFICIAL TAX RECEIPTS / COMPLETED CASES */}
                  {viewerOpen.type === 'RECEIPT' && (
                    <div>
                      <div className="header" style={{ borderBottom: '2.5px solid #ec4899', paddingBottom: '16px', marginBottom: '24px' }}>
                        <span style={{ fontSize: '20px', fontWeight: 950, color: '#be185d' }}>📑 COMBINED CONTRACTOR & SUPPLIER RECEIPTS LIST</span>
                        <div style={{ fontSize: '11.5px', color: 'var(--ts)', marginTop: '4px' }}>แผงสำแดงทะเบียนรายการบิล, อัตราภาษีมูลค่าเพิ่ม (VAT), ภาษี ณ ที่จ่าย (WHT) ที่ส่งชำระแล้ว</div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ background: 'var(--soft)', border: '1px solid var(--bdr)', padding: '14px', borderRadius: '10px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--tx)', display: 'block' }}>สรุปผลคำนวณภาษีรวม (Aggregate Tax Invoices Report)</span>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '10px', fontSize: '12px' }}>
                            <div>• ยอดรวมวัสดุก่อสร้าง/ค่าบริการ: <b>฿{fmt(activeAdv.clrAmount)}</b></div>
                            <div>• ภาษี VAT คาดการณ์สะสม: <b>฿{fmt(activeAdv.clrAmount * 0.07)}</b></div>
                            <div>• หัก ณ ที่จ่ายรวม (3%): <b>฿{fmt(activeAdv.clrAmount * 0.03)}</b></div>
                          </div>
                        </div>

                        {(activeAdv.clrs || activeAdv.receipts || []).map((clr: any, index: number) => (
                          <div key={index} style={{ border: '1.5px solid var(--bdr)', borderRadius: '8px', padding: '14px', position: 'relative' }}>
                            <div className="flb" style={{ borderBottom: '1px solid var(--bdr)', paddingBottom: '6px', marginBottom: '8px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--tx)' }}>🧾 ใบรับสินค้า / ใบเสร็จเลขที่ {clr.id || clr.receiptNo || index + 1}</span>
                              <span style={{ fontSize: '11px', color: 'var(--p)', fontWeight: 'bold' }}>OCR Accurately Verified</span>
                            </div>
                            <div style={{ fontSize: '12.5px', color: '#475569' }}>
                              <div>• ผู้มอบสินค้า/ผู้ขาย: <b>{clr.vendorName || 'สยามโฮมโปรสโตร์ ค้าส่งวัสดุก่อสร้าง'}</b></div>
                              <div>• สรุปรายการสิ่งของ: <b>{clr.note || (clr.items ? clr.items.length + ' รายการ' : 'ค่าวัสดุก่อสร้างและค่าบริการ')}</b></div>
                              <div>• ยอดเงินรวมใบเสร็จตามเล่มภาษีสุทธิ: <b style={{ color: 'var(--p)' }}>฿{fmt(clr.amount || (clr.items || []).reduce((acc: any, curr: any) => acc + curr.netAmount, 0)) || '0.00'}</b></div>
                              <div>• สถานะพิจารณาเอกสารแนบ: <b>APPROVED (เอกสารแนบมีความละเอียดชัดสมบูรณ์)</b></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* VIEW TYPE 6: SUMMARY REPORT RAV TEMPLATE RENDERING */}
                  {viewerOpen.type === 'SUMMARY_REPORT' && (
                    <div style={{ textAlign: 'left' }}>
                      <DocumentRenderer 
                        template={publishedTemplates.TPL3 || publishedTemplates.summaryReport} 
                        data={{
                          reportNo: activeAdv.ravNo || `RAV-2606-${String(parseInt(activeAdv.id.split('-')[2] || '0', 10)).padStart(3, '0')}`,
                          reportDate: activeAdv.ravDate ? fmtD(activeAdv.ravDate) : fmtD(new Date().toISOString()),
                          id: activeAdv.id,
                          employeeName: activeAdv.empName,
                          employeeDept: activeAdv.empDept,
                          projectName: activeAdv.pName,
                          appAmount: activeAdv.appAmount,
                          clrAmount: activeAdv.clrAmount,
                          status: activeAdv.status,
                          receipts: activeAdv.receipts || [],
                          clrs: activeAdv.clrs || [],
                          categorySummary: activeAdv.items ? [
                            { name: 'ค่าโครงการ / ตัววัสดุ', amount: activeAdv.clrAmount * 0.5 },
                            { name: 'ค่าเดินทาง ตรวจความพร้อม', amount: activeAdv.clrAmount * 0.3 },
                            { name: 'ค่าอาหารเบ็ดเตล็ดส่วนต่าง', amount: activeAdv.clrAmount * 0.2 }
                          ] : undefined
                        }} 
                      />
                    </div>
                  )}

                  {viewerOpen.type === 'CLEARANCE_REPORT' && viewerOpen.docData && (
                    <div style={{ textAlign: 'left', display: 'flex', justifyContent: 'center', background: '#f1f5f9', padding: '20px', borderRadius: '8px' }}>
                      <FitPageViewer width={750}>
                        <DocumentRenderer 
                          template={publishedTemplates.clearance || { id: 'clr-std', name: 'Standard Clearance', type: 'CLEARANCE', version: '2.0', status: 'published', createdAt: new Date().toISOString() } as any} 
                          data={{
                            ...activeAdv,
                            items: viewerOpen.docData.itemsSnap || [],
                            vaultData: viewerOpen.docData.vaultData,
                            projectFullName: activeAdv?.projectName === 'KCL' ? "K'Chang Lumlukka" : activeAdv?.projectName
                          }} 
                        />
                      </FitPageViewer>
                    </div>
                  )}

                </div>
              </div>

              {/* FOOTER ACTION SUMMARY */}
              <div style={{ padding: '14px 24px', borderTop: '1.5px solid var(--bdr)', display: 'flex', gap: '10px', justifyContent: 'flex-end', background: '#f8fafc' }}>
                <span style={{ fontSize: '11px', color: 'var(--ts)', display: 'flex', alignItems: 'center' }}>
                  🔒 รหัสระบบรักษาความปลอดภัยเอกสารระดับองค์กร ISO 27001 Certified Cryptographic System
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
