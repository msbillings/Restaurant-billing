import React, { useState, useEffect } from 'react';
import { getOpenOrders, mergeTableOrders } from '../api/billing';
import { Plus, Coffee, Home, Trash2, Sofa, Utensils, CheckCircle, Clock, RefreshCw, Printer, Eye } from 'lucide-react';
import { io } from 'socket.io-client';
import Toast from './Toast';

const FloorManagement = ({ onNavigate }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [promptModal, setPromptModal] = useState({ isOpen: false, title: '', placeholder: '', onConfirm: null });
  const [promptInput, setPromptInput] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [mergeModal, setMergeModal] = useState({ isOpen: false, targetSpace: '', sourceSpaces: [] });
  const [addSpaceModal, setAddSpaceModal] = useState({ isOpen: false, name: '', type: 'Table' });
  const [merging, setMerging] = useState(false);
  const [showAIInsights, setShowAIInsights] = useState(false);

  const [floors, setFloors] = useState(() => {
    const saved = localStorage.getItem('msbillings_spaces');
    if (saved) {
      let parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) {
        parsed = [{
          id: 'f-default',
          name: 'Ground Floor',
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

  const [activeFloorId, setActiveFloorId] = useState(() => floors[0]?.id || null);

  const saveSpacesToCloud = async (newFloors) => {
    localStorage.setItem('msbillings_spaces', JSON.stringify(newFloors));
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
      await fetch(`${API_BASE_URL}/floors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-DB': localStorage.getItem('resto_db_name') || '',
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
        },
        body: JSON.stringify({ spaces: newFloors })
      });
    } catch (e) {
      console.error('Failed to save floors to cloud', e);
    }
  };

  useEffect(() => {
    localStorage.setItem('msbillings_spaces', JSON.stringify(floors));
  }, [floors]);

  useEffect(() => {
    fetchOrders();
    syncSpaces();
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
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
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
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
      const res = await fetch(`${API_BASE_URL}/floors`, {
        headers: {
          'X-Tenant-DB': localStorage.getItem('resto_db_name') || '',
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          localStorage.setItem('msbillings_spaces', JSON.stringify(data));
          setFloors(data);
        }
      }
    } catch (e) {
      console.error('Failed to sync spaces from cloud', e);
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
          setFloors(prev => {
            const next = [...prev, { id: newFloorId, name: name.trim(), tables: [], cabins: [], sofas: [] }];
            saveSpacesToCloud(next);
            return next;
          });
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
        setFloors(prev => {
          const nextFloors = prev.filter(f => f.id !== id);
          if (activeFloorId === id) {
            setActiveFloorId(nextFloors[0]?.id || null);
          }
          saveSpacesToCloud(nextFloors);
          return nextFloors;
        });
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
      setFloors(prev => {
        const next = prev.map(floor => {
          if (floor.id === activeFloorId) {
            return {
              ...floor,
              spaces: [...(floor.spaces || []), { id: Date.now().toString(), name: name.trim(), type: type.trim() }]
            };
          }
          return floor;
        });
        saveSpacesToCloud(next);
        return next;
      });
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
        setFloors(prev => {
          const next = prev.map(floor => {
            if (floor.id === activeFloorId) {
              const key = type + 's';
              const newFloor = { ...floor };
              if (newFloor[key]) {
                newFloor[key] = newFloor[key].filter(item => item.id !== id);
              }
              if (newFloor.spaces) {
                newFloor.spaces = newFloor.spaces.filter(item => item.id !== id);
              }
              return newFloor;
            }
            return floor;
          });
          saveSpacesToCloud(next);
          return next;
        });
      }
    });
  };

  const handleRemoveSpaceCategory = (e, typeName) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: `Remove ${typeName} Category`,
      message: `Are you sure you want to delete ALL spaces inside the ${typeName} category?`,
      onConfirm: () => {
        setFloors(prev => {
          const next = prev.map(floor => {
            if (floor.id === activeFloorId) {
              const newFloor = { ...floor };
              if (typeName.toLowerCase() === 'table' && newFloor.tables) newFloor.tables = [];
              if (typeName.toLowerCase() === 'cabin' && newFloor.cabins) newFloor.cabins = [];
              if (typeName.toLowerCase() === 'sofa' && newFloor.sofas) newFloor.sofas = [];
              if (newFloor.spaces) {
                newFloor.spaces = newFloor.spaces.filter(s => (s.type || '').toUpperCase() !== typeName.toUpperCase());
              }
              return newFloor;
            }
            return floor;
          });
          saveSpacesToCloud(next);
          return next;
        });
      }
    });
  };

  const handleSpaceClick = (spaceName) => {
    // If we click a table, it navigates to billing with this table preset
    // The App.jsx needs to pass this initialTable down.
    onNavigate('billing', spaceName);
  };

  const getSpaceOrder = (spaceName) => {
    return orders.find(o => o.tableNo.toLowerCase() === spaceName.toLowerCase());
  };

  const getActiveSpacesForMerge = () => {
    const activeSpaces = [];
    floors.forEach(floor => {
      ['tables', 'cabins', 'sofas', 'spaces'].forEach(type => {
        if (floor[type]) {
          floor[type].forEach(item => {
            const uniqueSpaceName = `${floor.name} - ${item.name}`;
            const activeOrder = getSpaceOrder(uniqueSpaceName) || getSpaceOrder(item.name);
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
    const currentFloor = floors.find(f => f.id === activeFloorId);
    const uniqueSpaceName = currentFloor ? `${currentFloor.name} - ${item.name}` : item.name;

    // Dynamically calculate status from real-time orders instead of static item status
    const activeOrder = getSpaceOrder(uniqueSpaceName);
    const isOccupied = !!activeOrder;

    let statusColorClass = 'text-emerald-600';
    let statusBgClass = 'bg-emerald-50';
    let statusBorderClass = 'border-emerald-200';
    let statusBadgeClass = 'bg-emerald-100 text-emerald-700';
    let statusText = 'Available';
    let Icon = null;
    let SmallIcon = CheckCircle;

    if (type.toLowerCase() === 'table') Icon = Coffee;
    else if (type.toLowerCase() === 'cabin') Icon = Home;
    else if (type.toLowerCase() === 'sofa') Icon = Sofa;
    else Icon = Utensils; // fallback

    if (activeOrder) {
      if (activeOrder.status === 'Open') {
        statusBgClass = 'bg-blue-50';
        statusBorderClass = 'border-blue-300';
        statusColorClass = 'text-blue-600';
        statusBadgeClass = 'bg-blue-200 text-blue-800';
        statusText = 'Running';
        SmallIcon = Clock;
      } else if (activeOrder.status === 'Printed') {
        statusBgClass = 'bg-orange-50';
        statusBorderClass = 'border-orange-300';
        statusColorClass = 'text-orange-600';
        statusBadgeClass = 'bg-orange-200 text-orange-800';
        statusText = 'Printed';
        SmallIcon = Printer;
      } else if (activeOrder.status === 'Billed') {
        statusBgClass = 'bg-gray-50';
        statusBorderClass = 'border-gray-300';
        statusColorClass = 'text-gray-600';
        statusBadgeClass = 'bg-gray-200 text-gray-800';
        statusText = 'Paid';
        SmallIcon = CheckCircle;
      }
    } else if (item.status === 'Reserved') {
      statusBgClass = 'bg-amber-50';
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
        insightBadge = <div className="absolute -top-3 -right-3 bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg z-20 whitespace-nowrap animate-pulse">✨ Clearing in {Math.max(1, 45 - minutesOccupied)}m</div>;
      }
    } else if (showAIInsights && !isOccupied) {
      // Simulate "High Demand" predictions
      const randomChance = item.name.length % 3 === 0;
      if (randomChance) {
        insightBadge = <div className="absolute -top-3 -right-3 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg z-20 whitespace-nowrap">🔥 High Demand Next</div>;
      }
    }

    return (
      <div
        key={item._id || `${item.id}-${index}`}
        onClick={() => handleSpaceClick(uniqueSpaceName)}
        className={`group relative flex flex-col justify-between w-[160px] h-[130px] p-3 rounded-2xl border-2 transition-all cursor-pointer shadow-sm ${statusBgClass} ${statusBorderClass} hover:shadow-md hover:opacity-90`}
      >
        {insightBadge}

        {/* Top Row: Icon and Badge */}
        <div className="flex justify-between items-start w-full">
          <div className={`p-1.5 rounded-lg bg-white/60 ${statusColorClass} shadow-sm`}>
            <Icon size={20} strokeWidth={2.5} />
          </div>
          <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase ${statusBadgeClass}`}>
            {statusText}
          </div>
        </div>

        {/* Middle/Bottom Row: Name, Status, Amount */}
        <div className="w-full mt-2 flex flex-col gap-0.5">
          <h3 className="text-[17px] font-extrabold text-gray-800 leading-tight">
            {item.name}
          </h3>
          
          {!isOccupied ? (
            <div className={`flex items-center gap-1.5 mt-1 text-[12px] font-bold ${statusColorClass}`}>
              <SmallIcon size={14} strokeWidth={3} />
              <span>{statusText}</span>
            </div>
          ) : (
            <div className="flex items-center justify-between mt-1">
              <span className="font-black text-[16px] text-gray-900">₹{activeOrder.total?.toLocaleString() || 0}</span>
              <div className="flex items-center gap-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); /* Print */ }}
                  className="bg-white/80 border border-gray-200 rounded p-1 hover:text-blue-600 transition-colors shadow-sm"
                  title="Print Bill directly"
                >
                  <Printer size={14} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={(e) => handleRemoveSpace(e, type, item.id)}
          className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full p-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-lg hover:scale-110 z-30"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Top Header */}
      <div className="px-6 py-4 flex flex-wrap gap-4 justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-500 tracking-tight">Table View</h2>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <button 
            onClick={() => setShowAIInsights(!showAIInsights)}
            className={`px-3 py-1.5 rounded shadow transition-colors text-sm font-bold flex items-center gap-2 ${showAIInsights ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
          >
            ✨ AI Predictor
          </button>
          
          <button onClick={fetchOrders} className="p-2 text-gray-700 font-bold hover:bg-gray-100 rounded-full transition-colors" title="Refresh">
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
          
          <button
            onClick={() => setMergeModal({ isOpen: true, targetSpace: '', sourceSpaces: [] })}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded shadow transition-colors text-sm"
          >
            Merge Bills
          </button>

          <button onClick={() => onNavigate('delivery')} className="px-5 py-1.5 bg-[#d32f2f] hover:bg-red-700 text-white font-medium rounded shadow-sm transition-colors text-sm">
            Delivery
          </button>
          
          <button onClick={() => onNavigate('delivery')} className="px-5 py-1.5 bg-[#d32f2f] hover:bg-red-700 text-white font-medium rounded shadow-sm transition-colors text-sm">
            Pick Up
          </button>

          <button onClick={() => handleAddSpace()} className="px-5 py-1.5 bg-[#d32f2f] hover:bg-red-700 text-white font-medium rounded shadow-sm transition-colors text-sm">
            + Add Space
          </button>
        </div>
      </div>
      
      {/* Status Legend */}
      <div className="px-6 flex items-center gap-4 text-xs font-medium text-gray-500 overflow-x-auto hide-scrollbar pb-2">
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full bg-emerald-50 shadow-sm border-2 border-emerald-200"></span> Available</div>
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full bg-blue-50 shadow-sm border-2 border-blue-300"></span> Running Table</div>
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full bg-orange-50 shadow-sm border-2 border-orange-300"></span> Printed Table</div>
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full bg-gray-50 shadow-sm border-2 border-gray-300"></span> Paid Table</div>
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full bg-amber-50 shadow-sm border-2 border-amber-300"></span> Reserved KOT</div>
        </div>

      {/* Floor Tabs */}
      <div className="px-6 pt-3 border-b border-gray-100 bg-white flex gap-2 overflow-x-auto">
        {floors.map((floor, index) => (
          <div
            key={floor._id || `${floor.id}-${index}`}
            onClick={() => setActiveFloorId(floor.id)}
            className={`group relative flex items-center gap-2 px-5 py-2.5 border-b-2 font-bold cursor-pointer transition-colors whitespace-nowrap text-[16px] ${activeFloorId === floor.id
              ? 'border-red-600 text-red-600 bg-red-50/50 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-t-xl'
              }`}
          >
            {floor.name}
            {floors.length > 1 && (
              <button
                onClick={(e) => handleRemoveFloor(e, floor.id)}
                className={`p-1 rounded-full ${activeFloorId === floor.id ? 'hover:bg-red-100 text-red-600' : 'hover:bg-gray-200 text-gray-400'} opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity`}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={handleAddFloor}
          className="flex items-center gap-1.5 px-4 py-2.5 border-b-2 border-transparent text-gray-500 hover:bg-gray-50 font-bold cursor-pointer transition-colors whitespace-nowrap rounded-t-xl text-[16px]"
        >
          <Plus size={16} /> Add Floor
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 bg-white">
        {/* Dynamic Spaces Rendering */}
        {(() => {
          const currentFloor = floors.find(f => f.id === activeFloorId);
          if (!currentFloor) return null;
          
          const allSpaces = [
            ...(currentFloor.tables || []).map(t => ({ ...t, _origType: 'table' })),
            ...(currentFloor.cabins || []).map(c => ({ ...c, _origType: 'cabin' })),
            ...(currentFloor.sofas || []).map(s => ({ ...s, _origType: 'sofa' })),
            ...(currentFloor.spaces || []).map(sp => ({ ...sp, _origType: 'space' }))
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
              <div className="flex items-center gap-3 mb-4 group/section w-max">
                <h3 className="text-[11px] font-bold text-[#d32f2f] uppercase tracking-wider">
                  {typeName}
                </h3>
                <button 
                  onClick={(e) => handleRemoveSpaceCategory(e, typeName)}
                  className="opacity-100 md:opacity-0 md:group-hover/section:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1 rounded hover:bg-red-50"
                  title={`Delete all ${typeName}s`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="flex flex-wrap gap-4">
                {items.map((item, i) => renderSpaceCard(item, item._origType, Coffee, i))}
                {/* Inline Add Button for this category */}
                <button
                  onClick={() => setAddSpaceModal({ isOpen: true, name: '', type: typeName.charAt(0).toUpperCase() + typeName.slice(1).toLowerCase() })}
                  className="w-[160px] h-[130px] rounded-[16px] border-2 border-dashed border-gray-300 hover:border-emerald-400 hover:bg-emerald-50 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-emerald-600 transition-colors"
                >
                  <Plus size={24} />
                  <span className="text-[12px] font-bold uppercase tracking-wider text-center px-1 leading-tight">Add<br/>{typeName}</span>
                </button>
              </div>
            </section>
          ));
        })()}
      </div>

      {/* Custom Prompt Modal */}
      {promptModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl w-full max-w-md shadow-2xl p-6 transform scale-100 transition-all border border-border/50">
            <h3 className="text-xl font-bold text-text-main mb-2">{promptModal.title}</h3>
            <p className="text-sm text-text-muted mb-6">Please enter the details below.</p>
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
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-text-main font-medium mb-6"
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setPromptModal({ isOpen: false, onConfirm: null })}
                className="px-5 py-2.5 rounded-xl font-bold text-text-muted hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  promptModal.onConfirm(promptInput);
                  setPromptModal({ isOpen: false, onConfirm: null });
                }}
                className="px-5 py-2.5 rounded-xl font-bold bg-primary text-white hover:shadow-lg hover:shadow-primary/30 transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Space Modal */}
      {addSpaceModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl w-full max-w-md shadow-2xl p-6 transform scale-100 transition-all border border-border/50">
            <h3 className="text-xl font-bold text-text-main mb-2">Add New Space</h3>
            <p className="text-sm text-text-muted mb-6">Customize the space type and name.</p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Space Type</label>
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    value={addSpaceModal.type}
                    onChange={(e) => setAddSpaceModal(prev => ({ ...prev, type: e.target.value }))}
                    placeholder="e.g. Table, AC Hall, Cabin..."
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-text-main font-medium"
                  />
                  <div className="flex flex-wrap gap-2">
                    {['Table', 'Cabin', 'Sofa', 'AC Hall', 'Non AC', 'Garden'].map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => setAddSpaceModal(prev => ({ ...prev, type: suggestion }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${addSpaceModal.type.toLowerCase() === suggestion.toLowerCase() ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {suggestion}
                      </button>
                    ))}
                    <button
                      onClick={() => setAddSpaceModal(prev => ({ ...prev, type: '' }))}
                      className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
                    >
                      + Custom
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Space Name / Number</label>
                <input
                  type="text"
                  autoFocus
                  value={addSpaceModal.name}
                  onChange={(e) => setAddSpaceModal(prev => ({ ...prev, name: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitAddSpace();
                  }}
                  placeholder="e.g. 1, T1, VIP-1"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-text-main font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setAddSpaceModal({ isOpen: false, name: '', type: 'Table' })}
                className="px-5 py-2.5 rounded-xl font-bold text-text-muted hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitAddSpace}
                className="px-5 py-2.5 rounded-xl font-bold bg-primary text-white hover:shadow-lg hover:shadow-primary/30 transition-all"
              >
                Save Space
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl w-full max-w-md shadow-2xl p-6 transform scale-100 transition-all border border-border/50">
            <h3 className="text-xl font-bold text-text-main mb-3">{confirmModal.title}</h3>
            <p className="text-base text-text-muted mb-6">{confirmModal.message}</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmModal({ isOpen: false, onConfirm: null })}
                className="px-5 py-2.5 rounded-xl font-bold text-text-muted hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal({ isOpen: false, onConfirm: null });
                }}
                className="px-5 py-2.5 rounded-xl font-bold bg-danger text-white hover:shadow-lg hover:shadow-danger/30 transition-all"
              >
                Yes, Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Tables Modal */}
      {mergeModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl w-full max-w-lg shadow-2xl p-6 border border-border/60 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 font-bold">
                  <Utensils size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-text-main">Merge Table Bills</h3>
                  <p className="text-xs text-text-muted">Combine items and totals from multiple active tables into one bill.</p>
                </div>
              </div>
              <button onClick={() => setMergeModal({ isOpen: false, targetSpace: '', sourceSpaces: [] })} className="text-text-muted hover:text-text-main font-bold p-1">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              {/* Step 1: Destination Table */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                  1. Select Destination Table (Where the final combined bill will stay):
                </label>
                <select
                  value={mergeModal.targetSpace}
                  onChange={(e) => {
                    const selected = e.target.value;
                    setMergeModal(prev => ({
                      ...prev,
                      targetSpace: selected,
                      sourceSpaces: prev.sourceSpaces.filter(s => s !== selected)
                    }));
                  }}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-amber-500 font-bold text-text-main"
                >
                  <option value="">-- Choose Destination Table --</option>
                  {getActiveSpacesForMerge().map((sp, index) => (
                    <option key={`${sp.id || 'sp'}-${index}`} value={sp.orderTableNo}>
                      {sp.uniqueSpaceName} ({sp.status} - ₹{sp.total?.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Source Tables */}
              {mergeModal.targetSpace && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                    2. Select Table(s) to Merge INTO {mergeModal.targetSpace}:
                  </label>
                  <div className="space-y-2 max-h-52 overflow-y-auto border border-border/60 rounded-xl p-3 bg-background/50">
                    {getActiveSpacesForMerge()
                      .filter(sp => sp.orderTableNo !== mergeModal.targetSpace)
                      .map((sp, index) => {
                        const isChecked = mergeModal.sourceSpaces.includes(sp.orderTableNo);
                        return (
                          <label
                            key={`${sp.id || 'sp'}-${index}`}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                              isChecked 
                                ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 font-bold' 
                                : 'bg-surface border-border hover:border-amber-300 text-text-main'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setMergeModal(prev => ({ ...prev, sourceSpaces: [...prev.sourceSpaces, sp.orderTableNo] }));
                                  } else {
                                    setMergeModal(prev => ({ ...prev, sourceSpaces: prev.sourceSpaces.filter(s => s !== sp.orderTableNo) }));
                                  }
                                }}
                                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                              />
                              <div>
                                <div className="font-bold">{sp.uniqueSpaceName}</div>
                                <div className="text-xs text-text-muted uppercase font-semibold">{sp.status}</div>
                              </div>
                            </div>
                            <div className="font-black text-sm">₹{sp.total?.toLocaleString()}</div>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
              <button
                onClick={() => setMergeModal({ isOpen: false, targetSpace: '', sourceSpaces: [] })}
                className="px-5 py-2.5 rounded-xl font-bold text-text-muted hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMerge}
                disabled={!mergeModal.targetSpace || mergeModal.sourceSpaces.length === 0 || merging}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white shadow-lg transition-all ${
                  !mergeModal.targetSpace || mergeModal.sourceSpaces.length === 0 || merging
                    ? 'bg-amber-500/50 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30'
                }`}
              >
                {merging ? 'Combining Bills...' : `Confirm & Merge (${mergeModal.sourceSpaces.length} Table${mergeModal.sourceSpaces.length === 1 ? '' : 's'})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default FloorManagement;
