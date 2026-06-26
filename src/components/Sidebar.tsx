import React, { useEffect, useRef } from 'react';
import { LayoutDashboard, Database, List, PlusCircle, CheckSquare, CreditCard, CornerRightDown, FileText, BarChart2, FolderArchive, ChevronLeft, ChevronRight, PieChart, History, MessageSquare } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SETTINGS_MENU } from '../config/settingsMenu';
import logoImg from '../assets/images/regenerated_image_1782327208256.png';

export const Sidebar = () => {
  const { advances, page, setPage, sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed, syncStatus, currentUser, userRoles } = useApp();
  
  const userRole = currentUser?.role || 'Employee / Requester';
  const lowerRole = userRole.toLowerCase();
  
  let permissions: string[] = [];
  if (lowerRole === 'administrator' || lowerRole === 'executive' || lowerRole === 'admin') {
    permissions = ['dashboard', 'project-cost-dashboard', 'datacenter', 'list', 'clearinglist', 'create', 'approval', 'clearance', 'accounting', 'vault', 'reports', 'settings', 'staff-directory', 'project-settings', 'categories', 'access-control', 'pin-full-access', 'approval-workflow', 'ai-control', 'line-integration', 'google-sheet-sync', 'document-templates', 'number-running', 'backup-restore', 'system-health', 'audit-center'];
  } else if (lowerRole === 'accounting' || lowerRole === 'ฝ่ายบัญชี') {
    permissions = ['dashboard', 'datacenter', 'list', 'clearinglist', 'accounting', 'vault', 'reports'];
  } else {
    // Regular employee / requester: only see dashboard, datacenter, create, clearance, vault
    permissions = ['dashboard', 'datacenter', 'create', 'clearance', 'vault'];
  }
  
  const isAdmin = lowerRole === 'administrator' || lowerRole === 'executive' || lowerRole === 'admin';

  const hasPerm = (id: string) => {
    if (isAdmin) return true;
    return permissions.includes(id);
  };

  const hasGroupPerm = (items: { id: string }[]) => {
    if (isAdmin) return true;
    return items.some(item => permissions.includes(item.id));
  };
  
  const cList = advances.filter(r => !['CLOSED', 'REJECTED', 'ปิดยอด', 'ไม่อนุมัติ', 'ปฏิเสธ'].includes(r.status)).length;
  const cApp = advances.filter(r => r.status === 'PENDING_APPROVAL' || r.status === 'รออนุมัติ').length;
  const isTransferStatus = (s: string) => s === 'WAITING_TRANSFER' || s === 'รอโอน' || s === 'รอโอนเงิน' || s === 'รอโอนเงินทดรอง' || s === 'รอโอนเงินทดรองจ่าย';
  const hasPayment = (r: any) => !!(r.pay && Object.keys(r.pay).length > 0) || !!r.tempSlip;
  const cPay = advances.filter(r => isTransferStatus(r.status) && !hasPayment(r)).length;
  const cClr = advances.filter(r => r.status === 'WAITING_CLEARANCE' || r.status === 'รอเคลียร์' || r.status === 'รอเคลียร์ยอด').length;
  const cAcc = advances.filter(r => r.status === 'WAITING_CLEARANCE' || r.status === 'รอเคลียร์' || r.status === 'รอเคลียร์ยอด').length;
  const cVault = advances.filter(r => ['WAITING_TRANSFER', 'WAITING_CLEARANCE', 'CLOSED', 'รอโอน', 'รอเคลียร์', 'รอเคลียร์ยอด', 'ปิดยอด'].includes(r.status)).length;

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const restartTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // Only run the idle timer if the sidebar is expanded (not collapsed)
    if (!sidebarCollapsed) {
      timerRef.current = setTimeout(() => {
        setSidebarCollapsed(true);
      }, 3000);
    }
  };

  // Re-evaluate when collapsed state changes
  useEffect(() => {
    if (!sidebarCollapsed) {
      restartTimer();

      // Global handler to keep sidebar open on user activity or screen scrolling
      const handleGlobalActivity = () => {
        restartTimer();
      };

      // Listen to comprehensive gestures, scrolls, swiping, clicking & typing on the entire device screen
      window.addEventListener('scroll', handleGlobalActivity, { passive: true });
      window.addEventListener('touchmove', handleGlobalActivity, { passive: true });
      window.addEventListener('touchstart', handleGlobalActivity, { passive: true });
      window.addEventListener('mousedown', handleGlobalActivity, { passive: true });
      window.addEventListener('mousemove', handleGlobalActivity, { passive: true });
      window.addEventListener('keydown', handleGlobalActivity, { passive: true });

      // Capture scrolling events within internal scrollable panels as well
      document.addEventListener('scroll', handleGlobalActivity, { capture: true, passive: true });

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        window.removeEventListener('scroll', handleGlobalActivity);
        window.removeEventListener('touchmove', handleGlobalActivity);
        window.removeEventListener('touchstart', handleGlobalActivity);
        window.removeEventListener('mousedown', handleGlobalActivity);
        window.removeEventListener('mousemove', handleGlobalActivity);
        window.removeEventListener('keydown', handleGlobalActivity);
        document.removeEventListener('scroll', handleGlobalActivity, { capture: true });
      };
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    }
  }, [sidebarCollapsed]);

  const handleSidebarClick = () => {
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
    } else {
      restartTimer();
    }
  };

  const NavItem = ({ id, label, icon: Icon, badge, activeSpecial }: { id: string; label: string; icon: any; badge?: number; key?: any, activeSpecial?: boolean }) => (
    <button 
      className={`ni ${page === id ? 'active' : ''} ${activeSpecial ? 'ni-special' : ''}`} 
      onClick={(e) => {
        e.stopPropagation();
        setPage(id);
        if (sidebarCollapsed) {
          setSidebarCollapsed(false);
        } else {
          restartTimer();
        }
      }}
      title={label}
    >
      <Icon size={15} />
      {!sidebarCollapsed && <span className="label-text">{label}</span>}
      {badge && badge > 0 ? (
        <span className={`bc ${sidebarCollapsed ? 'collapsed-badge' : ''}`}>{badge}</span>
      ) : null}
    </button>
  );

  return (
    <>
      <aside 
        className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} 
        id="sidebar"
        onClick={handleSidebarClick}
      >
      <div 
        className="slogo cursor-pointer" 
        onClick={(e) => {
          if (sidebarCollapsed) {
            e.stopPropagation();
            setSidebarCollapsed(false);
          }
        }}
        title={sidebarCollapsed ? "คลิกเพื่อขยายเมนู (Click to Expand)" : undefined}
      >
        <div className="flex items-center gap-2 overflow-hidden w-full">
          <div className="slogo-ic flex-shrink-0">
            <img 
              src={logoImg} 
              alt="POSH MANOR Logo" 
              className="w-6 h-6 object-contain" 
              referrerPolicy="no-referrer" 
            />
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="slogo-t truncate text-[14px]">POSH MANOR</div>
              <div className="slogo-s truncate text-[10px]">Advance System</div>
            </div>
          )}
          {!sidebarCollapsed && (
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSidebarCollapsed(true);
              }}
              className="w-6 h-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors flex-shrink-0 ml-1"
              title="ย่อเมนู"
            >
              <ChevronLeft size={14} />
            </button>
          )}
        </div>
      </div>
      <nav className="snav">
        {!sidebarCollapsed && <div className="snav-sec">ภาพรวม</div>}
        <NavItem id="dashboard" label="Executive Dashboard" icon={LayoutDashboard} />
        <NavItem id="project-cost-dashboard" label="ต้นทุนโครงการ" icon={PieChart} />
        
        {(!sidebarCollapsed && (hasPerm('datacenter') || hasPerm('list') || hasPerm('clearinglist') || hasPerm('create'))) && <div className="snav-sec">ข้อมูล</div>}
        {hasPerm('datacenter') && <NavItem id="datacenter" label="Advance Data Center" icon={Database} />}
        {hasPerm('list') && <NavItem id="list" label="Advance List" icon={List} badge={cList} />}
        {hasPerm('clearinglist') && <NavItem id="clearinglist" label="Clearing List" icon={FileText} badge={advances.reduce((acc, r) => acc + (r.clrs?.length || 0), 0)} />}
        {hasPerm('create') && <NavItem id="create" label="สร้างใบเบิก" icon={PlusCircle} />}
        
        {(!sidebarCollapsed && (hasPerm('approval') || hasPerm('clearance') || hasPerm('accounting'))) && <div className="snav-sec">Workflow</div>}
        {hasPerm('approval') && <NavItem id="approval" label="อนุมัติ & โอนเงิน" icon={CheckSquare} badge={cApp + cPay} />}
        {hasPerm('clearance') && <NavItem id="clearance" label="Clearance Center" icon={CornerRightDown} badge={cClr} activeSpecial={true} />}

        {hasPerm('accounting') && <NavItem id="accounting" label="Accounting Review" icon={CheckSquare} badge={cAcc} />}
        {hasPerm('accounting') && <NavItem id="document-tracking" label="Document Tracking" icon={FileText} badge={advances.filter(a => a.trackingRecord && a.trackingRecord.status !== 'Completed' && a.trackingRecord.status !== 'Ready For Accounting' && a.trackingRecord.status !== 'ERP Posted').length} />}
        
        {(!sidebarCollapsed && (hasPerm('detail') || hasPerm('vault') || hasPerm('reports'))) && <div className="snav-sec">รายงาน & ตั้งค่า</div>}
        {hasPerm('detail') && <NavItem id="detail" label="Advance Detail" icon={FileText} />}
        {hasPerm('accounting') && <NavItem id="audit-reports" label="ระบบตรวจสอบใบเคลียร์" icon={FileText} />}
        {hasPerm('accounting') && <NavItem id="clearance-ledger" label="ประวัติสะสมใบเคลียร์" icon={History} />}
        {hasPerm('vault') && <NavItem id="vault" label="Document Vault" icon={FolderArchive} badge={cVault} />}
        {hasPerm('reports') && <NavItem id="reports" label="Reports & Analytics" icon={BarChart2} />}
        {hasPerm('line-integration') && <NavItem id="flex-simulator" label="Flex Simulator" icon={MessageSquare} />}
        {hasPerm('summaryReport') && <NavItem id="summaryReport" label="Summary Report (TPL3)" icon={FileText} />}

        {SETTINGS_MENU.map((group) => {
          if (!hasGroupPerm(group.items)) return null;
          return (
            <React.Fragment key={group.section}>
              {!sidebarCollapsed && <div className="snav-sec">{group.section}</div>}
              {group.items.map((item) => {
                if (!hasPerm(item.id)) return null;
                return <NavItem key={item.id} id={item.id} label={item.label} icon={item.icon} />;
              })}
            </React.Fragment>
          );
        })}
      </nav>
      {!sidebarCollapsed && (
        <div className="sfooter">
          <span className="live"></span> Backend API &nbsp;·&nbsp; {syncStatus === 'saving' ? 'Saving' : syncStatus === 'error' ? 'Sync Error' : 'Saved'}<br/>
          <span style={{ color: 'var(--p)', fontWeight: 700 }}>Workflow: Create→Approve→Transfer→Clearance→Close</span>
        </div>
      )}
    </aside>
      
      {/* Mobile Overlay to fix overlapping perception and allow closing by clicking outside */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[90] lg:hidden animate-in fade-in duration-300" 
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
};
