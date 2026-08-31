import ExcelJS from 'exceljs';

export const generateDayBookWorkbook = (restaurantName, date, transactions, cashFlow, revenueLeakage) => {
  // Create Excel Workbook
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('DayBook', {
    properties: { tabColor: { argb: 'FF003366' } }
  });

  // Formatting Helpers
  const titleFont = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF003366' } };
  const subtitleFont = { name: 'Calibri', size: 12, bold: true };
  const headerFont = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
  const borderAll = {
    top: { style: 'thin' }, left: { style: 'thin' },
    bottom: { style: 'thin' }, right: { style: 'thin' }
  };
  const totalsFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

  const safeRestoName = restaurantName || 'RESTAURANT';
  
  // Row 1: Main Title
  sheet.mergeCells('A1:H1');
  const titleRow = sheet.getRow(1);
  titleRow.getCell(1).value = `${safeRestoName.toUpperCase()} TRANSACTION SUMMARY REPORT`;
  titleRow.getCell(1).font = titleFont;
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 30;

  // Row 2: Subtitle
  sheet.mergeCells('A2:H2');
  const subtitleRow = sheet.getRow(2);
  subtitleRow.getCell(1).value = `DayBook Transaction Registry`;
  subtitleRow.getCell(1).font = subtitleFont;
  subtitleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 3: Date
  sheet.mergeCells('A3:H3');
  const dateRow = sheet.getRow(3);
  const dateFormatted = new Date(date).toLocaleDateString('en-GB'); // DD/MM/YYYY
  dateRow.getCell(1).value = `Date: ${dateFormatted}`;
  dateRow.getCell(1).font = { name: 'Calibri', size: 11, italic: true };
  dateRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 4: Empty

  // Row 5: Headers
  const headers = ['S.No', 'Time', 'Type', 'Particulars', 'Name', 'Payment Mode', 'Expense (-)', 'Income (+)'];
  const headerRow = sheet.getRow(5);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.border = borderAll;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Data Rows
  let currentRow = 6;
  transactions.forEach((t, i) => {
    const row = sheet.getRow(currentRow);
    row.getCell(1).value = i + 1; // S.No
    row.getCell(2).value = new Date(t.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    row.getCell(3).value = t.type;
    row.getCell(4).value = t.particulars;
    row.getCell(5).value = t.name;
    row.getCell(6).value = t.paymentMode || '--';
    
    const outCell = row.getCell(7);
    outCell.value = t.cashOut > 0 ? t.cashOut : '';
    outCell.numFmt = '₹#,##0.00';
    if (t.cashOut > 0) outCell.font = { color: { argb: 'FFFF0000' } }; // Red for Out
    
    const inCell = row.getCell(8);
    inCell.value = t.cashIn > 0 ? t.cashIn : '';
    inCell.numFmt = '₹#,##0.00';
    if (t.cashIn > 0) inCell.font = { color: { argb: 'FF0070C0' } }; // Blue/Green for In

    // Apply borders and alignment
    for(let col = 1; col <= 8; col++) {
      row.getCell(col).border = borderAll;
      if (col === 1 || col === 2 || col === 3 || col === 6) {
         row.getCell(col).alignment = { horizontal: 'center' };
      }
    }
    currentRow++;
  });

  // Row TOTALS
  const totalsRow = sheet.getRow(currentRow);
  sheet.mergeCells(`A${currentRow}:F${currentRow}`);
  const totalsLabelCell = totalsRow.getCell(1);
  totalsLabelCell.value = 'TOTALS:';
  totalsLabelCell.font = { bold: true, size: 12 };
  totalsLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };
  
  const totalOutCell = totalsRow.getCell(7);
  totalOutCell.value = cashFlow.cashOut + cashFlow.onlineOut;
  totalOutCell.numFmt = '₹#,##0.00';
  totalOutCell.font = { bold: true, size: 12, color: { argb: 'FFFF0000' } };

  const totalInCell = totalsRow.getCell(8);
  totalInCell.value = cashFlow.cashIn + cashFlow.onlineIn.total;
  totalInCell.numFmt = '₹#,##0.00';
  totalInCell.font = { bold: true, size: 12, color: { argb: 'FF0070C0' } };

  // Apply Fill & Border to Totals row
  for(let col = 1; col <= 8; col++) {
    totalsRow.getCell(col).fill = totalsFill;
    totalsRow.getCell(col).border = borderAll;
  }

  currentRow += 3;

  // Payment Mode Breakdown
  const pmTitleRow = sheet.getRow(currentRow);
  pmTitleRow.getCell(4).value = 'PAYMENT MODE BREAKDOWN';
  pmTitleRow.getCell(4).font = { bold: true, underline: true };
  currentRow++;

  // Breakdown Helper
  const addBreakdownRow = (label, amount) => {
    const r = sheet.getRow(currentRow);
    r.getCell(4).value = label;
    const amtCell = r.getCell(5);
    amtCell.value = amount;
    amtCell.numFmt = '₹#,##0.00';
    amtCell.font = { bold: true };
    
    // Box border for breakdown table
    r.getCell(4).border = borderAll;
    r.getCell(5).border = borderAll;
    currentRow++;
  };

  addBreakdownRow('Total Cash In :', cashFlow.cashIn);
  addBreakdownRow('Total Card In :', cashFlow.onlineIn.upiApps['Card'] || 0);
  
  let totalUpi = 0;
  Object.entries(cashFlow.onlineIn.upiApps).forEach(([app, amount]) => {
    if (app !== 'Card' && app !== 'Mixed' && app !== 'Other Online') totalUpi += amount;
  });
  addBreakdownRow('Total UPI In :', totalUpi);
  addBreakdownRow('Total Mixed In :', cashFlow.onlineIn.upiApps['Mixed'] || 0);
  
  addBreakdownRow('Total Cash Out :', cashFlow.cashOut);
  addBreakdownRow('Total Online Out :', cashFlow.onlineOut);

  currentRow++;
  addBreakdownRow('Revenue Leakage :', revenueLeakage);
  sheet.getRow(currentRow - 1).getCell(4).font = { bold: true, color: { argb: 'FFFF0000' } }; // Highlight leakage in red

  // Set Column Widths
  sheet.getColumn(1).width = 6;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 10;
  sheet.getColumn(4).width = 18;
  sheet.getColumn(5).width = 25;
  sheet.getColumn(6).width = 15;
  sheet.getColumn(7).width = 15;
  sheet.getColumn(8).width = 15;

  return workbook;
};
