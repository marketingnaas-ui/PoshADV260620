import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Settings2, Trash2, CheckCircle, X, Save } from 'lucide-react';
import { Badge } from './shared';
import { useApp } from '../../context/AppContext';

export default function ApprovalWorkflow() {
  const { toast, approvalMatrix, saveApprovalMatrix } = useApp();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [brokerName, setBrokerName] = useState('วิภา ทองสุข');

  const fetchWorkflows = () => {
    setLoading(true);
    fetch('/api/store/approval-workflows')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setWorkflows(data);
        } else {
          setWorkflows([
            { id: 'WF1', name: 'Advance Request Workflow', status: 'Active', steps: ['Requester', 'Project Manager', 'Accounting', 'Director'] }
          ]);
        }
      })
      .catch(() => {
        setWorkflows([
          { id: 'WF1', name: 'Advance Request Workflow', status: 'Active', steps: ['Requester', 'Project Manager', 'Accounting', 'Director'] }
        ]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  useEffect(() => {
    if (approvalMatrix?.signatureOwner) {
      setBrokerName(approvalMatrix.signatureOwner);
    }
  }, [approvalMatrix]);

  const handleSaveBroker = async () => {
    if (!brokerName.trim()) {
      toast("กรุณากรอกชื่อนายหน้า/ผู้อนุมัติร่วม", "err");
      return;
    }
    try {
      await saveApprovalMatrix({
        ...approvalMatrix,
        signatureOwner: brokerName.trim()
      });
      toast("💾 บันทึกผู้ดูแลนโยบายและนายหน้าสำเร็จแล้ว!", "ok");
    } catch {
      toast("เกิดข้อผิดพลาดในการบันทึก", "err");
    }
  };

  const [workflowForm, setWorkflowForm] = useState<any>(null);
  const [newStep, setNewStep] = useState('');

  const handleSaveWorkflow = async () => {
    if (!workflowForm.name) {
      toast("กรุณากรอกชื่อ Workflow", "err");
      return;
    }
    if (!workflowForm.steps || workflowForm.steps.length === 0) {
      toast("กรุณาเพิ่มสายอนุมัติอย่างน้อย 1 ขั้นตอน", "err");
      return;
    }

    let nextWorkflows = [];
    const isNew = workflowForm.id === 'NEW' || !workflows.some(w => w.id === workflowForm.id);
    
    let savingForm = { ...workflowForm };
    if (savingForm.id === 'NEW') {
      savingForm.id = 'WF-' + Date.now();
    }

    if (isNew) {
      nextWorkflows = [...workflows, savingForm];
    } else {
      nextWorkflows = workflows.map(w => w.id === savingForm.id ? savingForm : w);
    }

    try {
      const res = await fetch('/api/store/approval-workflows', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextWorkflows)
      });
      if (!res.ok) throw new Error();
      setWorkflows(nextWorkflows);
      setWorkflowForm(null);
      toast("บันทึกสายการอนุมัติเรียบร้อยแล้ว", "ok");
    } catch (e) {
      toast("เกิดข้อผิดพลาดในการบันทึกข้อมูล", "err");
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (!window.confirm("ต้องการลบสายงานอนุมัตินี้หรือไม่?")) return;
    const nextList = workflows.filter(w => w.id !== id);
    try {
      const res = await fetch('/api/store/approval-workflows', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextList)
      });
      if (!res.ok) throw new Error();
      setWorkflows(nextList);
      setWorkflowForm(null);
      toast("ลบสำเร็จ", "ok");
    } catch (e) {
      toast("เกิดข้อผิดพลาด", "err");
    }
  };

  const handleAddStep = () => {
    if (!newStep.trim()) return;
    setWorkflowForm({
      ...workflowForm,
      steps: [...(workflowForm.steps || []), newStep.trim()]
    });
    setNewStep('');
  };

  const handleRemoveStep = (index: number) => {
    const nextSteps = (workflowForm.steps || []).filter((_: any, i: number) => i !== index);
    setWorkflowForm({ ...workflowForm, steps: nextSteps });
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading Workflows...</div>;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-6">
        <div><h2 className="text-2xl font-bold text-slate-800">Approval Workflow</h2><p className="text-slate-500 text-sm mt-1">ตั้งค่าสายการอนุมัติตามมูลค่าหรือแผนกแบบไดนามิก</p></div>
        <button onClick={() => setWorkflowForm({ id: 'NEW', name: '', status: 'Active', steps: ['Requester'] })} className="flex items-center gap-2 px-4 py-2 bg-[#f4ac5c] hover:bg-[#e09b4b] rounded-lg text-sm font-bold text-white transition-colors shadow-sm"><Plus size={16}/> New Workflow</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
        <h3 className="font-bold text-slate-800 text-base mb-1.5 flex items-center gap-2">💼 นายหน้าและผู้อนุมัติเอกสาร (Broker & Authorizer Settings)</h3>
        <p className="text-xs text-slate-500 mb-4 pb-2 border-b border-slate-100">
          กำหนดชื่อนายหน้า/ผู้อนุมัติร่วมที่จะปรากฏในพื้นที่ลงนาม (Authorizer Block) และข้อมูลผู้ลงนามในใบขอเบิกเงินทดรองจ่ายโดยอัตโนมัติ
        </p>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end max-w-xl">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 mb-1.5">ชื่อนายหน้า / ผู้อนุมัติร่วมในระบบ *</label>
            <input 
              type="text" 
              value={brokerName} 
              onChange={e => setBrokerName(e.target.value)} 
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#f4ac5c] font-medium text-slate-800" 
              placeholder="เช่น วิภา ทองสุข" 
            />
          </div>
          <button 
            type="button" 
            onClick={handleSaveBroker} 
            className="px-5 py-2 hover:bg-[#e09b4b] bg-[#f4ac5c] text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm shrink-0"
            style={{ height: '38px' }}
          >
            <Save size={14} /> บันทึกข้อมูล
          </button>
        </div>
      </div>
      
      {workflows.map(wf => (
        <div key={wf.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6 group cursor-pointer hover:border-amber-300 transition-colors" onClick={() => setWorkflowForm({ ...wf })}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-slate-800">{wf.name}</h3>
            <div className="flex items-center gap-3">
                <Badge type={wf.status === 'Active' ? 'active' : 'inactive'}>{wf.status}</Badge>
                <button className="text-slate-800 hover:text-[#f4ac5c] transition-opacity" title="แก้ไข"><Edit2 size={16}/></button>
            </div>
          </div>
          <div className="flex items-center justify-between px-10 relative overflow-x-auto py-4">
             <div className="absolute top-1/2 left-20 right-20 h-1 bg-amber-100 -translate-y-1/2 z-0"></div>
             {(wf.steps || []).map((step: string, i: number) => (
                <div key={i} className="relative z-10 flex flex-col items-center min-w-[100px]">
                  <div className="w-12 h-12 rounded-full bg-[#f4ac5c] text-white flex items-center justify-center font-bold text-lg shadow-md border-4 border-white">{i+1}</div>
                  <div className="mt-3 font-bold text-sm text-slate-700">{step}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {i === 0 ? 'Submit' : i === (wf.steps.length - 1) ? 'Authorize' : 'Review & Verify'}
                  </div>
                </div>
             ))}
          </div>
        </div>
      ))}

      {workflowForm && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setWorkflowForm(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-[550px] flex flex-col max-h-[85vh] animate-in zoom-in-95 overflow-hidden">
             <div className="p-5 border-b border-slate-100 flex justify-between bg-slate-50 items-center">
                <div className="flex items-center gap-2">
                  <Settings2 className="text-[#f4ac5c]" size={20} />
                  <h3 className="font-bold text-slate-800">{workflowForm.id === 'NEW' ? 'New Workflow' : 'Configure Workflow Steps'}</h3>
                </div>
                <button onClick={() => setWorkflowForm(null)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
             </div>
             
             <div className="p-6 overflow-y-auto space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Workflow Name *</label>
                  <input type="text" value={workflowForm.name} onChange={e => setWorkflowForm({ ...workflowForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="เช่น สายอนุมัติฝ่ายวิศวกรรม" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
                  <select value={workflowForm.status} onChange={e => setWorkflowForm({...workflowForm, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">Approval Flow Tiers (Order dictates workflow sequence)</label>
                  <div className="space-y-2">
                    {(workflowForm.steps || []).map((step: string, index: number) => (
                      <div key={index} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <span className="w-6 h-6 rounded-full bg-[#f4ac5c]/15 text-[#f4ac5c] text-xs font-bold flex items-center justify-center shrink-0">{index + 1}</span>
                        <input 
                          type="text" 
                          value={step} 
                          onChange={e => {
                            const nextSteps = [...workflowForm.steps];
                            nextSteps[index] = e.target.value;
                            setWorkflowForm({ ...workflowForm, steps: nextSteps });
                          }} 
                          className="flex-1 bg-transparent border-none p-0 focus:ring-0 text-sm font-bold text-slate-700" 
                        />
                        <button onClick={() => handleRemoveStep(index)} className="text-slate-400 hover:text-red-500 transition-colors" title="ลบขั้นตอน"><Trash2 size={16}/></button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <input 
                      type="text" 
                      placeholder="เช่น Senior Manager, CFO" 
                      value={newStep} 
                      onChange={e => setNewStep(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && handleAddStep()}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm" 
                    />
                    <button onClick={handleAddStep} className="px-4 py-2 bg-[#f4ac5c] hover:bg-[#e09b4b] text-white font-bold text-xs rounded-lg flex items-center gap-1 shrink-0"><Plus size={14}/> Add Level</button>
                  </div>
                </div>
             </div>

             <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                {workflowForm.id !== 'NEW' ? (
                  <button onClick={() => handleDeleteWorkflow(workflowForm.id)} className="text-sm font-bold text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg flex items-center gap-1 transition-colors"><Trash2 size={15}/> Delete Workflow</button>
                ) : <div/>}
                
                <div className="flex gap-2 ml-auto">
                  <button onClick={() => setWorkflowForm(null)} className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-600 font-bold">Cancel</button>
                  <button onClick={handleSaveWorkflow} className="px-6 py-2 text-sm text-white bg-[#f4ac5c] hover:bg-[#e09b4b] rounded-lg font-bold flex items-center gap-1 shadow-sm transition-colors"><Save size={14}/> Save Workflow</button>
                </div>
             </div>
          </div>
         </div>
      )}
    </div>
  );
}
