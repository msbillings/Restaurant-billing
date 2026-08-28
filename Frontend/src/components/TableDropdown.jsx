import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, LayoutGrid } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const TableDropdown = ({ floors, activeTable, onSelect, align = 'left', customButton, wrapperClass, openOrders = [], reservations = [] }) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectTable = (tableName) => {
    onSelect(tableName);
    setIsOpen(false);
  };

  const getTableStatus = (tableName) => {
    // Check busy
    const isBusyNow = openOrders.some(order => {
      if (!order || order.status === 'Cancelled' || order.status === 'Paid') return false;
      const activeItems = (order.items || []).filter(i => !i.isCancelled && (i.quantity - (i.cancelledQuantity || 0)) > 0);
      if (activeItems.length === 0) return false;
      const oTable = order.tableNo ? order.tableNo.trim().toLowerCase() : '';
      const tName = tableName.trim().toLowerCase();
      return oTable === tName || oTable.includes(tName) || tName.includes(oTable);
    });

    if (isBusyNow) return 'Busy';

    // Check reserved for today
    const todayString = new Date().toISOString().split('T')[0];
    const isReserved = reservations.some(res => {
      if (res.status === 'cancelled' || res.status === 'completed' || res.status === 'no-show') return false;
      const resTable = res.tableType ? res.tableType.toLowerCase() : '';
      const tName = tableName.trim().toLowerCase();
      const matchesTable = resTable === tName || tName.includes(resTable) || resTable.includes(tName);
      const resDateStr = new Date(res.date).toISOString().split('T')[0];
      return resDateStr === todayString && matchesTable;
    });

    if (isReserved) return 'Reserved';

    return 'Empty';
  };

  const renderStatusBadge = (status) => {
    if (status === 'Busy') return <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold ml-2">(Busy)</span>;
    if (status === 'Reserved') return <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold ml-2">(Reserved)</span>;
    return <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold ml-2">(Empty)</span>;
  };

  const renderCurrentTable = () => {
    if (activeTable) return activeTable;
    return t('selectTable') || 'Select Table';
  };

  return (
    <div className={wrapperClass || "relative z-20 w-full h-full flex items-center justify-center"} ref={dropdownRef}>
      {customButton ? (
        <div onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className="w-full h-full cursor-pointer">
          {customButton}
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          className="flex items-center justify-center w-full h-full gap-2 bg-transparent font-bold focus:outline-none text-sm py-1 cursor-pointer"
        >
          <span>{renderCurrentTable()}</span>
          <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      )}

      {isOpen && (
        <div className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 w-56 sm:w-64 bg-white border border-gray-200 rounded-xl shadow-2xl py-1 text-sm font-medium text-gray-700 max-h-[60vh] overflow-hidden z-50 ring-1 ring-black/5`}>
          {floors.length === 0 ? (
            // Default 20 tables if no floors
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
              {[...Array(20)].map((_, i) => {
                const num = String(i + 1).padStart(2, '0');
                return (
                  <div
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectTable(`TBL-${num}`);
                    }}
                    className="px-4 py-2 hover:bg-red-50 hover:text-red-600 cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 group-hover:text-red-600">TBL-{num}</span>
                      {renderStatusBadge(getTableStatus(`TBL-${num}`))}
                    </div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide group-hover:text-red-400">({t('table') || 'Table'})</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col max-h-[60vh] overflow-y-auto custom-scrollbar">
              {floors.map((floor, idx) => {
                const hasItems = floor.tables?.length > 0 || floor.cabins?.length > 0 || floor.sofas?.length > 0 || floor.spaces?.length > 0;
                if (!hasItems) return null;

                return (
                  <div key={floor.id || idx} className="flex flex-col">
                    {/* Floor Header (Sticky like optgroup) */}
                    <div className="sticky top-0 z-10 px-3 py-1.5 bg-gray-50 text-gray-500 font-bold text-xs uppercase tracking-wider border-b border-t border-gray-200 mt-1 first:mt-0">
                      {floor.name}
                    </div>

                    {/* All items for this floor */}
                    {floor.tables?.map((item, itemIdx) => (
                      <div
                        key={`t-${itemIdx}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectTable(`${floor.name} - ${item.name}`);
                        }}
                        className="px-4 py-2 hover:bg-red-50 hover:text-red-600 cursor-pointer text-sm flex items-center justify-between group"
                      >
                        <div className="flex items-center">
                          <span className="font-medium text-gray-700 group-hover:text-red-600">{item.name}</span>
                          {renderStatusBadge(getTableStatus(`${floor.name} - ${item.name}`))}
                        </div>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide group-hover:text-red-400">({t('table') || 'Table'})</span>
                      </div>
                    ))}
                    {floor.cabins?.map((item, itemIdx) => (
                      <div
                        key={`c-${itemIdx}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectTable(`${floor.name} - ${item.name}`);
                        }}
                        className="px-4 py-2 hover:bg-red-50 hover:text-red-600 cursor-pointer text-sm flex items-center justify-between group"
                      >
                        <div className="flex items-center">
                          <span className="font-medium text-gray-700 group-hover:text-red-600">{item.name}</span>
                          {renderStatusBadge(getTableStatus(`${floor.name} - ${item.name}`))}
                        </div>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide group-hover:text-red-400">({t('cabin') || 'Cabin'})</span>
                      </div>
                    ))}
                    {floor.sofas?.map((item, itemIdx) => (
                      <div
                        key={`s-${itemIdx}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectTable(`${floor.name} - ${item.name}`);
                        }}
                        className="px-4 py-2 hover:bg-red-50 hover:text-red-600 cursor-pointer text-sm flex items-center justify-between group"
                      >
                        <div className="flex items-center">
                          <span className="font-medium text-gray-700 group-hover:text-red-600">{item.name}</span>
                          {renderStatusBadge(getTableStatus(`${floor.name} - ${item.name}`))}
                        </div>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide group-hover:text-red-400">({t('sofa') || 'Sofa'})</span>
                      </div>
                    ))}
                    {floor.spaces?.map((item, itemIdx) => (
                      <div
                        key={`sp-${itemIdx}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectTable(`${floor.name} - ${item.name}`);
                        }}
                        className="px-4 py-2 hover:bg-red-50 hover:text-red-600 cursor-pointer text-sm flex items-center justify-between group"
                      >
                        <div className="flex items-center">
                          <span className="font-medium text-gray-700 group-hover:text-red-600">{item.name}</span>
                          {renderStatusBadge(getTableStatus(`${floor.name} - ${item.name}`))}
                        </div>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide group-hover:text-red-400">({t(item.type || 'space') || item.type || 'Space'})</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TableDropdown;
