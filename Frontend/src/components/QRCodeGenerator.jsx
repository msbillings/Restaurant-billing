import React, { useState, useEffect } from 'react';
import { QrCode, Printer, Download, LayoutGrid } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const QRCodeGenerator = () => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('ALL');
  const [restaurantName, setRestaurantName] = useState('MSBillings');

  useEffect(() => {
    try {
      const savedSpaces = localStorage.getItem('msbillings_spaces');
      if (savedSpaces) {
        const parsed = JSON.parse(savedSpaces);
        let allTables = [];
        parsed.forEach(floor => {
          floor.tables?.forEach(t => allTables.push(t.name));
          floor.cabins?.forEach(c => allTables.push(c.name));
          floor.sofas?.forEach(s => allTables.push(s.name));
        });
        setTables(allTables.length > 0 ? allTables : ['Table 1', 'Table 2', 'Table 3']);
      } else {
        setTables(['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5']);
      }

      const settings = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      if (settings.restaurantName) setRestaurantName(settings.restaurantName);
    } catch (e) {}
  }, []);

  const getQRUrl = (table) => {
    const baseUrl = window.location.origin;
    const dbName = localStorage.getItem('resto_db_name') || 'default';
    return `${baseUrl}/order?tenant=${dbName}&table=${encodeURIComponent(table)}`;
  };

  const printQRCodes = () => {
    window.print();
  };

  const tablesToRender = selectedTable === 'ALL' ? tables : [selectedTable];

  return (
    <div className="h-full flex flex-col bg-background p-4 sm:p-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 shrink-0">
        <h1 className="text-2xl font-black text-text-main flex items-center gap-2">
          <QrCode className="text-primary" /> QR MENU GENERATOR
        </h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select 
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="w-full sm:w-48 bg-surface border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary text-text-main"
          >
            <option value="ALL">All Tables</option>
            {tables.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button 
            onClick={printQRCodes}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold shadow-md shadow-primary/20 hover:opacity-90 transition-opacity"
          >
            <Printer size={18} /> <span className="hidden sm:inline">Print QRs</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto print:overflow-visible">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 print:grid-cols-3 print:gap-4">
          {tablesToRender.map(table => (
            <div key={table} className="bg-surface border-2 border-dashed border-border p-6 rounded-2xl flex flex-col items-center justify-center text-center gap-4 break-inside-avoid print:border-black print:bg-white print:shadow-none shadow-sm">
              <h2 className="font-black text-xl text-text-main uppercase tracking-wider">{restaurantName}</h2>
              <div className="bg-white p-2 rounded-xl shadow-inner">
                <QRCodeSVG 
                  value={getQRUrl(table)} 
                  size={140}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <div>
                <p className="text-xs text-text-muted font-bold tracking-widest uppercase mb-1">Scan to Order</p>
                <h3 className="font-black text-2xl text-primary">{table}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:overflow-visible, .print\\:overflow-visible * {
            visibility: visible;
          }
          .print\\:overflow-visible {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default QRCodeGenerator;
