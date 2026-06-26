import React, { useState, useRef, useEffect } from 'react';
import { Upload, PenTool, Image as ImageIcon } from 'lucide-react';

export const SignatureInput = ({ value, onChange }: any) => {
  const [mode, setMode] = useState('draw'); 
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (mode === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#1e1b4b';
      }
    }
  }, [mode]);

  const startDrawing = (e: any) => { setIsDrawing(true); draw(e); };
  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.beginPath(); 
    if (canvasRef.current) {
      onChange(canvasRef.current.toDataURL('image/png'));
    }
  };
  const clearSignature = () => {
    if (mode === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    }
    onChange(null);
  };
  const handleFileUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => onChange(event.target?.result);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
      <div className="flex border-b border-slate-200 bg-white">
        <button onClick={() => setMode('draw')} className={`flex-1 py-2 text-sm font-bold flex items-center justify-center gap-2 ${mode === 'draw' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
          <PenTool size={16} /> เซ็นผ่านหน้าจอ
        </button>
        <button onClick={() => setMode('upload')} className={`flex-1 py-2 text-sm font-bold flex items-center justify-center gap-2 ${mode === 'upload' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
          <ImageIcon size={16} /> อัปโหลดรูป/SVG
        </button>
      </div>
      <div className="p-4 flex flex-col items-center justify-center relative min-h-[160px]">
        {mode === 'draw' ? (
          <>
            {value && !isDrawing && mode === 'draw' && (
               <div className="absolute inset-0 bg-white z-10 flex items-center justify-center pointer-events-none p-4">
                 <img src={value} alt="Signature" className="max-h-full max-w-full opacity-80" />
               </div>
            )}
            <canvas ref={canvasRef} width={400} height={150} className="bg-white border border-slate-200 rounded-lg shadow-inner cursor-crosshair touch-none w-full max-w-[400px]" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
            <p className="text-xs text-slate-400 mt-2">ใช้เมาส์หรือนิ้ววาดลายเซ็น</p>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg bg-white p-6 hover:border-indigo-400 transition-colors">
             {value ? <img src={value} alt="Uploaded" className="max-h-24 max-w-full mb-3" /> : <div className="w-12 h-12 bg-indigo-50 text-indigo-400 rounded-full flex items-center justify-center mb-3"><Upload size={24} /></div>}
             <label className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold cursor-pointer hover:bg-indigo-100 transition-colors">
               เลือกไฟล์ภาพหรือ SVG <input type="file" accept="image/png, image/jpeg, image/svg+xml" className="hidden" onChange={handleFileUpload} />
             </label>
          </div>
        )}
      </div>
      <div className="p-3 bg-white border-t border-slate-100 flex justify-end">
        <button onClick={clearSignature} className="text-xs font-bold text-rose-500 hover:text-rose-600 px-3 py-1 rounded hover:bg-rose-50">ล้างข้อมูลลายเซ็น</button>
      </div>
    </div>
  );
};

export const Badge = ({ children, type }: any) => {
  const styles: any = {
    active: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    inactive: 'bg-rose-50 text-rose-600 border border-rose-100',
    warning: 'bg-amber-50 text-amber-600 border border-amber-100',
    info: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
    gray: 'bg-slate-50 text-slate-600 border border-slate-200',
  };
  return <span className={`px-2.5 py-1 text-[11px] uppercase tracking-wider font-bold rounded-md ${styles[type] || styles.info}`}>{children}</span>;
};

export const Toggle = ({ active, onClick }: any) => (
  <button onClick={onClick} className={`w-11 h-6 rounded-full flex items-center transition-colors p-1 shrink-0 ${active ? 'bg-indigo-500' : 'bg-slate-200'}`}>
    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${active ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);

export const getAvatar = (name: string, lineId?: string) => {
  if (lineId && lineId.length > 3 && lineId !== '-') return `https://i.pravatar.cc/150?u=${lineId}`;
  if (name) return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4f46e5&color=fff`;
  return `https://ui-avatars.com/api/?name=?&background=cbd5e1&color=fff`;
};
