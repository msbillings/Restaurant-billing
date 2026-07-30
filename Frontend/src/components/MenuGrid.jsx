import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, Star, X, ChevronDown } from 'lucide-react';
import { getMenuItems, updateMenuItem } from '../api/menu';
import { getCategories } from '../api/category';

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

const MenuGrid = ({ onSelectItem, searchTerm = '' }) => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [selectedItemVariants, setSelectedItemVariants] = useState(null);
  const scrollContainerRef = useRef(null);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchItems();
  }, []);

  const fetchCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchItems = async () => {
    try {
      const data = await getMenuItems();
      setItems(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching menu:', error);
      setLoading(false);
    }
  };

  const categoryOptions = ['All', '⭐ Favourites', ...categories.map(cat => cat.name)];
  
  const filteredItems = items.filter(item => {
    let matchesCategory = false;
    if (category === 'All') {
      matchesCategory = true;
    } else if (category === '⭐ Favourites') {
      matchesCategory = item.isFavorite === true;
    } else {
      const itemCategory = item.category?.name || item.category;
      matchesCategory = itemCategory === category;
    }
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.code && item.code.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  if (loading) return (
    <div className="flex flex-col h-full bg-surface overflow-hidden">
      <div className="p-4 border-b border-border bg-surface z-10 flex flex-col gap-4 shrink-0">
        <div className="flex items-center gap-4 overflow-x-auto pb-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-6 py-2.5 rounded-full bg-surface-hover animate-pulse">
              <div className="w-16 h-4 bg-text-muted/20 rounded"></div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 bg-background/50">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-surface rounded-2xl p-5 border border-border/50 animate-pulse">
              <div className="flex justify-between items-start mb-3">
                <div className="w-3/4 h-5 bg-text-muted/20 rounded"></div>
                <div className="w-3 h-3 bg-text-muted/20 rounded-full"></div>
              </div>
              <div className="w-full h-4 bg-text-muted/20 rounded mb-2"></div>
              <div className="w-2/3 h-4 bg-text-muted/20 rounded mb-4"></div>
              <div className="flex items-center justify-between pt-4 border-t border-dashed border-border/50">
                <div className="w-12 h-5 bg-text-muted/20 rounded"></div>
                <div className="w-10 h-10 bg-text-muted/20 rounded-xl"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-row h-full bg-white overflow-hidden">
      {/* Left Sidebar: Categories */}
      <div className="w-[120px] md:w-[140px] lg:w-[150px] flex flex-col bg-[#636c75] shrink-0 h-full overflow-y-auto overflow-x-hidden hide-scrollbar border-r border-gray-400">
        <div className="flex flex-col w-full">
          {categoryOptions.map((cat, idx) => {
            const isSelected = category === cat;
            // First item (Fast Food) gets blue, second gets green in Petpooja, but let's just make selected blue.
            const bgClass = isSelected ? (idx % 2 === 0 ? 'bg-[#00bcd4]' : 'bg-[#4caf50]') : 'bg-transparent hover:bg-white/10';
            return (
              <button 
                key={cat}
                className={`w-full text-left px-2 py-3 font-semibold text-[13px] transition-colors border-b border-gray-500 flex items-center justify-between ${bgClass} text-white`}
                onClick={() => setCategory(cat)}
              >
                <span className="truncate pr-1">{cat === '⭐ Favourites' ? 'Favorite Items' : cat}</span>
                {isSelected && <ChevronDown size={14} className="text-white shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Items Grid Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#e0e0e0]">
        
        {/* Search Bar Row */}
        <div className="flex items-center bg-white border-b border-gray-300 h-12 shrink-0">
          <div className="flex-1 flex items-center h-full px-3 border-r border-gray-300">
            <Search size={16} className="text-gray-400 mr-2" />
            <input 
              type="text"
              placeholder="Search item"
              value={searchTerm}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              className="w-full h-full bg-transparent outline-none text-sm font-medium text-gray-700 placeholder-gray-400"
            />
          </div>
          <div className="w-[140px] flex items-center h-full px-3 bg-gray-100">
            <input 
              type="text"
              placeholder="Short Code"
              className="w-full h-full bg-transparent outline-none text-sm font-medium text-gray-600 placeholder-gray-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 relative">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {filteredItems.map(item => {
            const typeColor = item.type === 'veg' ? 'border-l-green-500' : (item.type === 'non-veg' ? 'border-l-red-500' : 'border-l-gray-300');
            return (
            <div
              key={item._id}
              className={`bg-white cursor-pointer transition-all hover:bg-gray-50 border border-gray-200 border-l-[3px] ${typeColor} flex flex-col h-[90px] p-2 relative`}
              onClick={() => {
                if (item.variants && item.variants.length > 0) {
                  setSelectedItemVariants(item);
                } else {
                  onSelectItem(item);
                }
              }}
            >
              <div className="flex-1 text-[13px] font-semibold text-gray-700 leading-tight">
                {item.name}
              </div>
              <div className="text-xs font-bold text-gray-500 flex justify-end">
                {item.price ? `${item.price.toFixed(2)}` : ''}
              </div>
            </div>
            );
          })}

          {category === '⭐ Favourites' && filteredItems.length === 0 && (
            <div className="col-span-full py-16 text-center flex flex-col items-center justify-center bg-surface rounded-2xl border border-dashed border-border/60">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4">
                <Star size={32} className="fill-amber-500/20" />
              </div>
              <h3 className="text-lg font-bold text-text-main mb-1">No Favourites Added Yet</h3>
              <p className="text-text-muted text-sm max-w-md">
                Hover over any menu item under "All" or other categories and click the <Star size={14} className="inline text-amber-500 fill-amber-500 mx-0.5" /> star icon in the top right corner to add it right here for instant billing!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Variant Selection Modal */}
      {selectedItemVariants && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-sm rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
              <h2 className="text-xl font-bold text-text-main pr-4 leading-tight">Select Size <br/><span className="text-sm font-normal text-text-muted">{selectedItemVariants.name}</span></h2>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedItemVariants(null);
                }}
                className="text-text-muted hover:text-text-main hover:bg-surface-hover rounded-full p-2 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
              {selectedItemVariants.variants.map((variant, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectItem({
                      ...selectedItemVariants,
                      _id: `${selectedItemVariants._id}-${variant.name}`,
                      originalId: selectedItemVariants._id,
                      name: `${selectedItemVariants.name} (${variant.name})`,
                      price: variant.price
                    });
                    setSelectedItemVariants(null);
                  }}
                  className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group shadow-sm hover:shadow-md"
                >
                  <span className="font-bold text-lg text-text-main group-hover:text-primary transition-colors">{variant.name}</span>
                  <span className="font-black text-xl text-text-main bg-background px-3 py-1 rounded-lg border border-border group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-colors">₹{variant.price}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuGrid;
