import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShoppingCart, Plus, Minus, X, Info, UtensilsCrossed, ChevronRight, CheckCircle2, Navigation, Bell, Droplets, CreditCard, Search, Star, ChefHat, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';

let API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
if (API_BASE_URL.includes('localhost') && window.location.hostname !== 'localhost') {
  API_BASE_URL = API_BASE_URL.replace('localhost', window.location.hostname);
}

const CustomerMenu = () => {
  const { language, setLanguage, t } = useLanguage();
  const [googleReviewLink, setGoogleReviewLink] = useState(null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderStatus, setOrderStatus] = useState('menu'); // menu, placing, success

  // Language Dropdown State
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const languages = [
    { code: 'en', native: 'English' },
    { code: 'hi', native: 'हिंदी' },
    { code: 'te', native: 'తెలుగు' },
    { code: 'ta', native: 'தமிழ்' },
    { code: 'kn', native: 'ಕನ್ನಡ' },
    { code: 'ml', native: 'മലയാളം' },
    { code: 'mr', native: 'मराठी' }
  ];

  // Live Order Tracking State
  const [activeOrderData, setActiveOrderData] = useState(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [dietaryFilter, setDietaryFilter] = useState('all'); // 'all', 'veg', 'non-veg'

  // Service Request & Variants/Notes State
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [serviceMessage, setServiceMessage] = useState(null);
  const [selectedItemForAdd, setSelectedItemForAdd] = useState(null);
  const [specialNote, setSpecialNote] = useState('');

  const urlParams = new URLSearchParams(window.location.search);
  const tenant = urlParams.get('tenant');
  const table = urlParams.get('table');

  useEffect(() => {
    if (!tenant || !table) {
      setError("Invalid QR Code. Please scan the QR code on your table again.");
      setLoading(false);
      return;
    }

    const fetchMenu = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/public/menu`, {
          headers: {
            'X-Tenant-DB': tenant
          }
        });
        setCategories(res.data.categories);
        setItems(res.data.items);
        if (res.data.googleReviewLink) setGoogleReviewLink(res.data.googleReviewLink);
      } catch (err) {
        console.error("Failed to load menu", err);
        setError("Could not load the menu. Please ask a staff member for assistance.");
      } finally {
        setLoading(false);
      }
    };

    const checkOrderStatus = async () => {
      if (!table || !tenant) return;
      try {
        const res = await axios.get(`${API_BASE_URL}/public/order-status?tableNo=${table}`, {
          headers: { 'X-Tenant-DB': tenant }
        });
        setActiveOrderData(res.data);
      } catch (err) {
        if (err.response && err.response.status === 404) {
          setActiveOrderData(null); // No active order
        }
      }
    };

    fetchMenu();
    checkOrderStatus();

    // WebSocket real-time updates for instant KDS sync
    const socketUrl = API_BASE_URL.replace('/api', '');
    const socket = io(socketUrl);

    socket.on('connect', () => {
      if (tenant) {
        socket.emit('joinTenant', { tenantDb: tenant });
      }
    });

    socket.on('kotUpdated', checkOrderStatus);
    socket.on('orderUpdated', checkOrderStatus);
    socket.on('newKOT', checkOrderStatus);
    socket.on('billSettled', checkOrderStatus);
    
    // Fast poll fallback every 3 seconds for instant response
    const interval = setInterval(checkOrderStatus, 3000);
    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [tenant, table]);

  const addToCart = (item, variant = null, note = '') => {
    const variantName = variant ? variant.name : null;
    const itemPrice = variant ? variant.price : item.price;
    const itemName = variant ? `${item.name} - ${variant.name}` : item.name;

    const existingIndex = cart.findIndex((cartItem) => 
      cartItem.menuItem === item._id && 
      cartItem.variant === variantName &&
      cartItem.specialNote === note
    );

    if (existingIndex !== -1) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([...cart, {
        menuItem: item._id,
        name: itemName,
        price: itemPrice,
        quantity: 1,
        variant: variantName,
        specialNote: note
      }]);
    }
  };

  const handleAddClick = (item) => {
    setSelectedItemForAdd(item);
    setSpecialNote('');
  };

  const updateQuantity = (index, delta) => {
    const newCart = [...cart];
    newCart[index].quantity += delta;
    if (newCart[index].quantity <= 0) {
      newCart.splice(index, 1);
    }
    setCart(newCart);
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setOrderStatus('placing');
    try {
      const total = calculateTotal();
      await axios.post(`${API_BASE_URL}/public/order`, {
        tableNo: table,
        items: cart,
        subTotal: total,
        taxes: 0,
        total: total
      }, {
        headers: {
          'X-Tenant-DB': tenant
        }
      });
      setCart([]);
      setOrderStatus('success');
      setTimeout(() => setOrderStatus('menu'), 5000);
      
      // Instantly trigger an order status check to show the tracking banner
      try {
        const res = await axios.get(`${API_BASE_URL}/public/order-status?tableNo=${table}`, {
          headers: { 'X-Tenant-DB': tenant }
        });
        setActiveOrderData(res.data);
      } catch (e) {
        console.error("Error fetching status post-order", e);
      }
    } catch (err) {
      console.error("Order failed", err);
      alert("Failed to place order. Please try again or call a waiter.");
      setOrderStatus('menu');
    }
  };

  const requestService = async (type) => {
    setIsServiceOpen(false);
    try {
      await axios.post(`${API_BASE_URL}/public/request-service`, {
        tableNumber: table,
        requestType: type
      }, {
        headers: { 'X-Tenant-DB': tenant }
      });
      setServiceMessage(`Your request for "${type}" was sent!`);
      setTimeout(() => setServiceMessage(null), 4000);
    } catch (err) {
      console.error("Service request failed", err);
      alert("Failed to send request. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <UtensilsCrossed className="w-12 h-12 text-orange-500 animate-bounce mb-4" />
        <h2 className="text-xl font-bold text-slate-700">{t("Loading your menu...")}</h2>
      </div>);

  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <Info className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">{t("Oops!")}</h2>
        <p className="text-slate-600">{error}</p>
      </div>);
  }

  // Pre-calculate category visibility and items to fix quick-jump buttons
  const visibleCategoriesData = categories.map(category => {
    let categoryItems = items.filter((item) =>
      (item.category?._id || item.category) === category._id ||
      (item.category?.name || item.category) === category.name
    );

    if (dietaryFilter === 'veg') {
      categoryItems = categoryItems.filter(item => item.type === 'veg');
    } else if (dietaryFilter === 'non-veg') {
      categoryItems = categoryItems.filter(item => item.type !== 'veg');
    }

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      categoryItems = categoryItems.filter(item => 
        item.name.toLowerCase().includes(query) || 
        (item.description && item.description.toLowerCase().includes(query))
      );
    }
    
    return { ...category, filteredItems: categoryItems };
  }).filter(c => c.filteredItems.length > 0);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      {/* Header */}
      <header className="bg-orange-500 text-white p-6 rounded-b-[2rem] shadow-lg relative z-30 flex flex-col items-center">
        <div className="absolute top-4 right-4 z-50">
          <button 
            onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
            className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full text-sm font-bold backdrop-blur-sm transition-colors flex items-center gap-1"
          >
            {languages.find(l => l.code === language)?.native || 'English'}
          </button>
          
          <AnimatePresence>
            {isLangDropdownOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden min-w-[120px] flex flex-col"
              >
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code);
                      setIsLangDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors border-b last:border-0 border-slate-100 ${language === lang.code ? 'bg-orange-50 text-orange-600' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    {lang.native}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <h1 className="text-3xl font-black text-center tracking-tight mb-2 mt-2">{t("Digital Menu")}</h1>
        <div className="flex items-center justify-center gap-2 bg-white/20 w-max mx-auto px-4 py-1.5 rounded-full backdrop-blur-sm">
          <Navigation size={16} />
          <span className="font-bold text-sm">{t("You are at")} {table}</span>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md px-4 py-3 shadow-sm border-b border-slate-200">
        <div className="flex flex-col gap-3 max-w-2xl mx-auto">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder={t("Search dishes...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 shadow-sm transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          {/* Quick Dietary Filters */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setDietaryFilter('all')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${dietaryFilter === 'all' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}
            >
              {t("All")}
            </button>
            <button
              onClick={() => setDietaryFilter('veg')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${dietaryFilter === 'veg' ? 'bg-green-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}
            >
              <div className={`w-2 h-2 rounded-full ${dietaryFilter === 'veg' ? 'bg-white' : 'bg-green-500'}`}></div> {t("Veg")}
            </button>
            <button
              onClick={() => setDietaryFilter('non-veg')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${dietaryFilter === 'non-veg' ? 'bg-red-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}
            >
              <div className={`w-2 h-2 rounded-full ${dietaryFilter === 'non-veg' ? 'bg-white' : 'bg-red-500'}`}></div> {t("Non-Veg")}
            </button>
          </div>
          
          {/* Category Quick-Jump */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar border-t border-slate-100 pt-2 mt-1">
            {visibleCategoriesData.map((category) => (
              <button
                key={`nav-${category._id}`}
                onClick={() => {
                  const el = document.getElementById(`category-${category._id}`);
                  if (el) {
                    const y = el.getBoundingClientRect().top + window.scrollY - 180;
                    window.scrollTo({ top: y, behavior: 'smooth' });
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-orange-50 text-orange-600 text-xs font-bold whitespace-nowrap border border-orange-100 transition-colors hover:bg-orange-100 active:bg-orange-200"
              >
                {(language !== 'en' && category.nameTranslations?.[language]) || t(category.name)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Categories & Items */}
      <main className="p-4 space-y-8 mt-2 max-w-2xl mx-auto">
        {visibleCategoriesData.map((category) => {
          const categoryItems = category.filteredItems;

          return (
            <div key={category._id} id={`category-${category._id}`} className="animate-in fade-in slide-in-from-bottom-4 duration-500 scroll-mt-32">
              <h2 className="text-xl font-black text-slate-800 mb-4 px-2 flex items-center gap-2">
                {(language !== 'en' && category.nameTranslations?.[language]) || t(category.name)}
                <div className="h-px bg-slate-200 flex-1 ml-4 mt-1"></div>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categoryItems.map((item) =>
                <div key={item._id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex gap-4">
                    {item.image ?
                  <img src={item.image} alt={item.name} className="w-24 h-24 object-cover rounded-xl shadow-sm" /> :

                  <div className="w-24 h-24 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300">
                        <UtensilsCrossed size={32} />
                      </div>
                  }
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between">
                          <h3 className="font-bold text-slate-800 leading-tight pr-2">{(language !== 'en' && item.nameTranslations?.[language]) || t(item.name)}</h3>
                          <span className={`w-3 h-3 rounded-full shrink-0 mt-1 ${item.type === 'veg' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        </div>
                        {item.isFavorite && (
                          <span className="inline-block bg-orange-100 text-orange-600 text-[10px] font-black px-2 py-0.5 rounded mt-1 uppercase tracking-wider">
                            🔥 {t("Bestseller")}
                          </span>
                        )}
                        {item.description && <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{(language !== 'en' && item.descriptionTranslations?.[language]) || t(item.description)}</p>}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="font-black text-orange-600">
                          {item.variants?.length > 0 ? `₹${Math.min(...item.variants.map((v) => v.price))} - ₹${Math.max(...item.variants.map((v) => v.price))}` : `₹${item.price}`}
                        </span>
                        <button
                        onClick={() => handleAddClick(item)}
                        className="bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white px-4 py-1.5 rounded-full font-bold text-sm transition-colors shadow-sm">{t("ADD")}


                      </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>);

        })}
      </main>

      {/* Live Order Tracking Banner */}
      <AnimatePresence>
        {activeOrderData && cart.length === 0 && orderStatus === 'menu' && activeOrderData.kitchenStatus !== 'Completed' && (
          <motion.div
            initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
            className="fixed bottom-6 left-0 right-0 px-4 z-30">
            <div className={`w-full text-white rounded-2xl p-4 shadow-2xl flex flex-col gap-2 transition-all ${
              activeOrderData.kitchenStatus === 'Ready' 
                ? 'bg-emerald-600 border-2 border-emerald-400 shadow-emerald-600/30' 
                : activeOrderData.kitchenStatus === 'Preparing'
                ? 'bg-amber-600 shadow-amber-600/30'
                : 'bg-blue-600 shadow-blue-600/30'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-2 text-base">
                  {activeOrderData.kitchenStatus === 'Ready' ? (
                    <span className="text-xl">🎉</span>
                  ) : activeOrderData.kitchenStatus === 'Preparing' ? (
                    <span className="animate-pulse text-xl">👨‍🍳</span>
                  ) : (
                    <span className="text-xl">📋</span>
                  )}
                  {activeOrderData.kitchenStatus === 'Ready' 
                    ? t("Order Ready & Served!") 
                    : activeOrderData.kitchenStatus === 'Preparing'
                    ? t("Order in Kitchen")
                    : t("Order Received")}
                </span>
                <span className="font-black text-lg">₹{activeOrderData.total}</span>
              </div>

              <div className="flex items-center gap-2 text-white/90 text-sm">
                <div className="h-2 flex-1 bg-black/20 rounded-full overflow-hidden">
                  <div className={`h-full bg-white rounded-full transition-all duration-500 ${
                    activeOrderData.kitchenStatus === 'Ready'
                      ? 'w-full'
                      : activeOrderData.kitchenStatus === 'Preparing'
                      ? 'w-2/3 animate-[progress_2s_ease-in-out_infinite]'
                      : 'w-1/3 animate-[progress_2s_ease-in-out_infinite]'
                  }`}></div>
                </div>
                <span className="font-bold text-xs shrink-0">{activeOrderData.itemsCount} {t("items")}</span>
              </div>

              <p className="text-xs text-white/90 font-medium mt-0.5">
                {t("Status")}: {' '}
                <span className="font-bold underline decoration-2">
                  {activeOrderData.kitchenStatus === 'Ready'
                    ? t("Food is Ready! Hot & Fresh 🍲")
                    : activeOrderData.kitchenStatus === 'Preparing'
                    ? t("Chef is preparing your food...")
                    : t("Sent to Kitchen ⏳")}
                </span>
              </p>
            </div>
            
            <style jsx="true">{`
              @keyframes progress {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(200%); }
              }
            `}</style>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Cart Button */}
      {cart.length > 0 && orderStatus === 'menu' &&
      <motion.div
        initial={{ y: 100 }} animate={{ y: 0 }}
        className="fixed bottom-6 left-0 right-0 px-4 z-30">
        
          <button
          onClick={() => setIsCartOpen(true)}
          className="w-full bg-slate-900 text-white rounded-2xl p-4 shadow-2xl flex items-center justify-between">
          
            <div className="flex items-center gap-3">
              <div className="bg-orange-500 text-white font-black w-8 h-8 rounded-full flex items-center justify-center">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </div>
              <span className="font-bold">{t("View Order")}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg">₹{calculateTotal()}</span>
              <ChevronRight size={20} />
            </div>
          </button>
        </motion.div>
      }

      {/* Floating Call Waiter Button */}
      {orderStatus === 'menu' &&
      <div className={`fixed right-4 ${cart.length > 0 ? 'bottom-28' : 'bottom-6'} z-30 flex flex-col items-end gap-3 transition-all duration-300`}>
          <AnimatePresence>
            {isServiceOpen &&
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col w-48">
            
                <button onClick={() => requestService('Call Waiter')} className="p-4 flex items-center gap-3 hover:bg-orange-50 text-slate-700 font-bold border-b">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><Bell size={16} /></div>{t("Call Waiter")}

            </button>
                <button onClick={() => requestService('Need Water')} className="p-4 flex items-center gap-3 hover:bg-blue-50 text-slate-700 font-bold border-b">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Droplets size={16} /></div>{t("Need Water")}

            </button>
                <button onClick={() => requestService('Pay the Bill')} className="p-4 flex items-center gap-3 hover:bg-green-50 text-slate-700 font-bold">
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><CreditCard size={16} /></div>{t("Pay the Bill")}

            </button>
              </motion.div>
          }
          </AnimatePresence>

          <button
          onClick={() => setIsServiceOpen(!isServiceOpen)}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-colors ${isServiceOpen ? 'bg-slate-800 text-white' : 'bg-white text-orange-600 border-2 border-orange-500'}`}>
          
            {isServiceOpen ? <X size={24} /> : <Bell size={24} className="animate-bounce" />}
          </button>
        </div>
      }

      {/* Service Request Toast */}
      <AnimatePresence>
        {serviceMessage &&
        <motion.div
          initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
          className="fixed top-6 left-4 right-4 bg-slate-800 text-white p-4 rounded-xl shadow-xl flex items-center gap-3 z-50">
          
            <CheckCircle2 className="text-green-400" />
            <span className="font-bold flex-1">{serviceMessage}</span>
          </motion.div>
        }
      </AnimatePresence>

      {/* Add Item Modal */}
      <AnimatePresence>
        {selectedItemForAdd &&
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          
            <motion.div
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-3xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
            
              <div className="p-6 border-b flex justify-between items-center shrink-0">
                <h3 className="font-black text-xl text-slate-800">{(language !== 'en' && selectedItemForAdd.nameTranslations?.[language]) || t(selectedItemForAdd.name)}</h3>
                <button onClick={() => setSelectedItemForAdd(null)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 overflow-y-auto space-y-4">
                {selectedItemForAdd.variants && selectedItemForAdd.variants.length > 0 ? (
                  <div>
                    <p className="font-bold text-slate-600 mb-2">{t("Select Variant")}</p>
                    <div className="space-y-2">
                      {selectedItemForAdd.variants.map((v, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            addToCart(selectedItemForAdd, v, specialNote);
                            setSelectedItemForAdd(null);
                          }}
                          className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-slate-100 hover:border-orange-500 hover:bg-orange-50 transition-all text-left">
                          <span className="font-bold text-slate-700">{v.name}</span>
                          <span className="font-black text-orange-600">₹{v.price}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-700">{t("Price")}</span>
                      <span className="font-black text-orange-600 text-lg">₹{selectedItemForAdd.price}</span>
                    </div>
                  </div>
                )}
                
                <div>
                  <p className="font-bold text-slate-600 mb-2 flex items-center gap-2">
                    <Info size={16} className="text-orange-500"/>
                    {t("Special Instructions")}
                  </p>
                  <textarea
                    value={specialNote}
                    onChange={(e) => setSpecialNote(e.target.value)}
                    placeholder={t("e.g. Less spicy, no onions...")}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none h-20"
                  />
                </div>

                {/* Smart Upselling */}
                {selectedItemForAdd && 
                 !['beverage', 'drink', 'juice'].some(k => selectedItemForAdd.category?.name?.toLowerCase().includes(k)) && (
                  (() => {
                    let upsells = items.filter(i => 
                      ['beverage', 'drink', 'juice', 'dessert'].some(k => i.category?.name?.toLowerCase().includes(k))
                    ).sort(() => 0.5 - Math.random()).slice(0, 2);
                    
                    if (upsells.length === 0) {
                      upsells = items.filter(i => i._id !== selectedItemForAdd._id && i.price <= 150).slice(0, 2);
                    }
                    
                    if (upsells.length === 0) return null;

                    return (
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <p className="font-bold text-slate-600 mb-3">{t("Pairs well with...")}</p>
                        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                          {upsells.map(upsell => (
                            <div key={`upsell-${upsell._id}`} className="min-w-[140px] bg-white border border-slate-200 rounded-xl p-2 shrink-0 flex flex-col justify-between">
                              <div>
                                <h5 className="font-bold text-sm text-slate-800 line-clamp-1">{(language !== 'en' && upsell.nameTranslations?.[language]) || t(upsell.name)}</h5>
                                <p className="text-orange-600 font-bold text-xs mt-1">₹{upsell.price}</p>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCart(upsell);
                                  // Show a tiny success toast or just let it add seamlessly
                                  const btn = e.currentTarget;
                                  const originalText = btn.innerText;
                                  btn.innerText = t("Added!");
                                  btn.classList.add("bg-green-500", "text-white");
                                  btn.classList.remove("bg-orange-50", "text-orange-600");
                                  setTimeout(() => {
                                    if(btn) {
                                      btn.innerText = originalText;
                                      btn.classList.remove("bg-green-500", "text-white");
                                      btn.classList.add("bg-orange-50", "text-orange-600");
                                    }
                                  }, 1000);
                                }}
                                className="mt-2 w-full bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white py-1.5 rounded-lg text-xs font-bold transition-colors"
                              >
                                + {t("ADD")}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>

              {(!selectedItemForAdd.variants || selectedItemForAdd.variants.length === 0) && (
                <div className="p-4 border-t bg-slate-50 shrink-0">
                  <button
                    onClick={() => {
                      addToCart(selectedItemForAdd, null, specialNote);
                      setSelectedItemForAdd(null);
                    }}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 font-bold shadow-md transition-colors"
                  >
                    {t("Add to Order")}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Cart Modal */}
      <AnimatePresence>
        {isCartOpen &&
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col justify-end">
          
            <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="bg-white rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden">
            
              <div className="p-6 pb-4 border-b flex items-center justify-between shrink-0">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  <ShoppingCart className="text-orange-500" />{t("Your Order")}
              </h2>
                <button onClick={() => setIsCartOpen(false)} className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {cart.map((item, index) =>
              <div key={index} className="flex items-center justify-between py-4 border-b last:border-0">
                    <div className="flex-1 pr-2">
                      <h4 className="font-bold text-slate-800">{(language !== 'en' && item.nameTranslations?.[language]) || t(item.name)}</h4>
                      <p className="text-orange-600 font-bold text-sm">₹{item.price}</p>
                      {item.specialNote && (
                        <p className="text-xs text-slate-500 mt-1 italic flex gap-1">
                          <span className="font-bold text-slate-400">Note:</span> {item.specialNote}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 bg-slate-50 border rounded-xl p-1">
                      <button onClick={() => updateQuantity(index, -1)} className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-white rounded-lg shadow-sm">
                        <Minus size={16} />
                      </button>
                      <span className="font-black w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(index, 1)} className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-white rounded-lg shadow-sm">
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
              )}
              </div>

              <div className="p-6 bg-slate-50 border-t shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-slate-600 font-bold">{t("Total Amount")}</span>
                  <span className="text-2xl font-black text-slate-800">₹{calculateTotal()}</span>
                </div>
                <button
                onClick={placeOrder}
                disabled={orderStatus === 'placing'}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-2xl py-4 font-black text-lg shadow-xl shadow-orange-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                
                  {orderStatus === 'placing' ? 'Sending to Kitchen...' : 'Place Order Now'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Success Screen */}
      <AnimatePresence>
        {orderStatus === 'success' &&
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-white flex flex-col items-center justify-center p-6 text-center">
          
            <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}
            className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6">
            
              <CheckCircle2 size={48} />
            </motion.div>
            <h2 className="text-3xl font-black text-slate-800 mb-2">{t("Order Placed!")}</h2>
            <p className="text-slate-600 text-lg mb-8">{t("Your order has been sent to the kitchen. It will be served to you shortly.")}</p>
            
            {googleReviewLink && (
              <a 
                href={googleReviewLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white border-2 border-slate-200 text-slate-700 hover:border-yellow-400 hover:bg-yellow-50 font-bold py-3 px-6 rounded-xl flex items-center gap-2 shadow-sm transition-all"
              >
                <Star className="text-yellow-400" fill="currentColor" size={20} />
                {t("Rate us on Google")}
              </a>
            )}
          </motion.div>
        }
      </AnimatePresence>

    </div>);

};

export default CustomerMenu;