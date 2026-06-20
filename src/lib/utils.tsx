import React, { ReactNode } from 'react';
import { Advance } from '../types';

export const fmt = (n?: number) => (n || 0).toLocaleString('th-TH');
export const fmtM = (n?: number) => {
  if (!n) return '0';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toLocaleString('th-TH');
};
export const fmtD = (s?: string | null) => s ? new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '–';
export const now = () => new Date('2026-06-17');

export const overdue = (r: Advance) => r.status === 'WAITING_CLEARANCE' && r.dueDate && new Date(r.dueDate) < now();

export const SM: Record<string, { l: string; c: string }> = {
  PENDING_APPROVAL: { l: 'รออนุมัติ', c: 'bp' },
  WAITING_TRANSFER: { l: 'รอโอน', c: 'bt' },
  WAITING_CLEARANCE: { l: 'รอเคลียร์', c: 'bc2' },
  CLOSED: { l: 'ปิดยอด', c: 'bk' },
  REJECTED: { l: 'ไม่อนุมัติ', c: 'br' },
  'บันทึกร่าง': { l: 'บันทึกร่าง', c: 'bg' },
  'รออนุมัติ': { l: 'รออนุมัติ', c: 'bp' },
  'DRAFT': { l: 'บันทึกร่าง', c: 'bg' },
  'รอเคลียร์ยอด': { l: 'รอเคลียร์ยอด', c: 'bc2' }
};

export const SBadge = ({ status, date }: { status: string; date?: string }) => {
  if (status === 'WAITING_CLEARANCE' && date && new Date(date) < now()) {
    return <span className="badge bo">⚠ เกินกำหนด</span>;
  }
  const m = SM[status] || { l: status, c: 'bp' };
  return <span className={`badge ${m.c}`}>{m.l}</span>;
};

export const Ip = ({ t }: { t: ReactNode }) => {
  const toggle = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.classList.toggle('open');
  };
  return (
    <div className="ip" onClick={toggle} tabIndex={0}>
      <div className="ip-b">ⓘ</div>
      <div className="ip-box">{t}</div>
    </div>
  );
};

export const generateAdvanceId = (existingAdvances: { id: string }[], existingId?: string) => {
  if (existingId && existingId.startsWith('ADV-') && !existingId.includes('DRAFT') && existingId.split('-').length === 3) {
    return existingId;
  }
  const d = now();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yymm = yy + mm;
  const prefix = `ADV-${yymm}-`;
  const matched = existingAdvances.filter(a => a.id && a.id.startsWith(prefix));
  let nextNum = 1;
  if (matched.length > 0) {
    const lastItem = matched[matched.length - 1];
    const parts = lastItem.id.split('-');
    if (parts.length === 3) {
      const lastNumStr = parts[2];
      const lastNum = parseInt(lastNumStr, 10);
      nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
    }
  }
  const suffix = String(nextNum).padStart(3, '0');
  return prefix + suffix;
};

export const generateClearanceId = (existingAdvances: { clrs?: { id: string }[] }[], existingId?: string) => {
  if (existingId && existingId.startsWith('CLR-') && !existingId.includes('DRAFT') && existingId.split('-').length === 3) {
    return existingId;
  }
  const d = now();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yymm = yy + mm;
  const prefix = `CLR-${yymm}-`;
  const allClrs: string[] = [];
  existingAdvances.forEach(adv => {
    if (adv.clrs) {
      adv.clrs.forEach(clr => {
        if (clr.id && clr.id.startsWith(prefix)) {
          allClrs.push(clr.id);
        }
      });
    }
  });
  let nextNum = 1;
  if (allClrs.length > 0) {
    const lastItem = allClrs[allClrs.length - 1];
    const parts = lastItem.split('-');
    if (parts.length === 3) {
      const lastNumStr = parts[2];
      const lastNum = parseInt(lastNumStr, 10);
      nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
    }
  }
  const suffix = String(nextNum).padStart(3, '0');
  return prefix + suffix;
};

export const genId = (count: number) => 'ADV-2026-' + String(count + 1).padStart(3, '0');
export const clrId = (id: string) => 'CLR-' + id.replace('ADV-', '');

export const UserAvt = ({ ini, size = 28 }: { ini: string; size?: number }) => (
  <div className="eavt" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>{ini}</div>
);
