/**
 * Utility to interact with Google Sheets API
 */

export interface SheetData {
  title: string;
  headers: string[];
  rows: any[][];
  summary?: { label: string; value: string | number }[];
}

export const createSpreadsheet = async (accessToken: string, title: string) => {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to create spreadsheet');
  }

  return response.json();
};

export const updateSheetData = async (
  accessToken: string,
  spreadsheetId: string,
  data: SheetData
) => {
  // Combine all items into one data array
  const valueData = [
    [data.title], // Title row
    [],           // Spacer
    data.headers, // Headers
    ...data.rows, // Data rows
    [],           // Spacer
  ];

  if (data.summary) {
    data.summary.forEach(s => {
      valueData.push(['', '', '', '', '', s.label, s.value]);
    });
  }

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:Z100?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: valueData,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to update sheet data');
  }

  return response.json();
};

export const formatSheet = async (accessToken: string, spreadsheetId: string) => {
  // Basic formatting: Bold title and headers
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: { startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
              cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 14 } } },
              fields: 'userEnteredFormat(textFormat)',
            },
          },
          {
            repeatCell: {
              range: { startRowIndex: 2, endRowIndex: 3 },
              cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } },
              fields: 'userEnteredFormat(textFormat, backgroundColor)',
            },
          },
        ],
      }),
    }
  );

  return response.json();
};

export const exportAdvanceToSheets = async (accessToken: string, advance: any) => {
  const title = `Clearance Record - ${advance.id} - ${advance.empName}`;
  
  const headers = [
    'ลำดับ', 
    'วันที่', 
    'โครงการ', 
    'หมวดค่าใช้จ่าย', 
    'รายการสินค้า/บริการ', 
    'VAT', 
    'WHT', 
    'ส่วนลด', 
    'รวมสุทธิ'
  ];

  const rows = (advance.clrs || []).map((c: any, i: number) => [
    i + 1,
    c.date || '-',
    c.project || advance.project || '-',
    c.category || '-',
    c.note || c.description || '-',
    c.vat || 0,
    c.wht || 0,
    c.discount || 0,
    c.amount || 0
  ]);

  const clrAmount = advance.clrAmount || (advance.clrs ? advance.clrs.reduce((acc: number, c: any) => acc + (c.amount || 0), 0) : 0);
  const vatTotal = advance.vatTotal || (advance.clrs ? advance.clrs.reduce((acc: number, c: any) => acc + (c.vat || 0), 0) : 0);
  const whtTotal = advance.whtTotal || (advance.clrs ? advance.clrs.reduce((acc: number, c: any) => acc + (c.wht || 0), 0) : 0);
  const discountTotal = advance.discountTotal || (advance.clrs ? advance.clrs.reduce((acc: number, c: any) => acc + (c.discount || 0), 0) : 0);
  
  const balance = (advance.appAmount || 0) - (clrAmount || 0);

  const summary = [
    { label: 'ยอดตามใบเบิก', value: advance.appAmount || 0 },
    { label: 'รวม VAT', value: vatTotal },
    { label: 'รวม WHT', value: whtTotal },
    { label: 'รวมส่วนลด', value: discountTotal },
    { label: 'ยอดรวมสุทธิ', value: clrAmount },
    { label: balance >= 0 ? 'เงินทอน (Return)' : 'เบิกเพิ่ม (Reimburse)', value: Math.abs(balance) }
  ];

  const ss = await createSpreadsheet(accessToken, title);
  await updateSheetData(accessToken, ss.spreadsheetId, { title, headers, rows, summary });
  await formatSheet(accessToken, ss.spreadsheetId);

  return ss;
};
