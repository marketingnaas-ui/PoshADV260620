import React, { useState, useEffect } from 'react';
import { MessageCircle, Settings2, X, Save, RefreshCw, Link2, Bot, Bell, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge } from './shared';

export default function LineIntegration() {
  const { toast } = useApp();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateForm, setTemplateForm] = useState<any>(null);
  
  // Binding configuration states
  const [lineConfig, setLineConfig] = useState<any>({
    groupNotifyToken: 'LN-tok_9918ab77fc8d8e',
    groupName: 'LINE กลุ่มผู้อนุมัติ (ClearAdvance Approval Grp)',
    groupEnabled: true,
    oaChannelId: '2004819741',
    oaChannelSecret: 'e39da92497645f65bc7291a82c46f140',
    oaAccessToken: 'ya29.a0ARWks88_K9VwK6g-SDFASFSDFASDAF8897fsf73hfdh-Kds8',
    oaWebhookUrl: 'https://ais-dev-l2yrslhsiwp6phbg7gjjwg-230368814102.asia-east1.run.app/api/line/webhook',
    oaBotName: 'ClearAdvance Official Bot',
    oaStatus: 'CONNECTED'
  });

  const [savingConfig, setSavingConfig] = useState(false);
  const [testingGroup, setTestingGroup] = useState(false);

  useEffect(() => {
    // Fetch template data
    const fetchTemplates = fetch('/api/store/line-templates')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setTemplates(data);
        } else {
          setTemplates([
            { id: 1, name: 'Advance Approved', status: 'Active', text: 'สวัสดีคุณ {name}, รายการขอเบิก {doc_ref} ได้รับการอนุมัติเรียบร้อยแล้วจำนวน {amount} บาท' },
            { id: 2, name: 'Clearance Rejected', status: 'Active', text: 'สวัสดีคุณ {name}, รายการเคลียร์เงิน {doc_ref} ถูกปฏิเสธการอนุมัติเนื่องจากเอกสารไม่ครบถ้วน' },
            { id: 3, name: 'Reminder: Overdue', status: 'Active', text: 'แจ้งเตือน: รายการขอเบิกเงิน {doc_ref} เกินกำหนดเวลาชำระเงินเคลียร์แล้ว กรุณาดำเนินการส่งรายงานเคลียร์เงินโดยเร็ว' }
          ]);
        }
      })
      .catch(() => {
        setTemplates([
          { id: 1, name: 'Advance Approved', status: 'Active', text: 'สวัสดีคุณ {name}, รายการขอเบิก {doc_ref} ได้รับการอนุมัติเรียบร้อยแล้วจำนวน {amount} บาท' },
          { id: 2, name: 'Clearance Rejected', status: 'Active', text: 'สวัสดีคุณ {name}, รายการเคลียร์เงิน {doc_ref} ถูกปฏิเสธการอนุมัติเนื่องจากเอกสารไม่ครบถ้วน' },
          { id: 3, name: 'Reminder: Overdue', status: 'Active', text: 'แจ้งเตือน: รายการขอเบิกเงิน {doc_ref} เกินกำหนดเวลาชำระเงินเคลียร์แล้ว กรุณาดำเนินการส่งรายงานเคลียร์เงินโดยเร็ว' }
        ]);
      });

    // Fetch config data
    const fetchConfig = fetch('/api/store/line-config')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object' && !Array.isArray(data) && data.oaChannelId) {
          setLineConfig(data);
        }
      })
      .catch(() => {});

    Promise.all([fetchTemplates, fetchConfig]).finally(() => setLoading(false));
  }, []);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch('/api/store/line-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lineConfig)
      });
      if (res.ok) {
        toast("🤖 บันทึกการเชื่อมต่อ LINE OA และการตั้งค่ากลุ่มเรียบร้อยแล้ว!", "ok");
      } else {
        throw new Error();
      }
    } catch (e) {
      toast("เกิดข้อผิดพลาดในการบันทึกค่าเชื่อมต่อ", "err");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSendTestGroup = () => {
    if (!lineConfig.groupNotifyToken.trim()) {
      toast("กรุณากรอกรหัส Token หรือ Webhook ของกลุ่ม LINE สำหรับส่งแจ้งเตือน", "err");
      return;
    }
    setTestingGroup(true);
    setTimeout(() => {
      setTestingGroup(false);
      toast(`💬 ส่งข้อความจำลองการขออนุมัติเอกสาร ไปยังกลุ่ม "${lineConfig.groupName}" สำเร็จ!`, "ok");
    }, 1200);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.text.trim()) {
      toast("กรุณาระบุข้อความแจ้งเตือน", "err");
      return;
    }
    const updated = templates.map(t => t.id === templateForm.id ? templateForm : t);
    try {
      const res = await fetch('/api/store/line-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        setTemplates(updated);
        setTemplateForm(null);
        toast("บันทึกเทมเพลต LINE สำเร็จ", "ok");
      } else {
        throw new Error();
      }
    } catch (e) {
      toast("เกิดข้อผิดพลาดในการบันทึกข้อมูล", "err");
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading LINE Configuration...</div>;

  return (
    <div className="animate-in fade-in duration-300">
      {/* PAGE TITLE */}
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <MessageCircle className="text-[#00B900]"/> App LINE Integration & Notifications
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            เชื่อมต่อ LINE Official Account (บอทหลักระบบ) และ LINE Group (รับแจ้งเตือนขออนุมัติ) เพื่อขับเคลื่อน workflow แบบ Real-time
          </p>
        </div>
        <button 
          onClick={handleSaveConfig} 
          disabled={savingConfig}
          className="px-5 py-2.5 bg-gradient-to-r from-[#00B900] to-emerald-600 hover:from-[#009900] hover:to-emerald-700 font-bold text-white rounded-xl text-sm shadow-sm transition-all flex items-center gap-2"
        >
          {savingConfig ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
          บันทึกการเชื่อมต่อ LINE
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* PANEL 1: LINE OFFICIAL ACCOUNT (MAIN BOT) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#00B900]/5 rounded-bl-full"></div>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Bot className="text-[#00B900]" size={20} />
                LINE Official Account (บอทหลักระบบ)
              </h3>
              <Badge type={lineConfig.oaStatus === 'CONNECTED' ? 'active' : 'inactive'}>
                {lineConfig.oaStatus === 'CONNECTED' ? 'Connected' : 'Offline'}
              </Badge>
            </div>
            
            <p className="text-xs text-slate-500 mb-4 h-8">
              หน้าต่างให้บริการพนักงาน (บอทหลักของระบบนี้) สำหรับตรวจสอบยอดคงเหลือ ถอนเคลียร์เงิน และประเมินใบงานผ่านทางเมนูริชเมนู
            </p>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Channel ID</label>
                <input 
                  type="text" 
                  value={lineConfig.oaChannelId} 
                  onChange={e => setLineConfig({ ...lineConfig, oaChannelId: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:border-[#00B900] outline-none" 
                  placeholder="200xxxxxxx"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Channel Secret</label>
                <input 
                  type="password" 
                  value={lineConfig.oaChannelSecret} 
                  onChange={e => setLineConfig({ ...lineConfig, oaChannelSecret: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:border-[#00B900] outline-none" 
                  placeholder="e39da92xxxxxxxxxxxxxxxxxxxxx"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Channel Access Token</label>
                <input 
                  type="text" 
                  value={lineConfig.oaAccessToken} 
                  onChange={e => setLineConfig({ ...lineConfig, oaAccessToken: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:border-[#00B900] outline-none truncate" 
                  placeholder="ya29.a0AR..."
                />
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-2">
                <span className="block text-[10px] font-bold text-slate-400">WEBHOOK URL (สำหรับผูกใน LINE Developer Console)</span>
                <span className="text-[11px] font-mono text-[#009900] select-all break-all">{lineConfig.oaWebhookUrl}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-50 mt-4 flex justify-between items-center text-xs">
            <span className="text-slate-400 flex items-center gap-1"><CheckCircle className="text-emerald-500" size={13} /> เชื่อมต่อ Rich Menu สำเร็จ</span>
            <button 
              onClick={() => {
                setLineConfig({ ...lineConfig, oaStatus: lineConfig.oaStatus === 'CONNECTED' ? 'DISCONNECTED' : 'CONNECTED' });
                toast("เปลี่ยนสถานะเชื่อมต่อ LINE OA เรียบร้อย", "ok");
              }}
              className="text-[#00B900] font-bold hover:underline"
            >
              แก้ไขการผูกมัดบอท
            </button>
          </div>
        </div>

        {/* PANEL 2: LINE GROUP NOTIFICATIONS (FOR APPROVALS) */}
        <div className="bg-white p-6 rounded-2xl border border-[#00B900]/20 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full"></div>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Bell className="text-amber-500" size={20} />
                ช่องทางแจ้งเตือน: LINE Group (กลุ่มไลน์พิจารณาขออนุมัติ)
              </h3>
              <div className="flex items-center gap-1.5">
                <input 
                  type="checkbox" 
                  id="group-enabled" 
                  checked={lineConfig.groupEnabled} 
                  onChange={e => setLineConfig({ ...lineConfig, groupEnabled: e.target.checked })}
                  className="w-4 h-4 accent-[#00B900] cursor-pointer"
                />
                <label htmlFor="group-enabled" className="text-xs font-bold text-slate-500 cursor-pointer">เปิดใช้งาน</label>
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-4 h-8">
              เมื่อพนักงานส่งคำขอเบิกเงินหรือเคลียร์เงิน ระบบจะทำการส่งข้อความพร้อมปุ่มอนุมัติด่วนเข้าไปยังไลน์กลุ่มนี้ เพื่อแจ้งให้คณะอนุมัติระดับสูงทราบทันที
            </p>

            <div className="space-y-4 text-sm mt-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">ชื่อกลุ่ม LINE ที่ต้องการเชื่อมโยง</label>
                <input 
                  type="text" 
                  value={lineConfig.groupName} 
                  onChange={e => setLineConfig({ ...lineConfig, groupName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#00B900] outline-none" 
                  placeholder="เช่น LINE ผู้อนุมัติโครงการโครงสร้างขั้นพื้นฐาน"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1 flex justify-between">
                  <span>LINE Group Token (หรือ Webhook URL)</span>
                  <span className="text-[#00B900] font-bold cursor-pointer hover:underline text-[10px] flex items-center gap-0.5">
                    <HelpCircle size={11} /> วิธีการเชื่อม LINE Notify โดนใจ
                  </span>
                </label>
                <input 
                  type="password" 
                  value={lineConfig.groupNotifyToken} 
                  onChange={e => setLineConfig({ ...lineConfig, groupNotifyToken: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:border-[#00B900] outline-none" 
                  placeholder="เช่น xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex gap-2 items-start text-xs text-amber-800">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">สำคัญเกี่ยวกับการพิจารณา</p>
                  <p className="text-[10px] mt-0.5 text-amber-700">ไลน์แจ้งเตือนจะใช้เบิกจ่ายกับเทมเพลตที่เปิดใช้งาน มอบความคล่องตัวในการตอบรับอนุมัติผ่านโทรศัพท์มือถือ</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 flex justify-between items-center">
            <span className="text-xs text-slate-400">สถานะกลุ่ม: <strong className="text-emerald-600 font-bold">พร้อมทำงาน (Ready)</strong></span>
            <button 
              onClick={handleSendTestGroup} 
              disabled={testingGroup}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
            >
              {testingGroup ? <RefreshCw size={12} className="animate-spin" /> : null}
              💬 ส่งแจ้งเตือนทดสอบเข้ากลุ่ม
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: TEMPLATES CONFIGURATION */}
      <div className="mb-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-1.5 mb-2">
          <Settings2 size={18} className="text-slate-600" />
          Notification Templates (เทมเพลตส่งข้อความ LINE)
        </h3>
        <p className="text-xs text-slate-400">ปรับเปลี่ยนโครงรูปอักษรที่ระบบจะเลือกส่งไปยัง LINE Group หรือ LINE OA อัตโนมัติเมื่อข้อมูลเอกสารถูกพิจารณา</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {templates.map(tpl => (
          <div 
            key={tpl.id} 
            onClick={() => setTemplateForm({ ...tpl })} 
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-[#00B900] transition-colors cursor-pointer group flex flex-col justify-between text-left"
          >
             <div>
               <div className="flex justify-between items-center mb-3">
                 <span className="font-bold text-sm text-slate-700">{tpl.name}</span>
                 <Badge type={tpl.status === 'Active' ? 'active' : 'inactive'}>{tpl.status}</Badge>
               </div>
               <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-500 font-mono line-clamp-3 leading-relaxed">
                 "{tpl.text}"
               </div>
             </div>
             <p className="text-xs text-[#00B900] font-bold mt-3 text-right group-hover:underline flex items-center justify-end gap-1">
               <Settings2 size={12} /> แก้ไขเทมเพลตข้อความ
             </p>
          </div>
        ))}
      </div>

      {/* EDIT TEMPLATE MODAL */}
      {templateForm && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setTemplateForm(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-[500px] flex flex-col animate-in zoom-in-95 text-left overflow-hidden">
             <div className="p-5 border-b border-slate-100 flex justify-between bg-slate-50 items-center">
               <div className="flex items-center gap-2">
                 <Settings2 className="text-[#00B900]" size={20} />
                 <h3 className="font-bold text-slate-800">Edit {templateForm.name}</h3>
               </div>
               <button onClick={() => setTemplateForm(null)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
             </div>

             <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
                  <select value={templateForm.status} onChange={e => setTemplateForm({ ...templateForm, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Message Text Template</label>
                  <textarea 
                    value={templateForm.text} 
                    onChange={e => setTemplateForm({ ...templateForm, text: e.target.value })} 
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono leading-relaxed" 
                    placeholder="ใส่ข้อความแจ้งเตือนที่นี่..." 
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Available wildcards: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-bold">{'{name}'}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-[#00B900] font-bold">{'{doc_ref}'}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600 font-bold">{'{amount}'}</code></p>
                </div>
             </div>

             <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                <button onClick={() => setTemplateForm(null)} className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-600 font-bold">Cancel</button>
                <button onClick={handleSaveTemplate} className="px-5 py-2 bg-[#00B900] hover:bg-[#009900] text-white rounded-lg text-sm font-bold flex items-center gap-1 shadow-sm transition-colors">
                  <Save size={15}/> Save Template
                </button>
             </div>
          </div>
         </div>
      )}
    </div>
  );
}
