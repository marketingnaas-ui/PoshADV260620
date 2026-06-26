import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { fmt, fmtD, SBadge } from '../lib/utils';
import { AdvanceDetailView } from '../components/AdvanceDetailView';
import { SmartFilter } from '../components/SmartFilter';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';

export const ClearingList = () => {
  const { advances, setPage, openDrawer } = useApp();
  const [listF, setListF] = useState('');
  const [searchQ, setSearchQ] = useState('');

  const allClearances = useMemo(() => {
    const list: any[] = [];
    advances.forEach(r => {
      const receiptsSet = new Map<string, any>();
      if (r.receipts && r.receipts.length > 0) {
        r.receipts.forEach((rc: any) => {
          receiptsSet.set(rc.id, rc);
        });
      }
      if (r.clrs && r.clrs.length > 0) {
        r.clrs.forEach((clr: any) => {
          if (clr.receipts && clr.receipts.length > 0) {
            clr.receipts.forEach((rc: any) => {
              receiptsSet.set(rc.id || clr.id, { ...rc, id: rc.id || clr.id });
            });
          }
        });
      }

      if (receiptsSet.size > 0) {
        receiptsSet.forEach((rc) => {
          const items = rc.items || [];
          if (items.length > 0) {
            items.forEach((item: any, idx: number) => {
              const amtNet = item.price * item.qty;
              const vatAmt = Math.round((amtNet * (item.vat || 0)) / 100);
              const totalAmt = amtNet + vatAmt;
              list.push({
                uniqKey: `clr-${r.id}-${rc.id}-${idx}`,
                status: r.status,
                dueDate: r.dueDate,
                clrNo: rc.id || 'CLR-PENDING',
                refAdvNo: r.id,
                itemDate: rc.date || r.reqDate,
                vendorName: rc.vendor || '–',
                taxId: rc.taxId || '–',
                receiptNo: rc.receiptNo || '–',
                invoiceNo: rc.invoiceNo || '–',
                itemDescription: item.desc || '–',
                amountNet: amtNet,
                vatAmount: vatAmt,
                discountAmount: 0,
                otherCost: 0,
                totalAmount: totalAmt,
                isAiScanned: !!rc.aiFeedback
              });
            });
          } else {
            list.push({
              uniqKey: `clr-${r.id}-${rc.id}-flat`,
              status: r.status,
              dueDate: r.dueDate,
              clrNo: rc.id || 'CLR-PENDING',
              refAdvNo: r.id,
              itemDate: rc.date || r.reqDate,
              vendorName: rc.vendor || '–',
              taxId: rc.taxId || '–',
              receiptNo: rc.receiptNo || '–',
              invoiceNo: rc.invoiceNo || '–',
              itemDescription: r.desc || '–',
              amountNet: rc.subtotal || rc.netTotal || 0,
              vatAmount: rc.vatAmount || 0,
              discountAmount: 0,
              otherCost: 0,
              totalAmount: rc.netTotal || rc.subtotal || 0,
              isAiScanned: !!rc.aiFeedback
            });
          }
        });
      } else if (r.clrs && r.clrs.length > 0) {
        r.clrs.forEach((clr: any) => {
          list.push({
            uniqKey: `clr-${r.id}-${clr.id}-fallback`,
            status: r.status,
            dueDate: r.dueDate,
            clrNo: clr.id || 'CLR-PENDING',
            refAdvNo: r.id,
            itemDate: clr.date || r.reqDate,
            vendorName: '–',
            taxId: '–',
            receiptNo: '–',
            invoiceNo: '–',
            itemDescription: clr.note || r.desc || '–',
            amountNet: clr.amount,
            vatAmount: 0,
            discountAmount: 0,
            otherCost: 0,
            totalAmount: clr.amount,
            isAiScanned: true // Assume true for fallback
          });
        });
      }
    });
    return list;
  }, [advances]);

  const kpi = useMemo(() => {
    const total = allClearances.reduce((sum, c) => sum + c.totalAmount, 0);
    const vat = allClearances.reduce((sum, c) => sum + c.vatAmount, 0);
    return { total, vat };
  }, [allClearances]);

  const topVendors = useMemo(() => {
    const map = new Map<string, number>();
    allClearances.forEach(c => {
      if (c.vendorName !== '–') {
        map.set(c.vendorName, (map.get(c.vendorName) || 0) + c.totalAmount);
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [allClearances]);

  const dailyTrend = useMemo(() => {
    const map = new Map<string, number>();
    allClearances.forEach(c => {
      map.set(c.itemDate, (map.get(c.itemDate) || 0) + c.totalAmount);
    });
    return Array.from(map.entries()).map(([date, val]) => ({ date: fmtD(date), val })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [allClearances]);

  const filtered = allClearances.filter(c => {
    if (listF) {
      if (listF === 'WAITING_CLEARANCE') {
        if (!['WAITING_CLEARANCE', 'CLEARED_BY_EMPLOYEE', 'PARTIAL_CLEARANCE', 'WAITING_PHYSICAL_DOCS'].includes(c.status || '')) return false;
      } else if (c.status !== listF) {
        return false;
      }
    }
    if (searchQ) {
       const q = searchQ.toLowerCase();
       if (!c.clrNo.toLowerCase().includes(q) && !c.refAdvNo.toLowerCase().includes(q) && !c.vendorName.toLowerCase().includes(q) && !c.itemDescription.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  
  const tabs = [
    { f: '', l: 'ทั้งหมด', n: allClearances.length, col: 'var(--p)' },
    { f: 'WAITING_CLEARANCE', l: 'รอตรวจเคลียร์', n: allClearances.filter(c => ['WAITING_CLEARANCE', 'CLEARED_BY_EMPLOYEE', 'PARTIAL_CLEARANCE', 'WAITING_PHYSICAL_DOCS'].includes(c.status || '')).length, col: '#8b5cf6' },
    { f: 'CLOSED', l: 'ปิดยอดแล้ว', n: allClearances.filter(c => c.status === 'CLOSED').length, col: '#10b981' }
  ];
  const sortedFiltered = useMemo(() => {
     return [...filtered].sort((a, b) => new Date(b.itemDate).getTime() - new Date(a.itemDate).getTime());
  }, [filtered]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const isAllSelected = sortedFiltered.length > 0 && selectedIds.length === sortedFiltered.length;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedIds([]);
    else setSelectedIds(sortedFiltered.map(c => c.uniqKey));
  };

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

  const cleanText = (val: any): string => {
    if (val === undefined || val === null) return '–';
    return String(val).replace(/[-\s]/g, '');
  };

  const handleOpenClearingItem = (c: any) => {
    const isReady = c.status === 'WAITING_CLEARANCE' || c.status === 'DRAFT_CLEARANCE';
    openDrawer(
      <AdvanceDetailView.Header id={c.refAdvNo} />,
      <AdvanceDetailView.Body id={c.refAdvNo} />,
      isReady ? (
        <div style={{ padding: '16px' }}>
          <button 
            className="btn btn-p" 
            style={{ width: '100%', padding: '12px' }}
            onClick={() => {
              setPage('clearance', { advId: c.refAdvNo });
            }}
          >
            ไปหน้าเคลียร์ยอด
          </button>
        </div>
      ) : <AdvanceDetailView.Footer id={c.refAdvNo} />
    );
  };


  return (
    <>
      <div className="ph">
        <div>
          <h2>Clearing List</h2>
          <p>รายการเคลียร์เงินทดรองรายสินค้า/รายบิล (§ 14 คอลัมน์)</p>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '14px', color: '#64748b' }}>ยอดเคลียร์บิลรวม</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>฿{fmt(kpi.total)}</div>
        </div>
        <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '14px', color: '#64748b' }}>ยอดภาษีซื้อรวม</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>฿{fmt(kpi.vat)}</div>
        </div>
        <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', gridColumn: 'span 2' }}>
          <div style={{ fontSize: '14px', color: '#64748b' }}>Top 5 ร้านค้า</div>
          <ResponsiveContainer width="100%" height={60}>
            <BarChart layout="vertical" data={topVendors.map(([name, val]) => ({ name, val }))}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={80} style={{ fontSize: '10px' }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="val" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
         <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '10px' }}>เทรนด์การเคลียร์เงิน</div>
         <ResponsiveContainer width="100%" height={150}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" style={{ fontSize: '10px' }} />
              <YAxis style={{ fontSize: '10px' }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Line type="monotone" dataKey="val" name="ยอดเคลียร์" stroke="#10b981" strokeWidth={2} />
            </LineChart>
         </ResponsiveContainer>
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
        onClear={() => { setSearchQ(''); setListF(''); }}
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
              <th style={cellStyle('130px')}>CLR_No</th>
              <th style={cellStyle('130px')}>Ref_ADV_No</th>
              <th style={cellStyle('110px')}>Item_Date</th>
              <th style={cellStyle('160px')}>Vendor_Name</th>
              <th style={cellStyle('150px')}>Tax_ID</th>
              <th style={cellStyle('130px')}>Receipt_No</th>
              <th style={cellStyle('130px')}>Tax_Invoice_No</th>
              <th style={cellStyle('220px')}>Item_Description</th>
              <th style={cellStyle('120px', true)}>Amount_Net</th>
              <th style={cellStyle('110px', true)}>VAT_Amount</th>
              <th style={cellStyle('120px', true)}>Discount_Amount</th>
              <th style={cellStyle('110px', true)}>Other_Cost</th>
              <th style={cellStyle('130px', true)}>Total_Amount</th>
            </tr>
          </thead>
          <tbody>
            {sortedFiltered.length > 0 ? (
              sortedFiltered.map(c => (
                <tr key={c.uniqKey} onClick={() => handleOpenClearingItem(c)} style={{ cursor: 'pointer', height: '46px' }}>
                  <td style={cellStyle('40px')} onClick={(e) => e.stopPropagation()}><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" checked={selectedIds.includes(c.uniqKey)} onChange={() => toggleSelect(c.uniqKey)} /></td>
                  <td style={cellStyle('130px')}>
                    <SBadge status={c.status} date={c.dueDate} />
                    {!c.isAiScanned && (
                        <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '2px', fontWeight: 'bold' }}>ยังไม่ได้ให้ AI สแกน</div>
                    )}
                  </td>
                  <td style={cellStyle('130px')}><span className="tag" style={{ background: '#e0f2fe', color: '#0369a1' }}>{c.clrNo}</span></td>
                  <td style={cellStyle('130px')}><span className="dn">{c.refAdvNo && c.refAdvNo.includes('-') ? `${c.refAdvNo.split('-').slice(0, 2).join('-')}-${String(parseInt(c.refAdvNo.split('-')[2] || '0', 10)).padStart(3, '0')}` : c.refAdvNo}</span></td>
                  <td style={{ ...cellStyle('110px'), fontSize: '12px', color: 'var(--ts)' }}>{fmtD(c.itemDate)}</td>
                  <td style={cellStyle('160px')}>{c.vendorName}</td>
                  <td style={{ ...cellStyle('150px'), fontFamily: 'monospace' }}>{cleanText(c.taxId)}</td>
                  <td style={cellStyle('130px')}>{c.receiptNo}</td>
                  <td style={cellStyle('130px')}>{c.invoiceNo}</td>
                  <td style={cellStyle('220px')}>{c.itemDescription}</td>
                   <td style={{ ...cellStyle('120px', true), fontWeight: 700 }}>฿{fmt(c.amountNet)}</td>
                  <td style={{ ...cellStyle('110px', true), fontWeight: 700, color: 'var(--tm)' }}>฿{fmt(c.vatAmount)}</td>
                  <td style={{ ...cellStyle('120px', true), fontWeight: 700, color: 'var(--tm)' }}>฿{fmt(c.discountAmount)}</td>
                  <td style={{ ...cellStyle('110px', true), fontWeight: 700, color: 'var(--tm)' }}>฿{fmt(c.otherCost)}</td>
                  <td style={{ ...cellStyle('130px', true), fontWeight: 700, color: 'var(--ok)' }}>฿{fmt(c.totalAmount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={14} style={{ textAlign: 'center', color: 'var(--tm)', padding: '24px' }}>
                  ไม่พบรายการเคลียร์เงินทดรอง
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};
