import ExcelJS from 'exceljs';

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Metapharsic LifeSciences';
  const ws = wb.addWorksheet('Dashboard');
  ws.addRow(['METAPHARSIC LIFESCIENCES', 'EXECUTIVE DASHBOARD']);
  const buf = await wb.xlsx.writeBuffer();
  console.log('ExcelJS generated XLSX byteLength:', buf.byteLength);
}

main().catch(console.error);
