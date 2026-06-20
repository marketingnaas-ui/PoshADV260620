import React, { useState, useEffect } from 'react';
import { Edit2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function NumberRunning() {
  const { toast } = useApp();
  const showToast = (msg: string) => toast(msg, 'ok');

  const [sequences, setSequences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/store/number-running')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setSequences(data);
        } else {
          setSequences([
            { id: 'S1', type: 'Advance Request', format: 'ADV-{YY}{MM}-{00000}', reset: 'Monthly', current: 'ADV-2606-00142' },
            { id: 'S2', type: 'Project Code', format: 'PRJ-{YY}{MM}-{000}', reset: 'Yearly', current: 'PRJ-2606-045' },
          ]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const [sequenceForm, setSequenceForm] = useState<any>(null);

  const handleSaveSequence = async () => {
    const isExisting = sequences.find(s => s.id === sequenceForm.id);
    const nextSeq = isExisting 
      ? sequences.map(s => s.id === sequenceForm.id ? sequenceForm : s)
      : [...sequences, sequenceForm];
    
    await fetch('/api/store/number-running', {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(nextSeq)
    });
    
    setSequences(nextSeq);
    setSequenceForm(null);
    showToast("อัปเดตแพทเทิร์นเลขเอกสารสำเร็จ");
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading Configuration...</div>;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6"><h2 className="text-2xl font-bold text-slate-800">Number Running Center</h2><p className="text-slate-500 text-sm mt-1">ตั้งค่ารูปแบบการรันเลขเอกสารอัตโนมัติ (Document Sequences)</p></div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
            <tr><th className="p-4">Document Type</th><th className="p-4">Prefix / Format</th><th className="p-4 text-center">Reset Rule</th><th className="p-4 text-right">Current Sequence</th><th className="p-4 text-center">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sequences.map((seq) => (
              <tr key={seq.id} className="hover:bg-slate-50">
                <td className="p-4 font-bold text-slate-800">{seq.type}</td>
                <td className="p-4 font-mono text-indigo-600 text-xs bg-indigo-50/50 rounded inline-block mt-2 px-2 py-1">{seq.format}</td>
                <td className="p-4 text-center text-slate-600">{seq.reset}</td>
                <td className="p-4 text-right font-mono font-bold text-slate-700">{seq.current}</td>
                <td className="p-4 text-center"><button onClick={() => setSequenceForm(seq)} className="text-slate-800 hover:text-indigo-600" title="แก้ไข"><Edit2 size={16}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sequenceForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSequenceForm(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-[400px] flex flex-col animate-in zoom-in-95">
             <div className="p-5 border-b border-slate-100 flex justify-between bg-slate-50 rounded-t-2xl"><h3 className="font-bold text-slate-800">Document Sequence</h3><button onClick={() => setSequenceForm(null)}><X size={20}/></button></div>
             <div className="p-6 space-y-4">
                <div><label className="block text-xs font-bold text-slate-500 mb-1">Type</label><input type="text" value={sequenceForm.type} readOnly className="w-full px-3 py-2 bg-slate-100 border rounded-lg text-sm text-slate-500" /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">Format Pattern</label><input type="text" value={sequenceForm.format} onChange={e=>setSequenceForm({...sequenceForm, format: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-mono text-indigo-600" /></div>
             </div>
             <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end rounded-b-2xl"><button onClick={handleSaveSequence} className="px-6 py-2 text-sm text-white bg-indigo-600 rounded-lg">Save Sequence</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
