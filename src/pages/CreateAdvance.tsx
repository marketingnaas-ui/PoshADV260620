import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { fmt, generateAdvanceId, UserAvt } from '../lib/utils';
import { fileLabel, fileUrl, uploadFileToServer } from '../lib/files';
import { User, AdvItem, AdvanceAttachment } from '../types';

export const CreateAdvance = () => {
  const { 
    advances, toast, setPage, addAdvance, updateAdvance, deleteAdvance, 
    pageExtra, masterUsers, masterProjects, masterCategories, 
    openModal, closeModal, openFilePreview, approvalMatrix 
  } = useApp();
  
  const [emp, setEmp] = useState<User | null>(null);
  const [customUsers, setCustomUsers] = useState<User[]>([]);
  const [tempUserOpen, setTempUserOpen] = useState(false);
  const [tempUser, setTempUser] = useState({ name: '', dept: '', bank: '', bankNo: '' });
  const [bankEditOpen, setBankEditOpen] = useState(false);
  const [bankDraft, setBankDraft] = useState({ bank: '', bankNo: '', accountName: '' });
  const [projs, setProjs] = useState<string[]>([]);
  const [items, setItems] = useState<AdvItem[]>([{ id: 1, d: '', cat: 'C01', q: 1, u: 'ชุด', p: 0, t: 0 }]);
  const [nid, setNid] = useState(2);
  const [files, setFiles] = useState<AdvanceAttachment[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
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
      }
    }
  }, [isEditing, editAdvanceId, advances]);

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

  const addProj = (id: string) => {
    if (id && !projs.includes(id)) setProjs([...projs, id]);
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
      const names = uploaded;
      toast(`📎 อัปโหลดไฟล์ ${names.length} รายการสำเร็จ`, 'ok');
    } catch (error: any) {
      toast(error.message || 'อัปโหลดไฟล์ไม่สำเร็จ', 'err');
    } finally {
      setUploadingFiles(false);
      e.target.value = '';
    }
  };

  const submit = () => {
    if (!emp) return toast('กรุณาเลือกพนักงาน', 'err');
    if (!projs.length) return toast('กรุณาเลือกโปรเจกต์', 'err');
    if (!total) return toast('กรุณากรอกรายการและยอดเงิน', 'err');
    if (!payee.bank || !payee.bankNo || !payee.accountName) return toast('กรุณาระบุบัญชีรับเงินให้ครบ', 'err');
    
    const firstCat = items[0]?.cat || 'C01';
    const catObject = masterCategories.find(ct => ct.id === firstCat);
    
    if (isEditing && editAdvanceId) {
      updateAdvance(editAdvanceId, {
        empId: emp.id,
        empName: emp.name,
        empDept: emp.dept,
        pIds: projs,
        pName: masterProjects.find(p => p.id === projs[0])?.name || '–',
        status: 'รออนุมัติ',
        amount: total,
        catId: firstCat,
        catName: catObject?.name || '–',
        payeeBank: payee.bank,
        payeeBankNo: payee.bankNo,
        payeeAccountName: payee.accountName,
        desc: items.map(i => i.d).join(', '),
        items: [...items],
        files: [...files]
      });
      toast(`✓ อัปเดตและส่ง ${editAdvanceId} สำเร็จ · สถานะ: รออนุมัติ`, 'ok');
    } else {
      addAdvance({
        id: advNo,
        empId: emp.id,
        empName: emp.name,
        empDept: emp.dept,
        pIds: projs,
        pName: masterProjects.find(p => p.id === projs[0])?.name || '–',
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
        desc: items.map(i => i.d).join(', '),
        items: [...items],
        files: [...files],
        clrs: [],
        pay: null
      });
      toast(`✓ ส่ง ${advNo} สำเร็จ · สถานะ: รออนุมัติ`, 'ok');
    }
    
    setTimeout(() => setPage('list'), 1200);
  };

  const saveDraft = async () => {
    const draft = {
      id: isEditing && editAdvanceId ? `DRAFT-${editAdvanceId}` : `DRAFT-${advNo}`,
      advNo: isEditing && editAdvanceId ? editAdvanceId : advNo,
      employee: emp,
      projectIds: projs,
      items,
      files,
      payee,
      total,
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
          pName: masterProjects.find(p => p.id === projs[0])?.name || '–',
          status: 'บันทึกร่าง',
          amount: total,
          catId: firstCat,
          catName: catObject?.name || '–',
          payeeBank: payee.bank,
          payeeBankNo: payee.bankNo,
          payeeAccountName: payee.accountName,
          desc: items.map(i => i.d).join(', '),
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
          pName: masterProjects.find(p => p.id === projs[0])?.name || '–',
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
          desc: items.map(i => i.d).join(', '),
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

  return (
    <>
      <div className="ph"><div><h2>สร้างใบเบิกเงินทดรอง</h2><p>กรอกข้อมูลและตรวจสอบ Live PDF Preview ก่อนส่ง</p></div></div>
      <div className="crl">
        <div>
          <div className="fs"><div className="fs-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}><span>👤 1. ผู้ขอเบิก</span><button type="button" className="btn btn-g btn-xs" onClick={() => setTempUserOpen(v => !v)}>+ ผู้เบิกชั่วคราว</button></div><div className="fs-b">
            {tempUserOpen && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px', padding: '10px', background: 'var(--soft)', border: '1.5px solid var(--bdr)', borderRadius: 'var(--rs)' }}>
                <input placeholder="ชื่อผู้เบิกชั่วคราว" value={tempUser.name} onChange={e => setTempUser(v => ({ ...v, name: e.target.value }))} />
                <input placeholder="หน่วยงาน / ฝ่าย" value={tempUser.dept} onChange={e => setTempUser(v => ({ ...v, dept: e.target.value }))} />
                <input placeholder="ธนาคาร" value={tempUser.bank} onChange={e => setTempUser(v => ({ ...v, bank: e.target.value }))} />
                <input placeholder="เลขบัญชีรับเงิน" value={tempUser.bankNo} onChange={e => setTempUser(v => ({ ...v, bankNo: e.target.value }))} />
                <button type="button" className="btn btn-p btn-sm" style={{ gridColumn: '1 / -1', justifyContent: 'center' }} onClick={addTemporaryUser}>เพิ่มและเลือกผู้เบิกนี้</button>
              </div>
            )}
            {selectableUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '15px', color: 'var(--tm)', fontSize: '13px' }}>กรุณาเพิ่มสมาชิกในหน้า "Settings" เพื่อเริ่มใช้งาน</div>
            ) : (
              <select 
                value={emp?.id || ''} 
                onChange={e => {
                  const u = selectableUsers.find(x => x.id === e.target.value);
                  if (u) selectEmployee(u);
                }}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--bdr)', background: '#fff', fontSize: '13px', color: 'var(--tx)', fontWeight: 500, outline: 'none' }}
              >
                <option value="">-- เลือกผู้ขอเบิกเงินทดรองจ่าย --</option>
                {selectableUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            )}
          </div></div>
          
          <div className="fs"><div className="fs-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}><span>💳 2. บัญชีรับเงิน</span>{emp && <button type="button" className="btn btn-g btn-xs" onClick={() => setBankEditOpen(v => !v)}>+ ใช้บัญชีอื่น</button>}</div><div className="fs-b">
            {emp ? (
              <>
                <div className="bnk">
                  <div style={{ fontSize: '10.5px', opacity: .8 }}>ธนาคาร {payee.bank}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, margin: '3px 0' }}>{payee.accountName}</div>
                  <div style={{ fontSize: '12.5px', letterSpacing: '2px', opacity: .85 }}>{formattedPayeeBankNo}</div>
                </div>
                {bankEditOpen && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px', padding: '10px', background: 'var(--soft)', border: '1.5px solid var(--bdr)', borderRadius: 'var(--rs)' }}>
                    <input placeholder="ชื่อบัญชีรับเงิน" value={bankDraft.accountName} onChange={e => setBankDraft(v => ({ ...v, accountName: e.target.value }))} />
                    <input placeholder="ธนาคาร" value={bankDraft.bank} onChange={e => setBankDraft(v => ({ ...v, bank: e.target.value }))} />
                    <input placeholder="เลขบัญชี" value={bankDraft.bankNo} onChange={e => setBankDraft(v => ({ ...v, bankNo: e.target.value }))} style={{ gridColumn: '1 / -1' }} />
                    <button type="button" className="btn btn-o btn-sm" onClick={() => emp && setBankDraft({ bank: emp.bank, bankNo: emp.bankNo, accountName: emp.name })}>ใช้บัญชีหลัก</button>
                    <button type="button" className="btn btn-p btn-sm" onClick={() => setBankEditOpen(false)}>บันทึกบัญชีนี้</button>
                  </div>
                )}
              </>
            ) : <div style={{ textAlign: 'center', padding: '20px', color: 'var(--tm)', fontSize: '13px' }}>กรุณาเลือกพนักงานก่อน</div>}
          </div></div>

          <div className="fs"><div className="fs-h">🏗 3. เลือกโปรเจกต์</div><div className="fs-b">
            {masterProjects.length === 0 ? (
              <div style={{ padding: '8px 0', color: 'var(--tm)', fontSize: '12.5px' }}>กรุณาเพิ่มโปรเจกต์ในหน้า "Settings" ก่อน</div>
            ) : (
              <>
                <select onChange={e => { addProj(e.target.value); e.target.value = ''; }} value="">
                  <option value="">+ เพิ่มโปรเจกต์...</option>
                  {masterProjects.filter(p => !projs.includes(p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
                  {projs.map(pid => {
                    const p = masterProjects.find(x => x.id === pid);
                    return <div key={pid} className="pchip" onClick={() => setProjs(projs.filter(x => x !== pid))}>{p?.name} <span style={{ fontSize: '14px', color: 'var(--tm)' }}>×</span></div>;
                  })}
                </div>
              </>
            )}
          </div></div>

          <div className="fs"><div className="fs-h">📋 4. รายการขอเบิก</div><div className="fs-b">
            <div style={{ overflowX: 'auto' }}>
              <table className="it">
                <thead><tr><th>รายการ</th><th>หมวด</th><th>จำนวน</th><th>หน่วย</th><th>ราคา</th><th>รวม</th><th></th></tr></thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.id}>
                      <td><input placeholder="ชื่อรายการ" value={it.d} onChange={e => updItem(it.id!, 'd', e.target.value)} /></td>
                      <td>
                        <select value={it.cat} onChange={e => updItem(it.id!, 'cat', e.target.value)}>
                          {masterCategories.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
                        </select>
                      </td>
                      <td><input type="number" value={it.q} min="1" onChange={e => updItem(it.id!, 'q', +e.target.value)} style={{ width: '55px' }} /></td>
                      <td><input value={it.u} onChange={e => updItem(it.id!, 'u', e.target.value)} style={{ width: '50px' }} /></td>
                      <td><input type="number" value={it.p} min="0" onChange={e => updItem(it.id!, 'p', +e.target.value)} style={{ width: '75px' }} /></td>
                      <td style={{ fontWeight: 700, fontSize: '11.5px', whiteSpace: 'nowrap' }}>฿{fmt(it.t)}</td>
                      <td>{items.length > 1 && <button className="btn btn-g" onClick={() => setItems(items.filter(x => x.id !== it.id))} style={{ color: '#ef4444', padding: '2px' }}>✕</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="add-r" onClick={() => { setItems([...items, { id: nid, d: '', cat: masterCategories[0]?.id || 'C01', q: 1, u: 'ชุด', p: 0, t: 0 }]); setNid(n => n + 1); }}>+ เพิ่มรายการ</button>
            <div className="tot-b"><div style={{ fontSize: '12.5px', opacity: .85 }}>รวมยอดขอเบิก</div><div style={{ fontSize: '20px', fontWeight: 900 }}>฿{fmt(total)}</div></div>
          </div></div>

          <div className="fs">
            <div className="fs-h">📎 5. เอกสารแนบ</div>
            <div className="fs-b">
              <input 
                type="file" 
                ref={fileInputRef} 
                multiple 
                style={{ display: 'none' }} 
                onChange={handleFileChange} 
              />
              <div className="upz" onClick={() => !uploadingFiles && fileInputRef.current?.click()}>
                <div style={{ fontSize: '22px', marginBottom: '5px' }}>📤</div>
                <div style={{ fontSize: '13px', color: 'var(--p)', fontWeight: 600 }}>คลิกเพื่ออัปโหลดเอกสารจริง</div>
                <div style={{ fontSize: '11px', color: 'var(--tm)' }}>PDF, JPG, PNG, Excel · Max 10MB</div>
              </div>
              {files.length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {files.map((file, idx) => (
                    <div key={idx} className="fl" style={{ gap: '8px', padding: '8px', background: 'var(--soft)', borderRadius: 'var(--rs)', border: '1.5px solid var(--bdr)' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--p)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <span style={{ fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileLabel(file)}</span>
                      <button type="button" className="btn btn-g btn-xs" onClick={() => openFilePreview(file)}>👁️ Preview</button>
                      <button type="button" className="btn btn-g btn-xs" style={{ color: '#ef4444' }} onClick={() => setFiles(files.filter((_, i) => i !== idx))}>ลบ</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="pdf-p" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px', zIndex: 10 }} className="no-print">
              <button 
                type="button" 
                onClick={() => {
                  toast('✏️ กำลังตรวจสอบและเตรียมส่งบันทึกแก้ไข...', 'ok');
                  submit();
                }} 
                className="btn btn-xs" 
                style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', color: '#475569', fontSize: '11.5px', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}
              >
                ✏️ บันทึกแก้ไข
              </button>
              {isEditing && (
                <button 
                  type="button" 
                  onClick={() => {
                    openModal(
                      'ยืนยันการลบร่างเอกสาร',
                      <div style={{ fontSize: '13px', color: 'var(--tx)' }}>คุณต้องการลบร่างเอกสารขอเบิกเงินทดรองจ่ายหมายเลข <b>{editAdvanceId}</b> นี้ออกจากระบบใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</div>,
                      (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
                          <button type="button" className="btn btn-o btn-sm" onClick={closeModal}>ยกเลิก</button>
                          <button 
                            type="button" 
                            className="btn btn-sm" 
                            style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600 }} 
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
                  className="btn btn-xs" 
                  style={{ background: '#fee2e2', border: '1.5px solid #fca5a5', color: '#dc2626', fontSize: '11.5px', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}
                >
                  🗑️ ลบแบบร่าง
                </button>
              )}
            </div>
            <img 
              id="pdf-logo"
              src="https://img1.pic.in.th/images/Photoroom_25690616_0140020ff34b302f0f7c25.png" 
              alt="Logo" 
              style={{ position: 'absolute', top: '44px', right: '28px', width: '60px', height: '60px', objectFit: 'contain' }}
              referrerPolicy="no-referrer"
            />
            <div className="pdf-wm">DRAFT</div>
            <div className="pdf-title">ใบขอเบิกเงินทดรองจ่าย</div>
            <div className="pdf-sub">ADVANCE REQUEST FORM</div>
            <div className="pdf-sub" style={{ fontWeight: 800, color: 'var(--p)', marginBottom: '4px' }}>{advNo}</div>
            <hr className="pdf-hr" />
             <div className="pdf-row"><span>ผู้ขอเบิก: <b>{emp?.name || '................................'}</b></span><span>วันที่: <b>{new Date().toLocaleDateString('th-TH')}</b></span></div>
             <div className="pdf-row"><span>ตำแหน่ง: <b>{emp?.position || emp?.dept || '................................'}</b></span><span>ครบกำหนด: <b>{new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('th-TH')}</b></span></div>
             <div className="pdf-row" style={{ marginTop: '3px' }}><span>บัญชีรับเงิน: <b>{payee.bank ? `${payee.bank} / ${payee.accountName} / ${formattedPayeeBankNo}` : '................................'}</b></span></div>
             <div className="pdf-row" style={{ marginTop: '3px' }}><span>โปรเจกต์: <b>{projs.map(pid => masterProjects.find(p => p.id === pid)?.name).join(', ') || '................................'}</b></span></div>
             <hr className="pdf-hr" />
             <table className="pdf-tbl">
               <thead>
                 <tr>
                   <th style={{ width: '60px', textAlign: 'center' }}>ลำดับ</th>
                   <th>รายละเอียดรายการขอเบิกเงินทดรองจ่าย</th>
                 </tr>
               </thead>
               <tbody>
                 {items.map((it, i) => {
                   const catName = masterCategories.find(ct => ct.id === it.cat)?.name || '–';
                   return (
                     <tr key={i}>
                       <td style={{ verticalAlign: 'top', textAlign: 'center', fontWeight: 'bold', fontSize: '12px', padding: '10px 5px', color: 'var(--tx)' }}>{i + 1}</td>
                       <td style={{ padding: '8px 10px' }}>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                           <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tx)' }}>
                             {it.d || '–'}
                           </div>
                           <div style={{ fontSize: '11px', color: '#64748b' }}>
                             <span style={{ fontWeight: 600, color: 'var(--p)' }}>หมวดหมู่:</span> {catName} &nbsp;|&nbsp; <span style={{ fontWeight: 600, color: 'var(--p)' }}>จำนวน:</span> {it.q} {it.u}
                           </div>
                           <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: '4px', marginTop: '2px' }}>
                             <span><span style={{ fontWeight: 600 }}>ราคาต่อหน่วย:</span> ฿{fmt(it.p)}</span>
                             <span style={{ fontWeight: 700, color: 'var(--tx)' }}><span style={{ fontWeight: 600, color: '#64748b' }}>ราคารวม:</span> ฿{fmt(it.t)}</span>
                           </div>
                         </div>
                       </td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
             <div className="pdf-tot">รวมทั้งสิ้น: ฿{fmt(total)}</div>
             <hr className="pdf-hr" style={{ marginTop: '18px' }} />
             <div className="pdf-sig">
               <div className="pdf-sig-b" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                 <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                   {emp?.signatureData ? (
                     <img 
                       src={emp.signatureData} 
                       alt="signature" 
                       style={{ maxHeight: '38px', objectFit: 'contain' }} 
                       referrerPolicy="no-referrer"
                     />
                   ) : (
                     <div style={{ height: '38px' }} />
                   )}
                 </div>
                 <div className="pdf-sig-l" style={{ margin: '0 18px 3px', width: '80%', borderTop: '1px solid var(--tm)' }}></div>
                 <div className="pdf-sig-n">ผู้ขอเบิก</div>
                 <div style={{ fontSize: '10.5px', color: 'var(--tm)' }}>({emp?.name || '.....................'})</div>
               </div>
               <div className="pdf-sig-b" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                 <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                   {(() => {
                     const approvalOwnerUser = masterUsers?.find(u => u.name === (approvalMatrix?.signatureOwner || 'วิภา ทองสุข'));
                     if (approvalOwnerUser?.signatureData) {
                       return (
                         <img 
                           src={approvalOwnerUser.signatureData} 
                           alt="approver signature" 
                           style={{ maxHeight: '38px', objectFit: 'contain' }} 
                           referrerPolicy="no-referrer"
                         />
                       );
                     }
                     return <div style={{ height: '38px' }} />;
                   })()}
                 </div>
                 <div className="pdf-sig-l" style={{ margin: '0 18px 3px', width: '80%', borderTop: '1px solid var(--tm)' }}></div>
                 <div className="pdf-sig-n">ผู้อนุมัติ</div>
                 <div style={{ fontSize: '10.5px', color: 'var(--tm)' }}>({approvalMatrix?.signatureOwner || 'วิภา ทองสุข'})</div>
               </div>
             </div>
          </div>
        </div>
      </div>
      <div className="sbar">
        <button className="btn btn-o" onClick={() => void saveDraft()}>💾 บันทึกร่าง</button>
        <button className="btn btn-p" onClick={submit}>📨 ส่งคำขอเบิก</button>
      </div>
    </>
  );
};
