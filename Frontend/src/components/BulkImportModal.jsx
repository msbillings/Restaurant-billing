import React, { useState, useRef } from 'react';
import { X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, HelpCircle, FileText, ArrowRight, RefreshCw } from 'lucide-react';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { useLanguage } from '../context/LanguageContext';

const SAMPLE_10_ITEMS = [
  { name: 'Paneer Butter Masala', category: 'Veg Main Course', price: 269, type: 'Veg', description: 'Cottage cheese in rich creamy tomato and cashew butter gravy', isAvailable: 'TRUE', taxRate: 5, image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500&auto=format&fit=crop&q=80' },
  { name: 'Hyderabadi Chicken Dum Biryani', category: 'Biryani Specialties', price: 299, type: 'Non-Veg', description: 'Classic dum biryani with marinated chicken and long-grain basmati rice', isAvailable: 'TRUE', taxRate: 5, image: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=500&auto=format&fit=crop&q=80' },
  { name: 'Cream of Tomato Soup', category: 'Veg Soups', price: 129, type: 'Veg', description: 'Rich, smooth soup prepared from fresh vine tomatoes and butter', isAvailable: 'TRUE', taxRate: 5, image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&auto=format&fit=crop&q=80' },
  { name: 'Chicken 65', category: 'Non-Veg Starters', price: 269, type: 'Non-Veg', description: 'Deep-fried spicy chicken morsels tempered with curry leaves and mustard', isAvailable: 'TRUE', taxRate: 5, image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80' },
  { name: 'Tandoori Chicken (Full)', category: 'Tandoori & Kebabs', price: 499, type: 'Non-Veg', description: 'Whole chicken marinated in yogurt & red spices, roasted in clay oven', isAvailable: 'TRUE', taxRate: 5, image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&auto=format&fit=crop&q=80' },
  { name: 'Butter Naan', category: 'Fresh Rotis & Breads', price: 59, type: 'Veg', description: 'Soft Indian flatbread baked in tandoor and brushed with fresh butter', isAvailable: 'TRUE', taxRate: 5, image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500&auto=format&fit=crop&q=80' },
  { name: 'Mutton Rogan Josh', category: 'Mutton Specialties', price: 419, type: 'Non-Veg', description: 'Kashmiri style mutton curry flavored with alkanet root & fennel seeds', isAvailable: 'TRUE', taxRate: 5, image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80' },
  { name: 'Apollo Fish Fry', category: 'Seafood & Fish', price: 349, type: 'Non-Veg', description: 'Hyderabadi style crispy fish fried with curry leaves & spicy seasoning', isAvailable: 'TRUE', taxRate: 5, image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&auto=format&fit=crop&q=80' },
  { name: 'Gulab Jamun (2 Pcs)', category: 'Desserts & Sweets', price: 89, type: 'Veg', description: 'Warm milk solid dumplings soaked in cardamom sugar syrup', isAvailable: 'TRUE', taxRate: 5, image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=500&auto=format&fit=crop&q=80' },
  { name: 'Fresh Virgin Mojito', category: 'Cold Beverages & Shakes', price: 119, type: 'Veg', description: 'Sparkling soda with fresh mint, lime wedges, and simple syrup', isAvailable: 'TRUE', taxRate: 5, image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80' }
];

export const generateExcelWithStyling = async (items, filename = 'MS_Billings_Menu.xlsx') => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Menu Items');

  worksheet.columns = [
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Price', key: 'price', width: 12 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Description', key: 'description', width: 45 },
    { header: 'Is Available', key: 'isAvailable', width: 15 },
    { header: 'Tax Rate', key: 'taxRate', width: 12 },
    { header: 'Image URL', key: 'image', width: 55 },
  ];

  items.forEach(item => worksheet.addRow(item));

  // Style Header Row with Highlighted Color
  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EA580C' } }; // Brand orange highlight
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'medium', color: { argb: 'C2410C' } },
      bottom: { style: 'medium', color: { argb: 'C2410C' } },
      left: { style: 'thin', color: { argb: 'F97316' } },
      right: { style: 'thin', color: { argb: 'F97316' } }
    };
  });

  // Style Data Rows with Alternating High/Low Light Highlight Colors (Zebra Striping)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 24;
    const isEven = rowNumber % 2 === 0;
    // Row to row high and low light alternative colors
    const rowBgColor = isEven ? 'FFF7ED' : 'FFFFFF'; // Soft highlight color for even rows, crisp white for odd rows

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 10, color: { argb: '1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 3 || colNumber === 7 ? 'right' : colNumber === 4 || colNumber === 6 ? 'center' : 'left'
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FED7AA' } },
        bottom: { style: 'thin', color: { argb: 'FED7AA' } },
        left: { style: 'thin', color: { argb: 'FED7AA' } },
        right: { style: 'thin', color: { argb: 'FED7AA' } }
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const BulkImportModal = ({ isOpen, onClose, onImportSuccess }) => {
  const { t } = useLanguage();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showGuide, setShowGuide] = useState(true);

  if (!isOpen) return null;

  const handleDownloadSampleExcel = () => {
    generateExcelWithStyling(SAMPLE_10_ITEMS, 'MS_Billings_Sample_Template.xlsx');
  };

  const handleDownloadSampleCSV = () => {
    const csvContent = Papa.unparse(SAMPLE_10_ITEMS.map(i => ({
      Name: i.name,
      Category: i.category,
      Price: i.price,
      Type: i.type,
      Description: i.description,
      'Is Available': i.isAvailable,
      'Tax Rate': i.taxRate,
      'Image URL': i.image
    })));
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'MS_Billings_Sample_Template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const parseExcelFile = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error('No worksheets found in Excel file');

      const rows = [];
      let headers = [];

      worksheet.eachRow((row, rowNumber) => {
        const rowValues = row.values.slice(1); // 1-indexed in ExcelJS
        if (rowNumber === 1) {
          headers = rowValues.map(v => v ? String(v).trim() : '');
        } else {
          const rowObj = {};
          headers.forEach((header, idx) => {
            if (header) {
              rowObj[header] = rowValues[idx] !== undefined && rowValues[idx] !== null ? String(rowValues[idx]).trim() : '';
            }
          });
          if (Object.values(rowObj).some(v => v !== '')) {
            rows.push(rowObj);
          }
        }
      });

      return rows;
    } catch (err) {
      console.error('Error reading excel:', err);
      throw new Error('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
    }
  };

  const parseCSVFile = (file) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (err) => reject(err)
      });
    });
  };

  const processFile = async (file) => {
    if (!file) return;

    const fileExt = file.name.split('.').pop().toLowerCase();
    if (fileExt !== 'csv' && fileExt !== 'xlsx' && fileExt !== 'xls') {
      setErrorMsg('Unsupported file format. Please upload a .csv or .xlsx file.');
      return;
    }

    setSelectedFile(file);
    setIsParsing(true);
    setErrorMsg('');

    try {
      let rawRows = [];
      if (fileExt === 'csv') {
        rawRows = await parseCSVFile(file);
      } else {
        rawRows = await parseExcelFile(file);
      }

      const processed = rawRows.map((row, index) => {
        // Standardize key names flexible to case
        const getVal = (...keys) => {
          for (let k of keys) {
            const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
            if (foundKey && row[foundKey] !== undefined) return row[foundKey];
          }
          return '';
        };

        const name = getVal('Name', 'Item Name', 'ItemName');
        const category = getVal('Category', 'Category Name');
        const priceRaw = getVal('Price', 'Item Price', 'Cost');
        const typeRaw = getVal('Type', 'Item Type', 'Veg/NonVeg');
        const description = getVal('Description', 'Item Description');
        const isAvailableRaw = getVal('Is Available', 'IsAvailable', 'Available');
        const taxRateRaw = getVal('Tax Rate', 'TaxRate', 'Tax');
        const image = getVal('Image URL', 'ImageURL', 'Image', 'Photo');

        const price = parseFloat(priceRaw) || 0;
        const taxRate = parseFloat(taxRateRaw) || 0;
        
        let type = 'veg';
        if (typeRaw.toLowerCase().includes('non')) type = 'non-veg';
        else if (typeRaw.toLowerCase().includes('egg')) type = 'egg';

        let isAvailable = true;
        if (isAvailableRaw) {
          const lowerAvail = String(isAvailableRaw).toLowerCase();
          if (lowerAvail === 'false' || lowerAvail === 'no' || lowerAvail === '0') isAvailable = false;
        }

        const missingFields = [];
        if (!name) missingFields.push('Name');
        if (!category) missingFields.push('Category');
        if (!priceRaw || isNaN(price) || price <= 0) missingFields.push('Price');

        return {
          id: index + 1,
          name,
          category,
          price,
          type,
          description,
          isAvailable,
          taxRate,
          image,
          isValid: missingFields.length === 0,
          missingFields,
          rawRow: row
        };
      });

      setParsedData(processed);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to read file contents.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleConfirmImport = async () => {
    const validItems = parsedData.filter(d => d.isValid);
    if (validItems.length === 0) {
      setErrorMsg('No valid items found to import.');
      return;
    }

    setIsImporting(true);
    setErrorMsg('');

    try {
      await onImportSuccess(validItems);
      handleReset();
      onClose();
    } catch (err) {
      setErrorMsg('An error occurred while importing items: ' + (err.message || 'Server error'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParsedData([]);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validCount = parsedData.filter(d => d.isValid).length;
  const invalidCount = parsedData.length - validCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/10 via-surface to-accent/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/15 text-primary rounded-xl">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-main">{t("Bulk Menu Import")}</h2>
              <p className="text-xs text-text-muted">{t("Upload your menu database via Excel (.xlsx) or CSV (.csv)")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Download Sample & Guidelines Card */}
          <div className="bg-surface-hover/50 border border-border/70 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <HelpCircle size={18} className="text-primary" />
                <span className="text-sm font-semibold text-text-main">{t("Fields & Excel Format Requirements")}</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleDownloadSampleExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-hover transition-colors shadow-sm">
                  <Download size={14} />
                  <span>{t("Download Sample .XLSX")}</span>
                </button>
                <button
                  onClick={handleDownloadSampleCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border text-text-main text-xs font-semibold rounded-lg hover:bg-surface-hover transition-colors">
                  <FileText size={14} />
                  <span>{t("Download Sample .CSV")}</span>
                </button>
              </div>
            </div>

            {/* Quick Field Info Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
              <div className="p-2 bg-surface rounded-lg border border-border/40">
                <span className="font-bold text-text-main block">Name *</span>
                <span className="text-[11px] text-text-muted">Item Name (e.g. Paneer Butter Masala)</span>
              </div>
              <div className="p-2 bg-surface rounded-lg border border-border/40">
                <span className="font-bold text-text-main block">Category *</span>
                <span className="text-[11px] text-text-muted">Section (e.g. Veg Main Course)</span>
              </div>
              <div className="p-2 bg-surface rounded-lg border border-border/40">
                <span className="font-bold text-text-main block">Price *</span>
                <span className="text-[11px] text-text-muted">Numeric amount (e.g. 269)</span>
              </div>
              <div className="p-2 bg-surface rounded-lg border border-border/40">
                <span className="font-bold text-text-main block">Type *</span>
                <span className="text-[11px] text-text-muted">Veg / Non-Veg / Egg</span>
              </div>
              <div className="p-2 bg-surface rounded-lg border border-border/40">
                <span className="font-semibold text-text-main block">Description</span>
                <span className="text-[11px] text-text-muted">Optional details</span>
              </div>
              <div className="p-2 bg-surface rounded-lg border border-border/40">
                <span className="font-semibold text-text-main block">Is Available</span>
                <span className="text-[11px] text-text-muted">TRUE / FALSE (Default: TRUE)</span>
              </div>
              <div className="p-2 bg-surface rounded-lg border border-border/40">
                <span className="font-semibold text-text-main block">Tax Rate</span>
                <span className="text-[11px] text-text-muted">GST % (e.g. 5)</span>
              </div>
              <div className="p-2 bg-surface rounded-lg border border-border/40">
                <span className="font-semibold text-text-main block">Image URL</span>
                <span className="text-[11px] text-text-muted">Direct Image Link</span>
              </div>
            </div>
          </div>

          {/* Upload Dropzone */}
          {!selectedFile ? (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv,.xlsx,.xls"
                className="hidden" />
              <div className="p-4 bg-primary/15 text-primary rounded-full shadow-inner">
                <Upload size={32} />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-main">{t("Click or Drag & Drop File Here")}</h3>
                <p className="text-xs text-text-muted mt-1">{t("Supports both Excel (.xlsx, .xls) and CSV (.csv) files")}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3.5 bg-surface rounded-xl border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/15 text-primary rounded-lg">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-main">{selectedFile.name}</p>
                  <p className="text-xs text-text-muted">{(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.name.split('.').pop().toUpperCase()}</p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-danger hover:bg-danger/10 rounded-lg transition-colors border border-danger/20 font-semibold">
                <RefreshCw size={14} />
                <span>{t("Change File")}</span>
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Live Data Preview Table */}
          {parsedData.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-text-main">{t("Live File Preview")}</h3>
                  <span className="px-2.5 py-0.5 bg-primary/15 text-primary text-xs font-bold rounded-full">{parsedData.length} {t("Items")}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 font-semibold rounded-full border border-emerald-500/20">
                    <CheckCircle size={12} /> {validCount} {t("Valid")}
                  </span>
                  {invalidCount > 0 && (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 text-amber-600 font-semibold rounded-full border border-amber-500/20">
                      <AlertCircle size={12} /> {invalidCount} {t("Incomplete")}
                    </span>
                  )}
                </div>
              </div>

              {/* Table Container with Highlighted Header & Row-to-Row Alternating Colors */}
              <div className="border border-border rounded-xl overflow-hidden shadow-sm max-h-[320px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-primary text-white font-bold text-xs uppercase tracking-wider sticky top-0 z-10">
                      <th className="py-2.5 px-3 border-b border-primary-hover w-12 text-center">#</th>
                      <th className="py-2.5 px-3 border-b border-primary-hover w-20 text-center">{t("Status")}</th>
                      <th className="py-2.5 px-3 border-b border-primary-hover">{t("Name")}</th>
                      <th className="py-2.5 px-3 border-b border-primary-hover">{t("Category")}</th>
                      <th className="py-2.5 px-3 border-b border-primary-hover text-right">{t("Price (₹)")}</th>
                      <th className="py-2.5 px-3 border-b border-primary-hover text-center">{t("Type")}</th>
                      <th className="py-2.5 px-3 border-b border-primary-hover">{t("Description")}</th>
                      <th className="py-2.5 px-3 border-b border-primary-hover text-center">{t("Image")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((row, idx) => {
                      // Row to row high and low light alternative colors
                      const isEven = idx % 2 === 0;
                      const rowBgClass = !row.isValid 
                        ? 'bg-amber-500/10 hover:bg-amber-500/15' 
                        : isEven 
                          ? 'bg-orange-50/50 dark:bg-slate-800/40 hover:bg-orange-100/50 dark:hover:bg-slate-800/70' 
                          : 'bg-surface hover:bg-surface-hover';

                      return (
                        <tr key={row.id} className={`${rowBgClass} transition-colors border-b border-border/50`}>
                          <td className="py-2 px-3 text-center text-text-muted font-mono">{idx + 1}</td>
                          <td className="py-2 px-3 text-center">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 font-bold rounded-full text-[10px]">
                                <CheckCircle size={10} /> Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold rounded-full text-[10px]" title={`Missing: ${row.missingFields.join(', ')}`}>
                                <AlertCircle size={10} /> Missing
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-semibold text-text-main">{row.name || <span className="text-amber-500 italic">Missing</span>}</td>
                          <td className="py-2 px-3 text-text-muted">{row.category || <span className="text-amber-500 italic">Missing</span>}</td>
                          <td className="py-2 px-3 text-right font-bold text-text-main">₹{row.price}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.type === 'veg' ? 'bg-emerald-500/10 text-emerald-600' : row.type === 'non-veg' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'}`}>
                              {row.type === 'veg' ? 'Veg' : row.type === 'non-veg' ? 'Non-Veg' : 'Egg'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-text-muted truncate max-w-[200px]" title={row.description}>{row.description || '-'}</td>
                          <td className="py-2 px-3 text-center">
                            {row.image ? (
                              <img src={row.image} alt={row.name} className="w-7 h-7 rounded-lg object-cover mx-auto border border-border shadow-xs" onError={(e) => { e.target.style.display = 'none'; }} />
                            ) : (
                              <span className="text-text-muted text-[10px]">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover rounded-xl transition-colors border border-border">
            {t("Cancel")}
          </button>
          
          <button
            onClick={handleConfirmImport}
            disabled={validCount === 0 || isImporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed">
            {isImporting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>{t("Importing Menu Items...")}</span>
              </>
            ) : (
              <>
                <span>{t("Confirm & Import")} ({validCount} {t("Items")})</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default BulkImportModal;
