import { Advance, Project } from '../types';
import { overdue, now } from './utils';

export function getStats(advances: Advance[], masterProjects?: Project[]) {
  const T = now().getTime();
  let totAdv = 0, totPend = 0, totOver = 0;
  const rE = new Set<string>();
  const rP = new Set<string>();
  const catT: Record<string, number> = {};
  const projT: Record<string, { name: string; amt: number }> = {};
  const empT: Record<string, { name: string; dept: string; amt: number }> = {};
  const aging = { '0-30': [] as Advance[], '31-60': [] as Advance[], '61-90': [] as Advance[], '90+': [] as Advance[] };

  advances.forEach(r => {
    if (['REJECTED'].includes(r.status)) return;
    const amt = r.appAmount || r.amount;
    totAdv += amt;
    const out = amt - r.clrAmount;
    if (['WAITING_TRANSFER', 'WAITING_CLEARANCE', 'PENDING_APPROVAL'].includes(r.status)) {
      totPend += out;
      if (overdue(r)) {
        totOver += out;
        rE.add(r.empId);
        r.pIds.forEach(p => rP.add(p));
      }
    }
    const days = Math.floor((T - new Date(r.reqDate).getTime()) / 86400000);
    const bk = days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
    aging[bk as keyof typeof aging].push(r);
    
    catT[r.catName] = (catT[r.catName] || 0) + amt;
    
    r.pIds.forEach(pid => {
      const pn = (masterProjects || []).find(p => p.id === pid)?.name || r.pName || pid;
      if (!projT[pid]) projT[pid] = { name: pn, amt: 0 };
      projT[pid].amt += out;
    });
    
    if (!empT[r.empId]) empT[r.empId] = { name: r.empName, dept: r.empDept, amt: 0 };
    empT[r.empId].amt += out;
  });

  return {
    totAdv, totPend, totOver,
    riskE: rE.size, riskP: rP.size,
    catT,
    topP: Object.entries(projT).filter(([, v]) => v.amt > 0).sort((a, b) => b[1].amt - a[1].amt).slice(0, 5),
    topE: Object.entries(empT).filter(([, v]) => v.amt > 0).sort((a, b) => b[1].amt - a[1].amt).slice(0, 5),
    clrRate: advances.filter(r => r.status === 'CLOSED').length / (advances.length || 1) * 100,
    aging,
    total: advances.length,
    closed: advances.filter(r => r.status === 'CLOSED').length,
    rejected: advances.filter(r => r.status === 'REJECTED').length
  };
}
