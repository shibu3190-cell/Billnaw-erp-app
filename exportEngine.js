/* ==========================================================================
   BILLNAW — EXPORT ENGINE
   Extracted from app.js. Pure output helpers: no DOM state is mutated here
   beyond creating a throwaway <a> to trigger the download, and nothing in
   this file reads APP_STATE except for the report header band.

   Load order matters (no bundler): this must load BEFORE app.js.
   ========================================================================== */

/* ==========================================================================
   CSV EXPORT ENGINE
   ========================================================================== */
function downloadCSV(filename, rows) {
  // rows: array of arrays. Escapes quotes/commas per RFC 4180.
  const csv = rows.map(row =>
    row.map(cell => {
      const s = (cell === null || cell === undefined) ? '' : String(cell);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  ).join('\r\n');

  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


/* ==========================================================================
   EXPORT ENGINE — CSV + Excel
   Excel output uses SpreadsheetML 2003 (.xls), which Excel, LibreOffice and
   Google Sheets all open natively and which supports real column widths,
   bold headers and number formatting. Deliberately NOT a .xlsx: that needs
   a ZIP writer (~100KB of extra library) for cosmetic gain, and this app is
   precached for offline use where every KB is downloaded on a shop's mobile
   data. CSV remains available for anything a user wants to re-import.
   ========================================================================== */
function escXml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function exportToExcel(filename, sheetName, headers, rows, meta = {}) {
  const isNum = v => typeof v === 'number' && isFinite(v);

  const headerCells = headers.map(h =>
    `<Cell ss:StyleID="hdr"><Data ss:Type="String">${escXml(h)}</Data></Cell>`
  ).join('');

  const bodyRows = rows.map(r => {
    const cells = r.map(v => isNum(v)
      ? `<Cell ss:StyleID="num"><Data ss:Type="Number">${v}</Data></Cell>`
      : `<Cell><Data ss:Type="String">${escXml(v)}</Data></Cell>`
    ).join('');
    return `<Row>${cells}</Row>`;
  }).join('');

  // A title/context band above the table: an exported file that lands in
  // someone's inbox with no indication of which shop or date range it
  // covers is close to useless for an accountant.
  const metaRows = [
    ['Report', sheetName],
    ['Shop', APP_STATE.tenantProfile.shopName || ''],
    ['GSTIN', APP_STATE.tenantProfile.gstin || 'Unregistered'],
    ['Generated', new Date().toLocaleString('en-IN')],
    ...(meta.filter ? [['Filter', meta.filter]] : []),
    ...(meta.range ? [['Period', meta.range]] : [])
  ].map(([k, v]) =>
    `<Row><Cell ss:StyleID="metaKey"><Data ss:Type="String">${escXml(k)}</Data></Cell>` +
    `<Cell><Data ss:Type="String">${escXml(v)}</Data></Cell></Row>`
  ).join('');

  const cols = headers.map(() => `<Column ss:AutoFitWidth="1" ss:Width="120"/>`).join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="hdr">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#6366D9" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="metaKey"><Font ss:Bold="1" ss:Color="#666666"/></Style>
  <Style ss:ID="num"><NumberFormat ss:Format="#,##0.00"/></Style>
 </Styles>
 <Worksheet ss:Name="${escXml(sheetName).slice(0, 31)}">
  <Table>
   ${cols}
   ${metaRows}
   <Row></Row>
   <Row>${headerCells}</Row>
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Pulls whatever table is currently rendered in the drill-down and exports
// exactly that — so what the user sees on screen and what lands in Excel
// can never diverge, including any filter they applied.
function exportCurrentViewToExcel() {
  const theadRow = document.querySelector('#drillTableHead tr');
  const bodyRows = document.querySelectorAll('#drillTableBody tr');
  if (!theadRow || !bodyRows.length) {
    showSaasToast('Nothing to export in this view.', 3000, 'err');
    return;
  }

  const headers = Array.from(theadRow.children).map(th => th.innerText.trim());
  const rows = [];
  bodyRows.forEach(tr => {
    const cells = Array.from(tr.children).map(td => {
      const txt = td.innerText.trim();
      // Convert "₹1,234.50" back to a real number so Excel can sum the
      // column — a currency string exports as text and silently breaks
      // every formula an accountant tries to write against it.
      const numeric = txt.replace(/[₹,\s]/g, '');
      return (numeric !== '' && numeric !== '-' && !isNaN(numeric)) ? parseFloat(numeric) : txt;
    });
    if (cells.length) rows.push(cells);
  });

  const title = document.getElementById('drillReportTitle')?.innerText || 'Report';
  exportToExcel(
    `${(APP_STATE.currentReportKey || 'report')}-${new Date().toISOString().slice(0, 10)}`,
    title, headers, rows,
    { filter: document.getElementById('drillFilterLabel')?.innerText || '' }
  );
}


window.escXml = escXml;
window.exportToExcel = exportToExcel;
window.downloadCSV = downloadCSV;
window.exportCurrentViewToExcel = exportCurrentViewToExcel;
