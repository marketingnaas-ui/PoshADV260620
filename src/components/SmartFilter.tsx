import React from 'react';
import { Search, Calendar, LayoutGrid, Filter, SlidersHorizontal, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface SmartFilterProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  statusFilter?: string;
  onStatusChange?: (val: string) => void;
  projectFilter?: string;
  onProjectChange?: (val: string) => void;
  empFilter?: string;
  onEmpChange?: (val: string) => void;
  onClear?: () => void;
  placeholder?: string;
  hideStatus?: boolean;
}

export const SmartFilter: React.FC<SmartFilterProps> = ({ 
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  projectFilter,
  onProjectChange,
  empFilter,
  onEmpChange,
  onClear,
  placeholder = "ค้นหาอัจฉริยะ...",
  hideStatus = false
}) => {
  const { masterProjects, masterUsers } = useApp();

  return (
    <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-center animate-in fade-in duration-300">
      <div className="flex-1 w-full relative group">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
        <input 
          type="text" 
          placeholder={placeholder} 
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-none transition-all"
        />
        {searchQuery && (
          <button 
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
      
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
        {!hideStatus && onStatusChange && (
          <div className="relative shrink-0 min-w-[140px] flex-1 md:flex-none">
            <select
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value)}
              className="w-full appearance-none pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <option value="">สถานะทั้งหมด</option>
              <option value="DRAFT">บันทึกร่าง</option>
              <option value="PENDING_APPROVAL">รออนุมัติ</option>
              <option value="WAITING_TRANSFER">รอโอน</option>
              <option value="WAITING_CLEARANCE">รอเคลียร์</option>
              <option value="DRAFT_CLEARANCE">บันทึกร่างเคลียร์</option>
              <option value="PARTIAL_CLEARANCE">บันทึกเคลียร์บางส่วน</option>
              <option value="WAITING_PHYSICAL_DOCS">รอเอกสารตัวจริง</option>
              <option value="CLOSED">ปิดยอด</option>
              <option value="REJECTED">ไม่อนุมัติ</option>
              <option value="RETURNED">เอกสารตีกลับ</option>
            </select>
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-400"></div>
          </div>
        )}

        {onProjectChange && (
          <div className="relative shrink-0 min-w-[160px] flex-1 md:flex-none">
            <select
              value={projectFilter}
              onChange={(e) => onProjectChange(e.target.value)}
              className="w-full appearance-none pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <option value="">โครงการทั้งหมด</option>
              {masterProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <LayoutGrid size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-400"></div>
          </div>
        )}

        {onClear && (searchQuery || statusFilter || projectFilter || empFilter) && (
          <button 
            onClick={onClear}
            className="shrink-0 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors focus:ring-2 focus:ring-rose-200 outline-none"
          >
            <X size={16} /> ล้างค่า
          </button>
        )}
      </div>
    </div>
  );
};

