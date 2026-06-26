
import fs from 'fs';
import path from 'path';

// This script updates the line-messaging-templates in the store
const storePath = path.join(process.cwd(), 'data', 'line-messaging-templates.json');

const newTemplates = [
  { 
    id: 1, 
    name: 'Advance Approved', 
    eventName: 'เมื่อรายการได้รับการอนุมัติ', 
    status: 'Active', 
    text: '🟢 [Approved] รายการ {doc_ref} ของคุณได้รับการอนุมัติแล้ว\nยอดเงิน: ฿{amount}\nเข้าบัญชี: {bank_no}\nขอบคุณค่ะ',
    category: 'Workflow'
  },
  { 
    id: 2, 
    name: 'Clearance Rejected', 
    eventName: 'เมื่อการเคลียร์ถูกปฏิเสธ', 
    status: 'Active', 
    text: '🔴 [Rejected] รายการ {doc_ref} ถูกปฏิเสธ\nเหตุผล: {reason}\nกรุณาตรวจสอบเอกสารและส่งใหม่อีกครั้ง',
    category: 'Audit'
  },
  { 
    id: 3, 
    name: 'Reminder', 
    eventName: 'แจ้งเตือนค้างจ่าย', 
    status: 'Active', 
    text: '⏰ [Reminder] คุณมีรายการ {doc_ref} ที่ค้างเคลียร์มาแล้ว {days} วัน\nกรุณาดำเนินการภายในสัปดาห์นี้ค่ะ',
    category: 'Notification'
  },
  { 
    id: 4, 
    name: 'Weekly Report', 
    eventName: 'รายงานประจำสัปดาห์', 
    status: 'Active', 
    text: '{WEEKLY_REPORT}',
    category: 'Report'
  }
];

if (fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(newTemplates, null, 2));
    console.log('Templates updated successfully!');
} else {
    console.log('Store file not found. Creating it...');
    if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
        fs.mkdirSync(path.join(process.cwd(), 'data'));
    }
    fs.writeFileSync(storePath, JSON.stringify(newTemplates, null, 2));
    console.log('Templates created successfully!');
}
