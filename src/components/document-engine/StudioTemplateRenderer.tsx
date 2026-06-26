import React from 'react';
import { QrCode, Image as ImageIcon, Hash, Table2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StudioTemplateRendererProps {
  template: any;
  data: any;
}

export const StudioTemplateRenderer: React.FC<StudioTemplateRendererProps> = ({ template, data }) => {
  const config = template.studioConfig || template.config;
  if (!config || !config.pages) return null;

  const elements = config.elements || {};
  const pages = config.pages || [];

  const bindData = (text: string) => {
    if (!text) return '';
    return text.replace(/\{\{(.*?)\}\}/g, (match, key) => {
      const value = data[key.trim()];
      return value !== undefined ? value : match;
    });
  };

  const renderElement = (id: string) => {
    const el = elements[id];
    if (!el || el.hidden) return null;

    const style: React.CSSProperties = {
      position: 'absolute',
      left: el.x,
      top: el.y,
      width: el.w,
      height: el.h,
      ...el.style,
    };

    switch (el.type) {
      case 'text':
      case 'title':
      case 'subtitle':
        return <div key={id} style={style}>{bindData(el.binding || el.content || '')}</div>;
      
      case 'image':
      case 'logo':
        return (
          <div key={id} style={style}>
            {el.content ? (
              <img src={el.content} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300 border border-dashed border-slate-200">
                <ImageIcon size={24} />
              </div>
            )}
          </div>
        );

      case 'divider':
        return <div key={id} style={{ ...style, backgroundColor: config.primaryColor || '#000', height: el.h || 2 }} />;

      case 'qr':
        return (
          <div key={id} style={style} className="flex items-center justify-center bg-white border border-slate-100 p-1">
            <QrCode size={Math.min(el.w, el.h) * 0.9} strokeWidth={1.5} />
          </div>
        );

      case 'dataField':
      case 'docNo':
        return <div key={id} style={style} className="font-bold">{bindData(el.binding || '')}</div>;

      case 'expenseTable':
        const items = data.items || [];
        return (
          <div key={id} style={style} className="overflow-hidden border border-slate-200">
            <table className="w-full border-collapse text-[11px]">
              <thead className="bg-slate-50 border-b-2 border-slate-900">
                <tr>
                  <th className="p-2 text-left border-r">Description</th>
                  <th className="p-2 text-left border-r">Category</th>
                  <th className="p-2 text-right border-r w-16">Qty</th>
                  <th className="p-2 text-right w-24">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? items.map((it: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="p-2 border-r">{it.desc || it.d}</td>
                    <td className="p-2 border-r">{it.category || it.cat}</td>
                    <td className="p-2 border-r text-right">{it.qty || it.q || 1}</td>
                    <td className="p-2 text-right">฿{(it.amount || it.t || 0).toLocaleString()}</td>
                  </tr>
                )) : (
                   <tr><td colSpan={4} className="p-8 text-center text-slate-300 italic">No items found</td></tr>
                )}
              </tbody>
              <tfoot className="font-bold border-t-2 border-slate-900 bg-slate-50">
                <tr>
                  <td colSpan={3} className="p-2 text-right border-r">TOTAL AMOUNT</td>
                  <td className="p-2 text-right text-orange-600">฿{(data.totals?.grandTotal || data.totalAmount || 0).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        );

      case 'signature':
        return (
          <div key={id} style={style} className="flex flex-col items-center justify-end border-b border-slate-300 pb-1 text-[11px]">
             <div className="font-bold text-slate-900 mb-1">{data.approverName || bindData(el.content || '')}</div>
             <div className="text-slate-400 font-medium">( ลงชื่อผู้อนุมัติ )</div>
          </div>
        );

      case 'header':
        return (
           <div key={id} style={style} className="flex items-center justify-between border-b-2 border-slate-950 px-4 py-2 bg-white">
              <div className="flex items-center gap-4">
                 {config.logoUrl && <img src={config.logoUrl} className="w-12 h-12 object-contain" referrerPolicy="no-referrer" />}
                 <div>
                    <div className="font-black text-lg tracking-tight uppercase leading-none">{config.companyName}</div>
                    <div className="text-[9px] font-bold text-slate-400 mt-1">OFFICIAL EXPENDITURE MANAGEMENT SYSTEM</div>
                 </div>
              </div>
              <div className="text-right">
                 <div className="font-black text-2xl tracking-tighter text-orange-600 uppercase leading-none">DOCUMENT RECORD</div>
                 <div className="text-[10px] font-bold text-slate-500 mt-1">NO: {data.id || data.advNo || data.clrNo || '{{doc_number}}'}</div>
              </div>
           </div>
        );

      case 'footer':
        return (
          <div key={id} style={style} className="flex items-center justify-between border-t border-slate-200 pt-2 text-[9px] text-slate-400 font-bold uppercase tracking-widest">
            <div>CONFIDENTIAL • {config.companyName}</div>
            <div>PAGE {Math.floor(el.pageIndex || 0) + 1} OF {pages.length}</div>
          </div>
        );

      case 'watermark':
        return (
          <div key={id} style={{ ...style, opacity: 0.05, pointerEvents: 'none' }} className="flex items-center justify-center rotate-45 select-none">
            <div className="text-6xl font-black">{bindData(el.content || 'DRAFT')}</div>
          </div>
        );

      case 'approvalBlock':
        return (
          <div key={id} style={style} className="grid grid-cols-3 gap-8 bg-slate-50/50 p-6 rounded-xl border border-slate-100">
             {[1,2,3].map(i => (
               <div key={i} className="flex flex-col items-center justify-end border-b border-dashed border-slate-300 pb-2 h-20">
                  <div className="text-[10px] font-bold text-slate-400">....................................................</div>
                  <div className="text-[9px] font-bold text-slate-400 mt-2">APPROVAL {i}</div>
               </div>
             ))}
          </div>
        );

      default:
        return <div key={id} style={style} className="border border-red-100 bg-red-50 text-[9px] p-1 overflow-hidden opacity-50 underline decoration-red-200">[{el.type}]</div>;
    }
  };

  return (
    <div className="studio-document-container space-y-8 print:space-y-0">
      {pages.map((page: any, idx: number) => (
        <div 
          key={page.id} 
          className="bg-white relative mx-auto shadow-2xl print:shadow-none print:m-0 overflow-hidden" 
          style={{ width: 794, height: 1123, minWidth: 794, minHeight: 1123 }}
        >
          {Array.isArray(page.elements) && page.elements.map((eid: string) => renderElement(eid))}
        </div>
      ))}
    </div>
  );
};

export default StudioTemplateRenderer;
