import React, { useRef, useEffect, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize, Minimize } from 'lucide-react';

interface FitPageViewerProps {
  children: React.ReactNode;
  pageWidth?: number;
  pageHeight?: number;
}

export const FitPageViewer: React.FC<FitPageViewerProps> = ({ 
  children, 
  pageWidth = 794,
  pageHeight = 1123
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
  const [scale, setScale] = useState(isMobile ? 0.35 : 0.74);
  const [userZoom, setUserZoom] = useState<number | null>(null);
  
  // Fit entire page logic
  useEffect(() => {
    const measure = () => {
      const windowWidth = window.innerWidth;
      const isMobileNow = windowWidth < 1024;
      setIsMobile(isMobileNow);
      
      if (!isMobileNow) {
        // Desktop: typical split view layout does horizontal fit, or standard scale (like 0.74)
        setScale(0.74); 
        return;
      }

      // Mobile: Fit Entire Page
      if (containerRef.current) {
        const availableWidth = containerRef.current.clientWidth - 32;
        // if containerRef hasn't fully painted, fallback to window.innerWidth
        const widthToUse = availableWidth > 0 ? availableWidth : windowWidth - 32;
        const fitScale = widthToUse / pageWidth;
        setScale(fitScale);
      } else {
        const fitScale = (windowWidth - 32) / pageWidth;
        setScale(fitScale);
      }
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [pageWidth]);

  const activeScale = userZoom !== null ? userZoom : scale;
  
  // Provide sticky header over the preview on mobile? 
  // User: "บนมือถือให้ Preview อยู่ด้านบน และ Form อยู่ด้านล่างแบบ Sticky Collapse Panel"
  // Actually, we can use simple details/summary or a toggle button.
  
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!isMobile) {
    return (
      <div className="w-full flex justify-center">
         <div 
           className="transform origin-top transition-transform" 
           style={{ transform: `scale(${activeScale})`, width: pageWidth, height: pageHeight, marginBottom: -(pageHeight * (1 - activeScale)) }}
         >
           {children}
         </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-100 border-b border-slate-200 mb-6 w-full relative" style={{ left: 0, right: 0 }}>
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-white shadow-md">
        <div className="text-xs font-bold flex items-center gap-2">
          <span>📄 Document Preview</span>
          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px]">
            {Math.round(activeScale * 100)}%
          </span>
        </div>
        <div className="flex gap-2.5">
          <button onClick={() => setUserZoom(Math.max(0.2, activeScale - 0.1))} className="text-slate-400 hover:text-white p-1">
             <ZoomOut size={16} />
          </button>
          <button onClick={() => setUserZoom(Math.min(2, activeScale + 0.1))} className="text-slate-400 hover:text-white p-1">
             <ZoomIn size={16} />
          </button>
          <button onClick={() => setUserZoom(null)} className="text-slate-400 hover:text-white p-1" title="Fit Page">
             <Maximize size={14} />
          </button>
          <div className="w-[1px] h-4 bg-slate-700 mx-1 my-auto" />
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="text-[#f4ac5c] hover:text-white p-1 font-bold text-xs flex items-center gap-1">
             {isCollapsed ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>
      
      {!isCollapsed && (
        <div 
          ref={containerRef} 
          className="w-full bg-slate-200/50 flex justify-center overflow-auto shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] cursor-move touch-pan-x touch-pan-y" 
          style={{ 
             height: activeScale > scale ? '60vh' : 'auto', 
             padding: activeScale > scale ? '20px' : '16px 0' 
          }}
        >
          <div 
            className="transform origin-top transition-transform shadow-[0_5px_15px_rgba(0,0,0,0.15)] bg-white" 
            style={{ 
               transform: `scale(${activeScale})`, 
               width: pageWidth, 
               height: pageHeight, 
               marginBottom: -(pageHeight * (1 - activeScale)),
               marginRight: -(pageWidth * (1 - activeScale))
            }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
};
