import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getStats } from '../lib/stats';
import { fmtM, SM, fmt } from '../lib/utils';
import { Download, FileSpreadsheet, FileText, CheckCircle } from 'lucide-react';
import { AccountingTransaction } from '../types';

export const Reports = () => {
  const { advances, toast } = useApp();
  const s = getStats(advances);
  
  const catColors: Record<string, string> = { 'ค่าแรง': '#4E958D', 'ค่าวัสดุ': '#3b82f6', 'ค่าเดินทาง': '#f59e0b', 'ค่าอุปกรณ์': '#8b5cf6', 'ค่าเช่า': '#ef4444', 'อื่นๆ': '#6b7280' };
  const maxE = s.topE[0] ? s.topE[0][1].amt : 1;
  const maxP = s.topP[0] ? s.topP[0][1].amt : 1;
  const maxC = Math.max(...Object.values(s.catT).length ? Object.values(s.catT) : [0], 1);

  // Load accounting ledger transactions
  const [reviewTransactions, setReviewTransactions] = useState<AccountingTransaction[]>([]);

  useEffect(() => {
    fetch('/api/store/review-transactions')
      .then((res) => res.json())
      .then((loaded) => {
        if (Array.isArray(loaded) && loaded.length > 0) {
          setReviewTransactions(loaded);
          return;
        }

        const preseededList: AccountingTransaction[] = [
          {
            advNo: 'ADV-2026-002',
            clrNo: 'CLR-2026-002',
            employee: 'สุดา พงษ์เจริญ',
            project: 'โครงการปรับปรุงระบบไฟฟ้า',
            category: 'ค่าอุปกรณ์',
            vendor: 'บริษัท สยาม ไดกิ้น เซลส์ จำกัด',
            taxId: '0105531002345',
            docType: 'Tax Invoice',
            docNo: 'TX-902182',
            docDate: '2026-06-01',
            desc: 'เครื่องแอร์ Daikin 36000 BTU ตัวระบบปรับรักษาสิ่งแวดล้อม',
            qty: 4,
            unit: 'เครื่อง',
            price: 15000,
            lineTotal: 60000,
            subtotal: 60000,
            vatAmount: 4200,
            whtAmount: 1800,
            netAmount: 62400,
            approvedAmount: 62400,
            rejectedAmount: 0,
            transferBank: 'ไทยพาณิชย์',
            transferAccountNo: '123-x-x890-x',
            transferAccountName: 'สุดา พงษ์เจริญ',
            transferDate: '2026-05-18',
            transferTime: '10:30',
            transferRef: 'SCB26051800456',
            ocrScore: 98,
            aiTrustScore: 95
          },
          {
            advNo: 'ADV-2026-006',
            clrNo: 'CLR-2026-006',
            employee: 'วิภา ทองสุข',
            project: 'โครงการซ่อมบำรุงท่อ',
            category: 'ค่าอุปกรณ์',
            vendor: 'พัทยา โฮมเซ็นเตอร์ วัสดุก่อสร้าง',
            taxId: '0205559012345',
            docType: 'Receipt',
            docNo: 'RC-50912',
            docDate: '2026-04-03',
            desc: 'ท่อ PVC 4นิ้ว พร้อมข้อต่อท่อหนาเกรดก่อสร้างโยธา',
            qty: 20,
            unit: 'ท่อน',
            price: 450,
            lineTotal: 9000,
            subtotal: 9000,
            vatAmount: 630,
            whtAmount: 0,
            netAmount: 9630,
            approvedAmount: 9630,
            rejectedAmount: 0,
            transferBank: 'กรุงไทย',
            transferAccountNo: '345-x-x012-x',
            transferAccountName: 'วิภา ทองสุข',
            transferDate: '2026-03-15',
            transferTime: '14:25',
            transferRef: 'KTB26031500654',
            ocrScore: 92,
            aiTrustScore: 90
          }
        ];
        setReviewTransactions(preseededList);
        fetch('/api/store/review-transactions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(preseededList)
        });
      })
      .catch(() => {
        console.warn('Could not read review transactions for reports page, defaulting to empty');
      });
  }, []);

  // Excel CSV Exporter logic for full 10-tier structured dataset
  const exportAccountingCSV = () => {
    const headers = [
      'ADV No', 'CLR No', 'Employee Name', 'Department', 'Project Name', 
      'Category', 'Vendor Name', 'Tax ID', 'Document Type', 'Document No', 
      'Document Date', 'Item Description', 'Qty', 'Unit', 'Unit Price', 
      'Pre-VAT Total', 'VAT (%)', 'VAT Amount', 'WHT (%)', 'WHT Amount', 
      'Net Amount', 'Approved Amount', 'Rejected Amount', 'Reject Reason/Notes', 
      'Transfer Bank', 'Transfer Account Name', 'Transfer Ref No', 'Transfer Date', 
      'OCR Score (%)', 'AI Trust Score (%)', 'Ledger Status'
    ];

    const rows = reviewTransactions.map(t => [
      t.advNo, 
      t.clrNo, 
      `"${t.employee}"`, 
      '"สำนักงาน"',
      `"${t.project}"`,
      `"${t.category}"`,
      `"${t.vendor}"`,
      `"${t.taxId}"`,
      `"${t.docType}"`,
      `"${t.docNo}"`,
      t.docDate,
      `"${t.desc}"`,
      t.qty,
      `"${t.unit}"`,
      t.price,
      t.lineTotal,
      '7%',
      t.vatAmount,
      '3%',
      t.whtAmount,
      t.netAmount,
      t.approvedAmount,
      t.rejectedAmount,
      `"${t.rejectReason || ''}"`,
      `"${t.transferBank || ''}"`,
      `"${t.transferAccountName || ''}"`,
      `"${t.transferRef || ''}"`,
      t.transferDate || '',
      t.ocrScore,
      t.aiTrustScore,
      'Approved & Closed'
    ]);

    const csvBody = "\uFEFF" + [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvBody], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `AccountingReview_Ledger_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast('🎉 ระบบทำการสร้างรายงานสารเข้าระบบและส่งออก Accounting CSV เรียบร้อย!');
  };

  return (
    <>
      <div className="ph">
        <div>
          <h2>Reports & Analytics</h2>
          <p>รายงานเชิงบริหาร และศูนย์รวมการดึงข้อมูลภาษีปิดสมุดรายวันทั่วไป (Symmetric ERP Interface)</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-o btn-sm" onClick={() => { window.location.href = '/api/export/accounting-ledger.csv'; }}>
            <FileSpreadsheet size={14} style={{ marginRight: '4px', display: 'inline' }} /> Export Accounting Excel (CSV)
          </button>
          <button className="btn btn-o btn-sm" onClick={() => { window.location.href = '/api/export/advances.csv'; }}>? CSV Summary</button>
          <button className="btn btn-o btn-sm" onClick={() => { window.location.href = '/api/export/app-backup.json'; }}><Download size={14} /> Backup JSON</button>
          <button className="btn btn-o btn-sm" onClick={() => window.print()}>?? Audit PDF</button>
        </div>
      </div>

      <div className="g3" style={{ marginBottom: '16px' }}>
        <div className="card">
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--p)' }}>📊 ภาพรวมระบบ</div>
          {[
            ['รายการทั้งหมด', advances.length],
            ['เงินเบิกสะสม', '฿' + fmtM(s.totAdv)],
            ['เงินค้างเคลียร์', '฿' + fmtM(s.totPend)],
            ['เงินเกินกำหนด', '฿' + fmtM(s.totOver)],
            ['อัตราเคลียร์', s.clrRate.toFixed(1) + '%']
          ].map(([l, v]) => (
            <div key={l as string} className="flb" style={{ padding: '6px 0', borderBottom: '1px solid var(--bdr)' }}>
              <span style={{ fontSize: '12px', color: 'var(--ts)' }}>{l as string}</span>
              <span style={{ fontSize: '13px', fontWeight: 700 }}>{v as React.ReactNode}</span>
            </div>
          ))}
        </div>
        
        <div className="card">
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--p)' }}>📦 สถานะรายการ</div>
          {Object.entries(SM).map(([k, v]) => {
            const n = advances.filter(r => r.status === k).length;
            return (
              <div key={k} className="flb" style={{ padding: '5px 0', borderBottom: '1px solid var(--bdr)' }}>
                <span className={`badge ${v.c}`}>{v.l}</span>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>{n}</span>
              </div>
            );
          })}
        </div>
        
        <div className="card">
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--p)' }}>📅 Aging Analysis</div>
          {Object.entries(s.aging).map(([range, items]) => {
            const tot = items.reduce((a, x) => a + (x.appAmount - x.clrAmount), 0);
            return (
               <div key={range} className="flb" style={{ padding: '5px 0', borderBottom: '1px solid var(--bdr)' }}>
                <span style={{ fontSize: '12px', color: 'var(--ts)' }}>{range} วัน</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>{items.length} รายการ</div>
                  <div style={{ fontSize: '11px', color: 'var(--tm)' }}>฿{fmtM(tot)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="wr">
        <div className="card">
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: 'var(--p)' }}>👤 Top Advance Users</div>
          {s.topE.map(([, ev], i) => (
            <div key={i} className="ri">
              <div className="ri-rk">{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12.5px', fontWeight: 600 }}>{ev.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--ts)' }}>{ev.dept}</div>
                <div className="rb">
                  <div className="rb-f" style={{ width: `${ev.amt / maxE * 100}%`, background: 'var(--p)' }}></div>
                </div>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--p)', flexShrink: 0 }}>฿{fmtM(ev.amt)}</div>
            </div>
          ))}
        </div>
        
        <div className="card">
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: 'var(--p)' }}>🏗 Top Spending Projects</div>
          {s.topP.map(([, pv], i) => (
            <div key={i} className="ri">
              <div className="ri-rk">{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12.5px', fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{pv.name}</div>
                <div className="rb">
                  <div className="rb-f" style={{ width: `${pv.amt / maxP * 100}%`, background: '#3b82f6' }}></div>
                </div>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#3b82f6', flexShrink: 0 }}>฿{fmtM(pv.amt)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: 'var(--p)' }}>📋 Expense Category Breakdown</div>
        <div className="bars">
          {Object.entries(s.catT).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
            <div key={cat} className="bar-r">
              <div className="bar-lb">{cat}</div>
              <div className="bar-tr" style={{ height: '10px' }}>
                <div className="bar-f" style={{ width: `${val / maxC * 100}%`, background: catColors[cat] || '#6b7280' }}></div>
              </div>
              <div className="bar-v">฿{fmtM(val)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* NEW SECTION: ACCOUNTING EXPORT REPORT LEDGER VIEW */}
      <div className="card" style={{ background: '#fff', border: '1.5px solid var(--bdr)' }}>
        <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', borderBottom: '1.5px solid var(--bdr)', paddingBottom: '10px', marginBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--p)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={16} /> Accounting Export Report (รายงานตรวจสอบและปิดยอดทางบัญชี)
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--ts)', marginTop: '2px' }}>
              บัญชีส่วนกลางรวบรวมข้อมูลใบเสนอเบิกเงินทดรองจ่าย, ทรานแซกชั่นการโอนเงินกองคลัง, บิลใบเสร็จใบกำกับภาษี (VAT) และการหัก ณ ที่จ่าย (WHT)
            </p>
          </div>
          <button className="btn btn-sm" style={{ background: 'var(--p)', color: '#fff', fontWeight: 'bold' }} onClick={() => { window.location.href = '/api/export/accounting-ledger.csv'; }}>
            <Download size={12} style={{ marginRight: '4px', display: 'inline' }} /> Download Excel (CSV)
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '950px', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--sh)', color: 'var(--p)' }}>
                <th style={{ padding: '8px', border: '1px solid var(--bdr)' }}>ADV No</th>
                <th style={{ padding: '8px', border: '1px solid var(--bdr)' }}>CLR No</th>
                <th style={{ padding: '8px', border: '1px solid var(--bdr)' }}>พนักงาน</th>
                <th style={{ padding: '8px', border: '1px solid var(--bdr)' }}>ผู้ขายสินค้า / ซัพพลายเออร์</th>
                <th style={{ padding: '8px', border: '1px solid var(--bdr)' }}>Doc No / วันที่</th>
                <th style={{ padding: '8px', border: '1px solid var(--bdr)' }}>รายการสินค้าหรือค่าบริการ</th>
                <th style={{ padding: '8px', border: '1px solid var(--bdr)', textAlign: 'right' }}>ราคาก่อนแวต</th>
                <th style={{ padding: '8px', border: '1px solid var(--bdr)', textAlign: 'center' }}>VAT</th>
                <th style={{ padding: '8px', border: '1px solid var(--bdr)', textAlign: 'center' }}>WHT</th>
                <th style={{ padding: '8px', border: '1px solid var(--bdr)', textAlign: 'right' }}>สุทธิรวม</th>
                <th style={{ padding: '8px', border: '1px solid var(--bdr)', textAlign: 'center' }}>ลงบัญชีปิดสมุด</th>
              </tr>
            </thead>
            <tbody>
              {reviewTransactions.map((tx, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : 'var(--sh)' }}>
                  <td style={{ padding: '8px', border: '1px solid var(--bdr)', fontWeight: 'bold', fontFamily: 'monospace' }}>{tx.advNo}</td>
                  <td style={{ padding: '8px', border: '1px solid var(--bdr)', fontFamily: 'monospace', color: 'var(--p)' }}>{tx.clrNo}</td>
                  <td style={{ padding: '8px', border: '1px solid var(--bdr)' }}>
                    <strong>{tx.employee}</strong><br/>
                    <span style={{ fontSize: '10px', color: 'var(--ts)' }}>{tx.project}</span>
                  </td>
                  <td style={{ padding: '8px', border: '1px solid var(--bdr)' }}>
                    <strong>{tx.vendor}</strong><br/>
                    <span style={{ fontSize: '10px', color: 'var(--ts)' }}>Tax ID: {tx.taxId}</span>
                  </td>
                  <td style={{ padding: '8px', border: '1px solid var(--bdr)', fontFamily: 'monospace' }}>
                    {tx.docNo}<br/>
                    <span style={{ fontSize: '10px', color: 'var(--ts)' }}>{tx.docDate}</span>
                  </td>
                  <td style={{ padding: '8px', border: '1px solid var(--bdr)' }}>
                    {tx.desc}<br/>
                    <span style={{ fontSize: '10px', color: 'var(--ts)' }}>{tx.qty} {tx.unit} x ฿{fmt(tx.price)}</span>
                  </td>
                  <td style={{ padding: '8px', border: '1px solid var(--bdr)', textAlign: 'right', fontFamily: 'monospace' }}>฿{fmt(tx.lineTotal)}</td>
                  <td style={{ padding: '8px', border: '1px solid var(--bdr)', textAlign: 'center', fontFamily: 'monospace' }}>7%</td>
                  <td style={{ padding: '8px', border: '1px solid var(--bdr)', textAlign: 'center', fontFamily: 'monospace' }}>{tx.whtAmount > 0 ? '3%' : '0%'}</td>
                  <td style={{ padding: '8px', border: '1px solid var(--bdr)', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--p)' }}>฿{fmt(tx.netAmount)}</td>
                  <td style={{ padding: '8px', border: '1px solid var(--bdr)', textAlign: 'center' }}>
                    <span className="badge bk" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '10px', fontWeight: 'bold' }}>
                      <CheckCircle size={10} /> CLOSED
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
