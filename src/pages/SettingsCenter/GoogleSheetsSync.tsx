import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, RefreshCw, Cloud, X, Edit, Save, CheckCircle, AlertCircle, Link, LogOut, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface SheetConfig {
  id: number;
  name: string;
  url: string;
}

interface AuthStatus {
  connected: boolean;
  hasUiCredentials: boolean;
  email?: string;
  expiresAt?: number;
}

export default function GoogleSheetsSync() {
  const { toast } = useApp();
  const [loading, setLoading] = useState(true);
  const [sheets, setSheets] = useState<SheetConfig[]>([]);
  const [editSheet, setEditSheet] = useState<SheetConfig | null>(null);
  
  // Real Google Auth States
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ connected: false, hasUiCredentials: false });
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showManualCode, setShowManualCode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [exchangingCode, setExchangingCode] = useState(false);

  // Syncing action state
  const [syncing, setSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState('');
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncResults, setSyncResults] = useState<any[] | null>(null);

  // Real stats
  const [totalRowsAvailable, setTotalRowsAvailable] = useState(0);

  // Load sheets and auth status
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        // Fetch configs
        const sheetsRes = await fetch('/api/store/google-sheets-sync');
        const sheetsData = await sheetsRes.json();
        if (Array.isArray(sheetsData) && sheetsData.length > 0) {
          setSheets(sheetsData);
        } else {
          const defaults = [
            { id: 1, name: 'Advance Records', url: 'https://docs.google.com/spreadsheets/d/xxx/edit#gid=0' },
            { id: 2, name: 'Clearance Records', url: 'https://docs.google.com/spreadsheets/d/xxx/edit#gid=1' },
            { id: 3, name: 'Employee Master', url: 'https://docs.google.com/spreadsheets/d/xxx/edit#gid=2' }
          ];
          setSheets(defaults);
          // Initialize in storage
          await fetch('/api/store/google-sheets-sync', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(defaults)
          });
        }

        // Fetch auth status
        await checkGoogleAuth();

        // Fetch state to see how many rows are there
        const stateRes = await fetch('/api/state');
        if (stateRes.ok) {
          const stateData = await stateRes.json();
          if (stateData && Array.isArray(stateData.advances)) {
            setTotalRowsAvailable(stateData.advances.length);
          }
        }
      } catch (err) {
        console.error('Failed to load sheets / auth configuration:', err);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  const checkGoogleAuth = async () => {
    setCheckingAuth(true);
    try {
      const res = await fetch('/api/google/status');
      if (res.ok) {
        const data = await res.json();
        setAuthStatus(data);
      }
    } catch (e) {
      console.error('Failed to check auth status:', e);
    } finally {
      setCheckingAuth(false);
    }
  };

  // Popup listener
  useEffect(() => {
    const handleOauthMessage = (event: MessageEvent) => {
      // Security: verify origin
      if (!event.origin.endsWith('.run.app') && !event.origin.includes('localhost') && !event.origin.includes('ai.studio')) {
        return;
      }
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        toast("เชื่อมต่อบัญชี Google สำเร็จ!", "ok");
        checkGoogleAuth();
      }
    };

    window.addEventListener('message', handleOauthMessage);
    return () => window.removeEventListener('message', handleOauthMessage);
  }, []);

  const handleConnectAutomated = async () => {
    try {
      const res = await fetch('/api/google/auth-url');
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to generate Auth URL');
      }
      const { url } = await res.json();
      
      const width = 600;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        url,
        'google_oauth_popup',
        `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        toast("ป๊อปอัพถูกบล็อก! กรุณาอนุญาตป๊อปอัพสำหรับไซต์นี้", "err");
      }
    } catch (err: any) {
      toast(err.message || 'ไม่สามารถเปิดหน้าต่างเชื่อมต่อได้', 'err');
    }
  };

  const handleManualCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    setExchangingCode(true);
    try {
      const res = await fetch('/api/google/exchange-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: manualCode.trim() })
      });

      if (res.ok) {
        const data = await res.json();
        toast(`เชื่อมต่อสำเร็จกับ: ${data.email}`, 'ok');
        setManualCode('');
        setShowManualCode(false);
        checkGoogleAuth();
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Exchange failed');
      }
    } catch (err: any) {
      toast(`เชื่อมต่อไม่สำเร็จ: ${err.message}`, 'err');
    } finally {
      setExchangingCode(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('คุณต้องการยกเลิกการซิงก์ข้อมูลทั้งหมดและออกจากระบบ Google Sheets หรือไม่?')) return;
    try {
      const res = await fetch('/api/google/disconnect', { method: 'POST' });
      if (res.ok) {
        setAuthStatus({ connected: false, hasUiCredentials: authStatus.hasUiCredentials });
        setSyncResults(null);
        toast('ยกเลิกการเชื่อมต่อเรียบร้อยแล้ว', 'ok');
      }
    } catch (e) {
      toast('มีข้อผิดพลาด', 'err');
    }
  };

  const handleForceSync = async () => {
    if (!authStatus.connected) {
      toast('กรุณาเชื่อมต่อบัญชี Google ก่อนเริ่มทำการซิงก์', 'err');
      return;
    }

    setSyncing(true);
    setSyncResults(null);
    setSyncProgress(15);
    setSyncStep("กำลังเชื่อมต่อเซิร์ฟเวอร์ และดึงข้อมูลคลังเอกสารล่าสุด...");

    setTimeout(() => {
      setSyncProgress(45);
      setSyncStep("กำลังจัดรูปแบบคอลัมน์และสร้างชุดแถว (Row-Set Mapping)...");
    }, 500);

    try {
      const res = await fetch('/api/google/sync-sheets', { method: 'POST' });
      setSyncProgress(85);
      setSyncStep("กำลังเรียกใช้ Google Sheets REST API และแก้ไขตารางแบบ Real-time...");

      if (res.ok) {
        const result = await res.json();
        setSyncResults(result.details || []);
        setSyncProgress(100);
        setSyncStep("ซิงก์ข้อมูลไปที่ตารางทั้งหมดเสร็จสิ้นเรียบร้อยแล้ว!");
        
        setTimeout(() => {
          setSyncing(false);
          toast("ซิงก์ข้อมููลคู่ขนานสำเร็จอย่างสมบูรณ์!", "ok");
        }, 1500);
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Sync request failed');
      }
    } catch (err: any) {
      setSyncing(false);
      toast(`การซิงก์ล้มเหลว: ${err.message}`, 'err');
    }
  };

  const handleSaveSheet = async () => {
    if (!editSheet) return;
    if (!editSheet.url.trim().startsWith('https://')) {
      toast("กรุณากรอก Google Sheet URL ที่ถูกต้อง (เริ่มต้นด้วย https://)", "err");
      return;
    }
    const updated = sheets.map(s => s.id === editSheet.id ? editSheet : s);
    try {
      const res = await fetch('/api/store/google-sheets-sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        setSheets(updated);
        setEditSheet(null);
        toast("อัปเดตลิงก์ Google Sheets เรียบร้อยแล้ว", "ok");
      } else {
        throw new Error();
      }
    } catch (e) {
      toast("มีข้อผิดพลาดในการบันทึกข้อมูล", "err");
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <RefreshCw className="animate-spin mx-auto mb-4 text-[#f4ac5c]" size={36} />
        <p className="font-medium">กำลังโหลดข้อมูลและตรวจสอบสิทธิ์ Google Sheets Sync...</p>
      </div>
    );
  }

  const hasPlaceholders = sheets.some(s => s.url.includes('/d/xxx/'));

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="text-emerald-500" /> Google Sheets Sync
          </h2>
          <p className="text-slate-500 text-sm mt-1">ตั้งค่าและทำการคัดลอก/ส่งตรงฐานข้อมูลใบสำรองจ่ายและเครดิตไปยังตารางทำงานของคุณ</p>
        </div>

        {authStatus.connected && (
          <button 
            onClick={handleForceSync} 
            disabled={syncing}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""}/> 
            {syncing ? 'กำลังซิงก์ข้อมูล...' : 'Force Sync All Now'}
          </button>
        )}
      </div>

      {/* Connection Wizard for Unauthenticated Users */}
      {!authStatus.connected ? (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-6">
          <div className="flex gap-4 items-start">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[#f4ac5c]">
              <AlertCircle size={28} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-800 text-lg">ยังไม่มีบัญชี Google เชื่อมต่ออยู่</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-2xl">
                เชื่อมโยงแอปใบเบิกสำรองจ่ายกับ Google Sheets ขององค์กรคุณ เพื่อเปิดใข้งานซิงก์ตารางงานแบบ real-time ทุกเอกสารอนุมัติหรือปรับสถานะจะถูกซิงก์ทันที
              </p>
              
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <button
                  onClick={handleConnectAutomated}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-md transition-colors flex items-center gap-2"
                >
                  <Cloud size={16} /> เชื่อเชื่อมต่อบัญชี Google
                </button>

                <button
                  onClick={() => setShowManualCode(!showManualCode)}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                >
                  {showManualCode ? 'ซ่อน' : 'เปิด'} การเชื่อมต่อแบบใส่ Code สำรอง
                </button>
              </div>

              {/* Manual code input */}
              {showManualCode && (
                <form onSubmit={handleManualCodeSubmit} className="mt-4 p-4 bg-white rounded-xl border border-slate-200 max-w-xl animate-in slide-in-from-top-1">
                  <h4 className="text-xs font-bold text-slate-700 mb-2">เชื่อมต่อผ่าน Authorization Code ด้วยตนเอง</h4>
                  <p className="text-slate-400 text-[11px] mb-3">
                    หากการตรวจจับป๊อปอัพพึ่งเด้งติดขัด หรือต้องการกำหนด URL แตกต่างจากที่ Google จำกัดไว้ ให้คลิกที่ลิ้งเพื่อขอ Code จาก Google แล้วนำมาวางป้อนด้านล่างนี้
                  </p>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualCode}
                      onChange={e => setManualCode(e.target.value)}
                      placeholder="วาง Google Authorization Code ที่นี่..."
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-slate-400"
                    />
                    <button
                      type="submit"
                      disabled={exchangingCode || !manualCode.trim()}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {exchangingCode ? 'กำลังยืนยัน...' : 'ยืนยันรหัส'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-5 mb-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-600">
              <CheckCircle size={22} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">ระบบเชื่อมโยงเรียบร้อยแล้ว</h3>
              <p className="text-xs font-medium text-emerald-700 flex items-center gap-1.5 mt-0.5">
                บัญชีใช้งาน: <span className="font-bold text-slate-700">{authStatus.email}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 px-3 py-1.5 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition-colors"
          >
            <LogOut size={13} /> ยกยกเลิกเชื่อมต่อ
          </button>
        </div>
      )}

      {/* Sync Action Steps status bar */}
      {syncing && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6 animate-in slide-in-from-top-2 duration-300">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-emerald-800 flex items-center gap-2">
              <RefreshCw size={16} className="animate-spin text-emerald-600"/> {syncStep}
            </span>
            <span className="text-xs font-bold text-emerald-700">{syncProgress}%</span>
          </div>
          <div className="w-full bg-emerald-100 h-2.5 rounded-full overflow-hidden">
            <div className="bg-emerald-600 h-full transition-all duration-300" style={{ width: `${syncProgress}%` }} />
          </div>
        </div>
      )}

      {/* Recap of Google Sheets Sync results */}
      {syncResults && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6 animate-in zoom-in-95 duration-200 text-left">
          <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-1.5">
            <CheckCircle size={16} className="text-emerald-500" /> ผลการซิงก์ข้อมูลล่าสุด
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {syncResults.map((res, idx) => (
              <div key={idx} className={`p-3 rounded-xl border ${res.status === 'synced' ? 'bg-emerald-50/20 border-emerald-100' : 'bg-slate-50/30 border-slate-200'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700">{res.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${res.status === 'synced' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-[#f4ac5c]'}`}>
                    {res.status === 'synced' ? 'สำเร็จ' : 'ข้าม'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{res.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics board */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className={`p-4 rounded-2xl border ${authStatus.connected ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
          <div className="text-slate-500 text-xs font-bold uppercase mb-1">Status</div>
          <div className={`text-xl font-bold flex items-center gap-1.5 ${authStatus.connected ? 'text-emerald-700' : 'text-slate-600'}`}>
            <Cloud size={20}/> {authStatus.connected ? 'Connected' : 'Offline'}
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-bold uppercase mb-1">Last Synced Status</div>
          <div className="text-xl font-bold text-slate-800">
            {syncResults ? 'เพิ่งซิงก์สำเร็จ' : 'พร้อมซิงก์'}
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-bold uppercase mb-1">Available Document Rows</div>
          <div className="text-xl font-bold text-slate-800">{totalRowsAvailable.toLocaleString()} แถว</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-bold uppercase mb-1">Errors Caught</div>
          <div className="text-xl font-bold text-slate-800">0</div>
        </div>
      </div>

      {/* Sheet mapping configuration panel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
         <div className="flex justify-between items-center mb-4">
           <div>
             <h3 className="font-bold text-slate-800">Sheet Mapping Configuration</h3>
             <p className="text-xs text-slate-400 mt-0.5">ระบุพิกัดที่อยู่ Google Spreadsheet ของคุณเพื่อจัดเก็บบันทึกข้อมูล (กรุณาให้สิทธิ์การเขียนผ่าน Google OAuth)</p>
           </div>
           
           {hasPlaceholders && (
             <div className="flex items-center gap-1.5 text-xs text-[#f4ac5c] bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg font-semibold">
               <AlertCircle size={14} /> กรุณาเปลี่ยนเป็นจริงด้วยการคลิก Edit
             </div>
           )}
         </div>

         <div className="space-y-4">
           {sheets.map(sheet => {
             const isSample = sheet.url.includes('/d/xxx/');
             return (
               <div key={sheet.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                 <div className="w-52 font-bold text-sm text-slate-700 flex items-center gap-2">
                   <FileSpreadsheet size={16} className={isSample ? "text-slate-400" : "text-emerald-500"}/>
                   {sheet.name}
                 </div>
                 <div className="flex-1 min-w-0 flex items-center gap-2">
                   <input 
                     type="text" 
                     value={sheet.url} 
                     className={`w-full bg-slate-50 border rounded-lg px-3 py-2 text-xs font-mono outline-none ${isSample ? 'border-amber-200 text-slate-400 bg-amber-50/10' : 'border-slate-200 text-slate-600'}`} 
                     readOnly 
                   />
                 </div>
                 <button 
                   onClick={() => setEditSheet({ ...sheet })} 
                   className="text-[#f4ac5c] hover:bg-amber-50 border border-transparent hover:border-amber-100 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1 transition-colors self-end sm:self-auto"
                 >
                   <Edit size={12}/> Edit link
                 </button>
               </div>
             );
           })}
         </div>
      </div>

      {/* Manual Sheet Link Editing Popup Modal */}
      {editSheet && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center">
           <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditSheet(null)} />
           <div className="relative bg-white rounded-2xl shadow-xl w-[550px] flex flex-col animate-in zoom-in-95 text-left overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex justify-between bg-slate-50 items-center">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="text-emerald-500" size={20} />
                  <h3 className="font-bold text-slate-800">แก้ไขที่อยู่ {editSheet.name}</h3>
                </div>
                <button onClick={() => setEditSheet(null)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
              </div>

              <div className="p-6 space-y-4">
                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Sheet Tab Name (ชื่อแท็บแสดงในชีต)</label>
                   <input 
                     type="text" 
                     value={editSheet.name} 
                     onChange={e => setEditSheet({ ...editSheet, name: e.target.value })}
                     className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:border-slate-400" 
                     placeholder="เช่น Advance Records"
                   />
                 </div>

                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Google Sheet URL ของคุณ (ที่ได้รับจากเบราว์เซอร์)</label>
                   <input 
                     type="text" 
                     value={editSheet.url} 
                     onChange={e => setEditSheet({ ...editSheet, url: e.target.value })}
                     className="w-full px-3 py-2.5 border rounded-lg text-xs font-mono focus:outline-none focus:border-slate-400" 
                     placeholder="https://docs.google.com/spreadsheets/d/your-unique-sheet-id/edit" 
                   />
                   <p className="text-[10px] text-slate-400 mt-1.5 flex items-start gap-1">
                     <AlertCircle size={12} className="shrink-0 mt-0.5 text-slate-400" />
                     <span>โปรดตรวจสอบให้แน่ใจว่าได้ระบุ URL ของชีตที่สอดคล้องกับคีย์สิทธิ์ บัญชีผู้ใช้นั้นต้องมีสิทธิ์เข้าถึงแก้ไขชีตนั้นด้วย</span>
                   </p>
                 </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                 <button onClick={() => setEditSheet(null)} className="px-4 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-600 font-bold transition-all hover:bg-slate-50">Cancel</button>
                 <button onClick={handleSaveSheet} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0">
                   <Save size={13}/> Save Mapping
                 </button>
              </div>
           </div>
         </div>
      )}
    </div>
  );
}
