import api from '../api/axios';
import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import React, { useState, useEffect } from 'react';
import { getOpenOrders, mergeTableOrders, apiGenerateKOT } from '../api/billing';
import { cacheFloors, getCachedFloors, getCachedOpenOrders } from '../db/offlineDb';
import { getMenuItems } from '../api/menu';
import { Plus, Coffee, Home, Trash2, Sofa, Utensils, CheckCircle, Clock, RefreshCw, Printer, Eye, Edit2, X, Receipt, Image as ImageIcon, Ban } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { io } from 'socket.io-client';
import Toast from './Toast';
import Invoice from './Invoice';

const formatImageUrl = (url) => {
  if (!url) return '';
  let trimmed = url.trim();

  if (trimmed.includes('google.com/imgres') || trimmed.includes('imgurl=')) {
    try {
      const urlObj = new URL(trimmed);
      const extracted = urlObj.searchParams.get('imgurl');
      if (extracted) trimmed = extracted;
    } catch (e) {
      const match = trimmed.match(/[?&]imgurl=([^&]+)/);
      if (match && match[1]) trimmed = decodeURIComponent(match[1]);
    }
  } else if (trimmed.includes('mediaurl=')) {
    try {
      const urlObj = new URL(trimmed);
      const extracted = urlObj.searchParams.get('mediaurl');
      if (extracted) trimmed = extracted;
    } catch (e) {}
  }

  if (trimmed.startsWith('data:image/') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return trimmed;
  }
  if (/^[A-Za-z0-9+/=]{30,}$/.test(trimmed) || trimmed.startsWith('iVBOR') || trimmed.startsWith('/9j/') || trimmed.startsWith('R0lGOD') || trimmed.startsWith('UklGR')) {
    let mime = 'jpeg';
    if (trimmed.startsWith('iVBOR')) mime = 'png';
    else if (trimmed.startsWith('R0lGOD')) mime = 'gif';
    else if (trimmed.startsWith('UklGR')) mime = 'webp';
    return `data:image/${mime};base64,${trimmed}`;
  }
  return trimmed;
};

const normalizeTable = (tbl) => {
  if (!tbl) return '';
  return tbl.trim().replace(/[^a-z0-9]/gi, '').toLowerCase();
};

const FloorManagement = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [promptModal, setPromptModal] = useState({ isOpen: false, title: '', placeholder: '', onConfirm: null });
  const [promptInput, setPromptInput] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [mergeModal, setMergeModal] = useState({ isOpen: false, targetSpace: '', sourceSpaces: [] });
  const [addSpaceModal, setAddSpaceModal] = useState({ isOpen: false, name: '', type: 'Table' });
  const [renameSpaceModal, setRenameSpaceModal] = useState({ isOpen: false, id: null, type: '', name: '' });
  const [merging, setMerging] = useState(false);
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [selectedBillForPrint, setSelectedBillForPrint] = useState(null);
  const [selectedOrderForView, setSelectedOrderForView] = useState(null);
  const [menuImagesMap, setMenuImagesMap] = useState({});

  const currencySymbol = localStorage.getItem('primaryCurrency') === 'USD' ? '$' : '₹';

  const fetchMenuItemsMap = async () => {
    try {
      const items = await getMenuItems();
      const map = {};
      (items || []).forEach(i => {
        if (i.name) {
          const key = i.name.trim().toLowerCase();
          if (i.image) map[key] = i.image;
        }
      });
      setMenuImagesMap(map);
    } catch (e) {
      console.error('Error fetching menu items for overview modal:', e);
    }
  };

  const [floors, setFloors] = useState(() => {
    const saved = localStorage.getItem('msbillings_spaces');
    if (saved) {
      let parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) {
        parsed = [{
          id: 'f-default',
          name: t('Ground Floor'),
          tables: parsed.tables || [],
          cabins: parsed.cabins || [],
          sofas: parsed.sofas || []
        }];
      }
      return parsed;
    }
    return [{
      id: 'f-1',
      name: 'Ground Floor',
      tables: [{ id: 't1', name: 'Table 1', type: 'table' }, { id: 't2', name: 'Table 2', type: 'table' }, { id: 't3', name: 'Table 3', type: 'table' }],
      cabins: [{ id: 'c1', name: 'Cabin 1', type: 'cabin' }, { id: 'c2', name: 'Cabin 2', type: 'cabin' }],
      sofas: [{ id: 's1', name: 'Sofa 1', type: 'sofa' }]
    }];
  });

  const floorsRef = React.useRef(floors);
  useEffect(() => {
    floorsRef.current = floors;
  }, [floors]);

  const [activeFloorId, setActiveFloorId] = useState(() => floors[0]?.id || null);

  const saveSpacesToCloud = async (newFloors) => {
    localStorage.setItem('msbillings_spaces', JSON.stringify(newFloors));
    try {
      await cacheFloors(newFloors);
      await api.post('/floors', { spaces: newFloors });
    } catch (e) {
      console.error('Failed to save floors to cloud database', e);
    }
  };

  useEffect(() => {
    localStorage.setItem('msbillings_spaces', JSON.stringify(floors));
  }, [floors]);

  useEffect(() => {
    // 1. Instant Cache Load (0ms delay)
    getCachedOpenOrders().then((cached) => {
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setOrders(cached);
        setLoading(false);
      }
    }).catch(() => {});

    getCachedFloors().then((cachedFloors) => {
      if (cachedFloors && Array.isArray(cachedFloors) && cachedFloors.length > 0) {
        setFloors(cachedFloors);
      }
    }).catch(() => {});

    // 2. Background Revalidation
    fetchOrders();
    syncSpaces();
    fetchMenuItemsMap();
    const interval = setInterval(() => {
      fetchOrders();
      syncSpaces();
    }, 10000);

    const handleSpacesUpdated = (event) => {
      if (event.detail && Array.isArray(event.detail)) {
        setFloors(event.detail);
        localStorage.setItem('msbillings_spaces', JSON.stringify(event.detail));
      }
    };
    window.addEventListener('spacesUpdated', handleSpacesUpdated);

    // Socket.io Real-Time Connection
    const API_BASE_URL = getApiUrl();
    const socketUrl = API_BASE_URL.replace('/api', '');
    const socket = io(socketUrl);
    const tenantDb = localStorage.getItem('resto_db_name');
    const token = localStorage.getItem('accessToken');
    if (tenantDb) {
      socket.emit('joinTenant', { tenantDb, token });
    }
    socket.on('orderUpdated', () => {
      fetchOrders();
      syncSpaces(); // Sync table status
    });
    socket.on('tableTransferred', () => {
      fetchOrders();
      syncSpaces();
    });
    socket.on('billSettled', () => {
      fetchOrders();
      syncSpaces();
    });
    socket.on('tableStatusChanged', () => {
      fetchOrders();
      syncSpaces(); // Update the UI instantly when DB changes
    });
    socket.on('spacesUpdated', (newFloors) => {
      setFloors(newFloors);
      localStorage.setItem('msbillings_spaces', JSON.stringify(newFloors));
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('spacesUpdated', handleSpacesUpdated);
      socket.disconnect();
    };
  }, []);

  async function syncSpaces() {
    try {
      const res = await api.get('/floors');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        localStorage.setItem('msbillings_spaces', JSON.stringify(res.data));
        await cacheFloors(res.data);
        setFloors(res.data);
      }
    } catch (e) {
      console.error('Failed to sync spaces from cloud database', e);
    }
  };

  async function fetchOrders() {
    try {
      const data = await getOpenOrders();
      setOrders(data);
    } catch (error) {
      console.error('Error fetching open orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFloor = () => {
    setPromptInput('');
    setPromptModal({
      isOpen: true,
      title: 'Add New Floor',
      placeholder: 'Enter new floor name (e.g., First Floor)',
      onConfirm: (name) => {
        if (name && name.trim() !== '') {
          const newFloorId = Date.now().toString();
          const next = [...floorsRef.current, { id: newFloorId, name: name.trim(), tables: [], cabins: [], sofas: [] }];
          setFloors(next);
          saveSpacesToCloud(next);
          setActiveFloorId(newFloorId);
          setToast({ message: 'Floor added successfully!', type: 'success' });
        }
      }
    });
  };

  const handleRemoveFloor = (e, id) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: 'Remove Floor',
      message: 'Are you sure you want to completely remove this floor and all its tables?',
      onConfirm: () => {
        const nextFloors = floorsRef.current.filter((f) => f.id !== id);
        setFloors(nextFloors);
        if (activeFloorId === id) {
          setActiveFloorId(nextFloors[0]?.id || null);
        }
        saveSpacesToCloud(nextFloors);
      }
    });
  };

  const handleAddSpace = () => {
    if (!activeFloorId) return;
    setAddSpaceModal({ isOpen: true, name: '', type: 'Table' });
  };

  const submitAddSpace = () => {
    const { name, type } = addSpaceModal;
    if (name && name.trim() !== '' && type && type.trim() !== '') {
      const next = floorsRef.current.map((floor) => {
        if (floor.id === activeFloorId) {
          return {
            ...floor,
            spaces: [...(floor.spaces || []), { id: Date.now().toString(), name: name.trim(), type: type.trim() }]
          };
        }
        return floor;
      });
      setFloors(next);
      saveSpacesToCloud(next);
      setAddSpaceModal({ isOpen: false, name: '', type: 'Table' });
      setToast({ message: `${type} added successfully!`, type: 'success' });
    }
  };

  const handleRemoveSpace = (e, type, id) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: `Remove ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      message: `Are you sure you want to remove this ${type}?`,
      onConfirm: () => {
        const next = floorsRef.current.map((floor) => {
          if (floor.id === activeFloorId) {
            const key = type + 's';
            const newFloor = { ...floor };
            if (newFloor[key]) {
              newFloor[key] = newFloor[key].filter((item) => item.id !== id);
            }
            if (newFloor.spaces) {
              newFloor.spaces = newFloor.spaces.filter((item) => item.id !== id);
            }
            return newFloor;
          }
          return floor;
        });
        setFloors(next);
        saveSpacesToCloud(next);
      }
    });
  };

  const handleRenameClick = (e, type, id, currentName) => {
    e.stopPropagation();
    setRenameSpaceModal({ isOpen: true, id, type, name: currentName });
  };

  const submitRenameSpace = () => {
    const { id, type, name } = renameSpaceModal;
    if (name && name.trim() !== '') {
      const next = floorsRef.current.map((floor) => {
        if (floor.id === activeFloorId) {
          const key = type + 's';
          const newFloor = { ...floor };
          if (newFloor[key]) {
            newFloor[key] = newFloor[key].map((item) => item.id === id ? { ...item, name: name.trim() } : item);
          }
          if (newFloor.spaces) {
            newFloor.spaces = newFloor.spaces.map((item) => item.id === id ? { ...item, name: name.trim() } : item);
          }
          return newFloor;
        }
        return floor;
      });
      setFloors(next);
      saveSpacesToCloud(next);
      setRenameSpaceModal({ isOpen: false, id: null, type: '', name: '' });
      setToast({ message: `${type} renamed successfully!`, type: 'success' });
    }
  };

  const handleRemoveSpaceCategory = (e, typeName) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: `Remove ${typeName} Category`,
      message: `Are you sure you want to delete ALL spaces inside the ${typeName} category?`,
      onConfirm: () => {
        const next = floorsRef.current.map((floor) => {
          if (floor.id === activeFloorId) {
            const newFloor = { ...floor };
            if (typeName.toLowerCase() === 'table' && newFloor.tables) newFloor.tables = [];
            if (typeName.toLowerCase() === 'cabin' && newFloor.cabins) newFloor.cabins = [];
            if (typeName.toLowerCase() === 'sofa' && newFloor.sofas) newFloor.sofas = [];
            if (newFloor.spaces) {
              newFloor.spaces = newFloor.spaces.filter((s) => (s.type || '').toUpperCase() !== typeName.toUpperCase());
            }
            return newFloor;
          }
          return floor;
        });
        setFloors(next);
        saveSpacesToCloud(next);
      }
    });
  };

  const handleSpaceClick = (spaceName) => {
    // If we click a table, it navigates to billing with this table preset
    // The App.jsx needs to pass this initialTable down.
    onNavigate('billing', spaceName);
  };

  const handlePrintDirect = async (spaceName, activeOrder) => {
    if (!activeOrder) return;
    setToast({ message: `🖨️ Sending print job for ${spaceName}...`, type: 'info' });
    try {
      if (activeOrder._id && activeOrder.items && activeOrder.items.length > 0) {
        await apiGenerateKOT(activeOrder._id, activeOrder.items);
        setToast({ message: `🖨️ KOT/Bill printed successfully for ${spaceName}!`, type: 'success' });
      } else {
        setToast({ message: `No active items to print for ${spaceName}`, type: 'warning' });
      }
    } catch (err) {
      console.warn("Direct print warning:", err);
      setToast({ message: `Opening billing print view for ${spaceName}`, type: 'info' });
    }
    // Navigate to billing screen preset with this table so cashier can view/print
    onNavigate('billing', spaceName);
  };

  const getSpaceOrder = (spaceName, rawItemName, isFirstFloor = false) => {
    if (!spaceName) return null;
    const targetClean = normalizeTable(spaceName);
    let order = orders.find((o) => normalizeTable(o.tableNo) === targetClean);
    if (order) return order;

    // Fallback for ANY floor (in case table was saved without floor prefix)
    if (!order && rawItemName) {
      const rawClean = normalizeTable(rawItemName);
      order = orders.find((o) => {
        const oTbl = o.tableNo || '';
        return !oTbl.includes(' - ') && normalizeTable(oTbl) === rawClean;
      });
    }
    return order;
  };

  const getActiveSpacesForMerge = () => {
    const activeSpaces = [];
    floors.forEach((floor, fIdx) => {
      ['tables', 'cabins', 'sofas', 'spaces'].forEach((type) => {
        if (floor[type]) {
          floor[type].forEach((item) => {
            const uniqueSpaceName = `${floor.name} - ${item.name}`;
            const activeOrder = getSpaceOrder(uniqueSpaceName, item.name, fIdx === 0);
            if (activeOrder) {
              activeSpaces.push({
                id: `${uniqueSpaceName}`,
                uniqueSpaceName,
                orderTableNo: activeOrder.tableNo || uniqueSpaceName,
                name: item.name,
                floorName: floor.name,
                total: activeOrder.total || 0,
                status: activeOrder.status
              });
            }
          });
        }
      });
    });
    return activeSpaces;
  };

  const getCalculatedOrderTotalWithTax = (activeOrder) => {
    if (!activeOrder) return 0;
    const subtotal = activeOrder.subtotal !== undefined ? activeOrder.subtotal : activeOrder.items?.reduce((sum, item) => {
      if (item.isCancelled || item.status === 'Cancelled') return sum;
      const activeQty = Math.max(0, (item.quantity || 0) - (item.cancelledQuantity || 0));
      return sum + (Number(item.price || 0) * activeQty);
    }, 0) || 0;

    let totRate = 0;
    try {
      const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      if (s.enableCgst) totRate += Number(s.cgstRate || 0);
      if (s.enableSgst) totRate += Number(s.sgstRate || 0);
      if (s.enableGst) totRate += Number(s.gstRate || 0);
    } catch(e) {}

    const disc = Number(activeOrder.discount || activeOrder.discountValue || 0);
    const taxable = Math.max(0, subtotal - disc);
    const taxAmt = taxable * (totRate / 100);

    if (activeOrder.total && activeOrder.total > subtotal) {
      return Math.round(activeOrder.total);
    }
    return Math.round(taxable + taxAmt);
  };

  const handleConfirmMerge = async () => {
    if (!mergeModal.targetSpace || mergeModal.sourceSpaces.length === 0) {
      setToast({ message: 'Please select a destination table and at least one table to merge from.', type: 'error' });
      return;
    }
    const destination = mergeModal.targetSpace;
    const sources = mergeModal.sourceSpaces;
    // Instantly close modal right on button click
    setMergeModal({ isOpen: false, targetSpace: '', sourceSpaces: [] });
    setMerging(true);
    try {
      await mergeTableOrders(destination, sources);
      setToast({ message: `Successfully combined table bills into ${destination}!`, type: 'success' });
      await fetchOrders();
    } catch (err) {
      setToast({ message: err?.response?.data?.message || 'Failed to merge table bills.', type: 'error' });
      await fetchOrders();
    } finally {
      setMerging(false);
    }
  };

  const renderSpaceCard = (item, type, IconComponent, index = 0) => {
    const currentFloor = floors.find((f) => f.id === activeFloorId);
    const uniqueSpaceName = currentFloor ? `${currentFloor.name} - ${item.name}` : item.name;
    const isFirstFloor = floors.length > 0 && floors[0].id === activeFloorId;

    // Dynamically calculate status from real-time orders instead of static item status
    const activeOrder = getSpaceOrder(uniqueSpaceName, item.name, isFirstFloor);
    const isOccupied = !!activeOrder;

    let statusColorClass = 'text-emerald-600';
    let statusBgClass = 'bg-emerald-100/60';
    let statusBorderClass = 'border-emerald-200';
    let statusBadgeClass = 'bg-emerald-100 text-emerald-700';
    let statusText = t('Available');
    let Icon = null;
    let SmallIcon = CheckCircle;

    const resolvedType = (item.type || type).toLowerCase();
    if (resolvedType === 'table') Icon = Coffee;else
    if (resolvedType === 'cabin') Icon = Home;else
    if (resolvedType === 'sofa') Icon = Sofa;else
    Icon = Utensils; // fallback

    if (activeOrder) {
      if (activeOrder.status === 'Open') {
        statusBgClass = 'bg-blue-100/60';
        statusBorderClass = 'border-blue-300';
        statusColorClass = 'text-blue-600';
        statusBadgeClass = 'bg-blue-200 text-blue-800';
        statusText = 'Running';
        SmallIcon = Clock;
      } else if (activeOrder.status === 'Billed') {
        statusBgClass = 'bg-orange-100/60';
        statusBorderClass = 'border-orange-300';
        statusColorClass = 'text-orange-600';
        statusBadgeClass = 'bg-orange-200 text-orange-800';
        statusText = 'Printed';
        SmallIcon = Printer;
      } else if (activeOrder.status === 'Paid') {
        statusBgClass = 'bg-gray-100/60';
        statusBorderClass = 'border-gray-300';
        statusColorClass = 'text-gray-600';
        statusBadgeClass = 'bg-gray-200 text-gray-800';
        statusText = 'Paid';
        SmallIcon = CheckCircle;
      }
    } else if (item.status === 'Reserved') {
      statusBgClass = 'bg-amber-100/60';
      statusBorderClass = 'border-amber-300';
      statusColorClass = 'text-amber-600';
      statusBadgeClass = 'bg-amber-200 text-amber-800';
      statusText = 'Reserved';
      SmallIcon = Clock;
    }

    // AI Insight logic
    let insightBadge = null;
    if (showAIInsights && isOccupied && activeOrder.createdAt) {
      const minutesOccupied = Math.floor((new Date() - new Date(activeOrder.createdAt)) / 60000);
      if (minutesOccupied >= 0) {
        // Just simulating the AI insight based on duration
        insightBadge = <div className="absolute -top-3 -right-3 bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg z-20 whitespace-nowrap animate-pulse">{t("✨ Clearing in")}{Math.max(1, 45 - minutesOccupied)}m</div>;
      }
    } else if (showAIInsights && !isOccupied) {
      // Simulate "High Demand" predictions
      const randomChance = item.name.length % 3 === 0;
      if (randomChance) {
        insightBadge = <div className="absolute -top-3 -right-3 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg z-20 whitespace-nowrap">{t("🔥 High Demand Next")}</div>;
      }
    }

    return (
      <div
        key={item._id || `${item.id}-${index}`}
        onClick={() => handleSpaceClick(uniqueSpaceName)}
        className={`group relative flex flex-col items-center justify-between w-full h-full min-h-[100px] sm:min-h-[145px] p-2 sm:p-4 rounded-2xl border border-white/50 transition-all cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-1 ${statusBgClass}`}>
        
        {insightBadge}
        {isOccupied && activeOrder.createdAt && (
          <div className="absolute top-1 right-1 sm:top-2 sm:right-2 px-1.5 py-0.5 bg-white/90 text-[10px] font-bold text-gray-500 rounded-lg shadow-xs flex items-center gap-1 z-10 border border-gray-100/50">
            <Clock size={10} className="text-blue-500" />
            {(() => {
              const diff = Math.max(0, Math.floor((new Date() - new Date(activeOrder.createdAt)) / 60000));
              return diff < 60 ? `${diff}m` : `${Math.floor(diff / 60)}h ${diff % 60}m`;
            })()}
          </div>
        )}

        <div className="flex flex-col items-center gap-1.5 w-full h-full justify-between">
          <div className={`p-1.5 sm:p-2 rounded-full bg-white shadow-xs ${statusColorClass} mt-0.5`}>
            <Icon size={16} strokeWidth={2.5} className="sm:hidden" />
            <Icon size={22} strokeWidth={2.5} className="hidden sm:block" />
          </div>
          
          <h3 className="text-[11px] sm:text-base font-black text-gray-800 leading-tight text-center w-full truncate">
            {item.name}
          </h3>
          
          {!isOccupied ? (
            <div className={`px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-white shadow-xs ${statusColorClass} mb-0.5`}>
              {statusText}
            </div>
          ) : (
              <div className="flex items-center gap-1 mt-1 w-full justify-center mb-0.5">
                <div className="px-1.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-white shadow-xs text-gray-900 flex-1 text-center truncate">
                  {currencySymbol}{getCalculatedOrderTotalWithTax(activeOrder).toLocaleString()}
                </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => {e.stopPropagation(); setSelectedOrderForView(activeOrder);}}
                  className="bg-white rounded-full p-1 sm:p-1.5 hover:text-emerald-600 transition-colors shadow-xs text-gray-500" title={t("View Order Details")}>
                  <Eye size={13} strokeWidth={2.5} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!activeOrder?.items || activeOrder.items.length === 0) return;
                    setSelectedBillForPrint(activeOrder);
                  }}
                  disabled={!activeOrder?.items || activeOrder.items.length === 0}
                  className={`bg-white rounded-full p-1 sm:p-1.5 transition-colors shadow-xs ${!activeOrder?.items || activeOrder.items.length === 0 ? 'opacity-50 cursor-not-allowed text-gray-300' : 'hover:text-blue-600 hover:bg-blue-50 text-gray-500'}`} 
                  title={!activeOrder?.items || activeOrder.items.length === 0 ? t("No items to print") : t("Print KOT & Bill directly")}>
                  <Printer size={13} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}
        </div>

        {!isOccupied && (
          <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-30">
            <button
              onClick={(e) => handleRemoveSpace(e, type, item.id)}
              className="absolute top-1 left-1 sm:-top-2 sm:-left-2 bg-red-500 text-white rounded-full p-1 sm:p-1.5 shadow-md hover:scale-110 animate-fade-in" title={t("Remove")}>
              <Trash2 size={11} className="sm:hidden" />
              <Trash2 size={13} className="hidden sm:block" />
            </button>
            <button
              onClick={(e) => handleRenameClick(e, type, item.id, item.name)}
              className="absolute top-1 right-1 sm:-top-2 sm:-right-2 bg-blue-500 text-white rounded-full p-1 sm:p-1.5 shadow-md hover:scale-110 animate-fade-in" title={t("Rename")}>
              <Edit2 size={11} className="sm:hidden" />
              <Edit2 size={13} className="hidden sm:block" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden w-full">
      {/* Top Header */}
      <div className="px-2.5 sm:px-6 py-2.5 shrink-0 border-b border-gray-100">
        {/* Row 1: Title + Refresh (always visible) */}
        <div className="flex items-center justify-between mb-2 sm:mb-0">
          <h2 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-500 tracking-tight">{t('Table View')}</h2>

          {/* On mobile: refresh visible inline with title. On sm+ hidden here (shown in button row) */}
          <button onClick={() => window.location.reload()} className="sm:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title={t("Refresh")}>
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          </button>

          {/* Desktop: all buttons in one row to the right of title */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => setShowAIInsights(!showAIInsights)}
              className={`px-3 py-1.5 rounded-lg shadow-xs transition-colors text-xs font-bold flex items-center gap-1.5 ${showAIInsights ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}>
              {t("✨ AI Predictor")}
            </button>
            <button onClick={() => window.location.reload()} className="p-1.5 text-gray-700 font-bold hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center" title={t("Refresh")}>
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={() => setMergeModal({ isOpen: true, targetSpace: '', sourceSpaces: [] })} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg shadow-xs transition-colors text-xs">
              {t("Merge Bills")}
            </button>
            <button onClick={() => onNavigate('reservation')} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-xs transition-colors text-xs">
              {t("Reservation")}
            </button>
            <button onClick={() => onNavigate('billing', 'DEL-NEW')} className="px-3 py-1.5 bg-[#d32f2f] hover:bg-red-700 text-white font-bold rounded-lg shadow-xs transition-colors text-xs">
              {t("Delivery")}
            </button>
            <button onClick={() => onNavigate('billing', 'TAK-NEW')} className="px-3 py-1.5 bg-[#d32f2f] hover:bg-red-700 text-white font-bold rounded-lg shadow-xs transition-colors text-xs">
              {t("Pick Up")}
            </button>
            <button onClick={() => handleAddSpace()} className="px-3 py-1.5 bg-[#d32f2f] hover:bg-red-700 text-white font-bold rounded-lg shadow-xs transition-colors text-xs">
              {t("+ Add Space")}
            </button>
          </div>
        </div>

        {/* Row 2: Mobile-only action buttons — horizontally scrollable single line */}
        <div className="flex sm:hidden items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setShowAIInsights(!showAIInsights)}
            className={`px-2.5 py-1.5 rounded-lg shadow-xs transition-colors text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 ${showAIInsights ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700'}`}>
            {t("✨ AI Predictor")}
          </button>
          <button onClick={() => setMergeModal({ isOpen: true, targetSpace: '', sourceSpaces: [] })} className="px-2.5 py-1.5 bg-amber-500 text-white font-bold rounded-lg shadow-xs text-[11px] whitespace-nowrap shrink-0">
            {t("Merge Bills")}
          </button>
          <button onClick={() => onNavigate('reservation')} className="px-2.5 py-1.5 bg-indigo-600 text-white font-bold rounded-lg shadow-xs text-[11px] whitespace-nowrap shrink-0">
            {t("Reservation")}
          </button>
          <button onClick={() => onNavigate('billing', 'DEL-NEW')} className="px-2.5 py-1.5 bg-[#d32f2f] text-white font-bold rounded-lg shadow-xs text-[11px] whitespace-nowrap shrink-0">
            {t("Delivery")}
          </button>
          <button onClick={() => onNavigate('billing', 'TAK-NEW')} className="px-2.5 py-1.5 bg-[#d32f2f] text-white font-bold rounded-lg shadow-xs text-[11px] whitespace-nowrap shrink-0">
            {t("Pick Up")}
          </button>
          <button onClick={() => handleAddSpace()} className="px-2.5 py-1.5 bg-[#d32f2f] text-white font-bold rounded-lg shadow-xs text-[11px] whitespace-nowrap shrink-0">
            {t("+ Add Space")}
          </button>
        </div>
      </div>
      
      {/* Status Legend (Scrollable horizontal pill bar) */}
      <div className="px-2.5 sm:px-6 flex items-center gap-2 sm:gap-3 text-xs font-medium text-gray-600 overflow-x-auto no-scrollbar py-2 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-1.5 whitespace-nowrap bg-emerald-50/60 px-2.5 py-1 rounded-full border border-emerald-200">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>{t("Available")}</span>
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap bg-blue-50/60 px-2.5 py-1 rounded-full border border-blue-200">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
          <span>{t("Running Table")}</span>
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap bg-orange-50/60 px-2.5 py-1 rounded-full border border-orange-200">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
          <span>{t("Printed Table")}</span>
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap bg-gray-50 px-2.5 py-1 rounded-full border border-gray-200">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
          <span>{t("Paid Table")}</span>
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap bg-amber-50/60 px-2.5 py-1 rounded-full border border-amber-200">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>{t("Reserved KOT")}</span>
        </div>
      </div>

      {/* Floor Tabs */}
      <div className="px-2.5 sm:px-6 pt-2 border-b border-gray-100 bg-white flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        {floors.map((floor, index) => (
          <div
            key={floor._id || `${floor.id}-${index}`}
            onClick={() => setActiveFloorId(floor.id)}
            className={`group relative flex items-center gap-2 px-4 py-2 border-b-2 font-bold cursor-pointer transition-colors whitespace-nowrap text-sm sm:text-base ${
              activeFloorId === floor.id
                ? 'border-red-600 text-red-600 bg-red-50/50 rounded-t-xl'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-t-xl'
            }`}>
            {t(floor.name)}
            <button
              onClick={(e) => handleRemoveFloor(e, floor.id)}
              className={`p-1 rounded-full ${activeFloorId === floor.id ? 'hover:bg-red-100 text-red-600' : 'hover:bg-gray-200 text-gray-400'} opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity`}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <button
          onClick={handleAddFloor}
          className="flex items-center gap-1 px-3 py-2 border-b-2 border-transparent text-gray-500 hover:bg-gray-50 font-bold cursor-pointer transition-colors whitespace-nowrap rounded-t-xl text-sm sm:text-base">
          <Plus size={16} />{t("Add Floor")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-3 sm:px-6 sm:py-6 space-y-4 sm:space-y-6 bg-gray-50/40">
        {/* Dynamic Spaces Rendering */}
        {(() => {
          const currentFloor = floors.find((f) => f.id === activeFloorId);
          if (!currentFloor) return null;

          const allSpaces = [
            ...(currentFloor.tables || []).map((t) => ({ ...t, _origType: 'table' })),
            ...(currentFloor.cabins || []).map((c) => ({ ...c, _origType: 'cabin' })),
            ...(currentFloor.sofas || []).map((s) => ({ ...s, _origType: 'sofa' })),
            ...(currentFloor.spaces || []).map((sp) => ({ ...sp, _origType: 'space' }))
          ];

          const grouped = allSpaces.reduce((acc, space) => {
            const rawType = space.type || 'Table';
            const typeName = rawType.toUpperCase();
            if (!acc[typeName]) acc[typeName] = [];
            acc[typeName].push(space);
            return acc;
          }, {});

          return Object.entries(grouped).map(([typeName, items], index) => (
            <section key={`${typeName}-${index}`}>
              <div className="flex items-center gap-2 mb-3 group/section w-max">
                <h3 className="text-xs font-black text-[#d32f2f] uppercase tracking-wider">
                  {t(typeName)}
                </h3>
                <button
                  onClick={(e) => handleRemoveSpaceCategory(e, typeName)}
                  className="opacity-100 md:opacity-0 md:group-hover/section:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1 rounded hover:bg-red-50"
                  title={`Delete all ${typeName}s`}>
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Grid Layout: 2 cols mobile → more cols on larger screens for smaller cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-9 gap-3 sm:gap-3 w-full">
                {items.map((item, i) => renderSpaceCard(item, item._origType, Coffee, i))}
                {/* Inline Add Button for this category */}
                <button
                  onClick={() => setAddSpaceModal({ isOpen: true, name: '', type: typeName.charAt(0).toUpperCase() + typeName.slice(1).toLowerCase() })}
                  className="w-full h-full min-h-[100px] sm:min-h-[145px] rounded-2xl border-2 border-dashed border-gray-300 hover:border-emerald-400 hover:bg-emerald-50 flex flex-col items-center justify-center gap-1 sm:gap-2 text-gray-400 hover:text-emerald-600 transition-colors">
                  <Plus size={22} />
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-center px-1 leading-tight">{t("Add")}<br />{t(typeName)}</span>
                </button>
              </div>
            </section>
          ));
        })()}
      </div>

      {/* Custom Prompt Modal */}
      {promptModal.isOpen &&
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl w-full max-w-md shadow-2xl p-6 transform scale-100 transition-all border border-border/50">
            <h3 className="text-xl font-bold text-text-main mb-2">{promptModal.title}</h3>
            <p className="text-sm text-text-muted mb-6">{t("Please enter the details below.")}</p>
            <input
            type="text"
            autoFocus
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                promptModal.onConfirm(promptInput);
                setPromptModal({ isOpen: false, onConfirm: null });
              }
            }}
            placeholder={promptModal.placeholder}
            className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-text-main font-medium mb-6" />
          
            <div className="flex items-center justify-end gap-3">
              <button
              onClick={() => setPromptModal({ isOpen: false, onConfirm: null })}
              className="px-5 py-2.5 rounded-xl font-bold text-text-muted hover:bg-surface-hover transition-colors">{t("Cancel")}


            </button>
              <button
              onClick={() => {
                promptModal.onConfirm(promptInput);
                setPromptModal({ isOpen: false, onConfirm: null });
              }}
              className="px-5 py-2.5 rounded-xl font-bold bg-primary text-white hover:shadow-lg hover:shadow-primary/30 transition-all">{t("Save")}


            </button>
            </div>
          </div>
        </div>
      }

      {/* Add Space Modal */}
      {addSpaceModal.isOpen &&
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl w-full max-w-md shadow-2xl p-6 transform scale-100 transition-all border border-border/50">
            <h3 className="text-xl font-bold text-text-main mb-2">{t("Add New Space")}</h3>
            <p className="text-sm text-text-muted mb-6">{t("Customize the space type and name.")}</p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">{t("Space Type")}</label>
                <div className="flex flex-col gap-3">
                  <input
                  type="text"
                  value={addSpaceModal.type}
                  onChange={(e) => setAddSpaceModal((prev) => ({ ...prev, type: e.target.value }))} placeholder={t("e.g. Table, AC Hall, Cabin...")}

                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-text-main font-medium" />
                
                  <div className="flex flex-wrap gap-2">
                    {['Table', 'Cabin', 'Sofa', 'AC Hall', 'Non AC', 'Garden'].map((suggestion) =>
                  <button
                    key={suggestion}
                    onClick={() => setAddSpaceModal((prev) => ({ ...prev, type: suggestion }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${addSpaceModal.type.toLowerCase() === suggestion.toLowerCase() ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    
                        {suggestion}
                      </button>
                  )}
                    <button
                    onClick={() => setAddSpaceModal((prev) => ({ ...prev, type: '' }))}
                    className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all">{t("+ Custom")}


                  </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">{t("Space Name / Number")}</label>
                <input
                type="text"
                autoFocus
                value={addSpaceModal.name}
                onChange={(e) => setAddSpaceModal((prev) => ({ ...prev, name: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitAddSpace();
                }} placeholder={t("e.g. 1, T1, VIP-1")}

                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-text-main font-medium" />
              
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
              onClick={() => setAddSpaceModal({ isOpen: false, name: '', type: 'Table' })}
              className="px-5 py-2.5 rounded-xl font-bold text-text-muted hover:bg-surface-hover transition-colors">{t("Cancel")}


            </button>
              <button
              onClick={submitAddSpace}
              className="px-5 py-2.5 rounded-xl font-bold bg-primary text-white hover:shadow-lg hover:shadow-primary/30 transition-all">{t("Save Space")}


            </button>
            </div>
          </div>
        </div>
      }

      {/* Rename Space Modal */}
      {renameSpaceModal.isOpen &&
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl w-full max-w-sm shadow-2xl p-6 transform scale-100 transition-all border border-border/50">
            <h3 className="text-xl font-bold text-text-main mb-2">{t("Rename")}{renameSpaceModal.type}</h3>
            <p className="text-sm text-text-muted mb-6">{t("Enter a new name or number for this space.")}</p>
            
            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">{t("New Name")}</label>
              <input
              type="text"
              autoFocus
              value={renameSpaceModal.name}
              onChange={(e) => setRenameSpaceModal((prev) => ({ ...prev, name: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRenameSpace();
              }} placeholder={t("e.g. Table 5")}

              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-text-main font-medium" />
            
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
              onClick={() => setRenameSpaceModal({ isOpen: false, id: null, type: '', name: '' })}
              className="px-5 py-2.5 rounded-xl font-bold text-text-muted hover:bg-surface-hover transition-colors">{t("Cancel")}


            </button>
              <button
              onClick={submitRenameSpace}
              className="px-5 py-2.5 rounded-xl font-bold bg-primary text-white hover:shadow-lg hover:shadow-primary/30 transition-all">{t("Save")}


            </button>
            </div>
          </div>
        </div>
      }

      {/* Custom Confirm Modal */}
      {confirmModal.isOpen &&
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl w-full max-w-md shadow-2xl p-6 transform scale-100 transition-all border border-border/50">
            <h3 className="text-xl font-bold text-text-main mb-3">{confirmModal.title}</h3>
            <p className="text-base text-text-muted mb-6">{confirmModal.message}</p>
            <div className="flex items-center justify-end gap-3">
              <button
              onClick={() => setConfirmModal({ isOpen: false, onConfirm: null })}
              className="px-5 py-2.5 rounded-xl font-bold text-text-muted hover:bg-surface-hover transition-colors">{t("Cancel")}


            </button>
              <button
              onClick={() => {
                confirmModal.onConfirm();
                setConfirmModal({ isOpen: false, onConfirm: null });
              }}
              className="px-5 py-2.5 rounded-xl font-bold bg-danger text-white hover:shadow-lg hover:shadow-danger/30 transition-all">{t("Yes, Continue")}


            </button>
            </div>
          </div>
        </div>
      }

      {/* Merge Tables Modal */}
      {mergeModal.isOpen &&
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl w-full max-w-lg shadow-2xl p-6 border border-border/60 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 font-bold">
                  <Utensils size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-text-main">{t("Merge Table Bills")}</h3>
                  <p className="text-xs text-text-muted">{t("Combine items and totals from multiple active tables into one bill.")}</p>
                </div>
              </div>
              <button onClick={() => setMergeModal({ isOpen: false, targetSpace: '', sourceSpaces: [] })} className="text-text-muted hover:text-text-main font-bold p-1">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              {/* Step 1: Destination Table */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">{t("1. Select Destination Table (Where the final combined bill will stay):")}

              </label>
                <select
                value={mergeModal.targetSpace}
                onChange={(e) => {
                  const selected = e.target.value;
                  setMergeModal((prev) => ({
                    ...prev,
                    targetSpace: selected,
                    sourceSpaces: prev.sourceSpaces.filter((s) => s !== selected)
                  }));
                }}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-amber-500 font-bold text-text-main">
                
                  <option value="">{t("-- Choose Destination Table --")}</option>
                  {getActiveSpacesForMerge().map((sp, index) =>
                <option key={`${sp.id || 'sp'}-${index}`} value={sp.orderTableNo}>
                      {sp.uniqueSpaceName} ({sp.status} - ₹{sp.total?.toLocaleString()})
                    </option>
                )}
                </select>
              </div>

              {/* Step 2: Source Tables */}
              {mergeModal.targetSpace &&
            <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">{t("2. Select Table(s) to Merge INTO")}
                {mergeModal.targetSpace}:
                  </label>
                  <div className="space-y-2 max-h-52 overflow-y-auto border border-border/60 rounded-xl p-3 bg-background/50">
                    {getActiveSpacesForMerge().
                filter((sp) => sp.orderTableNo !== mergeModal.targetSpace).
                map((sp, index) => {
                  const isChecked = mergeModal.sourceSpaces.includes(sp.orderTableNo);
                  return (
                    <label
                      key={`${sp.id || 'sp'}-${index}`}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      isChecked ?
                      'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 font-bold' :
                      'bg-surface border-border hover:border-amber-300 text-text-main'}`
                      }>
                      
                            <div className="flex items-center gap-3">
                              <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setMergeModal((prev) => ({ ...prev, sourceSpaces: [...prev.sourceSpaces, sp.orderTableNo] }));
                            } else {
                              setMergeModal((prev) => ({ ...prev, sourceSpaces: prev.sourceSpaces.filter((s) => s !== sp.orderTableNo) }));
                            }
                          }}
                          className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500" />
                        
                              <div>
                                <div className="font-bold">{sp.uniqueSpaceName}</div>
                                <div className="text-xs text-text-muted uppercase font-semibold">{sp.status}</div>
                              </div>
                            </div>
                            <div className="font-black text-sm">₹{sp.total?.toLocaleString()}</div>
                          </label>);

                })}
                  </div>
                </div>
            }
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
              <button
              onClick={() => setMergeModal({ isOpen: false, targetSpace: '', sourceSpaces: [] })}
              className="px-5 py-2.5 rounded-xl font-bold text-text-muted hover:bg-surface-hover transition-colors">{t("Cancel")}


            </button>
              <button
              onClick={handleConfirmMerge}
              disabled={!mergeModal.targetSpace || mergeModal.sourceSpaces.length === 0 || merging}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white shadow-lg transition-all ${
              !mergeModal.targetSpace || mergeModal.sourceSpaces.length === 0 || merging ?
              'bg-amber-500/50 cursor-not-allowed' :
              'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30'}`
              }>
              
                {merging ? 'Combining Bills...' : `Confirm & Merge (${mergeModal.sourceSpaces.length} Table${mergeModal.sourceSpaces.length === 1 ? '' : 's'})`}
              </button>
            </div>
          </div>
        </div>
      }

      {/* Invoice Modal for Print Overview */}
      {selectedBillForPrint && (
        <Invoice 
          bill={selectedBillForPrint} 
          onClose={() => setSelectedBillForPrint(null)} 
        />
      )}

      {/* Light Theme View Order Modal */}
      {selectedOrderForView && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white/95 backdrop-blur-xl border border-gray-200/80 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header with Global Theme Gradient */}
            <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-6 py-5 flex justify-between items-center text-white shrink-0 shadow-md">
              <div>
                <h2 className="text-xl font-black flex items-center gap-2.5 tracking-tight font-mono">
                  {t("Order Overview")}
                </h2>
                <p className="text-orange-100 text-xs font-semibold mt-0.5">
                  {selectedOrderForView.tableNo || selectedOrderForView.table} • #{selectedOrderForView.billNumber || selectedOrderForView.billNo || 'PENDING'}
                </p>
              </div>
              <button 
                onClick={() => setSelectedOrderForView(null)}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors text-white backdrop-blur-md"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Light Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3 bg-gray-50/70">
              <div className="space-y-3">
                {selectedOrderForView.items?.map((item, index) => {
                  const isCancelled = item.isCancelled || item.status === 'Cancelled';
                  const activeQty = isCancelled ? 0 : Math.max(0, item.quantity - (item.cancelledQuantity || 0));
                  const cleanName = (item.name || '').trim().toLowerCase();
                  const itemImg = item.image || item.imageUrl || menuImagesMap[cleanName] || menuImagesMap[item.name];

                  return (
                    <div 
                      key={index} 
                      className={`flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all ${
                        isCancelled 
                          ? 'bg-red-50/80 border-red-200 text-red-700' 
                          : 'bg-white border-gray-200/80 text-gray-800 shadow-sm hover:shadow-md'
                      }`}
                    >
                      {/* Dish Image */}
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-orange-50 shrink-0 border border-orange-200/60 flex items-center justify-center">
                        {itemImg ? (
                          <img 
                            src={formatImageUrl(itemImg)} 
                            alt={item.name} 
                            className={`w-full h-full object-cover ${isCancelled ? 'grayscale opacity-60' : ''}`} 
                          />
                        ) : (
                          <Utensils size={20} className="text-orange-500" />
                        )}
                      </div>

                      {/* Item Info */}
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className={`font-bold text-sm truncate ${isCancelled ? 'line-through text-red-600' : 'text-gray-900'}`}>
                            {item.name}
                          </h4>
                          {isCancelled && (
                            <span className="text-[10px] bg-red-100 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1">
                              <Ban size={10} /> {t("Cancelled")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                          {isCancelled ? 0 : activeQty} × {currencySymbol}{Number(item.price || 0).toFixed(2)}
                        </p>
                      </div>

                      {/* Total */}
                      <div className="text-right shrink-0">
                        <span className={`font-bold text-sm whitespace-nowrap ${isCancelled ? 'line-through text-red-500' : 'text-orange-600'}`}>
                          {currencySymbol}{(isCancelled ? 0 : (activeQty * Number(item.price || 0))).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Footer Summary with Light Theme */}
            {(() => {
              const activeSubtotal = selectedOrderForView.items?.reduce((sum, item) => {
                if (item.isCancelled || item.status === 'Cancelled') return sum;
                const activeQty = Math.max(0, item.quantity - (item.cancelledQuantity || 0));
                return sum + (Number(item.price || 0) * activeQty);
              }, 0) || 0;

              const subTotal = selectedOrderForView.subtotal !== undefined ? selectedOrderForView.subtotal : activeSubtotal;
              
              let taxAmount = selectedOrderForView.taxTotal || 0;
              let serviceCharge = selectedOrderForView.serviceCharge || 0;
              let packagingCharge = selectedOrderForView.packagingCharge || 0;
              
              if (selectedOrderForView.taxTotal === undefined || selectedOrderForView.taxTotal === null) {
                try {
                  const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
                  let totRate = 0;
                  if (s.enableCgst) totRate += Number(s.cgstRate || 0);
                  if (s.enableSgst) totRate += Number(s.sgstRate || 0);
                  if (s.enableGst) totRate += Number(s.gstRate || 0);
                  
                  const disc = Number(selectedOrderForView.discount || 0);
                  const taxable = Math.max(0, subTotal - disc);
                  taxAmount = taxable * (totRate / 100);
                } catch(e) {
                  taxAmount = 0;
                }
              }
              
              const calculatedTotal = selectedOrderForView.finalTotal || (subTotal - Number(selectedOrderForView.discount || 0) + taxAmount + serviceCharge + packagingCharge);
              
              return (
                <div className="bg-white border-t border-gray-200/80 p-6 shrink-0">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-500 font-medium text-sm">{t("Subtotal")}</span>
                    <span className="font-semibold text-gray-800 text-sm">{currencySymbol}{subTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-500 font-medium text-sm">{t("Taxes & Charges")}</span>
                    <span className="font-semibold text-gray-800 text-sm">{currencySymbol}{(taxAmount + serviceCharge + packagingCharge).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-dashed border-gray-200">
                    <span className="text-lg font-black text-gray-900 tracking-tight">{t("Total")}</span>
                    <span className="text-2xl font-black text-orange-600">{currencySymbol}{Math.round(calculatedTotal).toFixed(2)}</span>
                  </div>
                  <div className="mt-6 flex gap-3">
                    <button 
                      onClick={() => setSelectedOrderForView(null)}
                      className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold transition-all border border-gray-200"
                    >
                      {t("Close")}
                    </button>
                    <button 
                      onClick={() => {
                        const table = selectedOrderForView.tableNo || selectedOrderForView.table;
                        setSelectedOrderForView(null);
                        onNavigate('billing', table);
                      }}
                      className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-orange-500/20"
                    >
                      {t("Open in Billing")}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>);

};

export default FloorManagement;