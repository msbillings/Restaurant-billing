import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Printer, ArrowLeft, ChefHat, Layers, CheckCircle2, WifiOff, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { getApiUrl } from '../config';
import html2canvas from 'html2canvas-pro';
import { getReceiptFontMetrics, findReceiptFont } from '../utils/receiptFonts';
import { renderElementToESCPOSRaster, autoTrimCanvasBottom } from '../utils/escposRaster';

const KOT = ({ order, onClose }) => {
  const { t } = useLanguage();

  // ─── Settings – load synchronously from localStorage to avoid flash ──────
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('restaurantSettings');
      if (saved) return { restaurantName: 'msbillings', ...JSON.parse(saved) };
    } catch (_) { }
    return { restaurantName: 'msbillings' };
  });

  useEffect(() => {
    const updateLocalSettings = () => {
      try {
        const saved = localStorage.getItem('restaurantSettings');
        if (saved) setSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
      } catch (_) { }
    };
    updateLocalSettings();
    axios.get(`${getApiUrl()}/config/info`).then(res => {
      const incoming = res.data?.restaurantSettings || res.data;
      if (incoming && typeof incoming === 'object') {
        setSettings(prev => ({ ...prev, ...incoming }));
        try {
          const local = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
          localStorage.setItem('restaurantSettings', JSON.stringify({ ...local, ...incoming }));
        } catch (_) { }
      }
    }).catch(() => { });
    window.addEventListener('settingsUpdated', updateLocalSettings);
    return () => window.removeEventListener('settingsUpdated', updateLocalSettings);
  }, []);

  const matchedFontObj = findReceiptFont(settings.receiptFontFamily);
  const receiptFont = matchedFontObj.value;
  const fontMetrics = getReceiptFontMetrics(settings.receiptFontSize || 'medium', settings.printFormat);

  const [printerConfigs, setPrinterConfigs] = useState([]);
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [isPrintingAll, setIsPrintingAll] = useState(false);
  // ─── Print status for dynamic button feedback ─────────────────────────────
  // null | 'printing' | 'success' | 'failed' | 'not_connected'
  const [printStatus, setPrintStatus] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [toast, setToast] = useState(null);

  // ─── Pre-resolved BT MAC cache – computed once on mount, reused on every print
  const resolvedMacRef = useRef(null);
  const macResolvedRef = useRef(false);

  // Helper: show toast
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Helper: reset print status after delay
  const resetPrintStatus = useCallback((delay = 3500) => {
    setTimeout(() => {
      setPrintStatus(null);
      setIsPrinting(false);
    }, delay);
  }, []);

  useEffect(() => {
    // Fetch configured printers to link departments to printer hardware
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    axios.get(`${getApiUrl()}/printer-configs`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      setPrinterConfigs(res.data || []);
    }).catch(() => { });
  }, []);

  // Pre-resolve the Bluetooth MAC address once on mount so print is instant
  useEffect(() => {
    if (macResolvedRef.current || !window.AndroidBluetooth) return;
    macResolvedRef.current = true;

    const resolveMac = () => {
      const MAC_RE = /([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/;
      const tryMac = (raw) => { const m = (raw || '').match(MAC_RE); return m ? m[0] : null; };

      // 1. KOT-specific printer config
      try {
        const cached = JSON.parse(localStorage.getItem('msbillings_printer_configs') || '[]');
        const kotStation = cached.find(p =>
          p.isActive !== false &&
          (p.type === 'kot' || p.type === 'general' || p.type === 'both') &&
          tryMac(p.bluetoothAddress || p.deviceName || '')
        );
        if (kotStation) {
          const mac = tryMac(kotStation.bluetoothAddress || kotStation.deviceName || '');
          if (mac) { resolvedMacRef.current = mac; return; }
        }
      } catch (_) { }

      // 2. kotPrinter setting
      const s = settings;
      let mac = tryMac(s.kotPrinter || '');
      if (mac) { resolvedMacRef.current = mac; return; }

      // 3. billingPrinter setting (shared single printer)
      mac = tryMac(s.billingPrinter || '');
      if (mac) { resolvedMacRef.current = mac; return; }

      // 4. Any active BT printer
      try {
        const cached = JSON.parse(localStorage.getItem('msbillings_printer_configs') || '[]');
        const any = cached.find(p => p.isActive !== false && tryMac(p.bluetoothAddress || p.deviceName || ''));
        if (any) { resolvedMacRef.current = tryMac(any.bluetoothAddress || any.deviceName || ''); }
      } catch (_) { }
    };

    resolveMac();
  }, []);

  // ─── Auto-print on mount REMOVED ─────────────────────────────────────────
  // KOT only prints when user explicitly clicks Print KOT or Send to All Kitchens

  // Group items dynamically by Kitchen Station / Printer Config
  const stationGroups = useMemo(() => {
    if (!order?.items || !Array.isArray(order.items) || order.items.length === 0) {
      return [];
    }

    const activePrinters = (printerConfigs && printerConfigs.length > 0)
      ? printerConfigs.filter(p => p.isActive && (p.type === 'kot' || p.type === 'general' || p.type === 'both'))
      : (() => {
        try {
          const cached = JSON.parse(localStorage.getItem('msbillings_printer_configs') || '[]');
          return cached.filter(p => p.isActive !== false && (p.type === 'kot' || p.type === 'general' || p.type === 'both'));
        } catch (_) { return []; }
      })();

    const map = new Map();

    // Fallback general printer for unassigned items
    const fallbackPrinter = activePrinters.find(p => (!p.assignedCategories || p.assignedCategories.length === 0) && (!p.assignedItems || p.assignedItems.length === 0)) || activePrinters[0] || null;

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

      // If no specific printer matched and multiple printers exist, assign to fallback general printer
      if (!matchedPrinter && fallbackPrinter && activePrinters.length > 1) {
        matchedPrinter = fallbackPrinter;
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

  // ─── Print current active tab/kitchen ────────────────────────────────────
  const handlePrintCurrent = async () => {
    // Guard: block duplicate prints (user tapping multiple times)
    if (isPrinting || isPrintingAll) return;

    // When viewing "All Kitchens" and multiple station groups exist, automatically print to each station!
    if (selectedDept === 'ALL' && stationGroups.length > 1) {
      return handlePrintAllKitchens();
    }

    // ── IMMEDIATE UI FEEDBACK ── set state BEFORE any async work
    setIsPrinting(true);
    setPrintStatus('printing');

    // ⚡ CRITICAL: Allow React 19 to flush DOM and browser to paint the blue "Printing..." button immediately
    await new Promise(res => setTimeout(res, 80));

    try {
      if (window.electronAPI) {
        const receiptNode = document.querySelector('#kot-print-area .receipt-print');
        const htmlContent = receiptNode ? receiptNode.outerHTML : document.getElementById('kot-print-area').outerHTML;
        const isSilent = settings.silentPrinting !== false;
        let targetPrinter = settings.kotPrinter || '';
        const targetStation = activeStationGroup || (stationGroups.length > 0 ? stationGroups[0] : null);
        if (targetStation?.printer?.deviceName) targetPrinter = targetStation.printer.deviceName;
        window.electronAPI.silentPrint(htmlContent, targetPrinter, isSilent);
        setPrintStatus('success');
        showToast(t('KOT sent to printer!'), 'success');
        resetPrintStatus(3000);
        return;

      } else if (window.AndroidBluetooth) {
        const MAC_RE = /([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/;
        const tryMac = (raw) => { const m = (raw || '').match(MAC_RE); return m ? m[0] : null; };

        // Use pre-resolved MAC first (fastest path — no loops on every print)
        let macAddress = resolvedMacRef.current;

        // Station-specific override or first available station group (e.g. "All in One" when viewing ALL)
        const targetStation = activeStationGroup || (stationGroups.length > 0 ? stationGroups[0] : null);
        if (targetStation?.printer) {
          const stationMac = tryMac(targetStation.printer.bluetoothAddress || targetStation.printer.deviceName || '');
          if (stationMac) macAddress = stationMac;
        }

        // Last-resort live lookup if pre-resolve failed
        if (!macAddress) {
          try {
            const allConfigs = (printerConfigs && printerConfigs.length > 0)
              ? printerConfigs
              : JSON.parse(localStorage.getItem('msbillings_printer_configs') || '[]');
            const kotStation = allConfigs.find(p =>
              p.isActive !== false &&
              (p.type === 'kot' || p.type === 'general' || p.type === 'both') &&
              tryMac(p.bluetoothAddress || p.deviceName || '')
            );
            if (kotStation) macAddress = tryMac(kotStation.bluetoothAddress || kotStation.deviceName || '');
          } catch (_) { }
        }
        if (!macAddress) macAddress = tryMac(settings.kotPrinter || '') || tryMac(settings.billingPrinter || '');

        // ── CONNECTION CHECK: Show error immediately if no printer found
        if (!macAddress) {
          setPrintStatus('not_connected');
          showToast(t('Printer not connected. Please pair a Bluetooth printer in Printer & Kitchen Routing settings.'), 'error');
          resetPrintStatus(4000);
          return;
        }

        if (window.AndroidBluetooth.printImage) {
          try {
            const receiptNode = document.querySelector('#kot-receipt-slip') || document.querySelector('.receipt-print');
            if (receiptNode) {
              const paperWidthDots = (settings.printFormat === '58mm' || targetStation?.printer?.paperWidth === '58mm') ? 384 : 576;
              const canvas = await html2canvas(receiptNode, {
                scale: 1.5,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                imageTimeout: 0,
                onclone: (clonedDoc) => {
                  const receipt = clonedDoc.querySelector('.receipt-print') || clonedDoc.querySelector('#kot-receipt-slip');
                  if (receipt) {
                    receipt.style.boxShadow = 'none';
                    receipt.style.filter = 'none';
                    receipt.style.backgroundColor = '#ffffff';
                    receipt.style.color = '#000000';
                  }
                }
              });
              const trimmedCanvas = autoTrimCanvasBottom(canvas);
              const base64Png = trimmedCanvas.toDataURL('image/png', 0.95);
              // Yield a brief moment so UI remains fluid before native bridge
              await new Promise(res => setTimeout(res, 20));
              const resStr = window.AndroidBluetooth.printImage(macAddress, base64Png, paperWidthDots);
              const res = JSON.parse(resStr || '{}');
              if (res.success) {
                setPrintStatus('success');
                showToast(t('KOT printed successfully!'), 'success');
                resetPrintStatus(3000);
                return;
              } else {
                const errMsg = res.error || 'Bluetooth print failed';
                if (errMsg.toLowerCase().includes('connect') || errMsg.toLowerCase().includes('socket')) {
                  setPrintStatus('not_connected');
                  showToast(t('Printer not connected. Please check Bluetooth connection.'), 'error');
                } else {
                  setPrintStatus('failed');
                  showToast(`${t('KOT print failed')}: ${errMsg}`, 'error');
                }
                resetPrintStatus(4000);
                return;
              }
            }
          } catch (e) {
            setPrintStatus('failed');
            showToast(`${t('KOT print error')}: ${e.message || 'Unknown error'}`, 'error');
            resetPrintStatus(4000);
            return;
          }
        }

        // Fallback to system print
        if (window.AndroidPrint && typeof window.AndroidPrint.print === 'function') {
          window.AndroidPrint.print();
          setPrintStatus('success');
          showToast(t('KOT sent to system printer!'), 'success');
        } else {
          window.print();
          setPrintStatus('success');
        }
        resetPrintStatus(3000);

      } else if (window.AndroidPrint && typeof window.AndroidPrint.print === 'function') {
        window.AndroidPrint.print();
        setPrintStatus('success');
        showToast(t('KOT sent to system printer!'), 'success');
        resetPrintStatus(3000);

      } else {
        // Direct Backend KOT Printer (TCP ESC/POS or USB RAW via Node.js Backend)
        try {
          const cached = (printerConfigs && printerConfigs.length > 0)
            ? printerConfigs
            : JSON.parse(localStorage.getItem('msbillings_printer_configs') || '[]');

          let targetPrinters = [];
          if (activeStationGroup?.printer && (activeStationGroup.printer.connectionType === 'network' || activeStationGroup.printer.connectionType === 'usb' || activeStationGroup.printer.connectionType === 'bluetooth')) {
            targetPrinters = [activeStationGroup.printer];
          } else {
            targetPrinters = cached.filter(c => c.isActive && (c.type === 'kot' || c.type === 'general' || c.type === 'both') && (c.connectionType === 'network' || c.connectionType === 'usb' || c.connectionType === 'bluetooth'));
          }

          if (targetPrinters.length > 0) {
            let anySuccess = false;
            for (const targetBackendPrinter of targetPrinters) {
              // Render exact UI from screen to 1-bit ESC/POS raster bit image
              let rasterBufferBase64 = null;
              try {
                const kotNode = document.querySelector('#kot-receipt-slip') || document.querySelector('.receipt-print');
                if (kotNode) {
                  const dots = (targetBackendPrinter.paperWidth === '58mm' || settings.printFormat === '58mm') ? 384 : 576;
                  rasterBufferBase64 = await renderElementToESCPOSRaster(kotNode, dots);
                }
              } catch (renderErr) {
                console.warn('[KOT] Raster render error, falling back to text ESC/POS:', renderErr);
              }

              const itemsToPrint = displayedItems && displayedItems.length > 0 ? displayedItems : (order?.items || []);
              const kotNo = order?.kotNumber || (order?.kots && order.kots[order.kots.length - 1]?.kotNumber) || 'KOT-1';
              const qNo = order?.tokenNo || order?.queueNumber || order?.tokenNumber || '1';
              try {
                const response = await axios.post(`${getApiUrl()}/printer-configs/print-kot`, {
                  bill: order,
                  items: itemsToPrint,
                  kotNumber: kotNo,
                  queueNumber: qNo,
                  printerId: targetBackendPrinter._id,
                  rasterBufferBase64
                }, { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('token')}` } });
                if (response.data && response.data.success) {
                  anySuccess = true;
                }
              } catch (singleErr) {
                console.warn(`[KOT] Print error on ${targetBackendPrinter.name}:`, singleErr.message);
              }
            }

            if (anySuccess) {
              setPrintStatus('success');
              showToast(t('KOT sent to printer(s)!'), 'success');
              resetPrintStatus(3000);
              return;
            } else {
              setPrintStatus('failed');
              showToast(t('Printer did not respond. Opening browser print...'), 'warning');
            }
          }
        } catch (netErr) {
          const errMsg = netErr.response?.data?.message || netErr.message || 'Printer offline';
          setPrintStatus('failed');
          showToast(`${t('Network print failed')}: ${errMsg}. ${t('Opening browser print...')}`, 'warning');
        }
        window.print();
        resetPrintStatus(3000);
      }
    } catch (unexpectedErr) {
      setPrintStatus('failed');
      showToast(`${t('Print error')}: ${unexpectedErr.message || 'Unknown error'}`, 'error');
      resetPrintStatus(4000);
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
        const receiptNode = document.querySelector('#kot-receipt-slip') || document.querySelector('.receipt-print');
        const htmlContent = receiptNode ? receiptNode.outerHTML : '';
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
          } catch (_) { }
        }
        const macAddress = match ? match[0] : null;

        if (macAddress && window.AndroidBluetooth.printImage) {
          try {
            const receiptNode = document.querySelector('#kot-receipt-slip') || document.querySelector('.receipt-print');
            if (receiptNode) {
              const paperWidthDots = (settings.printFormat === '58mm' || grp.printer?.paperWidth === '58mm') ? 384 : 576;
              const canvas = await html2canvas(receiptNode, {
                scale: 1.5,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                imageTimeout: 0,
                onclone: (clonedDoc) => {
                  const receipt = clonedDoc.querySelector('.receipt-print');
                  if (receipt) {
                    receipt.style.boxShadow = 'none';
                    receipt.style.filter = 'none';
                    receipt.style.backgroundColor = '#ffffff';
                    receipt.style.color = '#000000';
                  }
                }
              });
              const trimmedCanvas = autoTrimCanvasBottom(canvas);
              const base64Png = trimmedCanvas.toDataURL('image/png', 0.95);
              await new Promise(res => setTimeout(res, 20));
              window.AndroidBluetooth.printImage(macAddress, base64Png, paperWidthDots);
            }
          } catch (e) {
            console.warn('[KOT] Multi-station Bluetooth print error:', e);
          }
        }
      } else if (grp.printer && (grp.printer.connectionType === 'network' || grp.printer.connectionType === 'usb' || grp.printer.connectionType === 'bluetooth')) {
        try {
          let rasterBufferBase64 = null;
          try {
            const kotNode = document.querySelector('#kot-receipt-slip') || document.querySelector('.receipt-print');
            if (kotNode) {
              const dots = (grp.printer.paperWidth === '58mm' || settings.printFormat === '58mm') ? 384 : 576;
              rasterBufferBase64 = await renderElementToESCPOSRaster(kotNode, dots);
            }
          } catch (e) { }

          const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
          const kotNo = order?.kotNumber || (order?.kots && order.kots[order.kots.length - 1]?.kotNumber) || 'KOT-1';
          const qNo = order?.tokenNo || order?.queueNumber || order?.tokenNumber || '1';
          await axios.post(`${getApiUrl()}/printer-configs/print-kot`, {
            bill: order,
            items: grp.items,
            kotNumber: kotNo,
            queueNumber: qNo,
            printerId: grp.printer._id,
            rasterBufferBase64
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (netErr) {
          console.warn('[KOT] Multi-station network print error:', netErr);
          window.print();
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
    <div className="invoice-container fixed inset-0 bg-black/40 backdrop-blur-md z-[1000] overflow-y-auto overflow-x-hidden animate-in fade-in duration-200 p-3 sm:p-4 print:p-0 print:block print:w-full print:h-full">
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
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${selectedDept === 'ALL'
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${isSelected
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                    }`}>
                  <ChefHat size={13} />
                  <span>{grp.name}</span>
                  {grp.location && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
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

          {/* Dynamic Print Button — shows instant status feedback */}
          <button
            onClick={handlePrintCurrent}
            disabled={isPrinting}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-white rounded-xl transition-colors duration-100 shadow-md font-bold text-xs sm:text-sm active:scale-95 cursor-pointer min-w-[130px] justify-center ${printStatus === 'success'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : printStatus === 'failed'
                  ? 'bg-red-600 hover:bg-red-700'
                  : printStatus === 'not_connected'
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : printStatus === 'printing'
                      ? 'bg-blue-600 opacity-90 cursor-not-allowed'
                      : 'bg-gray-900 hover:bg-black'
              }`}>
            {printStatus === 'printing' && (
              <svg className="animate-spin shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
            )}
            {printStatus === 'success' && <CheckCircle2 size={15} className="shrink-0" />}
            {printStatus === 'failed' && <AlertCircle size={15} className="shrink-0" />}
            {printStatus === 'not_connected' && <WifiOff size={15} className="shrink-0" />}
            {!printStatus && <Printer size={15} className="shrink-0" />}
            <span>
              {printStatus === 'printing' ? t('Printing...')
                : printStatus === 'success' ? t('Printed! ✓')
                  : printStatus === 'failed' ? t('Print Failed')
                    : printStatus === 'not_connected' ? t('Not Connected')
                      : stationGroups.length > 1 && selectedDept !== 'ALL' && activeStationGroup
                        ? `Print KOT: ${activeStationGroup.name}${activeStationGroup.location ? ` (${activeStationGroup.location})` : ''}`
                        : t('Print KOT')}
            </span>
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors duration-100 font-bold text-xs sm:text-sm active:scale-95 cursor-pointer">
            <ArrowLeft size={15} />
            <span>{t("Close")}</span>
          </button>
        </div>

        {/* Toast Notification */}
        {toast && (
          <div className={`w-full mt-1 px-3 py-2 rounded-xl text-xs font-bold text-center transition-all ${toast.type === 'success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : toast.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200'
                : toast.type === 'warning' ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
            }`}>
            {toast.message}
          </div>
        )}
      </div>

      {/* KOT Receipt Preview */}
      <div
        id="kot-receipt-slip"
        className={`receipt-print bg-white text-black mx-auto shadow-md border border-gray-200 print:shadow-none my-1 pb-1 print:m-0 print:border-0 overflow-hidden ${getFormatClasses()}`}
        style={{
          fontFamily: receiptFont,
          ...(matchedFontObj?.previewStyle || {}),
          color: '#000000',
          backgroundColor: '#ffffff',
          fontWeight: 'normal',
          fontSize: fontMetrics.bodySize,
          lineHeight: fontMetrics.lineHeight,
          width: settings.printFormat === 'A4' ? '100%' : undefined,
          maxWidth: settings.printFormat === 'A4' ? '360px' : undefined
        }}>

        {settings.printFormat === '58mm' ? (
          /* 58mm Compact Clean KOT Slip Layout (Zomato Style) */
          <div style={{ padding: '4px 4px 2px 4px', boxSizing: 'border-box', width: '100%', fontFamily: receiptFont, fontSize: fontMetrics.bodySize, lineHeight: fontMetrics.lineHeight, color: '#000' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '3px' }}>
              <div style={{ fontSize: fontMetrics.detailSize }}>
                {new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB')} {new Date(order.createdAt || Date.now()).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </div>
              <div style={{ fontSize: fontMetrics.headingSize, fontWeight: 'bold', marginTop: '1px' }}>
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
                    fontSize: fontMetrics.detailSize,
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

              {/* Single Row: Queue No & Order Type */}
              {(() => {
                const bType = order.billType || order.orderType || (order.tableNo?.startsWith('DEL') ? 'Delivery' : (order.tableNo?.startsWith('TAK') ? 'Takeaway' : 'Dine In'));
                const partner = (order.orderSource || '').trim();
                const typeText = bType === 'Delivery' ? `DELIVERY${partner ? `: ${partner.toUpperCase()}` : ''}` : (bType === 'Takeaway' ? 'TAKEAWAY' : 'Dine In');
                const typeColor = bType === 'Delivery' ? '#dc2626' : (bType === 'Takeaway' ? '#2563eb' : '#000');
                const qNo = order.queueNumber || order.tokenNo || '1';

                return (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: fontMetrics.subHeadingSize,
                    fontWeight: 'bold',
                    marginTop: '2px',
                    marginBottom: '2px'
                  }}>
                    <span>{t("Queue No:")} #{qNo}</span>
                    <span style={{ color: typeColor }}>{typeText}</span>
                  </div>
                );
              })()}

              {/* Table No Centered */}
              {(() => {
                const bType = order.billType || order.orderType || (order.tableNo?.startsWith('DEL') ? 'Delivery' : (order.tableNo?.startsWith('TAK') ? 'Takeaway' : 'Dine In'));
                let tNo = (order.tableNo || '').trim();
                if (bType === 'Delivery') {
                  return <div style={{ fontSize: fontMetrics.subHeadingSize, fontWeight: 'bold' }}>Order #{order.tableNo || 'DEL'}</div>;
                } else if (bType === 'Takeaway') {
                  return order.tableNo ? <div style={{ fontSize: fontMetrics.subHeadingSize, fontWeight: 'bold' }}>Order #{order.tableNo}</div> : null;
                } else {
                  const cleanT = tNo.replace(/^Table\s*/i, '');
                  return <div style={{ fontSize: fontMetrics.subHeadingSize, fontWeight: 'bold' }}>{t("Table No: ")}{cleanT ? (tNo.includes('Table') ? tNo : `Table ${cleanT}`) : 'Table'}</div>;
                }
              })()}
              {order.customerName && (
                <div style={{ fontSize: fontMetrics.detailSize, marginTop: '1px' }}>
                  Customer: {order.customerName} {order.customerPhone ? `(${order.customerPhone})` : ''}
                </div>
              )}
            </div>

            {/* Dashed Separator */}
            <div style={{ borderTop: '1px dashed #444', margin: '7px 0', width: '100%', height: '1px', clear: 'both' }}></div>

            {/* Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: fontMetrics.detailSize }}>
              <span>{order.captainName ? `${t("Assign:")} ${order.captainName}` : `${t("Biller:")} ${order.cashierName || 'admin'}`}</span>
              {order.captainName && <span>{t("Captain:")} {order.captainName}</span>}
            </div>

            {/* Dashed Separator */}
            <div style={{ borderTop: '1px dashed #444', margin: '7px 0', width: '100%', height: '1px', clear: 'both' }}></div>

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
                          fontSize: fontMetrics.itemSize,
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
                          fontSize: fontMetrics.headingSize,
                          flexShrink: 0,
                          textAlign: 'right',
                          textDecoration: isCancelled ? 'line-through' : 'none',
                          color: isCancelled ? '#dc2626' : '#000'
                        }}>
                          {isCancelled ? `-${cancelCount}` : `x${item.quantity || 0}`}
                        </div>
                      </div>
                      {item.specialNote && (
                        <div style={{ fontSize: fontMetrics.detailSize, fontWeight: 'bold', color: '#dc2626', textAlign: 'left', marginTop: '1.5px' }}>
                          * {item.specialNote}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '6px 0', fontSize: fontMetrics.detailSize, color: '#666' }}>
                  {t("No items for this kitchen")}
                </div>
              )}
            </div>

            {/* Dashed Separator */}
            <div style={{ borderTop: '1px dashed #444', margin: '7px 0', width: '100%', height: '1px', clear: 'both' }}></div>

            {/* Total Qty Count */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: fontMetrics.bodySize, fontWeight: 'bold' }}>
              <span>{t("Total Items:")}</span>
              <span>{displayedItems?.reduce((acc, curr) => acc + (curr.quantity || 1), 0) || 0}</span>
            </div>
          </div>
        ) : (
          /* Existing 80mm and A4 layout - completely untouched! */
          <div style={{
            padding: '0 8px',
            boxSizing: 'border-box',
            fontFamily: receiptFont,
            ...(matchedFontObj?.previewStyle || {}),
            fontSize: fontMetrics.bodySize,
            lineHeight: fontMetrics.lineHeight,
            color: '#000000'
          }}>

            {/* Header - Centered */}
            <div className="text-center mb-1" style={{ textAlign: 'center', marginBottom: '4px' }}>
              <div>
                {new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB').replace(/\//g, '/')} {new Date(order.createdAt || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </div>
              <div className="font-bold" style={{ fontSize: fontMetrics.headingSize, fontWeight: 'bold' }}>
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
                    fontSize: fontMetrics.detailSize,
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

              {/* Single Row: Queue Number and Dine In / Delivery / Takeaway */}
              {(() => {
                const bType = order.billType || order.orderType || (order.tableNo?.startsWith('DEL') ? 'Delivery' : (order.tableNo?.startsWith('TAK') ? 'Takeaway' : 'Dine In'));
                const partner = (order.orderSource || '').trim();
                const typeText = bType === 'Delivery'
                  ? `DELIVERY${partner ? `: ${partner.toUpperCase()}` : ''}`
                  : (bType === 'Takeaway' ? 'TAKEAWAY' : 'Dine In');
                const typeColor = bType === 'Delivery' ? '#dc2626' : (bType === 'Takeaway' ? '#2563eb' : '#111827');
                const qNo = order.queueNumber || order.tokenNo || '1';

                return (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: fontMetrics.subHeadingSize,
                    fontWeight: 'bold',
                    marginTop: '3px',
                    marginBottom: '3px'
                  }}>
                    <span>{t("Queue No:")} #{qNo}</span>
                    <span style={{ color: typeColor }}>{typeText}</span>
                  </div>
                );
              })()}

              {/* Table Number Line (Centered) */}
              {(() => {
                const bType = order.billType || order.orderType || (order.tableNo?.startsWith('DEL') ? 'Delivery' : (order.tableNo?.startsWith('TAK') ? 'Takeaway' : 'Dine In'));
                let tNo = (order.tableNo || '').trim();
                if (bType === 'Delivery') {
                  return <div style={{ fontSize: fontMetrics.subHeadingSize, fontWeight: 'bold' }}>Order #{order.tableNo || 'DEL'}</div>;
                } else if (bType === 'Takeaway') {
                  return order.tableNo ? <div style={{ fontSize: fontMetrics.subHeadingSize, fontWeight: 'bold' }}>Order #{order.tableNo}</div> : null;
                } else {
                  const cleanT = tNo.replace(/^Table\s*/i, '');
                  return <div style={{ fontSize: fontMetrics.subHeadingSize, fontWeight: 'bold' }}>{t("Table No: ")}{cleanT ? (tNo.includes('Table') ? tNo : `Table ${cleanT}`) : 'Table'}</div>;
                }
              })()}

              {order.customerName && (
                <div style={{ fontSize: fontMetrics.detailSize, fontWeight: 'bold', marginTop: '2px' }}>
                  Customer: {order.customerName} {order.customerPhone ? `(${order.customerPhone})` : ''}
                </div>
              )}
            </div>

            <div className="border-t-[1.5px] border-dashed border-black my-1" style={{ borderTop: '1.5px dashed black', margin: '4px 0' }}></div>

            {/* Info - Left aligned */}
            <div className="mb-1 text-left" style={{ marginBottom: '4px', textAlign: 'left', fontSize: fontMetrics.detailSize, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>{t("Biller:")} {order.cashierName || order.billerName || 'admin'}</div>
              {order.captainName && <div>{t("Assign to:")} {order.captainName}</div>}
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
                          {isCancelled && <span className="ml-1 font-black text-red-600" style={{ fontSize: fontMetrics.detailSize, marginLeft: '4px', color: '#dc2626', fontWeight: 'bold' }}>({t("CANCELLED")})</span>}
                          {isReduced && <span className="ml-1 font-black text-red-500" style={{ fontSize: fontMetrics.detailSize, marginLeft: '4px', color: '#ef4444', fontWeight: 'bold' }}>(-{item.reducedQuantity}x {t("Reduced")})</span>}
                        </div>
                        <div className="text-center px-1 break-words" style={{ flex: '1.2 1 0%', textAlign: 'center', wordBreak: 'break-word', paddingLeft: '2px', paddingRight: '2px', fontSize: fontMetrics.detailSize, color: item.specialNote ? '#dc2626' : '#9ca3af', fontWeight: item.specialNote ? 'bold' : 'normal' }}>
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