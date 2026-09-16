import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Printer, ArrowLeft, ChefHat, Layers, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { getApiUrl } from '../config';
import html2canvas from 'html2canvas';

const KOT = ({ order, onClose }) => {
  const { t } = useLanguage();
  const [settings, setSettings] = useState({
    restaurantName: 'msbillings'
  });
  const [printerConfigs, setPrinterConfigs] = useState([]);
  const [selectedDept, setSelectedDept] = useState('ALL'); // 'ALL' or specific kitchen department
  const [isPrintingAll, setIsPrintingAll] = useState(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem('restaurantSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }

    // Fetch configured printers to link departments to printer hardware
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    axios.get(`${getApiUrl()}/printer-configs`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      setPrinterConfigs(res.data || []);
    }).catch(() => {});
  }, []);

  // Group items dynamically by Kitchen Station / Printer Config
  const stationGroups = useMemo(() => {
    if (!order?.items || !Array.isArray(order.items) || order.items.length === 0) {
      return [];
    }

    const activePrinters = printerConfigs.filter(p => p.isActive && (p.type === 'kot' || p.type === 'general'));

    const map = new Map();

    order.items.forEach(item => {
      const itemLower = (item.name || '').trim().toLowerCase();
      const catLower = (item.category?.name || item.category || '').trim().toLowerCase();
      const deptLower = (item.department || '').trim().toLowerCase();

      let matchedPrinter = null;
      for (const printer of activePrinters) {
        // 1. Check item-level assignment
        if (printer.assignmentMode === 'item' && Array.isArray(printer.assignedItems) && printer.assignedItems.length > 0) {
          if (printer.assignedItems.some(it => it.trim().toLowerCase() === itemLower)) {
            matchedPrinter = printer;
            break;
          }
        }
        // 2. Check category-level assignment
        else if (Array.isArray(printer.assignedCategories) && printer.assignedCategories.length > 0) {
          if (catLower && printer.assignedCategories.some(c => c.trim().toLowerCase() === catLower)) {
            matchedPrinter = printer;
            break;
          }
        }
        // 3. Check station name or assignTo match
        if (deptLower && deptLower !== 'all' && deptLower !== 'general') {
          if (printer.name && printer.name.trim().toLowerCase() === deptLower) {
            matchedPrinter = printer;
            break;
          }
          if (printer.assignTo && printer.assignTo.trim().toLowerCase() === deptLower) {
            matchedPrinter = printer;
            break;
          }
        }
      }

      const key = matchedPrinter
        ? matchedPrinter._id || matchedPrinter.name
        : (deptLower && deptLower !== 'all' && deptLower !== 'general' ? deptLower : 'Kitchen');

      const name = matchedPrinter
        ? matchedPrinter.name
        : (deptLower && deptLower !== 'all' && deptLower !== 'general' ? item.department : 'Kitchen');

      const location = matchedPrinter ? (matchedPrinter.location || '') : '';

      if (!map.has(key)) {
        map.set(key, {
          key,
          name,
          location,
          printer: matchedPrinter,
          items: []
        });
      }
      map.get(key).items.push(item);
    });

    return Array.from(map.values());
  }, [order?.items, printerConfigs]);

  const activeStationGroup = useMemo(() => {
    if (selectedDept === 'ALL') return null;
    return stationGroups.find(g => g.key === selectedDept || g.name === selectedDept) || null;
  }, [selectedDept, stationGroups]);

  // Filter items for currently selected view
  const displayedItems = useMemo(() => {
    if (!order?.items) return [];
    if (selectedDept === 'ALL') return order.items;
    if (activeStationGroup) return activeStationGroup.items;
    return order.items.filter(item => 
      (item.department || '').trim().toLowerCase() === selectedDept.trim().toLowerCase()
    );
  }, [order?.items, selectedDept, activeStationGroup]);

  // Print current active tab/kitchen
  const handlePrintCurrent = async () => {
    if (window.electronAPI) {
      const receiptNode = document.querySelector('#kot-print-area .receipt-print');
      const htmlContent = receiptNode ? receiptNode.outerHTML : document.getElementById('kot-print-area').outerHTML;
      const isSilent = settings.silentPrinting !== false;

      // Find if there is a specific physical printer configured for this station
      let targetPrinter = settings.kotPrinter || '';
      if (activeStationGroup?.printer?.deviceName) {
        targetPrinter = activeStationGroup.printer.deviceName;
      }

      window.electronAPI.silentPrint(htmlContent, targetPrinter, isSilent);
    } else if (window.AndroidBluetooth) {
      let macAddress = null;

      // 1. From active station group printer
      if (activeStationGroup?.printer) {
        const raw = activeStationGroup.printer.bluetoothAddress || activeStationGroup.printer.deviceName || '';
        const m = raw.match(/([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/);
        if (m) macAddress = m[0];
      }

      // 2. From configured KOT stations (printerConfigs or local cache)
      if (!macAddress) {
        try {
          const allConfigs = (printerConfigs && printerConfigs.length > 0)
            ? printerConfigs
            : JSON.parse(localStorage.getItem('msbillings_printer_configs') || '[]');
          const kotStation = allConfigs.find(p => p.isActive !== false && (p.type === 'kot' || p.type === 'general') && (p.connectionType === 'bluetooth' || (p.bluetoothAddress || p.deviceName || '').match(/([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/)));
          if (kotStation) {
            const raw = kotStation.bluetoothAddress || kotStation.deviceName || kotStation.name || '';
            const m = raw.match(/([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/);
            if (m) macAddress = m[0];
          }
        } catch (_) {}
      }

      // 3. From settings.kotPrinter (state or fresh from localStorage)
      if (!macAddress) {
        let raw = settings.kotPrinter || '';
        if (!raw) {
          try {
            const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
            raw = s.kotPrinter || '';
          } catch (_) {}
        }
        const m = (raw || '').match(/([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/);
        if (m) macAddress = m[0];
      }

      // 4. Fallback to settings.billingPrinter (if shared single Bluetooth printer)
      if (!macAddress) {
        let raw = settings.billingPrinter || '';
        if (!raw) {
          try {
            const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
            raw = s.billingPrinter || '';
          } catch (_) {}
        }
        const m = (raw || '').match(/([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/);
        if (m) macAddress = m[0];
      }

      // 5. Fallback to ANY configured Bluetooth printer station
      if (!macAddress) {
        try {
          const cached = JSON.parse(localStorage.getItem('msbillings_printer_configs') || '[]');
          const anyStation = cached.find(p => p.isActive !== false && (p.bluetoothAddress || p.deviceName || '').match(/([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/));
          if (anyStation) {
            const m = (anyStation.bluetoothAddress || anyStation.deviceName).match(/([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/);
            if (m) macAddress = m[0];
          }
        } catch (_) {}
      }

      if (macAddress && window.AndroidBluetooth.printImage) {
        try {
          const receiptNode = document.querySelector('#kot-print-area .receipt-print') || document.getElementById('kot-print-area');
          if (receiptNode) {
            const paperWidthDots = (settings.printFormat === '58mm' || activeStationGroup?.printer?.paperWidth === '58mm') ? 384 : 576;
            const canvas = await html2canvas(receiptNode, {
              scale: 2,
              backgroundColor: '#ffffff',
              useCORS: true,
              logging: false
            });
            const base64Png = canvas.toDataURL('image/png');
            const resStr = window.AndroidBluetooth.printImage(macAddress, base64Png, paperWidthDots);
            const res = JSON.parse(resStr || '{}');
            if (res.success) return;
            console.warn('[KOT] Direct Bluetooth print failed:', res.error);
          }
        } catch (e) {
          console.warn('[KOT] Error capturing KOT for Bluetooth print:', e);
        }
      }

      if (window.AndroidPrint && typeof window.AndroidPrint.print === 'function') {
        window.AndroidPrint.print();
      } else {
        window.print();
      }
    } else if (window.AndroidPrint && typeof window.AndroidPrint.print === 'function') {
      window.AndroidPrint.print();
    } else {
      window.print();
    }
  };

  // Print separate sub-slips for each kitchen station sequentially
  const handlePrintAllKitchens = async () => {
    if (stationGroups.length <= 1) {
      handlePrintCurrent();
      return;
    }

    setIsPrintingAll(true);
    for (let i = 0; i < stationGroups.length; i++) {
      const grp = stationGroups[i];
      setSelectedDept(grp.key);
      // Allow DOM to re-render with the station's items and title badge
      await new Promise(res => setTimeout(res, 280));

      if (window.electronAPI) {
        const receiptNode = document.querySelector('#kot-print-area .receipt-print');
        const htmlContent = receiptNode ? receiptNode.outerHTML : document.getElementById('kot-print-area').outerHTML;
        const isSilent = settings.silentPrinting !== false;

        const chosenPrinter = grp.printer?.deviceName || settings.kotPrinter || '';
        window.electronAPI.silentPrint(htmlContent, chosenPrinter, isSilent);
      } else if (window.AndroidBluetooth) {
        let chosenPrinter = grp.printer?.bluetoothAddress || grp.printer?.deviceName || settings.kotPrinter || settings.billingPrinter || '';
        let match = chosenPrinter.match(/([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/);
        if (!match) {
          try {
            const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
            const raw = s.kotPrinter || s.billingPrinter || '';
            match = raw.match(/([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/);
          } catch (_) {}
        }
        const macAddress = match ? match[0] : null;

        if (macAddress && window.AndroidBluetooth.printImage) {
          try {
            const receiptNode = document.querySelector('#kot-print-area .receipt-print') || document.getElementById('kot-print-area');
            if (receiptNode) {
              const paperWidthDots = (settings.printFormat === '58mm' || grp.printer?.paperWidth === '58mm') ? 384 : 576;
              const canvas = await html2canvas(receiptNode, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false
              });
              const base64Png = canvas.toDataURL('image/png');
              window.AndroidBluetooth.printImage(macAddress, base64Png, paperWidthDots);
            }
          } catch (e) {
            console.warn('[KOT] Multi-station Bluetooth print error:', e);
          }
        }
      } else {
        window.print();
      }
      await new Promise(res => setTimeout(res, 350));
    }
    setIsPrintingAll(false);
    setSelectedDept('ALL');
  };

  const getFormatClasses = () => {
    switch (settings.printFormat) {
      case 'A4': return 'w-full max-w-[320px] print:max-w-full';
      case '58mm': return 'w-[210px] print:w-full print:max-w-full print:m-0';
      case '80mm':
      default: return 'w-[280px] print:w-full print:max-w-full print:m-0';
    }
  };

  return (
    <div id="kot-print-area" className="invoice-container fixed inset-0 bg-black/40 backdrop-blur-md z-[1000] overflow-y-auto overflow-x-hidden animate-in fade-in duration-200 p-3 sm:p-4 print:p-0 print:block print:w-full print:h-full">
      <style>
        {`
          @media print {
            @page {
              size: ${settings.printFormat === 'A4' ? 'A4 portrait' : settings.printFormat === '58mm' ? '58mm auto portrait' : '80mm auto portrait'};
              margin: 0 !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .invoice-container {
              background: #ffffff !important;
              padding: 0 !important;
            }
            .receipt-print {
              margin: 0 auto !important;
              box-shadow: none !important;
              border: none !important;
            }
          }
        `}
      </style>

      {/* Top Floating Controls - Hidden on Print */}
      <div className="sticky top-2 flex flex-col items-center gap-2.5 print:hidden w-full max-w-2xl mx-auto z-30 px-3 py-2.5 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/50 mb-3">
        {/* Multi-Kitchen Station Filter Tabs */}
        {stationGroups.length > 1 && (
          <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setSelectedDept('ALL')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedDept === 'ALL'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}>
              <Layers size={13} />
              <span>{t("All Kitchens")} ({order.items?.length || 0})</span>
            </button>
            {stationGroups.map((grp) => {
              const isSelected = selectedDept === grp.key || selectedDept === grp.name;
              return (
                <button
                  key={grp.key}
                  type="button"
                  onClick={() => setSelectedDept(grp.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}>
                  <ChefHat size={13} />
                  <span>{grp.name}</span>
                  {grp.location && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {grp.location}
                    </span>
                  )}
                  <span>({grp.items.length})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Buttons Row */}
        <div className="flex items-center justify-center gap-2.5 w-full flex-wrap">
          {stationGroups.length > 1 && (
            <button
              onClick={handlePrintAllKitchens}
              disabled={isPrintingAll}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl transition-all shadow-md font-bold text-xs sm:text-sm active:scale-95 cursor-pointer disabled:opacity-50">
              <Printer size={15} />
              <span>{isPrintingAll ? t("Printing All...") : t("Print All Kitchens (Split Slips)")}</span>
            </button>
          )}

          <button
            onClick={handlePrintCurrent}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-xl transition-all shadow-md font-bold text-xs sm:text-sm active:scale-95 cursor-pointer">
            <Printer size={15} />
            <span>
              {stationGroups.length > 1 && selectedDept !== 'ALL' && activeStationGroup
                ? `Print KOT: ${activeStationGroup.name}${activeStationGroup.location ? ` (${activeStationGroup.location})` : ''}` 
                : t("Print KOT")}
            </span>
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all font-bold text-xs sm:text-sm active:scale-95 cursor-pointer">
            <ArrowLeft size={15} />
            <span>{t("Close")}</span>
          </button>
        </div>
      </div>

      {/* KOT Receipt Preview */}
      <div
        className={`receipt-print bg-white text-black mx-auto shadow-2xl print:shadow-none my-4 print:m-0 print:border-0 overflow-hidden ${getFormatClasses()}`}
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          color: '#000',
          fontWeight: 'normal',
          fontSize: '13px',
          lineHeight: '1.3',
          width: settings.printFormat === 'A4' ? '100%' : undefined,
          maxWidth: settings.printFormat === 'A4' ? '360px' : undefined
        }}>
        
        {settings.printFormat === '58mm' ? (
          /* 58mm Compact Clean KOT Slip Layout (Zomato Style) */
          <div style={{ padding: '6px 4px 14px 4px', boxSizing: 'border-box', width: '100%', fontSize: '11px', lineHeight: '1.25', color: '#000' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '3px' }}>
              <div style={{ fontSize: '10px' }}>
                {new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB')} {new Date(order.createdAt || Date.now()).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '1px' }}>
                {(() => {
                  const raw = (order.kotNumber || order.billNumber || '').toString().trim();
                  if (!raw) return 'KOT PREVIEW';
                  if (raw.toUpperCase().includes('UPDATE')) return raw;
                  if (raw.toUpperCase().startsWith('CANCEL')) {
                    const num = raw.replace(/^[A-Z]+-?/i, '');
                    return num ? `CANCEL KOT No: ${num}` : raw;
                  }
                  const num = raw.replace(/^KOT-?/i, '').trim();
                  return num ? `KOT No: ${num}` : raw;
                })()}
              </div>

              {/* Station badge */}
              {(() => {
                const stationToDisplay = activeStationGroup || (stationGroups.length === 1 && stationGroups[0].name !== 'Kitchen' ? stationGroups[0] : null);
                if (!stationToDisplay && selectedDept === 'ALL') return null;
                const title = stationToDisplay 
                  ? `${stationToDisplay.name.toUpperCase()}${stationToDisplay.location ? ` - ${stationToDisplay.location.toUpperCase()}` : ''}`
                  : selectedDept.toUpperCase();
                return (
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    padding: '2px 6px',
                    border: '1px solid #000',
                    display: 'inline-block',
                    marginTop: '2px',
                    marginBottom: '2px'
                  }}>
                    [ {title} ]
                  </div>
                );
              })()}

              {order.kotNumber && !order.kotNumber.toUpperCase().includes('UPDATE') && (
                <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
                  {t("Queue No:")} #{order.queueNumber || order.tokenNo || '1'}
                </div>
              )}

              {/* Order Type & Table */}
              {(() => {
                const bType = order.billType || order.orderType || (order.tableNo?.startsWith('DEL') ? 'Delivery' : (order.tableNo?.startsWith('TAK') ? 'Takeaway' : 'Dine In'));
                if (bType === 'Delivery') {
                  const partner = (order.orderSource || '').trim() || 'DIRECT';
                  return (
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#dc2626', marginTop: '1px' }}>
                      DELIVERY: {partner.toUpperCase()} #{order.tableNo}
                    </div>
                  );
                } else if (bType === 'Takeaway') {
                  return (
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#2563eb', marginTop: '1px' }}>
                      TAKEAWAY {order.tableNo ? `(${order.tableNo})` : ''}
                    </div>
                  );
                } else {
                  return (
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '1px' }}>
                      Dine In {order.tableNo ? `- Table ${order.tableNo}` : ''}
                    </div>
                  );
                }
              })()}
              {order.customerName && (
                <div style={{ fontSize: '10.5px', marginTop: '1px' }}>
                  Customer: {order.customerName} {order.customerPhone ? `(${order.customerPhone})` : ''}
                </div>
              )}
            </div>

            {/* Dashed Separator */}
            <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }}></div>

            {/* Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
              <span>{order.captainName ? `${t("Assign:")} ${order.captainName}` : `${t("Biller:")} ${order.cashierName || 'admin'}`}</span>
              {order.captainName && <span>{t("Captain:")} {order.captainName}</span>}
            </div>

            {/* Dashed Separator */}
            <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }}></div>

            {/* Items List (Compact Zomato KOT style) */}
            <div style={{ marginBottom: '4px' }}>
              {displayedItems && displayedItems.length > 0 ? (
                displayedItems.map((item, idx) => {
                  const isCancelled = item.status === 'Cancelled' || item.isCancelled;
                  const isReduced = !isCancelled && (item.reducedQuantity > 0);
                  const cancelCount = item.cancelledQuantity || item.quantity || 1;
                  return (
                    <div key={idx} style={{ marginBottom: '4px', paddingBottom: '3px', borderBottom: '1px dashed #e0e0e0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{
                          fontWeight: 'bold',
                          fontSize: '12.5px',
                          lineHeight: '1.2',
                          flex: 1,
                          paddingRight: '6px',
                          textAlign: 'left',
                          wordBreak: 'break-word',
                          textDecoration: isCancelled ? 'line-through' : 'none',
                          color: isCancelled ? '#dc2626' : '#000'
                        }}>
                          {item.name || 'Unknown Item'}
                          {isCancelled && <span style={{ fontSize: '10px', marginLeft: '4px', color: '#dc2626' }}>({t("CANCELLED")})</span>}
                          {isReduced && <span style={{ fontSize: '10px', marginLeft: '4px', color: '#ef4444' }}>(-{item.reducedQuantity}x)</span>}
                        </div>
                        <div style={{
                          fontWeight: '900',
                          fontSize: '14px',
                          flexShrink: 0,
                          textAlign: 'right',
                          textDecoration: isCancelled ? 'line-through' : 'none',
                          color: isCancelled ? '#dc2626' : '#000'
                        }}>
                          {isCancelled ? `-${cancelCount}` : `x${item.quantity || 0}`}
                        </div>
                      </div>
                      {item.specialNote && (
                        <div style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#dc2626', textAlign: 'left', marginTop: '1.5px' }}>
                          * {item.specialNote}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '6px 0', fontSize: '11px', color: '#666' }}>
                  {t("No items for this kitchen")}
                </div>
              )}
            </div>

            {/* Dashed Separator */}
            <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }}></div>

            {/* Total Qty Count */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold' }}>
              <span>{t("Total Items:")}</span>
              <span>{displayedItems?.reduce((acc, curr) => acc + (curr.quantity || 1), 0) || 0}</span>
            </div>
          </div>
        ) : (
          /* Existing 80mm and A4 layout - completely untouched! */
          <div style={{ padding: '0 8px', boxSizing: 'border-box' }}>
            
            {/* Header - Centered */}
          <div className="text-center mb-1" style={{ textAlign: 'center', marginBottom: '4px' }}>
            <div>
              {new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB').replace(/\//g, '/')} {new Date(order.createdAt || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </div>
            <div className="text-lg font-bold" style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {(() => {
                const raw = (order.kotNumber || order.billNumber || '').toString().trim();
                if (!raw) return 'KOT PREVIEW';
                if (raw.toUpperCase().includes('UPDATE')) return raw;
                if (raw.toUpperCase().startsWith('CANCEL')) {
                  const num = raw.replace(/^[A-Z]+-?/i, '');
                  return num ? `CANCEL KOT No: ${num}` : raw;
                }
                const num = raw.replace(/^KOT-?/i, '').trim();
                return num ? `KOT No: ${num}` : raw;
              })()}
            </div>

            {/* Kitchen Station Header Badge on Slip */}
            {(() => {
              const stationToDisplay = activeStationGroup || (stationGroups.length === 1 && stationGroups[0].name !== 'Kitchen' ? stationGroups[0] : null);
              if (!stationToDisplay && selectedDept === 'ALL') return null;
              const title = stationToDisplay 
                ? `${stationToDisplay.name.toUpperCase()}${stationToDisplay.location ? ` - ${stationToDisplay.location.toUpperCase()}` : ''}`
                : selectedDept.toUpperCase();
              return (
                <div style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  padding: '3px 10px',
                  border: '1.5px solid #000',
                  display: 'inline-block',
                  marginTop: '3px',
                  marginBottom: '3px',
                  letterSpacing: '0.5px'
                }}>
                  [ {title} ]
                </div>
              );
            })()}

            {order.kotNumber && !order.kotNumber.toUpperCase().includes('UPDATE') && (
              <div className="text-base font-bold text-gray-900" style={{ fontSize: '15px', fontWeight: 'bold', color: '#111827' }}>
                {t("Queue No:")} #{order.queueNumber || order.tokenNo || '1'}
              </div>
            )}

            {(() => {
              const bType = order.billType || order.orderType || (order.tableNo?.startsWith('DEL') ? 'Delivery' : (order.tableNo?.startsWith('TAK') ? 'Takeaway' : 'Dine In'));
              if (bType === 'Delivery') {
                const partner = (order.orderSource || '').trim() || 'DIRECT';
                return (
                  <>
                    <div className="text-lg font-black text-red-600 tracking-wider uppercase" style={{ fontSize: '18px', fontWeight: '900', color: '#dc2626' }}>
                      DELIVERY: {partner.toUpperCase()}
                    </div>
                    <div className="text-base font-bold" style={{ fontSize: '16px', fontWeight: 'bold' }}>
                      Order #{order.tableNo}
                    </div>
                  </>
                );
              } else if (bType === 'Takeaway') {
                return (
                  <div className="text-lg font-black text-blue-600 tracking-wider uppercase" style={{ fontSize: '18px', fontWeight: '900', color: '#2563eb' }}>
                    TAKEAWAY {order.tableNo ? `(${order.tableNo})` : ''}
                  </div>
                );
              } else {
                return (
                  <>
                    <div className="text-base font-bold" style={{ fontSize: '16px', fontWeight: 'bold' }}>Dine In</div>
                    {order.tableNo && <div className="text-base font-bold" style={{ fontSize: '16px', fontWeight: 'bold' }}>{t("Table No: ")}{order.tableNo}</div>}
                  </>
                );
              }
            })()}
            {order.customerName && (
              <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '2px' }}>
                Customer: {order.customerName} {order.customerPhone ? `(${order.customerPhone})` : ''}
              </div>
            )}
          </div>

          <div className="border-t-[1.5px] border-dashed border-black my-1" style={{ borderTop: '1.5px dashed black', margin: '4px 0' }}></div>

          {/* Info - Left aligned */}
          <div className="mb-1 text-left" style={{ marginBottom: '4px', textAlign: 'left' }}>
            {order.captainName && <div>{t("Assign to:")} {order.captainName}</div>}
            {order.captainName && <div>{t("Captain:")} {order.captainName}</div>}
            {!order.captainName && <div>{t("Biller:")} {order.cashierName || 'admin'}</div>}
          </div>
          
          <div className="border-t-[1.5px] border-dashed border-black my-1" style={{ borderTop: '1.5px dashed black', margin: '4px 0' }}></div>

          {/* Items Header - 3 Column Layout */}
          <div className="flex w-full mb-1 font-bold border-b border-black pb-1 text-xs sm:text-sm" style={{ display: 'flex', width: '100%', marginBottom: '4px', borderBottom: '1px solid black', paddingBottom: '2px', fontWeight: 'bold' }}>
            <div className="text-left pr-1" style={{ flex: '2 1 0%', textAlign: 'left', paddingRight: '4px' }}>{t("Item")}</div>
            <div className="text-center px-1" style={{ flex: '1.2 1 0%', textAlign: 'center', paddingLeft: '2px', paddingRight: '2px' }}>{t("Special Note")}</div>
            <div className="text-right shrink-0" style={{ width: '38px', textAlign: 'right', flexShrink: 0 }}>{t("Qty.")}</div>
          </div>

          {/* Items List */}
          <div className="mb-1" style={{ marginBottom: '4px' }}>
            {displayedItems && displayedItems.length > 0 ? (
              displayedItems.map((item, idx) => {
                const isCancelled = item.status === 'Cancelled' || item.isCancelled;
                const isReduced = !isCancelled && (item.reducedQuantity > 0);
                const cancelCount = item.cancelledQuantity || item.quantity || 1;
                return (
                  <div key={idx} className="flex flex-col w-full mb-1.5 pb-1 border-b border-dashed border-gray-200" style={{ width: '100%', marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px dashed #e5e7eb' }}>
                    <div className="flex w-full items-start justify-between" style={{ display: 'flex', width: '100%', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div className={`text-left pr-1 break-words font-bold ${isCancelled ? 'line-through text-red-600' : ''}`} style={{ flex: '2 1 0%', textAlign: 'left', wordBreak: 'break-word', paddingRight: '4px', textDecoration: isCancelled ? 'line-through' : 'none', color: isCancelled ? '#dc2626' : '#000', fontWeight: 'bold' }}>
                        {item.name || 'Unknown Item'}
                        {isCancelled && <span className="text-[10px] ml-1 font-black text-red-600" style={{ fontSize: '10px', marginLeft: '4px', color: '#dc2626', fontWeight: 'bold' }}>({t("CANCELLED")})</span>}
                        {isReduced && <span className="text-[10px] ml-1 font-black text-red-500" style={{ fontSize: '10px', marginLeft: '4px', color: '#ef4444', fontWeight: 'bold' }}>(-{item.reducedQuantity}x {t("Reduced")})</span>}
                      </div>
                      <div className="text-center px-1 break-words text-xs" style={{ flex: '1.2 1 0%', textAlign: 'center', wordBreak: 'break-word', paddingLeft: '2px', paddingRight: '2px', fontSize: '11px', color: item.specialNote ? '#dc2626' : '#9ca3af', fontWeight: item.specialNote ? 'bold' : 'normal' }}>
                        {item.specialNote ? item.specialNote : '-'}
                      </div>
                      <div className={`text-right font-black font-mono shrink-0 ${isCancelled ? 'line-through text-red-600' : ''}`} style={{ width: '38px', textAlign: 'right', flexShrink: 0, fontWeight: 'bold', textDecoration: isCancelled ? 'line-through' : 'none', color: isCancelled ? '#dc2626' : '#000' }}>
                        {isCancelled ? `-${cancelCount}` : (item.quantity || 0)}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-2 text-gray-500" style={{ textAlign: 'center', padding: '8px 0' }}>
                {t("No items for this kitchen")}
              </div>
            )}
          </div>
          
        </div>
        )}
      </div>
    </div>
  );
};

export default KOT;