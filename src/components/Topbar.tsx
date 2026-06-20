import React from 'react';
import { Menu } from 'lucide-react';
import { useApp } from '../context/AppContext';

const TITLES: Record<string, [string, string]> = {
  dashboard: ['Executive Dashboard', 'ภาพรวมผู้บริหาร · 17 มิ.ย. 2569'],
  datacenter: ['Advance Data Center', 'ศูนย์รวมข้อมูลทั้งหมด'],
  list: ['Advance List', 'รายการเงินทดรองจ่ายทั้งหมด'],
  clearinglist: ['Clearing List', 'รายการเคลียร์เงินทดรองจ่ายทั้งหมด'],
  create: ['สร้างใบเบิกเงินทดรอง', 'กรอกข้อมูลและส่งคำขอ'],
  approval: ['Approval Center', 'สำหรับผู้บริหาร · อนุมัติ / ปฏิเสธ'],
  payment: ['Payment Center', 'สำหรับการเงิน · โอนเงินและ Slip'],
  clearance: ['Clearance Center', 'เคลียร์ยอดเงินทดรอง'],
  detail: ['Advance Detail', 'ศูนย์กลาง Workflow ของแต่ละรายการ'],
  reports: ['Reports & Analytics', 'รายงานเชิงบริหาร'],
  settings: ['Settings', 'ตั้งค่าระบบ'],
};

export const Topbar = () => {
  const { page, setSidebarOpen, sidebarOpen, syncStatus, currentUser, setCurrentUser, masterUsers } = useApp();
  const [t, s] = TITLES[page] || ['', ''];

  const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    if (selectedId === 'SEM-0000') {
      setCurrentUser({
        id: 'SEM-0000',
        name: 'System Administrator',
        nickname: 'SA',
        position: 'IT Manager',
        role: 'Administrator',
        status: 'ใช้งาน'
      });
    } else {
      const userObj = masterUsers.find(u => u.id === selectedId);
      if (userObj) {
        setCurrentUser(userObj);
      }
    }
  };

  return (
    <header className="topbar">
      <div className="tb-l">
        <button className="ham" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="เมนู">
          <Menu size={22} />
        </button>
        <div>
          <div className="tb-title">{t}</div>
          <div className="tb-sub">{s}</div>
        </div>
      </div>
      <div className="tb-r" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ fontSize: '11px', color: 'var(--tm)', display: 'flex', alignItems: 'center', gap: '5px' }} className="hidden sm:flex">
          <span className="live"></span> {syncStatus === 'saving' ? 'Saving...' : syncStatus === 'error' ? 'Sync error' : 'Saved'}
        </div>
        
        {/* User Switcher Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 12px', borderRadius: '30px' }}>
          <span className="text-xs font-bold text-slate-500 hidden md:inline">Acting As:</span>
          <select 
            value={currentUser?.id || 'SEM-0000'}
            onChange={handleUserChange}
            className="text-xs font-bold text-slate-700 bg-transparent border-none outline-none cursor-pointer max-w-[150px] md:max-w-[200px] truncate"
            title="สลับผู้ใช้เพื่อทดสอบสิทธิ์ (Switch User to Test Role Permissions)"
          >
            <option value="SEM-0000">SA (Administrator)</option>
            {masterUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role || 'Employee'})</option>
            ))}
          </select>
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0" style={{ backgroundColor: currentUser?.role === 'Administrator' ? '#ef4444' : currentUser?.role === 'Accounting' ? '#4f46e5' : '#6b7280' }}>
            {currentUser?.name ? currentUser.name.substring(0, 2).toUpperCase() : 'US'}
          </span>
        </div>
      </div>
    </header>
  );
};
