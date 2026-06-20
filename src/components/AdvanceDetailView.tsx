import React from 'react';
import { useApp } from '../context/AppContext';
import { fmt, fmtD, SBadge, overdue, clrId, now, UserAvt } from '../lib/utils';
import { fileLabel, fileUrl, uploadFileToServer } from '../lib/files';

// These components can be extracted into individual files, but we keep them bundled in this orchestrator to minimize boilerplate.

// Action helpers that use the AppContext to mutate global state
export const useAdvanceActions = (id: string, closeAndRedirect?: string) => {
  const { advances, updateAdvance, openModal, closeModal, closeDrawer, toast, setPage, masterUsers } = useApp();
  const r = advances.find(x => x.id === id);

  const done = () => {
    closeModal(); closeDrawer();
    if (closeAndRedirect) setPage(closeAndRedirect);
  };

  const doApprove = () => {
    openModal('ยืนยันอนุมัติ', <span>อนุมัติรายการ <b>{id}</b> ใช่หรือไม่?</span>,
      <><button className="btn btn-o" onClick={closeModal}>ยกเลิก</button><button className="btn btn-ok" onClick={() => {
        updateAdvance(id, { status: 'WAITING_TRANSFER', appDate: '2026-06-17', appBy: 'U006', appAmount: r!.amount });
        toast(`✓ อนุมัติ ${id} · รอโอนเงิน`, 'ok');
        done();
      }}>ยืนยัน</button></>
    );
  };

  const doReject = () => {
    openModal('ยืนยันไม่อนุมัติ', <><div style={{ marginBottom: '8px' }}>เหตุผล:</div><textarea id="rr" placeholder="ระบุเหตุผล..."></textarea></>,
      <><button className="btn btn-o" onClick={closeModal}>ยกเลิก</button><button className="btn btn-err" onClick={() => {
        const rr = (document.getElementById('rr') as HTMLTextAreaElement)?.value || 'ไม่ระบุเหตุผล';
        updateAdvance(id, { status: 'REJECTED', rejReason: rr });
        toast(`ไม่อนุมัติ ${id}`, 'err');
        done();
      }}>ยืนยัน</button></>
    );
  };

  const doTransfer = () => {
    if (!r) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        toast('กำลังอัปโหลด slip การโอนจริง...', 'info');
        const storedFile = await uploadFileToServer(file, {
          relatedId: id,
          relatedType: 'PAYMENT_SLIP',
          source: 'AdvanceDetailDrawer'
        });
        const ref = `PAY-${Date.now().toString().slice(-8)}`;
        const fallbackUser = masterUsers.find(user => user.id === r.empId);
        updateAdvance(id, {
          pay: {
            bank: r.payeeBank || fallbackUser?.bank || 'BANK',
            amount: r.appAmount,
            date: new Date().toISOString().substring(0, 10),
            ref,
            slip: storedFile.originalName,
            slipFileId: storedFile.id,
            slipUrl: storedFile.url,
            mimeType: storedFile.mimeType
          },
          status: 'WAITING_CLEARANCE'
        });
        toast(`อัปโหลด slip และบันทึกการโอน ${id} สำเร็จ`, 'ok');
        done();
      } catch (error: any) {
        toast(error.message || 'อัปโหลด slip ไม่สำเร็จ', 'err');
      }
    };
    input.click();
  };

  const doClearance = (maxOut: number) => {
    openModal('สร้างใบเคลียร์ยอด',
      <>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--p)', marginBottom: '10px' }}>{id}</div>
        <div className="g2" style={{ marginBottom: '10px' }}>
          <div><label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--ts)', display: 'block', marginBottom: '4px' }}>ยอดเคลียร์</label><input type="number" id="ca" defaultValue={maxOut} max={maxOut} min="0"/></div>
          <div><label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--ts)', display: 'block', marginBottom: '4px' }}>วันที่</label><input type="date" id="cd" defaultValue="2026-06-17"/></div>
        </div>
        <div><label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--ts)', display: 'block', marginBottom: '4px' }}>หมายเหตุ</label><textarea id="cn" placeholder="หมายเหตุ..."></textarea></div>
        <div style={{ background: 'var(--soft)', borderRadius: 'var(--rs)', padding: '8px', marginTop: '8px', fontSize: '12px', color: 'var(--ts)' }}>ยอดสูงสุด: ฿{fmt(maxOut)}</div>
      </>,
      <><button className="btn btn-o" onClick={closeModal}>ยกเลิก</button><button className="btn btn-p" onClick={() => {
        const amt = +(document.getElementById('ca') as HTMLInputElement)?.value || 0;
        const dt = (document.getElementById('cd') as HTMLInputElement)?.value || '2026-06-17';
        const note = (document.getElementById('cn') as HTMLTextAreaElement)?.value || '–';
        if (amt <= 0 || amt > maxOut) { toast('ยอดไม่ถูกต้อง', 'err'); return; }
        
        const newClrAmount = r!.clrAmount + amt;
        const newStatus = newClrAmount >= r!.appAmount ? 'CLOSED' : r!.status;
        
        updateAdvance(id, {
          clrs: [...r!.clrs, { id: clrId(id), date: dt, amount: amt, note }],
          clrAmount: newClrAmount,
          status: newStatus as any
        });
        toast(newStatus === 'CLOSED' ? `✓ ปิดยอด ${id} เรียบร้อย` : `✓ เคลียร์บางส่วน ${id}`, 'ok');
        done();
      }}>สร้างใบเคลียร์</button></>
    );
  };

  return { doApprove, doReject, doTransfer, doClearance };
};

// UI Definition for the details drawer
export const AdvanceDetailView = {
  Header: ({ id }: { id: string }) => {
    const { advances, closeDrawer } = useApp();
    const r = advances.find(x => x.id === id);
    if (!r) return null;
    
    const pipeline = ['ส่งคำขอ', 'อนุมัติ', 'โอนเงิน', 'เคลียร์', 'ปิดยอด'];
    const pStep: Record<string, number> = { PENDING_APPROVAL: 0, WAITING_TRANSFER: 1, WAITING_CLEARANCE: 2, CLOSED: 4, REJECTED: 1 };
    const curStep = pStep[r.status] ?? 0;
    const isDone = (i: number) => r.status === 'REJECTED' ? i === 0 : i < curStep || (r.status === 'CLOSED' && i <= 4);

    return (
      <>
        <div style={{ flex: 1 }}>
          <div className="fl" style={{ gap: '8px', marginBottom: '3px' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--p)' }}>{r.id}</div>
            <SBadge status={r.status} date={r.dueDate} />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--tm)' }}>{r.pName}</div>
          <div className="pipe">
            {pipeline.map((p, i) => {
              const st = r.status === 'REJECTED' && i === 1 ? 'ps-fail' : isDone(i) ? 'ps-ok' : i === curStep ? 'ps-ac' : 'ps-id';
              return <React.Fragment key={p}>{i > 0 && <span style={{ color: 'var(--tm)', fontSize: '14px' }}>›</span>}<span className={`ps ${st}`}>{p}</span></React.Fragment>;
            })}
          </div>
        </div>
        <button className="btn btn-g" onClick={closeDrawer}>✕</button>
      </>
    );
  },
  
  Body: ({ id }: { id: string }) => {
    const { advances, masterUsers, openFilePreview, openModal, closeModal, toast, updateAdvance, closeDrawer, setPage } = useApp();
    const actions = useAdvanceActions(id);
    const r = advances.find(x => x.id === id);
    if (!r) return null;

    const [dbRoles, setDbRoles] = React.useState<any[]>([]);
    React.useEffect(() => {
      fetch('/api/store/roles')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setDbRoles(data);
        })
        .catch(() => {});
    }, []);
    
    const out = (r.appAmount || r.amount) - r.clrAmount;
    const od = overdue(r);
    
    const tl = [
      { t: 'ส่งคำขอเบิก', d: fmtD(r.reqDate), ok: true },
      { t: r.status === 'REJECTED' ? 'ไม่อนุมัติ' : 'อนุมัติแล้ว', d: r.appDate ? fmtD(r.appDate) : (r.status === 'PENDING_APPROVAL' ? 'รออนุมัติ' : r.status === 'REJECTED' ? fmtD(r.reqDate) : '–'), ok: !!r.appDate && r.status !== 'REJECTED' },
      { t: 'โอนเงิน', d: r.pay ? fmtD(r.pay.date) : 'รอดำเนินการ', ok: !!r.pay },
      { t: 'เคลียร์ยอด', d: r.clrs?.[0] ? fmtD(r.clrs[0].date) : 'รอดำเนินการ', ok: !!r.clrs?.[0] },
    ];

    const isDraft = r.status === 'DRAFT' || r.status === 'บันทึกร่าง';
    const isPendingApproval = r.status === 'PENDING_APPROVAL' || r.status === 'รออนุมัติ';
    const isWaitingTransfer = r.status === 'WAITING_TRANSFER' || r.status === 'รอโอน';
    const isClosed = r.status === 'CLOSED' || r.status === 'ปิดยอด' || r.status === 'ปิดยอดแล้ว';
    const isRejected = r.status === 'REJECTED' || r.status === 'ไม่อนุมัติ' || r.status === 'ปฏิเสธ';
    
    const isWaitingClearanceStatus = r.status === 'WAITING_CLEARANCE' || r.status === 'รอเคลียร์' || r.status === 'รอเคลียร์ยอด';
    const isWaitingAudit = isWaitingClearanceStatus && (!!r.reviewStatus || (r.clrs && r.clrs.length > 0));
    const isWaitingClearance = isWaitingClearanceStatus && !isWaitingAudit;

    const runCheckflow = (actionLabel: string, actionColor: string, isApprove: boolean) => {
      openModal(
        `🔒 ยืนยันรหัสผ่านเพื่อลงนามทำธุรกรรม (${actionLabel})`,
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '6px 2px' }}>
          <p style={{ fontSize: '12.5px', color: 'var(--ts)', margin: 0, lineHeight: '1.4' }}>
            การลงนามอิเล็กทรอนิกส์นี้สำหรับดูแลรายการ โปรดใส่รหัสลงนามส่วนบุคคลประจำตัวคุณ (Personal PIN / Password)
          </p>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--p)', display: 'block', marginBottom: '5px' }}>รหัสลงนามประจำตัว (Personal PIN / Password) *</label>
            <input 
              id="cf_password"
              type="password" 
              placeholder="ระบุรหัสประจำตัวของท่าน หรือรหัสผ่านกลุ่มระบบ" 
              style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--bdr)', borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace' }}
            />
            <p style={{ fontSize: '11px', color: 'var(--ts)', marginTop: '4px' }}>
              * ระบบจะค้นหาและยืนยันชื่อของคุณโดยอัตโนมัติจากรหัสประจำตัวที่ตั้งไว้ในหน้าตารางพนักงาน
            </p>
          </div>
          {!isApprove && (
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'red', display: 'block', marginBottom: '5px' }}>ระบุเหตุผลการปฏิเสธ / ไม่อนุมัติ *</label>
              <textarea 
                id="cf_reject_reason"
                placeholder="ระบุเหตุผลการตีกลับเอกสาร..." 
                style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--bdr)', borderRadius: '6px', fontSize: '13px', minHeight: '60px' }}
              />
            </div>
          )}
        </div>,
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
          <button className="btn btn-o" onClick={closeModal}>ยกเลิก</button>
          <button className="btn" style={{ background: actionColor, color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 16px', fontSize: '12.5px', fontWeight: 600 }} onClick={() => {
            const passwordValueVal = (document.getElementById('cf_password') as HTMLInputElement)?.value || '';
            const rejectReasonVal = (document.getElementById('cf_reject_reason') as HTMLTextAreaElement)?.value || '';

            if (!passwordValueVal) {
              toast('❌ โปรดระบุรหัสลงนามตรวจสอบสิทธิ์', 'err');
              return;
            }
            if (!isApprove && !rejectReasonVal.trim()) {
              toast('❌ โปรดใส่เหตุผลการไม่อนุมัติ', 'err');
              return;
            }

            // Look up corresponding staff member by PIN
            const matchedStaff = masterUsers.find(u => u.pin && u.pin.trim() === passwordValueVal.trim());
            let executorName = '';
            let matchedRoleName = '';

            if (matchedStaff) {
              executorName = matchedStaff.name;
              matchedRoleName = matchedStaff.role || matchedStaff.position || 'Staff';
            } else {
              // Try fallback group passwords
              const isMasterPin = passwordValueVal.trim() === '1234';
              let matchedRoleObj: any = null;

              if (isMasterPin) {
                matchedRoleObj = { name: 'Administrator' };
              } else {
                matchedRoleObj = dbRoles.find(role => {
                  const password = role.password || (
                    role.id === 'R1' || role.name === 'Administrator' ? 'admin123' :
                    role.id === 'R2' || role.name === 'Accounting' ? 'acc123' :
                    role.id === 'R3' || role.name === 'Employee / Requester' ? 'emp123' : ''
                  );
                  return password && password.trim() === passwordValueVal.trim();
                });
                
                if (!matchedRoleObj) {
                  const cleanPass = passwordValueVal.trim();
                  if (cleanPass === 'admin123') {
                    matchedRoleObj = { name: 'Administrator' };
                  } else if (cleanPass === 'acc123') {
                    matchedRoleObj = { name: 'Accounting' };
                  } else if (cleanPass === 'emp123') {
                    matchedRoleObj = { name: 'Employee / Requester' };
                  }
                }
              }

              if (matchedRoleObj) {
                executorName = `ผู้รับผิดชอบกลุ่ม (${matchedRoleObj.name})`;
                matchedRoleName = matchedRoleObj.name;
              }
            }

            if (executorName) {
              const executorSign = `${executorName} (${matchedRoleName})`;
              
              if (isApprove) {
                updateAdvance(r.id, {
                  status: 'WAITING_TRANSFER',
                  appDate: new Date().toISOString().substring(0, 10),
                  appBy: executorSign,
                  appAmount: r.amount
                });
                toast(`✓ ลงนามอนุมัติใบเบิก ${r.id} สำเร็จ โดย ${executorName}`, 'ok');
              } else {
                updateAdvance(r.id, {
                  status: 'REJECTED',
                  rejReason: rejectReasonVal.trim(),
                  appBy: executorSign
                });
                toast(`❌ ปฏิเสธรายการ ${r.id} และระบุเหตุผลสำเร็จ`, 'info');
              }
              closeModal();
              closeDrawer();
            } else {
              toast('❌ รหัสผ่านไม่ถูกต้อง หรือไม่พบพนักงานที่จดทะเบียนด้วยรหัสลงนามนี้ในระบบ', 'err');
            }
          }}>ลงนามทำธุรกรรม</button>
        </div>
      );
    };

    const renderActionBox = () => {
      if (isDraft) {
        return (
          <div className="acb" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
            <div className="acb-t" style={{ color: '#64748b' }}>📝 แบบร่างเอกสาร</div>
            <p style={{ fontSize: '12.5px', color: 'var(--ts)', margin: 0 }}>
              ใบเบิกเงินล่วงหน้านี้อยู่ในสถานะ<b>บันทึกร่าง</b> สามารถกดแก้ไขข้อมูล รายการยอดเงิน หรือลบแบบร่างนี้ทิ้งเพื่อสร้างใหม่ได้
            </p>
          </div>
        );
      }

      if (isPendingApproval) {
        return (
          <div className="acb" style={{ borderColor: 'var(--bdr)' }}>
            <div className="acb-t">🔒 รอการอนุมัติสายงาน (Line Approval)</div>
            <p style={{ fontSize: '12.5px', color: 'var(--ts)', marginBottom: '12px' }}>
              รายการรอลงนามจากผู้มีสิทธิ์อนุมัติ หากยอดผ่านเกณฑ์ระบบจะขึ้นอนุมัติอิเล็กทรอนิกส์
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-sm" style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700 }} onClick={() => runCheckflow('อนุมัติใบเบิก', '#10b981', true)}>
                ✓ อนุมัติเบิก
              </button>
              <button className="btn btn-sm" style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700 }} onClick={() => runCheckflow('ปฏิเสธตีกลับ', '#ef4444', false)}>
                ✕ ปฏิเสธการขอ
              </button>
            </div>
          </div>
        );
      }

      if (isWaitingTransfer) {
        const u = masterUsers.find(x => x.id === r.empId);
        const bank = r.payeeBank || u?.bank || '–';
        const bankNo = r.payeeBankNo || u?.bankNo || '–';
        return (
          <div className="acb" style={{ borderColor: '#bbf7d0', background: '#f0fdf4' }}>
            <div className="acb-t" style={{ color: '#166534' }}>💳 อนุมัติแล้ว · รอการโอนเงินคืนพนักงาน</div>
            
            <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px', margin: '8px 0', textShadow: 'none' }}>
              <p style={{ fontSize: '13px', fontWeight: 800, color: '#15803d', margin: '0 0 4px 0' }}>✓ ELECTRONICALLY SIGNED</p>
              <p style={{ fontSize: '12px', color: '#374151', margin: '0 0 2px 0' }}><b>ผู้อนุมัติ:</b> {r.appBy || 'แอดมินบริหารระดับสูง'}</p>
              <p style={{ fontSize: '11px', color: '#6b7280', margin: '0' }}><b>ตราประทับวันอนุมัติ:</b> {r.appDate ? fmtD(r.appDate) : 'ได้รับอนุมัติผ่าน LINE/ระบบ'}</p>
            </div>

            <div className="fl" style={{ gap: '8px', margin: '12px 0 10px 0' }}>
              <UserAvt ini={r.empName.substring(0, 2)} size={32} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>{r.payeeAccountName || r.empName}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--ts)' }}>ธนาคาร {bank} · <span style={{ fontFamily: 'monospace' }}>{bankNo}</span></div>
              </div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--p)', marginBottom: '12px' }}>฿{fmt(r.appAmount)}</div>
            <div className="upz" onClick={actions.doTransfer}>
              <div style={{ fontSize: '13px', color: 'var(--p)', fontWeight: 600 }}>📎 แนบสลิปโอนเงินจริง (Slip Attachment)</div>
              <div style={{ fontSize: '11px', color: 'var(--tm)' }}>อัปโหลดภาพบิลโอนเงินสมบูรณ์เพื่อขยับสู่หัวข้อถัดไป</div>
            </div>
          </div>
        );
      }

      if (isWaitingClearance) {
        return (
          <div className="acb" style={{ borderColor: 'var(--bdr)' }}>
            <div className="acb-t">📋 ข้อมูลทำรายการโอนสลิป (Clearance Pending)</div>
            {r.pay && (
              <div className="slip-p" style={{ marginBottom: '12px', background: '#f8fafc', padding: '10px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: 'var(--ts)', marginBottom: '4px', fontWeight: 700 }}>✓ รายละเอียดสลิปโอนเงิน</div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--p)' }}>฿{fmt(r.pay.amount)}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--ts)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  โอนจาก: <b>{r.pay.bank}</b> &nbsp;|&nbsp; Ref: <b>{r.pay.ref}</b> &nbsp;|&nbsp; {fmtD(r.pay.date)}
                </div>
              </div>
            )}
            {od && <div style={{ background: '#fee2e2', borderRadius: 'var(--rs)', padding: '9px 12px', marginBottom: '10px', fontSize: '12px', color: '#991b1b', fontWeight: 600 }}>⚠ เกินกำหนด {Math.floor((now().getTime() - new Date(r.dueDate).getTime()) / 86400000)} วัน</div>}
            <div style={{ fontSize: '13px', color: 'var(--ts)', marginBottom: '8px' }}>ยอดยังไม่ได้ตรวจสอบสลิปเคลียร์: <b style={{ color: '#ef4444' }}>฿{fmt(out)}</b></div>
            <button className="btn btn-p" style={{ width: '100%' }} onClick={() => { setPage('clearance'); closeDrawer(); }}>เคลียร์ยอดเงินด่วน</button>
          </div>
        );
      }

      if (isWaitingAudit) {
        return (
          <div className="acb" style={{ borderColor: '#fde047', background: '#fefce8' }}>
            <div className="acb-t" style={{ color: '#a16207' }}>📊 รอฝ่ายตรวจสอบเอกสารบัญชี (Auditing Queue)</div>
            
            <div className="g3" style={{ gap: '6px', margin: '10px 0' }}>
              <div style={{ background: '#fff', border: '1px solid #fef08a', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--tm)' }}>ยอดเบิก</div>
                <div style={{ fontSize: '12.5px', fontWeight: 800 }}>฿{fmt(r.appAmount || r.amount)}</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #fef08a', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--tm)' }}>ยอดเคลียร์</div>
                <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--ok)' }}>฿{fmt(r.clrAmount)}</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #fef08a', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--tm)' }}>คงเหลือ</div>
                <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#ef4444' }}>฿{fmt(Math.max(0, (r.appAmount || r.amount) - r.clrAmount))}</div>
              </div>
            </div>

            <div style={{ fontSize: '11.5px', color: 'var(--ts)', display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px dashed #fef08a', paddingTop: '6px' }}>
              <div><b>ความประสงค์:</b> {r.desc}</div>
              {r.pay && <div><b>รายละเอียดโอน:</b> โอนจากธนาคาร {r.pay.bank} (อ้างอิง: {r.pay.ref})</div>}
              <div><b>บันทึกใบเคลียร์ยอด:</b> {r.clrs?.map(c => c.note).join(', ') || 'ไม่มีรายละเอียดระบุ'}</div>
            </div>

            <button className="btn btn-sm" style={{ width: '100%', background: '#ca8a04', color: '#fff', fontWeight: 700, borderRadius: '6px', border: 'none', padding: '8px', cursor: 'pointer', marginTop: '12px' }} onClick={() => {
              openModal(
                '🕵️‍♂️ ยืนยันสิทธิ์ผู้อนุมัติเพื่อตรวจสอบรายการ (Audit Checking)',
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ fontSize: '12.5px', color: 'var(--ts)', margin: 0, lineHeight: '1.4' }}>
                    สำหรับเจ้าหน้าที่ผู้ตรวจสอบและสอบทานเอกสาร โปรดระบุรหัสผ่านประจำตัวของคุณ (Personal PIN)
                  </p>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--p)', display: 'block', marginBottom: '5px' }}>รหัสผ่านลงนามประจำตน (PIN / Password) *</label>
                    <input 
                      id="cf_audit_password" 
                      type="password" 
                      placeholder="ระบุรหัสประจำตัว หรือระบบผ่านของท่าน" 
                      style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--bdr)', borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace' }} 
                    />
                  </div>
                </div>,
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
                  <button className="btn btn-o" onClick={closeModal}>ยกเลิก</button>
                  <button className="btn btn-p" onClick={() => {
                    const pswVal = (document.getElementById('cf_audit_password') as HTMLInputElement)?.value || '';
                    if (!pswVal) {
                      toast('โปรดกรอกรหัสลงนามตรวจสอบ', 'err');
                      return;
                    }
                    
                    const matchedStaff = masterUsers.find(u => u.pin && u.pin.trim() === pswVal.trim());
                    let auditorName = '';

                    if (matchedStaff) {
                      auditorName = matchedStaff.name;
                    } else {
                      const isAuditMatch = dbRoles.some(ro => ro.password && ro.password.trim() === pswVal.trim());
                      const isMaster = pswVal.trim() === '1234';
                      if (isAuditMatch || isMaster) {
                        auditorName = 'เจ้าหน้าที่ตรวจสอบระบบ';
                      }
                    }

                    if (auditorName) {
                      toast(`✓ ยืนยันการตรวจสอบโดย ${auditorName} สำเร็จ`, 'ok');
                      closeModal();
                      setPage('accounting');
                      closeDrawer();
                    } else {
                      toast('❌ รหัสไม่ถูกต้อง ไม่สามารถเข้าใช้สิทธิ์สอบทานได้', 'err');
                    }
                  }}>ยืนยันเพื่อสอบทาน</button>
                </div>
              );
            }}>
              ตรวจสอบรายการเอกสาร →
            </button>
          </div>
        );
      }

      if (isClosed) {
        const diffAmount = Math.abs(r.amount - r.clrAmount);
        let textNote = '';
        if (r.clrAmount > r.amount) textNote = 'บริษัทต้องจ่ายเงินพนักงานเพิ่ม';
        else if (r.clrAmount < r.amount) textNote = 'พนักงานต้องจ่ายคืนบริษัท';
        else textNote = 'ยอดเบิกพอดีกับค่าใช้จ่าย';

        return (
          <div className="acb" style={{ borderColor: '#a7f3d0', background: '#ecfdf5' }}>
            <div className="acb-t" style={{ color: '#065f46' }}>✅ ปิดยอดบัญชีเรียบร้อย (Account Reconciled)</div>
            
            <div className="g3" style={{ gap: '6px', margin: '10px 0' }}>
              <div style={{ background: '#fff', border: '1px solid #a7f3d0', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--tm)' }}>ยอดเบิก</div>
                <div style={{ fontSize: '12.5px', fontWeight: 800 }}>฿{fmt(r.appAmount || r.amount)}</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #a7f3d0', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--tm)' }}>ยอดใช้จริง</div>
                <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--ok)' }}>฿{fmt(r.clrAmount)}</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #a7f3d0', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--tm)' }}>ยอดคงค้าง</div>
                <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--tm)' }}>฿0</div>
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '6px', padding: '8px 12px', border: '1.5px solid #a7f3d0', textAlign: 'center', margin: '8px 0' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#047857' }}>ยอดเงินส่วนต่าง: <b>฿{fmt(diffAmount)}</b></span>
              <p style={{ fontSize: '12px', color: '#065f46', margin: '4px 0 0 0', fontWeight: 'bold' }}>({textNote})</p>
            </div>
            
            <button className="btn btn-sm" style={{ width: '100%', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, padding: '8px' }} onClick={() => { setPage('vault'); closeDrawer(); }}>
              เปิดประวัติคลังเอกสาร (Document Vault)
            </button>
          </div>
        );
      }

      if (isRejected) {
        return (
          <div className="acb" style={{ borderColor: '#fca5a5', background: '#fff5f5' }}>
            <div className="acb-t" style={{ color: '#b91c1c' }}>❌ รายการถูกปฏิเสธ (Rejected Document)</div>
            <div style={{ background: '#ffffff', border: '1px solid #fca5a5', borderRadius: '6px', padding: '8px 12px', margin: '8px 0' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#991b1b', fontWeight: 700, display: 'block' }}>เหตุผลการตีกลับไม่อนุมัติ:</span>
              <p style={{ fontSize: '12.5px', color: '#7f1d1d', margin: '4px 0 0 0', fontWeight: 600 }}>{r.rejReason || 'ไม่ระบุเหตุผลการตีกลับ'}</p>
            </div>
            {r.appBy && <p style={{ fontSize: '11px', color: 'var(--ts)', margin: 0 }}><b>ทำรายการตรวจสอบปฏิเสธโดย:</b> {r.appBy}</p>}
          </div>
        );
      }

      return null;
    };

    const positionLabel = masterUsers.find(u => u.id === r.empId)?.position || r.empDept || '–';

    return (
      <>
        <div className="g2" style={{ marginBottom: '14px' }}>
          <div className="ah"><div className="ah-l">ยอดเบิกทั้งหมด</div><div className="ah-v">฿{fmt(r.amount)}</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', justifyContent: 'center' }}>
            {r.appAmount ? <div style={{ background: '#d1fae5', borderRadius: 'var(--rs)', padding: '8px 12px', fontSize: '12px', color: '#065f46', fontWeight: 600 }}>✓ อนุมัติ ฿{fmt(r.appAmount)}</div> : null}
            {out > 0 && !isRejected ? <div style={{ background: '#fee2e2', borderRadius: 'var(--rs)', padding: '8px 12px', fontSize: '12px', color: '#991b1b', fontWeight: 600 }}>คงค้าง ฿{fmt(out)}</div> : null}
            {r.clrAmount > 0 ? <div style={{ background: '#dbeafe', borderRadius: 'var(--rs)', padding: '8px 12px', fontSize: '12px', color: '#1e40af', fontWeight: 600 }}>เคลียร์แล้ว ฿{fmt(r.clrAmount)}</div> : null}
          </div>
        </div>
        {renderActionBox()}
        <div className="ds" style={{ marginTop: '16px' }}><div className="ds-t">Document Center</div>
          <div className="dg" style={{ marginBottom: '8px' }}>
            <div className="di"><label>ผู้เบิก</label><span>{r.empName}</span></div>
            <div className="di"><label>ตำแหน่ง</label><span>{positionLabel}</span></div>
            <div className="di"><label>โครงการ</label><span>{r.pName}</span></div>
            <div className="di"><label>หมวดค่าใช้จ่าย</label><span>{r.catName}</span></div>
            <div className="di"><label>วันที่เบิก</label><span>{fmtD(r.reqDate)}</span></div>
            <div className="di"><label>กำหนดเคลียร์</label><span style={{ color: od ? '#ef4444' : 'inherit' }}>{fmtD(r.dueDate)}</span></div>
          </div>
          <div className="di"><label>รายละเอียด</label><span>{r.desc}</span></div>
        </div>
        <div className="ds"><div className="ds-t">รายการขอเบิก</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'var(--soft)' }}>
                  <th style={{ padding: '8px 10px', textTransform: 'uppercase', fontSize: '11px', fontWeight: 700, borderBottom: '1.5px solid var(--bdr)', width: '60px', textAlign: 'center' }}>ลำดับ</th>
                  <th style={{ padding: '8px 10px', textTransform: 'uppercase', fontSize: '11px', fontWeight: 700, borderBottom: '1.5px solid var(--bdr)', textAlign: 'left' }}>รายละเอียดรายการขอเบิกเงินทดรองจ่าย</th>
                </tr>
              </thead>
              <tbody>
                {r.items.map((it, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--bdr)', background: i % 2 ? '#fafafa' : '' }}>
                    <td style={{ padding: '10px 5px', verticalAlign: 'top', textAlign: 'center', fontWeight: 'bold', color: 'var(--tx)' }}>{i + 1}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--tx)' }}>{it.d || '–'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          <span style={{ fontWeight: 600, color: 'var(--p)' }}>หมวดหมู่:</span> {r.catName} &nbsp;|&nbsp; <span style={{ fontWeight: 600, color: 'var(--p)' }}>จำนวน:</span> {it.q} {it.u}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: '4px', marginTop: '2px' }}>
                          <span><span style={{ fontWeight: 600 }}>ราคาต่อหน่วย:</span> ฿{fmt(it.p)}</span>
                          <span style={{ fontWeight: 700, color: 'var(--tx)' }}><span style={{ fontWeight: 600, color: '#64748b' }}>ราคารวม:</span> ฿{fmt(it.t)}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1.5px solid var(--bdr)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 800, color: 'var(--p)' }}>รวมทั้งสิ้น</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: 'var(--p)', fontSize: '13px' }}>฿{fmt(r.amount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        {r.clrs?.length ? <div className="ds"><div className="ds-t">ประวัติเคลียร์ยอด</div>{r.clrs.map(cl => <div key={cl.id} style={{ background: 'var(--soft)', borderRadius: 'var(--rs)', padding: '11px', border: '1.5px solid var(--bdr)', marginBottom: '6px' }}><div className="flb"><span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--p)' }}>{cl.id}</span><span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>฿{fmt(cl.amount)}</span></div><div style={{ fontSize: '11.5px', color: 'var(--ts)', marginTop: '3px' }}>วันที่: {fmtD(cl.date)} · {cl.note}</div></div>)}</div> : null}
        <div className="ds"><div className="ds-t">Audit Timeline</div>{tl.map((t, i) => <div key={i} className="tl-item"><div className="tl-dot" style={{ background: t.ok ? 'var(--p)' : 'var(--bdr)' }}></div><div><div className="tl-t" style={{ color: t.ok ? 'var(--tx)' : 'var(--tm)' }}>{t.t}</div><div className="tl-d">{t.d}</div></div></div>)}</div>
        {r.files?.length ? (
          <div className="ds">
            <div className="ds-t">เอกสารแนบ ({r.files.length})</div>
            {r.files.map((f, i) => (
              <div key={i} className="fl" style={{ gap: '8px', padding: '8px', background: 'var(--soft)', borderRadius: 'var(--rs)', marginBottom: '5px', border: '1.5px solid var(--bdr)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--p)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span style={{ fontSize: '12px', flex: 1 }}>{fileLabel(f)}</span>
                <button type="button" className="btn btn-g btn-xs" onClick={() => openFilePreview(f)}>👁️ Preview</button>
              </div>
            ))}
          </div>
        ) : null}
      </>
    );
  },

  Footer: ({ id }: { id: string }) => {
    const { advances, closeDrawer, toast, setPage, deleteAdvance, openModal, closeModal } = useApp();
    const r = advances.find(x => x.id === id);
    if (!r) return null;

    const isDraft = r.status === 'DRAFT' || r.status === 'บันทึกร่าง';
    const isPendingApproval = r.status === 'PENDING_APPROVAL' || r.status === 'รออนุมัติ';
    const isWaitingTransfer = r.status === 'WAITING_TRANSFER' || r.status === 'รอโอน';
    const isClosed = r.status === 'CLOSED' || r.status === 'ปิดยอด' || r.status === 'ปิดยอดแล้ว';
    const isRejected = r.status === 'REJECTED' || r.status === 'ไม่อนุมัติ' || r.status === 'ปฏิเสธ';
    
    const isWaitingClearanceStatus = r.status === 'WAITING_CLEARANCE' || r.status === 'รอเคลียร์' || r.status === 'รอเคลียร์ยอด';
    const isWaitingAudit = isWaitingClearanceStatus && (!!r.reviewStatus || (r.clrs && r.clrs.length > 0));
    const isWaitingClearance = isWaitingClearanceStatus && !isWaitingAudit;

    return (
      <>
        <button className="btn btn-o" onClick={closeDrawer}>ปิด</button>
        
        {isDraft && (
          <>
            <button className="btn btn-p btn-sm" onClick={() => { closeDrawer(); setPage('create', { editAdvanceId: r.id }); }}>✏️ แก้ไขแบบร่าง</button>
            <button 
              className="btn btn-sm" 
              style={{ background: '#fee2e2', color: '#dc2626', border: '1.5px solid #fca5a5' }}
              onClick={() => {
                openModal(
                  'ยืนยันการลบร่างเอกสาร',
                  <div style={{ fontSize: '13px', color: 'var(--tx)' }}>คุณต้องการลบร่างเอกสารขอเบิกเงินทดรองจ่ายหมายเลข <b>{r.id}</b> นี้ออกจากระบบใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</div>,
                  (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
                      <button type="button" className="btn btn-o btn-sm" onClick={closeModal}>ยกเลิก</button>
                      <button 
                        type="button" 
                        className="btn btn-sm" 
                        style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600 }} 
                        onClick={() => {
                          deleteAdvance(r.id);
                          toast(`🗑️ ลบแบบร่าง ${r.id} สำเร็จ`, 'info');
                          closeModal();
                          closeDrawer();
                        }}
                      >
                        ยืนยันลบ
                      </button>
                    </div>
                  )
                );
              }}
            >
              🗑️ ลบแบบร่าง
            </button>
          </>
        )}

        {isPendingApproval && (
          <button className="btn btn-ok btn-sm" onClick={() => { closeDrawer(); setPage('approval', { tab: 'pending_approval' }); }}>
            ไปอนุมัติ →
          </button>
        )}

        {isWaitingTransfer && (
          <button className="btn btn-p btn-sm" onClick={() => { closeDrawer(); setPage('approval', { tab: 'waiting_transfer' }); }}>
            ไปโอนเงิน →
          </button>
        )}

        {isWaitingClearance && (
          <button className="btn btn-p btn-sm" onClick={() => { closeDrawer(); setPage('clearance', { advId: r.id }); }}>
            ไปเคลียร์ →
          </button>
        )}

        {isWaitingAudit && (
          <button className="btn btn-sm text-yellow-800 bg-yellow-400 font-bold border-none" onClick={() => { closeDrawer(); setPage('accounting'); }}>
            ไปตรวจสอบพยานหลักฐาน →
          </button>
        )}

        {isClosed && (
          <button className="btn btn-p btn-sm" onClick={() => { closeDrawer(); setPage('vault'); }}>
            ไปคลังเอกสาร (Document Vault) →
          </button>
        )}

        <button className="btn btn-o btn-sm" onClick={() => { window.print(); toast(`🖨 เปิดหน้าต่างพิมพ์ ${r.id}`); }}>🖨 พิมพ์</button>
      </>
    );
  }
};
