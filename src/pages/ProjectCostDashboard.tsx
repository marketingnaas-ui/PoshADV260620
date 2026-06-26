import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fmt, fmtM } from '../lib/utils';
import { BarChart2, Calendar, Filter, Download, PieChart as PieChartIcon, TrendingUp, AlertTriangle, CheckCircle, PackageOpen, ArrowLeft, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';

export const ProjectCostDashboard = () => {
  const { advances, masterProjects, masterCategories, setPage } = useApp();
  
  const [periodFilter, setPeriodFilter] = useState('all');
  const [selectedProject, setSelectedProject] = useState('all');
  const [detailedProjectId, setDetailedProjectId] = useState<string | null>(null);

  const filteredAdvances = useMemo(() => {
    let result = advances.filter(r => !['REJECTED', 'ไม่อนุมัติ', 'ปฏิเสธ'].includes(r.status));
    
    // Apply project filter
    if (selectedProject !== 'all') {
      result = result.filter(r => r.pIds && r.pIds.includes(selectedProject));
    }
    
    // Apply period filter (mock logic since real dates depend on data)
    const now = new Date();
    if (periodFilter === 'this_month') {
      result = result.filter(r => new Date(r.date || r.reqDate).getMonth() === now.getMonth() && new Date(r.date || r.reqDate).getFullYear() === now.getFullYear());
    } else if (periodFilter === 'last_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      result = result.filter(r => new Date(r.date || r.reqDate).getMonth() === lastMonth.getMonth() && new Date(r.date || r.reqDate).getFullYear() === lastMonth.getFullYear());
    } else if (periodFilter === 'this_year') {
      result = result.filter(r => new Date(r.date || r.reqDate).getFullYear() === now.getFullYear());
    }

    return result;
  }, [advances, periodFilter, selectedProject]);

  // Calculations
  const projectStats = useMemo(() => {
    return masterProjects.map(p => {
      const projAdvances = filteredAdvances.filter(r => r.pIds && r.pIds.includes(p.id));
      
      const totalBudget = p.budget || 0; 
      
      // Calculate actualExpenses strictly from cleared receipts items
      let actualExpenses = 0;
      projAdvances.forEach(r => {
        if (r.receipts) {
          r.receipts.forEach((rcpt: any) => {
            if (rcpt.items) {
              rcpt.items.forEach((it: any) => {
                if ((it.projectId === p.id || it.projectId === p.code) && it.status !== 'REJECTED') {
                  actualExpenses += (Number(it.qty) || 0) * (Number(it.price) || 0);
                }
              });
            }
          });
        }
      });
      
      // Calculate pendingAdvances by dividing advance amount equally and subtracting cleared portion
      let pendingAdvances = 0;
      projAdvances.forEach(r => {
        if (!['CLOSED', 'ปิดยอด'].includes(r.status)) {
          const numProjects = r.pIds ? r.pIds.length : 1;
          const share = (Number(r.appAmount || r.amount) || 0) / (numProjects || 1);
          // Find how much was cleared for this project in this advance
          let clearedForProject = 0;
          if (r.receipts) {
            r.receipts.forEach((rcpt: any) => {
              if (rcpt.items) {
                rcpt.items.forEach((it: any) => {
                  if ((it.projectId === p.id || it.projectId === p.code) && it.status !== 'REJECTED') {
                    clearedForProject += (Number(it.qty) || 0) * (Number(it.price) || 0);
                  }
                });
              }
            });
          }
          pendingAdvances += Math.max(0, share - clearedForProject);
        }
      });
                                          
      // Calculate closedExpenses strictly from cleared receipts of closed advances
      let closedExpenses = 0;
      projAdvances.forEach(r => {
        if (['CLOSED', 'ปิดยอด'].includes(r.status)) {
          if (r.receipts) {
            r.receipts.forEach((rcpt: any) => {
              if (rcpt.items) {
                rcpt.items.forEach((it: any) => {
                  if ((it.projectId === p.id || it.projectId === p.code) && it.status !== 'REJECTED') {
                    closedExpenses += (Number(it.qty) || 0) * (Number(it.price) || 0);
                  }
                });
              }
            });
          }
        }
      });

      // Extract categories from cleared receipts
      const categoryTally: Record<string, number> = {};
      projAdvances.forEach(a => {
        if (a.receipts) {
          a.receipts.forEach((rcpt: any) => {
            if (rcpt.items) {
              rcpt.items.forEach((it: any) => {
                if ((it.projectId === p.id || it.projectId === p.code) && it.status !== 'REJECTED') {
                  const catName = it.category || 'อื่นๆ';
                  categoryTally[catName] = (categoryTally[catName] || 0) + ((Number(it.qty) || 0) * (Number(it.price) || 0));
                }
              });
            }
          });
        }
      });

      return {
        ...p,
        totalBudget,
        actualExpenses,
        pendingAdvances,
        closedExpenses,
        categoryTally,
        progress: totalBudget > 0 ? (actualExpenses / totalBudget) * 100 : 0
      };
    }).sort((a, b) => b.actualExpenses - a.actualExpenses);
  }, [filteredAdvances, masterProjects, masterCategories]);

  const totalActual = projectStats.reduce((sum, p) => sum + p.actualExpenses, 0);
  const totalPending = projectStats.reduce((sum, p) => sum + p.pendingAdvances, 0);
  const totalClosed = projectStats.reduce((sum, p) => sum + p.closedExpenses, 0);

  const displayProjects = selectedProject === 'all' 
    ? projectStats.filter(p => p.actualExpenses > 0 || p.pendingAdvances > 0)
    : projectStats.filter(p => p.id === selectedProject);

  const detailedProject = detailedProjectId ? projectStats.find(p => p.id === detailedProjectId) : null;
  const COLORS = ['#4E958D', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#6b7280', '#10b981', '#f43f5e'];

  const getTimelineData = (projectId: string) => {
    const projAdvances = advances.filter(r => r.pIds && r.pIds.includes(projectId) && !['REJECTED', 'ไม่อนุมัติ', 'ปฏิเสธ'].includes(r.status));
    const monthlyData: Record<string, number> = {};
    
    // Create last 6 months buckets
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
      monthlyData[label] = 0;
    }

    projAdvances.forEach(a => {
      if (a.receipts) {
        a.receipts.forEach((rcpt: any) => {
          if (rcpt.items) {
            rcpt.items.forEach((it: any) => {
              if ((it.projectId === projectId) && it.status !== 'REJECTED') {
                const date = new Date(rcpt.date || a.date || a.reqDate);
                const label = date.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
                if (monthlyData[label] !== undefined) {
                  monthlyData[label] += (Number(it.qty) || 0) * (Number(it.price) || 0);
                }
              }
            });
          }
        });
      }
    });

    return Object.keys(monthlyData).map(k => ({
      name: k,
      ค่าใช้จ่าย: monthlyData[k]
    }));
  };

  if (detailedProject) {
    const pieData: { name: string; value: number }[] = Object.entries(detailedProject.categoryTally).map(([name, value]) => ({ 
      name, 
      value: typeof value === 'number' ? value : Number(value) || 0 
    }));
    const timelineData = getTimelineData(detailedProject.id);

    return (
      <div className="flex flex-col gap-6 p-2 lg:p-4 max-w-7xl mx-auto w-full animate-in fade-in duration-300">
        <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setDetailedProjectId(null)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="text-[10px] font-bold text-indigo-500 tracking-wider uppercase mb-1">รายละเอียดโครงการ (Project Insights)</div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2">
              {detailedProject.name} <span className="text-sm font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">[{detailedProject.id}]</span>
            </h1>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main KPI Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-5"><TrendingUp size={120} /></div>
                <div className="text-xs font-bold text-slate-500 uppercase mb-2">ยอดใช้จ่ายจริง (Actual)</div>
                <div className="text-4xl font-black text-slate-800 tracking-tight">฿ {fmt(detailedProject.actualExpenses)}</div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${detailedProject.progress > 90 ? 'bg-rose-500' : detailedProject.progress > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(Number.isFinite(detailedProject.progress) ? detailedProject.progress : 0, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-slate-600">{detailedProject.progress.toFixed(1)}%</span>
                </div>
                <div className="text-xs text-slate-400 mt-2">จากงบประมาณ: ฿{fmt(detailedProject.totalBudget)}</div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase mb-2">สถานะเบิกจ่าย</div>
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold mb-1">รอดำเนินการ (Pending)</div>
                      <div className="text-xl font-black text-amber-600">฿{fmt(detailedProject.pendingAdvances)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-bold mb-1">ปิดบัญชีแล้ว (Closed)</div>
                      <div className="text-xl font-black text-emerald-600">฿{fmt(detailedProject.closedExpenses)}</div>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setPage('list')}
                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl transition-colors border border-slate-200"
                >
                  ดูรายการเบิกทั้งหมดของโครงการนี้ →
                </button>
              </div>
            </div>

            {/* Timeline Chart */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-6">
                <Activity size={16} className="text-indigo-500" />
                แนวโน้มค่าใช้จ่ายย้อนหลัง 6 เดือน
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(value) => `฿${fmtM(value)}`} />
                    <Tooltip 
                      formatter={(value: number) => [`฿${fmt(value)}`, 'ค่าใช้จ่าย']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="ค่าใช้จ่าย" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Side Column */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-6">
                <PieChartIcon size={16} className="text-rose-500" />
                สัดส่วนตามหมวดหมู่
              </h3>
              
              {pieData.length > 0 ? (
                <>
                  <div className="h-48 w-full mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [`฿${fmt(value)}`, '']}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {pieData.slice().sort((a, b) => b.value - a.value).map((entry, index) => (
                      <div key={index} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                          <span className="font-medium text-slate-600 truncate max-w-[120px]">{entry.name}</span>
                        </div>
                        <span className="font-bold text-slate-800">฿{fmt(entry.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-10 text-slate-400 text-xs italic">ไม่มีข้อมูลค่าใช้จ่ายแยกตามหมวดหมู่</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-2 lg:p-4 max-w-7xl mx-auto w-full animate-in fade-in duration-300">
      
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100">
              <BarChart2 size={24} />
            </div>
            แดชบอร์ดต้นทุนโครงการ (Project Cost Dashboard)
          </h1>
          <p className="text-sm text-slate-500 mt-2 font-medium">สรุปค่าใช้จ่ายจริงและการเบิกจ่ายตามงบประมาณของแต่ละโครงการ</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Calendar size={16} className="text-slate-400" />
            <select 
              className="bg-transparent border-none outline-none text-xs font-bold text-slate-700 cursor-pointer pr-4"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
            >
              <option value="all">ทุกช่วงเวลาสะสม</option>
              <option value="this_month">เดือนปัจจุบัน</option>
              <option value="last_month">เดือนที่แล้ว</option>
              <option value="this_year">ปีปัจจุบัน</option>
            </select>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Filter size={16} className="text-slate-400" />
            <select 
              className="bg-transparent border-none outline-none text-xs font-bold text-slate-700 cursor-pointer pr-4 max-w-[150px] truncate"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="all">ทุกโครงการ (ภาพรวม)</option>
              {masterProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <TrendingUp size={80} />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
              <BarChart2 size={20} />
            </div>
            <h3 className="font-bold text-slate-600 text-sm">ค่าใช้จ่ายโครงการรวม</h3>
          </div>
          <div className="mt-auto">
            <div className="text-3xl font-black text-slate-800 tracking-tight">{fmtM(totalActual)}</div>
            <div className="text-sm font-bold text-slate-500 mt-1">฿{fmt(totalActual)} บาท</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <AlertTriangle size={80} />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <h3 className="font-bold text-slate-600 text-sm">เงินทดรองรอดำเนินการ</h3>
          </div>
          <div className="mt-auto">
            <div className="text-3xl font-black text-amber-600 tracking-tight">{fmtM(totalPending)}</div>
            <div className="text-sm font-bold text-amber-600/70 mt-1">฿{fmt(totalPending)} บาท (เบิกแต่ยังไม่ปิด)</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <CheckCircle size={80} />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle size={20} />
            </div>
            <h3 className="font-bold text-slate-600 text-sm">ยอดค่าใช้จ่ายที่ปิดบัญชีแล้ว</h3>
          </div>
          <div className="mt-auto">
            <div className="text-3xl font-black text-emerald-600 tracking-tight">{fmtM(totalClosed)}</div>
            <div className="text-sm font-bold text-emerald-600/70 mt-1">฿{fmt(totalClosed)} บาท</div>
          </div>
        </div>
      </div>

      {/* Project Details */}
      <div className="space-y-6">
        {displayProjects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-center shadow-sm">
            <PackageOpen size={48} className="text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700">ไม่พบข้อมูลค่าใช้จ่าย</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-md">ยังไม่มีการบันทึกค่าใช้จ่ายหรือเงินยืมทดรองสำหรับช่วงเวลาหรือโครงการที่เลือก</p>
          </div>
        ) : (
          displayProjects.map((proj) => (
            <div key={proj.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col lg:flex-row hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer" onClick={() => setDetailedProjectId(proj.id)}>
              {/* Project Main Info */}
              <div className="p-5 md:p-6 lg:w-1/3 border-b lg:border-b-0 lg:border-r border-slate-100 bg-slate-50/50 flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-indigo-500 tracking-wider uppercase bg-indigo-100 px-2 py-1 rounded-md">{proj.id}</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-800 leading-tight mb-2 group-hover:text-indigo-600 transition-colors">{proj.name}</h3>
                  <p className="text-xs text-slate-500 font-medium line-clamp-2 mb-6">ผู้จัดการ: {proj.manager || 'ไม่ได้ระบุ'}</p>
                </div>
                
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">ยอดใช้จ่ายจริง (Actual)</div>
                  <div className="text-2xl font-black text-slate-800 mb-1">฿ {fmt(proj.actualExpenses)}</div>
                  {proj.totalBudget > 0 && (
                    <div className="flex items-center gap-2 mt-4">
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${proj.progress > 90 ? 'bg-rose-500' : proj.progress > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(Number.isFinite(proj.progress) ? proj.progress : 0, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-600">{proj.progress.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Project Stats & Categories */}
              <div className="p-5 md:p-6 lg:w-2/3 flex flex-col relative">
                <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-slate-100">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ยอดรอเคลียร์ / รอโอน</div>
                    <div className="text-lg font-black text-amber-600">฿ {fmt(proj.pendingAdvances)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ยอดปิดบัญชีแล้ว</div>
                    <div className="text-lg font-black text-emerald-600">฿ {fmt(proj.closedExpenses)}</div>
                  </div>
                </div>

                <div className="flex-1">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2 mb-4">
                    <PieChartIcon size={14} /> สัดส่วนค่าใช้จ่ายตามหมวดหมู่
                  </h4>
                  
                  {Object.keys(proj.categoryTally).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(proj.categoryTally)
                        .sort((a, b) => (b[1] as number) - (a[1] as number))
                        .map(([cat, amount], idx) => {
                          const numAmount = amount as number;
                          const percent = (numAmount / proj.actualExpenses) * 100;
                          return (
                            <div key={idx} className="flex items-center gap-3">
                              <div className="w-1/3 truncate text-xs font-medium text-slate-600">{cat}</div>
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-indigo-400 rounded-full"
                                  style={{ width: `${Math.max(Number.isFinite(percent) ? percent : 0, 1)}%` }}
                                />
                              </div>
                              <div className="w-24 text-right text-xs font-bold text-slate-700">฿ {fmt(numAmount)}</div>
                            </div>
                          );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic py-4">ไม่พบข้อมูลหมวดหมู่ค่าใช้จ่าย</div>
                  )}
                </div>
                
                <div className="absolute right-6 bottom-6 text-indigo-500 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  ดูรายละเอียด <ArrowLeft size={14} className="rotate-180" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ProjectCostDashboard;
