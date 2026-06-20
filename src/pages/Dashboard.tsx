import React from 'react';
import { useApp } from '../context/AppContext';
import { getStats } from '../lib/stats';
import { fmt, fmtM, Ip, overdue } from '../lib/utils';

export const Dashboard = () => {
  const { advances, setPage, masterUsers, masterProjects } = useApp();
  const s = getStats(advances, masterProjects);
  
  const catColors: Record<string, string> = { 'ค่าแรง': '#4E958D', 'ค่าวัสดุ': '#3b82f6', 'ค่าเดินทาง': '#f59e0b', 'ค่าอุปกรณ์': '#8b5cf6', 'ค่าเช่า': '#ef4444', 'อื่นๆ': '#6b7280' };
  const maxC = Math.max(...Object.values(s.catT).length ? Object.values(s.catT) : [0], 1);
  const maxP = s.topP[0] ? s.topP[0][1].amt : 1;
  const maxE = s.topE[0] ? s.topE[0][1].amt : 1;

  const btls = [
    { l: 'รออนุมัติ', n: advances.filter(r => r.status === 'PENDING_APPROVAL').length, c: '#f59e0b' },
    { l: 'รอโอน', n: advances.filter(r => r.status === 'WAITING_TRANSFER').length, c: '#3b82f6' },
    { l: 'รอเคลียร์', n: advances.filter(r => r.status === 'WAITING_CLEARANCE').length, c: '#8b5cf6' },
    { l: 'ปิดยอด', n: s.closed, c: '#10b981' },
    { l: 'ไม่อนุมัติ', n: s.rejected, c: '#ef4444' }
  ];
  const maxB = Math.max(...btls.map(b => b.n), 1);

  const agC: Record<string, string> = { '0-30': '#10b981', '31-60': '#f59e0b', '61-90': '#ef4444', '90+': '#7f1d1d' };
  const insights = [
    { i: '💡', l: 'AI Insight', t: `รายการของ ${s.topE[0] ? s.topE[0][1].name : '–'} มียอดค้างสูงสุด ควรติดตามเร่งด่วน` },
    { i: '📊', l: 'Cost Saving', t: `หมวด${Object.entries(s.catT).sort((a, b) => b[1] - a[1])[0]?.[0] || 'ค่าวัสดุ'} สัดส่วนสูงสุด — เจรจาซัพพลายเออร์เพื่อลดต้นทุน 10-15%` },
    { i: '⚠️', l: 'Risk Alert', t: `${advances.filter(r => overdue(r)).length} รายการเกินกำหนดชำระ รวม ฿${fmt(s.totOver)}` },
  ];

  return (
    <>
      <div className="ph">
        <div>
          <h2>Executive Dashboard</h2>
          <p>ข้อมูล ณ 17 มิ.ย. 2569 · {advances.length} รายการ <span className="sl" onClick={() => setPage('datacenter')}>→ ดูรายการทั้งหมด</span></p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-o btn-sm" onClick={() => { window.location.href = '/api/export/advances.csv'; }}>? Export CSV</button>
        </div>
      </div>

      <div className="kpi-g">
        <div className="kpi" onClick={() => setPage('datacenter', { statusF: '' })}>
          <div className="kpi-hd"><div className="kpi-lb">เงินเบิกสะสม (ทั้งหมด)</div><Ip t="SUM approvedAmount ทุกสถานะยกเว้น REJECTED" /></div>
          <div className="kpi-v nm">{fmtM(s.totAdv)}</div><div className="kpi-s">฿{fmt(s.totAdv)} · {s.total} รายการ</div>
        </div>
        <div className="kpi" style={{ borderColor: '#dbeafe' }} onClick={() => setPage('datacenter', { statusF: 'WAITING_CLEARANCE' })}>
          <div className="kpi-hd"><div className="kpi-lb">เงินค้างเคลียร์</div><Ip t="SUM ยอดที่ยังไม่เคลียร์ สถานะ WAITING_CLEARANCE" /></div>
          <div className="kpi-v nm" style={{ color: '#3b82f6' }}>{fmtM(s.totPend)}</div><div className="kpi-s">{advances.filter(r => ['WAITING_CLEARANCE','WAITING_TRANSFER','PENDING_APPROVAL'].includes(r.status)).length} รายการ active</div>
        </div>
        <div className="kpi" style={{ borderColor: '#fee2e2' }} onClick={() => setPage('clearance')}>
          <div className="kpi-hd"><div className="kpi-lb">เงินเกินกำหนด</div><Ip t="dueDate < วันนี้ · สถานะ WAITING_CLEARANCE เท่านั้น" /></div>
          <div className="kpi-v nm" style={{ color: '#ef4444' }}>{fmtM(s.totOver)}</div><div className="kpi-s">{advances.filter(r => overdue(r)).length} รายการ ⚠ เร่งด่วน</div>
        </div>
        <div className="kpi" style={{ borderColor: '#ede9fe' }}>
          <div className="kpi-hd"><div className="kpi-lb">พนักงานเสี่ยง</div><Ip t="COUNT DISTINCT empId ที่มีรายการเกินกำหนด" /></div>
          <div className="kpi-v" style={{ color: '#8b5cf6' }}>{s.riskE}</div><div className="kpi-s">คน มีรายการเกินกำหนด</div>
        </div>
        <div className="kpi" style={{ borderColor: '#fef3c7' }}>
          <div className="kpi-hd"><div className="kpi-lb">โครงการเสี่ยง</div><Ip t="COUNT DISTINCT projectId ที่มีรายการเกินกำหนด" /></div>
          <div className="kpi-v" style={{ color: '#f59e0b' }}>{s.riskP}</div><div className="kpi-s">โครงการ</div>
        </div>
      </div>

      <div className="wr">
        <div className="card">
          <div className="wt">🗺 Cash Exposure Map <Ip t="Heatmap ความเสี่ยงแต่ละพนักงาน/โครงการ — ความเข้มสีแสดงระดับยอดค้าง" /></div>
          <div className="exp-g">
            {masterUsers.filter(u => u.role !== 'approver').map(u => {
              const out = advances.filter(r => r.empId === u.id && ['WAITING_CLEARANCE','WAITING_TRANSFER'].includes(r.status)).reduce((a, r) => a + (r.appAmount - r.clrAmount), 0);
              if (!out) return null;
              const int = Math.min(out / 80000, 1);
              return <div key={u.id} className="exp-c" style={{ background: `rgba(78,149,141,${.15 + int * .75})` }} onClick={() => setPage('datacenter')} title={`${u.name}: ฿${fmt(out)}`}><div className="exp-n">{u.name.substring(0,6)}</div><div className="exp-a">{fmtM(out)}</div></div>;
            })}
            {masterProjects.map(p => {
              const out = advances.filter(r => r.pIds.includes(p.id) && ['WAITING_CLEARANCE','WAITING_TRANSFER'].includes(r.status)).reduce((a, r) => a + (r.appAmount - r.clrAmount), 0);
              if (!out) return null;
              const int = Math.min(out / 120000, 1);
              return <div key={p.id} className="exp-c" style={{ background: `rgba(59,130,246,${.15 + int * .75})` }} onClick={() => setPage('datacenter')} title={`${p.name}: ฿${fmt(out)}`}><div className="exp-n">{p.name.substring(0,6)}</div><div className="exp-a">{fmtM(out)}</div></div>;
            })}
          </div>
          <div style={{ marginTop: '8px', fontSize: '10.5px', color: 'var(--tm)' }}>🟢 พนักงาน &nbsp; 🔵 โครงการ &nbsp; ความเข้มสีแสดงระดับความเสี่ยง</div>
        </div>

        <div className="card">
          <div className="wt">⚡ Cash Flow Risk Center <Ip t="สรุปสถานะการไหลของเงินทั้งระบบ · แต่ละขั้นตอน Workflow" /></div>
          <div className="bars">
            {btls.map(b => (
              <div key={b.l} className="bar-r">
                <div className="bar-lb">{b.l}</div>
                <div className="bar-tr"><div className="bar-f" style={{ width: `${b.n / maxB * 100}%`, background: b.c }}></div></div>
                <div className="bar-v">{b.n} รายการ</div>
              </div>
            ))}
          </div>
          {btls.filter(b => b.n > 0).sort((a, b) => b.n - a.n).slice(0, 1).map(b => (
            <div key={b.l} className="ins" style={{ marginTop: '12px' }}>
              <div className="ins-i" style={{ background: b.c }}>⚡</div>
              <div><div className="ins-l">Workflow Bottleneck</div><div className="ins-t">ขั้นตอน "<b>{b.l}</b>" ค้าง {b.n} รายการ — มากที่สุดในระบบ</div></div>
            </div>
          ))}
        </div>
      </div>

      <div className="wr">
        <div className="card">
          <div className="wt">📅 Aging Report <Ip t="อายุรายการค้างเคลียร์ — ยิ่งนานยิ่งเสี่ยง" /></div>
          <div className="ag-g">
            {Object.entries(s.aging).map(([r, items]) => {
              const tot = items.reduce((a, x) => a + (x.appAmount - x.clrAmount), 0);
              return (
                <div key={r} className="ag-c">
                  <div className="ag-r">{r} วัน</div>
                  <div className="ag-n" style={{ color: agC[r] }}>{items.length}</div>
                  <div className="ag-a">{fmtM(tot)}</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: '8px', fontSize: '10.5px', color: 'var(--tm)' }}>📌 90+ วัน ต้องดำเนินการด่วนที่สุด</div>
        </div>
        <div className="card">
          <div className="wt">✅ Clearance Performance <Ip t="อัตราเคลียร์สำเร็จเทียบกับรายการทั้งหมด" /></div>
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: '46px', fontWeight: 900, color: 'var(--p)' }}>{s.clrRate.toFixed(0)}%</div>
            <div style={{ fontSize: '12px', color: 'var(--ts)' }}>อัตราเคลียร์สำเร็จ</div>
            <div style={{ maxWidth: '180px', margin: '10px auto' }}><div className="bar-tr" style={{ height: '10px' }}><div className="bar-f" style={{ width: `${s.clrRate}%`, background: 'var(--p)' }}></div></div></div>
            <div className="g2" style={{ maxWidth: '180px', margin: '0 auto' }}>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: '18px', fontWeight: 900, color: '#10b981' }}>{s.closed}</div><div style={{ fontSize: '11px', color: 'var(--ts)' }}>ปิดยอดแล้ว</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: '18px', fontWeight: 900, color: '#8b5cf6' }}>{s.total - s.closed - s.rejected}</div><div style={{ fontSize: '11px', color: 'var(--ts)' }}>รอดำเนินการ</div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="wr">
        <div className="card">
          <div className="wt"><span style={{ color: '#ef4444' }}>🏗</span> Top Risk Projects <Ip t="โครงการที่มียอดค้างเคลียร์สูงสุด" /></div>
          {s.topP.length ? s.topP.map(([, pv], i) => (
            <div key={i} className="ri">
              <div className="ri-rk">{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12.5px', fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{pv.name}</div>
                <div className="rb"><div className="rb-f" style={{ width: `${pv.amt / maxP * 100}%`, background: '#ef4444' }}></div></div>
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#ef4444', flexShrink: 0 }}>฿{fmtM(pv.amt)}</div>
            </div>
          )) : <div style={{ fontSize: '12px', color: 'var(--tm)' }}>ไม่มีรายการค้าง</div>}
        </div>
        <div className="card">
          <div className="wt"><span style={{ color: '#ef4444' }}>👤</span> Top Risk Employees <Ip t="พนักงานที่มียอดค้างชำระสูงสุด" /></div>
          {s.topE.length ? s.topE.map(([, ev], i) => (
            <div key={i} className="ri">
              <div className="ri-rk">{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12.5px', fontWeight: 600 }}>{ev.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--ts)' }}>{ev.dept}</div>
                <div className="rb"><div className="rb-f" style={{ width: `${ev.amt / maxE * 100}%`, background: '#ef4444' }}></div></div>
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#ef4444', flexShrink: 0 }}>฿{fmtM(ev.amt)}</div>
            </div>
          )) : <div style={{ fontSize: '12px', color: 'var(--tm)' }}>ไม่มีรายการค้าง</div>}
        </div>
      </div>

      <div className="wr">
        <div className="card">
          <div className="wt">📊 Expense Category Analysis <Ip t="สัดส่วนยอดเบิกแยกตามหมวดค่าใช้จ่าย" /></div>
          <div className="bars">
             {Object.entries(s.catT).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
              <div key={cat} className="bar-r">
                <div className="bar-lb">{cat}</div>
                <div className="bar-tr"><div className="bar-f" style={{ width: `${val / maxC * 100}%`, background: catColors[cat] || '#6b7280' }}></div></div>
                <div className="bar-v">฿{fmtM(val)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="wt">🤖 AI Cost Saving & Executive Insight <Ip t="คำแนะนำจาก AI คำนวณจากข้อมูลจริงในระบบ" /></div>
          {insights.map((ins, i) => (
            <div key={i} className="ins">
              <div className="ins-i">{ins.i}</div>
              <div><div className="ins-l">{ins.l}</div><div className="ins-t">{ins.t}</div></div>
            </div>
          ))}
          <button className="btn btn-o btn-sm" style={{ width: '100%', marginTop: '8px' }} onClick={() => setPage('reports')}>ดูรายงานเต็ม →</button>
        </div>
      </div>
    </>
  );
};
