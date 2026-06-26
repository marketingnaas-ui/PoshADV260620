import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { fmt, fmtD, SBadge, UserAvt } from '../lib/utils';
import { AdvanceDetailView } from '../components/AdvanceDetailView';
import { SmartFilter } from '../components/SmartFilter';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export const AdvanceList = () => {
  const { advances, setPage, openDrawer } = useApp();
  const [listF, setListF] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [projectF, setProjectF] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const sortedData = useMemo(() => {
    return [...advances].sort((a, b) => new Date(a.reqDate).getTime() - new Date(b.reqDate).getTime());
  }, [advances]);

  const matchStatus = (status: string, filterStr: string): boolean => {
    if (!filterStr) return true;
    const s = String(status || '').toUpperCase();
    const f = String(filterStr || '').toUpperCase();
    if (f === 'PENDING_APPROVAL') return s === 'PENDING_APPROVAL' || s === 'รออนุมัติ';
    if (f === 'WAITING_TRANSFER') return s === 'WAITING_TRANSFER' || s === 'รอโอน' || s === 'รอโอนเงิน';
    if (f === 'WAITING_CLEARANCE') return ['WAITING_CLEARANCE', 'CLEARED_BY_EMPLOYEE', 'PARTIAL_CLEARANCE', 'WAITING_PHYSICAL_DOCS'].includes(s) || s === 'รอเคลียร์' || s === 'รอเคลียร์ยอด';
    if (f === 'CLOSED') return s === 'CLOSED' || s === 'ปิดยอด';
    if (f === 'REJECTED') return s === 'REJECTED' || s === 'ไม่อนุมัติ' || s === 'ปฏิเสธ';
    if (f === 'DRAFT') return s === 'DRAFT' || s === 'บันทึกร่าง' || s === 'แบบร่าง' || s === 'DRAFT_CLEARANCE';
    return s === f || (status || '').toLowerCase() === filterStr.toLowerCase();
  };

  const data = sortedData.filter(r => {
    if (listF && !matchStatus(r.status, listF)) return false;
    if (projectF && (!r.pIds || !r.pIds.includes(projectF))) return false;
    if (searchQ) {
       const q = searchQ.toLowerCase();
       if (!r.id.toLowerCase().includes(q) && !r.empName.toLowerCase().includes(q) && !(r.pName||'').toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const isAllSelected = data.length > 0 && selectedIds.length === data.length;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedIds([]);
    else setSelectedIds(data.map(r => r.id));
  };

  const kpi = useMemo(() => {
    const totalOut = advances.reduce((sum, r) => sum + (r.amount - (r.clrAmount || 0)), 0);
    const overdue = advances.filter(r => r.status !== 'CLOSED' && r.status !== 'ปิดยอด' && new Date(r.dueDate) < new Date()).length;
    return { totalOut, overdue };
  }, [advances]);

  const topRequester = useMemo(() => {
    const map = new Map<string, number>();
    advances.forEach(r => {
      const out = r.amount - (r.clrAmount || 0);
      map.set(r.empName, (map.get(r.empName) || 0) + out);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [advances]);

  const projectFloating = useMemo(() => {
    const map = new Map<string, number>();
    advances.forEach(r => {
      const out = r.amount - (r.clrAmount || 0);
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
    { f: 'DRAFT', l: 'บันทึกร่าง', n: advances.filter(r => matchStatus(r.status, 'DRAFT') || matchStatus(r.status, 'DRAFT_CLEARANCE')).length, col: '#94a3b8' },
    { f: 'PENDING_APPROVAL', l: 'รออนุมัติ', n: advances.filter(r => matchStatus(r.status, 'PENDING_APPROVAL')).length, col: '#f59e0b' },
    { f: 'WAITING_TRANSFER', l: 'รอโอน', n: advances.filter(r => matchStatus(r.status, 'WAITING_TRANSFER')).length, col: '#3b82f6' },
    { f: 'WAITING_CLEARANCE', l: 'รอเคลียร์', n: advances.filter(r => matchStatus(r.status, 'WAITING_CLEARANCE')).length, col: '#8b5cf6' },
    { f: 'PARTIAL_CLEARANCE', l: 'บันทึกเคลียร์บางส่วน', n: advances.filter(r => matchStatus(r.status, 'PARTIAL_CLEARANCE')).length, col: '#3b82f6' },
    { f: 'WAITING_PHYSICAL_DOCS', l: 'รอเอกสารตัวจริง', n: advances.filter(r => matchStatus(r.status, 'WAITING_PHYSICAL_DOCS')).length, col: '#8b5cf6' },
    { f: 'CLOSED', l: 'ปิดยอด', n: advances.filter(r => matchStatus(r.status, 'CLOSED')).length, col: '#10b981' },
    { f: 'RETURNED', l: 'เอกสารตีกลับ', n: advances.filter(r => matchStatus(r.status, 'RETURNED')).length, col: '#ef4444' }
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

      <SmartFilter
        searchQuery={searchQ}
        onSearchChange={setSearchQ}
        projectFilter={projectF}
        onProjectChange={setProjectF}
        onClear={() => { setSearchQ(''); setProjectF(''); setListF(''); }}
        hideStatus={true}
      />

      {selectedIds.length > 0 && (
        <div style={{ padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>เลือกแล้ว {selectedIds.length} รายการ:</span>
          <button className="btn btn-sm" style={{ background: '#ef4444', color: '#fff' }} onClick={() => { setSelectedIds([]); }}>🗑 ลบ</button>
          <button className="btn btn-sm" style={{ background: '#3b82f6', color: '#fff' }} onClick={() => {}}>📂 Export</button>
          <button className="btn btn-sm" style={{ background: '#64748b', color: '#fff' }} onClick={() => {}}>🖨 พิมพ์</button>
        </div>
      )}

      <div className="tw" style={{ overflowX: 'auto', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
        <table className="dt" style={{ tableLayout: 'fixed', width: '2040px', minWidth: '2040px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ height: '46px' }}>
              <th style={cellStyle('40px')}><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" checked={isAllSelected} onChange={toggleSelectAll} /></th>
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
            {data.map(r => {
              const { sourceBank, sourceAccName, sourceAccNo, recipientBank, recipientAccNo } = getBankDetails(r);
              return (
                <tr key={r.id} onClick={() => handleOpenAdv(r.id)} style={{ cursor: 'pointer', height: '46px' }}>
                  <td style={cellStyle('40px')} onClick={(e) => e.stopPropagation()}><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" checked={selectedIds.includes(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                  <td style={cellStyle('130px')}><SBadge status={r.status} date={r.dueDate} /></td>
                  <td style={cellStyle('130px')}><span className="dn">{r.id && r.id.includes('-') ? `${r.id.split('-').slice(0, 2).join('-')}-${String(parseInt(r.id.split('-')[2] || '0', 10)).padStart(3, '0')}` : r.id}</span></td>
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
                  <td style={{ ...cellStyle('160px', true), fontWeight: 700, color: (r.amount - (r.clrAmount || 0)) > 0 ? 'var(--err)' : 'var(--ok)' }}>
                    ฿{fmt(r.amount - (r.clrAmount || 0))}
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

