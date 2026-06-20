import React, { useState, useEffect } from 'react';
import { Sparkles, Save, Fingerprint, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Toggle } from './shared';

export default function AiControlCenter() {
  const { toast } = useApp();
  const [loading, setLoading] = useState(true);
  const [aiConfig, setAiConfig] = useState({ ocr: true, duplicate: true, fakeSlip: true, threshold: 85, engine: 'Gemini 1.5 Pro' });

  useEffect(() => {
    fetch('/api/store/ai-config')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          setAiConfig(prev => ({ ...prev, ...data }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaveConfig = async () => {
    try {
      const res = await fetch('/api/store/ai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiConfig)
      });
      if (res.ok) {
        toast("บันทึกการตั้งค่า AI สำเร็จ", 'ok');
      } else {
        throw new Error();
      }
    } catch (e) {
      toast("เกิดข้อผิดพลาดในการบันทึกข้อมูล", 'err');
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading AI Settings...</div>;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-6">
        <div><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Sparkles className="text-purple-500"/> AI Control Center</h2><p className="text-slate-500 text-sm mt-1">ศูนย์ควบคุม OCR, ตรวจจับทุจริต และตั้งค่า Engine</p></div>
        <button onClick={handleSaveConfig} className="px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-purple-700 flex items-center gap-2 transition-all"><Save size={16}/> Save AI Config</button>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="col-span-2 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
            <div><h3 className="font-bold text-slate-800">OCR Engine</h3><p className="text-xs text-slate-500">โมเดลที่ใช้ดึงข้อมูลจากเอกสาร</p></div>
            <select value={aiConfig.engine} onChange={e => setAiConfig({...aiConfig, engine: e.target.value})} className="border border-slate-200 rounded-lg px-4 py-2 text-sm bg-slate-50 font-medium text-purple-700 outline-none"><option>Gemini 1.5 Pro</option><option>OpenAI GPT-4o</option><option>Azure Form Recognizer</option></select>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
            <div className="pr-8"><h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2"><Fingerprint size={16} className="text-indigo-500"/> Duplicate Detection</h3><p className="text-xs text-slate-500">เช็กความสอดคล้องไฟล์ด้วย File Hash และ Perceptual Hash ป้องกันการนำสลิปเดิมมาเบิกซ้ำ</p></div>
            <Toggle active={aiConfig.duplicate} onClick={() => setAiConfig({...aiConfig, duplicate: !aiConfig.duplicate})} />
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
            <div className="pr-8"><h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2"><AlertCircle size={16} className="text-rose-500"/> Fraud Image Tampering</h3><p className="text-xs text-slate-500">ตรวจจับร่องรอยการตัดต่อภาพ, สลิปปลอม, แก้ไขตัวเลข (แจ้งเตือนเป็น Risk Tag)</p></div>
            <Toggle active={aiConfig.fakeSlip} onClick={() => setAiConfig({...aiConfig, fakeSlip: !aiConfig.fakeSlip})} />
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-6 rounded-2xl border border-purple-100 h-fit">
           <h3 className="font-bold text-purple-900 mb-2">Confidence Threshold (%)</h3>
           <p className="text-sm text-purple-700/70 mb-6">ระดับความมั่นใจขั้นต่ำที่ระบบจะยอมรับข้อมูลอัตโนมัติ หากต่ำกว่าเกณฑ์จะส่งให้คนตรวจสอบ</p>
           <div className="flex items-center gap-4 mb-2">
             <input type="range" min="50" max="100" value={aiConfig.threshold} onChange={(e: any) => setAiConfig({...aiConfig, threshold: Number(e.target.value) || aiConfig.threshold})} className="w-full accent-purple-600 h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer" />
             <div className="bg-white border border-purple-200 text-purple-700 font-bold px-3 py-1.5 rounded-lg w-16 text-center">{aiConfig.threshold}%</div>
           </div>
           <div className="flex justify-between text-xs text-purple-400 font-bold mt-2"><span>Lenient (50)</span><span>Strict (100)</span></div>
        </div>
      </div>
    </div>
  );
}
