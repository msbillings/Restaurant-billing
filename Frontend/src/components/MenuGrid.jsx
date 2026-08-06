import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, Star, X, ChevronDown, Image as ImageIcon,
Pizza, Sandwich, UtensilsCrossed, Flame, Gift, Menu as MenuIcon, Utensils,
Users, Smile, Soup, Popcorn, Scroll, Beef, Cookie, Plus } from
'lucide-react';
import { getMenuItems, updateMenuItem } from '../api/menu';
import { getCategories } from '../api/category';

const getCategoryIcon = (catName, isSelected = false) => {
  const name = catName.toLowerCase();
  const baseColor = isSelected ? 'text-white' : 'text-gray-500';
  if (name === 'all') return <MenuIcon size={20} className={`shrink-0 ${baseColor}`} />;
  if (catName === '⭐ Favourites' || name.includes('favorite')) return <Star size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-yellow-500'}`} />;

  if (name.includes('kids')) return <Smile size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-pink-500'}`} />;
  if (name.includes('pizza')) return <Pizza size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-orange-500'}`} />;
  if (name.includes('burger')) return <Beef size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-amber-700'}`} />;
  if (name.includes('sandwich')) return <Sandwich size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-amber-500'}`} />;
  if (name.includes('wrap') || name.includes('shawarma') || name.includes('roll')) return <Scroll size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-amber-600'}`} />;
  if (name.includes('rice') || name.includes('biryani') || name.includes('bowl')) return <Soup size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-orange-600'}`} />;
  if (name.includes('fried') || name.includes('spicy')) return <Flame size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-red-500'}`} />;
  if (name.includes('snack')) return <Popcorn size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-yellow-500'}`} />;
  if (name.includes('buddy') || name.includes('family') || name.includes('combo')) return <Users size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-blue-500'}`} />;
  if (name.includes('meal')) return <UtensilsCrossed size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-blue-600'}`} />;
  if (name.includes('offer') || name.includes('weekly')) return <Gift size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-purple-500'}`} />;

  // Generate a deterministic random icon and color for unhandled categories
  const icons = [Utensils, Cookie, Star, Smile, Flame, Popcorn, Soup, Pizza, Sandwich, Scroll, Beef, Gift, UtensilsCrossed];
  const colors = ['text-red-500', 'text-blue-500', 'text-green-500', 'text-yellow-500', 'text-purple-500', 'text-pink-500', 'text-indigo-500', 'text-teal-500', 'text-orange-500', 'text-cyan-500'];
  
  let hash = 0;
  for (let i = 0; i < catName.length; i++) {
    hash = catName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const IconComponent = icons[Math.abs(hash) % icons.length];
  const colorClass = colors[Math.abs(hash) % colors.length];

  return <IconComponent size={20} className={`shrink-0 ${isSelected ? 'text-white' : colorClass}`} />;
};

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
    if (trimmed.startsWith('iVBOR')) mime = 'png';else
    if (trimmed.startsWith('R0lGOD')) mime = 'gif';else
    if (trimmed.startsWith('UklGR')) mime = 'webp';
    return `data:image/${mime};base64,${trimmed}`;
  }
  return trimmed;
};

import { useLanguage } from "../context/LanguageContext";

const MenuGrid = ({ onSelectItem, searchTerm = '', onSearchChange, isLayoutLocked = false, onNavigate, userRole = 'Admin' }) => {const { t, language } = useLanguage();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState('latest');
  const [selectedItemVariants, setSelectedItemVariants] = useState(null);
  const [showImages, setShowImages] = useState(() => {
    const saved = localStorage.getItem('menuGrid_showImages');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const scrollContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  const [leftSidebarWidth, setLeftSidebarWidth] = useState(260);
  const isResizingLeft = useRef(false);

  const startResizingLeft = React.useCallback((e) => {
    isResizingLeft.current = true;
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  }, []);

  const stopResizingLeft = React.useCallback(() => {
    if (isResizingLeft.current) {
      isResizingLeft.current = false;
      document.body.style.cursor = 'default';
    }
  }, []);

  const resizeLeft = React.useCallback((e) => {
    if (isResizingLeft.current) {
      // MenuGrid is probably offset from left side (e.g. main nav), 
      // but usually the mouse clientX correlates well enough for width if it starts at 0,
      // but it doesn't. We should calculate width using getBoundingClientRect if needed,
      // but clientX is usually okay if MenuGrid is full width. Wait, there is a leftmost main menu nav!
      // The main nav is usually 60-80px. Let's just use movementX or calculate absolute.
      // e.movementX works, but let's just use setLeftSidebarWidth(prev => prev + e.movementX)
      // to avoid absolute positioning issues!
      setLeftSidebarWidth((prev) => {
        const newWidth = prev + e.movementX;
        if (newWidth > 150 && newWidth < 500) return newWidth;
        return prev;
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resizeLeft);
    window.addEventListener('mouseup', stopResizingLeft);
    return () => {
      window.removeEventListener('mousemove', resizeLeft);
      window.removeEventListener('mouseup', stopResizingLeft);
    };
  }, [resizeLeft, stopResizingLeft]);

  useEffect(() => {
    localStorage.setItem('menuGrid_showImages', JSON.stringify(showImages));
  }, [showImages]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Ignore if user is already typing in an input or textarea
      if (
      document.activeElement && (
      document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA'))
      {
        return;
      }

      // Auto-focus search if a regular character is typed (length === 1) without modifier keys
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleToggleFavorite = async (e, item) => {
    e.stopPropagation();
    const newIsFavorite = !item.isFavorite;

    // Optimistic update
    setItems(items.map((i) => i._id === item._id ? { ...i, isFavorite: newIsFavorite } : i));

    try {
      if (updateMenuItem) {
        await updateMenuItem(item._id, { isFavorite: newIsFavorite });
      }
    } catch (error) {
      console.error('Failed to update favorite status', error);
      // Revert on error
      setItems(items.map((i) => i._id === item._id ? { ...i, isFavorite: !newIsFavorite } : i));
    }
  };


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

  useEffect(() => {
    fetchCategories();
    fetchItems();
  }, []);

  const validCategories = categories.filter((cat) => {
    return items.some((item) => {
      const itemCategory = item.category?.name || item.category;
      return itemCategory === cat.name;
    });
  });
  const categoryOptions = ['All', '⭐ Favourites', ...validCategories.map((cat) => cat.name)];

  const filteredItems = items.filter((item) => {
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
    item.code && item.code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'latest':
        return new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0);
      case 'oldest':
        return new Date(a.createdAt || a.updatedAt || 0) - new Date(b.createdAt || b.updatedAt || 0);
      case 'alphaAsc':
        return a.name.localeCompare(b.name);
      case 'alphaDesc':
        return b.name.localeCompare(a.name);
      case 'priceAsc':
        return a.price - b.price;
      case 'priceDesc':
        return b.price - a.price;
      default:
        return 0;
    }
  });

  if (loading) return (
    <div className="flex flex-col h-full bg-surface overflow-hidden">
      <div className="p-4 border-b border-border bg-surface z-10 flex flex-col gap-4 shrink-0">
        <div className="flex items-center gap-4 overflow-x-auto pb-2">
          {[...Array(6)].map((_, i) =>
          <div key={i} className="px-6 py-2.5 rounded-full bg-surface-hover animate-pulse">
              <div className="w-16 h-4 bg-text-muted/20 rounded"></div>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 bg-background/50">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-6">
          {[...Array(8)].map((_, i) =>
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
          )}
        </div>
      </div>
    </div>);


  return (
    <div className="flex flex-col md:flex-row h-full bg-white overflow-hidden w-full">
      {/* Mobile Top Category Scrollbar (Visible on small screens) */}
      <div className="flex md:hidden overflow-x-auto category-scroll py-2 px-3 bg-gray-50 border-b border-gray-200 shrink-0 gap-2 w-full no-scrollbar">
        {categoryOptions.map((cat) => {
          const isSelected = category === cat;
          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all shadow-xs ${
                isSelected
                  ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}>
              {getCategoryIcon(cat, isSelected)}
              <span>{cat === '⭐ Favourites' ? t('Favorite Items') : t(cat.replace('⭐ ', ''))}</span>
            </button>
          );
        })}
      </div>

      {/* Desktop Left Sidebar: Categories (Hidden on mobile) */}
      <div
        style={{ width: leftSidebarWidth }}
        className="hidden md:flex flex-col bg-white shrink-0 h-full overflow-y-auto overflow-x-hidden hide-scrollbar py-3 border-r border-gray-200">
        <div className="flex flex-col w-full gap-1">
          {categoryOptions.map((cat) => {
            const isSelected = category === cat;
            const bgClass = isSelected ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-md rounded-xl mx-2 font-bold' : 'bg-transparent text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-xl mx-2 font-bold';
            return (
              <button
                key={cat}
                className={`w-full text-left px-4 py-3 text-[15px] transition-all flex items-center justify-between ${bgClass}`}
                onClick={() => setCategory(cat)}>
                <div className="flex items-center gap-3 flex-1 min-w-0 pr-1 truncate">
                  {getCategoryIcon(cat, isSelected)}
                  <span className="truncate font-medium">{cat === '⭐ Favourites' ? t('Favorite Items') : t(cat.replace('⭐ ', ''))}</span>
                </div>
                {isSelected && <ChevronRight size={18} className="text-white shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Left Sidebar Drag Handle (Desktop only) */}
      {!isLayoutLocked && (
        <div
          onMouseDown={startResizingLeft}
          className="hidden md:block w-1.5 cursor-col-resize hover:bg-primary/50 bg-transparent shrink-0 z-40 transition-colors border-r border-gray-200 hover:border-transparent relative" />
      )}
      
      {/* Items Grid Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        
        {/* Search Bar Row */}
        <div className="flex items-center bg-gray-50 border-b border-gray-200 h-15 shrink-0 px-3 gap-3">
          <div className="flex-1 flex items-center h-10.5 px-4 bg-white rounded-xl border border-gray-200 shadow-sm focus-within:border-red-500 transition-all">
            <Search size={16} className="text-gray-400 mr-2 shrink-0" />
            <input
              ref={searchInputRef}
              type="text" placeholder={t("Search item")}

              value={searchTerm}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              className="w-full h-full bg-transparent border-none focus:border-none focus:ring-0 outline-none focus:outline-none shadow-none! text-[15px] font-medium text-gray-700 placeholder-gray-400"
              style={{ outline: 'none', boxShadow: 'none', border: 'none' }} />
            
          </div>

          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-10.5 px-3 border border-gray-200 rounded-xl bg-white text-gray-700 text-[13px] font-bold focus:outline-none focus:border-red-500 transition-all shadow-sm cursor-pointer"
          >
            <option value="latest">{t("Latest")}</option>
            <option value="oldest">{t("Oldest")}</option>
            <option value="alphaAsc">{t("A-Z")}</option>
            <option value="alphaDesc">{t("Z-A")}</option>
            <option value="priceAsc">{t("Price: Low-High")}</option>
            <option value="priceDesc">{t("Price: High-Low")}</option>
          </select>

          {userRole === 'Admin' && (
            <button
              onClick={() => onNavigate && onNavigate('menu')}
              className="flex items-center justify-center h-10.5 px-3 rounded-xl bg-red-500 text-white shadow-sm hover:bg-red-600 transition-all gap-1.5 font-bold text-[13px] whitespace-nowrap"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">{t("Add Item")}</span>
            </button>
          )}
          
          <button
            onClick={() => setShowImages(!showImages)}
            className={`flex items-center justify-center h-10.5 px-3 sm:px-4 rounded-xl border shadow-sm transition-all gap-2 font-bold text-[13px] ${showImages ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
            
            <ImageIcon size={16} />
            <span className="hidden sm:inline">{showImages ? t('Images: On') : t('Images: Off')}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 relative bg-gray-50 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredItems.map((item) => {
              const isAvailable = item.isAvailable !== false; // default to true if undefined

              // Nice color dot instead of full border
              const dotColor = item.type === 'veg' ? 'bg-green-500 shadow-sm border border-green-200' : item.type === 'non-veg' ? 'bg-red-500 shadow-sm border border-red-200' : 'bg-gray-300';

              return (
                <div
                  key={item._id}
                  className={`bg-white transition-all border flex flex-col justify-between overflow-hidden relative rounded-2xl ${
                  isAvailable ? 'cursor-pointer hover:shadow-lg hover:border-red-300 hover:-translate-y-1 border-gray-200 shadow-sm' : 'cursor-not-allowed opacity-50 bg-gray-100 border-gray-300'} ${
                  showImages ? 'min-h-42.5' : 'h-30 p-3'}`}
                  onClick={() => {
                    if (!isAvailable) return;
                    if (item.variants && item.variants.length > 0) {
                      setSelectedItemVariants(item);
                    } else {
                      onSelectItem(item);
                    }
                  }}>
                  
              <div className={`flex items-start justify-between w-full h-4 z-10 absolute ${showImages ? 'top-2 left-0 px-2' : 'top-3 left-0 px-3'}`}>
                <div className={`w-3 h-3 rounded-full ${dotColor} shrink-0 shadow-sm ${showImages ? 'border border-white' : ''}`} title={item.type === 'veg' ? 'Veg' : 'Non-Veg'}></div>
                
                <div className="flex gap-1.5 items-center">
                  {!isAvailable && <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md shadow-sm ${showImages ? 'text-white bg-red-500/90 backdrop-blur-sm' : 'text-red-500 bg-red-50'}`}>{t("Out of Stock")}</span>}
                  
                  <button
                        onClick={(e) => handleToggleFavorite(e, item)}
                        className={`p-1 rounded-full backdrop-blur-sm transition-all shadow-sm flex items-center justify-center ${
                        item.isFavorite ?
                        'bg-yellow-50 text-yellow-500 border border-yellow-200' :
                        showImages ? 'bg-black/20 text-white hover:bg-black/40 border border-white/20' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 border border-gray-200'}`
                        }>
                        
                    <Star size={12} className={item.isFavorite ? "fill-yellow-500" : ""} />
                  </button>
                </div>
              </div>
              
              {showImages && item.image ?
                  <div className="w-full h-22.5 shrink-0 bg-gray-100 relative">
                  <img src={formatImageUrl(item.image)} alt={item.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent"></div>
                </div> :
                  showImages &&
                  <div className="w-full h-22.5 bg-gray-50 flex flex-col items-center justify-center shrink-0 text-gray-400 border-b border-gray-100 border-dashed">
                  <ImageIcon size={24} className="opacity-30 mb-1" />
                  <span className="text-[10px] font-medium opacity-50">{t("No Image")}</span>
                </div>
                  }
              
              <div className={`flex-1 flex flex-col justify-between ${showImages ? 'p-2.5' : ''}`}>
                <div className={`flex-1 flex items-center justify-center text-center mt-1 text-[14px] leading-tight ${isAvailable ? 'font-bold text-gray-800' : 'font-medium text-gray-500 line-through'}`}>
                  <span className="line-clamp-2 leading-snug">{(language !== 'en' && item.nameTranslations?.[language]) || item.name}</span>
                </div>
                
                <div className={`flex justify-center w-full ${showImages ? 'mt-1.5' : 'mt-2 mb-0.5'}`}>
                  <span className={`text-[13px] font-black px-3 py-1 rounded-full shadow-sm border ${showImages ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-gray-50 text-gray-800 border-gray-100'}`}>
                    ₹{item.price ? `${item.price.toFixed(2)}` : '0.00'}
                  </span>
                </div>
              </div>
            </div>);

            })}

          {category === '⭐ Favourites' && filteredItems.length === 0 &&
            <div className="col-span-full py-16 text-center flex flex-col items-center justify-center bg-surface rounded-2xl border border-dashed border-border/60">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4">
                <Star size={32} className="fill-amber-500/20" />
              </div>
              <h3 className="text-lg font-bold text-text-main mb-1">{t("No Favourites Added Yet")}</h3>
              <p className="text-text-muted text-sm max-w-md">{t("Hover over any menu item under \"All\" or other categories and click the")}
                <Star size={14} className="inline text-amber-500 fill-amber-500 mx-0.5" />{t("star icon in the top right corner to add it right here for instant billing!")}
              </p>
            </div>
            }
        </div>
      </div>
    </div>

      {/* Variant Selection Modal */}
      {selectedItemVariants &&
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-sm rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-border bg-linear-to-r from-primary/5 to-transparent">
              <h2 className="text-xl font-bold text-text-main pr-4 leading-tight">{t("Select Size")}<br /><span className="text-sm font-normal text-text-muted">{selectedItemVariants.name}</span></h2>
              <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedItemVariants(null);
              }}
              className="text-text-muted hover:text-text-main hover:bg-surface-hover rounded-full p-2 transition-colors">
              
                <X size={24} />
                
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
              {selectedItemVariants.variants.map((variant, idx) =>
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
              className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group shadow-sm hover:shadow-md">
              
                  <span className="font-bold text-lg text-text-main group-hover:text-primary transition-colors">{variant.name}</span>
                  <span className="font-black text-xl text-text-main bg-background px-3 py-1 rounded-lg border border-border group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-colors">₹{variant.price}</span>
                </button>
            )}
            </div>
          </div>
        </div>
      }
    </div>);

};

export default MenuGrid;