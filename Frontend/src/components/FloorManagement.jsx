import React, { useState, useEffect } from 'react';
import { getOpenOrders, mergeTableOrders } from '../api/billing';
import { Plus, Coffee, Home, Trash2, Sofa, Utensils, CheckCircle, Clock } from 'lucide-react';
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
  const [merging, setMerging] = useState(false);

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
      tables: [{ id: 't1', name: 'Table 1' }, { id: 't2', name: 'Table 2' }, { id: 't3', name: 'Table 3' }],
      cabins: [{ id: 'c1', name: 'Cabin 1' }, { id: 'c2', name: 'Cabin 2' }],
      sofas: [{ id: 's1', name: 'Sofa 1' }]
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

  const syncSpaces = async () => {
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

  const fetchOrders = async () => {
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

  const handleAddSpace = (type) => {
    if (!activeFloorId) return;
    setPromptInput('');
    setPromptModal({
      isOpen: true,
      title: `Add New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      placeholder: `Enter name for new ${type}`,
      onConfirm: (name) => {
        if (name && name.trim() !== '') {
          setFloors(prev => {
            const next = prev.map(floor => {
              if (floor.id === activeFloorId) {
                const key = type + 's';
                return {
                  ...floor,
                  [key]: [...(floor[key] || []), { id: Date.now().toString(), name: name.trim() }]
                };
              }
              return floor;
            });
            saveSpacesToCloud(next);
            return next;
          });
          setToast({ message: `${type} added successfully!`, type: 'success' });
        }
      }
    });
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
              return {
                ...floor,
                [key]: floor[key].filter(item => item.id !== id)
              };
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
      ['tables', 'cabins', 'sofas'].forEach(type => {
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
      showToast('Please select a destination table and at least one table to merge from.', 'error');
      return;
    }
    const destination = mergeModal.targetSpace;
    const sources = mergeModal.sourceSpaces;
    // Instantly close modal right on button click
    setMergeModal({ isOpen: false, targetSpace: '', sourceSpaces: [] });
    setMerging(true);
    try {
      await mergeTableOrders(destination, sources);
      showToast(`Successfully combined table bills into ${destination}!`, 'success');
      await fetchOrders();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to merge table bills.', 'error');
      await fetchOrders();
    } finally {
      setMerging(false);
    }
  };

  const renderSpaceCard = (item, type, IconComponent) => {
    const currentFloor = floors.find(f => f.id === activeFloorId);
    const uniqueSpaceName = currentFloor ? `${currentFloor.name} - ${item.name}` : item.name;

    // Dynamically calculate status from real-time orders instead of static item status
    const activeOrder = getSpaceOrder(uniqueSpaceName);
    const isOccupied = !!activeOrder;

    let statusColor = 'emerald';
    let statusText = 'Available';

    if (activeOrder) {
      if (activeOrder.status === 'Open') {
        statusColor = 'orange';
        statusText = 'Occupied';
      } else if (activeOrder.status === 'Billed') {
        statusColor = 'red';
        statusText = 'Billed';
      }
    } else if (item.status === 'Reserved') {
      statusColor = 'gray';
      statusText = 'Reserved';
    }
    return (
      <div
        key={item.id}
        onClick={() => handleSpaceClick(uniqueSpaceName)}
        className={`group relative flex flex-col justify-between p-3.5 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-1 ${isOccupied
          ? `bg-${statusColor}-50/80 border-${statusColor}-200 hover:border-${statusColor}-400`
          : 'bg-emerald-50/80 border-emerald-200 hover:border-emerald-400'
          }`}
      >
        <div className="flex justify-between items-start mb-3 sm:mb-4">
          <div className={`p-2 sm:p-2.5 rounded-xl ${isOccupied ? `bg-${statusColor}-200/50 text-${statusColor}-600` : 'bg-emerald-200/50 text-emerald-600'}`}>
            <IconComponent size={20} className="sm:w-6 sm:h-6" />
          </div>
          <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider ${isOccupied ? `bg-${statusColor}-100 text-${statusColor}-700` : 'bg-emerald-100 text-emerald-700'
            }`}>
            {statusText}
          </span>
        </div>

        <div>
          <h3 className="text-base sm:text-lg font-bold text-text-main mb-1 truncate">{item.name}</h3>
          {isOccupied ? (
            <div className={`flex flex-col gap-1 text-xs sm:text-sm text-${statusColor}-700 font-semibold mt-1`}>
              <div className="flex items-center justify-between bg-white/80 dark:bg-black/30 px-2.5 py-1.5 rounded-lg border border-border/40 shadow-2xs">
                <span className="font-extrabold text-base text-text-main">₹{activeOrder.total?.toLocaleString() || 0}</span>
                <span className="text-[11px] font-bold opacity-85">({activeOrder.items?.reduce((s, i) => s + (Number(i.quantity) || 1), 0) || activeOrder.items?.length || 0} items)</span>
              </div>
              <div className="flex items-center gap-1.5 opacity-80 text-[11px] mt-0.5">
                <Clock size={12} />
                <span>Active Table</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-emerald-600 font-medium mt-2">
              <CheckCircle size={13} className="sm:w-3.5 sm:h-3.5" />
              <span>Available</span>
            </div>
          )}
        </div>

        <button
          onClick={(e) => handleRemoveSpace(e, type, item.id)}
          className="absolute -top-3 -right-3 bg-danger text-white rounded-full p-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-lg hover:scale-110"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-6 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-text-main flex items-center gap-3">
            <Home className="text-primary" />
            Floor Management
          </h2>
          <p className="text-text-muted mt-1 text-sm">Manage your tables, cabins, and see real-time occupancy.</p>
        </div>
        {getActiveSpacesForMerge().length >= 2 && (
          <button
            onClick={() => setMergeModal({ isOpen: true, targetSpace: '', sourceSpaces: [] })}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all transform hover:-translate-y-0.5"
          >
            <Utensils size={18} />
            <span>Merge Table Bills</span>
          </button>
        )}
      </div>

      <div className="px-6 pt-4 border-b border-border bg-background flex gap-2 overflow-x-auto">
        {floors.map(floor => (
          <div
            key={floor.id}
            onClick={() => setActiveFloorId(floor.id)}
            className={`group relative flex items-center gap-2 px-5 py-3 border-b-2 font-bold cursor-pointer transition-colors whitespace-nowrap ${activeFloorId === floor.id
              ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
              : 'border-transparent text-text-muted hover:text-text-main hover:bg-surface-hover rounded-t-xl'
              }`}
          >
            {floor.name}
            {floors.length > 1 && (
              <button
                onClick={(e) => handleRemoveFloor(e, floor.id)}
                className={`p-1 rounded-full ${activeFloorId === floor.id ? 'hover:bg-primary/20 text-primary' : 'hover:bg-border text-text-muted'} opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity`}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={handleAddFloor}
          className="flex items-center gap-2 px-5 py-3 border-b-2 border-transparent text-text-muted hover:text-primary font-bold cursor-pointer transition-colors whitespace-nowrap rounded-t-xl"
        >
          <Plus size={16} /> Add Floor
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8">

        {/* Tables Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
              <Coffee className="text-primary" size={20} />
              Dining Tables
            </h3>
            <button onClick={() => handleAddSpace('table')} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-colors font-semibold text-sm">
              <Plus size={16} /> Add Table
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {floors.find(f => f.id === activeFloorId)?.tables?.map(table => renderSpaceCard(table, 'table', Coffee))}
          </div>
        </section>

        {/* Cabins Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
              <Home className="text-accent" size={20} />
              Private Cabins
            </h3>
            <button onClick={() => handleAddSpace('cabin')} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent hover:bg-accent hover:text-white rounded-lg transition-colors font-semibold text-sm">
              <Plus size={16} /> Add Cabin
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {floors.find(f => f.id === activeFloorId)?.cabins?.map(cabin => renderSpaceCard(cabin, 'cabin', Home))}
          </div>
        </section>

        {/* Sofas Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
              <Sofa className="text-secondary" size={20} />
              Sofa Lounge
            </h3>
            <button onClick={() => handleAddSpace('sofa')} className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/10 text-secondary hover:bg-secondary hover:text-white rounded-lg transition-colors font-semibold text-sm">
              <Plus size={16} /> Add Sofa
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {floors.find(f => f.id === activeFloorId)?.sofas?.map(sofa => renderSpaceCard(sofa, 'sofa', Sofa))}
          </div>
        </section>

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
                  {getActiveSpacesForMerge().map(sp => (
                    <option key={sp.id} value={sp.orderTableNo}>
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
                      .map(sp => {
                        const isChecked = mergeModal.sourceSpaces.includes(sp.orderTableNo);
                        return (
                          <label
                            key={sp.id}
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
