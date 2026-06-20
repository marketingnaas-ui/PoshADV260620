import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fmt, fmtD, SBadge, UserAvt } from '../lib/utils';
import { AdvanceDetailView } from '../components/AdvanceDetailView';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export const AdvanceList = () => {
  const { advances, setPage, openDrawer } = useApp();
  const [listF, setListF] = React.useState('');

  const matchStatus = (status: string, filterStr: string): boolean => {
    if (!filterStr) return true;
    const s = String(status || '').toUpperCase();
    const f = String(filterStr || '').toUpperCase();
    if (f === 'PENDING_APPROVAL') return s === 'PENDING_APPROVAL' || s === 'รออนุมัติ';
    if (f === 'WAITING_TRANSFER') return s === 'WAITING_TRANSFER' || s === 'รอโอน' || s === 'รอโอนเงิน';
    if (f === 'WAITING_CLEARANCE') return s === 'WAITING_CLEARANCE' || s === 'รอเคลียร์' || s === 'รอเคลียร์ยอด';
    if (f === 'CLOSED') return s === 'CLOSED' || s === 'ปิดยอด';
    if (f === 'REJECTED') return s === 'REJECTED' || s === 'ไม่อนุมัติ' || s === 'ปฏิเสธ';
    if (f === 'DRAFT') return s === 'DRAFT' || s === 'บันทึกร่าง' || s === 'แบบร่าง';
    return s === f || (status || '').toLowerCase() === filterStr.toLowerCase();
  };

  const data = listF ? advances.filter(r => matchStatus(r.status, listF)) : advances;

  const kpi = useMemo(() => {
    const totalOut = advances.reduce((sum, r) => sum + Math.max(0, r.amount - (r.clrAmount || 0)), 0);
    const overdue = advances.filter(r => r.status !== 'CLOSED' && r.status !== 'ปิดยอด' && new Date(r.dueDate) < new Date()).length;
    return { totalOut, overdue };
  }, [advances]);

  const topRequester = useMemo(() => {
    const map = new Map<string, number>();
    advances.forEach(r => {
      const out = Math.max(0, r.amount - (r.clrAmount || 0));
      map.set(r.empName, (map.get(r.empName) || 0) + out);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [advances]);

  const projectFloating = useMemo(() => {
    const map = new Map<string, number>();
    advances.forEach(r => {
      const out = Math.max(0, r.amount - (r.clrAmount || 0));
      map.set(r.pName, (map.get(r.pName) || 0) + out);
    });
    return Array.from(map.entries()).map(([name, val]) => ({ name, val }));
  }, [advances]);

  const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#6b7280'];

  const handleOpenAdv = (id: string) => {
    openDrawer(
      <AdvanceDetailView.Header id={id} />,
      <AdvanceDetailView.Body id={id} />,
      <AdvanceDetailView.Footer id={id} />
    );
  };

  const tabs = [
    { f: '', l: 'ทั้งหมด', n: advances.length, col: 'var(--p)' },
    { f: 'PENDING_APPROVAL', l: 'รออนุมัติ', n: advances.filter(r => matchStatus(r.status, 'PENDING_APPROVAL')).length, col: '#f59e0b' },
    { f: 'WAITING_TRANSFER', l: 'รอโอน', n: advances.filter(r => matchStatus(r.status, 'WAITING_TRANSFER')).length, col: '#3b82f6' },
    { f: 'WAITING_CLEARANCE', l: 'รอเคลียร์', n: advances.filter(r => matchStatus(r.status, 'WAITING_CLEARANCE')).length, col: '#8b5cf6' }
  ];

  const cellStyle = (width: string, isRight = false): React.CSSProperties => ({
    width,
    minWidth: width,
    maxWidth: width,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    height: '46px',
    padding: '0 12px',
    verticalAlign: 'middle',
    textAlign: isRight ? 'right' : 'left'
  });

  const getBankDetails = (r: any) => {
    const pay = r.pay || {};
    const sourceBank = pay.senderBank || 'ธนาคารไทยพาณิชย์ (SCB)';
    const sourceAccName = pay.senderName || 'บมจ. เจนเซรัล แฟคเตอร์ริ่ง (กองกลางบริษัท)';
    const sourceAccNo = String(pay.senderAccountNo || '0230128490').replace(/[-\s]/g, '');

    const recipientBank = r.payeeBank || 'ธนาคารกสิกรไทย (KBANK)';
    const recipientAccNo = String(r.payeeBankNo || '0429384910').replace(/[-\s]/g, '');
    return { sourceBank, sourceAccName, sourceAccNo, recipientBank, recipientAccNo };
  };

  return (
    <>
      <div className="ph">
        <div><h2>Advance List</h2><p>รายการทั้งหมด เรียงจากล่าสุด (§ 14 คอลัมน์)</p></div>
        <button className="btn btn-p btn-sm" onClick={() => setPage('create')}>+ สร้างใบเบิก</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '14px', color: '#64748b' }}>ยอดเงินคงค้างรวม</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ef4444' }}>฿{fmt(kpi.totalOut)}</div>
        </div>
        <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '14px', color: '#64748b' }}>รายการเลยกำหนด</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{kpi.overdue}</div>
        </div>
        <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', gridColumn: 'span 2' }}>
          <div style={{ fontSize: '14px', color: '#64748b' }}>Top 5 หนี้ค้างตามพนักงาน</div>
          <ResponsiveContainer width="100%" height={60}>
            <BarChart layout="vertical" data={topRequester.map(([name, val]) => ({ name, val }))}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={80} style={{ fontSize: '10px' }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="val" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="sum-bar">
        {tabs.map(t => (
          <div key={t.f} className={`sb-c ${listF === t.f ? 'active' : ''}`} onClick={() => setListF(t.f)}>
            <div className="sb-n" style={{ color: t.col }}>{t.n}</div>
            <div className="sb-l">{t.l}</div>
          </div>
        ))}
      </div>

      <div className="tw" style={{ overflowX: 'auto', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
        <table className="dt" style={{ tableLayout: 'fixed', width: '2000px', minWidth: '2000px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ height: '46px' }}>
              <th style={cellStyle('130px')}>Status</th>
              <th style={cellStyle('130px')}>ADV_No</th>
              <th style={cellStyle('110px')}>Request_Date</th>
              <th style={cellStyle('110px')}>Due_Date</th>
              <th style={cellStyle('160px')}>Requester_Name</th>
              <th style={cellStyle('160px')}>Project_Name</th>
              <th style={cellStyle('180px')}>Source_Bank_Name</th>
              <th style={cellStyle('220px')}>Source_Account_Name</th>
              <th style={cellStyle('150px')}>Source_Account_No</th>
              <th style={cellStyle('180px')}>Recipient_Bank_Name</th>
              <th style={cellStyle('150px')}>Recipient_Account_No</th>
              <th style={cellStyle('140px', true)}>Total_Requested</th>
              <th style={cellStyle('140px', true)}>Total_Cleared</th>
              <th style={cellStyle('160px', true)}>Outstanding_Balance</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map(r => {
              const { sourceBank, sourceAccName, sourceAccNo, recipientBank, recipientAccNo } = getBankDetails(r);
              return (
                <tr key={r.id} onClick={() => handleOpenAdv(r.id)} style={{ cursor: 'pointer', height: '46px' }}>
                  <td style={cellStyle('130px')}><SBadge status={r.status} date={r.dueDate} /></td>
                  <td style={cellStyle('130px')}><span className="dn">{r.id}</span></td>
                  <td style={{ ...cellStyle('110px'), fontSize: '12px', color: 'var(--ts)' }}>{fmtD(r.reqDate)}</td>
                  <td style={{ ...cellStyle('110px'), fontSize: '12px', color: 'var(--ts)' }}>{fmtD(r.dueDate)}</td>
                  <td style={cellStyle('160px')}>
                    <div className="fl" style={{ gap: '6px', height: '100%', alignItems: 'center' }}>
                      <UserAvt ini={r.empName.substring(0, 2)} size={22} />
                      <span style={{ fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.empName}</span>
                    </div>
                  </td>
                  <td style={{ ...cellStyle('160px'), fontSize: '11.5px' }}>{r.pName}</td>
                  <td style={cellStyle('180px')}>{sourceBank}</td>
                  <td style={cellStyle('220px')}>{sourceAccName}</td>
                  <td style={{ ...cellStyle('150px'), fontFamily: 'monospace' }}>{sourceAccNo}</td>
                  <td style={cellStyle('180px')}>{recipientBank}</td>
                  <td style={{ ...cellStyle('150px'), fontFamily: 'monospace' }}>{recipientAccNo}</td>
                  <td style={{ ...cellStyle('140px', true), fontWeight: 700 }}>฿{fmt(r.amount)}</td>
                  <td style={{ ...cellStyle('140px', true), fontWeight: 700, color: 'var(--ok)' }}>฿{fmt(r.clrAmount || 0)}</td>
                  <td style={{ ...cellStyle('160px', true), fontWeight: 700, color: (r.amount - (r.clrAmount || 0)) > 0 ? 'var(--err)' : 'inherit' }}>
                    ฿{fmt(Math.max(0, r.amount - (r.clrAmount || 0)))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

