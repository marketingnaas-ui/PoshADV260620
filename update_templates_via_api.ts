
const templates = [
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

async function update() {
    const res = await fetch('http://localhost:3000/api/store/line-messaging-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templates)
    });
    if (res.ok) {
        console.log('Templates updated in store via API');
    } else {
        console.error('Failed to update templates:', await res.text());
    }
}

update();
