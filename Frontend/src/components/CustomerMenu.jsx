import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShoppingCart, Plus, Minus, X, Info, UtensilsCrossed, ChevronRight, CheckCircle2, Navigation, Bell, Droplets, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';

const CustomerMenu = () => {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderStatus, setOrderStatus] = useState('menu'); // menu, placing, success
  
  // Service Request & Variants State
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [serviceMessage, setServiceMessage] = useState(null);
  const [selectedItemForVariant, setSelectedItemForVariant] = useState(null);

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
        const response = await axios.get(`${API_BASE_URL}/public/menu`, {
          headers: {
            'X-Tenant-DB': tenant
          }
        });
        setCategories(response.data.categories);
        setItems(response.data.items);
      } catch (err) {
        console.error("Failed to load menu", err);
        setError("Could not load the menu. Please ask a staff member for assistance.");
      } finally {
        setLoading(false);
      }
    };

    fetchMenu();
  }, [tenant, table]);

  const addToCart = (item, variant = null) => {
    const variantName = variant ? variant.name : null;
    const itemPrice = variant ? variant.price : item.price;
    const itemName = variant ? `${item.name} - ${variant.name}` : item.name;

    const existingIndex = cart.findIndex(cartItem => cartItem.menuItem === item._id && cartItem.variant === variantName);
    
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
        variant: variantName
      }]);
    }
  };

  const handleAddClick = (item) => {
    if (item.variants && item.variants.length > 0) {
      setSelectedItemForVariant(item);
    } else {
      addToCart(item);
    }
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
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
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
        <h2 className="text-xl font-bold text-slate-700">Loading your menu...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <Info className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Oops!</h2>
        <p className="text-slate-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      {/* Header */}
      <header className="bg-orange-500 text-white p-6 rounded-b-[2rem] shadow-lg relative z-10">
        <h1 className="text-3xl font-black text-center tracking-tight mb-2">Digital Menu</h1>
        <div className="flex items-center justify-center gap-2 bg-white/20 w-max mx-auto px-4 py-1.5 rounded-full backdrop-blur-sm">
          <Navigation size={16} />
          <span className="font-bold text-sm">You are at {table}</span>
        </div>
      </header>

      {/* Menu Categories & Items */}
      <main className="p-4 space-y-8 mt-4">
        {categories.map(category => {
          const categoryItems = items.filter(item => 
            (item.category?._id || item.category) === category._id || 
            (item.category?.name || item.category) === category.name
          );

          if (categoryItems.length === 0) return null;

          return (
            <div key={category._id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl font-black text-slate-800 mb-4 px-2 flex items-center gap-2">
                {category.name}
                <div className="h-px bg-slate-200 flex-1 ml-4 mt-1"></div>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categoryItems.map(item => (
                  <div key={item._id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex gap-4">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-24 h-24 object-cover rounded-xl shadow-sm" />
                    ) : (
                      <div className="w-24 h-24 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300">
                        <UtensilsCrossed size={32} />
                      </div>
                    )}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between">
                          <h3 className="font-bold text-slate-800 leading-tight">{item.name}</h3>
                          <span className={`w-3 h-3 rounded-full shrink-0 ${item.type === 'veg' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        </div>
                        {item.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="font-black text-orange-600">
                          {item.variants?.length > 0 ? `₹${Math.min(...item.variants.map(v=>v.price))} - ₹${Math.max(...item.variants.map(v=>v.price))}` : `₹${item.price}`}
                        </span>
                        <button 
                          onClick={() => handleAddClick(item)}
                          className="bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white px-4 py-1.5 rounded-full font-bold text-sm transition-colors shadow-sm"
                        >
                          ADD
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </main>

      {/* Floating Cart Button */}
      {cart.length > 0 && orderStatus === 'menu' && (
        <motion.div 
          initial={{ y: 100 }} animate={{ y: 0 }}
          className="fixed bottom-6 left-0 right-0 px-4 z-30"
        >
          <button 
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-slate-900 text-white rounded-2xl p-4 shadow-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="bg-orange-500 text-white font-black w-8 h-8 rounded-full flex items-center justify-center">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </div>
              <span className="font-bold">View Order</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg">₹{calculateTotal()}</span>
              <ChevronRight size={20} />
            </div>
          </button>
        </motion.div>
      )}

      {/* Floating Call Waiter Button */}
      {orderStatus === 'menu' && (
        <div className={`fixed right-4 ${cart.length > 0 ? 'bottom-28' : 'bottom-6'} z-30 flex flex-col items-end gap-3 transition-all duration-300`}>
          <AnimatePresence>
            {isServiceOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 20, scale: 0.9 }} 
                animate={{ opacity: 1, y: 0, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col w-48"
              >
                <button onClick={() => requestService('Call Waiter')} className="p-4 flex items-center gap-3 hover:bg-orange-50 text-slate-700 font-bold border-b">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><Bell size={16} /></div>
                  Call Waiter
                </button>
                <button onClick={() => requestService('Need Water')} className="p-4 flex items-center gap-3 hover:bg-blue-50 text-slate-700 font-bold border-b">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Droplets size={16} /></div>
                  Need Water
                </button>
                <button onClick={() => requestService('Pay the Bill')} className="p-4 flex items-center gap-3 hover:bg-green-50 text-slate-700 font-bold">
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><CreditCard size={16} /></div>
                  Pay the Bill
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            onClick={() => setIsServiceOpen(!isServiceOpen)}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-colors ${isServiceOpen ? 'bg-slate-800 text-white' : 'bg-white text-orange-600 border-2 border-orange-500'}`}
          >
            {isServiceOpen ? <X size={24} /> : <Bell size={24} className="animate-bounce" />}
          </button>
        </div>
      )}

      {/* Service Request Toast */}
      <AnimatePresence>
        {serviceMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
            className="fixed top-6 left-4 right-4 bg-slate-800 text-white p-4 rounded-xl shadow-xl flex items-center gap-3 z-50"
          >
            <CheckCircle2 className="text-green-400" />
            <span className="font-bold flex-1">{serviceMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Variant Selector Modal */}
      <AnimatePresence>
        {selectedItemForVariant && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 border-b flex justify-between items-center">
                <h3 className="font-black text-xl text-slate-800">Select Variant</h3>
                <button onClick={() => setSelectedItemForVariant(null)} className="p-2 bg-slate-100 rounded-full text-slate-500">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                <p className="font-bold text-slate-600 mb-2">{selectedItemForVariant.name}</p>
                {selectedItemForVariant.variants.map((v, i) => (
                  <button 
                    key={i}
                    onClick={() => {
                      addToCart(selectedItemForVariant, v);
                      setSelectedItemForVariant(null);
                    }}
                    className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-slate-100 hover:border-orange-500 hover:bg-orange-50 transition-all text-left"
                  >
                    <span className="font-bold text-slate-700">{v.name}</span>
                    <span className="font-black text-orange-600">₹{v.price}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Modal */}
      <AnimatePresence>
        {isCartOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col justify-end"
          >
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="bg-white rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 pb-4 border-b flex items-center justify-between shrink-0">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  <ShoppingCart className="text-orange-500" /> Your Order
                </h2>
                <button onClick={() => setIsCartOpen(false)} className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {cart.map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-4 border-b last:border-0">
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-800">{item.name}</h4>
                      <p className="text-orange-600 font-bold text-sm">₹{item.price}</p>
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
                ))}
              </div>

              <div className="p-6 bg-slate-50 border-t shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-slate-600 font-bold">Total Amount</span>
                  <span className="text-2xl font-black text-slate-800">₹{calculateTotal()}</span>
                </div>
                <button 
                  onClick={placeOrder}
                  disabled={orderStatus === 'placing'}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-2xl py-4 font-black text-lg shadow-xl shadow-orange-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {orderStatus === 'placing' ? 'Sending to Kitchen...' : 'Place Order Now'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Screen */}
      <AnimatePresence>
        {orderStatus === 'success' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-white flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.div 
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}
              className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6"
            >
              <CheckCircle2 size={48} />
            </motion.div>
            <h2 className="text-3xl font-black text-slate-800 mb-2">Order Placed!</h2>
            <p className="text-slate-600 text-lg mb-8">Your order has been sent to the kitchen. It will be served to you shortly.</p>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default CustomerMenu;
