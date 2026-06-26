import React from 'react';
import { QrCode } from 'lucide-react';
import { PublishedTemplate, defaultPage } from './useDocumentTemplates';
import { useApp } from '../../context/AppContext';

export function formatNum(num?: number): string {
  if (num === undefined || isNaN(num)) return '0.00';
  return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function arabToThaiBaht(num?: number): string {
  if (num === undefined || isNaN(num)) return 'ศูนย์บาทถ้วน';
  const textNum = num.toFixed(2);
  const [intl, dec] = textNum.split('.');
  
  const thaiNums = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const thaiPlaces = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  
  let result = '';
  
  const convertInt = (intStr: string): string => {
    let res = '';
    const len = intStr.length;
    for (let i = 0; i < len; i++) {
      const digit = parseInt(intStr[i]);
      if (digit !== 0) {
        if (i === len - 1 && digit === 1 && len > 1) {
          res += 'เอ็ด';
        } else if (i === len - 2 && digit === 2) {
          res += 'ยี่สิบ';
        } else if (i === len - 2 && digit === 1) {
          res += 'สิบ';
        } else {
          res += thaiNums[digit] + thaiPlaces[len - 1 - i];
        }
      }
    }
    return res;
  };

  const intVal = parseInt(intl);
  if (intVal === 0) {
    result += 'ศูนย์';
  } else if (intl.length > 6) {
    const millionPart = intl.substring(0, intl.length - 6);
    const restPart = intl.substring(intl.length - 6);
    result += convertInt(millionPart) + 'ล้าน' + convertInt(restPart);
  } else {
    result += convertInt(intl);
  }

  result += 'บาท';

  if (parseInt(dec) === 0) {
    result += 'ถ้วน';
  } else {
    const decDigit1 = parseInt(dec[0]);
    const decDigit2 = parseInt(dec[1]);
    if (decDigit1 !== 0) {
      if (decDigit1 === 2) {
        result += 'ยี่';
      } else if (decDigit1 !== 1) {
        result += thaiNums[decDigit1];
      }
      result += 'สิบ';
    }
    if (decDigit2 !== 0) {
      if (decDigit2 === 1 && decDigit1 !== 0) {
        result += 'เอ็ด';
      } else {
        result += thaiNums[decDigit2];
      }
    }
    result += 'สตางค์';
  }
  
  return result;
}

interface AdvanceTemplateRendererProps {
  template: PublishedTemplate;
  data: any;
}

export const AdvanceTemplateRenderer: React.FC<AdvanceTemplateRendererProps> = ({ template, data }) => {
  const config = template.config;

  const appState: any = useApp() || {};
  const masterUsers = appState.masterUsers || [];
  const masterCategories = appState.masterCategories || [];

  // Extract from domain data or fallback to defaults
  const docNo = data.id || data.advNo || 'ADV-2026-XXXXX';
  const displayDate = data.reqDate || data.displayDate || new Date().toISOString();

  const empName = data.employeeName || data.empName || config.employeeName || 'ผู้ขอเบิก';
  const empDept = data.employeeDept || data.empDept || config.employeeDept || 'แผนกปฏิบัติการ';
  const pName = data.projectName || data.pName || config.projectName || 'โครงการทั่วไป';
  const desc = data.desc || data.description || config.description || 'ไม่มีรายละเอียดหมายเหตุเสริม';

  const reqDate = data.reqDate || data.displayDate || new Date().toISOString();
  const calculatedDueDate = reqDate ? (() => {
    try {
      const d = new Date(reqDate);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + 30);
        return d.toISOString();
      }
    } catch (e) {}
    return 'ไม่ระบุ';
  })() : 'ไม่ระบุ';
  const dueDate = calculatedDueDate;
  const appDate = data.appDate;
  const status = data.status || 'DRAFT';

  const itemsList = data.items || [];
  const normalizedItems = itemsList.map((it: any) => {
    const d = it.d || it.desc || it.description || 'ไม่มีชื่อรายการ';
    const cat = it.cat || it.category || 'C01';
    const q = it.q !== undefined ? it.q : (it.qty !== undefined ? it.qty : 1);
    const u = it.u || it.unit || 'รายการ';
    const p = it.p !== undefined ? it.p : (it.price !== undefined ? it.price : 0);
    const t = it.t !== undefined ? it.t : (it.amount !== undefined ? it.amount : (q * p));
    return { d, cat, q, u, p, t };
  });

  const totalAmount = data.appAmount !== undefined ? data.appAmount : (data.amount !== undefined ? data.amount : normalizedItems.reduce((acc: number, it: any) => acc + (it.t || 0), 0));

  const localFmt = (n?: number) => (n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const localFmtD = (s?: string | null) => {
    if (!s) return '–';
    if (s.includes('ม.ค.') || s.includes('ก.พ.') || s.includes('มี.ค.') || s.includes('เม.ย.') || s.includes('พ.ค.') || s.includes('มิ.ย.') || s.includes('ก.ค.') || s.includes('ส.ค.') || s.includes('ก.ย.') || s.includes('ต.ค.') || s.includes('พ.ย.') || s.includes('ธ.ค.')) {
      return s;
    }
    try {
      const d = new Date(s);
      if (isNaN(d.getTime())) return s;
      return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
    } catch (e) {
      return s;
    }
  };

  const approverUser = masterUsers.find((u: any) => data.appBy && data.appBy.includes(u.name));
  const sigImage = data.appBySignature || approverUser?.signatureData;

  // Render original layout 100%
  return (
    <div 
      className="bg-white w-[210mm] min-h-[297mm] shadow-lg p-12 pr-14 pl-14 flex flex-col mx-auto font-['Noto_Sans_Thai'] text-[12px] border border-slate-200 relative overflow-hidden print-area"
      id={`document-renderer-TPL1`}
    >
      <div style={{ background: '#fff', color: '#1e293b', width: '100%' }}>
        <div style={{ borderBottom: '2.5px solid var(--p, #4E958D)', paddingBottom: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '24px', fontWeight: 950, color: 'var(--p, #4E958D)' }}>ADVANCE REQUISITION SHEET</span>
              <div style={{ fontSize: '11px', color: 'var(--ts, #5a7a79)', marginTop: '4px' }}>เอกสารใบขอเบิกเงินทดรองจ่ายอิเล็กทรอนิกส์อย่างเป็นทางการ</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'right' }}>
              <img 
                src="https://img1.pic.in.th/images/Photoroom_25690616_0140020ff34b302f0f7c25.png" 
                alt="Logo"
                style={{ width: '60px', height: '60px', objectFit: 'contain' }}
                referrerPolicy="no-referrer"
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 900, color: 'var(--p, #4E958D)' }}>{docNo}</div>
                <div style={{ fontSize: '11px', color: 'var(--ts, #5a7a79)' }}>วันที่พิมพ์: {localFmtD(new Date().toISOString())}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', marginBottom: '24px', fontSize: '12px', border: '1px solid var(--bdr, #E2F0EF)', padding: '16px', borderRadius: '8px', background: '#fafbfc' }}>
          <div>
            <div style={{ margin: '4px 0' }}><b>ชื่อผู้ขอเบิกเงิน:</b> {empName}</div>
            <div style={{ margin: '4px 0' }}><b>ตำแหน่ง:</b> {empDept}</div>
            <div style={{ margin: '4px 0' }}><b>โครงการ:</b> {pName}</div>
            <div style={{ margin: '4px 0' }}><b>หมายเหตุ:</b> {desc}</div>
          </div>
          <div style={{ textAlign: 'right', borderLeft: '1px solid var(--bdr, #E2F0EF)', paddingLeft: '20px' }}>
            <div style={{ margin: '4px 0' }}><b>วันที่ทำรายการ:</b> {localFmtD(reqDate)}</div>
            <div style={{ margin: '4px 0' }}><b>กำหนดการเคลียร์เอกสาร:</b> {localFmtD(dueDate)}</div>
            {appDate && <div style={{ margin: '4px 0' }}><b>วันที่ผู้บังคับอนุมัติ:</b> {localFmtD(appDate)}</div>}
            <div><b>สถานะเบิกจ่าย:</b> {status}</div>
          </div>
        </div>

        {/* Line items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '16px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2.5px solid var(--bdr, #E2F0EF)' }}>
              <th style={{ padding: '10px', textAlign: 'left' }}>รายละเอียดรายการขออนุมัติ</th>
              <th style={{ padding: '10px', textAlign: 'center', width: '100px' }}>หมวดบัญชี</th>
              <th style={{ padding: '10px', textAlign: 'right', width: '80px' }}>จำนวน</th>
              <th style={{ padding: '10px', textAlign: 'right', width: '100px' }}>ราคาต่อหน่วย</th>
              <th style={{ padding: '10px', textAlign: 'right', width: '110px' }}>ราคารวม</th>
            </tr>
          </thead>
          <tbody>
            {normalizedItems.length > 0 ? (
              normalizedItems.map((it: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1.5px solid var(--bdr, #E2F0EF)' }}>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{it.d}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <span className="badge bp" style={{ background: 'var(--p10, #e8f5f4)', color: 'var(--p, #4E958D)', fontSize: '10px' }}>
                      {masterCategories.find((c: any) => c.id === (it.cat || 'C01'))?.name || 'วัสดุ'}
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{it.q} {it.u}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>฿{localFmt(it.p)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>฿{localFmt(it.t)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>ไม่มีรายการขออนุมัติเงินทดรองจ่าย</td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ border: '2.5px solid var(--p, #4E958D)', borderRadius: '8px', padding: '14px 20px', marginTop: '24px', background: '#f0fdf4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--p, #4E958D)' }}>ยอดเงินงบประมาณทดรองรวมทั้งสิ้น (TOTAL AMOUNT)</span>
          <span style={{ fontSize: '20px', fontWeight: 950, color: 'var(--p, #4E958D)' }}>฿{localFmt(totalAmount)}</span>
        </div>

        {/* Signature flow block under layout */}
        <div className="footer-signature" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '48px', fontSize: '11.5px', borderTop: '1px solid var(--bdr, #E2F0EF)', paddingTop: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ color: 'var(--ts, #5a7a79)' }}>ผู้จัดทำเอกสารและรับผิดชอบหนี้ทดรอง</span>
            <div style={{ height: '40px', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--p, #4E958D)', fontSize: '14px' }}>
              {empName}
            </div>
            <span className="sig-line" style={{ display: 'block', borderTop: '1px dashed #94a3b8', margin: '6px auto', width: '180px' }}></span>
            <span>วันที่: {localFmtD(reqDate)}</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ color: 'var(--ts, #5a7a79)' }}>ผู้อนุมัติเอกสารเบิกจ่ายทางบัญชี</span>
            <div style={{ height: '40px', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {sigImage ? (
                <img 
                  src={sigImage} 
                  alt="Approver Signature" 
                  style={{ maxHeight: '50px', objectFit: 'contain' }} 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span style={{ color: 'var(--ok, #10b981)', fontSize: '13px' }}>{data.appBy ? `SIGNED BY ${data.appBy}` : 'SYSTEM AUTO APPROVED'}</span>
              )}
            </div>
            <span className="sig-line" style={{ display: 'block', borderTop: '1px dashed #94a3b8', margin: '6px auto', width: '180px' }}></span>
            <span>วันที่อนุมัติ: {appDate ? localFmtD(appDate) : '–'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
