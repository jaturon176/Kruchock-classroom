/**
 * Export Service
 * Generates PDF reports and Excel/CSV files.
 */

export function exportToCSV(filename, rows) {
  if (!rows || !rows.length) return;

  const keys = Object.keys(rows[0]);
  let csvContent = keys.join(',') + '\n';

  rows.forEach(row => {
    const values = keys.map(k => {
      let val = row[k] === null || row[k] === undefined ? '' : String(row[k]);
      // Escape double quotes
      val = val.replace(/"/g, '""');
      if (val.includes(',') || val.includes('\n') || val.includes('"')) {
        val = `"${val}"`;
      }
      return val;
    });
    csvContent += values.join(',') + '\n';
  });

  // Prepend UTF-8 BOM (\uFEFF) so Excel opens Thai characters correctly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function printPDFReport(title, subtitle, tableHeaders, tableData) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const now = new Date().toLocaleString('th-TH');

  const rowsHTML = tableData.map(row => `
    <tr>
      ${row.map(cell => `<td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155;">${cell}</td>`).join('')}
    </tr>
  `).join('');

  const headersHTML = tableHeaders.map(h => `
    <th style="background: #1e293b; color: #ffffff; padding: 12px; font-size: 14px; text-align: left; font-weight: 600;">${h}</th>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Sarabun', sans-serif; padding: 40px; background: #ffffff; color: #0f172a; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
        .school-title { font-size: 24px; font-weight: 700; color: #1e3a8a; }
        .report-subtitle { font-size: 15px; color: #64748b; margin-top: 4px; }
        .meta { font-size: 13px; color: #475569; text-align: right; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .footer { margin-top: 50px; display: flex; justify-content: space-between; text-align: center; }
        .signature-line { margin-top: 40px; border-top: 1px dashed #94a3b8; width: 200px; display: inline-block; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 20px; text-align: right;">
        <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 10px 20px; font-family: 'Sarabun'; border-radius: 6px; font-weight: 600; cursor: pointer;">🖨️ พิมพ์เอกสาร / บันทึกเป็น PDF</button>
      </div>

      <div class="header">
        <div>
          <div class="school-title">🏫 ${title}</div>
          <div class="report-subtitle">${subtitle}</div>
        </div>
        <div class="meta">
          <div><strong>วันที่พิมพ์:</strong> ${now}</div>
          <div><strong>เอกสารทางการ:</strong> ระบบบริหารจัดการห้องเรียน</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>${headersHTML}</tr>
        </thead>
        <tbody>
          ${rowsHTML}
        </tbody>
      </table>

      <div class="footer">
        <div>
          <div class="signature-line"></div>
          <div>ลงชื่อ..........................................................</div>
          <div style="font-weight: 600; margin-top: 5px;">(นายประเสริฐ วิทยา)</div>
          <div style="font-size: 12px; color: #64748b;">ครูประจำชั้น / ผู้สอน</div>
        </div>
        <div>
          <div class="signature-line"></div>
          <div>ลงชื่อ..........................................................</div>
          <div style="font-weight: 600; margin-top: 5px;">(นายสมศักดิ์ ใจดี)</div>
          <div style="font-size: 12px; color: #64748b;">ผู้อำนวยการโรงเรียน</div>
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
