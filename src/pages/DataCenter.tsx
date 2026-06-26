import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { overdue, fmtD, fmt, SBadge, UserAvt } from '../lib/utils';
import { AdvanceDetailView } from '../components/AdvanceDetailView';
import { SmartFilter } from '../components/SmartFilter';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export const DataCenter = () => {
  const { advances, pageExtra, setPage, openDrawer, masterUsers, masterProjects, masterCategories } = useApp();
  const [view, setView] = useState('table');
  const [fSearch, setFSearch] = useState('');
  const [fStatus, setFStatus] = useState(pageExtra?.statusF !== undefined ? pageExtra.statusF : '');
  const [fEmp, setFEmp] = useState(pageExtra?.empIdF !== undefined ? pageExtra.empIdF : '');
  const [fProj, setFProj] = useState(pageExtra?.pIdF !== undefined ? pageExtra.pIdF : '');
  const [fCat, setFCat] = useState('');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const [calY, setCalY] = useState(2026);
  const [calM, setCalM] = useState(6);

  useEffect(() => {
    if (pageExtra?.statusF !== undefined) setFStatus(pageExtra.statusF);
    if (pageExtra?.pIdF !== undefined) setFProj(pageExtra.pIdF);
    if (pageExtra?.empIdF !== undefined) setFEmp(pageExtra.empIdF);
  }, [pageExtra]);

  const clearF = () => { setFSearch(''); setFStatus(''); setFEmp(''); setFProj(''); setFCat(''); };

  const filtered = advances.filter(r => {
    if (!r) return false;
    const s = (fSearch || '').toLowerCase();
    const ms = !s || 
               (r.id || '').toLowerCase().includes(s) || 
               (r.empName || '').toLowerCase().includes(s) || 
               (r.pName || '').toLowerCase().includes(s) || 
               (r.desc || '').toLowerCase().includes(s);
    const mst = !fStatus || (fStatus === 'OVERDUE' ? overdue(r) : (fStatus === 'WAITING_CLEARANCE' ? ['WAITING_CLEARANCE', 'CLEARED_BY_EMPLOYEE', 'PARTIAL_CLEARANCE', 'WAITING_PHYSICAL_DOCS'].includes(r.status) : r.status === fStatus));
    const me = !fEmp || r.empId === fEmp;
    const mp = !fProj || (Array.isArray(r.pIds) && r.pIds.includes(fProj));
    const mc = !fCat || r.catId === fCat;
    return ms && mst && me && mp && mc;
  });

  const handleOpenAdv = (id: string) => {
    openDrawer(
      <AdvanceDetailView.Header id={id} />,
      <AdvanceDetailView.Body id={id} />,
      <AdvanceDetailView.Footer id={id} />
    );
  };

  // Executive Dashboard Data
  const execData = useMemo(() => {
    const today = new Date();
    let totalRequested = 0, totalOutstanding = 0, totalOverdue = 0, totalCleared = 0;
    const pendingApproval: any[] = [];
    const overdueList: any[] = [];
    const projMap = new Map<string, number>();
    const empMap = new Map<string, number>();
    const ageMap = { safe: 0, s1: 0, s2: 0, s3: 0 };
    const workflows = { pending: 0, transfer: 0, clearance: 0, check: 0 };
    const cats: Record<string, number> = {};

    advances.forEach(r => {
      if (!r) return;
      const amt = Number(r.amount) || 0;
      totalRequested += amt;
      const clr = Number(r.clrAmount) || 0;
      totalCleared += clr;
      const out = amt - clr;
      totalOutstanding += out;
      
      const dueDate = r.dueDate ? new Date(r.dueDate) : new Date(0);
      const isOverdue = out > 0 && today > dueDate;
      if (isOverdue) {
        totalOverdue += out;
        overdueList.push(r);
      }

      if (r.status === 'PENDING_APPROVAL') pendingApproval.push(r);
      if (out > 0) {
        const pName = r.pName || 'Unassigned';
        const empName = r.empName || 'Anonymous';
        projMap.set(pName, (projMap.get(pName) || 0) + out);
        empMap.set(empName, (empMap.get(empName) || 0) + out);
        
        const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) ageMap.safe += out;
        else if (diffDays <= 7) ageMap.s1 += out;
        else if (diffDays <= 15) ageMap.s2 += out;
        else ageMap.s3 += out;
      }
      if (r.status === 'PENDING_APPROVAL') workflows.pending++;
      else if (r.status === 'WAITING_TRANSFER') workflows.transfer++;
      else if (r.status === 'WAITING_CLEARANCE') workflows.clearance++;
      else if (r.status === 'CLOSED') workflows.check++;

      // Simplified categories
      const cName = r.catName || 'อื่นๆ';
      cats[cName] = (cats[cName] || 0) + amt;
    });

    return { totalRequested, totalOutstanding, totalOverdue, totalCleared, pendingApproval, overdueList, projMap, empMap, ageMap, workflows, cats };
  }, [advances]);

  const renderDashboard = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '30px' }}>
      <SmartFilter 
        searchQuery={fSearch}
        onSearchChange={setFSearch}
        statusFilter={fStatus}
        onStatusChange={setFStatus}
        projectFilter={fProj}
        onProjectChange={setFProj}
        empFilter={fEmp}
        onEmpChange={setFEmp}
        onClear={clearF}
        placeholder="ค้นหา เลขที่ / ชื่อ / โครงการ..."
      />
      {/* Tier 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) 2fr', gap: '16px' }}>
        {[
          { l: 'ยอดตั้งเบิกสะสม', v: fmt(execData.totalRequested), c: '#3b82f6' },
          { l: 'ยอดคงค้างดำเนินการ', v: fmt(execData.totalOutstanding), c: '#f59e0b' },
          { l: 'เลยกำหนดส่งใช้!', v: fmt(execData.totalOverdue), c: '#ef4444' },
          { l: 'เคลียร์ยอดสะสม', v: fmt(execData.totalCleared), c: '#10b981' }
        ].map(item => (
          <div key={item.l} style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>{item.l}</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: item.c }}>฿{item.v}</div>
          </div>
        ))}
        <div style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>รายการด่วน</div>
          <div style={{ color: '#3b82f6' }}>รออนุมัติ: {execData.pendingApproval.length} รายการ</div>
          <div style={{ color: '#ef4444' }}>เกินกำหนด: {execData.overdueList.length} รายการ</div>
        </div>
      </div>
      
      {/* Tier 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
           <div style={{ fontSize: '14px', marginBottom: '10px' }}>Aging Report (เงินจมตามอายุ)</div>
           <ResponsiveContainer width="100%" height={150}>
            <BarChart layout="vertical" data={[{l: 'ปลอดภัย', v: execData.ageMap.safe, f: '#10b981'}, {l: '1-7 วัน', v: execData.ageMap.s1, f: '#f59e0b'}, {l: '8-15 วัน', v: execData.ageMap.s2, f: '#f97316'}, {l: '>15 วัน', v: execData.ageMap.s3, f: '#ef4444'}]}>
              <XAxis type="number" hide /><YAxis dataKey="l" type="category" width={60} style={{ fontSize: '10px' }} /><Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="v" radius={[0, 4, 4, 0]}>{[{l: 'ปลอดภัย', v: execData.ageMap.safe, f: '#10b981'}, {l: '1-7 วัน', v: execData.ageMap.s1, f: '#f59e0b'}, {l: '8-15 วัน', v: execData.ageMap.s2, f: '#f97316'}, {l: '>15 วัน', v: execData.ageMap.s3, f: '#ef4444'}].map((e,i) => <Cell key={i} fill={e.f} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Top Risk Projects</div>
            {Array.from(execData.projMap.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n, v]) => <div key={n} style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>{n}</span><span>฿{fmt(v)}</span></div>)}
          </div>
          <div style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Top Risk Employees</div>
            {Array.from(execData.empMap.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n, v]) => <div key={n} style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>{n}</span><span>฿{fmt(v)}</span></div>)}
          </div>
        </div>
      </div>

       {/* Tier 3 */}
       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
           <div style={{ fontSize: '14px', marginBottom: '10px' }}>คอขวดระบบงาน</div>
           <div style={{ display: 'flex', justifyContent: 'space-between' }}>
             {[ {l: 'รออนุมัติ', v: execData.workflows.pending}, {l: 'รอโอน', v: execData.workflows.transfer}, {l: 'รอเคลียร์', v: execData.workflows.clearance}, {l: 'ตรวจสอบ', v: execData.workflows.check}].map(st => (
                 <div key={st.l} style={{ textAlign: 'center' }}><div style={{ fontSize: '18px', fontWeight: 'bold' }}>{st.v}</div><div style={{ fontSize: '11px', color: '#64748b' }}>{st.l}</div></div>
             ))}
           </div>
        </div>
        <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
           <div style={{ fontSize: '14px', marginBottom: '10px' }}>ยอดจ่ายตามหมวดหมู่</div>
           <ResponsiveContainer width="100%" height={100}>
            <BarChart layout="vertical" data={Object.entries(execData.cats).map(([n, v]) => ({ n, v }))}>
              <XAxis type="number" hide /><YAxis dataKey="n" type="category" width={80} style={{ fontSize: '10px' }} /><Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="v" fill="#64748b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderTable = () => {
    const cleanText = (val: any): string => {
      if (val === undefined || val === null) return '–';
      return String(val).replace(/,/g, ' ').replace(/;/g, ' ').replace(/\|/g, ' ').trim();
    };

    const cleanNum = (val: any): string => {
      if (val === undefined || val === null) return '0';
      const num = Number(val) || 0;
      return String(Math.round(num));
    };

    const cleanAccountNo = (val: any): string => {
      if (val === undefined || val === null) return '';
      return String(val).replace(/[-\s]/g, '');
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

    // Flat Map to get one clearing transaction per line
    const rows: any[] = [];
    filtered.forEach(r => {
      const totalRequested = r.amount;
      const totalCleared = r.clrAmount || 0;
      const outstandingBalance = Math.max(0, totalRequested - totalCleared);
      const displayStatus = outstandingBalance > 0 ? 'รอเคลียร์ยอด' : r.status;

      const pay = r.pay || {};
      const sourceBank = pay.senderBank || 'ธนาคารไทยพาณิชย์ (SCB)';
      const sourceAccName = pay.senderName || 'บมจ. เจนเซรัล แฟคเตอร์ริ่ง (กองกลางบริษัท)';
      const sourceAccNo = cleanAccountNo(pay.senderAccountNo || '0230128490');

      const recipientBank = r.payeeBank || 'ธนาคารกสิกรไทย (KBANK)';
      const recipientAccNo = cleanAccountNo(r.payeeBankNo || '0429384910');

      // Check all receipts in r.receipts and r.clrs
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
              rows.push({
                uniqKey: `${r.id}-rc-${rc.id}-${idx}`,
                advanceId: r.id,
                // Part 1: Advance Initial (11 columns)
                status: displayStatus,
                dueDate: r.dueDate,
                empName: r.empName,
                pName: r.pName,
                reqDate: r.reqDate,
                sourceBank,
                sourceAccName,
                sourceAccNo,
                recipientBank,
                recipientAccNo,
                // Part 2: Clearing items (13 columns)
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
                // Part 3: Financial Summary (3 columns)
                totalRequested,
                totalCleared,
                outstandingBalance
              });
            });
          } else {
            rows.push({
              uniqKey: `${r.id}-rc-${rc.id}-flat`,
              advanceId: r.id,
              // Part 1: Advance Initial (11 columns)
              status: displayStatus,
              dueDate: r.dueDate,
              empName: r.empName,
              pName: r.pName,
              reqDate: r.reqDate,
              sourceBank,
              sourceAccName,
              sourceAccNo,
              recipientBank,
              recipientAccNo,
              // Part 2: Clearing items (13 columns)
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
              // Part 3: Financial Summary (3 columns)
              totalRequested,
              totalCleared,
              outstandingBalance
            });
          }
        });
      } else if (r.clrs && r.clrs.length > 0) {
        // Fallback for clearances with no receipts structure
        r.clrs.forEach((clr: any) => {
          rows.push({
            uniqKey: `${r.id}-clr-${clr.id}-fallback`,
            advanceId: r.id,
            // Part 1
            status: displayStatus,
            dueDate: r.dueDate,
            empName: r.empName,
            pName: r.pName,
            reqDate: r.reqDate,
            sourceBank,
            sourceAccName,
            sourceAccNo,
            recipientBank,
            recipientAccNo,
            // Part 2
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
            // Part 3
            totalRequested,
            totalCleared,
            outstandingBalance
          });
        });
      } else {
        rows.push({
          uniqKey: `${r.id}-none`,
          advanceId: r.id,
          // Part 1
          status: displayStatus,
          dueDate: r.dueDate,
          empName: r.empName,
          pName: r.pName,
          reqDate: r.reqDate,
          sourceBank,
          sourceAccName,
          sourceAccNo,
          recipientBank,
          recipientAccNo,
          // Part 2 (Blank or empty/default)
          clrNo: '–',
          refAdvNo: '–',
          itemDate: '–',
          vendorName: '–',
          taxId: '–',
          receiptNo: '–',
          invoiceNo: '–',
          itemDescription: '–',
          amountNet: 0,
          vatAmount: 0,
          discountAmount: 0,
          otherCost: 0,
          totalAmount: 0,
          // Part 3
          totalRequested,
          totalCleared,
          outstandingBalance
        });
      }
    });

    // Group rows by advanceId to calculate incremental/sequential running balance chronologically
    const groups: Record<string, any[]> = {};
    rows.forEach(row => {
      const advId = row.advanceId;
      if (!groups[advId]) groups[advId] = [];
      groups[advId].push(row);
    });

    // For each group, sort chronologically and compute running outstanding
    Object.keys(groups).forEach(advId => {
      const groupRows = groups[advId];
      groupRows.sort((a, b) => {
        if (a.clrNo === '–' && b.clrNo !== '–') return -1;
        if (a.clrNo !== '–' && b.clrNo === '–') return 1;
        const dateA = new Date(a.itemDate === '–' ? a.reqDate : a.itemDate).getTime();
        const dateB = new Date(b.itemDate === '–' ? b.reqDate : b.itemDate).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return String(a.clrNo).localeCompare(String(b.clrNo));
      });

      let currentOutstanding = Number(groupRows[0]?.totalRequested) || 0;
      let cumulativeCleared = 0;
      
      groupRows.forEach(row => {
        const transAmount = Number(row.totalAmount) || 0;
        cumulativeCleared += transAmount;
        currentOutstanding -= transAmount;
        row.totalCleared = cumulativeCleared;
        row.outstandingBalance = currentOutstanding;
        row.status = currentOutstanding > 0 ? 'รอเคลียร์ยอด' : row.status;
      });
    });

    const sortedRows = rows.sort((a, b) => new Date(b.reqDate).getTime() - new Date(a.reqDate).getTime());
    const isAllSelected = sortedRows.length > 0 && selectedIds.length === sortedRows.length;
    
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };
    
    const toggleSelectAll = () => {
        if (isAllSelected) setSelectedIds([]);
        else setSelectedIds(sortedRows.map(r => r.uniqKey));
    };

    return (
      <>
        {selectedIds.length > 0 && (
          <div style={{ padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>เลือกแล้ว {selectedIds.length} รายการ:</span>
            <button className="btn btn-sm" style={{ background: '#ef4444', color: '#fff' }} onClick={() => { setSelectedIds([]); }}>🗑 ลบ</button>
            <button className="btn btn-sm" style={{ background: '#3b82f6', color: '#fff' }} onClick={() => {}}>📂 Export</button>
            <button className="btn btn-sm" style={{ background: '#64748b', color: '#fff' }} onClick={() => {}}>🖨 พิมพ์</button>
          </div>
        )}
        <div className="tw" style={{ overflowX: 'auto', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
          <table className="dt" style={{ tableLayout: 'fixed', width: '4285px', minWidth: '4285px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ height: '46px' }}>
                <th style={cellStyle('40px')}><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" checked={isAllSelected} onChange={toggleSelectAll} /></th>
                <th style={cellStyle('130px')}>Status</th>
                <th style={cellStyle('130px')}>ADV_No</th>
                <th style={cellStyle('115px')}>Action</th>
                <th style={cellStyle('110px')}>Request_Date</th>
                <th style={cellStyle('110px')}>Due_Date</th>
                <th style={cellStyle('160px')}>Requester_Name</th>
                <th style={cellStyle('160px')}>Project_Name</th>
                <th style={cellStyle('180px')}>Source_Bank_Name</th>
                <th style={cellStyle('220px')}>Source_Account_Name</th>
                <th style={cellStyle('150px')}>Source_Account_No</th>
                <th style={cellStyle('180px')}>Recipient_Bank_Name</th>
                <th style={cellStyle('150px')}>Recipient_Account_No</th>
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
                <th style={cellStyle('140px', true)}>Total_Requested</th>
                <th style={cellStyle('140px', true)}>Total_Cleared</th>
                <th style={cellStyle('160px', true)}>Outstanding_Balance</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length ? sortedRows.map(row => (
                <tr key={row.uniqKey} onClick={() => handleOpenAdv(row.advanceId)} style={{ cursor: 'pointer', height: '46px' }}>
                  <td style={cellStyle('40px')} onClick={(e) => e.stopPropagation()}><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" checked={selectedIds.includes(row.uniqKey)} onChange={() => toggleSelect(row.uniqKey)} /></td>
                  <td style={cellStyle('130px')}><SBadge status={row.status} date={row.dueDate} /></td>
                  <td style={cellStyle('130px')}><span className="dn">{row.advanceId && row.advanceId.includes('-') ? `${row.advanceId.split('-').slice(0, 2).join('-')}-${String(parseInt(row.advanceId.split('-')[2] || '0', 10)).padStart(3, '0')}` : row.advanceId}</span></td>
                  <td style={cellStyle('115px')} onClick={(e) => e.stopPropagation()}>
                    {(row.status === 'DRAFT' || row.status === 'บันทึกร่าง') ? (
                      <button className="btn btn-xs" style={{ background: '#10b981', color: '#fff', fontWeight: 600, padding: '4px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer' }} onClick={() => setPage('create', { editAdvanceId: row.advanceId })}>
                        ✏️ แก้ไข
                      </button>
                    ) : (
                      <button className="btn btn-xs" style={{ background: '#3b82f6', color: '#fff', fontWeight: 600, padding: '4px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer' }} onClick={() => handleOpenAdv(row.advanceId)}>
                        🔍 รายละเอียด
                      </button>
                    )}
                  </td>
                  <td style={{ ...cellStyle('110px'), fontSize: '12px', color: 'var(--ts)' }}>{fmtD(row.reqDate)}</td>
                  <td style={{ ...cellStyle('110px'), fontSize: '12px', color: 'var(--ts)' }}>{fmtD(row.dueDate)}</td>
                  <td style={cellStyle('160px')}>{cleanText(row.empName)}</td>
                  <td style={cellStyle('160px')}>{cleanText(row.pName)}</td>
                  <td style={cellStyle('180px')}>{cleanText(row.sourceBank)}</td>
                  <td style={cellStyle('220px')}>{cleanText(row.sourceAccName)}</td>
                  <td style={{ ...cellStyle('150px'), fontFamily: 'monospace' }}>{cleanText(row.sourceAccNo)}</td>
                  <td style={cellStyle('180px')}>{cleanText(row.recipientBank)}</td>
                  <td style={{ ...cellStyle('150px'), fontFamily: 'monospace' }}>{cleanText(row.recipientAccNo)}</td>

                  <td style={cellStyle('130px')}>
                    {row.clrNo !== '–' ? (
                      <span className="tag" style={{ background: '#e0f2fe', color: '#0369a1' }}>{cleanText(row.clrNo)}</span>
                    ) : '–'}
                  </td>
                  <td style={cellStyle('130px')}>{row.refAdvNo !== '–' ? <span className="dn">{cleanText(row.refAdvNo)}</span> : '–'}</td>
                  <td style={{ ...cellStyle('110px'), fontSize: '12px', color: 'var(--ts)' }}>{row.itemDate !== '–' ? fmtD(row.itemDate) : '–'}</td>
                  <td style={cellStyle('160px')}>{cleanText(row.vendorName)}</td>
                  <td style={{ ...cellStyle('150px'), fontFamily: 'monospace' }}>{cleanText(row.taxId)}</td>
                  <td style={cellStyle('130px')}>{cleanText(row.receiptNo)}</td>
                  <td style={cellStyle('130px')}>{cleanText(row.invoiceNo)}</td>
                  <td style={cellStyle('220px')}>{cleanText(row.itemDescription)}</td>
                  <td style={{ ...cellStyle('120px', true) }}>฿{cleanNum(row.amountNet)}</td>
                  <td style={{ ...cellStyle('110px', true) }}>฿{cleanNum(row.vatAmount)}</td>
                  <td style={{ ...cellStyle('120px', true) }}>฿{cleanNum(row.discountAmount)}</td>
                  <td style={{ ...cellStyle('110px', true) }}>฿{cleanNum(row.otherCost)}</td>
                  <td style={{ ...cellStyle('130px', true), fontWeight: 700, color: 'var(--ok)' }}>฿{cleanNum(row.totalAmount)}</td>

                  <td style={{ ...cellStyle('140px', true), fontWeight: 700 }}>฿{cleanNum(row.totalRequested)}</td>
                  <td style={{ ...cellStyle('140px', true), fontWeight: 700, color: 'var(--ok)' }}>฿{cleanNum(row.totalCleared)}</td>
                  <td style={{ ...cellStyle('160px', true), fontWeight: 700, color: row.outstandingBalance > 0 ? '#ef4444' : '#10b981' }}>฿{cleanNum(row.outstandingBalance)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={28} style={{ textAlign: 'center', color: 'var(--tm)', padding: '28px' }}>ไม่พบรายการ</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: '8px', fontSize: '11.5px', color: 'var(--tm)' }}>แสดง {rows.length} ธุรกรรม · คลิกแถวดูรายละเอียด</div>
      </>
    );
  };

  const renderCard = () => {
    const SC: Record<string, string> = { PENDING_APPROVAL: '#f59e0b', WAITING_TRANSFER: '#3b82f6', WAITING_CLEARANCE: '#8b5cf6', CLOSED: '#10b981', REJECTED: '#ef4444', RETURNED: '#ef4444' };
    return (
      <>
        <div className="cg">
          {filtered.length ? filtered.map(r => {
            const out = (r.appAmount || r.amount) - r.clrAmount;
            const od = overdue(r);
            const col = od ? '#ef4444' : (SC[r.status] || '#6b7280');
            return (
              <div key={r.id} className="ac" onClick={() => handleOpenAdv(r.id)}>
                <div className="ac-h" style={{ borderTop: `3px solid ${col}` }}>
                  <div><div style={{ fontSize: '12px', fontWeight: 800, color: col }}>{r.id}</div><div style={{ fontSize: '11px', color: 'var(--tm)', marginTop: '1px' }}>{r.pName}</div></div>
                  <SBadge status={r.status} date={r.dueDate} />
                </div>
                <div className="ac-b">
                  <div className="flb" style={{ marginBottom: '5px' }}><span style={{ fontSize: '11px', color: 'var(--tm)' }}>ผู้เบิก</span><div className="fl" style={{ gap: '5px' }}><UserAvt ini={r.empName.substring(0, 2)} size={22} /><span style={{ fontSize: '12.5px', fontWeight: 500 }}>{r.empName}</span></div></div>
                  <div className="flb" style={{ marginBottom: '5px' }}><span style={{ fontSize: '11px', color: 'var(--tm)' }}>วันที่เบิก</span><span style={{ fontSize: '12px' }}>{fmtD(r.reqDate)}</span></div>
                  <div className="flb" style={{ marginBottom: '10px' }}><span style={{ fontSize: '11px', color: 'var(--tm)' }}>ครบกำหนด</span><span style={{ fontSize: '12px', color: od ? '#ef4444' : 'inherit' }}>{fmtD(r.dueDate)}</span></div>
                  <div style={{ textAlign: 'center', borderTop: '1px solid var(--bdr)', paddingTop: '10px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--tm)' }}>ยอดเบิก</div>
                    <div className="ac-amt">฿{fmt(r.amount)}</div>
                    {out > 0 && r.status !== 'REJECTED' && r.status !== 'RETURNED' && <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700 }}>คงค้าง ฿{fmt(out)}</div>}
                  </div>
                </div>
                <div className="ac-f"><button className="btn btn-o btn-xs" onClick={(e) => { e.stopPropagation(); handleOpenAdv(r.id); }}>ดูรายละเอียด →</button></div>
              </div>
            );
          }) : <div style={{ color: 'var(--tm)', padding: '32px', textAlign: 'center' }}>ไม่พบรายการ</div>}
        </div>
      </>
    );
  };

  const renderCal = () => {
    const first = new Date(calY, calM - 1, 1).getDay();
    const dim = new Date(calY, calM, 0).getDate();
    const mN = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const evts: Record<number, any[]> = {};
    
    advances.forEach(r => {
      const add = (ds: string, tp: string) => {
        if (!ds) return;
        const d = new Date(ds);
        if (d.getFullYear() === calY && d.getMonth() === calM - 1) {
          const day = d.getDate();
          if (!evts[day]) evts[day] = [];
          evts[day].push({ tp, r });
        }
      };
      add(r.reqDate, 'adv');
      if (r.clrs?.[0]) add(r.clrs[0].date, 'clr');
      if (overdue(r)) add(r.dueDate, 'due');
    });

    const cells = [];
    for (let i = 0; i < first; i++) cells.push(<div key={`om-${i}`} className="cal-c om"></div>);
    for (let d = 1; d <= dim; d++) {
      const isTd = d === 17 && calM === 6 && calY === 2026;
      const de = evts[d] || [];
      cells.push(
        <div key={`d-${d}`} className={`cal-c ${isTd ? 'today' : ''}`}>
          <div className="cal-dt" style={{ color: isTd ? 'var(--p)' : '' }}>{d}</div>
          {de.slice(0, 3).map((e, i) => (
            <div key={i} className={`ce ${e.tp === 'adv' ? 'ce-a' : e.tp === 'clr' ? 'ce-c' : 'ce-d'}`} onClick={(ev) => { ev.stopPropagation(); handleOpenAdv(e.r.id); }}>
              <div className="cav">{e.r.empName[0]}</div><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.r.id.slice(-3)}</span>
            </div>
          ))}
          {de.length > 3 && <div style={{ fontSize: '9px', color: 'var(--tm)' }}>+{de.length - 3}</div>}
        </div>
      );
    }

    const calNav = (delta: number) => {
      let nm = calM + delta, ny = calY;
      if (nm > 12) { nm = 1; ny++; }
      if (nm < 1) { nm = 12; ny--; }
      setCalM(nm); setCalY(ny);
    };

    return (
      <>
        <div className="flb" style={{ marginBottom: '12px' }}>
          <button className="btn btn-g btn-sm" onClick={() => calNav(-1)}>◀</button>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>{mN[calM]} {calY}</div>
          <button className="btn btn-g btn-sm" onClick={() => calNav(1)}>▶</button>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', fontSize: '11px', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#d1fae5', display: 'inline-block' }}></span>วันเบิก</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#fef3c7', display: 'inline-block' }}></span>วันเคลียร์</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#fee2e2', display: 'inline-block' }}></span>เกินกำหนด</span>
        </div>
        <div className="cal-g">
          {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(n => <div key={n} className="cal-dn">{n}</div>)}
          {cells}
        </div>
      </>
    );
  };

  return (
    <>
      <div className="ph">
        <div><h2>Advance Data Center</h2><p>{advances.length} รายการ · ศูนย์รวมข้อมูลทั้งหมด</p></div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-o btn-sm" onClick={() => { window.location.href = `/api/export/advances.csv?token=${encodeURIComponent(localStorage.getItem('clear_advance_auth_token') || '')}`; }}>? Excel</button>
          <button className="btn btn-o btn-sm" onClick={() => { window.location.href = `/api/export/advances.csv?token=${encodeURIComponent(localStorage.getItem('clear_advance_auth_token') || '')}`; }}>? CSV</button>
          <button className="btn btn-p btn-sm" onClick={() => setPage('create')}>+ ใบเบิกใหม่</button>
        </div>
      </div>
      {renderDashboard()}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div className="vtabs">
          <button className={`vtab ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}>🗂 Table</button>
          <button className={`vtab ${view === 'card' ? 'active' : ''}`} onClick={() => setView('card')}>🃏 Card</button>
          <button className={`vtab ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}>📅 Calendar</button>
        </div>
      </div>
      {view === 'table' ? renderTable() : view === 'card' ? renderCard() : renderCal()}
    </>
  );
};

