import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, LayoutGrid } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const TableDropdown = ({ floors, activeTable, onSelect, align = 'left' }) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [activeFloor, setActiveFloor] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setActiveFloor(null);
        setActiveCategory(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectTable = (tableName) => {
    onSelect(tableName);
    setIsOpen(false);
    setActiveFloor(null);
    setActiveCategory(null);
  };

  const getCategories = (floor) => {
    const cats = [];
    if (floor.tables?.length > 0) cats.push({ type: 'Table', items: floor.tables, name: t('table') || 'Table' });
    if (floor.cabins?.length > 0) cats.push({ type: 'Cabin', items: floor.cabins, name: t('cabin') || 'Cabin' });
    if (floor.sofas?.length > 0) cats.push({ type: 'Sofa', items: floor.sofas, name: t('sofa') || 'Sofa' });
    return cats;
  };

  const renderCurrentTable = () => {
    if (activeTable) return activeTable;
    return t('selectTable') || 'Select Table';
  };

  return (
    <div className="relative z-50 w-full h-full flex items-center justify-center" ref={dropdownRef}>
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="flex items-center justify-center w-full h-full gap-2 bg-transparent font-bold focus:outline-none text-sm py-1 cursor-pointer"
      >
        <span>{renderCurrentTable()}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-2xl py-1 text-sm font-medium text-gray-700 max-h-[60vh] overflow-visible z-50`}>
          {floors.length === 0 ? (
            // Default 20 tables if no floors
            <div className="max-h-60 overflow-y-auto">
              {[...Array(20)].map((_, i) => {
                const num = String(i + 1).padStart(2, '0');
                return (
                  <div
                    key={i}
                    onClick={() => handleSelectTable(`TBL-${num}`)}
                    className="px-4 py-2 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                  >
                    {t('table')} {num}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Floor List */}
              <div className="w-full">
                {floors.map((floor, idx) => {
                  const categories = getCategories(floor);
                  if (categories.length === 0) return null;
                  const isHovered = activeFloor === floor.id;

                  return (
                    <div
                      key={floor.id || idx}
                      onMouseEnter={() => { setActiveFloor(floor.id); setActiveCategory(null); }}
                      className={`relative px-4 py-2 flex items-center justify-between cursor-pointer ${isHovered ? 'bg-red-50 text-red-600' : 'hover:bg-red-50 hover:text-red-600'}`}
                    >
                      <span>{floor.name}</span>
                      <ChevronRight size={14} />

                      {/* Category List (Sub Menu 1) */}
                      {isHovered && (
                        <div className={`absolute top-0 ${align === 'right' ? 'right-full' : 'left-full'} w-32 bg-white border border-gray-200 rounded-lg shadow-xl py-1 text-gray-700 min-h-full z-10`} style={{ marginTop: '-4px' }}>
                          {categories.map((cat, catIdx) => {
                            const isCatHovered = activeCategory === cat.type;
                            return (
                              <div
                                key={catIdx}
                                onMouseEnter={() => setActiveCategory(cat.type)}
                                className={`relative px-4 py-2 flex items-center justify-between cursor-pointer ${isCatHovered ? 'bg-red-50 text-red-600' : 'hover:bg-red-50 hover:text-red-600'}`}
                              >
                                {align === 'right' && <ChevronRight size={14} className="rotate-180" />}
                                <span>{cat.name}</span>
                                {align !== 'right' && <ChevronRight size={14} />}

                                {/* Table List (Sub Menu 2) */}
                                {isCatHovered && (
                                  <div className={`absolute top-0 ${align === 'right' ? 'right-full' : 'left-full'} w-40 bg-white border border-gray-200 rounded-lg shadow-xl py-1 text-gray-700 max-h-60 overflow-y-auto z-20`} style={{ marginTop: '-4px' }}>
                                    {cat.items.map((item, itemIdx) => (
                                      <div
                                        key={itemIdx}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSelectTable(item.name);
                                        }}
                                        className="px-4 py-2 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                                      >
                                        {item.name}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TableDropdown;
