import ExcelJS from 'exceljs';

async function readItems() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('../AL Mandi Palace (1).xlsx');
  const worksheet = workbook.worksheets[0];
  
  const items = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = row.getCell(1).value;
    const category = row.getCell(2).value;
    if (name) items.push({ rowNumber, name, category });
  });
  
  console.log(JSON.stringify(items, null, 2));
}
readItems().catch(console.error);
