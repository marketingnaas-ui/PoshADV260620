import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Save, 
  FileCode, 
  Settings, 
  Play, 
  Layers, 
  Plus, 
  Trash2, 
  Check, 
  AlertCircle,
  Copy,
  Users,
  Briefcase,
  TrendingUp,
  FileText,
  RefreshCw,
  HelpCircle,
  Eye,
  Send
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Advance } from '../types';

// Standard mapping helpers
const LINE_SPACING_MAP: Record<string, string> = {
  'none': '0px',
  'xs': '4px',
  'sm': '8px',
  'md': '12px',
  'lg': '16px',
  'xl': '20px',
  'xxl': '24px'
};

const LINE_FONT_SIZE_MAP: Record<string, string> = {
  'xxs': '11px',
  'xs': '12px',
  'sm': '14px',
  'md': '16px',
  'lg': '19px',
  'xl': '22px',
  'xxl': '26px',
  '3xl': '30px',
  '4xl': '38px',
  '5xl': '74px'
};

interface TemplatePreset {
  id: string;
  name: string;
  trigger: string;
  description: string;
  json: string;
}

interface WorkflowRule {
  id: string;
  name: string;
  trigger: string;
  minAmount: number;
  maxAmount: number;
  projectFilter: string; // 'All' or name
  deptFilter: string; // 'All' or name
  templateId: string;
  enabled: boolean;
}

// Highly attractive presets that match corporate approval workflows
const PRESETS: TemplatePreset[] = [
  {
    id: 'req_pending',
    name: 'ขออนุมัติเบิกเงินทดรองจ่าย (Pending Approval)',
    trigger: 'advance.pending_approval',
    description: 'ส่งหาหัวหน้างาน/ผู้บริหารเพื่อให้พิจารณาอนุมัติรายการเบิกเงินทดรอง',
    json: JSON.stringify({
      "type": "bubble",
      "hero": {
        "type": "image",
        "url": "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80",
        "size": "full",
        "aspectRatio": "20:13",
        "aspectMode": "cover"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "spacing": "md",
        "contents": [
          {
            "type": "text",
            "text": "ขออนุมัติเบิกเงินทดรองจ่าย",
            "weight": "bold",
            "color": "#0F766E",
            "size": "sm"
          },
          {
            "type": "text",
            "text": "{{id}}",
            "size": "xl",
            "weight": "bold",
            "color": "#1E293B"
          },
          {
            "type": "separator"
          },
          {
            "type": "box",
            "layout": "vertical",
            "spacing": "sm",
            "contents": [
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  { "type": "text", "text": "ยอดเงิน:", "color": "#64748B", "size": "sm", "flex": 3 },
                  { "type": "text", "text": "฿ {{amount}}", "weight": "bold", "color": "#10B981", "size": "sm", "flex": 7 }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  { "type": "text", "text": "ผู้ขอเบิก:", "color": "#64748B", "size": "sm", "flex": 3 },
                  { "type": "text", "text": "{{empName}} ({{empDept}})", "weight": "bold", "color": "#0F172A", "size": "sm", "flex": 7 }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  { "type": "text", "text": "โครงการ:", "color": "#64748B", "size": "sm", "flex": 3 },
                  { "type": "text", "text": "{{pName}}", "color": "#334155", "size": "sm", "flex": 7 }
                ]
              }
            ]
          },
          {
            "type": "separator"
          },
          {
            "type": "text",
            "text": "รายละเอียด: {{desc}}",
            "wrap": true,
            "color": "#64748B",
            "size": "xs"
          }
        ]
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "spacing": "sm",
        "contents": [
          {
            "type": "button",
            "style": "primary",
            "color": "#10B981",
            "action": {
              "type": "uri",
              "label": "อนุมัติรายการ",
              "uri": "{{liffUrl}}"
            }
          },
          {
            "type": "button",
            "style": "secondary",
            "color": "#EF4444",
            "action": {
              "type": "uri",
              "label": "ไม่อนุมัติ",
              "uri": "{{liffUrl}}"
            }
          }
        ]
      }
    }, null, 2)
  },
  {
    id: 'req_paid',
    name: 'แจ้งเตือนโอนเงินสำเร็จ (Transfer Completed)',
    trigger: 'advance.paid',
    description: 'ส่งแจ้งพนักงานผู้ขอเบิกทันทีที่ฝ่ายการเงินทำการโอนเงินสำเร็จ',
    json: JSON.stringify({
      "type": "bubble",
      "hero": {
        "type": "image",
        "url": "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=600&q=80",
        "size": "full",
        "aspectRatio": "20:13",
        "aspectMode": "cover"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "spacing": "md",
        "contents": [
          {
            "type": "text",
            "text": "การเงินโอนเงินเรียบร้อยแล้ว 🎉",
            "weight": "bold",
            "color": "#10B981",
            "size": "sm"
          },
          {
            "type": "text",
            "text": "{{id}}",
            "size": "xl",
            "weight": "bold"
          },
          {
            "type": "separator"
          },
          {
            "type": "box",
            "layout": "vertical",
            "spacing": "sm",
            "contents": [
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  { "type": "text", "text": "ธนาคาร:", "color": "#64748B", "size": "sm", "flex": 4 },
                  { "type": "text", "text": "{{payeeBank}} ({{payeeBankNo}})", "weight": "bold", "size": "sm", "flex": 6 }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  { "type": "text", "text": "ชื่อบัญชี:", "color": "#64748B", "size": "sm", "flex": 4 },
                  { "type": "text", "text": "{{payeeAccountName}}", "weight": "bold", "size": "sm", "flex": 6 }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  { "type": "text", "text": "ยอดเงินโอน:", "color": "#64748B", "size": "sm", "flex": 4 },
                  { "type": "text", "text": "฿ {{amount}}", "weight": "bold", "color": "#10B981", "size": "sm", "flex": 6 }
                ]
              }
            ]
          },
          {
            "type": "separator"
          },
          {
            "type": "text",
            "text": "กรุณาดำเนินการยื่นรายงานเคลียร์เงิน (Clearance) และแนบหลักฐานใบเสร็จหลังจากใช้จ่ายเสร็จสิ้น",
            "wrap": true,
            "color": "#475569",
            "size": "xs"
          }
        ]
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "spacing": "sm",
        "contents": [
          {
            "type": "button",
            "style": "primary",
            "color": "#0F766E",
            "action": {
              "type": "uri",
              "label": "ส่งรายงานใบเคลียร์",
              "uri": "{{liffUrl}}"
            }
          }
        ]
      }
    }, null, 2)
  },
  {
    id: 'req_rejected',
    name: 'แจ้งปฏิเสธคำขอ (Request Rejected)',
    trigger: 'advance.rejected',
    description: 'ส่งข้อความเพื่อแจ้งเหตุผลเมื่อคำขอหรือเอกสารเคลียร์ไม่ผ่านการอนุมัติ',
    json: JSON.stringify({
      "type": "bubble",
      "hero": {
        "type": "image",
        "url": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=600&q=80",
        "size": "full",
        "aspectRatio": "20:13",
        "aspectMode": "cover"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "spacing": "md",
        "contents": [
          {
            "type": "text",
            "text": "คำขออนุมัติของคุณถูกปฏิเสธ ⚠️",
            "weight": "bold",
            "color": "#EF4444",
            "size": "sm"
          },
          {
            "type": "text",
            "text": "{{id}}",
            "size": "xl",
            "weight": "bold"
          },
          {
            "type": "separator"
          },
          {
            "type": "box",
            "layout": "vertical",
            "spacing": "sm",
            "contents": [
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  { "type": "text", "text": "เหตุผลที่ปฏิเสธ:", "color": "#EF4444", "size": "sm", "flex": 4 },
                  { "type": "text", "text": "{{rejReason}}", "weight": "bold", "color": "#EF4444", "size": "sm", "flex": 6, "wrap": true }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  { "type": "text", "text": "ผู้พิจารณา:", "color": "#64748B", "size": "sm", "flex": 4 },
                  { "type": "text", "text": "คณะกรรมการผู้อนุมัติ", "weight": "bold", "size": "sm", "flex": 6 }
                ]
              }
            ]
          },
          {
            "type": "separator"
          },
          {
            "type": "text",
            "text": "หากท่านต้องการส่งคำขอทดแทนหรือแก้ไข โปรดกดปุ่มด้านล่างเพื่อดำเนินรายการใหม่",
            "wrap": true,
            "color": "#64748B",
            "size": "xs"
          }
        ]
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "style": "link",
            "color": "#0F766E",
            "action": {
              "type": "uri",
              "label": "ตรวจสอบรายละเอียด",
              "uri": "{{liffUrl}}"
            }
          }
        ]
      }
    }, null, 2)
  },
  {
    id: 'clr_completed',
    name: 'แจ้งปิดใบเคลียร์เงินสมบูรณ์ (Clearance Completed)',
    trigger: 'clearance.approved',
    description: 'ส่งยืนยันให้พนักงานเมื่อใบเสร็จและรายการคืนเงินเคลียร์ปิดยอดเสร็จเรียบร้อย',
    json: JSON.stringify({
      "type": "bubble",
      "hero": {
        "type": "image",
        "url": "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80",
        "size": "full",
        "aspectRatio": "20:13",
        "aspectMode": "cover"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "spacing": "md",
        "contents": [
          {
            "type": "text",
            "text": "ใบเคลียร์เงินทดรองปิดบัญชีสำเร็จ 🎉",
            "weight": "bold",
            "color": "#10B981",
            "size": "sm"
          },
          {
            "type": "text",
            "text": "{{id}}",
            "size": "xl",
            "weight": "bold"
          },
          {
            "type": "separator"
          },
          {
            "type": "box",
            "layout": "vertical",
            "spacing": "sm",
            "contents": [
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  { "type": "text", "text": "ยอดเบิกทั้งหมด:", "color": "#64748B", "size": "sm", "flex": 4 },
                  { "type": "text", "text": "฿ {{amount}}", "weight": "bold", "size": "sm", "flex": 6 }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  { "type": "text", "text": "ยอดจ่ายจริง:", "color": "#64748B", "size": "sm", "flex": 4 },
                  { "type": "text", "text": "฿ {{clrAmount}}", "weight": "bold", "color": "#0F766E", "size": "sm", "flex": 6 }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  { "type": "text", "text": "สถานะการเคลียร์:", "color": "#64748B", "size": "sm", "flex": 4 },
                  { "type": "text", "text": "ปิดบัญชีเรียบร้อยสมบูรณ์", "weight": "bold", "color": "#10B981", "size": "sm", "flex": 6 }
                ]
              }
            ]
          },
          {
            "type": "separator"
          },
          {
            "type": "text",
            "text": "ใบเสร็จและเอกสารแนบทั้งหมดได้รับการตรวจสอบและจัดเก็บลงในระบบ Document Vault เรียบร้อยแล้ว",
            "wrap": true,
            "color": "#64748B",
            "size": "xs"
          }
        ]
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "style": "primary",
            "color": "#0F766E",
            "action": {
              "type": "uri",
              "label": "ดูข้อมูลประวัติสะสม",
              "uri": "{{liffUrl}}"
            }
          }
        ]
      }
    }, null, 2)
  }
];

export const FlexMessageSimulator = () => {
  const { advances, toast, masterProjects } = useApp();
  
  // Local state for template database
  const [templates, setTemplates] = useState<TemplatePreset[]>(() => {
    const saved = localStorage.getItem('flex_simulator_templates');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return PRESETS;
      }
    }
    return PRESETS;
  });

  // Local state for Workflow Rules
  const [rules, setRules] = useState<WorkflowRule[]>(() => {
    const saved = localStorage.getItem('flex_simulator_rules');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    // Default mock workflow rule mapping
    return [
      {
        id: 'rule_1',
        name: 'คำขอเบิกเงินปกติ (ไม่เกิน 10,000 บาท)',
        trigger: 'advance.pending_approval',
        minAmount: 0,
        maxAmount: 10000,
        projectFilter: 'All',
        deptFilter: 'All',
        templateId: 'req_pending',
        enabled: true
      },
      {
        id: 'rule_2',
        name: 'คำขอเบิกโครงการพิเศษ (มากกว่า 10,000 บาท)',
        trigger: 'advance.pending_approval',
        minAmount: 10001,
        maxAmount: 9999999,
        projectFilter: 'All',
        deptFilter: 'All',
        templateId: 'req_pending', // maps to same but demonstrates rules
        enabled: true
      }
    ];
  });

  // Current selected values for editor
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || 'req_pending');
  const [jsonInput, setJsonInput] = useState<string>('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // LINE Config & sending states for live testing
  const [lineConfig, setLineConfig] = useState<{
    channelAccessToken?: string;
    groupId?: string;
    channelId?: string;
  } | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [testRecipient, setTestRecipient] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [useCustomRecipient, setUseCustomRecipient] = useState(false);

  useEffect(() => {
    const fetchLineConfig = async () => {
      try {
        const res = await fetch('/api/store/line-messaging-config');
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            setLineConfig(data);
            if (data.groupId) {
              setTestRecipient(data.groupId);
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch LINE config', e);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchLineConfig();
  }, []);

  const handleSendTestNotification = async () => {
    const activeJson = parsedTemplate();
    if (!activeJson) {
      toast('❌ โครงสร้าง JSON ของเทมเพลตไม่ถูกต้อง ไม่สามารถส่งได้', 'err');
      return;
    }

    const recipient = useCustomRecipient ? testRecipient : (lineConfig?.groupId || '');
    if (!recipient) {
      toast('❌ กรุณาระบุ Target Group ID หรือ Recipient ID ผู้รับ', 'err');
      return;
    }

    setSendingTest(true);
    try {
      const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
      const res = await fetch('/api/line/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipient,
          altText: selectedTemplate ? selectedTemplate.name : 'Flex Message Test',
          flexContent: activeJson
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast('🎉 ส่งแจ้งเตือนทดสอบเข้า LINE จริงสำเร็จแล้ว!', 'ok');
      } else {
        const errorMsg = data.message || 'ส่งแจ้งเตือนทดสอบล้มเหลว';
        toast(`❌ ${errorMsg}`, 'err');
      }
    } catch (e: any) {
      toast(`❌ เกิดข้อผิดพลาดทางเทคนิค: ${e.message}`, 'err');
    } finally {
      setSendingTest(false);
    }
  };

  // Binding Mock Data select
  const [selectedAdvId, setSelectedAdvId] = useState<string>('MOCK-001');

  // Trigger form for adding a new workflow rule
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState<Partial<WorkflowRule>>({
    name: '',
    trigger: 'advance.pending_approval',
    minAmount: 0,
    maxAmount: 100000,
    projectFilter: 'All',
    deptFilter: 'All',
    templateId: 'req_pending',
    enabled: true
  });

  // Load current template JSON when selected changes
  useEffect(() => {
    const current = templates.find(t => t.id === selectedTemplateId);
    if (current) {
      setJsonInput(current.json);
      setJsonError(null);
    }
  }, [selectedTemplateId, templates]);

  // Persist templates to localStorage on change
  const saveTemplatesToStorage = (updated: TemplatePreset[]) => {
    setTemplates(updated);
    localStorage.setItem('flex_simulator_templates', JSON.stringify(updated));
  };

  // Persist rules to localStorage on change
  const saveRulesToStorage = (updated: WorkflowRule[]) => {
    setRules(updated);
    localStorage.setItem('flex_simulator_rules', JSON.stringify(updated));
  };

  // Safe prettify JSON format
  const handlePrettify = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonInput(JSON.stringify(parsed, null, 2));
      setJsonError(null);
      toast('ฟอร์แมต JSON สำเร็จ ✨', 'ok');
    } catch (e: any) {
      setJsonError(e.message || 'JSON Invalid');
      toast('โครงสร้าง JSON ไม่ถูกต้อง', 'err');
    }
  };

  // Handle saving modified template JSON back to state
  const handleSaveTemplate = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      const updated = templates.map(t => {
        if (t.id === selectedTemplateId) {
          return { ...t, json: JSON.stringify(parsed, null, 2) };
        }
        return t;
      });
      saveTemplatesToStorage(updated);
      setJsonError(null);
      toast('💾 บันทึกการอัปเดตเทมเพลตสำเร็จ', 'ok');
    } catch (e: any) {
      setJsonError(e.message || 'JSON Invalid');
      toast('ไม่สามารถบันทึกได้เนื่องจาก JSON ไม่ถูกต้อง', 'err');
    }
  };

  // Add custom workflow rule
  const handleAddRule = () => {
    if (!newRule.name) {
      toast('กรุณากรอกชื่อเงื่อนไข Workflow', 'err');
      return;
    }
    const ruleToAdd: WorkflowRule = {
      id: `rule-${Date.now()}`,
      name: newRule.name,
      trigger: newRule.trigger || 'advance.pending_approval',
      minAmount: Number(newRule.minAmount) || 0,
      maxAmount: Number(newRule.maxAmount) || 9999999,
      projectFilter: newRule.projectFilter || 'All',
      deptFilter: newRule.deptFilter || 'All',
      templateId: newRule.templateId || selectedTemplateId,
      enabled: true
    };

    const nextRules = [...rules, ruleToAdd];
    saveRulesToStorage(nextRules);
    setShowAddRule(false);
    setNewRule({
      name: '',
      trigger: 'advance.pending_approval',
      minAmount: 0,
      maxAmount: 100000,
      projectFilter: 'All',
      deptFilter: 'All',
      templateId: selectedTemplateId,
      enabled: true
    });
    toast('✅ เพิ่มเงื่อนไข Workflow สำเร็จ', 'ok');
  };

  const handleDeleteRule = (id: string) => {
    const nextRules = rules.filter(r => r.id !== id);
    saveRulesToStorage(nextRules);
    toast('ลบเงื่อนไขแล้ว', 'info');
  };

  const handleToggleRule = (id: string) => {
    const nextRules = rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
    saveRulesToStorage(nextRules);
  };

  // Create highly descriptive fallback mock advances
  const mockAdvances: Advance[] = [
    {
      id: 'ADV-260525-021',
      empId: 'EMP-902',
      empName: 'เบนซ์ กัญญาภัทร',
      empDept: 'วิศวกรรมและการพัฒนา',
      pName: 'พลัส เพชรเกษม',
      pIds: [],
      reqDate: '2026-06-25',
      dueDate: '2026-07-10',
      appDate: '2026-06-25',
      appBy: 'หัวหน้าโครงการ',
      status: 'PENDING_APPROVAL',
      amount: 14000.00,
      appAmount: 0,
      clrAmount: 0,
      catId: 'C1',
      catName: 'สายไฟและวัสดุสำนักงาน',
      desc: 'สายไฟหลัก 20 ม., ค่าเดินทางด่วน, กาวกันน้ำ',
      items: [],
      files: [],
      clrs: [],
      pay: null,
      payeeBank: 'กสิกรไทย (KBANK)',
      payeeBankNo: '124-8-99081-3',
      payeeAccountName: 'กัญญาภัทร ดีใจ',
      rejReason: 'กรุณาอัปโหลดเอกสารประมาณราคาให้ครบถ้วน'
    },
    {
      id: 'ADV-260611-008',
      empId: 'EMP-405',
      empName: 'วิทยา ใจดี',
      empDept: 'ความปลอดภัยอาคาร',
      pName: 'เซ็นทริค อารีย์',
      pIds: [],
      reqDate: '2026-06-11',
      dueDate: '2026-06-30',
      appDate: '2026-06-12',
      appBy: 'ผู้บริหารระดับสูง',
      status: 'WAITING_TRANSFER',
      amount: 4500.00,
      appAmount: 4500.00,
      clrAmount: 4320.00,
      catId: 'C2',
      catName: 'หมวดความปลอดภัย',
      desc: 'ถังดับเพลิง CO2 สำรอง, หมวกนิรภัย 2 ใบ',
      items: [],
      files: [],
      clrs: [],
      pay: null,
      payeeBank: 'ไทยพาณิชย์ (SCB)',
      payeeBankNo: '045-2-45129-0',
      payeeAccountName: 'วิทยา ใจดี',
      rejReason: ''
    }
  ];

  // Combine real ones with mock fallback
  const combinedAdvances = [...advances, ...mockAdvances];
  const activeAdvance = combinedAdvances.find(a => a.id === selectedAdvId) || combinedAdvances[0];

  // Dynamically replace variables in template string before parsing
  const getMergedJsonString = () => {
    if (!activeAdvance) return jsonInput;
    
    const placeholderMap: Record<string, string> = {
      id: activeAdvance.id,
      empName: activeAdvance.empName,
      empDept: activeAdvance.empDept,
      pName: activeAdvance.pName || 'ทั่วไป',
      amount: activeAdvance.amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      clrAmount: (activeAdvance.clrAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      desc: activeAdvance.desc || 'ไม่มีคำอธิบาย',
      payeeBank: activeAdvance.payeeBank || 'กสิกรไทย (KBANK)',
      payeeBankNo: activeAdvance.payeeBankNo || '112-2-XXXXX-X',
      payeeAccountName: activeAdvance.payeeAccountName || activeAdvance.empName,
      rejReason: activeAdvance.rejReason || 'ไม่ระบุเหตุผล',
      liffUrl: `${window.location.origin}/liff/approval?id=${activeAdvance.id}`
    };

    let result = jsonInput;
    Object.keys(placeholderMap).forEach(key => {
      result = result.replaceAll(`{{${key}}}`, placeholderMap[key]);
    });
    return result;
  };

  const parsedTemplate = () => {
    try {
      const mergedStr = getMergedJsonString();
      return JSON.parse(mergedStr);
    } catch (e) {
      return null;
    }
  };

  // Recursive element renderer for High-fidelity LINE components
  const renderFlexComponent = (node: any, key: any): React.ReactNode => {
    if (!node || typeof node !== 'object') return null;

    const marginStyle: React.CSSProperties = node.margin ? {
      marginTop: LINE_SPACING_MAP[node.margin] || node.margin
    } : {};

    switch (node.type) {
      case 'box': {
        const layout = node.layout || 'vertical';
        const spacing = node.spacing ? (LINE_SPACING_MAP[node.spacing] || node.spacing) : '0px';
        
        // Flexbox alignments
        let alignItems = 'stretch';
        if (node.alignItems) {
          alignItems = node.alignItems;
        } else if (layout === 'baseline') {
          alignItems = 'baseline';
        } else if (node.align) {
          alignItems = node.align === 'center' ? 'center' : node.align === 'end' ? 'flex-end' : 'flex-start';
        }

        const justify = node.justifyContent || 'flex-start';

        // Parsing paddings
        const paddingStyle: React.CSSProperties = {};
        if (node.paddingAll) {
          const pad = LINE_SPACING_MAP[node.paddingAll] || node.paddingAll;
          paddingStyle.padding = pad;
        }
        if (node.paddingTop) paddingStyle.paddingTop = LINE_SPACING_MAP[node.paddingTop] || node.paddingTop;
        if (node.paddingBottom) paddingStyle.paddingBottom = LINE_SPACING_MAP[node.paddingBottom] || node.paddingBottom;
        if (node.paddingStart) paddingStyle.paddingLeft = LINE_SPACING_MAP[node.paddingStart] || node.paddingStart;
        if (node.paddingEnd) paddingStyle.paddingRight = LINE_SPACING_MAP[node.paddingEnd] || node.paddingEnd;

        const borderStyle: React.CSSProperties = {
          borderColor: node.borderColor || undefined,
          borderWidth: node.borderWidth ? (node.borderWidth === 'semi-bold' ? '2px' : node.borderWidth) : undefined,
          borderStyle: node.borderColor ? 'solid' : undefined,
          borderRadius: node.cornerRadius ? (LINE_SPACING_MAP[node.cornerRadius] || node.cornerRadius) : undefined,
        };

        const widthHeightStyle: React.CSSProperties = {
          width: node.width || undefined,
          height: node.height || undefined,
          flex: node.flex !== undefined ? node.flex : undefined,
        };

        const inlineStyles: React.CSSProperties = {
          display: 'flex',
          flexDirection: layout === 'vertical' ? 'column' : 'row',
          gap: spacing,
          alignItems: alignItems as any,
          justifyContent: justify as any,
          backgroundColor: node.backgroundColor || undefined,
          ...marginStyle,
          ...paddingStyle,
          ...borderStyle,
          ...widthHeightStyle,
        };

        return (
          <div 
            key={key} 
            style={inlineStyles}
            className={`relative min-w-0 ${node.action ? 'cursor-pointer hover:opacity-95' : ''}`}
            onClick={() => {
              if (node.action) {
                toast(`💡 Clicked Action: ${node.action.label || node.action.type}`, 'info');
              }
            }}
          >
            {Array.isArray(node.contents) && node.contents.map((child, idx) => renderFlexComponent(child, `${key}-${idx}`))}
          </div>
        );
      }

      case 'text': {
        const color = node.color || '#333333';
        const size = LINE_FONT_SIZE_MAP[node.size] || node.size || '14px';
        const weight = node.weight === 'bold' ? 'bold' : 'normal';
        const align = node.align === 'center' ? 'center' : node.align === 'end' ? 'right' : 'left';
        const wrap = node.wrap !== false; // defaults to wrapping
        
        const textStyle: React.CSSProperties = {
          color,
          fontSize: size,
          fontWeight: weight as any,
          textAlign: align as any,
          textDecoration: node.decoration || undefined,
          fontStyle: node.style || undefined,
          flex: node.flex !== undefined ? node.flex : undefined,
          ...marginStyle,
        };

        const classes = wrap 
          ? "whitespace-pre-wrap break-all" 
          : "truncate overflow-hidden whitespace-nowrap";

        // Handle maxLines
        if (node.maxLines) {
          textStyle.display = '-webkit-box';
          textStyle.WebkitLineClamp = node.maxLines;
          textStyle.WebkitBoxOrient = 'vertical';
          textStyle.overflow = 'hidden';
        }

        if (Array.isArray(node.contents)) {
          return (
            <div key={key} style={textStyle} className={classes}>
              {node.contents.map((span: any, idx: number) => (
                <span 
                  key={idx} 
                  style={{
                    color: span.color || undefined,
                    fontSize: span.size ? (LINE_FONT_SIZE_MAP[span.size] || span.size) : undefined,
                    fontWeight: span.weight === 'bold' ? 'bold' : 'normal',
                    textDecoration: span.decoration || undefined,
                    fontStyle: span.style || undefined,
                  }}
                >
                  {span.text}
                </span>
              ))}
            </div>
          );
        }

        return (
          <div key={key} style={textStyle} className={classes}>
            {node.text}
          </div>
        );
      }

      case 'image': {
        const align = node.align || 'center';
        
        // Calculate image size limits
        let sizeClass = 'w-full';
        if (node.size === 'xxs') sizeClass = 'w-10';
        else if (node.size === 'xs') sizeClass = 'w-14';
        else if (node.size === 'sm') sizeClass = 'w-20';
        else if (node.size === 'md') sizeClass = 'w-28';
        else if (node.size === 'lg') sizeClass = 'w-36';
        else if (node.size === 'xl') sizeClass = 'w-48';
        else if (node.size === 'xxl') sizeClass = 'w-60';
        else if (node.size === '3xl') sizeClass = 'w-72';
        else if (node.size === 'full') sizeClass = 'w-full';

        const alignClass = align === 'start' ? 'mr-auto' : align === 'end' ? 'ml-auto' : 'mx-auto';
        
        let ratioVal = '20 / 13';
        if (node.aspectRatio) {
          ratioVal = node.aspectRatio.replace(':', ' / ');
        }

        const imgStyle: React.CSSProperties = {
          aspectRatio: ratioVal,
          objectFit: node.aspectMode === 'fit' ? 'contain' : 'cover',
          backgroundColor: node.backgroundColor || undefined,
          borderRadius: '4px',
          ...marginStyle,
        };

        return (
          <div key={key} className={`flex ${sizeClass} ${alignClass} shrink-0`}>
            <img 
              referrerPolicy="no-referrer"
              src={node.url} 
              alt="Line Flex Image" 
              style={imgStyle}
              className="w-full h-auto rounded"
            />
          </div>
        );
      }

      case 'button': {
        const style = node.style || 'link';
        const color = node.color || '#06C755';
        const isPrimary = style === 'primary';
        const isSecondary = style === 'secondary';

        const btnStyle: React.CSSProperties = {
          backgroundColor: isPrimary ? color : isSecondary ? '#f1f5f9' : 'transparent',
          color: isPrimary ? '#ffffff' : isSecondary ? '#334155' : color,
          border: isSecondary ? '1px solid #cbd5e1' : undefined,
          ...marginStyle,
        };

        return (
          <a
            key={key}
            href={node.action?.uri || '#'}
            target="_blank"
            rel="noopener noreferrer"
            style={btnStyle}
            className="w-full text-center py-2 px-3 rounded-lg text-xs font-semibold block transition-colors duration-200 hover:opacity-90 shadow-sm border border-transparent select-none cursor-pointer"
            onClick={(e) => {
              if (!node.action?.uri) {
                e.preventDefault();
                toast(`🔘 Clicked Button Action: ${node.action?.label || 'Action'}`, 'info');
              }
            }}
          >
            {node.action?.label || 'Button'}
          </a>
        );
      }

      case 'separator': {
        const color = node.color || '#e2e8f0';
        const marginVal = node.margin ? (LINE_SPACING_MAP[node.margin] || node.margin) : '12px';
        
        return (
          <hr 
            key={key} 
            style={{ 
              borderColor: color, 
              marginTop: marginVal, 
              marginBottom: marginVal,
              borderWidth: '0.5px'
            }} 
            className="w-full"
          />
        );
      }

      case 'filler': {
        return <div key={key} className="flex-1 min-h-[4px]" />;
      }

      case 'icon': {
        const size = node.size ? (LINE_SPACING_MAP[node.size] || node.size) : '16px';
        return (
          <img 
            key={key}
            src={node.url} 
            alt="icon" 
            style={{ width: size, height: size, ...marginStyle }} 
            className="inline-block align-middle shrink-0" 
          />
        );
      }

      default:
        return null;
    }
  };

  // Render a complete single bubble
  const renderBubble = (bubbleNode: any) => {
    if (!bubbleNode || bubbleNode.type !== 'bubble') {
      return (
        <div className="p-4 text-xs text-red-500 bg-red-50 border rounded-xl flex items-center gap-2">
          <AlertCircle size={14} />
          <span>ประเภทของ Component สูงสุดต้องเป็น "bubble" หรือ "carousel" เท่านั้น</span>
        </div>
      );
    }

    const { header, hero, body, footer, styles } = bubbleNode;
    
    // Bubble header color
    const headerBg = styles?.header?.backgroundColor || '#ffffff';
    const bodyBg = styles?.body?.backgroundColor || '#ffffff';
    const footerBg = styles?.footer?.backgroundColor || '#ffffff';
    const heroBg = styles?.hero?.backgroundColor || '#ffffff';

    return (
      <div 
        className="w-[300px] bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col text-slate-800 transition-all duration-300"
        style={{
          boxShadow: '0 4px 15px -3px rgba(0,0,0,0.06), 0 4px 6px -2px rgba(0,0,0,0.05)'
        }}
      >
        {/* Header Section */}
        {header && (
          <div style={{ backgroundColor: headerBg }} className="border-b border-slate-50">
            {renderFlexComponent(header, 'hdr')}
          </div>
        )}

        {/* Hero Section */}
        {hero && (
          <div style={{ backgroundColor: heroBg }}>
            {renderFlexComponent(hero, 'hero')}
          </div>
        )}

        {/* Body Section */}
        {body && (
          <div style={{ backgroundColor: bodyBg }} className="p-4">
            {renderFlexComponent(body, 'body')}
          </div>
        )}

        {/* Footer Section */}
        {footer && (
          <div style={{ backgroundColor: footerBg }} className="p-3 border-t border-slate-100">
            {renderFlexComponent(footer, 'footer')}
          </div>
        )}
      </div>
    );
  };

  const parsed = parsedTemplate();

  return (
    <div className="p-1 md:p-6 font-noto text-slate-800 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span className="p-2 bg-[#06C755] text-white rounded-xl shadow-md shrink-0">
              <MessageSquare size={22} />
            </span>
            LINE Flex Message Simulator
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            ออกแบบจำลองหน้าแชท LINE เสมือนจริง พร้อมผูกเงื่อนไข Workflow อนุมัติรายการเบิกเงินทดรองจ่าย
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              saveTemplatesToStorage(PRESETS);
              setSelectedTemplateId(PRESETS[0].id);
              toast('🔄 รีเซ็ตเทมเพลตมาตรฐานสำเร็จ', 'ok');
            }}
            className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 transition"
          >
            รีเซ็ตค่ามาตรฐาน
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8 cols): Editor, Workflows, Selectors */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Section 1: Template Selection & Live Binder */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Layers className="text-[#06C755]" size={18} />
                1. เลือกเทมเพลต และผูกข้อมูลจำลอง (Mock Data Binding)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Template Picker */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                  เทมเพลตแจ้งเตือนผ่าน LINE
                </label>
                <select 
                  value={selectedTemplateId} 
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full bg-slate-50 font-semibold"
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  {templates.find(t => t.id === selectedTemplateId)?.description}
                </p>
              </div>

              {/* Advance Request Live Binder */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                  ผูกตัวแปรกับใบขอเบิก (Bind Variables)
                </label>
                <select 
                  value={selectedAdvId} 
                  onChange={(e) => setSelectedAdvId(e.target.value)}
                  className="w-full bg-teal-50 border-teal-200 font-semibold text-teal-800"
                >
                  {combinedAdvances.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.id} - {a.empName} (฿ {a.amount.toLocaleString()})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-teal-600 mt-1 font-medium flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                  เชื่อมตัวแปรอัตโนมัติ: id, amount, empName, pName, desc, payeeBank
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: JSON Editor */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileCode className="text-blue-500" size={18} />
                2. บรรณาธิการโค้ด LINE Flex JSON Schema
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={handlePrePrettify => handlePrettify()}
                  className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
                >
                  จัดระเบียบโค้ด (Format)
                </button>
                <button 
                  onClick={handleSaveTemplate}
                  className="px-3 py-1 text-[11px] bg-[#06C755] hover:bg-[#05a647] text-white font-bold rounded-lg shadow-sm transition flex items-center gap-1"
                >
                  <Save size={12} />
                  บันทึกเทมเพลต
                </button>
              </div>
            </div>

            <div className="relative">
              <textarea 
                className="w-full h-80 p-4 border border-slate-200 rounded-xl font-mono text-xs leading-relaxed bg-slate-900 text-slate-100 outline-none focus:border-blue-500 transition-all shadow-inner"
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value);
                  try {
                    JSON.parse(e.target.value);
                    setJsonError(null);
                  } catch (err: any) {
                    setJsonError(err.message || 'JSON structure is incomplete');
                  }
                }}
              />
              
              {jsonError ? (
                <div className="absolute bottom-3 left-3 right-3 bg-red-950/90 border border-red-800/80 p-2 rounded-lg text-[10px] text-red-300 font-mono flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0 text-red-400" />
                  <span className="truncate">{jsonError}</span>
                </div>
              ) : (
                <div className="absolute bottom-3 right-3 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-lg text-[9px] text-emerald-400 font-mono">
                  JSON Syntax Valid
                </div>
              )}
            </div>
            
            {/* Variables cheatsheet */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <h4 className="text-[11px] font-bold text-slate-600 uppercase mb-2">โค้ดตัวแปรที่ใช้งานได้ (Placeholders):</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono text-slate-500">
                <div className="bg-white p-1.5 border border-slate-200/60 rounded"><span className="text-blue-600 font-bold">{"{{id}}"}</span> รหัสใบเบิก</div>
                <div className="bg-white p-1.5 border border-slate-200/60 rounded"><span className="text-blue-600 font-bold">{"{{amount}}"}</span> ยอดเงินบาท</div>
                <div className="bg-white p-1.5 border border-slate-200/60 rounded"><span className="text-blue-600 font-bold">{"{{empName}}"}</span> ชื่อพนักงาน</div>
                <div className="bg-white p-1.5 border border-slate-200/60 rounded"><span className="text-blue-600 font-bold">{"{{pName}}"}</span> ชื่อโครงการ</div>
                <div className="bg-white p-1.5 border border-slate-200/60 rounded"><span className="text-blue-600 font-bold">{"{{desc}}"}</span> คำอธิบาย</div>
                <div className="bg-white p-1.5 border border-slate-200/60 rounded"><span className="text-blue-600 font-bold">{"{{payeeBank}}"}</span> ธนาคาร</div>
                <div className="bg-white p-1.5 border border-slate-200/60 rounded"><span className="text-blue-600 font-bold">{"{{payeeBankNo}}"}</span> เลขที่บัญชี</div>
                <div className="bg-white p-1.5 border border-slate-200/60 rounded"><span className="text-blue-600 font-bold">{"{{liffUrl}}"}</span> ลิงก์อนุมัติจริง</div>
              </div>
            </div>
          </div>

          {/* Section 3: Workflow Trigger Conditions */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Settings className="text-indigo-500" size={18} />
                  3. กำหนดเงื่อนไขการส่งตามขั้นตอน Workflow อนุมัติ
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">ระบุการจับคู่ระหว่างเงื่อนไขใบเบิกกับเทมเพลต LINE เพื่อแยกการส่งตามเงื่อนไขสายงาน</p>
              </div>
              <button 
                onClick={() => setShowAddRule(!showAddRule)}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl flex items-center gap-1 transition"
              >
                <Plus size={14} /> เพิ่มเงื่อนไขใหม่
              </button>
            </div>

            {/* Expandable Add Rule Form */}
            {showAddRule && (
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-4 animate-in slide-in-from-top-3 duration-200">
                <h4 className="text-xs font-bold text-indigo-800 uppercase">สร้างกติกา/เงื่อนไข Workflow</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">ชื่อเงื่อนไข / คำบรรยายกติกา</label>
                    <input 
                      type="text" 
                      placeholder="เช่น ใบเบิกด่วนโครงการพูลวิลล่ายอดเกินแสน"
                      value={newRule.name}
                      onChange={e => setNewRule({...newRule, name: e.target.value})}
                      className="bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">สถานะตัวทริกเกอร์ (Trigger Step)</label>
                    <select 
                      value={newRule.trigger}
                      onChange={e => setNewRule({...newRule, trigger: e.target.value})}
                      className="bg-white"
                    >
                      <option value="advance.pending_approval">เมื่อคำขอเริ่มรออนุมัติ (Pending Approval)</option>
                      <option value="advance.paid">เมื่อโอนเงินเข้าบัญชีพนักงานแล้ว (Paid)</option>
                      <option value="advance.rejected">เมื่อใบเบิกโดนปฏิเสธ (Rejected)</option>
                      <option value="clearance.approved">เมื่อปิดงานเคลียร์เงินสมบูรณ์ (Clearance Closed)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">ยอดเงินขั้นต่ำ (฿)</label>
                    <input 
                      type="number" 
                      value={newRule.minAmount}
                      onChange={e => setNewRule({...newRule, minAmount: Number(e.target.value)})}
                      className="bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">ยอดเงินสูงสุด (฿)</label>
                    <input 
                      type="number" 
                      value={newRule.maxAmount}
                      onChange={e => setNewRule({...newRule, maxAmount: Number(e.target.value)})}
                      className="bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">จับคู่กับ LINE Flex Template</label>
                    <select 
                      value={newRule.templateId}
                      onChange={e => setNewRule({...newRule, templateId: e.target.value})}
                      className="bg-white font-semibold"
                    >
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end justify-end gap-2 pt-2">
                    <button 
                      onClick={() => setShowAddRule(false)}
                      className="px-3 py-2 border border-slate-300 text-slate-600 rounded-lg font-semibold text-xs bg-white"
                    >
                      ยกเลิก
                    </button>
                    <button 
                      onClick={handleAddRule}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs"
                    >
                      ตกลงเพิ่มกติกา
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Rules Listing */}
            <div className="space-y-3">
              {rules.map((rule) => {
                const mappedTemplate = templates.find(t => t.id === rule.templateId);
                return (
                  <div 
                    key={rule.id}
                    className={`p-4 border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                      rule.enabled 
                        ? 'bg-slate-50/60 border-slate-200' 
                        : 'bg-slate-100/40 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          rule.trigger.includes('pending') ? 'bg-amber-100 text-amber-800' :
                          rule.trigger.includes('paid') ? 'bg-emerald-100 text-emerald-800' :
                          rule.trigger.includes('rejected') ? 'bg-red-100 text-red-800' : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {rule.trigger}
                        </span>
                        <h4 className="font-bold text-xs text-slate-800">{rule.name}</h4>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <TrendingUp size={12} className="text-slate-400" />
                          ยอดเงิน: ฿{rule.minAmount.toLocaleString()} ถึง ฿{rule.maxAmount.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText size={12} className="text-slate-400" />
                          ใช้เทมเพลต: <span className="text-indigo-600 font-bold">{mappedTemplate?.name || 'ไม่ได้เลือก'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {rule.enabled ? 'เปิดใช้งาน' : 'ปิด'}
                        </span>
                        <div 
                          onClick={() => handleToggleRule(rule.id)}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full cursor-pointer transition-colors ${
                            rule.enabled ? 'bg-emerald-500' : 'bg-slate-200'
                          }`}
                        >
                          <div className={`h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                        </div>
                      </div>

                      <button 
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="ลบกติกานี้"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): iOS LINE Chat Simulator Wrapper */}
        <div className="lg:col-span-4 flex flex-col items-center">
          
          <div className="sticky top-6 w-full max-w-[340px]">
            <div className="text-center mb-3">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-bold border border-emerald-100">
                <Eye size={12} />
                LINE Real-Time View
              </span>
            </div>

            {/* LINE Mobile Mock Container */}
            <div 
              className="w-full bg-[#8CABD9] rounded-[36px] overflow-hidden border-[8px] border-slate-900 shadow-2xl relative flex flex-col"
              style={{
                height: '560px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
              }}
            >
              {/* Phone Speaker & Camera Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-900 rounded-b-2xl z-40 flex items-center justify-center gap-1.5">
                <div className="w-10 h-1 bg-slate-800 rounded-full"></div>
                <div className="w-1.5 h-1.5 bg-slate-800 rounded-full"></div>
              </div>

              {/* Chat Window Top Bar */}
              <div className="bg-[#2D333F] text-white pt-5 pb-3 px-4 flex items-center justify-between shadow-md shrink-0 select-none">
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-400 text-xs">❮</span>
                  <div className="flex flex-col">
                    <span className="font-bold text-xs font-sans tracking-wide">AdvancePosh Notify</span>
                    <span className="text-[9px] text-[#06C755] font-bold flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#06C755]"></span> Official Account
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-300 text-xs mt-1">
                  <span>🔍</span>
                  <span>☰</span>
                </div>
              </div>

              {/* Chat Dialogue Canvas */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans flex flex-col justify-end">
                
                {/* Date Divider */}
                <div className="text-center select-none">
                  <span className="bg-black/15 text-white/90 text-[10px] px-2.5 py-0.5 rounded-full font-medium">
                    วันนี้
                  </span>
                </div>

                {/* Message Group (Avatar + Bot Title + Speech Stem + Flex Bubble) */}
                <div className="flex items-start gap-2.5">
                  
                  {/* Bot Logo Icon */}
                  <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-[9px] font-bold border border-white/20 shadow-sm shrink-0 select-none">
                    ADV
                  </div>

                  <div className="space-y-1 max-w-[280px]">
                    {/* Bot Name Badge */}
                    <span className="text-[10px] text-white/80 font-bold block select-none">
                      AdvancePosh
                    </span>

                    {/* Speech Stem Connector & Flex Container */}
                    <div className="relative flex items-end gap-1.5">
                      {/* Left Tail Arrow */}
                      <div className="absolute top-3 -left-1.5 w-0 h-0 border-t-[6px] border-t-[#ffffff] border-l-[6px] border-l-transparent z-10"></div>
                      
                      {/* Dynamic Render Shell */}
                      <div className="transition-all duration-300 transform origin-left">
                        {parsed ? (
                          parsed.type === 'carousel' && Array.isArray(parsed.contents) ? (
                            <div className="flex gap-3 overflow-x-auto pb-2 snap-x max-w-[245px] scrollbar-thin">
                              {parsed.contents.map((bubbleNode: any, idx: number) => (
                                <div key={idx} className="snap-center shrink-0 w-[230px] scale-95 origin-top-left">
                                  {renderBubble(bubbleNode)}
                                </div>
                              ))}
                            </div>
                          ) : (
                            renderBubble(parsed)
                          )
                        ) : (
                          <div className="p-4 bg-white rounded-2xl w-[240px] text-xs text-red-500 shadow border flex flex-col gap-2">
                            <AlertCircle size={18} className="text-red-500" />
                            <span className="font-bold text-slate-800">เกิดข้อผิดพลาดในการถอดรหัส</span>
                            <span className="font-mono text-[10px] text-slate-500 break-words">{jsonError || 'โปรดตรวจสอบความถูกต้องของ JSON syntax อีกครั้ง'}</span>
                          </div>
                        )}
                      </div>

                      {/* Line Message Meta Time */}
                      <div className="text-[9px] text-white/70 select-none self-end pb-0.5 font-medium shrink-0 whitespace-nowrap">
                        อ่านแล้ว<br />
                        22:41 น.
                      </div>
                    </div>

                  </div>
                </div>

              </div>

              {/* Chat Input Dock */}
              <div className="bg-slate-100 p-2 border-t border-slate-200/80 flex items-center gap-2 select-none shrink-0">
                <span className="text-slate-400 text-sm">➕</span>
                <span className="text-slate-400 text-sm">📷</span>
                <div className="flex-1 bg-white border border-slate-200 px-3 py-1.5 rounded-full text-xs text-slate-400 font-sans">
                  พิมพ์ข้อความ...
                </div>
                <span className="text-[#06C755] text-sm">☺</span>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-400 text-center mt-3 font-medium">
              * ข้อมูลที่แสดงดึงจากรายละเอียดใบขอเบิกเงินแบบเรียลไทม์
            </p>

            {/* Real LINE Testing Panel */}
            <div id="line-test-dispatch-center" className="mt-5 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3.5 text-left">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Send className="text-[#06C755] size-3.5" />
                  ศูนย์ส่งทดสอบ LINE จริง
                </h4>
                {loadingConfig ? (
                  <span className="text-[10px] text-slate-400">กำลังโหลด...</span>
                ) : lineConfig?.channelAccessToken ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[9px] font-bold border border-emerald-100">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                    พร้อมใช้งาน
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[9px] font-bold border border-amber-100">
                    ยังไม่เปิดใช้งาน
                  </span>
                )}
              </div>

              {lineConfig?.channelAccessToken ? (
                <div className="space-y-3 text-xs">
                  {/* Recipient Selection Toggle */}
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    <span>ผู้รับข้อความ:</span>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => setUseCustomRecipient(false)}
                        className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${!useCustomRecipient ? 'bg-emerald-500 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'}`}
                      >
                        Default ({lineConfig.groupId ? `${lineConfig.groupId.substring(0, 8)}...` : 'ไม่มี'})
                      </button>
                      <button 
                        type="button"
                        onClick={() => setUseCustomRecipient(true)}
                        className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${useCustomRecipient ? 'bg-emerald-500 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'}`}
                      >
                        ระบุเอง
                      </button>
                    </div>
                  </div>

                  {useCustomRecipient && (
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Target ID (Group ID / User ID)</label>
                      <input 
                        type="text" 
                        value={testRecipient} 
                        onChange={e => setTestRecipient(e.target.value)}
                        placeholder="เช่น C123456789... หรือ U123456..."
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-[#06C755]"
                      />
                    </div>
                  )}

                  <button
                    onClick={handleSendTestNotification}
                    disabled={sendingTest || !parsed}
                    className="w-full py-2 bg-[#06C755] hover:bg-[#05a647] disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {sendingTest ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        กำลังส่งแจ้งเตือน...
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        ส่งแจ้งเตือนทดสอบ (LINE Push)
                      </>
                    )}
                  </button>

                  <p className="text-[10px] text-slate-400 leading-normal">
                    * ข้อความจะถูกส่งเป็น Flex Message ไปยัง LINE ปลายทางที่กำหนดไว้จริงโดยดึงค่าจากตัวแปร Mock Data ดำเนินการตรวจสอบบนโทรศัพท์ของคุณได้ทันที!
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl space-y-2 text-xs text-amber-800 leading-relaxed">
                  <p className="font-semibold flex items-center gap-1 text-amber-900">
                    <AlertCircle size={14} className="text-amber-600 shrink-0" />
                    LINE API ยังไม่ได้เชื่อมต่อ
                  </p>
                  <p className="text-[10px] text-slate-500">
                    การส่งข้อความแจ้งเตือนทดสอบไปยัง LINE จริง จำเป็นต้องกรอก Credentials ในหน้าตั้งค่า LINE Messaging API ก่อน
                  </p>
                  
                  {/* Local Browser Notification Simulation fallback */}
                  <div className="border-t border-amber-200/40 pt-2 flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500">ทดสอบจำลองผ่านเว็บเบราว์เซอร์:</span>
                    <button
                      onClick={() => {
                        if (parsed) {
                          // Try to play sound
                          try {
                            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav');
                            audio.volume = 0.5;
                            audio.play().catch(() => {});
                          } catch(e){}
                          toast('🔔 [จำลองสถานการณ์] LINE Notify: รายการเบิกเงินรอคุณพิจารณาอนุมัติเรียบร้อยแล้ว!', 'ok');
                        }
                      }}
                      className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[10.5px] transition flex items-center justify-center gap-1"
                    >
                      <Play size={11} /> จำลองส่งเสียงแจ้งเตือนเบราว์เซอร์
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
