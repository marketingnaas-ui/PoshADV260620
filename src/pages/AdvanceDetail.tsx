import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAdvanceActions } from '../components/AdvanceDetailView';
import { fmt, fmtD, SBadge, overdue, now } from '../lib/utils';
import { fileLabel, fileUrl } from '../lib/files';
import { exportAdvanceToSheets } from '../lib/sheets';
import { FileSpreadsheet, LogIn, ExternalLink } from 'lucide-react';

export const AdvanceDetail = () => {
  const { 
    advances, 
    toast, 
    setPage, 
    masterUsers, 
    masterCategories, 
    openFilePreview,
    googleUser,
    googleToken,
    loginGoogle,
    isLoggingInGoogle
  } = useApp();
  const [detailId, setDetailId] = useState(advances[0]?.id || '');
  const [isExporting, setIsExporting] = useState(false);
  
  const r = advances.find(x => x.id === detailId) || advances[0];
  const actions = useAdvanceActions(r?.id || '');

  const handleSheetsExport = async () => {
    if (!googleToken) {
      void loginGoogle();
      return;
    }

    setIsExporting(true);
    try {
      const ss = await exportAdvanceToSheets(googleToken, r);
      toast(`✅ Export สำเร็จ! สร้างไฟล์แล้ว`, 'success');
      window.open(`https://docs.google.com/spreadsheets/d/${ss.spreadsheetId}/edit`, '_blank');
    } catch (err: any) {
      console.error(err);
      toast('❌ Export ล้มเหลว: ' + err.message, 'err');
    } finally {
      setIsExporting(false);
    }
  };

  if (!r) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--tm)' }}>เลือกรายการจาก Advance List</div>;

  const emp = masterUsers.find(u => u.id === r.empId);
  const positionLabel = emp?.position || emp?.dept || r.empDept;

  const out = (r.appAmount || r.amount) - r.clrAmount;
  const od = overdue(r);
  const pipeline = ['ส่งคำขอ', 'อนุมัติ', 'โอนเงิน', 'เคลียร์', 'ปิดยอด'];
  const pStep: Record<string, number> = { PENDING_APPROVAL: 0, WAITING_TRANSFER: 1, WAITING_CLEARANCE: 2, CLOSED: 4, REJECTED: 1 };
  const curStep = pStep[r.status] ?? 0;
  const isDone = (i: number) => r.status === 'CLOSED' ? true : r.status === 'REJECTED' ? i === 0 : i < curStep;
  
  const tl = [
    { t: 'ส่งคำขอเบิก', d: fmtD(r.reqDate), ok: true },
    { t: r.status === 'REJECTED' ? 'ไม่อนุมัติ' : 'อนุมัติ', d: r.appDate ? fmtD(r.appDate) : (r.status === 'PENDING_APPROVAL' ? 'รออนุมัติ' : '–'), ok: !!r.appDate && r.status !== 'REJECTED' },
    { t: 'โอนเงิน', d: r.pay ? fmtD(r.pay.date) : 'รอดำเนินการ', ok: !!r.pay },
    { t: 'เคลียร์ยอด', d: r.clrs?.[0] ? fmtD(r.clrs[0].date) : 'รอดำเนินการ', ok: !!r.clrs?.[0] },
  ];

  const renderActionRight = () => {
    if (r.status === 'PENDING_APPROVAL') return <div className="acb"><div className="acb-t">🔒 Action Center — รออนุมัติ</div><p style={{ fontSize: '12.5px', color: 'var(--ts)' }}>รายการรอการอนุมัติจากผู้บริหาร ยังไม่สามารถดำเนินการอื่นได้</p><button className="btn btn-p" style={{ width: '100%', marginTop: '10px', justifyContent: 'center' }} onClick={() => setPage('approval')}>ไปหน้าอนุมัติ →</button></div>;
    if (r.status === 'WAITING_TRANSFER') {
      const u = masterUsers.find(x => x.id === r.empId);
      const bank = r.payeeBank || u?.bank || '–';
      const bankNo = r.payeeBankNo || u?.bankNo || '–';
      return <div className="acb">
        <div className="acb-t">💳 Action Center — อัปโหลด Slip</div>
        <div className="fl" style={{ gap: '8px', marginBottom: '10px' }}><div className="eavt" style={{ width: '32px', height: '32px', fontSize: '12px' }}>{r.empName.substring(0,2)}</div><div><div style={{ fontSize: '13px', fontWeight: 700 }}>{r.payeeAccountName || r.empName}</div><div style={{ fontSize: '11.5px', color: 'var(--ts)' }}>ธนาคาร {bank} · {bankNo}</div></div></div>
        <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--p)', marginBottom: '12px' }}>฿{fmt(r.appAmount)}</div>
        <div className="upz" onClick={actions.doTransfer}><div style={{ fontSize: '13px', color: 'var(--p)', fontWeight: 600 }}>📎 Upload Slip การโอนเงินจริง</div><div style={{ fontSize: '11px', color: 'var(--tm)' }}>เลือกไฟล์ slip จริงเพื่อบันทึกหลักฐานลงฐานข้อมูล</div></div>
      </div>;
    }
    if (r.status === 'WAITING_CLEARANCE') return <div className="acb">
      <div className="acb-t">📋 Action Center — เคลียร์ยอด</div>
      {r.pay && <div className="slip-p" style={{ marginBottom: '12px' }}><div style={{ fontSize: '11px', color: 'var(--ts)' }}>✓ โอนแล้ว · {r.pay.bank}</div><div style={{ fontSize: '26px', fontWeight: 900, color: 'var(--p)' }}>฿{fmt(r.pay.amount)}</div><div style={{ fontSize: '11.5px', color: 'var(--ts)' }}>Ref: {r.pay.ref}</div></div>}
      {od && <div style={{ background: '#fee2e2', borderRadius: 'var(--rs)', padding: '9px 12px', marginBottom: '10px', fontSize: '12px', color: '#991b1b', fontWeight: 600 }}>⚠ เกินกำหนด {Math.floor((now().getTime() - new Date(r.dueDate).getTime()) / 86400000)} วัน</div>}
      <div style={{ fontSize: '13px', color: 'var(--ts)', marginBottom: '10px' }}>คงค้าง: <b style={{ color: '#ef4444' }}>฿{fmt(out)}</b></div>
      <button className="btn btn-p" style={{ width: '100%', justifyContent: 'center' }} onClick={() => actions.doClearance(out)}>สร้างใบเคลียร์ยอด</button>
    </div>;
    if (r.status === 'CLOSED') return <div className="acb" style={{ borderColor: '#d1fae5' }}><div className="acb-t" style={{ color: '#10b981' }}>✅ Action Center — ปิดยอดแล้ว</div><p style={{ fontSize: '12.5px', color: 'var(--ts)' }}>รายการนี้เคลียร์ครบถ้วน ไม่มีการดำเนินการเพิ่มเติม</p></div>;
    if (r.status === 'REJECTED') return <div className="acb" style={{ borderColor: '#fee2e2' }}><div className="acb-t" style={{ color: '#ef4444' }}>❌ Action Center — ไม่อนุมัติ</div><p style={{ fontSize: '12.5px', color: 'var(--ts)' }}>{r.rejReason || 'ไม่ระบุเหตุผล'}</p></div>;
    return null;
  };

  return (
    <>
      <div className="ph">
        <div>
          <div className="fl" style={{ gap: '8px', marginBottom: '4px' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--p)' }}>{r.id}</div>
            <SBadge status={r.status} date={r.dueDate} />
          </div>
          <div className="pipe">
            {pipeline.map((p, i) => {
              const st = r.status === 'REJECTED' && i === 1 ? 'ps-fail' : isDone(i) ? 'ps-ok' : i === curStep ? 'ps-ac' : 'ps-id';
              return <React.Fragment key={p}>{i > 0 && <span style={{ color: 'var(--tm)', fontSize: '14px', margin: '0 2px' }}>›</span>}<span className={`ps ${st}`}>{p}</span></React.Fragment>;
            })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select className="btn btn-o btn-sm" style={{ minWidth: '180px' }} value={r.id} onChange={e => setDetailId(e.target.value)}>
            {advances.map(x => <option key={x.id} value={x.id}>{x.id} · {x.empName}</option>)}
          </select>
          <button className="btn btn-o btn-sm" onClick={() => { window.print(); toast(`🖨 เปิดหน้าต่างพิมพ์ ${r.id}`); }}>🖨</button>
          
          <button 
            className={`btn btn-sm ${googleUser ? 'btn-p' : 'btn-o'}`} 
            onClick={handleSheetsExport}
            disabled={isExporting || isLoggingInGoogle}
            title={googleUser ? 'ส่งออกข้อมูลไปยัง Google Sheets' : 'เชื่อมต่อ Google Sheets'}
          >
            {isExporting ? (
              <span className="animate-spin">🔄</span>
            ) : googleUser ? (
              <div className="fl" style={{ gap: '6px' }}>
                <FileSpreadsheet size={16} /> 
                <span className="hid-mob">Export to Sheets</span>
              </div>
            ) : (
              <div className="fl" style={{ gap: '6px' }}>
                <LogIn size={16} />
                <span className="hid-mob">Connect Sheets</span>
              </div>
            )}
          </button>
        </div>
      </div>
      <div className="g2" style={{ alignItems: 'start' }}>
        <div>
          <div className="card" style={{ marginBottom: '14px' }}>
            <div className="ah" style={{ marginBottom: '14px' }}>
              <div className="ah-l">ยอดเบิกทั้งหมด</div><div className="ah-v">฿{fmt(r.amount)}</div>
              {r.appAmount ? <div style={{ fontSize: '13px', color: '#065f46', marginTop: '3px' }}>✓ อนุมัติ ฿{fmt(r.appAmount)}</div> : null}
            </div>
            <div className="ds"><div className="ds-t">ข้อมูลผู้ขอเบิก</div>
              <div className="dg">
                <div className="di"><label>ชื่อ</label><span>{r.empName}</span></div>
                <div className="di"><label>ตำแหน่ง</label><span>{positionLabel}</span></div>
                <div className="di"><label>โครงการ</label><span>{r.pName}</span></div>
                <div className="di"><label>หมวด</label><span>{r.catName}</span></div>
                <div className="di"><label>วันที่เบิก</label><span>{fmtD(r.reqDate)}</span></div>
                <div className="di"><label>กำหนดเคลียร์</label><span style={{ color: od ? '#ef4444' : 'inherit' }}>{fmtD(r.dueDate)}</span></div>
              </div>
              <div className="di" style={{ marginTop: '8px' }}><label>รายละเอียด</label><span>{r.desc}</span></div>
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
                    {r.items.map((it, i) => {
                      const catName = masterCategories?.find(ct => ct.id === it.cat)?.name || r.catName;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--bdr)', background: i % 2 ? '#fafafa' : '' }}>
                          <td style={{ padding: '10px 5px', verticalAlign: 'top', textAlign: 'center', fontWeight: 'bold', color: 'var(--tx)' }}>{i + 1}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--tx)' }}>{it.d || '–'}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                <span style={{ fontWeight: 600, color: 'var(--p)' }}>หมวดหมู่:</span> {catName} &nbsp;|&nbsp; <span style={{ fontWeight: 600, color: 'var(--p)' }}>จำนวน:</span> {it.q} {it.u}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: '4px', marginTop: '2px' }}>
                                <span><span style={{ fontWeight: 600 }}>ราคาต่อหน่วย:</span> ฿{fmt(it.p)}</span>
                                <span style={{ fontWeight: 700, color: 'var(--tx)' }}><span style={{ fontWeight: 600, color: '#64748b' }}>ราคารวม:</span> ฿{fmt(it.t)}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
            {r.files?.length ? (
              <div className="ds">
                <div className="ds-t">เอกสารแนบ ({r.files.length})</div>
                {r.files.map((f, i) => (
                  <div key={i} className="fl" style={{ gap: '7px', padding: '7px', background: 'var(--soft)', borderRadius: 'var(--rs)', marginBottom: '5px', border: '1.5px solid var(--bdr)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--p)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span style={{ fontSize: '12px', flex: 1 }}>{fileLabel(f)}</span>
                    <button type="button" className="btn btn-g btn-xs" onClick={() => openFilePreview(f)}>👁️ Preview</button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="ds"><div className="ds-t">Audit Timeline</div>{tl.map((t, i) => <div key={i} className="tl-item"><div className="tl-dot" style={{ background: t.ok ? 'var(--p)' : 'var(--bdr)' }}></div><div><div className="tl-t" style={{ color: t.ok ? 'var(--tx)' : 'var(--tm)' }}>{t.t}</div><div className="tl-d">{t.d}</div></div></div>)}</div>
          </div>
        </div>
        <div>
          {renderActionRight()}
          {r.clrs?.length ? <div className="card" style={{ marginTop: '14px' }}><div className="ds-t">ประวัติเคลียร์ยอด</div>{r.clrs.map(cl => <div key={cl.id} style={{ background: 'var(--soft)', borderRadius: 'var(--rs)', padding: '11px', border: '1.5px solid var(--bdr)', marginBottom: '6px' }}><div className="flb"><span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--p)' }}>{cl.id}</span><span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>฿{fmt(cl.amount)}</span></div><div style={{ fontSize: '11.5px', color: 'var(--ts)', marginTop: '3px' }}>{fmtD(cl.date)} · {cl.note}</div></div>)}</div> : null}
          {out > 0 && r.status !== 'REJECTED' ? <div style={{ background: '#fee2e2', borderRadius: 'var(--r)', padding: '14px', marginTop: '14px', border: '1.5px solid #fecaca' }}><div style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b', marginBottom: '4px' }}>ยอดคงค้าง</div><div style={{ fontSize: '28px', fontWeight: 900, color: '#ef4444' }}>฿{fmt(out)}</div></div> : null}
        </div>
      </div>
    </>
  );
};
