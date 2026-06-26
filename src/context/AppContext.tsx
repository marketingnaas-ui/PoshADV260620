import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import { Advance, User, Project, Category } from '../types';
import { User as GoogleUser } from 'firebase/auth';
import { initGoogleAuth, googleSignIn, googleSignOut } from '../lib/google-auth';

interface AppState {
  advances: Advance[];
  settings: Record<string, boolean>;
  loading: boolean;
  syncStatus: 'loading' | 'saved' | 'saving' | 'error';
  page: string;
  setPage: (p: string, extra?: any) => void;
  pageExtra: any;
  updateSettings: (k: string, v: boolean) => void;
  addAdvance: (a: Advance) => void;
  updateAdvance: (id: string, partial: Partial<Advance>) => void;
  updateMultipleAdvances: (nextAdvances: Advance[]) => Promise<void>;
  deleteAdvance: (id: string) => void;
  toast: (msg: string, type?: string) => void;
  toastState: { msg: string; type: string; show: boolean };
  modal: { title: string; desc: ReactNode; actions: ReactNode; show: boolean };
  openModal: (title: string, desc: ReactNode, actions: ReactNode) => void;
  closeModal: () => void;
  openFilePreview: (file: any) => void;
  drawer: { hdr: ReactNode; body: ReactNode; foot: ReactNode; show: boolean };
  openDrawer: (hdr: ReactNode, body: ReactNode, foot?: ReactNode) => void;
  closeDrawer: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (o: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (c: boolean) => void;

  // Real-time master configurations
  masterUsers: User[];
  masterProjects: Project[];
  masterCategories: Category[];
  approvalMatrix: { signatureOwner: string; autoApproveThreshold: number };
  saveMasterUsers: (u: User[]) => Promise<void>;
  saveMasterProjects: (p: Project[]) => Promise<void>;
  saveMasterCategories: (c: Category[]) => Promise<void>;
  saveApprovalMatrix: (matrix: { signatureOwner: string; autoApproveThreshold: number }) => Promise<void>;
  refreshMasterUsers: () => Promise<void>;

  // Role access control configurations
  currentUser: User | null;
  setCurrentUser: (u: User | null) => void;
  // Google Workspace Integration
  googleUser: User | null;
  googleToken: string | null;
  isLoggingInGoogle: boolean;
  loginGoogle: () => Promise<void>;
  logoutGoogle: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

const uniqueById = <T extends { id?: string }>(list: T[]): T[] => {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  return list.filter(item => {
    if (!item || typeof item !== 'object') return false;
    if (!item.id) return true;
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'loading' | 'saved' | 'saving' | 'error'>('loading');

  const [currentUser, setCurrentUserInternal] = useState<User | null>(null);
  const [userRoles, setUserRoles] = useState<any[]>([]);

  const [masterUsers, setMasterUsers] = useState<User[]>([]);
  const [masterProjects, setMasterProjects] = useState<Project[]>([]);
  const [masterCategories, setMasterCategories] = useState<Category[]>([]);
  const [approvalMatrix, setApprovalMatrix] = useState({ signatureOwner: '', autoApproveThreshold: 5000 });

  const [page, setPageInternal] = useState('dashboard');
  const [pageExtra, setPageExtra] = useState<any>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const [toastState, setToastState] = useState({ msg: '', type: '', show: false });
  
  // Google Auth State
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState(false);
  const [modal, setModal] = useState({ title: '', desc: null as ReactNode, actions: null as ReactNode, show: false });
  const [drawer, setDrawer] = useState({ hdr: null as ReactNode, body: null as ReactNode, foot: null as ReactNode, show: false });

  const DEFAULT_ROLES = [
    { id: 'R1', name: 'Administrator', users: 3, type: 'Full Access', desc: 'เข้าถึงได้ทุกระบบและการตั้งค่า', permissions: ['dashboard', 'datacenter', 'list', 'clearinglist', 'create', 'approval', 'clearance', 'accounting', 'vault', 'reports', 'settings', 'staff-directory', 'project-settings', 'categories', 'access-control', 'pin-full-access', 'approval-workflow', 'ai-control', 'line-integration', 'google-sheet-sync', 'document-templates', 'number-running', 'backup-restore', 'system-health', 'audit-center'] },
    { id: 'R4', name: 'Executive', users: 1, type: 'Full Access', desc: 'ผู้บริหารระดับสูง อนุมัติเอกสารในระบบและผ่าน LINE มีสิทธิ์เข้าถึงเสมือนแอดมิน', permissions: ['dashboard', 'datacenter', 'list', 'clearinglist', 'create', 'approval', 'clearance', 'accounting', 'vault', 'reports', 'settings', 'staff-directory', 'project-settings', 'categories', 'access-control', 'pin-full-access', 'approval-workflow', 'ai-control', 'line-integration', 'google-sheet-sync', 'document-templates', 'number-running', 'backup-restore', 'system-health', 'audit-center'] },
    { id: 'R2', name: 'Accounting', users: 8, type: 'Custom', desc: 'สิทธิ์เฉพาะโมดูลการเงินและการตรวจสอบบัญชี', permissions: ['dashboard', 'datacenter', 'list', 'clearinglist', 'accounting', 'vault', 'reports'] },
    { id: 'R3', name: 'Employee / Requester', users: 131, type: 'Custom', desc: 'ขอเบิกเงินทดรองจ่ายและส่งงานเคลียร์ค่าใช้จ่าย', permissions: ['dashboard', 'list', 'clearinglist', 'create'] },
  ];

  const setCurrentUser = (u: User | null) => {
    setCurrentUserInternal(u);
    if (u) {
      localStorage.setItem('clear_advance_current_user', JSON.stringify(u));
    } else {
      localStorage.removeItem('clear_advance_current_user');
      localStorage.removeItem('clear_advance_auth_token');
    }
  };

  React.useEffect(() => {
    let active = true;
    
    // Step 1: Bootstrap / check session
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(authMe => {
        if (!active) return;
        if (authMe) {
          setCurrentUserInternal(authMe);
        } else {
          setCurrentUserInternal(null);
        }
      })
      .catch(() => {
        if (active) setCurrentUserInternal(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // Initialize Google Auth
    const unsubGoogle = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );

    return () => { 
      active = false; 
      unsubGoogle();
    };
  }, []);

  // Step 2: Fetch application data whenever an authenticated user is active
  React.useEffect(() => {
    if (!currentUser) {
      setSyncStatus('saved');
      return;
    }

    let active = true;
    setSyncStatus('loading');

    Promise.all([
      fetch('/api/state').then(r => {
        if (!r.ok) throw new Error('Failed to load state');
        return r.json();
      }),
      fetch('/api/store/master-users?t=' + Date.now()).then(r => { if (!r.ok) throw new Error('Fail'); return r.json(); }),
      fetch('/api/store/master-projects?t=' + Date.now()).then(r => { if (!r.ok) throw new Error('Fail'); return r.json(); }),
      fetch('/api/store/master-categories?t=' + Date.now()).then(r => { if (!r.ok) throw new Error('Fail'); return r.json(); }),
      fetch('/api/store/approval-matrix?t=' + Date.now()).then(r => { if (!r.ok) throw new Error('Fail'); return r.json(); }),
      fetch('/api/store/roles?t=' + Date.now()).then(r => { if (!r.ok) throw new Error('Fail'); return r.json(); })
    ])
      .then(([state, users, projects, categories, matrix, roles]) => {
        if (!active) return;
        setAdvances(uniqueById(Array.isArray(state.advances) ? state.advances : []));
        setSettings(state.settings && typeof state.settings === 'object' ? state.settings : {});
        
        const loadedUsers = Array.isArray(users) ? users : [];
        setMasterUsers(loadedUsers);

        const loadedRoles = Array.isArray(roles) && roles.length > 0 ? roles : DEFAULT_ROLES;
        setUserRoles(loadedRoles);

        const normalizedProjects = (Array.isArray(projects) ? projects : []).map((p: any) => ({
          ...p,
          id: p.id || p.code,
          code: p.code || p.id
        }));
        setMasterProjects(normalizedProjects);
        setMasterCategories(Array.isArray(categories) ? categories : []);
        if (matrix && typeof matrix === 'object') {
          setApprovalMatrix({
            signatureOwner: matrix.signatureOwner || '',
            autoApproveThreshold: Number(matrix.autoApproveThreshold) || 5000
          });
        }
        setSyncStatus('saved');
      })
      .catch(() => {
        if (!active) return;
        setSyncStatus('error');
      });

    return () => {
      active = false;
    };
  }, [currentUser?.id]);

  const loginGoogle = async () => {
    setIsLoggingInGoogle(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        toast('เชื่อมต่อ Google สำเร็จ', 'success');
      }
    } catch (err) {
      toast('การเชื่อมต่อ Google ล้มเหลว', 'err');
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  const logoutGoogle = async () => {
    await googleSignOut();
    setGoogleUser(null);
    setGoogleToken(null);
    toast('ยกเลิกการเชื่อมต่อ Google แล้ว', 'info');
  };

  const persistState = async (nextAdvances: Advance[], nextSettings: Record<string, boolean>) => {
    setSyncStatus('saving');
    try {
      const response = await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advances: nextAdvances, settings: nextSettings })
      });
      if (!response.ok) throw new Error('State save failed');
      const saved = await response.json();
      setAdvances(uniqueById(Array.isArray(saved.advances) ? saved.advances : nextAdvances));
      setSettings(saved.settings && typeof saved.settings === 'object' ? saved.settings : nextSettings);
      setSyncStatus('saved');
    } catch {
      setSyncStatus('error');
      toast('บันทึกข้อมูลลงเซิร์ฟเวอร์ไม่สำเร็จ', 'err');
    }
  };

  const saveMasterUsers = async (next: User[]) => {
    setMasterUsers(next);
    await fetch('/api/store/master-users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next)
    });
  };

  const refreshMasterUsers = async () => {
    const res = await fetch('/api/store/master-users?t=' + Date.now());
    if (res.ok) {
        const users = await res.json();
        setMasterUsers(Array.isArray(users) ? users : []);
    }
  };

  const saveMasterProjects = async (next: Project[]) => {
    console.log(`💾 saveMasterProjects called with length: ${next.length}`);
    const normalized = next.map((p: any) => ({
      ...p,
      id: p.id || p.code,
      code: p.code || p.id
    }));
    setMasterProjects(normalized);
    const response = await fetch('/api/store/master-projects', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized)
    });
    if (!response.ok) {
      console.error("Save failed", await response.text());
      toast("บันทึกโครงการไม่สำเร็จ", "error");
      throw new Error("Save failed");
    }
  };

  const saveMasterCategories = async (next: Category[]) => {
    setMasterCategories(next);
    const response = await fetch('/api/store/master-categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next)
    });
    if (!response.ok) {
      console.error("Save failed", await response.text());
      toast("บันทึกหมวดหมู่ไม่สำเร็จ", "error");
      throw new Error("Save failed");
    }
  };

  const saveApprovalMatrix = async (next: { signatureOwner: string; autoApproveThreshold: number }) => {
    setApprovalMatrix(next);
    await fetch('/api/store/approval-matrix', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next)
    });
  };

  const toast = (msg: string, type = '') => {
    setToastState({ msg, type, show: true });
    setTimeout(() => setToastState(s => ({ ...s, show: false })), 2600);
  };

  const setPage = (p: string, extra?: any) => {
    setPageInternal(p);
    setPageExtra(extra || {});
    setSidebarOpen(false);
    window.scrollTo(0, 0);
  };

  const uniqueAdvances = useMemo(() => uniqueById(advances), [advances]);

  const visibleAdvances = useMemo(() => {
    if (!currentUser) return [];
    const lowerRole = (currentUser.role || '').toLowerCase();
    const isStaff = lowerRole === 'administrator' || lowerRole === 'executive' || lowerRole === 'accounting' || lowerRole === 'admin' || lowerRole === 'ฝ่ายบัญชี';
    if (isStaff) return uniqueAdvances;
    return uniqueAdvances.filter(a => a.empId === currentUser.id || a.empName === currentUser.name);
  }, [uniqueAdvances, currentUser]);

  return (
    <AppContext.Provider value={{
      advances: visibleAdvances, settings, loading, syncStatus, page, setPage, pageExtra,
      updateSettings: (k, v) => setSettings(s => {
        const next = { ...s, [k]: v };
        void persistState(uniqueAdvances, next);
        return next;
      }),
      addAdvance: (a) => setAdvances(prev => {
        const next = uniqueById([...prev, a]);
        void persistState(next, settings);
        return next;
      }),
      updateAdvance: (id, partial) => setAdvances(prev => {
        const next = prev.map(a => a.id === id ? { ...a, ...partial } : a);
        void persistState(next, settings);
        return next;
      }),
      updateMultipleAdvances: async (nextAdvances) => {
        setAdvances(nextAdvances);
        await persistState(nextAdvances, settings);
      },
      deleteAdvance: (id) => setAdvances(prev => {
        const next = prev.filter(a => a.id !== id);
        void persistState(next, settings);
        return next;
      }),
      toast, toastState,
      modal, 
      openModal: (title, desc, actions) => setModal({ title, desc, actions, show: true }), 
      closeModal: () => setModal(m => ({ ...m, show: false })),
      openFilePreview: (f) => {
        if (!f) return;
        const getUrl = (file: any) => {
          if (!file) return '';
          if (typeof file === 'string') return file;
          return file.url || `/api/files/${file.id}/download`;
        };
        const getLabel = (file: any) => {
          if (!file) return 'เอกสารแนบ';
          if (typeof file === 'string') {
            try {
              const urlObj = new URL(file);
              return urlObj.pathname.substring(urlObj.pathname.lastIndexOf('/') + 1) || 'เอกสารแนบ';
            } catch {
              return file.substring(file.lastIndexOf('/') + 1) || file;
            }
          }
          return file.originalName || file.fileName || file.id;
        };

        const url = getUrl(f);
        const label = getLabel(f);
        const isImg = (typeof f === 'object' && f?.isImage) || 
                      (typeof f === 'string' && (/\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(f) || f.startsWith('data:image')));
        const isPdf = (typeof f === 'object' && f?.mimeType === 'application/pdf') || 
                      (typeof f === 'string' && /\.pdf(\?.*)?$/i.test(f));

        setModal({
          show: true,
          title: `👀 ตัวอย่างเอกสาร: ${label}`,
          desc: (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: 'var(--tx)', fontFamily: 'var(--font-sans)', width: '100%', minWidth: '290px', maxWidth: '600px' }}>
              {isImg ? (
                <img 
                  src={url} 
                  alt={label} 
                  style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--bdr)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                  referrerPolicy="no-referrer" 
                />
              ) : isPdf ? (
                <iframe 
                  src={url} 
                  title={label} 
                  style={{ width: '100%', height: '420px', border: '1px solid var(--bdr)', borderRadius: '8px', background: '#fff' }} 
                />
              ) : (
                <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--soft)', borderRadius: '8px', width: '100%', border: '1.5px dashed var(--bdr)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📄</div>
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>ไม่สามารถแสดงตัวอย่างไฟล์นี้โดยตรงได้</div>
                  <div style={{ fontSize: '12px', color: 'var(--tm)', marginTop: '6px' }}>สกุลไฟล์นี้อาจเป็น Excel, Word หรือประเภทอื่น โปรดดาวน์โหลดเพื่อไปเปิดตรวจสอบ</div>
                </div>
              )}
            </div>
          ),
          actions: (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
              <a 
                href={url} 
                download={label} 
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-p btn-sm" 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
              >
                📥 ดาวน์โหลดเอกสาร
              </a>
              <button onClick={() => setModal(m => ({ ...m, show: false }))} className="btn btn-o btn-sm">
                ปิดหน้าต่าง
              </button>
            </div>
          )
        });
      },
      drawer, openDrawer: (hdr, body, foot) => setDrawer({ hdr, body, foot, show: true }), closeDrawer: () => setDrawer(d => ({ ...d, show: false })),
      sidebarOpen, setSidebarOpen,
      sidebarCollapsed, setSidebarCollapsed,

      // Master configurations
      masterUsers, masterProjects, masterCategories, approvalMatrix,
      saveMasterUsers, saveMasterProjects, saveMasterCategories, saveApprovalMatrix, refreshMasterUsers,

      // Role access control configurations
      currentUser, setCurrentUser, userRoles, setUserRoles,

      // Google Workspace
      googleUser, googleToken, isLoggingInGoogle, loginGoogle, logoutGoogle
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext)!;
