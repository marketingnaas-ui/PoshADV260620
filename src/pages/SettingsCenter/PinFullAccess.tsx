import React, { useState, useEffect } from 'react';
import { Save, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function PinFullAccess() {
  const { toast } = useApp();
  const [loading, setLoading] = useState(true);
  const [pinConfig, setPinConfig] = useState({
    length: '4 Digits',
    expiration: 'Never',
    retry: '5 Attempts',
    pinCode: '1234'
  });

  useEffect(() => {
    fetch('/api/store/security-pin-config')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          setPinConfig(prev => ({
            ...prev,
            ...data,
            pinCode: data.pinCode || '1234'
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSavePolicies = async () => {
    // Validate PIN length matches configuration option
    const reqLen = pinConfig.length === '6 Digits' ? 6 : 4;
    const pinStr = String(pinConfig.pinCode).trim();
    if (!/^\d+$/.test(pinStr)) {
      toast("รหัส PIN ต้องประกอบด้วยตัวเลขเท่านั้น", "err");
      return;
    }
    if (pinStr.length !== reqLen) {
      toast(`รหัส PIN ต้องมีความยาว ${reqLen} หลัก`, "err");
      return;
    }

    try {
      const res = await fetch('/api/store/security-pin-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pinConfig)
      });
      if (res.ok) {
        toast("💾 บันทึกนโยบายความปลอดภัยและรหัส PIN สำเร็จแล้ว!", "ok");
      } else {
        throw new Error();
      }
    } catch {
      toast("เกิดข้อผิดพลาดในการบันทึกข้อมูล", "err");
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading Pin Configuration...</div>;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">PIN & Security Policy</h2>
        <p className="text-slate-500 text-sm mt-1">นโยบายรหัสผ่านและการลงนามอิเล็กทรอนิกส์ด้านงานอนุมัติเอกสารและตรวจสอบ</p>
      </div>
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-3xl">
        <h3 className="font-bold text-lg text-slate-800 mb-6 border-b pb-2 flex items-center gap-2 text-[#f4ac5c]">
          <ShieldCheck size={20} /> PIN & Access Code Configuration
        </h3>
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="w-1/2">
              <h4 className="font-bold text-slate-800">รหัส PIN ผู้อนุมัติ/ตรวจสอบ (Master PIN) *</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">ใช้ใส่เพื่อตรวจสอบสิทธิ์ตอนอนุมัติเอกสารเบิก/เคลียร์ยอดย้อนหลัง</p>
            </div>
            <div className="w-1/3">
              <input 
                type="password" 
                maxLength={pinConfig.length === '6 Digits' ? 6 : 4}
                value={pinConfig.pinCode}
                onChange={e => setPinConfig({ ...pinConfig, pinCode: e.target.value.replace(/\D/g, '') })}
                className="w-full px-4 py-2 border rounded-lg text-center font-mono font-bold text-lg focus:border-[#f4ac5c] bg-white outline-none" 
                placeholder={pinConfig.length === '6 Digits' ? "******" : "****"}
              />
            </div>
          </div>

          <div className="flex justify-between items-center"><div className="w-2/3"><h4 className="font-bold text-slate-700">PIN Length</h4><p className="text-xs text-slate-500">จำนวนหลักของรหัส PIN สำหรับอนุมัติเอกสาร</p></div>
             <select value={pinConfig.length} onChange={e=>setPinConfig({...pinConfig, length: e.target.value})} className="border border-slate-200 rounded-lg px-4 py-2 text-sm"><option>4 Digits</option><option>6 Digits</option></select>
          </div>
          <div className="flex justify-between items-center"><div className="w-2/3"><h4 className="font-bold text-slate-700">PIN Expiration</h4><p className="text-xs text-slate-500">บังคับให้ผู้ใช้เปลี่ยนรหัส PIN เมื่อครบกำหนด</p></div>
             <select value={pinConfig.expiration} onChange={e=>setPinConfig({...pinConfig, expiration: e.target.value})} className="border border-slate-200 rounded-lg px-4 py-2 text-sm"><option>Never</option><option>Every 90 Days</option></select>
          </div>
          <div className="flex justify-between items-center"><div className="w-2/3"><h4 className="font-bold text-slate-700">Max Retry Attempts</h4><p className="text-xs text-slate-500">ล็อกบัญชีเมื่อใส่รหัสผิดเกินจำนวนครั้งที่กำหนด</p></div>
             <select value={pinConfig.retry} onChange={e=>setPinConfig({...pinConfig, retry: e.target.value})} className="border border-slate-200 rounded-lg px-4 py-2 text-sm"><option>5 Attempts</option><option>3 Attempts</option></select>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
          <button onClick={handleSavePolicies} className="px-6 py-2 bg-[#f4ac5c] hover:bg-[#e09b4b] text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"><Save size={16}/> Save Policies & PIN</button>
        </div>
      </div>
    </div>
  );
}
