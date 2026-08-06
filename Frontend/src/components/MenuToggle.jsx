import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import { getMenuItems, updateMenuItem } from '../api/menu';
import { ToggleLeft, Search, CheckCircle, XCircle } from 'lucide-react';

const MenuToggle = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const fetchMenuItems = async () => {
    try {
      setLoading(true);
      const data = await getMenuItems(true); // force refresh so we always get latest
      setMenuItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching menu items:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = async (id, currentStatus) => {
    try {
      // Optimistic UI update
      setMenuItems((prev) => prev.map((item) => item._id === id ? { ...item, isAvailable: !currentStatus } : item));
      await updateMenuItem(id, { isAvailable: !currentStatus });
    } catch (error) {
      console.error('Error updating availability:', error);
      // Revert on failure
      setMenuItems((prev) => prev.map((item) => item._id === id ? { ...item, isAvailable: currentStatus } : item));
      alert('Failed to update availability');
    }
  };

  const filteredItems = menuItems.filter((item) =>
  item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-gray-50 p-3 sm:p-6 overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-base sm:text-xl font-bold text-gray-800 flex items-center gap-2">
              <ToggleLeft className="text-primary" size={20} />{t("Menu Item On/Off")}
            </h1>
            <p className="text-xs text-gray-500">{t("Quickly toggle availability of items to mark them out of stock")}</p>
          </div>
        </div>
        
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text" placeholder={t("Search items...")}

            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-primary shadow-xs" />
          
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-y-auto p-3 sm:p-4">
        {loading ?
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div> :

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {filteredItems.map((item) =>
          <div
            key={item._id}
            className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
            item.isAvailable ? 'bg-white border-gray-200 hover:border-primary/50' : 'bg-red-50 border-red-200'}`
            }>
            
                <div className="flex-1 min-w-0 pr-4">
                  <h3 className={`font-bold truncate ${item.isAvailable ? 'text-gray-800' : 'text-red-700 line-through opacity-70'}`}>
                    {item.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-bold text-gray-600">₹{item.price}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                item.type === 'veg' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`
                }>
                      {item.type}
                    </span>
                  </div>
                </div>
                
                <button
              onClick={() => toggleAvailability(item._id, item.isAvailable)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${
              item.isAvailable ? 'bg-green-500' : 'bg-gray-300'}`
              }>
              
                  <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                item.isAvailable ? 'translate-x-7' : 'translate-x-1'}`
                } />
              
                </button>
              </div>
          )}
            
            {filteredItems.length === 0 &&
          <div className="col-span-full py-12 text-center text-gray-500">{t("No menu items found.")}

          </div>
          }
          </div>
        }
      </div>
    </div>);

};

export default MenuToggle;