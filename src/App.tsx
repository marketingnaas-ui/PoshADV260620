/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { GlobalUI } from './components/GlobalUI';
import { getSavedTheme, applyTheme } from './utils/theme';

import { Dashboard } from './pages/Dashboard';
import { DataCenter } from './pages/DataCenter';
import { AdvanceList } from './pages/AdvanceList';
import { ClearingList } from './pages/ClearingList';
import { CreateAdvance } from './pages/CreateAdvance';
import { ApprovalCenter } from './pages/ApprovalCenter';
import { ClearanceCenter } from './pages/ClearanceCenter';

import { AccountingReview } from './pages/AccountingReview';
import { AdvanceDetail } from './pages/AdvanceDetail';
import { Reports } from './utils/Reports';
import { DocumentVault } from './pages/SettingsCenter/DocumentVault';
import { SummaryReport } from './pages/SummaryReport';
import { DocumentTracking } from './pages/DocumentTracking';
import { ProjectCostDashboard } from './pages/ProjectCostDashboard';
import { AuditReportCenter } from './pages/AuditReportCenter';
import { ClearanceLedger } from './pages/ClearanceLedger';
import { FlexMessageSimulator } from './pages/FlexMessageSimulator';
import LoginPage from './pages/Login';

const StaffDirectory = React.lazy(() => import('./pages/SettingsCenter/StaffDirectory'));
const ProjectSettings = React.lazy(() => import('./pages/SettingsCenter/ProjectSettings'));
const Categories = React.lazy(() => import('./pages/SettingsCenter/Categories'));
const AccessControl = React.lazy(() => import('./pages/SettingsCenter/AccessControl'));
const PinFullAccess = React.lazy(() => import('./pages/SettingsCenter/PinFullAccess'));
const ApprovalWorkflow = React.lazy(() => import('./pages/SettingsCenter/ApprovalWorkflow'));
const AiControlCenter = React.lazy(() => import('./pages/SettingsCenter/AiControlCenter'));
const LineIntegration = React.lazy(() => import('./pages/SettingsCenter/LineIntegration'));
const GoogleSheetsSync = React.lazy(() => import('./pages/SettingsCenter/GoogleSheetsSync'));
const DocumentTemplates = React.lazy(() => import('./pages/SettingsCenter/DocumentTemplates'));
const CodeManagement = React.lazy(() => import('./pages/SettingsCenter/CodeManagement'));
const BackupRestore = React.lazy(() => import('./pages/SettingsCenter/BackupRestore'));
const SystemHealth = React.lazy(() => import('./pages/SettingsCenter/SystemHealth'));
const AuditCenter = React.lazy(() => import('./pages/SettingsCenter/AuditCenter'));

const AppContent = () => {
  const { page, loading, sidebarCollapsed, currentUser, userRoles, setCurrentUser } = useApp();

  const userRole = currentUser?.role || 'Employee / Requester';
  const roleObj = userRoles.find(r => r.name === userRole);
  const permissions = roleObj ? (roleObj.permissions || []) : [];
  const isAdmin = userRole === 'Administrator' || userRole === 'Executive';

  const hasPerm = (id: string) => {
    if (isAdmin) return true;
    if (id === 'dashboard' || id === 'project-cost-dashboard' || id === 'detail' || id === 'create' || id === 'summaryReport') return true;
    const isAccounting = userRole.toLowerCase() === 'accounting' || userRole === 'ฝ่ายบัญชี' || permissions.includes('accounting');
    if (isAccounting && (id === 'audit-reports' || id === 'clearance-ledger')) return true;
    return permissions.includes(id);
  };

  React.useEffect(() => {
    applyTheme(getSavedTheme());
  }, []);

  if (loading) {
    return (
      <div className="layout" id="app">
        <div className="main" style={{ gridColumn: '1 / -1' }}>
          <div className="pb" id="pc">
            <div className="card" style={{ padding: 28, textAlign: 'center' }}>
              <h2>กำลังโหลดข้อมูลระบบ</h2>
              <p style={{ color: 'var(--tm)' }}>เชื่อมต่อฐานข้อมูลในเครื่องผ่าน backend API...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  const AccessRestrictedView = () => (
    <div className="flex flex-col items-center justify-center py-20 px-6 max-w-lg mx-auto text-center bg-white rounded-2xl border border-slate-200 shadow-sm mt-12 animate-in zoom-in-95">
      <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>
      <h2 className="text-xl font-black text-rose-950 mb-2">Access Restricted</h2>
      <p className="text-sm text-slate-500 mb-6 leading-relaxed">
        ข้อมูลส่วนนี้ถูกจำกัดสิทธิ์สำหรับกลุ่มผู้ใช้งานสิทธิ์ <strong>{userRole}</strong> ของคุณตามระบบ Access Control
      </p>
      <div className="p-4 bg-slate-50 rounded-xl w-full border border-slate-100 text-left mb-6 space-y-2">
        <div className="text-xs text-slate-400 font-bold uppercase">Required Permissions</div>
        <div className="text-xs font-mono font-bold text-slate-700 bg-white px-2.5 py-1.5 rounded border border-slate-200 flex items-center justify-between">
          <span>Module Access: {page}</span>
          <span className="text-amber-600">Pending Privilege</span>
        </div>
      </div>
      <div className="flex gap-3">
        <button 
          onClick={() => window.history.back()}
          className="flex-1 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 font-bold text-white text-sm rounded-lg shadow-sm transition-colors"
        >
          Go Back
        </button>
      </div>
    </div>
  );

  return (
    <div className={`layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} id="app">
      <Sidebar />
      <div className="main">
        <Topbar />
        <div className="pb" id="pc">
          {!hasPerm(page) ? (
            <AccessRestrictedView />
          ) : (
            <>
              {page === 'dashboard' && <Dashboard />}
              {page === 'project-cost-dashboard' && <ProjectCostDashboard />}
              {page === 'datacenter' && <DataCenter />}
              {page === 'list' && <AdvanceList />}
              {page === 'clearinglist' && <ClearingList />}
              {page === 'create' && <CreateAdvance />}
              {(page === 'approval' || page === 'payment') && <ApprovalCenter />}
              {page === 'clearance' && <ClearanceCenter />}
              {page === 'accounting' && <AccountingReview />}
              {page === 'document-tracking' && <DocumentTracking />}
              {page === 'audit-reports' && <AuditReportCenter />}
              {page === 'clearance-ledger' && <ClearanceLedger />}
              {page === 'flex-simulator' && <FlexMessageSimulator />}
              {page === 'detail' && <AdvanceDetail />}
              {page === 'vault' && <DocumentVault />}
              {page === 'reports' && <Reports />}
              {page === 'summaryReport' && <SummaryReport />}
              
              <React.Suspense fallback={<div>Loading Settings...</div>}>
                {page === 'staff-directory' && <StaffDirectory />}
                {page === 'project-settings' && <ProjectSettings />}
                {page === 'categories' && <Categories />}
                {page === 'access-control' && <AccessControl />}
                {page === 'pin-full-access' && <PinFullAccess />}
                {page === 'approval-workflow' && <ApprovalWorkflow />}
                {page === 'ai-control' && <AiControlCenter />}
                {page === 'line-integration' && <LineIntegration />}
                {page === 'google-sheet-sync' && <GoogleSheetsSync />}
                {page === 'document-templates' && <DocumentTemplates />}
                {page === 'code-management' && <CodeManagement />}
                {page === 'backup-restore' && <BackupRestore />}
                {page === 'system-health' && <SystemHealth />}
                {page === 'audit-center' && <AuditCenter />}
              </React.Suspense>
            </>
          )}
        </div>
      </div>
      <GlobalUI />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
