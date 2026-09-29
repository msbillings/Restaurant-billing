import React, { useState, useRef } from 'react';
import { X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, HelpCircle, FileText, ArrowRight, RefreshCw } from 'lucide-react';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';

const SAMPLE_10_ITEMS = [
  { name: 'Passiflow POS Terminal V1', category: 'Hardware', price: 14999, stockCount: 50, vendorName: 'Internal', supplierPrice: 12000, description: 'All-in-one POS terminal with dual screen', isActive: 'TRUE', imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=500' },
  { name: 'Thermal Receipt Printer', category: 'Hardware', price: 4999, stockCount: 100, vendorName: 'Internal', supplierPrice: 3500, description: 'High-speed 80mm thermal receipt printer', isActive: 'TRUE', imageUrl: 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=500' },
  { name: 'Barcode Scanner (Wireless)', category: 'Hardware', price: 2999, stockCount: 75, vendorName: 'Internal', supplierPrice: 2000, description: '2D wireless barcode scanner', isActive: 'TRUE', imageUrl: 'https://images.unsplash.com/photo-1517520282167-4b46449fe015?w=500' },
  { name: 'Premium Analytics Add-on', category: 'Software', price: 1999, stockCount: 999, vendorName: 'Internal', supplierPrice: 0, description: 'Advanced AI analytics module', isActive: 'TRUE', imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500' }
];

export const generateExcelWithStyling = async (items, filename = 'MarketHub_Products.xlsx') => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Products');

  worksheet.columns = [
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Price', key: 'price', width: 12 },
    { header: 'Stock Count', key: 'stockCount', width: 15 },
    { header: 'Vendor Name', key: 'vendorName', width: 20 },
    { header: 'Supplier Price', key: 'supplierPrice', width: 15 },
    { header: 'Description', key: 'description', width: 45 },
    { header: 'Is Active', key: 'isActive', width: 15 },
    { header: 'Image URL', key: 'imageUrl', width: 55 },
  ];

  items.forEach(item => worksheet.addRow(item));

  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F46E5' } }; 
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 24;
    row.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 10 };
      cell.alignment = { vertical: 'middle' };
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

const BulkProductImportModal = ({ isOpen, onClose, onImportSuccess }) => {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showGuide, setShowGuide] = useState(true);

  if (!isOpen) return null;

  const handleDownloadSampleExcel = () => {
    generateExcelWithStyling(SAMPLE_10_ITEMS, 'MarketHub_Products_Template.xlsx');
  };

  const handleDownloadSampleCSV = () => {
    const csvContent = Papa.unparse(SAMPLE_10_ITEMS.map(i => ({
      Name: i.name,
      Category: i.category,
      Price: i.price,
      'Stock Count': i.stockCount,
      'Vendor Name': i.vendorName,
      'Supplier Price': i.supplierPrice,
      Description: i.description,
      'Is Active': i.isActive,
      'Image URL': i.imageUrl
    })));
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'MarketHub_Products_Template.csv';
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
        const rowValues = row.values.slice(1);
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
      throw new Error('Failed to parse Excel file.');
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
        const getVal = (...keys) => {
          for (let k of keys) {
            const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
            if (foundKey && row[foundKey] !== undefined) return row[foundKey];
          }
          return '';
        };

        const name = getVal('Name', 'Product Name');
        const category = getVal('Category', 'Product Category') || 'Hardware';
        const priceRaw = getVal('Price', 'Cost');
        const stockCountRaw = getVal('Stock Count', 'Stock');
        const vendorName = getVal('Vendor Name', 'Supplier Name') || 'Internal';
        const supplierPriceRaw = getVal('Supplier Price', 'Wholesale Price');
        const description = getVal('Description', 'Details');
        const isActiveRaw = getVal('Is Active', 'Active');
        const imageUrl = getVal('Image URL', 'ImageURL', 'Image');

        const price = parseFloat(priceRaw) || 0;
        const stockCount = parseInt(stockCountRaw) || 0;
        const supplierPrice = parseFloat(supplierPriceRaw) || 0;
        
        let isActive = true;
        if (isActiveRaw) {
          const lowerActive = String(isActiveRaw).toLowerCase();
          if (lowerActive === 'false' || lowerActive === 'no' || lowerActive === '0') isActive = false;
        }

        const missingFields = [];
        if (!name) missingFields.push('Name');
        if (!priceRaw || isNaN(price) || price <= 0) missingFields.push('Price');
        if (isNaN(stockCount)) missingFields.push('Stock Count');

        return {
          id: index + 1,
          name,
          category,
          price,
          stockCount,
          vendorName,
          supplierPrice,
          description,
          isActive,
          imageUrl,
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Bulk Product Import</h2>
              <p className="text-xs text-gray-400 mt-0.5">Upload your catalog via Excel (.xlsx) or CSV (.csv)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-background">
          
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-start gap-3 text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{errorMsg}</p>
            </div>
          )}

          {!selectedFile ? (
            <>
              {/* Requirements & Guide */}
              <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 overflow-hidden">
                <button 
                  onClick={() => setShowGuide(!showGuide)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                    <HelpCircle size={18} />
                    Fields & Format Requirements
                  </div>
                  <div className="flex gap-2">
                    <div onClick={(e) => { e.stopPropagation(); handleDownloadSampleExcel(); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20 transition-colors">
                      <Download size={14} /> Sample .XLSX
                    </div>
                    <div onClick={(e) => { e.stopPropagation(); handleDownloadSampleCSV(); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold rounded-lg border border-blue-500/20 transition-colors">
                      <Download size={14} /> Sample .CSV
                    </div>
                  </div>
                </button>
                
                {showGuide && (
                  <div className="p-5 border-t border-gray-700/50 grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-900/50">
                    <div className="bg-gray-800 p-3 rounded-xl border border-gray-700">
                      <p className="text-xs font-bold text-white mb-1">Name *</p>
                      <p className="text-[10px] text-gray-400">Product Name</p>
                    </div>
                    <div className="bg-gray-800 p-3 rounded-xl border border-gray-700">
                      <p className="text-xs font-bold text-white mb-1">Category *</p>
                      <p className="text-[10px] text-gray-400">Hardware / Software</p>
                    </div>
                    <div className="bg-gray-800 p-3 rounded-xl border border-gray-700">
                      <p className="text-xs font-bold text-white mb-1">Price *</p>
                      <p className="text-[10px] text-gray-400">Numeric amount</p>
                    </div>
                    <div className="bg-gray-800 p-3 rounded-xl border border-gray-700">
                      <p className="text-xs font-bold text-white mb-1">Stock Count *</p>
                      <p className="text-[10px] text-gray-400">Number available</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Zone */}
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-600 hover:border-indigo-500 rounded-3xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-gray-800/30 hover:bg-indigo-500/5 group"
              >
                <div className="w-16 h-16 bg-gray-800 group-hover:bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-4 transition-colors">
                  <Upload className="w-8 h-8 text-gray-400 group-hover:text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-400">Click or Drag & Drop File Here</h3>
                <p className="text-sm text-gray-500">Supports both Excel (.xlsx) and CSV (.csv) files</p>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" className="hidden" />
              </div>
            </>
          ) : isParsing ? (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
              <p className="text-gray-300 font-medium">Scanning file contents...</p>
            </div>
          ) : (
            <div className="flex flex-col h-full animate-fade-in-up">
              {/* Preview Header */}
              <div className="flex items-center justify-between mb-4 bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div className="flex items-center gap-3">
                  <FileText className="text-indigo-400" />
                  <div>
                    <p className="text-sm font-bold text-white">{selectedFile.name}</p>
                    <p className="text-xs text-gray-400">{(selectedFile.size / 1024).toFixed(1)} KB • {parsedData.length} total rows</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm font-bold">
                  <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg">
                    <CheckCircle size={16} /> {validCount} Ready
                  </div>
                  {invalidCount > 0 && (
                    <div className="flex items-center gap-1.5 text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg">
                      <AlertCircle size={16} /> {invalidCount} Invalid
                    </div>
                  )}
                  <button onClick={handleReset} className="ml-2 text-xs text-gray-400 hover:text-white underline">Change File</button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex-1 flex flex-col">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-900 border-b border-gray-700 text-[10px] uppercase tracking-wider text-gray-400 font-bold sticky top-0 z-10">
                      <tr>
                        <th className="p-3">Status</th>
                        <th className="p-3">Name</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Price</th>
                        <th className="p-3">Stock</th>
                        <th className="p-3">Issues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700 text-sm">
                      {parsedData.slice(0, 100).map((row, idx) => (
                        <tr key={idx} className={row.isValid ? 'bg-gray-800 hover:bg-gray-750' : 'bg-red-500/5'}>
                          <td className="p-3">
                            {row.isValid 
                              ? <CheckCircle size={16} className="text-emerald-400" />
                              : <AlertCircle size={16} className="text-red-400" />
                            }
                          </td>
                          <td className="p-3 font-medium text-white">{row.name || '-'}</td>
                          <td className="p-3 text-gray-300">{row.category || '-'}</td>
                          <td className="p-3 text-gray-300">₹{row.price}</td>
                          <td className="p-3 text-gray-300">{row.stockCount}</td>
                          <td className="p-3 text-xs text-red-400">
                            {!row.isValid && `Missing: ${row.missingFields.join(', ')}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedData.length > 100 && (
                    <div className="text-center py-3 text-xs text-gray-500 border-t border-gray-700 bg-gray-900">
                      Showing first 100 rows. {parsedData.length - 100} more rows will be processed.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center p-5 border-t border-border bg-gray-900/50">
          <button 
            onClick={onClose} 
            disabled={isImporting}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleConfirmImport}
            disabled={!selectedFile || validCount === 0 || isImporting || isParsing}
            className={`px-8 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg ${
              !selectedFile || validCount === 0 || isParsing
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : isImporting 
                  ? 'bg-fuchsia-600 text-white cursor-wait'
                  : 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-[0_0_20px_rgba(217,70,239,0.3)]'
            }`}
          >
            {isImporting ? (
              <><RefreshCw size={16} className="animate-spin" /> Importing {validCount} Items...</>
            ) : (
              <>Confirm & Import ({validCount} Items) <ArrowRight size={16} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkProductImportModal;
