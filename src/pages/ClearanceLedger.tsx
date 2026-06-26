import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, Search, RefreshCw, Calendar, User, Briefcase, FileText, Download, Filter, TrendingUp, DollarSign, Percent
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface LedgerEntry {
  key: string;
  round: number;
  date: string;
  auditId: string;
  clrId: string;
  advId: string;
  employeeName: string;
  projectName: string;
  items: string;
  vat: number;
  wht: number;
  discount: number;
  other: number;
  net: number;
}

export const ClearanceLedger: React.FC = () => {
  const { advances, toast } = useApp();
  const [vaultDocs, setVaultDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');

  // Fetch vaulted records to build the ledger
  const fetchVaultDocs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/store/vault-docs?t=' + Date.now());
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setVaultDocs(data);
        }
      }
    } catch (e) {
      toast('ไม่สามารถโหลดข้อมูลประวัติสะสมได้', 'err');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVaultDocs();
  }, []);

  // Compile full company ledger list
  const ledgerEntries = useMemo<LedgerEntry[]>(() => {
    // Only show audit reports / clearance reports in the ledger
    const clearanceReports = vaultDocs.filter(doc => doc.isClearanceReport === true || doc.id?.startsWith('AUD-'));
    
    // Sort in chronological order based on Sequential Audit ID
    const sortedDocs = [...clearanceReports].sort((a, b) => a.id.localeCompare(b.id));
    
    const entries: LedgerEntry[] = [];
    
    sortedDocs.forEach((doc, idx) => {
      const parentAdv = advances.find(a => a.id === doc.advId);
      const employeeName = parentAdv?.empName || 'ไม่ระบุพนักงาน';
      const projectName = parentAdv?.projectName || parentAdv?.pName || 'KCL';
      
      const vaultData = doc.vaultData || {};
      const totalApproved = typeof vaultData.totalApproved === 'number' ? vaultData.totalApproved : (typeof doc.totalApproved === 'number' ? doc.totalApproved : 0);
      const timestamp = vaultData.timestamp || doc.timestamp || doc.date || 'ไม่ระบุ';
      const itemsSnap = doc.itemsSnap || vaultData.itemsSnap || [];

      let vatSum = 0;
      let whtSum = 0;
      let discountSum = 0;
      let otherSum = 0;

      if (Array.isArray(itemsSnap)) {
        itemsSnap.forEach((it: any) => {
          if (it.action === 'approved') {
            vatSum += parseFloat(it.vat) || 0;
            whtSum += parseFloat(it.wht) || 0;
            discountSum += parseFloat(it.discount) || 0;
          }
        });
      }

      const approvedItemsList = Array.isArray(itemsSnap)
        ? itemsSnap
            .filter((it: any) => it.action === 'approved')
            .map((it: any) => it.description)
            .join(', ') || 'ไม่มีรายการที่อนุมัติ'
        : 'ไม่มีรายการที่อนุมัติ';

      entries.push({
        key: `${doc.id}-${idx}`,
        round: entries.length + 1,
        date: timestamp ? timestamp.split(' ')[0] : 'ไม่ระบุ',
        auditId: doc.id,
        clrId: `CLR-${doc.id.substring(4, 12)}`,
        advId: doc.advId,
        employeeName,
        projectName,
        items: approvedItemsList,
        vat: vatSum,
        wht: whtSum,
        discount: discountSum,
        other: otherSum,
        net: totalApproved
      });
    });

    return entries;
  }, [vaultDocs, advances]);

  // Unique lists for filtering dropdowns
  const uniqueProjects = useMemo(() => {
    const list = new Set<string>();
    ledgerEntries.forEach(e => {
      if (e.projectName) list.add(e.projectName);
    });
    return Array.from(list);
  }, [ledgerEntries]);

  const uniqueEmployees = useMemo(() => {
    const list = new Set<string>();
    ledgerEntries.forEach(e => {
      if (e.employeeName) list.add(e.employeeName);
    });
    return Array.from(list);
  }, [ledgerEntries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return ledgerEntries.filter(entry => {
      const matchesSearch = 
        entry.advId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.clrId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.items.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesProject = selectedProject === 'all' ? true : entry.projectName === selectedProject;
      const matchesEmployee = selectedEmployee === 'all' ? true : entry.employeeName === selectedEmployee;

      return matchesSearch && matchesProject && matchesEmployee;
    });
  }, [ledgerEntries, searchTerm, selectedProject, selectedEmployee]);

  // Totals calculations
  const totals = useMemo(() => {
    return filteredEntries.reduce((acc, curr) => ({
      vat: acc.vat + curr.vat,
      wht: acc.wht + curr.wht,
      discount: acc.discount + curr.discount,
      net: acc.net + curr.net
    }), { vat: 0, wht: 0, discount: 0, net: 0 });
  }, [filteredEntries]);

  // Dynamic Running Balances for each row based on filtered set
  const rowsWithRunningBalance = useMemo(() => {
    let currentSum = 0;
    return filteredEntries.map(entry => {
      currentSum += entry.net;
      return {
        ...entry,
        runningBalance: currentSum
      };
    });
  }, [filteredEntries]);

  // Export ledger to CSV format
  const exportToCSV = () => {
    if (rowsWithRunningBalance.length === 0) {
      toast('ไม่มีข้อมูลในสมุดบัญชีแยกประเภทที่จะส่งออก', 'err');
      return;
    }

    const headers = ['ลำดับ', 'วันที่เคลียร์', 'รหัส Audit ID', 'เลขอ้างอิง CLR', 'เลขที่ใบเบิก ADV', 'พนักงาน', 'โครงการ', 'รายการอนุมัติ', 'VAT (฿)', 'WHT (฿)', 'ส่วนลด (฿)', 'ยอดอนุมัติหักล้างสะสม (฿)', 'ยอดคงเหลืองสะสมสะพัด (฿)'];
    const rows = rowsWithRunningBalance.map(r => [
      r.round,
      r.date,
      r.auditId,
      r.clrId,
      r.advId,
      r.employeeName,
      r.projectName,
      `"${r.items.replace(/"/g, '""')}"`,
      r.vat.toFixed(2),
      r.wht.toFixed(2),
      r.discount.toFixed(2),
      r.net.toFixed(2),
      r.runningBalance.toFixed(2)
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `clearance-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('ส่งออกสมุดบัญชีแยกประเภทสะสม (Clearance History Ledger) เป็นไฟล์ CSV แล้ว', 'ok');
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300" id="clearance-ledger-workspace">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-sm">
            <History size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">ระบบการบันทึกประวัติสะสม (Clearance History Ledger)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              สมุดบัญชีสะสมแยกประเภท (General Clearance Ledger) สำหรับติดตามประวัติการอนุมัติหักยอดสุทธิ, ภาษีซื้อ และภาษี ณ ที่จ่ายรายโครงการ
            </p>
          </div>
        </div>
        <button 
          onClick={exportToCSV}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
        >
          <Download size={15} /> Export Ledger CSV
        </button>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ยอดอนุมัติหักล้างรวม (Net Cleared)</p>
            <p className="text-lg font-black text-slate-800 font-mono mt-0.5">
              {totals.net.toLocaleString(undefined, {minimumFractionDigits: 2})} ฿
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <DollarSign size={20} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ยอดภาษีซื้อสะสม (Total VAT)</p>
            <p className="text-lg font-black text-slate-800 font-mono mt-0.5">
              {totals.vat.toLocaleString(undefined, {minimumFractionDigits: 2})} ฿
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
            <Percent size={20} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ภาษีหัก ณ ที่จ่ายสะสม (Total WHT)</p>
            <p className="text-lg font-black text-slate-800 font-mono mt-0.5">
              {totals.wht.toLocaleString(undefined, {minimumFractionDigits: 2})} ฿
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center flex-shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">จำนวนรายการบันทึก (Transactions)</p>
            <p className="text-lg font-black text-slate-800 mt-0.5">
              {rowsWithRunningBalance.length} รายการ
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filter Dropdowns */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="ค้นหาตามเลขที่บิล ADV, รหัส CLR, รายการอนุมัติ หรือชื่อพนักงาน..."
            className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none transition-all font-sans"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 md:w-[360px]">
          <div className="relative">
            <select 
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              className="w-full border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2.5 text-xs bg-white focus:border-indigo-500 outline-none transition-all font-sans"
            >
              <option value="all">ทุกโครงการ (All Projects)</option>
              {uniqueProjects.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <select 
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              className="w-full border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2.5 text-xs bg-white focus:border-indigo-500 outline-none transition-all font-sans"
            >
              <option value="all">ทุกพนักงาน (All Staff)</option>
              {uniqueEmployees.map(emp => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* General General Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="animate-spin inline mr-2 text-indigo-500" size={24} />
            <span>กำลังโหลดข้อมูลทะเบียนบัญชีสะสม...</span>
          </div>
        ) : rowsWithRunningBalance.length === 0 ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center">
            <History size={48} className="opacity-25 mb-3" />
            <p className="text-sm font-bold">ไม่พบข้อมูลในสมุดบัญชีแยกประเภทสะสม</p>
            <p className="text-xs text-slate-400 mt-1">ไม่มีบันทึกประวัติการหักล้างที่ผ่านการตรวจสอบในเงื่อนไขปัจจุบัน</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-3.5 text-center w-12">ครั้งที่</th>
                  <th className="px-4 py-3.5">วันที่เคลียร์</th>
                  <th className="px-4 py-3.5">อ้างอิง CLR / ADV</th>
                  <th className="px-4 py-3.5">พนักงาน / โครงการ</th>
                  <th className="px-4 py-3.5">รายละเอียดรายการใช้เงินที่อนุมัติ</th>
                  <th className="px-4 py-3.5 text-right">VAT (฿)</th>
                  <th className="px-4 py-3.5 text-right">WHT (฿)</th>
                  <th className="px-4 py-3.5 text-right">ส่วนลด (฿)</th>
                  <th className="px-4 py-3.5 text-right text-emerald-700">หักล้างรอบนี้ (฿)</th>
                  <th className="px-4 py-3.5 text-right text-indigo-700">สะสมสะพัด (฿)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {rowsWithRunningBalance.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-center font-bold text-slate-400">{row.round}</td>
                    <td className="px-4 py-3 text-slate-500">{row.date}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-indigo-600 font-mono text-[11px]">{row.clrId}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{row.advId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800 flex items-center gap-1">
                        <User size={11} className="text-slate-400" /> {row.employeeName}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                        <Briefcase size={11} className="text-slate-400" /> {row.projectName}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate" title={row.items}>
                      <span className="text-slate-600">{row.items}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">
                      {row.vat > 0 ? row.vat.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">
                      {row.wht > 0 ? row.wht.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">
                      {row.discount > 0 ? row.discount.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                      {row.net > 0 ? `${row.net.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-indigo-700 bg-indigo-50/30">
                      {row.runningBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50/80 font-bold border-t border-slate-200 text-slate-800">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right font-bold">รวมทั้งสิ้นในตาราง (Cumulative Grand Totals):</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">
                    {totals.vat.toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">
                    {totals.wht.toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">
                    {totals.discount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-700 text-sm">
                    {totals.net.toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-indigo-700 text-sm bg-indigo-50/50">
                    {totals.net.toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
