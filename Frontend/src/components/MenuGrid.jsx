import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, ChevronLeft, ChevronRight, Star, X, ChevronDown, Image as ImageIcon,
  Pizza, Sandwich, UtensilsCrossed, Flame, Gift, Menu as MenuIcon, Utensils,
  Users, Smile, Soup, Popcorn, Scroll, Beef, Cookie, Plus, Loader2, RefreshCw
} from
  'lucide-react';
import { getMenuItems, updateMenuItem } from '../api/menu';
import { getCategories } from '../api/category';
import { getCachedMenuItems, getCachedCategories } from '../db/offlineDb';
import realtimeService from '../services/realtimeService';
import { flyItemToCart, getFoodCategoryVisual } from '../utils/animations';

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
    } catch (e) { }
  }

  if (trimmed.startsWith('data:image/') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return trimmed;
  }
  if (/^[A-Za-z0-9+/=]{30,}$/.test(trimmed) || trimmed.startsWith('iVBOR') || trimmed.startsWith('/9j/') || trimmed.startsWith('R0lGOD') || trimmed.startsWith('UklGR')) {
    let mime = 'jpeg';
    if (trimmed.startsWith('iVBOR')) mime = 'png'; else
      if (trimmed.startsWith('R0lGOD')) mime = 'gif'; else
        if (trimmed.startsWith('UklGR')) mime = 'webp';
    return `data:image/${mime};base64,${trimmed}`;
  }
  return trimmed;
};

// In-memory set of already loaded/cached image URLs to render instantly with 0ms delay
const loadedImageCache = new Set();

// Instant & Lazy Menu Image Component with zero-delay cached display & complete check
const LazyMenuImage = ({ src, alt, className, index = 999 }) => {
  const isCached = Boolean(src && loadedImageCache.has(src));
  const [loaded, setLoaded] = useState(isCached);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);
  // Only the first 6 images on screen get high-priority eager loading;
  // the rest use native lazy loading to avoid saturating the network.
  const isAboveFold = index < 6;

  useEffect(() => {
    if (!src) return;
    if (loadedImageCache.has(src)) {
      setLoaded(true);
      setError(false);
      return;
    }
    // Check if the DOM image is already complete in browser cache
    if (imgRef.current && imgRef.current.complete) {
      if (imgRef.current.naturalWidth > 0) {
        setLoaded(true);
        loadedImageCache.add(src);
      } else {
        setError(true);
      }
    }
  }, [src]);

  if (!src || error) {
    const visual = getFoodCategoryVisual(alt || '', '');
    return (
      <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden bg-[#18181b] border-b border-white/5 select-none">
        <div className={`absolute inset-0 bg-gradient-to-t ${visual.cardBg} opacity-90 pointer-events-none`} />
        <div className="text-3xl filter drop-shadow-md mb-0.5 relative z-10 transition-transform group-hover:scale-110 duration-300">
          {visual.icon}
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${visual.textAccent} opacity-85 relative z-10 font-mono`}>
          {visual.label}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-gray-100">
      {/* Animated shimmer skeleton only while initial loading */}
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse flex items-center justify-center">
          <UtensilsCrossed size={16} className="text-gray-300 animate-spin" />
        </div>
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={isAboveFold ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={isAboveFold ? 'high' : 'low'}
        onLoad={() => {
          setLoaded(true);
          loadedImageCache.add(src);
        }}
        onError={() => setError(true)}
        className={`w-full h-full object-cover transition-opacity duration-150 ease-out ${
          loaded ? 'opacity-100 scale-100 filter-none' : 'opacity-0 scale-95 blur-xs'
        } ${className || ''}`}
      />
    </div>
  );
};

import { useLanguage } from "../context/LanguageContext";
import useDebounce from "../hooks/useDebounce";

const MenuGrid = ({
  onSelectItem,
  activeTable,
  billType = 'Dine-In',
  searchTerm = '',
  onSearchChange,
  isLayoutLocked = false,
  onNavigate,
  userRole = 'Admin',
  foodTypeFilter: externalFoodTypeFilter,
  onFoodTypeFilterChange,
  isLocked = false
}) => {
  const { t, language } = useLanguage();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [internalFoodTypeFilter, setInternalFoodTypeFilter] = useState('all');
  const foodTypeFilter = externalFoodTypeFilter !== undefined ? externalFoodTypeFilter : internalFoodTypeFilter;
  const setFoodTypeFilter = onFoodTypeFilterChange || setInternalFoodTypeFilter;
  const [sortBy, setSortBy] = useState('latest');
  const [selectedItemVariants, setSelectedItemVariants] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const gridContainerRef = useRef(null);
  const [showImages, setShowImages] = useState(() => {
    const saved = localStorage.getItem('menuGrid_showImages');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const scrollContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  // ── Mobile Infinite Scroll ──────────────────────────────────────────────
  const MOBILE_BATCH_SIZE = 20;
  const [mobileLoadedCount, setMobileLoadedCount] = useState(MOBILE_BATCH_SIZE);
  const [isMobileLoadingMore, setIsMobileLoadingMore] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  const sentinelRef = useRef(null);

  // Track viewport size
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);


  const [leftSidebarWidth, setLeftSidebarWidth] = useState(260);
  const isResizingLeft = useRef(false);

  const [isCategorySidebarCollapsed, setIsCategorySidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('resto_category_sidebar_collapsed') === 'true';
    } catch (e) {
      return false;
    }
  });

  const toggleCategorySidebar = useCallback(() => {
    setIsCategorySidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('resto_category_sidebar_collapsed', String(next));
      } catch (e) {}
      return next;
    });
  }, []);

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
          document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
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

  const fetchItems = async (isBackground = false) => {
    if (!isBackground && items.length === 0) {
      setLoading(true);
    }
    try {
      const data = await getMenuItems(true);
      setItems(data);
    } catch (error) {
      console.error('Error fetching menu:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Instant Cache Load (0ms delay) on mount
    getCachedMenuItems().then((cachedItems) => {
      if (cachedItems && Array.isArray(cachedItems) && cachedItems.length > 0) {
        setItems(cachedItems);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    getCachedCategories().then((cachedCats) => {
      if (cachedCats && Array.isArray(cachedCats) && cachedCats.length > 0) {
        setCategories(cachedCats);
      }
    }).catch(() => { });

    // 2. Background Revalidation with fresh data
    fetchCategories();
    fetchItems(true);

    // 3. Real-time menu synchronization (when items are added, updated, or imported)
    const handleMenuUpdated = () => {
      console.log('[MenuGrid] Realtime menuUpdated event caught, refreshing dishes...');
      fetchItems(true);
      fetchCategories();
    };
    const unsubMenu = realtimeService.subscribe('menuUpdated', handleMenuUpdated);

    return () => {
      unsubMenu();
    };
  }, []);

  // Proactively preload images in staggered batches to avoid saturating the network
  useEffect(() => {
    if (items && items.length > 0 && showImages) {
      const urls = items
        .map((i) => formatImageUrl(i.image))
        .filter((url) => url && !loadedImageCache.has(url));

      // Batch 1: first 6 images (above the fold) — immediate, high priority
      const aboveFoldBatch = urls.slice(0, 6);
      // Batch 2: rest of page 1 (up to 30 items) — after 800ms
      const page1Rest = urls.slice(6, 30);
      // Batch 3+: remaining pages — staggered every 2s
      const remaining = urls.slice(30);

      const preload = (url) => {
        const img = new Image();
        img.decoding = 'async';
        img.src = url;
        img.onload = () => loadedImageCache.add(url);
      };

      aboveFoldBatch.forEach(preload);

      const timers = [];

      if (page1Rest.length > 0) {
        timers.push(setTimeout(() => page1Rest.forEach(preload), 800));
      }

      // Load subsequent pages in batches of 30 with 2s spacing
      for (let i = 0; i < remaining.length; i += 30) {
        const batch = remaining.slice(i, i + 30);
        const delay = 2000 + Math.floor(i / 30) * 2000;
        timers.push(setTimeout(() => batch.forEach(preload), delay));
      }

      return () => timers.forEach(clearTimeout);
    }
  }, [items, showImages]);

  const validCategories = categories.filter((cat) => {
    if (items.length === 0) return true;
    return items.some((item) => {
      const itemCatName = item.category?.name || (typeof item.category === 'string' ? item.category : '');
      const itemCatId = item.category?._id || item.category;
      return itemCatName === cat.name || itemCatId === cat._id || itemCatId === cat.name;
    });
  });
  const categoryOptions = ['All', '⭐ Favourites', ...(validCategories.length > 0 ? validCategories : categories).map((cat) => cat.name)];

  const filteredItems = React.useMemo(() => {
    const term = (debouncedSearchTerm || '').trim().toLowerCase();
    const isSearching = term.length > 0;

    return items.filter((item) => {
      let matchesCategory = false;
      // If user is searching, find all matching items across the whole restaurant catalog!
      if (isSearching) {
        matchesCategory = true;
      } else if (category === 'All') {
        matchesCategory = true;
      } else if (category === '⭐ Favourites') {
        matchesCategory = item.isFavorite === true;
      } else {
        const itemCatName = item.category?.name || (typeof item.category === 'string' ? item.category : '');
        const itemCatId = item.category?._id || item.category;
        const matchedCat = categories.find(c => c.name === category);
        matchesCategory = itemCatName === category || (matchedCat && (itemCatId === matchedCat._id || itemCatName === matchedCat.name));
      }

      const matchesSearch = !isSearching ||
        item.name.toLowerCase().includes(term) ||
        (item.code && item.code.toLowerCase().includes(term)) ||
        (item.description && item.description.toLowerCase().includes(term)) ||
        (item.category?.name && item.category.name.toLowerCase().includes(term));

      const itemType = (item.type || item.foodType || (item.isVeg === true ? 'veg' : item.isVeg === false ? 'non-veg' : '')).toLowerCase();
      const matchesFoodType = foodTypeFilter === 'all' ||
        (foodTypeFilter === 'veg' && (itemType === 'veg' || item.isVeg === true)) ||
        (foodTypeFilter === 'non-veg' && (itemType === 'non-veg' || item.isVeg === false));

      return matchesCategory && matchesSearch && matchesFoodType;
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
  }, [items, category, debouncedSearchTerm, foodTypeFilter, sortBy, categories]);

  // IntersectionObserver for mobile sentinel (placed AFTER filteredItems is defined)
  useEffect(() => {
    if (!isMobile) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && mobileLoadedCount < filteredItems.length) {
          setIsMobileLoadingMore(true);
          // Slight delay for smooth UX
          setTimeout(() => {
            setMobileLoadedCount((prev) => Math.min(prev + MOBILE_BATCH_SIZE, filteredItems.length));
            setIsMobileLoadingMore(false);
          }, 400);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isMobile, mobileLoadedCount, filteredItems.length]);

  // Reset to page 1 (desktop) and mobileLoadedCount (mobile) when filters change
  useEffect(() => {
    setCurrentPage(1);
    setMobileLoadedCount(MOBILE_BATCH_SIZE);
    if (gridContainerRef.current) {
      gridContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [category, foodTypeFilter, debouncedSearchTerm, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / (itemsPerPage === 'all' ? (filteredItems.length || 1) : itemsPerPage)));

  const paginatedItems = React.useMemo(() => {
    if (itemsPerPage === 'all') return filteredItems;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      if (gridContainerRef.current) {
        gridContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full bg-white overflow-hidden w-full">
      <style>{`
        @keyframes menuCardCascade {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .menu-card-item {
          animation: menuCardCascade 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>
      {/* Mobile & Tablet Top Category Scrollbar (Visible on screens < 1024px) */}
      <div className="flex lg:hidden overflow-x-auto category-scroll py-2 px-3 bg-gray-50 border-b border-gray-200 shrink-0 gap-2 w-full no-scrollbar">
        {categoryOptions.filter(cat => cat !== '⭐ Favourites').map((cat) => {
          const isSelected = category === cat;
          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all shadow-xs ${isSelected
                  ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}>
              {getCategoryIcon(cat, isSelected)}
              <span>{t(cat)}</span>
            </button>
          );
        })}
      </div>

      {/* Desktop Left Sidebar: Categories (Visible on large screens >= 1024px) */}
      {!isCategorySidebarCollapsed && (
        <div
          style={{ width: leftSidebarWidth }}
          className="hidden lg:flex flex-col bg-white shrink-0 h-full overflow-y-auto overflow-x-hidden hide-scrollbar py-3 border-r border-gray-200">
          <div className="flex flex-col w-full gap-1">
            {categoryOptions.map((cat) => {
              const isSelected = category === cat;
              const isAll = cat.toLowerCase() === 'all';
              const bgClass = isSelected
                ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-md rounded-xl mx-2 font-bold'
                : 'bg-transparent text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-xl mx-2 font-bold';
              return (
                <button
                  key={cat}
                  className={`w-full text-left px-4 py-3 text-[15px] transition-all flex items-center justify-between group ${bgClass}`}
                  onClick={() => setCategory(cat)}>
                  <div className="flex items-center gap-3 flex-1 min-w-0 pr-1 truncate">
                    {getCategoryIcon(cat, isSelected)}
                    <span className="truncate font-medium">{cat === '⭐ Favourites' ? t('Favorite Items') : t(cat.replace('⭐ ', ''))}</span>
                  </div>

                  {/* Collapse trigger right arrow on the All category row & selected categories */}
                  {isAll ? (
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCategorySidebar();
                      }}
                      className={`p-1 rounded-lg transition-all ml-1 shrink-0 flex items-center justify-center cursor-pointer hover:scale-110 ${
                        isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-200 text-gray-500'
                      }`}
                      title={t("Close Categories Sidebar")}>
                      <ChevronRight size={18} />
                    </span>
                  ) : (
                    isSelected && (
                      <span
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCategorySidebar();
                        }}
                        className="p-1 rounded-lg hover:bg-white/20 text-white transition-all ml-1 shrink-0 flex items-center justify-center cursor-pointer hover:scale-110"
                        title={t("Close Categories Sidebar")}>
                        <ChevronRight size={18} />
                      </span>
                    )
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Left Sidebar Drag Handle (Desktop only when not collapsed) */}
      {!isLayoutLocked && !isCategorySidebarCollapsed && (
        <div
          onMouseDown={startResizingLeft}
          className="hidden lg:block w-1.5 cursor-col-resize hover:bg-primary/50 bg-transparent shrink-0 z-40 transition-colors border-r border-gray-200 hover:border-transparent relative" />
      )}

      {/* Items Grid Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 relative">

        {/* Floating Re-Open Button when category sidebar is collapsed */}
        {isCategorySidebarCollapsed && (
          <button
            type="button"
            onClick={toggleCategorySidebar}
            className="hidden lg:flex absolute top-1/2 -translate-y-1/2 left-0 z-30 bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-xl rounded-r-2xl py-3.5 px-2 hover:opacity-95 transition-all items-center gap-1 border-y border-r border-white/25 cursor-pointer group"
            title={t("Open Categories Sidebar")}>
            <ChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        )}

        {/* Filter & Sort Controls Row */}
        <div className="flex items-center justify-between bg-gray-50 border-b border-gray-200 py-1.5 px-2 sm:px-3 gap-1.5 sm:gap-2 shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
          {/* Desktop Categories Open Button when collapsed */}
          {isCategorySidebarCollapsed && (
            <button
              type="button"
              onClick={toggleCategorySidebar}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-gray-800 hover:bg-gray-100 border border-gray-200 shadow-xs transition-all shrink-0 cursor-pointer"
              title={t("Open Categories Sidebar")}>
              <MenuIcon size={14} className="text-red-500" />
              <span>{t("Categories")}</span>
              <ChevronRight size={14} className="text-gray-400" />
            </button>
          )}

          {/* Mobile Favorite Items Toggle Button (Left side on mobile) */}
          <button
            type="button"
            onClick={() => setCategory(category === '⭐ Favourites' ? 'All' : '⭐ Favourites')}
            className={`flex sm:hidden items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${category === '⭐ Favourites'
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-white text-gray-700 hover:bg-gray-100 border-gray-200 shadow-xs'
              }`}
          >
            <Star size={12} className={category === '⭐ Favourites' ? 'fill-white text-white' : 'text-amber-500 fill-amber-500'} />
            <span>{t("Favorite Items")}</span>
          </button>

          {/* Veg / Non-Veg / All Segmented Filter Tabs */}
          <div className="hidden sm:flex items-center bg-white p-0.5 rounded-xl border border-gray-200 shadow-xs shrink-0 gap-0.5">
            {/* All */}
            <button
              type="button"
              onClick={() => setFoodTypeFilter('all')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${foodTypeFilter === 'all'
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              <span>{t("All")}</span>
            </button>

            {/* Veg */}
            <button
              type="button"
              onClick={() => setFoodTypeFilter('veg')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${foodTypeFilter === 'veg'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
                }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 border border-white shrink-0"></span>
              <span>{t("Veg")}</span>
            </button>

            {/* Non-Veg */}
            <button
              type="button"
              onClick={() => setFoodTypeFilter('non-veg')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${foodTypeFilter === 'non-veg'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-700 hover:bg-rose-50'
                }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 border border-white shrink-0"></span>
              <span>{t("Non-Veg")}</span>
            </button>
          </div>

          {/* Right Controls: Sort, Add Item, Image Toggle */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto justify-end">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-8 px-1.5 sm:px-2 border border-gray-200 rounded-lg bg-white text-gray-700 text-xs font-bold focus:outline-none focus:border-red-500 transition-all shadow-xs cursor-pointer max-w-[100px] sm:max-w-[130px]"
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
                className="flex items-center justify-center h-8 px-2 sm:px-2.5 rounded-lg bg-red-500 text-white shadow-xs hover:bg-red-600 active:scale-95 transition-all gap-1 font-bold text-xs whitespace-nowrap cursor-pointer shrink-0"
                title={t("Add Item")}
              >
                <Plus size={14} />
                <span className="hidden xl:inline">{t("Add Item")}</span>
              </button>
            )}

            <button
              onClick={() => setShowImages(!showImages)}
              className={`flex items-center justify-center h-8 px-2 sm:px-2.5 rounded-lg border shadow-xs active:scale-95 transition-all gap-1 font-bold text-xs cursor-pointer shrink-0 ${showImages
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              title={showImages ? t('Images: On') : t('Images: Off')}
            >
              <ImageIcon size={14} />
              <span className="hidden xl:inline">{showImages ? t('Images: On') : t('Images: Off')}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Items Grid */}
        <div ref={gridContainerRef} className="flex-1 overflow-y-auto p-4 relative bg-gray-50 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* Dynamic Loading State with Animated Spinner & Pulse Skeletons */}
          {loading && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[360px] w-full">
              <div className="flex flex-col items-center justify-center p-6 bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-red-100 mb-8 animate-pulse">
                <div className="relative flex items-center justify-center mb-3">
                  <div className="w-12 h-12 rounded-full border-4 border-red-100 border-t-red-600 animate-spin"></div>
                  <UtensilsCrossed size={20} className="text-red-600 absolute" />
                </div>
                <h4 className="font-bold text-gray-800 text-sm tracking-wide">{t("Loading Menu Items...")}</h4>
                <p className="text-xs text-gray-400 mt-1">{t("Fetching live dishes & prices")}</p>
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(155px,1fr))] gap-3 sm:gap-4 w-full opacity-60">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm animate-pulse flex flex-col justify-between h-36">
                    <div className="flex justify-between items-center mb-2">
                      <div className="w-4 h-4 bg-gray-200 rounded-full"></div>
                      <div className="w-4 h-4 bg-gray-200 rounded-full"></div>
                    </div>
                    <div className="w-3/4 h-4 bg-gray-200 rounded-md mb-2"></div>
                    <div className="w-1/2 h-3 bg-gray-100 rounded-md mb-4"></div>
                    <div className="flex justify-center">
                      <div className="w-16 h-6 bg-gray-200 rounded-full"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(155px,1fr))] gap-3 sm:gap-4">
              {/* Mobile: show progressively loaded items; Desktop: show paginated items */}
              {(isMobile ? filteredItems.slice(0, mobileLoadedCount) : paginatedItems).map((item, idx) => {
                const isAvailable = item.isAvailable !== false; // default to true if undefined
                const dotColor = item.type === 'veg' ? 'bg-green-500 shadow-sm border border-green-200' : item.type === 'non-veg' ? 'bg-red-500 shadow-sm border border-red-200' : 'bg-gray-300';

                return (
                  <div
                    key={item._id}
                    style={{ animationDelay: `${Math.min(idx * 25, 300)}ms` }}
                    className={`menu-card-item bg-white transition-all border flex flex-col justify-between overflow-hidden relative rounded-2xl ${isAvailable ? 'cursor-pointer hover:shadow-lg hover:border-red-300 hover:-translate-y-1 border-gray-200 shadow-sm' : 'cursor-not-allowed opacity-50 bg-gray-100 border-gray-300'} ${showImages ? 'min-h-48 sm:min-h-52' : 'h-30 p-3'}`}
                    onClick={(e) => {
                      if (!isAvailable) return;
                      const isDineInWithoutTable = (billType === 'Dine-In' || !billType) && !activeTable;

                      if (isDineInWithoutTable || isLocked) {
                        if (item.variants && item.variants.length > 0) {
                          setSelectedItemVariants(item);
                        } else {
                          onSelectItem(item);
                        }
                        return;
                      }

                      if (item.variants && item.variants.length > 0) {
                        setSelectedItemVariants(item);
                      } else {
                        // 1. Add to cart immediately (instant 0ms response)
                        onSelectItem(item);

                        // 2. Play 3D flying animation simultaneously as visual feedback
                        const targetElement = document.querySelector('.bill-summary-container');
                        const imgUrl = formatImageUrl(item.image);
                        flyItemToCart(e.currentTarget, targetElement, imgUrl);
                      }
                    }}>

                    <div className={`flex items-start justify-between w-full h-4 z-[2] absolute ${showImages ? 'top-2.5 left-0 px-2.5' : 'top-3 left-0 px-3'}`}>
                      <div className={`w-3 h-3 rounded-full ${dotColor} shrink-0 shadow-sm ${showImages ? 'border border-white' : ''}`} title={item.type === 'veg' ? 'Veg' : 'Non-Veg'}></div>

                      <div className="flex gap-1.5 items-center">
                        {!isAvailable && <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md shadow-sm ${showImages ? 'text-white bg-red-500/90 backdrop-blur-sm' : 'text-red-500 bg-red-50'}`}>{t("Out of Stock")}</span>}

                        <button
                          onClick={(e) => handleToggleFavorite(e, item)}
                          className={`p-1 rounded-full backdrop-blur-sm transition-all shadow-sm flex items-center justify-center ${item.isFavorite ?
                              'bg-yellow-50 text-yellow-500 border border-yellow-200' :
                              showImages ? 'bg-black/20 text-white hover:bg-black/40 border border-white/20' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 border border-gray-200'}`
                          }>
                          <Star size={12} className={item.isFavorite ? "fill-yellow-500" : ""} />
                        </button>
                      </div>
                    </div>

                    {showImages && (
                      <div className="w-full h-28 sm:h-30 shrink-0 bg-gray-100 relative overflow-hidden">
                        <LazyMenuImage src={formatImageUrl(item.image)} alt={item.name} index={idx} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none"></div>
                      </div>
                    )}

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
                  </div>
                );
              })}

              {/* Empty Category State */}
              {!loading && filteredItems.length === 0 && category !== '⭐ Favourites' && (
                <div className="col-span-full py-16 text-center flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-gray-200 shadow-xs p-8">
                  <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-3 shadow-inner">
                    <UtensilsCrossed size={28} />
                  </div>
                  <h3 className="text-base font-bold text-gray-800 mb-1">{t("No Items Found")}</h3>
                  <p className="text-xs text-gray-400 max-w-xs">{t("No dishes available in this category. Click below to reload menu data.")}</p>
                  <button
                    onClick={() => fetchItems(false)}
                    className="mt-4 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
                  >
                    <RefreshCw size={14} />
                    <span>{t("Reload Menu")}</span>
                  </button>
                </div>
              )}

              {/* Empty Favourites State */}
              {category === '⭐ Favourites' && filteredItems.length === 0 && (
                <div className="col-span-full py-16 text-center flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-yellow-200 shadow-xs p-8">
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4">
                    <Star size={32} className="fill-amber-500/20" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-1">{t("No Favourites Added Yet")}</h3>
                  <p className="text-gray-500 text-xs max-w-md">{t("Hover over any menu item under \"All\" or other categories and click the")}
                    <Star size={14} className="inline text-amber-500 fill-amber-500 mx-0.5" />{t("star icon in the top right corner to add it right here for instant billing!")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Mobile Infinite Scroll Sentinel & Loader ── */}
          {isMobile && filteredItems.length > 0 && (
            <>
              {/* Sentinel: observed to trigger next batch load */}
              <div ref={sentinelRef} className="h-4 w-full" />

              {/* Spinner while loading next batch */}
              {isMobileLoadingMore && (
                <div className="flex items-center justify-center py-4 gap-2">
                  <Loader2 size={20} className="animate-spin text-red-500" />
                  <span className="text-xs text-gray-500 font-medium">{t("Loading more...")}</span>
                </div>
              )}

              {/* End-of-list message */}
              {!isMobileLoadingMore && mobileLoadedCount >= filteredItems.length && filteredItems.length > MOBILE_BATCH_SIZE && (
                <div className="flex items-center justify-center py-4">
                  <span className="text-[11px] text-gray-400 font-medium px-4 py-1.5 bg-gray-100 rounded-full">
                    ✓ {t("All")} {filteredItems.length} {t("items loaded")}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pagination Navigation Footer Bar — Desktop only (hidden on mobile) */}
        {filteredItems.length > 0 && (
          <div className="hidden lg:flex flex-col sm:flex-row items-center justify-between bg-white border-t border-gray-200 py-2.5 px-4 gap-2.5 shrink-0 shadow-xs">
            {/* Item Count Display */}
            <div className="text-xs text-gray-500 font-medium">
              {itemsPerPage === 'all' ? (
                <span>{t("Showing all")} <strong className="text-gray-800 font-bold">{filteredItems.length}</strong> {t("items")}</span>
              ) : (
                <span>
                  {t("Showing")}{" "}
                  <strong className="text-gray-800 font-bold">
                    {Math.min(filteredItems.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredItems.length, currentPage * itemsPerPage)}
                  </strong>{" "}
                  {t("of")}{" "}
                  <strong className="text-gray-800 font-bold">{filteredItems.length}</strong> {t("items")}
                </span>
              )}
            </div>

            {/* Page Navigation Controls */}
            {itemsPerPage !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                  title={t("Previous Page")}
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) {
                      acc.push('...');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) => {
                    if (p === '...') {
                      return <span key={`ellipsis-${idx}`} className="px-1 text-xs text-gray-400 font-bold">...</span>;
                    }
                    const isActive = currentPage === p;
                    return (
                      <button
                        type="button"
                        key={p}
                        onClick={() => handlePageChange(p)}
                        className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs ${isActive
                            ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-xs'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                          }`}
                      >
                        {p}
                      </button>
                    );
                  })}

                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                  title={t("Next Page")}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* Items Per Page Selector */}
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="hidden sm:inline font-medium">{t("Per Page:")}</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                  setItemsPerPage(val);
                  setCurrentPage(1);
                }}
                className="h-8 px-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 text-xs font-bold focus:outline-none focus:border-red-500 transition-all cursor-pointer shadow-2xs"
              >
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={60}>60</option>
                <option value="all">{t("All")}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Variant Selection Modal */}
      {selectedItemVariants && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedItemVariants(null);
          }}
        >
          <div 
            className="bg-surface w-full max-w-sm rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-5 border-b border-border bg-linear-to-r from-primary/5 to-transparent">
              <h2 className="text-xl font-bold text-text-main pr-4 leading-tight">{t("Select Size")}<br /><span className="text-sm font-normal text-text-muted">{selectedItemVariants.name}</span></h2>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedItemVariants(null);
                }}
                className="text-text-muted hover:text-text-main hover:bg-surface-hover rounded-full p-2 transition-colors cursor-pointer"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
              {selectedItemVariants.variants.map((variant, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const isDineInWithoutTable = (billType === 'Dine-In' || !billType) && !activeTable;
                    
                    const itemToAdd = {
                      ...selectedItemVariants,
                      _id: `${selectedItemVariants._id}-${variant.name}`,
                      originalId: selectedItemVariants._id,
                      name: `${selectedItemVariants.name} (${variant.name})`,
                      price: variant.price
                    };

                    // 1. Add variant to cart immediately (instant 0ms response)
                    onSelectItem(itemToAdd);

                    // 2. Play 3D flying animation simultaneously as visual feedback
                    if (!isDineInWithoutTable && !isLocked) {
                      const targetElement = document.querySelector('.bill-summary-container');
                      const imgUrl = formatImageUrl(selectedItemVariants.image);
                      flyItemToCart(e.currentTarget, targetElement, imgUrl);
                    }
                    setSelectedItemVariants(null);
                  }}
                  className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group shadow-sm hover:shadow-md cursor-pointer"
                >
                  <span className="font-bold text-lg text-text-main group-hover:text-primary transition-colors">{variant.name}</span>
                  <span className="font-black text-xl text-text-main bg-background px-3 py-1 rounded-lg border border-border group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-colors">₹{variant.price}</span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MenuGrid;