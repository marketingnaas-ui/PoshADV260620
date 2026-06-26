import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { fmt, generateAdvanceId, UserAvt } from '../lib/utils';
import { fileLabel, fileUrl, uploadFileToServer } from '../lib/files';
import { User, AdvItem, AdvanceAttachment } from '../types';
import { useDocumentTemplates } from '../components/document-engine/useDocumentTemplates';
import { DocumentRenderer } from '../components/document-engine/DocumentRenderer';
import { FitPageViewer } from '../components/document-engine/FitPageViewer';
import { 
  User as UserIcon, 
  CreditCard, 
  Briefcase, 
  ListPlus, 
  FileText, 
  Paperclip, 
  Sparkles, 
  Plus, 
  Minus, 
  Trash2, 
  Check, 
  ChevronRight, 
  Eye, 
  Save, 
  Send,
  HelpCircle,
  X,
  Upload,
  Search
} from 'lucide-react';

export const CreateAdvance = () => {
  const { 
    advances, toast, setPage, addAdvance, updateAdvance, deleteAdvance, 
    pageExtra, masterUsers, masterProjects, masterCategories, 
    openModal, closeModal, openFilePreview 
  } = useApp();
  
  React.useEffect(() => {
    console.log('DEBUG: masterProjects in CreateAdvance:', masterProjects);
  }, [masterProjects]);
  
  // Mobile UI Steps: 1: Requester, 2: Projects & Info, 3: Items & Files, 4: Preview (on mobile)
  const [mobileStep, setMobileStep] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');
  
  const [emp, setEmp] = useState<User | null>(null);
  const [customUsers, setCustomUsers] = useState<User[]>([]);
  const [tempUserOpen, setTempUserOpen] = useState(false);
  const [tempUser, setTempUser] = useState({ name: '', dept: '', bank: '', bankNo: '' });
  const [bankEditOpen, setBankEditOpen] = useState(false);
  const [bankDraft, setBankDraft] = useState({ bank: '', bankNo: '', accountName: '' });
  const [projs, setProjs] = useState<string[]>([]);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [items, setItems] = useState<AdvItem[]>([{ id: 1, d: '', cat: 'C01', q: 1, u: 'ชุด', p: 0, t: 0 }]);
  const [nid, setNid] = useState(2);
  const [files, setFiles] = useState<AdvanceAttachment[]>([]);
  const [desc, setDesc] = useState<string>('');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const { publishedTemplates } = useDocumentTemplates();
  
  const isEditing = !!pageExtra?.editAdvanceId;
  const editAdvanceId = pageExtra?.editAdvanceId;
  const selectableUsers = React.useMemo(() => [...masterUsers.filter(u => u.role !== 'approver'), ...customUsers], [masterUsers, customUsers]);

  // Load existing advance for editing
  React.useEffect(() => {
    if (isEditing && editAdvanceId) {
      const adv = advances.find(a => a.id === editAdvanceId);
      if (adv) {
        const foundUser = selectableUsers.find(u => u.id === adv.empId) || {
          id: adv.empId,
          name: adv.empName,
          dept: adv.empDept,
          role: 'employee',
          bank: adv.payeeBank,
          bankNo: adv.payeeBankNo,
          ini: adv.empName.substring(0, 2)
        };
        setEmp(foundUser);
        setBankDraft({
          bank: adv.payeeBank,
          bankNo: adv.payeeBankNo,
          accountName: adv.payeeAccountName
        });
        setProjs(adv.pIds || []);
        if (adv.items && adv.items.length > 0) {
          setItems(adv.items);
          const maxId = adv.items.reduce((max, i) => Math.max(max, i.id || 0), 0);
          setNid(maxId + 1);
        }
        setFiles(adv.files || []);
        setDesc(adv.desc || '');
      }
    }
  }, [isEditing, editAdvanceId, advances, selectableUsers]);

  const total = items.reduce((s, i) => s + i.t, 0);
  const advNo = isEditing && editAdvanceId ? editAdvanceId : generateAdvanceId(advances);
  
  const payee = {
    bank: bankDraft.bank || emp?.bank || '',
    bankNo: bankDraft.bankNo || emp?.bankNo || '',
    accountName: bankDraft.accountName || emp?.name || ''
  };
  const formattedPayeeBankNo = payee.bankNo ? payee.bankNo.replace(/(\d{4})(\d{4})(\d{2})/, '$1 $2 $3') : '';

  const selectEmployee = (user: User) => {
    setEmp(user);
    setBankDraft({ bank: user.bank, bankNo: user.bankNo, accountName: user.name });
  };

  const addTemporaryUser = () => {
    const name = tempUser.name.trim();
    const dept = tempUser.dept.trim();
    const bank = tempUser.bank.trim();
    const bankNo = tempUser.bankNo.trim();
    if (!name || !dept || !bank || !bankNo) {
      toast('กรอกชื่อ หน่วยงาน ธนาคาร และเลขบัญชีของผู้เบิกชั่วคราวให้ครบ', 'err');
      return;
    }
    const user: User = {
      id: `TMP-${Date.now()}`,
      name,
      dept,
      role: 'employee',
      bank,
      bankNo,
      ini: name.slice(0, 2)
    };
    setCustomUsers(prev => [...prev, user]);
    selectEmployee(user);
    setTempUser({ name: '', dept: '', bank: '', bankNo: '' });
    setTempUserOpen(false);
    toast('เพิ่มผู้เบิกชั่วคราวในใบนี้แล้ว', 'ok');
  };

  const toggleProj = (id: string) => {
    if (projs.includes(id)) {
      setProjs(projs.filter(x => x !== id));
    } else {
      setProjs([...projs, id]);
    }
  };
  
  const updItem = (id: number, k: keyof AdvItem, v: any) => {
    setItems(items.map(i => {
      if (i.id !== id) return i;
      const updated = { ...i, [k]: v };
      updated.t = updated.q * updated.p;
      return updated;
    }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    if (!selectedFiles.length) return;

    setUploadingFiles(true);
    try {
      const uploaded = await Promise.all(selectedFiles.map(file =>
        uploadFileToServer(file, { relatedId: advNo, relatedType: 'ADVANCE_REQUEST', source: 'CreateAdvance' })
      ));
      setFiles(prev => [...prev, ...uploaded]);
      toast(`📎 อัปโหลดไฟล์ ${uploaded.length} รายการสำเร็จ`, 'ok');
    } catch (error: any) {
      toast(error.message || 'อัปโหลดไฟล์ไม่สำเร็จ', 'err');
    } finally {
      setUploadingFiles(false);
      e.target.value = '';
    }
  };

  const submit = async () => {
    if (!emp) return toast('กรุณาเลือกพนักงาน', 'err');
    if (!projs.length) return toast('กรุณาเลือกโปรเจกต์', 'err');
    if (!total) return toast('กรุณากรอกรายการและยอดเงิน', 'err');
    if (!payee.bank || !payee.bankNo || !payee.accountName) return toast('กรุณาระบุบัญชีรับเงินให้ครบ', 'err');
    
    const firstCat = items[0]?.cat || 'C01';
    const catObject = masterCategories.find(ct => ct.id === firstCat);
    const finalDesc = desc.trim() || items.map(i => i.d).filter(Boolean).join(', ') || 'ไม่มีรายละเอียดหมายเหตุเสริม';
    
    if (isEditing && editAdvanceId) {
      updateAdvance(editAdvanceId, {
        empId: emp.id,
        empName: emp.name,
        empDept: emp.dept,
        pIds: projs,
        pName: masterProjects.find(p => p.id === projs[0] || p.code === projs[0])?.name || '–',
        status: 'รออนุมัติ',
        amount: total,
        catId: firstCat,
        catName: catObject?.name || '–',
        payeeBank: payee.bank,
        payeeBankNo: payee.bankNo,
        payeeAccountName: payee.accountName,
        desc: finalDesc,
        items: [...items],
        files: [...files]
      });
      toast(`✓ อัปเดตและส่ง ${editAdvanceId} สำเร็จ · สถานะ: รออนุมัติ`, 'ok');
    } else {
      let finalAdvNo = advNo;
      try {
        const response = await fetch('/api/generate-running-number', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'ADV' })
        });
        const data = await response.json();
        if (data.number) finalAdvNo = data.number;
      } catch (err) {}

      addAdvance({
        id: finalAdvNo,
        empId: emp.id,
        empName: emp.name,
        empDept: emp.dept,
        pIds: projs,
        pName: masterProjects.find(p => p.id === projs[0] || p.code === projs[0])?.name || '–',
        reqDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        appDate: null,
        appBy: null,
        status: 'รออนุมัติ',
        amount: total,
        appAmount: 0,
        clrAmount: 0,
        catId: firstCat,
        catName: catObject?.name || '–',
        payeeBank: payee.bank,
        payeeBankNo: payee.bankNo,
        payeeAccountName: payee.accountName,
        desc: finalDesc,
        items: [...items],
        files: [...files],
        clrs: [],
        pay: null
      });
      toast(`✓ ส่ง ${finalAdvNo} สำเร็จ · สถานะ: รออนุมัติ`, 'ok');
    }
    
    setTimeout(() => setPage('list'), 1200);
  };

  const saveDraft = async () => {
    const finalDesc = desc.trim() || items.map(i => i.d).filter(Boolean).join(', ') || 'ไม่มีรายละเอียดหมายเหตุเสริม';
    const draft = {
      id: isEditing && editAdvanceId ? `DRAFT-${editAdvanceId}` : `DRAFT-${advNo}`,
      advNo: isEditing && editAdvanceId ? editAdvanceId : advNo,
      employee: emp,
      projectIds: projs,
      items,
      files,
      payee,
      total,
      desc,
      updatedAt: new Date().toISOString()
    };
    try {
      const response = await fetch('/api/store/advance-drafts');
      const loaded = await response.json().catch(() => []);
      const existing = Array.isArray(loaded) ? loaded.filter((item: any) => item.id !== draft.id) : [];
      const saveResponse = await fetch('/api/store/advance-drafts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([draft, ...existing])
      });
      if (!saveResponse.ok) throw new Error('Save draft failed');

      const firstCat = items[0]?.cat || 'C01';
      const catObject = masterCategories.find(ct => ct.id === firstCat);

      if (isEditing && editAdvanceId) {
        updateAdvance(editAdvanceId, {
          empId: emp?.id || 'TMP-DRAFT',
          empName: emp?.name || 'แบบร่างผู้ขอเบิก',
          empDept: emp?.dept || '–',
          pIds: projs,
          pName: masterProjects.find(p => p.id === projs[0] || p.code === projs[0])?.name || '–',
          status: 'บันทึกร่าง',
          amount: total,
          catId: firstCat,
          catName: catObject?.name || '–',
          payeeBank: payee.bank,
          payeeBankNo: payee.bankNo,
          payeeAccountName: payee.accountName,
          desc: finalDesc,
          items: [...items],
          files: [...files]
        });
        toast(`💾 อัปเดตและบันทึกร่าง ${editAdvanceId} เรียบร้อย`, 'ok');
      } else {
        addAdvance({
          id: advNo,
          empId: emp?.id || 'TMP-DRAFT',
          empName: emp?.name || 'แบบร่างผู้ขอเบิก',
          empDept: emp?.dept || '–',
          pIds: projs,
          pName: masterProjects.find(p => p.id === projs[0] || p.code === projs[0])?.name || '–',
          reqDate: new Date().toISOString().slice(0, 10),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          appDate: null,
          appBy: null,
          status: 'บันทึกร่าง',
          amount: total,
          appAmount: 0,
          clrAmount: 0,
          catId: firstCat,
          catName: catObject?.name || '–',
          payeeBank: payee.bank,
          payeeBankNo: payee.bankNo,
          payeeAccountName: payee.accountName,
          desc: finalDesc,
          items: [...items],
          files: [...files],
          clrs: [],
          pay: null
        });
        toast(`💾 บันทึกร่าง ${advNo} ลงฐานข้อมูลแล้ว`, 'ok');
      }

      setTimeout(() => setPage('list'), 1200);
    } catch (error: any) {
      toast(error.message || 'บันทึกร่างไม่สำเร็จ', 'err');
    }
  };

  // Helper to determine the gradient card based on the bank selected
  const getBankGradient = (bankName: string) => {
    const bank = String(bankName).toLowerCase();
    if (bank.includes('กสิกร') || bank.includes('kbank')) return 'from-emerald-700 to-emerald-500';
    if (bank.includes('ไทยพาณิชย์') || bank.includes('scb')) return 'from-purple-800 to-purple-600';
    if (bank.includes('กรุงเทพ') || bank.includes('bbl')) return 'from-blue-900 to-blue-700';
    if (bank.includes('กรุงศรี') || bank.includes('bay')) return 'from-amber-600 to-yellow-500';
    if (bank.includes('กรุงไทย') || bank.includes('ktb')) return 'from-sky-600 to-sky-400';
    if (bank.includes('ทหารไทย') || bank.includes('ttb')) return 'from-indigo-600 to-orange-500';
    return 'from-[#4E958D] to-[#6bada6]';
  };

  return (
    <>
      {/* Page Header (Hidden on print) */}
      <div className="ph lg:mb-4 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
          <div>
            <h2 className="text-[#1a2e2d] font-bold text-lg md:text-xl">สร้างใบเบิกเงินทดรอง (Create Advance)</h2>
            <p className="text-[#5a7a79]">ระบบป้อนข้อมูลแบบ Interactive สะดวกรวดเร็ว ปรับปรุงเพื่อสมาร์ตโฟน</p>
          </div>
          
          {/* Main Desktop/Mobile tab switch */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button 
              onClick={() => setActiveTab('form')}
              className={`flex items-center gap-1.5 py-1.5 px-4 rounded-lg text-xs font-bold transition-all ${activeTab === 'form' ? 'bg-white text-[#4E958D] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <FileText size={14} /> ป้อนข้อมูลเอกสาร
            </button>
            <button 
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 py-1.5 px-4 rounded-lg text-xs font-bold transition-all ${activeTab === 'preview' ? 'bg-white text-[#4E958D] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Eye size={14} /> ดูเอกสาร (Preview)
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Mobile Stepper Info Box (Only visible in form tab on mobile) */}
      {activeTab === 'form' && (
        <div className="lg:hidden mb-4 no-print">
          <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-[#bdr2] shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ขั้นตอนความคืบหน้า</span>
            <span className="text-xs font-black text-[#4E958D] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Step {mobileStep} of 3</span>
          </div>
          
          {/* Stepper Buttons for instant jump */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            <button 
              onClick={() => setMobileStep(1)} 
              className={`py-2 px-1 rounded-lg text-[11px] font-bold border transition-all text-center ${mobileStep === 1 ? 'bg-[#4E958D] border-[#4E958D] text-white shadow-sm' : 'bg-white text-slate-500 border-slate-200'}`}
            >
              1. ผู้เบิก & บัญชี
            </button>
            <button 
              onClick={() => setMobileStep(2)} 
              className={`py-2 px-1 rounded-lg text-[11px] font-bold border transition-all text-center ${mobileStep === 2 ? 'bg-[#4E958D] border-[#4E958D] text-white shadow-sm' : 'bg-white text-slate-500 border-slate-200'}`}
            >
              2. โครงการ & งาน
            </button>
            <button 
              onClick={() => setMobileStep(3)} 
              className={`py-2 px-1 rounded-lg text-[11px] font-bold border transition-all text-center ${mobileStep === 3 ? 'bg-[#4E958D] border-[#4E958D] text-white shadow-sm' : 'bg-white text-slate-500 border-slate-200'}`}
            >
              3. รายการ & แนบไฟล์
            </button>
          </div>
        </div>
      )}

      {/* Main Grid Workspace */}
      <div className={`grid grid-cols-1 ${activeTab === 'preview' ? '' : 'lg:grid-cols-2'} gap-0 lg:gap-6`}>
        
        {/* Left Side: Interactive Mobile-First Form Forms */}
        <div className={`w-full ${activeTab === 'preview' ? 'hidden' : 'block'} no-print`}>
          
          {/* STEP 1: Requester & Bank Card passbook */}
          <div className={`transition-all duration-300 ${activeTab === 'form' && (mobileStep === 1 || window.innerWidth >= 1024) ? 'block' : 'hidden lg:block'}`}>
            
            {/* Requester Select */}
            <div className="fs shadow-sm hover:border-[#4E958D]/30 transition-colors">
              <div className="fs-h flex items-center justify-between">
                <span className="flex items-center gap-2"><UserIcon size={16} /> 1. ผู้ขอเบิกเงินทดรองจ่าย</span>
                <button 
                  type="button" 
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-[11px] font-bold text-slate-600 flex items-center gap-1 transition" 
                  onClick={() => setTempUserOpen(v => !v)}
                >
                  {tempUserOpen ? 'ปิดฟอร์ม' : '+ ผู้เบิกชั่วคราว'}
                </button>
              </div>
              <div className="fs-b space-y-3">
                {tempUserOpen && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 animate-in slide-in-from-top-4 duration-200">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wide mb-1">ข้อมูลผู้เบิกชั่วคราว (Temporary Employee Form)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input 
                        placeholder="ชื่อผู้เบิกชั่วคราว" 
                        value={tempUser.name} 
                        onChange={e => setTempUser(v => ({ ...v, name: e.target.value }))}
                        className="p-2 border border-slate-200 rounded-lg text-xs"
                      />
                      <input 
                        placeholder="หน่วยงาน / ฝ่าย" 
                        value={tempUser.dept} 
                        onChange={e => setTempUser(v => ({ ...v, dept: e.target.value }))}
                        className="p-2 border border-slate-200 rounded-lg text-xs"
                      />
                      <input 
                        placeholder="ธนาคาร (เช่น กสิกร, ไทยพาณิชย์)" 
                        value={tempUser.bank} 
                        onChange={e => setTempUser(v => ({ ...v, bank: e.target.value }))}
                        className="p-2 border border-slate-200 rounded-lg text-xs"
                      />
                      <input 
                        placeholder="เลขบัญชีรับเงิน" 
                        value={tempUser.bankNo} 
                        onChange={e => setTempUser(v => ({ ...v, bankNo: e.target.value }))}
                        className="p-2 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <button 
                      type="button" 
                      className="w-full py-2 bg-[#4E958D] text-white hover:bg-[#3d7a73] font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition" 
                      onClick={addTemporaryUser}
                    >
                      <Check size={14} /> เพิ่มและเลือกผู้เบิกนี้
                    </button>
                  </div>
                )}
                
                {selectableUsers.length === 0 ? (
                  <div className="text-center py-4 text-slate-400 text-xs">กรุณาเพิ่มสมาชิกในหน้า "Settings" เพื่อเริ่มใช้งาน</div>
                ) : (
                  <div className="relative">
                    <select 
                      value={emp?.id || ''} 
                      onChange={e => {
                        const u = selectableUsers.find(x => x.id === e.target.value);
                        if (u) selectEmployee(u);
                      }}
                      className="w-full py-2.5 px-3 rounded-lg border-2 border-slate-200 bg-white text-slate-800 text-xs font-semibold focus:border-[#4E958D] focus:ring-0 outline-none cursor-pointer"
                    >
                      <option value="">-- เลือกผู้ขอเบิกเงินทดรองจ่าย --</option>
                      {selectableUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          👤 {u.name} ({u.dept})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Payee Bank Account Widget (Visual Passbook Card) */}
            <div className="fs shadow-sm hover:border-[#4E958D]/30 transition-colors">
              <div className="fs-h flex items-center justify-between">
                <span className="flex items-center gap-2"><CreditCard size={16} /> 2. บัญชีธนาคารรับเงินโอน</span>
                {emp && (
                  <button 
                    type="button" 
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-[11px] font-bold text-slate-600 flex items-center gap-1 transition" 
                    onClick={() => setBankEditOpen(v => !v)}
                  >
                    {bankEditOpen ? 'ปิดฟอร์ม' : '✏️ แก้ไขบัญชี'}
                  </button>
                )}
              </div>
              <div className="fs-b">
                {emp ? (
                  <div className="space-y-4">
                    {/* Visual Fintech Bank Card */}
                    <div className={`bnk bg-gradient-to-r ${getBankGradient(payee.bank)} shadow-md p-5 text-white rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[120px] transition-all`}>
                      <div className="absolute right-[-15px] top-[-15px] w-24 h-24 bg-white/10 rounded-full" />
                      <div className="absolute right-[40px] bottom-[-20px] w-16 h-16 bg-white/5 rounded-full" />
                      
                      <div className="flex justify-between items-start z-10">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-widest opacity-75">ธนาคารปลายทาง (Recipient Bank)</p>
                          <p className="text-sm font-bold mt-1">🏦 {payee.bank || 'กรุณาระบุ'}</p>
                        </div>
                        <span className="text-xl opacity-60">💳</span>
                      </div>
                      
                      <div className="mt-4 z-10">
                        <p className="text-[16px] font-mono tracking-widest font-black">{formattedPayeeBankNo || '✖✖✖ - ✖✖✖✖✖ - ✖'}</p>
                        <p className="text-xs font-bold mt-2 truncate">{payee.accountName || emp.name}</p>
                      </div>
                    </div>

                    {bankEditOpen && (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in slide-in-from-top-4 duration-200">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-wide">แก้ไขบัญชีเฉพาะรายการนี้ (Override Account for this request)</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                            <label className="text-[11px] font-semibold text-slate-500 mb-0.5 block">ชื่อบัญชีรับเงิน</label>
                            <input 
                              placeholder="ชื่อผู้รับเงิน" 
                              value={bankDraft.accountName} 
                              onChange={e => setBankDraft(v => ({ ...v, accountName: e.target.value }))}
                              className="p-2 border border-slate-200 rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-500 mb-0.5 block">ธนาคาร</label>
                            <input 
                              placeholder="เช่น กสิกรไทย" 
                              value={bankDraft.bank} 
                              onChange={e => setBankDraft(v => ({ ...v, bank: e.target.value }))}
                              className="p-2 border border-slate-200 rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-500 mb-0.5 block">เลขที่บัญชี</label>
                            <input 
                              placeholder="เช่น 1234567890" 
                              value={bankDraft.bankNo} 
                              onChange={e => setBankDraft(v => ({ ...v, bankNo: e.target.value }))}
                              className="p-2 border border-slate-200 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            type="button" 
                            className="flex-1 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-bold text-xs rounded-lg transition" 
                            onClick={() => emp && setBankDraft({ bank: emp.bank, bankNo: emp.bankNo, accountName: emp.name })}
                          >
                            ใช้บัญชีหลักของบริษัท
                          </button>
                          <button 
                            type="button" 
                            className="flex-1 py-1.5 bg-[#4E958D] text-white hover:bg-[#3d7a73] font-bold text-xs rounded-lg transition" 
                            onClick={() => setBankEditOpen(false)}
                          >
                            บันทึกแก้ไข
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs">เลือกผู้ขอเบิกในหัวข้อด้านบน บัตรบัญชีรับเงินจะปรากฏขึ้นโดยอัตโนมัติ</div>
                )}
              </div>
            </div>

            {/* Next Button for mobile */}
            <div className="lg:hidden mt-4">
              <button 
                type="button" 
                onClick={() => emp ? setMobileStep(2) : toast('กรุณาเลือกผู้ขอเบิกเงินทดรองจ่ายก่อน', 'err')}
                className="w-full py-3 bg-[#4E958D] hover:bg-[#3d7a73] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1 shadow-sm"
              >
                ถัดไป: เลือกโครงการ <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* STEP 2: Projects & Description */}
          <div className={`transition-all duration-300 ${activeTab === 'form' && (mobileStep === 2 || window.innerWidth >= 1024) ? 'block' : 'hidden lg:block'}`}>
            
            {/* Project Selection with Compact Searchable Multi-select Dropdown */}
            <div className="fs shadow-sm hover:border-[#4E958D]/30 transition-colors !overflow-visible">
              <div className="fs-h">
                <span className="flex items-center gap-2"><Briefcase size={16} /> 3. โครงการ/โครงการก่อสร้างที่เกี่ยวข้อง</span>
              </div>
              <div className="fs-b space-y-3 relative">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  เลือกโครงการเพื่อแชร์ร่วมหรือเปลี่ยนรายการ (เลือกได้มากกว่า 1 โครงการ โดยระบบจะจัดหมวดหมู่ให้อัตโนมัติ)
                </p>
                {masterProjects.length === 0 ? (
                  <div className="py-2 text-slate-400 text-xs">กรุณาเพิ่มโปรเจกต์ในหน้า "Settings" ก่อน</div>
                ) : (
                  <div className="relative w-full">
                    {/* Backdrop to close dropdown when clicking outside */}
                    {isProjectDropdownOpen && (
                      <div 
                        className="fixed inset-0 z-10 cursor-default" 
                        onClick={() => setIsProjectDropdownOpen(false)} 
                      />
                    )}
                    
                    {/* Search input container */}
                    <div className="relative z-20 flex items-center border-2 border-slate-200 focus-within:border-[#4E958D] bg-white rounded-xl px-3 py-1.5 transition-all">
                      <Search size={16} className="text-slate-400 mr-2 shrink-0" />
                      <input
                        type="text"
                        placeholder="พิมพ์รหัสหรือชื่อโครงการเพื่อค้นหา..."
                        value={projectSearchQuery}
                        onFocus={() => setIsProjectDropdownOpen(true)}
                        onChange={(e) => {
                          setProjectSearchQuery(e.target.value);
                          setIsProjectDropdownOpen(true);
                        }}
                        className="w-full bg-transparent outline-none border-none text-xs text-slate-800 placeholder-slate-400 py-1"
                      />
                      {projectSearchQuery && (
                        <button 
                          type="button" 
                          onClick={() => setProjectSearchQuery('')} 
                          className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1.5"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {/* Dropdown Menu */}
                    {isProjectDropdownOpen && (
                      <div className="absolute left-0 right-0 z-30 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {masterProjects.filter(p => {
                          const pId = p.id || p.code || '';
                          const pName = p.name || '';
                          return pId.toLowerCase().includes(projectSearchQuery.toLowerCase()) || 
                                 pName.toLowerCase().includes(projectSearchQuery.toLowerCase());
                        }).length === 0 ? (
                          <div className="p-3 text-xs text-slate-400 text-center">ไม่พบโครงการที่สอดคล้อง</div>
                        ) : (
                          masterProjects.filter(p => {
                            const pId = p.id || p.code || '';
                            const pName = p.name || '';
                            return pId.toLowerCase().includes(projectSearchQuery.toLowerCase()) || 
                                   pName.toLowerCase().includes(projectSearchQuery.toLowerCase());
                          }).map(p => {
                            const pId = p.id || p.code;
                            const isSelected = projs.includes(pId);
                            return (
                              <button
                                key={pId}
                                type="button"
                                onClick={() => toggleProj(pId)}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-slate-50 text-xs transition-all ${
                                  isSelected ? 'bg-emerald-50/70 text-[#4E958D] font-bold' : 'text-slate-600'
                                }`}
                              >
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-400 font-black tracking-wider uppercase">{pId}</span>
                                  <span className="mt-0.5">{p.name}</span>
                                </div>
                                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 border ${
                                  isSelected ? 'bg-[#4E958D] border-[#4E958D] text-white' : 'border-slate-300 text-transparent'
                                }`}>
                                  ✓
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Active Selected Tags Display */}
                {projs.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">เลือกแล้ว ({projs.length}):</span>
                    {projs.map(pid => {
                      const p = masterProjects.find(x => x.id === pid || x.code === pid);
                      return (
                        <span key={pid} className="inline-flex items-center gap-1 bg-[#E8F5F4] text-[#4E958D] px-2 py-0.5 rounded-full text-[10px] font-bold border border-[#4E958D]/10">
                          {p?.name || pid}
                          <button 
                            type="button" 
                            onClick={() => setProjs(projs.filter(x => x !== pid))} 
                            className="hover:text-red-500 font-extrabold ml-1.5 text-xs inline-flex items-center justify-center"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Note & Description */}
            <div className="fs shadow-sm hover:border-[#4E958D]/30 transition-colors">
              <div className="fs-h">
                <span className="flex items-center gap-2"><FileText size={16} /> 4. รายละเอียดและหมายเหตุเพิ่มเติม</span>
              </div>
              <div className="fs-b">
                <textarea 
                  placeholder="กรอกวัตถุประสงค์ของการเบิกเงินทดรองจ่ายนี้ หรือรายละเอียดสถานที่ซ่อมบำรุง/งานจัดหาวัสดุ เพื่อให้ผู้อนุมัติสามารถพิจารณาตรวจสอบได้สะดวก..." 
                  value={desc} 
                  onChange={e => setDesc(e.target.value)}
                  className="w-full min-h-[100px] border-2 border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:border-[#4E958D] outline-none"
                />
              </div>
            </div>

            {/* Stepper Buttons for mobile */}
            <div className="lg:hidden mt-4 flex gap-3">
              <button 
                type="button" 
                onClick={() => setMobileStep(1)}
                className="flex-1 py-3 bg-white border border-slate-300 text-slate-600 font-bold text-sm rounded-xl text-center"
              >
                ย้อนกลับ
              </button>
              <button 
                type="button" 
                onClick={() => projs.length > 0 ? setMobileStep(3) : toast('กรุณาเลือกโครงการที่เกี่ยวข้องอย่างน้อย 1 รายการ', 'err')}
                className="flex-1 py-3 bg-[#4E958D] hover:bg-[#3d7a73] text-white font-bold text-sm rounded-xl text-center shadow-sm"
              >
                ถัดไป: ป้อนรายการเบิก
              </button>
            </div>
          </div>

          {/* STEP 3: Items List & Attachments */}
          <div className={`transition-all duration-300 ${activeTab === 'form' && (mobileStep === 3 || window.innerWidth >= 1024) ? 'block' : 'hidden lg:block'}`}>
            
            {/* Items Creator: Highly interactive card-based items list on Mobile, clean tables on Desktop */}
            <div className="fs shadow-sm hover:border-[#4E958D]/30 transition-colors">
              <div className="fs-h">
                <span className="flex items-center gap-2"><ListPlus size={16} /> 5. รายการเบิกเงินและยอดคำนวณ</span>
              </div>
              <div className="fs-b space-y-4">
                
                {/* 1. Mobile view (Card-based layout) */}
                <div className="block md:hidden space-y-3">
                  {items.map((it, idx) => (
                    <div key={it.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5 relative">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                        <span className="text-xs font-black text-[#4E958D]">รายการที่ {idx + 1}</span>
                        {items.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => setItems(items.filter(x => x.id !== it.id))}
                            className="p-1 hover:bg-red-50 text-red-500 rounded-md transition"
                            title="ลบรายการนี้"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                      
                      {/* Name */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 block mb-0.5">ชื่อสินค้า/บริการ</label>
                        <input 
                          placeholder="เช่น ค่าจัดหาอิฐมวลเบา 150 ก้อน" 
                          value={it.d} 
                          onChange={e => updItem(it.id!, 'd', e.target.value)}
                          className="p-2 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Category */}
                        <div className="col-span-2">
                          <label className="text-[11px] font-bold text-slate-500 block mb-0.5">หมวดหมู่</label>
                          <select 
                            value={it.cat} 
                            onChange={e => updItem(it.id!, 'cat', e.target.value)}
                            className="p-2 border border-slate-200 rounded-lg text-xs bg-white"
                          >
                            {masterCategories.map(ct => (
                              <option key={ct.id} value={ct.id}>🏷️ {ct.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Price */}
                        <div>
                          <label className="text-[11px] font-bold text-slate-500 block mb-0.5">ราคาต่อหน่วย (฿)</label>
                          <input 
                            type="number" 
                            min="0"
                            placeholder="0"
                            value={it.p === 0 ? '' : it.p} 
                            onChange={e => updItem(it.id!, 'p', +e.target.value)}
                            className="p-2 border border-slate-200 rounded-lg text-xs text-right"
                          />
                        </div>

                        {/* Unit */}
                        <div>
                          <label className="text-[11px] font-bold text-slate-500 block mb-0.5">หน่วยนับ</label>
                          <input 
                            placeholder="ชิ้น / ชุด / งาน"
                            value={it.u} 
                            onChange={e => updItem(it.id!, 'u', e.target.value)}
                            className="p-2 border border-slate-200 rounded-lg text-xs text-center"
                          />
                        </div>
                      </div>

                      {/* Tactile Quantity Stepper for easy mobile tap */}
                      <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-500">จำนวนที่ขอเบิก:</span>
                        <div className="flex items-center gap-2">
                          <button 
                            type="button" 
                            onClick={() => updItem(it.id!, 'q', Math.max(1, (it.q || 1) - 1))}
                            className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full flex items-center justify-center font-bold"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-8 text-center text-xs font-black text-slate-800">{it.q || 1}</span>
                          <button 
                            type="button" 
                            onClick={() => updItem(it.id!, 'q', (it.q || 1) + 1)}
                            className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full flex items-center justify-center font-bold"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Total calculation row */}
                      <div className="flex justify-between items-center text-xs bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/50">
                        <span className="text-[#5a7a79] font-semibold">ยอดรวมรายการนี้:</span>
                        <span className="font-extrabold text-[#4E958D]">฿{fmt(it.t)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 2. Desktop/Tablet layout (Proper clean spacious table) */}
                <div className="hidden md:block space-y-4">
                  {items.map((it, idx) => (
                    <div key={it.id} className="p-4 bg-white hover:bg-slate-50/40 border border-slate-200 hover:border-[#4E958D]/30 rounded-2xl space-y-3.5 transition-all relative">
                      {/* Header row of the item block */}
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                        <span className="text-xs font-black text-[#4E958D] tracking-wider uppercase">รายการที่ {idx + 1}</span>
                        {items.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => setItems(items.filter(x => x.id !== it.id))}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="ลบรายการนี้"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Row 1: Item description (takes up 100% of the line) */}
                      <div>
                        <label className="text-[11px] font-black text-slate-400 block mb-1 uppercase tracking-wider">รายการสินค้า/บริการ (รายละเอียด)</label>
                        <input 
                          placeholder="เช่น ค่าเดินทาง, จัดซื้อท่อ PVC หรือรายละเอียดของงาน" 
                          value={it.d} 
                          onChange={e => updItem(it.id!, 'd', e.target.value)}
                          className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-white focus:outline-none focus:border-[#4E958D] shadow-sm transition-all"
                        />
                      </div>

                      {/* Row 2: Metadata grid */}
                      <div className="grid grid-cols-12 gap-4 items-end">
                        {/* Category */}
                        <div className="col-span-4">
                          <label className="text-[11px] font-black text-slate-400 block mb-1 uppercase tracking-wider">หมวดหมู่</label>
                          <select 
                            value={it.cat} 
                            onChange={e => updItem(it.id!, 'cat', e.target.value)}
                            className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-[#4E958D] shadow-sm transition-all"
                          >
                            {masterCategories.map(ct => (
                              <option key={ct.id} value={ct.id}>{ct.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity */}
                        <div className="col-span-2">
                          <label className="text-[11px] font-black text-slate-400 block mb-1 uppercase tracking-wider text-center">จำนวน</label>
                          <input 
                            type="number" 
                            value={it.q} 
                            min="1" 
                            onChange={e => updItem(it.id!, 'q', +e.target.value)} 
                            className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-center font-bold focus:outline-none focus:border-[#4E958D] shadow-sm transition-all"
                          />
                        </div>

                        {/* Unit */}
                        <div className="col-span-2">
                          <label className="text-[11px] font-black text-slate-400 block mb-1 uppercase tracking-wider text-center">หน่วยนับ</label>
                          <input 
                            value={it.u} 
                            onChange={e => updItem(it.id!, 'u', e.target.value)} 
                            className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-center focus:outline-none focus:border-[#4E958D] shadow-sm transition-all"
                          />
                        </div>

                        {/* Price */}
                        <div className="col-span-2">
                          <label className="text-[11px] font-black text-slate-400 block mb-1 uppercase tracking-wider text-right">ราคาต่อหน่วย (฿)</label>
                          <input 
                            type="number" 
                            value={it.p === 0 ? '' : it.p} 
                            min="0" 
                            onChange={e => updItem(it.id!, 'p', +e.target.value)} 
                            className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-right font-semibold focus:outline-none focus:border-[#4E958D] shadow-sm transition-all"
                          />
                        </div>

                        {/* Subtotal */}
                        <div className="col-span-2 text-right pb-1.5">
                          <label className="text-[11px] font-black text-slate-400 block mb-2 uppercase tracking-wider">ยอดรวมรายการ</label>
                          <span className="font-extrabold text-sm text-[#4E958D] block leading-none">
                            ฿{fmt(it.t)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Item Button */}
                <button 
                  type="button"
                  className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-200 text-[#4E958D] font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition"
                  onClick={() => { 
                    setItems([...items, { id: nid, d: '', cat: masterCategories[0]?.id || 'C01', q: 1, u: 'ชุด', p: 0, t: 0 }]); 
                    setNid(n => n + 1); 
                  }}
                >
                  <Plus size={14} /> เพิ่มรายการเบิกเงินใหม่
                </button>

                {/* Totals Summary Card */}
                <div className="bg-[#4E958D] text-white rounded-2xl p-4 flex justify-between items-center shadow-sm">
                  <div>
                    <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">ยอดรวมประมาณการขอเบิกทั้งสิ้น</p>
                    <p className="text-xs mt-0.5">รวมภาษีหัก ณ ที่จ่าย และอื่นๆ (หากมี)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black tracking-tight">฿{fmt(total)}</p>
                    <p className="text-[10px] opacity-75 mt-0.5">({items.length} รายการ)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Attachments Center (Responsive Grid, Drag & Drop lookalike) */}
            <div className="fs shadow-sm hover:border-[#4E958D]/30 transition-colors">
              <div className="fs-h">
                <span className="flex items-center gap-2"><Paperclip size={16} /> 6. แนบเอกสารหลักฐานอ้างอิงเพิ่มเติม (Option)</span>
              </div>
              <div className="fs-b space-y-4">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  multiple 
                  className="hidden" 
                  onChange={handleFileChange} 
                />
                
                {/* Visual Touch Zone */}
                <div 
                  className="border-2 border-dashed border-slate-200 hover:border-[#4E958D] hover:bg-[#E8F5F4]/20 rounded-2xl p-6 text-center cursor-pointer transition-all duration-200"
                  onClick={() => !uploadingFiles && fileInputRef.current?.click()}
                >
                  <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Upload className="text-[#4E958D]" size={20} />
                  </div>
                  <p className="text-xs font-bold text-slate-700">แตะเพื่ออัปโหลดเอกสารประกอบคำขอเบิก</p>
                  <p className="text-[10px] text-slate-400 mt-1">รองรับ PDF, JPG, PNG, Excel ขนาดไม่เกิน 10MB ต่อไฟล์</p>
                </div>

                {uploadingFiles && (
                  <div className="flex items-center justify-center gap-2 text-xs text-[#4E958D] font-bold py-2 bg-emerald-50 rounded-lg border border-emerald-100 animate-pulse">
                    <Sparkles size={14} className="animate-spin" /> กำลังประมวลผลไฟล์หลักฐาน...
                  </div>
                )}

                {/* File list */}
                {files.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">เอกสารแนบเรียบร้อยแล้ว ({files.length})</p>
                    <div className="grid grid-cols-1 gap-2">
                      {files.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                          <div className="flex items-center gap-2 overflow-hidden mr-2">
                            <span className="text-lg">📄</span>
                            <div className="overflow-hidden">
                              <p className="text-xs font-bold text-slate-700 truncate">{fileLabel(file)}</p>
                              <p className="text-[10px] text-slate-400">อัปโหลดเสร็จสมบูรณ์</p>
                            </div>
                          </div>
                          
                          <div className="flex gap-1 shrink-0">
                            <button 
                              type="button" 
                              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold rounded-lg transition"
                              onClick={() => openFilePreview(file)}
                            >
                              ดูเอกสาร
                            </button>
                            <button 
                              type="button" 
                              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-500 text-[10px] font-bold rounded-lg transition"
                              onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                            >
                              ลบ
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stepper Buttons for mobile */}
            <div className="lg:hidden mt-4 flex gap-3">
              <button 
                type="button" 
                onClick={() => setMobileStep(2)}
                className="flex-1 py-3 bg-white border border-slate-300 text-slate-600 font-bold text-sm rounded-xl text-center shadow-sm"
              >
                ย้อนกลับ
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setActiveTab('preview');
                  toast('✨ สลับมาแสดง Live A4 PDF Preview เอกสารแล้ว', 'info');
                }}
                className="flex-1 py-3 bg-[#4E958D] hover:bg-[#3d7a73] text-white font-bold text-sm rounded-xl text-center shadow-sm"
              >
                ดูตัวอย่างใบสำคัญ <ChevronRight size={14} className="inline ml-0.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Beautiful Live A4 Document Preview */}
        <div className={`w-full ${activeTab === 'preview' ? 'block' : 'hidden lg:block'} transition-all h-auto lg:h-[800px]`}>
          <div className="lg:sticky lg:top-[74px] flex flex-col bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden h-full">
            <div className="p-4 border-b border-slate-150 bg-slate-50/50 flex flex-wrap justify-between items-center shrink-0 gap-3 no-print">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Eye size={16} className="text-sky-500" />
                  แสดงตัวอย่างเอกสารอ้างอิง (50%)
                </h2>
                <span className="text-[9px] text-purple-700 bg-purple-50 px-2 py-1 rounded-full border border-purple-100 hidden sm:inline-block">Live Viewer</span>
              </div>

              <div className="flex gap-2">
                {isEditing && (
                  <button 
                    type="button" 
                    onClick={() => {
                      openModal(
                        'ยืนยันการลบร่างเอกสาร',
                        <div className="text-xs text-slate-600 leading-relaxed">คุณต้องการลบร่างเอกสารขอเบิกเงินทดรองจ่ายหมายเลข <b>{editAdvanceId}</b> นี้ออกจากระบบใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</div>,
                        (
                          <div className="flex gap-2 justify-end w-full">
                            <button type="button" className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition" onClick={closeModal}>ยกเลิก</button>
                            <button 
                              type="button" 
                              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-lg transition" 
                              onClick={() => {
                                deleteAdvance(editAdvanceId);
                                toast(`🗑️ ลบแบบร่าง ${editAdvanceId} สำเร็จ`, 'info');
                                closeModal();
                                setPage('list');
                              }}
                            >
                              ยืนยันลบ
                            </button>
                          </div>
                        )
                      );
                    }} 
                    className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 text-[11px] font-bold rounded-lg transition"
                  >
                    🗑️ ลบแบบร่าง
                  </button>
                )}
                
                <button 
                  type="button" 
                  onClick={() => {
                    window.print();
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-bold rounded-lg transition shadow-sm"
                >
                  พิมพ์เอกสาร
                </button>
              </div>
            </div>

            {/* Document display wrapper */}
            <div className="flex-1 bg-slate-100/80 p-6 overflow-y-auto custom-scrollbar flex flex-col items-center gap-8 relative">
              <style>
                {`
                  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap');
                  .font-noto-thai { font-family: 'Noto Sans Thai', sans-serif !important; }
                  .font-noto-thai * { font-family: 'Noto Sans Thai', sans-serif !important; }
                `}
              </style>
              <div className="w-full flex justify-center py-4 bg-slate-100 min-h-full overflow-x-hidden">
                <div className="pdf-p shadow-md bg-white border border-slate-200 rounded-3xl overflow-hidden p-0 md:p-6 lg:p-8 flex justify-center items-start min-h-[500px] w-full max-w-[794px]">
                  <FitPageViewer pageWidth={794} pageHeight={1123}>
                    <DocumentRenderer 
                      template={publishedTemplates.advance} 
                      data={{
                        advNo,
                        reqDate: new Date().toISOString(),
                        employeeName: emp?.name,
                        employeeDept: emp?.position || emp?.dept,
                        employeeBank: payee.bank,
                        employeeAccount: formattedPayeeBankNo,
                        projectName: projs.map(pid => masterProjects.find(p => p.id === pid || p.code === pid)?.name).join(', '),
                        desc: desc.trim() || items.map(i => i.d).filter(Boolean).join(', ') || 'ไม่มีรายละเอียดหมายเหตุเสริม',
                        items: items.map((it) => ({
                          desc: it.d,
                          category: masterCategories.find(ct => ct.id === it.cat)?.name,
                          qty: it.q,
                          price: it.p,
                          unit: it.u,
                          amount: it.t
                        })),
                        totals: {
                          subtotal: total,
                          totalVat: 0,
                          totalWht: 0,
                          grandTotal: total
                        },
                        emp
                      }} 
                    />
                  </FitPageViewer>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Interactive Action bar (Mobile-First sticky bottom toolbar with blur) */}
      <div className="sbar sticky bottom-0 lg:static z-40 bg-white/90 backdrop-blur-md border-t lg:border-none p-4 lg:p-0 shadow-[0_-10px_25px_rgba(0,0,0,0.05)] lg:shadow-none no-print">
        <div className="flex gap-3 max-w-7xl mx-auto w-full lg:w-auto">
          <button 
            className="flex-1 lg:flex-none py-3 px-6 border-2 border-slate-200 text-slate-600 hover:text-[#4E958D] hover:border-[#4E958D] bg-white hover:bg-slate-50 font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 transition" 
            onClick={() => void saveDraft()}
          >
            <Save size={16} /> บันทึกร่าง
          </button>
          
          <button 
            className="flex-1 lg:flex-none py-3 px-8 bg-[#4E958D] hover:bg-[#3d7a73] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition" 
            onClick={submit}
          >
            <Send size={16} /> ส่งคำขออนุมัติ
          </button>
        </div>
      </div>
    </>
  );
};
