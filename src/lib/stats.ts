import { Advance, Project } from '../types';
import { overdue, now } from './utils';

export function getStats(advances: Advance[], masterProjects?: Project[]) {
  const T = now().getTime();
  let totAdv = 0, totPend = 0, totOver = 0, totPaid = 0, totCleared = 0;
  let totDocsCleared = 0, totSysCleared = 0;
  const rE = new Set<string>();
  const rP = new Set<string>();
  const catT: Record<string, number> = {};
  const projT: Record<string, { name: string; amt: number }> = {};
  const empT: Record<string, { name: string; dept: string; amt: number }> = {};
  const aging = { '0-30': [] as Advance[], '31-60': [] as Advance[], '61-90': [] as Advance[], '90+': [] as Advance[] };

  (advances || []).forEach(r => {
    if (!r) return;
    if (['REJECTED', 'RETURNED'].includes(r.status)) return;
    
    const amt = Number(r.appAmount || r.amount) || 0;
    totAdv += amt;
    const clrAmt = Number(r.clrAmount) || 0;
    const out = amt - clrAmt;
    
    if (r.status === 'CLOSED') {
      totPaid += amt;
      totCleared += clrAmt;
    }
    
    const trkStatus = r.trackingRecord?.status;
    const isPhysicalComplete = trkStatus === 'Ready For Accounting' || trkStatus === 'Completed' || trkStatus === 'ERP Posted';
    
    if (r.status === 'CLOSED' && isPhysicalComplete) {
      totDocsCleared += clrAmt;
    } else {
      let sysClearedAmt = 0;
      if (r.receipts && r.receipts.length > 0) {
         sysClearedAmt = r.receipts.reduce((sum: number, rcpt: any) => sum + (Number(rcpt.netTotal) || Number(rcpt.subtotal) || Number(rcpt.amount) || 0), 0);
      } else if (r.status === 'CLOSED' || clrAmt > 0) {
         sysClearedAmt = clrAmt;
      }
      totSysCleared += sysClearedAmt;
    }
    
    if (['WAITING_TRANSFER', 'WAITING_CLEARANCE', 'PENDING_APPROVAL', 'DRAFT_CLEARANCE'].includes(r.status)) {
      totPend += out;
      if (overdue(r)) {
        totOver += out;
        if (r.empId) rE.add(r.empId);
        if (Array.isArray(r.pIds)) {
          r.pIds.forEach(p => p && rP.add(p));
        }
      }
    }
    
    const reqDateNum = r.reqDate ? new Date(r.reqDate).getTime() : NaN;
    if (!isNaN(reqDateNum)) {
      const days = Math.floor((T - reqDateNum) / 86400000);
      const bk = days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
      if (aging[bk as keyof typeof aging]) {
        aging[bk as keyof typeof aging].push(r);
      }
    }
    
    const cName = r.catName || 'อื่นๆ';
    catT[cName] = (catT[cName] || 0) + amt;
    
    if (Array.isArray(r.pIds)) {
      const numProj = r.pIds.filter(Boolean).length || 1;
      const share = out / numProj;
      r.pIds.forEach(pid => {
        if (!pid) return;
        const pn = (masterProjects || []).find(p => p.id === pid)?.name || r.pName || pid;
        if (!projT[pid]) projT[pid] = { name: pn, amt: 0 };
        projT[pid].amt += share;
      });
    }
    
    if (r.empId) {
      if (!empT[r.empId]) empT[r.empId] = { name: r.empName || '–', dept: r.empDept || '–', amt: 0 };
      empT[r.empId].amt += out;
    }
  });

  return {
    totAdv, totPend, totOver, totPaid, totCleared,
    totDocsCleared, totSysCleared,
    riskE: rE.size, riskP: rP.size,
    catT,
    topP: Object.entries(projT).filter(([, v]) => v.amt > 0).sort((a, b) => b[1].amt - a[1].amt).slice(0, 5),
    topE: Object.entries(empT).filter(([, v]) => v.amt > 0).sort((a, b) => b[1].amt - a[1].amt).slice(0, 5),
    clrRate: (advances || []).filter(r => r && r.status === 'CLOSED').length / ((advances || []).length || 1) * 100,
    aging,
    total: (advances || []).length,
    closed: (advances || []).filter(r => r && r.status === 'CLOSED').length,
    rejected: (advances || []).filter(r => r && r.status === 'REJECTED').length
  };
}
