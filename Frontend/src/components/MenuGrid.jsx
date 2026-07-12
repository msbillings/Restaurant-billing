import React, { useState, useEffect, useRef } from 'react';
import { getMenuItems, updateMenuItem } from '../api/menu';
import { getCategories } from '../api/category';
import { ChevronLeft, ChevronRight, Star, X } from 'lucide-react';

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
    <div className="flex flex-col h-full bg-surface overflow-hidden">
      {/* Top Bar: Categories */}
      <div className="p-4 border-b border-border bg-surface z-10 flex flex-col gap-4 shrink-0">
        <div className="flex items-center gap-2 w-full">
          {/* Scroll Left Button */}
          <button
            onClick={() => scroll('left')}
            className="p-2 rounded-xl bg-background hover:bg-surface-hover border border-border shadow-sm transition-all duration-200 text-text-muted hover:text-text-main hover:scale-105 shrink-0 cursor-pointer flex items-center justify-center"
            title="Scroll Left"
          >
            <ChevronLeft size={20} className="stroke-[2.5]" />
          </button>
          
          <div 
            ref={scrollContainerRef}
            className="flex-1 flex items-center gap-4 overflow-x-auto pb-2 category-scroll"
          >
            {categoryOptions.map(cat => (
              <button 
                key={cat}
                className={`px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all transform hover:scale-105 flex items-center gap-1.5 ${
                  category === cat 
                    ? 'bg-primary text-white shadow-lg shadow-primary/25 ring-2 ring-primary/20' 
                    : cat === '⭐ Favourites'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/30'
                    : 'bg-background text-text-muted hover:bg-surface-hover hover:text-text-main border border-border'
                }`}
                onClick={() => setCategory(cat)}
              >
                {cat === '⭐ Favourites' ? (
                  <>
                    <Star size={15} className="fill-amber-500 text-amber-500 shrink-0" />
                    <span>Favourites</span>
                  </>
                ) : (
                  cat
                )}
              </button>
            ))}
          </div>

          {/* Scroll Right Button */}
          <button
            onClick={() => scroll('right')}
            className="p-2 rounded-xl bg-background hover:bg-surface-hover border border-border shadow-sm transition-all duration-200 text-text-muted hover:text-text-main hover:scale-105 shrink-0 cursor-pointer flex items-center justify-center"
            title="Scroll Right"
          >
            <ChevronRight size={20} className="stroke-[2.5]" />
          </button>
        </div>
      </div>
      
      {/* Items Grid */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-background/50">
        <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 sm:gap-6">
          {filteredItems.map(item => (
            <div
              key={item._id}
              className="bg-surface rounded-xl sm:rounded-2xl p-3 sm:p-5 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 group relative overflow-hidden flex flex-col h-full border border-border/50 hover:border-primary/20"
              onClick={() => {
                if (item.variants && item.variants.length > 0) {
                  setSelectedItemVariants(item);
                } else {
                  onSelectItem(item);
                }
              }}
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-[4rem] -mr-8 -mt-8 transition-transform group-hover:scale-110 pointer-events-none" />

              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  const newFavStatus = !item.isFavorite;
                  setItems(prev => prev.map(i => i._id === item._id ? { ...i, isFavorite: newFavStatus } : i));
                  try {
                    await updateMenuItem(item._id, { isFavorite: newFavStatus });
                  } catch (err) {
                    console.error('Error updating favorite status:', err);
                    setItems(prev => prev.map(i => i._id === item._id ? { ...i, isFavorite: item.isFavorite } : i));
                  }
                }}
                className={`absolute top-2 right-2 z-20 p-2 rounded-xl transition-all transform hover:scale-125 ${
                  item.isFavorite 
                    ? 'text-amber-500 bg-amber-500/15 shadow-sm opacity-100' 
                    : 'text-text-muted/40 hover:text-amber-500 bg-background/80 opacity-0 group-hover:opacity-100'
                }`}
                title={item.isFavorite ? "Remove from Favourites" : "Add to Favourites"}
              >
                <Star size={18} className={item.isFavorite ? "fill-amber-500" : ""} />
              </button>

              {formatImageUrl(item.image) && (
                <div className="w-full h-24 sm:h-36 mb-2 sm:mb-4 rounded-lg sm:rounded-xl overflow-hidden relative shrink-0 bg-background/60 border border-border/40 shadow-sm">
                  <img
                    src={formatImageUrl(item.image)}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.target.parentElement.style.display = 'none';
                    }}
                  />
                </div>
              )}

              <div className="flex flex-col h-full justify-between relative z-10">
                <div>
                  <div className="flex justify-between items-start mb-1.5 sm:mb-3">
                    <h3 className="font-bold text-xs sm:text-lg text-text-main leading-tight pr-1 sm:pr-2 group-hover:text-primary transition-colors line-clamp-2">{item.name}</h3>
                    {item.type && (
                      <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 mt-1 ring-2 ring-white ${item.type === 'veg' ? 'bg-success' : 'bg-danger'}`} />
                    )}
                  </div>
                  <p className="text-[11px] sm:text-sm text-text-muted line-clamp-1 sm:line-clamp-2 leading-relaxed mb-2 sm:mb-4">{item.description || item.category?.name}</p>
                </div>

                <div className="flex items-center justify-between mt-auto pt-2 sm:pt-4 border-t border-dashed border-border/50">
                  <span className="font-bold text-sm sm:text-xl text-text-main">₹{item.price}</span>
                  <button className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-primary text-white flex items-center justify-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all shadow-md sm:shadow-lg shadow-primary/20 hover:scale-110 hover:bg-primary-hover transform translate-y-0 sm:translate-y-2 group-hover:translate-y-0 text-sm sm:text-base">
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}

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
