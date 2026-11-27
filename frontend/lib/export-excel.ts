/**
 * Xuất dữ liệu bảng ra file Excel (.xls) hỗ trợ đầy đủ tiếng Việt UTF-8,
 * mở trực tiếp bằng Microsoft Excel hoặc Google Sheets mà không cần thư viện ngoài.
 */
export function exportTableToExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: Array<Array<string | number>>
): void {
  const escapeHtml = (val: string | number) =>
    String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const headerHtml = headers
    .map(
      (h) =>
        `<th style="background:#0f6b35;color:#ffffff;font-weight:bold;padding:8px 12px;border:1px solid #cbd5e1;text-align:left;">${escapeHtml(h)}</th>`
    )
    .join('');

  const bodyHtml = rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td style="padding:6px 12px;border:1px solid #cbd5e1;">${escapeHtml(cell)}</td>`
          )
          .join('')}</tr>`
    )
    .join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${escapeHtml(sheetName)}</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
      </head>
      <body>
        <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF', html], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  link.href = url;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
