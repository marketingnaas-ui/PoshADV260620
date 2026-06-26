import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Settings2,
  Save, 
  RefreshCw, 
  Bell, 
  Info,
  Copy,
  Target
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface LineConfig {
  channelId: string;
  channelSecret: string;
  channelAccessToken: string;
  groupId: string;
  enabled: boolean;
  automationEnabled: boolean;
  status: 'CONNECTED' | 'DISCONNECTED';
  liffId?: string;
}

export default function LineIntegration() {
  const { toast } = useApp();
  const [loading, setLoading] = useState(true);
  
  // LINE Messaging API Configuration
  const [lineConfig, setLineConfig] = useState<LineConfig>({
    channelId: '',
    channelSecret: '',
    channelAccessToken: '',
    groupId: '',
    enabled: true,
    automationEnabled: true,
    status: 'DISCONNECTED',
    liffId: ''
  });

  const [savingConfig, setSavingConfig] = useState(false);

  // Webhook URL (computed)
  const webhookUrl = `${window.location.origin}/api/line/webhook`;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Config
        const cfgRes = await fetch('/api/store/line-messaging-config');
        if (cfgRes.ok) {
          const cfgData = await cfgRes.json();
          if (cfgData && typeof cfgData === 'object' && !Array.isArray(cfgData)) {
            setLineConfig(prev => ({ ...prev, ...cfgData }));
          }
        } else {
          console.warn('Failed to fetch LINE config:', cfgRes.statusText);
        }
      } catch (e) {
        console.error('Failed to load LINE settings', e);
        toast("ไม่สามารถโหลดการตั้งค่า LINE ได้ โปรดตรวจสอบการเชื่อมต่อ", "err");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch('/api/store/line-messaging-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lineConfig)
      });
      if (res.ok) {
        toast("✅ บันทึกการเชื่อมต่อ LINE Messaging API เรียบร้อยแล้ว", "ok");
      } else {
        throw new Error();
      }
    } catch (e) {
      toast("เกิดข้อผิดพลาดในการบันทึก", "err");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast("คัดลอก Webhook URL แล้ว", "ok");
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <RefreshCw className="animate-spin mx-auto mb-4 text-[#06C755]" size={36} />
        <p className="font-medium font-noto">กำลังโหลดข้อมูล LINE Messaging API...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 max-w-3xl">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="p-1.5 bg-[#06C755] rounded-lg text-white">
              <MessageSquare size={22} />
            </span>
            LINE Messaging API
          </h2>
          <p className="text-slate-500 text-sm mt-1">ตั้งค่าการแจ้งเตือนผ่านบัญชี LINE Official (Messaging API)</p>
        </div>
        
        <button 
          onClick={handleSaveConfig} 
          disabled={savingConfig}
          className="px-5 py-2.5 bg-[#06C755] hover:bg-[#05a647] font-bold text-white rounded-xl text-xs shadow-sm transition-all flex items-center gap-2"
        >
          {savingConfig ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          บันทึกการเชื่อมต่อ LINE
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Settings2 className="text-[#06C755]" size={18} />
              Channel Credentials
            </h3>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${lineConfig.channelAccessToken ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {lineConfig.channelAccessToken ? 'Configuration Ready' : 'Incomplete'}
              </span>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Channel ID</label>
              <input 
                type="text" 
                value={lineConfig.channelId} 
                onChange={e => setLineConfig({ ...lineConfig, channelId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-[#06C755]" 
                placeholder="เช่น 2001234567"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Channel Secret</label>
              <input 
                type="password" 
                value={lineConfig.channelSecret} 
                onChange={e => setLineConfig({ ...lineConfig, channelSecret: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-[#06C755]" 
                placeholder="••••••••••••••••••••••••••••••••"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Channel Access Token (Long-lived)</label>
              <textarea 
                rows={2}
                value={lineConfig.channelAccessToken} 
                onChange={e => setLineConfig({ ...lineConfig, channelAccessToken: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-[#06C755]" 
                placeholder="วาง Access Token จาก LINE Developers Console..."
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">LINE LIFF ID</label>
              <input 
                type="text" 
                value={lineConfig.liffId || ''} 
                onChange={e => setLineConfig({ ...lineConfig, liffId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-[#06C755]" 
                placeholder="เช่น 2001234567-AbCdEfGh"
              />
              <p className="text-[10px] text-slate-400 mt-1">ใช้สำหรับการล็อกอินและปิดหน้าต่างอัตโนมัติของหน้าจออนุมัติจ่ายเงินบน LINE LIFF</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Bell className="text-[#06C755]" size={18} />
              ตั้งค่าการแจ้งเตือน (Messaging API)
            </h3>
          </div>

          <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800">Automated Group Notifications</h4>
                <p className="text-[10px] text-slate-500">ส่งข้อความอัตโนมัติเข้ากลุ่มเมื่อมีการอนุมัติรายการ</p>
              </div>
              <div className="relative inline-flex h-5 w-9 items-center rounded-full bg-slate-200 cursor-pointer transition-colors"
                onClick={() => setLineConfig(prev => ({ ...prev, automationEnabled: !prev.automationEnabled }))}>
                <div className={`h-4 w-4 transform rounded-full bg-white transition-transform ${lineConfig.automationEnabled ? 'translate-x-4 bg-[#06C755]' : 'translate-x-1'}`} />
                <div className={`absolute inset-0 rounded-full transition-colors ${lineConfig.automationEnabled ? 'bg-[#06C755]/20' : 'bg-transparent'}`} />
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-5">
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
               <label className="block text-[11px] font-bold text-emerald-700 mb-1 uppercase tracking-wider flex items-center gap-1.5">
                 <Target className="size-3.5" /> Target Group ID / Recipient ID
               </label>
               <input 
                 type="text" 
                 value={lineConfig.groupId} 
                 onChange={e => setLineConfig({ ...lineConfig, groupId: e.target.value })}
                 className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-xs font-mono outline-none focus:border-[#06C755] bg-white" 
                 placeholder="เช่น C123456789... (สำหรับกลุ่ม) หรือ U123456... (สำหรับบุคคล)"
               />
               <div className="mt-3 space-y-2">
                 <p className="text-[10px] text-emerald-800 font-bold flex items-center gap-1">
                   <Info size={12} /> วิธีหา Group ID สำหรับส่งเข้ากลุ่ม:
                 </p>
                 <ul className="text-[10px] text-emerald-600 space-y-1 list-disc pl-4 leading-relaxed">
                   <li>เชิญ Bot เข้าไปในกลุ่ม LINE ที่ต้องการ</li>
                   <li>พิมพ์คำว่า <span className="font-bold border-b border-emerald-300 px-1 text-emerald-700 select-all font-mono">ID</span> ในแชทกลุ่มนั้น</li>
                   <li>Bot จะตอบกลับด้วย ID ของกลุ่ม (เริ่มต้นด้วยตัว C) ให้นำมาวางในช่องด้านบน</li>
                 </ul>
               </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Webhook URL</span>
                <button onClick={handleCopyWebhook} className="text-[#06C755] hover:text-[#05a647] flex items-center gap-1 text-[10px] font-bold">
                  <Copy size={12} /> Copy URL
                </button>
              </div>
              <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 text-[10px] font-mono text-slate-600 break-all">
                {webhookUrl}
              </div>
              <p className="text-[10px] text-slate-400 mt-2 flex items-start gap-1">
                <Info size={12} className="shrink-0" />
                <span>นำ URL นี้ไปกรอกในส่วน Webhook settings ของ LINE Developer Console และเปิดใช้งาน "Use webhook"</span>
              </p>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-bold text-blue-700 uppercase">Callback URL (Redirect URI)</span>
                <button 
                  onClick={() => {
                    const url = `${window.location.origin.replace('http://', 'https://')}/api/auth/line/callback`;
                    navigator.clipboard.writeText(url);
                    toast('คัดลอก Callback URL แล้ว', 'success');
                  }} 
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-[10px] font-bold"
                >
                  <Copy size={12} /> Copy URL
                </button>
              </div>
              <div className="bg-white px-3 py-2 rounded-lg border border-blue-200 text-[10px] font-mono text-blue-600 break-all">
                {window.location.origin.replace('http://', 'https://')}/api/auth/line/callback
              </div>
              <p className="text-[10px] text-blue-400 mt-2 flex items-start gap-1">
                <Info size={12} className="shrink-0" />
                <span>นำ URL นี้ไปใส่ใน LINE Developers {">"} LINE Login {">"} Callback URL เพื่อให้ล็อกอินได้ถูกต้อง</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
