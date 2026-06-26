import { useState, useEffect } from 'react';

export interface signatory {
  role: string;
  name: string;
  date: string;
}

export interface TemplateConfig {
  canvaMode: boolean;
  color: string;
  accentColor: string;
  logoUrl: string;
  showLogo: boolean;
  showQr: boolean;
  companyName: string;
  companyEngName: string;
  companyTaxId: string;
  companyAddress: string;
  docNoPrefix: string;
  employeeName: string;
  employeeId: string;
  employeeDept: string;
  employeeBank: string;
  employeeAccount: string;
  projectName: string;
  signatures: number;
  signatories: signatory[];
  pagesByTemplate: Record<string, any[]>;
}

export interface TemplatePage {
  id: string;
  templateId: string;
  name: string;
  sections: any[];
}

export interface PublishedTemplate {
  id: string;
  kind: string;
  name: string;
  status: string;
  version: number;
  renderer: string;
  config: TemplateConfig;
  pages: any[];
  studioConfig?: any;
}

export const defaultPage = (tplId: string): TemplatePage => ({
  id: `${tplId}-P1`,
  templateId: tplId,
  name: 'หน้าหลัก',
  sections: [
    { id: 'sec-hdr', type: 'header', title: 'ส่วนหัวบริษัทและโลโก้', enabled: true },
    { id: 'sec-info', type: 'infoBox', title: 'กล่องข้อมูลผู้ขอเบิกและโครงการ', enabled: true },
    { id: 'sec-tbl', type: 'itemsTable', title: 'ตารางรายการค่าใช้จ่าย', enabled: true },
    { id: 'sec-sum', type: 'summary', title: 'สรุปยอดเงินและภาษี', enabled: true },
    { id: 'sec-var', type: 'variance', title: 'ส่วนแสดงผลต่างยืมเงิน (ของ Clearance)', enabled: true },
    { id: 'sec-sigs', type: 'signatures', title: 'ช่องลงลายมือชื่อพยาน/ผู้อนุมัติ', enabled: true },
    { id: 'sec-ftr', type: 'footer', title: 'ส่วนท้ายและช่อง QR Code Audit', enabled: true },
  ],
});

export const initialConfig: TemplateConfig = {
  canvaMode: true,
  color: '#5C220A',
  accentColor: '#E75618',
  logoUrl: 'https://img1.pic.in.th/images/Photoroom_25690616_0140025790561e35abda48.png',
  showLogo: true,
  showQr: true,
  companyName: 'บริษัท พอช แมนเนอร์ จำกัด',
  companyEngName: 'POSH MANOR COMPANY LIMITED',
  companyTaxId: '0105563000999',
  companyAddress: 'เลขที่ 888 อาคารเอ็มไพร์ ทาวเวอร์ ชั้น 35 ถนนสาทรใต้ แขวงยานนาวา เขตสาทร กรุงเทพมหานคร 10120',
  docNoPrefix: 'ADV-2026-',
  employeeName: 'คุณสมศักดิ์ รักดี',
  employeeId: 'EMP-045',
  employeeDept: 'ฝ่ายโครงการและก่อสร้าง',
  employeeBank: 'ธนาคารกสิกรไทย (KBank)',
  employeeAccount: '123-4-56789-0',
  projectName: 'โครงการตกแต่งภายในบ้านพักอาศัยระดับลักชัวรี',
  signatures: 2,
  signatories: [
    { role: 'ผู้ขอเบิก', name: 'คุณสมศักดิ์ รักดี', date: '21 มิ.ย. 2026' },
    { role: 'ผู้อนุมัติ', name: 'ดร.วัชระ วรคุณารักษ์', date: '22 มิ.ย. 2026' },
  ],
  pagesByTemplate: {
    TPL1: [defaultPage('TPL1')],
    TPL2: [defaultPage('TPL2')],
    TPL3: [defaultPage('TPL3')],
  },
};

const getPublishedTemplateDefaults = (kind: 'advance' | 'clearance' | 'summaryReport', config: TemplateConfig): PublishedTemplate => {
  const idMap = { advance: 'TPL1', clearance: 'TPL2', summaryReport: 'TPL3' };
  const nameMap = {
    advance: 'Advance Request',
    clearance: 'Clearance Report',
    summaryReport: 'Advance Utilization Summary Report',
  };
  const tplId = idMap[kind];
  return {
    id: tplId,
    kind,
    name: nameMap[kind],
    status: 'Active',
    version: Date.now(),
    renderer: `${kind}-renderer`,
    config,
    pages: config.pagesByTemplate[tplId] || [defaultPage(tplId)],
  };
};

export const normalizePublishedTemplates = (pubTemplates: Record<string, PublishedTemplate> | undefined, config: TemplateConfig): Record<string, PublishedTemplate> => {
  const norm = { ...(pubTemplates || {}) };
  
  if (norm.expense && !norm.summaryReport) {
    norm.summaryReport = {
      ...norm.expense,
      kind: 'summaryReport',
      name: 'Advance Utilization Summary Report',
    };
  }
  
  if (!norm.advance) {
    norm.advance = getPublishedTemplateDefaults('advance', config);
  }
  if (!norm.clearance) {
    norm.clearance = getPublishedTemplateDefaults('clearance', config);
  }
  if (!norm.summaryReport) {
    norm.summaryReport = getPublishedTemplateDefaults('summaryReport', config);
  }

  if (!norm.TPL1) norm.TPL1 = norm.advance;
  if (!norm.TPL2) norm.TPL2 = norm.clearance;
  if (!norm.TPL3) norm.TPL3 = norm.summaryReport;

  return norm;
};

export const useDocumentTemplates = () => {
  const [data, setData] = useState<{
    tplConfig: TemplateConfig;
    activeDocumentTemplateMap: Record<string, string>;
    publishedTemplates: Record<string, PublishedTemplate>;
  }>(() => {
    // Attempt local storage load
    try {
      const cached = localStorage.getItem('document-templates-config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.tplConfig) {
          const normPub = normalizePublishedTemplates(parsed.publishedTemplates, parsed.tplConfig);
          return {
            tplConfig: parsed.tplConfig,
            activeDocumentTemplateMap: parsed.activeDocumentTemplateMap || {
              advance: 'TPL1',
              clearance: 'TPL2',
              summaryReport: 'TPL3',
            },
            publishedTemplates: normPub,
          };
        }
      }
    } catch (e) {
      console.warn('Failed parsing template cache', e);
    }

    const defaultPub: Record<string, PublishedTemplate> = {
      advance: getPublishedTemplateDefaults('advance', initialConfig),
      clearance: getPublishedTemplateDefaults('clearance', initialConfig),
      summaryReport: getPublishedTemplateDefaults('summaryReport', initialConfig),
      TPL1: getPublishedTemplateDefaults('advance', initialConfig),
      TPL2: getPublishedTemplateDefaults('clearance', initialConfig),
      TPL3: getPublishedTemplateDefaults('summaryReport', initialConfig),
    };

    return {
      tplConfig: initialConfig,
      activeDocumentTemplateMap: {
        advance: 'TPL1',
        clearance: 'TPL2',
        summaryReport: 'TPL3',
      },
      publishedTemplates: defaultPub,
    };
  });

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const payload = customEvent.detail;
      if (payload && payload.tplConfig) {
        const normPub = normalizePublishedTemplates(payload.publishedTemplates, payload.tplConfig);
        setData({
          tplConfig: payload.tplConfig,
          activeDocumentTemplateMap: payload.activeDocumentTemplateMap || {
            advance: 'TPL1',
            clearance: 'TPL2',
            summaryReport: 'TPL3',
          },
          publishedTemplates: normPub,
        });
      }
    };

    window.addEventListener('document-template-published', handleUpdate);

    // Also fetch initially from server
    fetch('/api/store/document-templates-config')
      .then((res) => res.json())
      .then((parsed) => {
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.tplConfig) {
          const normPub = normalizePublishedTemplates(parsed.publishedTemplates, parsed.tplConfig);
          setData({
            tplConfig: parsed.tplConfig,
            activeDocumentTemplateMap: parsed.activeDocumentTemplateMap || {
              advance: 'TPL1',
              clearance: 'TPL2',
              summaryReport: 'TPL3',
            },
            publishedTemplates: normPub,
          });
          localStorage.setItem('document-templates-config', JSON.stringify({
            ...parsed,
            publishedTemplates: normPub,
            activeDocumentTemplateMap: parsed.activeDocumentTemplateMap || {
              advance: 'TPL1',
              clearance: 'TPL2',
              summaryReport: 'TPL3',
            },
          }));
        }
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('document-template-published', handleUpdate);
    };
  }, []);

  const saveConfig = async (newConfig: TemplateConfig) => {
    const updatedData = {
      ...data,
      tplConfig: newConfig,
    };
    
    // Optimistic UI update
    setData(updatedData);

    try {
      await fetch('/api/store/document-templates-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });
      localStorage.setItem('document-templates-config', JSON.stringify(updatedData));
      
      // Notify other tabs or components
      window.dispatchEvent(new CustomEvent('document-template-published', { detail: updatedData }));
    } catch (e) {
      console.error('Failed saving template config', e);
    }
  };

  return { ...data, saveConfig };
};
