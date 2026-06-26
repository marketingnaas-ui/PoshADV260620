import React, { useState } from 'react';
import { FileText, Users, FolderKanban } from 'lucide-react';

export default function CodeManagement() {
  const [activeTab, setActiveTab] = useState<'document' | 'employee' | 'project'>('document');

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Code Management</h2>
        <p className="text-slate-500 text-sm mt-1">Master Code & Number Running Rules</p>
      </div>

      <div className="flex gap-4 mb-6 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('document')}
          className={`flex items-center gap-2 pb-3 px-4 font-bold border-b-2 transition-all ${activeTab === 'document' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}
        >
          <FileText size={18} /> Document Running
        </button>
        <button 
          onClick={() => setActiveTab('employee')}
          className={`flex items-center gap-2 pb-3 px-4 font-bold border-b-2 transition-all ${activeTab === 'employee' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}
        >
          <Users size={18} /> Employee Code
        </button>
        <button 
          onClick={() => setActiveTab('project')}
          className={`flex items-center gap-2 pb-3 px-4 font-bold border-b-2 transition-all ${activeTab === 'project' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}
        >
          <FolderKanban size={18} /> Project Code
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        {activeTab === 'document' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">ADV / CLR / SAV Running Sequence</h3>
              <p className="text-slate-600 mb-4">
                เอกสารประเภท Advance Request (ADV), Clearance Report (CLR), และ Summary Advance Report (SAV) ใช้ Running Sequence ร่วมกันทั้งหมด
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-700 mb-4">รูปแบบ (Format)</h4>
                <div className="bg-white p-3 rounded border border-indigo-100 text-indigo-700 font-mono text-center text-lg mb-2 shadow-sm">
                  {'{TYPE}'}-{'{YY}'}{'{MM}'}-{'{###}'}
                </div>
                <p className="text-sm text-slate-500 text-center">ตัวอย่าง: ADV-2606-001, CLR-2606-002, SAV-2606-003</p>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-700 mb-4">เงื่อนไขการ Reset</h4>
                <div className="bg-white p-3 rounded border border-orange-100 text-orange-700 font-bold text-center text-lg mb-2 shadow-sm">
                  Monthly Reset (รีเซ็ตรายเดือน)
                </div>
                <p className="text-sm text-slate-500 mt-2">เมื่อเริ่มต้นเดือนใหม่ Counter จะกลับไปเริ่มที่ 001 เสมอ โดยที่รันต่อเนื่องไม่แยกประเภท</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'employee' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Employee Code Sequence</h3>
              <p className="text-slate-600 mb-4">
                รหัสพนักงานถูกจัดการแบบรวมศูนย์ (Centralized)
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-700 mb-4">รูปแบบ (Format)</h4>
                <div className="bg-white p-3 rounded border border-indigo-100 text-indigo-700 font-mono text-center text-lg mb-2 shadow-sm">
                  SEM-{'{YYYY}'}-{'{###}'}
                </div>
                <p className="text-sm text-slate-500 text-center">ตัวอย่าง: SEM-2026-001, SEM-2026-002</p>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-700 mb-4">เงื่อนไขการ Reset</h4>
                <div className="bg-white p-3 rounded border border-orange-100 text-orange-700 font-bold text-center text-lg mb-2 shadow-sm">
                  Yearly Reset (รีเซ็ตรายปี)
                </div>
                <p className="text-sm text-slate-500 mt-2">Reset รหัสใหม่เฉพาะวันที่ 1 มกราคมของทุกปี</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'project' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Project Code Sequence</h3>
              <p className="text-slate-600 mb-4">
                รหัสโครงการจะถูกสร้างตาม Prefix อัตโนมัติที่แปลงจาก 3 ตัวอักษรแรกของชื่อโครงการ
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-700 mb-4">รูปแบบ (Format)</h4>
                <div className="bg-white p-3 rounded border border-indigo-100 text-indigo-700 font-mono text-center text-lg mb-2 shadow-sm">
                  {'{PREFIX}'}-{'{YY}'}{'{MM}'}-{'{###}'}
                </div>
                <p className="text-sm text-slate-500 text-center">ตัวอย่าง: WEL-2606-001, GRE-2606-002</p>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-700 mb-4">เงื่อนไขการ Reset</h4>
                <div className="bg-white p-3 rounded border border-orange-100 text-orange-700 font-bold text-center text-lg mb-2 shadow-sm">
                  Yearly Reset (รีเซ็ตรายปี)
                </div>
                <p className="text-sm text-slate-500 mt-2">ห้าม Reset ทุกเดือน ให้พิจารณารีเซ็ตเฉพาะเมื่อขึ้นรอบปีใหม่เท่านั้น (ตาม Prefix)</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
