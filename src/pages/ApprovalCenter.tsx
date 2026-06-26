import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { fmt, fmtD, SBadge, UserAvt } from '../lib/utils';
import { uploadFileToServer, fileLabel } from '../lib/files';
import { AdvanceDetailView } from '../components/AdvanceDetailView';
import { CheckSquare, CreditCard, Clock, FileText, Clipboard, Check, Sparkles, Upload, FileImage, ShieldCheck, Printer, Trash2 } from 'lucide-react';

interface ExtractedSlipData {
  senderBank: string;
  senderAccountNo: string;
  senderName: string;
  receiverBank: string;
  receiverAccountNo: string;
  receiverName: string;
  refNo: string;
  amount: number;
  date: string;
  time: string;
  fileId?: string;
  fileUrl?: string;
}

export const ApprovalCenter = () => {
  const { advances, updateAdvance, openDrawer, toast, masterUsers, pageExtra, openModal, closeModal, approvalMatrix } = useApp();
  
  const [dbRoles, setDbRoles] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/store/roles')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setDbRoles(data);
      })
      .catch(() => {});
  }, []);
  
  // Tab handling (รออนุมัติ, รอโอน, ประวัติการอนุมัติ)
  // Default to extra tab param if provided, otherwise 'pending'
  const [activeTab, setActiveTab] = useState<'pending' | 'transfer' | 'history'>('pending');
  
  useEffect(() => {
    if (pageExtra?.tab === 'waiting_transfer') {
      setActiveTab('transfer');
    } else if (pageExtra?.tab === 'pending_approval') {
      setActiveTab('pending');
    }
  }, [pageExtra]);



  // Modals / Overlays
  const [previewAdvId, setPreviewAdvId] = useState<string | null>(null);
  const [combinedPreviewAdvId, setCombinedPreviewAdvId] = useState<string | null>(null);

  // Transfer Processing states
  const [processingAdvId, setProcessingAdvId] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isAttaching, setIsAttaching] = useState<Record<string, boolean>>({});
  const [senderBankDefault, setSenderBankDefault] = useState<string>('ธนาคารไทยพาณิชย์ (SCB)');
  const [senderAccDefault, setSenderAccDefault] = useState<string>('023-0-12849-0');
  const [senderNameDefault, setSenderNameDefault] = useState<string>('บมจ. เจนเซรัล แฟคเตอร์ริ่ง (กองกลางบริษัท)');
  
  const [extractedData, setExtractedData] = useState<Record<string, ExtractedSlipData>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});


  // Filter lists
  const isPending = (s: string) => s === 'PENDING_APPROVAL' || s === 'รออนุมัติ';
  const isTransferStatus = (s: string) => s === 'WAITING_TRANSFER' || s === 'รอโอน' || s === 'รอโอนเงิน' || s === 'รอโอนเงินทดรอง' || s === 'รอโอนเงินทดรองจ่าย';
  const hasPayment = (r: any) => !!(r.pay && Object.keys(r.pay).length > 0) || !!r.tempSlip;

  const pendingData = advances.filter(r => isPending(r.status));
  const transferData = advances.filter(r => isTransferStatus(r.status) && !hasPayment(r));
  const historyData = advances.filter(r => !isPending(r.status) && (!isTransferStatus(r.status) || hasPayment(r)));

  // Copy to clipboard helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast('📋 คัดลอกเลขบัญชีต้นทางเรียบร้อย', 'ok');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Approval actions
  const openPinApprovalModal = (id: string, action: 'APPROVE' | 'REJECT' | 'TRANSFER') => {
    const r = advances.find(x => x.id === id);
    if (!r) return;

    const actionLabel = action === 'APPROVE' ? 'อนุมัติใบเบิก' : action === 'REJECT' ? 'ไม่อนุมัติ/ปฏิเสธ' : 'บันทึกการโอนเงินสะสม';
    const actionColor = action === 'APPROVE' ? 'var(--ok)' : action === 'REJECT' ? 'var(--err)' : 'var(--p)';

    openModal(
      `🔒 ยืนยันรหัสลงนามตรวจสอบสิทธิ์ (${actionLabel})`,
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '6px 2px' }}>
        <p style={{ fontSize: '13px', color: 'var(--ts)', margin: 0, lineHeight: '1.4' }}>
          การยืนยันระบบอิเล็กทรอนิกส์สำหรับรายการ <b>{id}</b> โปรดระบุรหัสลงนามประจำตัวคุณ (Personal PIN / Password)
        </p>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--p)', display: 'block', marginBottom: '5px' }}>รหัสลงนามประจำตัว (PIN / Password) *</label>
          <input 
            id="cf_center_password"
            type="password" 
            placeholder="ระบุรหัสประจำตัว หรือระบบผ่านของท่าน" 
            style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--bdr)', borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace' }} 
          />
          <p style={{ fontSize: '11px', color: 'var(--ts)', marginTop: '4px' }}>
            * ระบบจะสแกนหาและตรวจสอบชื่อของท่านโดยอัตโนมัติจากตารางทะเบียนรายชื่อพนักงาน
          </p>
        </div>
        {action === 'REJECT' && (
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--p)', display: 'block', marginBottom: '5px' }}>เหตุผลในการปฏิเสธคำขอเบิกเงินล่วงหน้า *</label>
            <textarea 
              id="cf_center_reject_reason"
              placeholder="โปรดระบุรายละเอียด (เช่น เอกสารอ้างอิงไม่พร้อม หรือระบุยอดไม่สอดคล้อง)..." 
              style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--bdr)', borderRadius: '6px', fontSize: '13px', minHeight: '60px' }}
            />
          </div>
        )}
      </div>,
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
        <button className="btn btn-o" onClick={closeModal}>ยกเลิก</button>
        <button className="btn" style={{ background: actionColor, color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 16px', fontSize: '12.5px', fontWeight: 600 }} onClick={async () => {
          const passwordValueVal = (document.getElementById('cf_center_password') as HTMLInputElement)?.value || '';
          const rejectReasonVal = action === 'REJECT' ? (document.getElementById('cf_center_reject_reason') as HTMLTextAreaElement)?.value || '' : '';

          if (!passwordValueVal) {
            toast('❌ โปรดระบุรหัสลงนามตรวจสอบสิทธิ์', 'err');
            return;
          }
          if (action === 'REJECT' && !rejectReasonVal.trim()) {
            toast('❌ โปรดระบุเหตุผลในการปฏิเสธรายการ', 'err');
            return;
          }

          // Task 4: Verify PIN via backend
          let executorName = '';
          let matchedRoleName = '';
          let matchedStaff: any = null;

          try {
            const vres = await fetch('/api/auth/verify-pin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pin: passwordValueVal.trim() })
            });
            const vdata = await vres.json();

            if (vdata.success) {
              executorName = vdata.user.name;
              matchedRoleName = vdata.user.role;
              matchedStaff = vdata.user;
            }
          } catch (err) {
            console.error('PIN verification failed:', err);
          }

          if (executorName) {
            const executorSign = `${executorName} (${matchedRoleName})`;

            if (action === 'APPROVE') {
              const approvalOwnerUser = masterUsers.find(u => u.name === (approvalMatrix?.signatureOwner || 'วิภา ทองสุข'));
              const finalSig = matchedStaff?.signatureData || approvalOwnerUser?.signatureData || null;

              updateAdvance(id, {
                status: 'WAITING_TRANSFER',
                appDate: new Date().toISOString().substring(0, 10),
                appBy: executorSign,
                appBySignature: finalSig,
                appAmount: r.amount
              });
              toast(`✓ ลงนามอนุมัติใบเบิก ${id} สำเร็จ ส่งต่อบทบาทการเงินเพื่อรอทำรายงานโอนจริง โดย ${executorName}`, 'ok');
              closeModal();
            } else if (action === 'REJECT') {
              updateAdvance(id, {
                status: 'REJECTED',
                rejReason: rejectReasonVal.trim(),
                appBy: executorSign,
                appDate: new Date().toISOString().substring(0, 10)
              });
              toast(`❌ ปฏิเสธรายการขอเบิก ${id} และระบุเหตุผลเรียบร้อยแล้ว โดย ${executorName}`, 'info');
              closeModal();
            } else if (action === 'TRANSFER') {
              const data = extractedData[id];
              if (!data) {
                toast('❌ ไม่พบชุดข้อมูลสกัดของสลิป กรุณาแนบไฟล์ใหม่อีกครั้ง', 'err');
                return;
              }
              // Save to transfer state
              updateAdvance(id, {
                pay: {
                  bank: data.receiverBank,
                  amount: data.amount,
                  date: data.date,
                  ref: data.refNo,
                  slip: 'Combined-Voucher.pdf', // Combined tag representation
                  senderBank: data.senderBank,
                  senderAccountNo: data.senderAccountNo,
                  senderName: data.senderName,
                  receiverBank: data.receiverBank,
                  receiverAccountNo: data.receiverAccountNo,
                  receiverName: data.receiverName,
                  fileId: data.fileId,
                  fileUrl: data.fileUrl,
                  verifiedBy: executorSign
                } as any,
                status: 'WAITING_CLEARANCE'
              });

              // Write combined document to the vault ledger
              await appendVaultDocument(r, data);

              // Clean up local processing state
              setExtractedData(prev => {
                const copy = { ...prev };
                delete copy[id];
                return copy;
              });
              setProcessingAdvId(null);

              toast(`✓ โอนและจัดส่งข้อมูลการเงินของ ${id} ลงคลังเอกสารสำเร็จ โดย ${executorName}`, 'ok');
              closeModal();
            }
          } else {
            toast('❌ รหัสผ่านไม่ถูกต้อง หรือไม่พบพนักงานที่จดทะเบียนด้วยรหัสลงนามนี้ในระบบ', 'err');
          }
        }}>ลงนามทำธุรกรรม</button>
      </div>
    );
  };




  // Slip attachment ONLY (No auto AI parsing, allows executive to upload and save)
  const handleAttachSlipOnly = async (advId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const r = advances.find(x => x.id === advId);
    if (!r) return;

    setIsAttaching(prev => ({ ...prev, [advId]: true }));
    setProcessingAdvId(advId);

    try {
      // 1. Run server upload
      const storedFile = await uploadFileToServer(file, {
        relatedId: advId,
        relatedType: 'PAYMENT_SLIP',
        source: 'ExecutiveApprovalCombined'
      });

      // 2. Update advance item on database with attached slip file info
      const isTransferable = isTransferStatus(r.status);
      updateAdvance(advId, {
        tempSlip: {
          id: storedFile.id,
          url: storedFile.url,
          name: file.name
        },
        ...(isTransferable ? { status: 'WAITING_CLEARANCE' as any } : {})
      });

      setActiveTab('history');
      toast('📎 แนบสลิปและโอนระดับระบบเสร็จสิ้น! ข้อมูลถูกส่งไปจัดเก็บในศูนย์ประวัติโอนย้อนหลังเพื่อสแกนด้วย AI แล้ว', 'ok');
    } catch (err: any) {
      toast(err.message || 'เกิดข้อผิดพลาดในการแนบสลิป', 'err');
    } finally {
      setIsAttaching(prev => ({ ...prev, [advId]: false }));
      event.target.value = '';
    }
  };

  // Run AI OCR on already attached or newly loaded slip
  const handleAnalyzeAttachedSlip = async (advId: string) => {
    const r = advances.find(x => x.id === advId);
    if (!r) return;

    const slip = r.tempSlip;
    if (!slip || !slip.id) {
      toast('❌ ไม่พบไฟล์สลิปแนบ กรุณากดแนบไฟล์สลิก่อนเริ่มสแกน', 'err');
      return;
    }

    setIsExtracting(true);
    setProcessingAdvId(advId);

    try {
      const responseDoc = await fetch('/api/gemini/analyze-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: slip.id, advanceId: advId })
      });

      const resJson = await responseDoc.json();
      if (!resJson.success) {
        throw new Error(resJson.errorMessage || resJson.error || 'สกัดข้อมูลด้วย AI ไม่สำเร็จ กรุณาแนบไฟล์รูปสลิปใหม่ให้ชัดเจน');
      }

      const analyzed: ExtractedSlipData = {
        ...resJson.data,
        fileId: slip.id,
        fileUrl: slip.url
      };

      setExtractedData(prev => ({
        ...prev,
        [advId]: analyzed
      }));

      toast('🪄 Gemini OCR สกัดชุดข้อมูลจากสลิปที่แนบสำเร็จแล้ว!', 'ok');
    } catch (err: any) {
      toast(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลสลิป', 'err');
    } finally {
      setIsExtracting(false);
    }
  };

  // Save the record to Document Vault
  const appendVaultDocument = async (adv: any, slipData: ExtractedSlipData) => {
    try {
      const docId = `VLT-${Date.now()}`;
      const vaultDoc = {
        id: docId,
        advId: adv.id,
        clrId: '',
        date: slipData.date,
        type: 'ใบขอเบิกควบสลิปโอนเงิน',
        fileName: `${adv.id}-Combined-Voucher.pdf`,
        status: 'VERIFIED',
        isCombinedPdf: true,
        mimeType: 'application/pdf',
        fileUrl: slipData.fileUrl || `/api/files/combined-${adv.id}`, // Preferred real physical slip URL
        senderBank: slipData.senderBank,
        senderAccountNo: slipData.senderAccountNo,
        senderName: slipData.senderName,
        receiverBank: slipData.receiverBank,
        receiverAccountNo: slipData.receiverAccountNo,
        receiverName: slipData.receiverName,
        payAmount: slipData.amount,
        refNo: slipData.refNo,
        payTime: slipData.time,
        slipFileId: slipData.fileId,
        slipFileUrl: slipData.fileUrl
      };

      // Put to /api/store/vault-docs
      const response = await fetch('/api/store/vault-docs');
      const loaded = await response.json().catch(() => []);
      const next = [vaultDoc, ...(Array.isArray(loaded) ? loaded : [])];
      
      await fetch('/api/store/vault-docs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
      });
    } catch (err) {
      console.error('Failed to append vault document:', err);
    }
  };



  const handleOpenAdv = (id: string) => {
    openDrawer(
      <AdvanceDetailView.Header id={id} />,
      <AdvanceDetailView.Body id={id} />,
      <AdvanceDetailView.Footer id={id} />
    );
  };

  // Reusable Requisition Sheet render for previews
  const RequisitionSheet = ({ id }: { id: string }) => {
    const adv = advances.find(x => x.id === id);
    if (!adv) return null;
    return (
      <div style={{ background: '#fff', border: '1px solid var(--bdr)', borderRadius: '12px', padding: '30px', color: '#1e293b' }}>
        <div style={{ borderBottom: '2.5px solid var(--p)', paddingBottom: '16px', marginBottom: '24px' }}>
          <div className="flb">
            <div>
              <span style={{ fontSize: '22px', fontWeight: 950, color: 'var(--p)' }}>ADVANCE REQUISITION SHEET</span>
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
                <div style={{ fontSize: '14px', fontWeight: 900, color: 'var(--p)' }}>{adv.id}</div>
                <div style={{ fontSize: '11px', color: 'var(--ts)' }}>วันที่พิมพ์: {fmtD(new Date().toISOString())}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', marginBottom: '24px', fontSize: '12px', border: '1px solid var(--bdr)', padding: '16px', borderRadius: '8px', background: '#fafbfc' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div><b>ชื่อผู้ขอเบิกเงิน:</b> {adv.empName}</div>
            <div><b>ตำแหน่ง:</b> {adv.empDept}</div>
            <div><b>โครงการ:</b> {adv.pName}</div>
            <div><b>หมายเหตุ:</b> {adv.desc}</div>
          </div>
          <div style={{ textAlign: 'right', borderLeft: '1px solid var(--bdr)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div><b>วันที่ทำรายการ:</b> {fmtD(adv.reqDate)}</div>
            <div><b>กำหนดการเคลียร์เอกสาร:</b> {fmtD(adv.reqDate ? (() => { try { const d = new Date(adv.reqDate); if (!isNaN(d.getTime())) { d.setDate(d.getDate() + 30); return d.toISOString(); } } catch (e) {} return adv.dueDate; })() : adv.dueDate)}</div>
            {adv.appDate && <div><b>วันที่ผู้อนุมัติ:</b> {fmtD(adv.appDate)}</div>}
            <div><b>สถานะเบิกจ่าย:</b> {adv.status}</div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '16px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2.5px solid var(--bdr)' }}>
              <th style={{ padding: '10px', textAlign: 'left' }}>รายละเอียดรายการขออนุมัติ</th>
              <th style={{ padding: '10px', textAlign: 'right', width: '80px' }}>จำนวน</th>
              <th style={{ padding: '10px', textAlign: 'right', width: '100px' }}>ราคาต่อหน่วย</th>
              <th style={{ padding: '10px', textAlign: 'right', width: '110px' }}>ราคารวม</th>
            </tr>
          </thead>
          <tbody>
            {adv.items.map((it, idx) => (
              <tr key={idx} style={{ borderBottom: '1.5px solid var(--bdr)' }}>
                <td style={{ padding: '10px', fontWeight: 600 }}>{it.d}</td>
                <td style={{ padding: '10px', textAlign: 'right' }}>{it.q} {it.u}</td>
                <td style={{ padding: '10px', textAlign: 'right' }}>฿{fmt(it.p)}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>฿{fmt(it.t)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ border: '2.5px solid var(--p)', borderRadius: '8px', padding: '14px 20px', marginTop: '24px', background: '#f0fdf4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--p)' }}>ยอดเงินรวมทั้งสิ้น (TOTAL AMOUNT)</span>
          <span style={{ fontSize: '20px', fontWeight: 950, color: 'var(--p)' }}>฿{fmt(adv.appAmount || adv.amount)}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '48px', fontSize: '11.5px', borderTop: '1px solid var(--bdr)', paddingTop: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ color: 'var(--ts)' }}>ผู้จัดทำเอกสารหนี้ทดรอง</span>
            <div style={{ height: '35px', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--p)' }}>
              {adv.empName}
            </div>
            <span style={{ display: 'block', borderTop: '1px dashed #cbd5e1', width: '140px', margin: '4px auto' }}></span>
            <span>วันที่: {fmtD(adv.reqDate)}</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ color: 'var(--ts)' }}>ผู้อนุมัติเอกสารเบิกจ่าย</span>
            <div style={{ height: '35px', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {(() => {
                const approverUser = masterUsers.find(u => adv.appBy && adv.appBy.includes(u.name));
                const sigImage = adv.appBySignature || approverUser?.signatureData;
                if (sigImage) {
                  return (
                    <img 
                      src={sigImage} 
                      alt="Approver Signature" 
                      style={{ maxHeight: '34px', objectFit: 'contain' }} 
                      referrerPolicy="no-referrer"
                    />
                  );
                }
                return <span style={{ color: 'var(--ok)' }}>{adv.appBy || 'APPROVED'}</span>;
              })()}
            </div>
            <span style={{ display: 'block', borderTop: '1px dashed #cbd5e1', width: '140px', margin: '4px auto' }}></span>
            <span>วันที่อนุมัติ: {adv.appDate ? fmtD(adv.appDate) : '–'}</span>
          </div>
        </div>
      </div>
    );
  };

  // Reusable Transfer Slip Sheet for previews with real Slip image and structured OCR table below
  const BankTransferSlipReport = ({ id, extData }: { id: string; extData?: ExtractedSlipData }) => {
    const adv = advances.find(x => x.id === id);
    if (!adv) return null;

    // Use actual payment object if saved, or dynamic extra data if being analyzed
    const pay = adv.pay || extData;
    if (!pay) return null;

    const slipUrl = pay.fileUrl || (pay as any).slipFileUrl || (pay as any).fileUrl;

    return (
      <div style={{ background: '#fff', border: '1px solid var(--bdr)', borderRadius: '12px', padding: '30px', color: '#1e293b' }}>
        <div style={{ borderBottom: '2.5px solid #10b981', paddingBottom: '16px', marginBottom: '24px', textAlign: 'center' }}>
          <span style={{ fontSize: '20px', fontWeight: 950, color: '#065f46', display: 'block' }}>🏦 BANK TRANSACTION TRANSFER REPORT</span>
          <span style={{ fontSize: '11px', color: 'var(--ts)' }}>เอกสารแนบหลักฐานสลิปการทำรายการโอนเงินจริง พร้อมรายงานแจกแจงพิกัดบัญชีด้วยระบบ Gemini OCR</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '26px' }}>
          {/* Render real uploaded bank slip image if exists */}
          {slipUrl ? (
            <div style={{ 
              border: '1.5px solid var(--bdr)', 
              borderRadius: '16px', 
              padding: '12px', 
              background: '#f8fafc',
              maxWidth: '380px',
              width: '100%',
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
                  maxHeight: '440px', 
                  maxWidth: '100%', 
                  borderRadius: '10px', 
                  objectFit: 'contain' 
                }} 
              />
            </div>
          ) : (
            <div style={{ 
              border: '2px dashed #cbd5e1', 
              borderRadius: '16px', 
              padding: '40px 24px', 
              background: '#f8fafc',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '13px',
              maxWidth: '420px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div>📊 ไม่พบสื่อบันทึกภาพสลิปจริงในระบบฐานข้อมูล</div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                ระบบจะวิเคราะห์สลิปแบบเรียลไทม์เมื่อมีการอัปโหลดไฟล์หลักฐานในขั้นตอนการดำเนินการจ่ายเงินรอโอน
              </div>
            </div>
          )}

          {/* Structured OCR Data Grid Table below the slip */}
          <div style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '800', color: '#334155', width: '240px' }}>หัวข้อข้อมูลธุรกรรมการโอน</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '800', color: '#334155' }}>รายละเอียดบัญชีและข้อมูลสกัดจากสลิปจริง (Gemini OCR Verified)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px 16px', background: '#f8fafc', fontWeight: '700', color: '#475569' }}>บัญชีต้นทางผู้โอนเดบิต</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: '800', color: '#1e293b' }}>{pay.senderBank}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', letterSpacing: '0.5px', marginTop: '2px' }}>
                      {pay.senderAccountNo}
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{pay.senderName}</div>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px 16px', background: '#f8fafc', fontWeight: '700', color: '#475569' }}>บัญชีพนักงานปลายทางเครดิต</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: '800', color: '#1e293b' }}>{pay.receiverBank || (pay as any).bank}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', letterSpacing: '0.5px', marginTop: '2px' }}>
                      {pay.receiverAccountNo || (pay as any).payeeBankNo}
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                      {pay.receiverName || (pay as any).payeeAccountName || ''}
                    </div>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px 16px', background: '#f8fafc', fontWeight: '700', color: '#475569' }}>เลขที่อ้างอิงธุรกรรม / Ref No.</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: '800', color: '#0f172a', letterSpacing: '0.5px' }}>
                    {pay.refNo || (pay as any).ref}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px 16px', background: '#f8fafc', fontWeight: '700', color: '#475569' }}>ยอดเงินชำระโอนออกจากบริษัท</td>
                  <td style={{ padding: '12px 16px', fontWeight: '900', fontSize: '16px', color: '#059669' }}>
                    ฿{fmt(pay.amount)} THB
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '12px 16px', background: '#f8fafc', fontWeight: '700', color: '#475569' }}>วันและเวลาทำรายการ (Timestamp)</td>
                  <td style={{ padding: '12px 16px', color: '#334155', fontWeight: '600' }}>
                    {fmtD(pay.date)} { (pay as any).time || (pay as any).payTime || '' }
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* PAGE HEADER */}
      <div className="ph" style={{ marginBottom: '20px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckSquare size={28} style={{ color: 'var(--p)' }} /> อนุมัติ & โอนเงิน (Approve & Pay)
          </h2>
          <p>จัดระบบแถบสถานะเพื่อพิจารณาคำขอเบิกเงินทดรองจ่าย คัดลอกพิกัด และประกอบสลิป OCR อย่างถนัดมือ</p>
        </div>
      </div>

      {/* TRIPARTITE STATUS TABS */}
      <div className="tabs" style={{ display: 'flex', borderBottom: '2px solid var(--bdr)', marginBottom: '24px', gap: '8px' }}>
        <button 
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            fontWeight: 700,
            padding: '10px 18px',
            borderBottom: activeTab === 'pending' ? '3px solid var(--p)' : 'none',
            color: activeTab === 'pending' ? 'var(--p)' : 'var(--ts)',
            background: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Clock size={16} /> รออนุมัติ ({pendingData.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'transfer' ? 'active' : ''}`}
          onClick={() => setActiveTab('transfer')}
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            fontWeight: 700,
            padding: '10px 18px',
            borderBottom: activeTab === 'transfer' ? '3px solid var(--p)' : 'none',
            color: activeTab === 'transfer' ? 'var(--p)' : 'var(--ts)',
            background: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <CreditCard size={16} /> รอโอน ({transferData.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            fontWeight: 700,
            padding: '10px 18px',
            borderBottom: activeTab === 'history' ? '3px solid var(--p)' : 'none',
            color: activeTab === 'history' ? 'var(--p)' : 'var(--ts)',
            background: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <FileText size={16} /> ประวัติการอนุมัติ & โอนเงิน ({historyData.length})
        </button>
      </div>

      {/* CONTENT SWITCHER */}
      {/* TAB 1: PENDING APPROVAL */}
      {activeTab === 'pending' && (
        <>
          {!pendingData.length ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '64px', border: '1.5px solid var(--bdr)', borderRadius: 'var(--r)' }}>
              <div style={{ fontSize: '48px', marginBottom: '14px' }}>🌈</div>
              <h3 style={{ fontSize: '15px', fontWeight: 800 }}>ไม่มีรายการค้างรออนุมัติ</h3>
              <p style={{ color: 'var(--ts)', fontSize: '12.5px', marginTop: '4px' }}>ทุกคำขอได้รับการตรวจสอบเรียบร้อยแล้ว</p>
            </div>
          ) : (
            <div className="cg">
              {pendingData.map(r => (
                <div key={r.id} className="apvc" style={{ position: 'relative' }}>
                  <div className="flb" style={{ marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 900, color: 'var(--p)' }}>{r.id}</div>
                      <div style={{ fontSize: '11px', color: 'var(--tm)' }}>{fmtD(r.reqDate)}</div>
                    </div>
                    <SBadge status={r.status} date={r.dueDate} />
                  </div>
                  <div className="fl" style={{ gap: '8px', marginBottom: '10px' }}>
                    <UserAvt ini={r.empName.substring(0, 2)} size={32} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>{r.empName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--ts)' }}>{r.empDept}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--ts)', marginBottom: '6px' }}><b>โครงการ:</b> {r.pName}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--ts)', background: 'var(--soft)', padding: '10px', borderRadius: 'var(--rs)', marginBottom: '12px', border: '1px solid var(--bdr)' }}>
                    {r.desc.substring(0, 100)}{r.desc.length > 100 ? '...' : ''}
                  </div>
                  
                  <div className="flb" style={{ marginBottom: '14px', borderTop: '1px dashed var(--bdr)', paddingTop: '10px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--tm)', fontWeight: 600 }}>ยอดขอเบิกทดรองจ่าย</div>
                    <div style={{ fontSize: '20px', fontWeight: 950, color: 'var(--p)' }}>฿{fmt(r.amount)}</div>
                  </div>

                  {/* ACTION GRID */}
                  <div className="g2" style={{ gap: '8px', marginBottom: '8px' }}>
                    <button className="btn btn-err btn-md" style={{ justifyContent: 'center', fontSize: '12.5px' }} onClick={() => openPinApprovalModal(r.id, 'REJECT')}>❌ ไม่อนุมัติ</button>
                    <button className="btn btn-ok btn-md" style={{ justifyContent: 'center', fontSize: '12.5px' }} onClick={() => openPinApprovalModal(r.id, 'APPROVE')}>✓ อนุมัติ</button>
                  </div>

                  <div className="g2" style={{ gap: '6px' }}>
                    <button className="btn btn-o btn-sm" style={{ justifyContent: 'center' }} onClick={() => setPreviewAdvId(r.id)}>📄 พรีวิวใบขอเบิกจริง</button>
                    <button className="btn btn-g btn-sm" style={{ justifyContent: 'center' }} onClick={() => handleOpenAdv(r.id)}>รายละเอียด</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 2: WAITING TRANSFER */}
      {activeTab === 'transfer' && (
        <>
          {!transferData.length ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '64px', border: '1.5px solid var(--bdr)', borderRadius: 'var(--r)' }}>
              <div style={{ fontSize: '48px', marginBottom: '14px' }}>🤝</div>
              <h3 style={{ fontSize: '15px', fontWeight: 800 }}>ไม่มีรายการรอโอนเงินทดรองจ่าย</h3>
              <p style={{ color: 'var(--ts)', fontSize: '12.5px', marginTop: '4px' }}>โอนเงินเรียบร้อยครบถ้วนทั้งหมดแล้ว</p>
            </div>
          ) : (
            <div className="cg">
              {transferData.map(r => {
                const u = masterUsers.find(x => x.id === r.empId);
                const bank = r.payeeBank || u?.bank || '–';
                const bankNo = r.payeeBankNo || u?.bankNo || '–';
                const actName = r.payeeAccountName || r.empName || u?.name || '';
                const displayNo = bankNo.replace(/[^0-9]/g, '');

                const currentExtData = extractedData[r.id];

                return (
                  <div key={r.id} className="apvc" style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1.5px solid var(--bdr)', padding: '18px', background: '#fff' }}>
                    
                    {/* Header bar */}
                    <div className="flb">
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 900, color: 'var(--p)' }}>{r.id}</div>
                        <div style={{ fontSize: '11px', color: 'var(--tm)' }}>{fmtD(r.reqDate)}</div>
                      </div>
                      <span className="badge bc2" style={{ padding: '4px 8px', fontSize: '10.5px' }}>💳 รอโอนเงิน</span>
                    </div>

                    {/* Emp Header */}
                    <div className="fl" style={{ gap: '8px' }}>
                      <UserAvt ini={r.empName.substring(0, 2)} size={32} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{r.empName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--ts)' }}>{r.empDept}</div>
                      </div>
                    </div>

                    <div style={{ fontSize: '11.5px', color: 'var(--ts)' }}><b>โครงการ:</b> {r.pName}</div>

                    {/* BENEFICIARY ACCOUNT SECTION WITH COPY BUTTON */}
                    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', border: '1px solid var(--bdr)' }}>
                      <div className="flb" style={{ marginBottom: '6px' }}>
                        <span style={{ fontSize: '10.5px', color: 'var(--tm)', fontWeight: 'bold', textTransform: 'uppercase' }}>บัญชีพนักงานปลายทาง</span>
                        <button 
                          className="btn btn-g btn-xs" 
                          style={{ gap: '4px', padding: '3px 6px', fontSize: '11px' }}
                          onClick={() => handleCopy(displayNo, r.id)}
                        >
                          {copiedId === r.id ? <Check size={12} className="text-emerald-600" /> : <Clipboard size={12} />}
                          {copiedId === r.id ? 'คัดลอกแล้ว!' : 'คัดลอกเลขบัญชี'}
                        </button>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 850, color: 'var(--p)' }}>ธนาคาร {bank}</div>
                      <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '1.5px', margin: '3px 0', fontFamily: 'monospace' }}>{bankNo}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--tx)' }}>ชื่อบัญชี: {actName}</div>
                    </div>

                    <div className="flb" style={{ borderTop: '1px dashed var(--bdr)', paddingTop: '10px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--tm)' }}>ยอดผ่านการอนุมัติ</span>
                      <span style={{ fontSize: '18px', fontWeight: 950, color: 'var(--p)' }}>฿{fmt(r.appAmount || r.amount)}</span>
                    </div>

                    {/* WEB VIEW FOR REQUEST FORM PREVIEW */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-o btn-sm" style={{ flex: 1, justifyContent: 'center', fontSize: '11.5px', padding: '6px' }} onClick={() => setPreviewAdvId(r.id)}>
                        📄 ดูใบขอเบิก
                      </button>
                      <button className="btn btn-g btn-sm" style={{ flex: 1, justifyContent: 'center', fontSize: '11.5px', padding: '6px' }} onClick={() => handleOpenAdv(r.id)}>
                        รายละเอียด
                      </button>
                      <button 
                        className="btn btn-err btn-sm" 
                        style={{ border: 'none', background: '#ffebee', color: '#c62828', fontWeight: 'bold', fontSize: '11.5px', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }} 
                        onClick={() => openPinApprovalModal(r.id, 'REJECT')}
                      >
                        ❌ ปฏิเสธการโอน
                      </button>
                    </div>

                    {/* SLIP DROP ZONE & SIMULATOR */}
                    <div style={{ borderTop: '1px dashed var(--bdr)', paddingTop: '12px' }}>
                      <input 
                        ref={el => { fileInputRefs.current[r.id] = el; }} 
                        type="file" 
                        accept="image/*,application/pdf" 
                        style={{ display: 'none' }}
                        onChange={(e) => handleAttachSlipOnly(r.id, e)} 
                      />

                      {!currentExtData ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {/* Button 1: Attach Slip */}
                          <button 
                            className="btn btn-o" 
                            style={{ width: '100%', justifyContent: 'center', gap: '8px', padding: '10px', background: '#f8fafc', border: '1.5px solid var(--bdr)' }}
                            onClick={() => fileInputRefs.current[r.id]?.click()}
                            disabled={isAttaching[r.id]}
                          >
                            {isAttaching[r.id] ? (
                              <>
                                <span className="spinner"></span> 
                                กำลังแนบไฟล์สลิป...
                              </>
                            ) : (
                              <>
                                <Upload size={15} /> 
                                {r.tempSlip ? '📎 เปลี่ยนไฟล์สลิปโอนเงิน' : '📎 แนบสลิปโอนเงิน (Attach Slip)'}
                              </>
                            )}
                          </button>

                          {/* Show attached slip indicator */}
                          {r.tempSlip && (
                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '8px 12px', fontSize: '11.5px', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Check size={14} className="text-emerald-600" />
                                แนบไฟล์แล้ว: <strong className="truncate" style={{ maxWidth: '140px' }}>{r.tempSlip.name}</strong>
                              </span>
                              <a href={r.tempSlip.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', color: '#15803d', fontWeight: 'bold' }}>ดูสลิป</a>
                            </div>
                          )}

                          {/* Button 2: Scan with AI (Only visible if slip is attached) */}
                          {r.tempSlip && (
                            <button 
                              className="btn btn-p" 
                              style={{ width: '100%', justifyContent: 'center', gap: '8px', padding: '10px', background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', color: '#fff', border: 'none' }}
                              onClick={() => handleAnalyzeAttachedSlip(r.id)}
                              disabled={isExtracting && processingAdvId === r.id}
                            >
                              {isExtracting && processingAdvId === r.id ? (
                                <>
                                  <span className="spinner"></span> 
                                  กำลังสแกนสลิปด้วย AI...
                                </>
                              ) : (
                                <>
                                  <Sparkles size={14} /> 
                                  🪄 สแกนอ่านข้อมูลด้วย AI เพื่อบันทึกโอน
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      ) : (
                        /* EXTRACTED METADATA PREVIEW REGISTRY */
                        <div style={{ border: '1.5px solid var(--ok)', borderRadius: '10px', background: 'var(--soft)', padding: '14px', marginTop: '4px' }}>
                          <div className="flb" style={{ borderBottom: '1px solid var(--bdr)', paddingBottom: '6px', marginBottom: '10px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Sparkles size={12} /> ผลสกัดข้อมูลด้วย Gemini AI OCR
                            </span>
                            <button 
                              className="btn btn-o btn-xs" 
                              style={{ color: '#ef4444', border: 'none', padding: '2px' }}
                              onClick={() => {
                                setExtractedData(prev => {
                                  const copy = { ...prev };
                                  delete copy[r.id];
                                  return copy;
                                });
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--ts)', display: 'block', fontWeight: 'bold' }}>โอนจากบัญชี (Sender Acct)</span>
                              <input 
                                type="text" 
                                className="w-full font-sans bg-white" 
                                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--bdr)', fontSize: '11.5px' }}
                                value={currentExtData.senderBank}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setExtractedData(prev => ({ ...prev, [r.id]: { ...prev[r.id], senderBank: val } }));
                                }}
                              />
                              <input 
                                type="text" 
                                className="w-full font-sans bg-white" 
                                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--bdr)', fontSize: '11px', marginTop: '3px', fontFamily: 'monospace' }}
                                value={currentExtData.senderAccountNo}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setExtractedData(prev => ({ ...prev, [r.id]: { ...prev[r.id], senderAccountNo: val } }));
                                }}
                              />
                            </div>

                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--ts)', display: 'block', fontWeight: 'bold' }}>เข้าบัญชีพนักงาน (Recipient Acct)</span>
                              <div style={{ fontWeight: 600 }}>{currentExtData.receiverBank}</div>
                              <div style={{ color: 'var(--ts)', fontSize: '11px' }}>{currentExtData.receiverAccountNo}</div>
                              <div style={{ color: 'var(--ts)', fontSize: '11px' }}>{currentExtData.receiverName}</div>
                            </div>

                            <div className="g2">
                              <div>
                                <span style={{ fontSize: '10px', color: 'var(--ts)', display: 'block' }}>Ref โอน</span>
                                <input 
                                  type="text" 
                                  className="w-full font-mono bg-white" 
                                  style={{ padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--bdr)', fontSize: '11px' }}
                                  value={currentExtData.refNo}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setExtractedData(prev => ({ ...prev, [r.id]: { ...prev[r.id], refNo: val } }));
                                  }}
                                />
                              </div>
                              <div>
                                <span style={{ fontSize: '10px', color: 'var(--ts)', display: 'block' }}>ยอดเงินสุทธิ</span>
                                <input 
                                  type="number" 
                                  className="w-full font-bold bg-white" 
                                  style={{ padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--bdr)', fontSize: '11px', color: 'var(--p)' }}
                                  value={currentExtData.amount}
                                  onChange={(e) => {
                                    const val = +e.target.value;
                                    setExtractedData(prev => ({ ...prev, [r.id]: { ...prev[r.id], amount: val } }));
                                  }}
                                />
                              </div>
                            </div>

                            <button 
                              className="btn btn-ok" 
                              style={{ width: '100%', justifyContent: 'center', marginTop: '6px', fontSize: '12px' }}
                              onClick={() => openPinApprovalModal(r.id, 'TRANSFER')}
                            >
                              ✓ บันทึกเข้าศูนย์ข้อมูลและจัดเก็บลงคลัง
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 3: HISTORY */}
      {activeTab === 'history' && (
        <>
          {!historyData.length ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '64px', border: '1.5px solid var(--bdr)', borderRadius: 'var(--r)' }}>
              <div style={{ fontSize: '48px', marginBottom: '14px' }}>📂</div>
              <h3 style={{ fontSize: '15px', fontWeight: 800 }}>ไม่มีรายการประวัติ</h3>
              <p style={{ color: 'var(--ts)', fontSize: '12.5px', marginTop: '4px' }}>สร้างรายการแรกเพื่อดูประวัติที่นี่</p>
            </div>
          ) : (
            <div className="glass-card" style={{ background: '#fff', border: '1.5px solid var(--bdr)', borderRadius: 'var(--r)', overflowX: 'auto', padding: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--bdr)', background: 'var(--soft)' }}>
                    <th style={{ padding: '12px 14px' }}>เลขที่ ADV</th>
                    <th style={{ padding: '12px 14px' }}>ชื่อผู้ขอเบิก</th>
                    <th style={{ padding: '12px 14px' }}>โครงการก่อสร้าง</th>
                    <th style={{ padding: '12px 14px' }}>ยอดขอเบิก/ยอดอนุมัติ</th>
                    <th style={{ padding: '12px 14px' }}>สถานะ workflow</th>
                    <th style={{ padding: '12px 14px' }}>เล่มหลักฐานการเงิน</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>เครื่องมือ</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.map(r => {
                    const currentExtData = extractedData[r.id];
                    return (
                      <React.Fragment key={r.id}>
                        <tr style={{ borderBottom: '1px solid var(--bdr)' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 900, color: 'var(--p)' }}>{r.id}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 600 }}>{r.empName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--ts)' }}>{r.empDept}</div>
                          </td>
                          <td style={{ padding: '12px 14px', color: 'var(--ts)' }}>{r.pName}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <div>฿{fmt(r.amount)}</div>
                            {r.appAmount ? <div style={{ fontSize: '11px', color: 'var(--ok)', fontWeight: 'bold' }}>อนุมัติ ฿{fmt(r.appAmount)}</div> : null}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <SBadge status={r.status} date={r.dueDate} />
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {r.pay ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <span style={{ fontSize: '11px', padding: '2px 6px', background: '#d1fae5', color: '#065f46', borderRadius: '4px', width: 'fit-content', fontWeight: 'bold' }}>
                                  โอนแล้ว
                                </span>
                                <span style={{ fontSize: '10.5px', color: 'var(--ts)' }}>Ref: {r.pay.ref}</span>
                              </div>
                            ) : r.tempSlip ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '11px', padding: '2px 6px', background: '#fef3c7', color: '#92400e', borderRadius: '4px', width: 'fit-content', fontWeight: 'bold' }}>
                                  โอนระดับเสร็จสิ้น (รอ AI สแกน)
                                </span>
                                <span style={{ fontSize: '10.5px', color: 'var(--ts)' }} title={r.tempSlip.name}>{r.tempSlip.name}</span>
                                <button 
                                  className="btn btn-p btn-xs" 
                                  style={{ width: '100%', justifyContent: 'center', gap: '4px', padding: '4px', background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px' }}
                                  onClick={() => handleAnalyzeAttachedSlip(r.id)}
                                  disabled={isExtracting && processingAdvId === r.id}
                                >
                                  {isExtracting && processingAdvId === r.id ? (
                                    <>
                                      <span className="spinner"></span> 
                                      สแกน...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles size={11} /> 
                                      สแกนด้วย AI ย้อนหลัง
                                    </>
                                  )}
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '11.5px', color: 'var(--tm)' }}>ไม่มีข้อมูลเงินโอน</span>
                                <input 
                                  ref={el => { fileInputRefs.current[r.id] = el; }} 
                                  type="file" 
                                  accept="image/*,application/pdf" 
                                  style={{ display: 'none' }}
                                  onChange={(e) => handleAttachSlipOnly(r.id, e)} 
                                />
                                <button 
                                  className="btn btn-o btn-xs"
                                  style={{ padding: '3px 6px', fontSize: '11px', whiteSpace: 'nowrap' }}
                                  onClick={() => fileInputRefs.current[r.id]?.click()}
                                  disabled={isAttaching[r.id]}
                                >
                                  {isAttaching[r.id] ? 'กำลังอัปโหลด...' : '+ แนบสลิปย้อนหลัง'}
                                </button>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button 
                                className="btn btn-o btn-xs"
                                onClick={() => handleOpenAdv(r.id)}
                              >
                                ตัวจัดการ
                              </button>
                              {r.pay ? (
                                <button 
                                  className="btn btn-p btn-xs"
                                  style={{ gap: '4px' }}
                                  onClick={() => setCombinedPreviewAdvId(r.id)}
                                >
                                  📄 เอกสารรวม + สลิป
                                </button>
                              ) : (
                                <button 
                                  className="btn btn-g btn-xs"
                                  onClick={() => setPreviewAdvId(r.id)}
                                >
                                  📄 พรีวิวใบขอเบิก
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {currentExtData && (
                          <tr style={{ background: '#f8fafc' }}>
                            <td colSpan={7} style={{ padding: '16px 20px', borderBottom: '1.5px solid var(--ok)' }}>
                              <div style={{ border: '1.5px solid var(--ok)', borderRadius: '12px', background: '#fff', padding: '16px', maxWidth: '640px', marginLeft: 'auto', marginRight: '0' }}>
                                <div className="flb" style={{ borderBottom: '1px solid var(--bdr)', paddingBottom: '8px', marginBottom: '14px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Sparkles size={14} className="text-violet-600 animate-pulse" /> ผลวิเคราะห์ประวัติโอนย้อนหลังด้วย Gemini AI OCR
                                  </span>
                                  <button 
                                    className="btn btn-o btn-xs" 
                                    style={{ color: '#ef4444', border: 'none', padding: '4px' }}
                                    onClick={() => {
                                      setExtractedData(prev => {
                                        const copy = { ...prev };
                                        delete copy[r.id];
                                        return copy;
                                      });
                                    }}
                                  >
                                    <Trash2 size={14} /> ยกเลิก
                                  </button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12.5px' }}>
                                  <div>
                                    <span style={{ fontSize: '10.5px', color: 'var(--ts)', display: 'block', fontWeight: 'bold' }}>โอนจากธนาคาร/บัญชีต้นทาง (Sender Acct)</span>
                                    <input 
                                      type="text" 
                                      className="w-full font-sans bg-white text-xs mt-1 border border-slate-300 rounded-lg" 
                                      style={{ padding: '6px 10px' }}
                                      value={currentExtData.senderBank}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setExtractedData(prev => ({ ...prev, [r.id]: { ...prev[r.id], senderBank: val } }));
                                      }}
                                    />
                                    <input 
                                      type="text" 
                                      className="w-full font-sans bg-white text-xs mt-1 border border-slate-300 rounded-lg font-mono" 
                                      style={{ padding: '6px 10px' }}
                                      value={currentExtData.senderAccountNo}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setExtractedData(prev => ({ ...prev, [r.id]: { ...prev[r.id], senderAccountNo: val } }));
                                      }}
                                    />
                                  </div>

                                  <div>
                                    <span style={{ fontSize: '10.5px', color: 'var(--ts)', display: 'block', fontWeight: 'bold' }}>เข้าบัญชีพนักงานปลายทาง (Recipient Acct)</span>
                                    <div className="bg-slate-50 border p-2 rounded-lg mt-1 space-y-1 text-slate-700">
                                      <div style={{ fontWeight: 700 }} className="text-xs text-slate-800">{currentExtData.receiverBank}</div>
                                      <div style={{ fontFamily: 'monospace', fontSize: '11px' }}>{currentExtData.receiverAccountNo}</div>
                                      <div style={{ fontSize: '11.5px', fontWeight: 600 }}>{currentExtData.receiverName}</div>
                                    </div>
                                  </div>

                                  <div style={{ gridColumn: 'span 2' }} className="grid grid-cols-2 gap-3">
                                    <div>
                                      <span style={{ fontSize: '10.5px', color: 'var(--ts)', display: 'block' }}>รหัสอ้างอิง Ref โอนย้อนหลัง</span>
                                      <input 
                                        type="text" 
                                        className="w-full font-mono bg-white mt-1 border border-slate-300 rounded-lg text-xs" 
                                        style={{ padding: '6px 10px' }}
                                        value={currentExtData.refNo || ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setExtractedData(prev => ({ ...prev, [r.id]: { ...prev[r.id], refNo: val } }));
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <span style={{ fontSize: '10.5px', color: 'var(--ts)', display: 'block' }}>จำนวนเงินสุทธิ</span>
                                      <input 
                                        type="number" 
                                        className="w-full font-bold bg-white mt-1 border border-slate-300 rounded-lg text-xs text-emerald-700" 
                                        style={{ padding: '6px 10px' }}
                                        value={currentExtData.amount}
                                        onChange={(e) => {
                                          const val = +e.target.value;
                                          setExtractedData(prev => ({ ...prev, [r.id]: { ...prev[r.id], amount: val } }));
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <button 
                                  className="btn btn-ok text-white font-bold" 
                                  style={{ width: '100%', justifyContent: 'center', marginTop: '16px', height: '40px', fontSize: '13px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none' }}
                                  onClick={() => openPinApprovalModal(r.id, 'TRANSFER')}
                                >
                                  ✓ บันทึกยืนยันประวัติสลิปย้อนหลังสแกนสำเร็จ
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* MODAL OVERLAYS */}
      {/* 1. SINGLE REQUISITION SHEET PREVIEW OVERLAY */}
      {previewAdvId && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setPreviewAdvId(null)}
        >
          <div 
            style={{
              backgroundColor: '#fff',
              maxHeight: '90vh',
              width: '100%',
              maxWidth: '800px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="flb" style={{ padding: '14px 24px', borderBottom: '1px solid var(--bdr)', background: '#f8fafc' }}>
              <span style={{ fontWeight: 800, fontSize: '14.5px', color: 'var(--tx)' }}>
                🔍 ดูก่อนบันทึกเอกสารใบขอเบิก (Voucher Preview)
              </span>
              <button 
                className="btn btn-g btn-xs" 
                style={{ padding: '6px 10px', fontSize: '12px' }}
                onClick={() => setPreviewAdvId(null)}
              >
                ✕ ปิดหน้าต่าง
              </button>
            </div>

            {/* Document sheet */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f1f5f9' }}>
              <RequisitionSheet id={previewAdvId} />
            </div>

            {/* Bottom Bar */}
            <div className="flb" style={{ padding: '14px 24px', borderTop: '1px solid var(--bdr)', background: '#f8fafc' }}>
              <span style={{ fontSize: '11px', color: 'var(--ts)' }}>
                🔒 เอกสารรับรองผ่านการอนุมัติอิเล็กทรอนิกส์
              </span>
              <button 
                className="btn btn-p btn-sm" 
                style={{ gap: '6px' }}
                onClick={() => {
                  window.print();
                }}
              >
                <Printer size={13} /> พิมพ์เอกสารใบนี้
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. COMBINED REQUISITION & SLIP DOCUMENT SET PREVIEW OVERLAY */}
      {combinedPreviewAdvId && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setCombinedPreviewAdvId(null)}
        >
          <div 
            style={{
              backgroundColor: '#fff',
              maxHeight: '90vh',
              width: '100%',
              maxWidth: '840px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="flb" style={{ padding: '14px 24px', borderBottom: '1px solid var(--bdr)', background: '#f8fafc' }}>
              <span style={{ fontWeight: 900, fontSize: '14.5px', color: 'var(--tx)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={16} className="text-emerald-600" /> ชุดแฟ้มเอกสารรวม (ใบขอเบิกเงินทดรองจ่ายควบสลิปรายงานธุรกรรมโอน)
              </span>
              <button 
                className="btn btn-g btn-xs" 
                style={{ padding: '6px 10px', fontSize: '12px' }}
                onClick={() => setCombinedPreviewAdvId(null)}
              >
                ✕ ปิดหน้าต่าง
              </button>
            </div>

            {/* Dynamic Combined content scroll container */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '30px', background: '#f1f5f9', display: 'flex', flexDirection: 'column', gap: '26px' }} id="printCombinedArea">
              
              {/* Part 1: Requisition form */}
              <div style={{ pageBreakAfter: 'always' }}>
                <RequisitionSheet id={combinedPreviewAdvId} />
              </div>

              {/* Dynamic break line design */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderTop: '2.5px dashed var(--bdr)', position: 'relative', margin: '14px 0' }} className="no-print">
                <span style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', background: '#f1f5f9', padding: '0 14px', fontSize: '11px', fontWeight: 'bold', color: 'var(--tm)', fontMono: 'monospace' }}>
                  ✂️ สิ้นสุดหน้า 1 (ใบสัญญายืมเงิน) / แนบติดกันด้านหลังเป็นหลักฐานสลิปโอนเงิน (หน้า 2)
                </span>
              </div>

              {/* Part 2: Bank slip report */}
              <div>
                <BankTransferSlipReport id={combinedPreviewAdvId} />
              </div>

            </div>

            {/* Action Bar */}
            <div className="flb" style={{ padding: '14px 24px', borderTop: '1px solid var(--bdr)', background: '#f8fafc' }}>
              <span style={{ fontSize: '11px', color: 'var(--ts)' }}>
                📂 แฟ้มชุดเอกสารนี้ บันทึกลง Document Vault เรียบร้อยเพื่อประโยชน์การตรวจสอบย้อนกลับ (Ledger Tracking)
              </span>
              <button 
                className="btn btn-p btn-sm" 
                style={{ gap: '6px' }}
                onClick={() => {
                  window.print();
                }}
              >
                <Printer size={13} /> พิมพ์ชุดเอกสารรวมนี้ (Print Set)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
