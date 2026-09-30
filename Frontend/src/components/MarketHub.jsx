import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShoppingCart, Package, Info, Tag, Plus, Check, Star, X, CreditCard, Receipt } from 'lucide-react';
import './MarketHub.css';
import { getApiUrl } from '../config';

const MarketHub = ({ onNavigate }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('clientMarketHubTab') || 'ALL';
  });

  useEffect(() => {
    localStorage.setItem('clientMarketHubTab', activeTab);
  }, [activeTab]);
  
  const getFullInvoiceUrl = (url) => {
    if (!url) return '#';
    if (!url.startsWith('/')) return url;
    const apiUrl = getApiUrl();
    if (apiUrl.endsWith('/api') && url.startsWith('/api/')) {
      return `${apiUrl}${url.substring(4)}`;
    }
    return `${apiUrl}${url}`;
  };
  
  // Phase 2 Cart & Checkout States
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem('clientMarketHubCart');
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [flyingItems, setFlyingItems] = useState([]);

  useEffect(() => {
    localStorage.setItem('clientMarketHubCart', JSON.stringify(cart));
  }, [cart]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [orderPage, setOrderPage] = useState(1);
  const [productPage, setProductPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  useEffect(() => {
    if (activeTab === 'ORDERS') {
      fetchOrders();
    }
  }, [activeTab]);

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const token = localStorage.getItem('accessToken');
      const apiUrl = getApiUrl();
      const response = await axios.get(`${apiUrl}/markethub/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const apiUrl = getApiUrl();
      
      const response = await axios.get(`${apiUrl}/markethub/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setProducts(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching products', err);
      setError('Failed to load Market Hub catalog. Please try again.');
      setLoading(false);
    }
  };

  const handleAddToCart = (e, product) => {
    e.stopPropagation();
    
    // Animation Logic
    const btnRect = e.target.getBoundingClientRect();
    const cartBtn = document.querySelector('.mh-cart-btn');
    let tx = 0, ty = 0;
    
    if (cartBtn) {
      const cartRect = cartBtn.getBoundingClientRect();
      tx = cartRect.left + cartRect.width / 2 - (btnRect.left + btnRect.width / 2);
      ty = cartRect.top + cartRect.height / 2 - (btnRect.top + btnRect.height / 2);
    } else {
      tx = window.innerWidth - 50 - btnRect.left;
      ty = 50 - btnRect.top;
    }

    const newFlyingItem = {
      id: Date.now() + Math.random(),
      x: btnRect.left + btnRect.width / 2 - 12,
      y: btnRect.top + btnRect.height / 2 - 12,
      tx: `${tx}px`,
      ty: `${ty}px`,
    };

    setFlyingItems(prev => [...prev, newFlyingItem]);
    
    setTimeout(() => {
      setFlyingItems(prev => prev.filter(item => item.id !== newFlyingItem.id));
    }, 800);

    setCart(prev => {
      const existing = prev.find(item => item.product._id === product._id);
      if (existing) {
        if (existing.quantity + 1 > product.stockCount) {
          alert(`Cannot add more. Only ${product.stockCount} items in stock.`);
          return prev;
        }
        return prev.map(item => item.product._id === product._id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      if (product.stockCount < 1) {
        alert('Item is out of stock.');
        return prev;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product._id !== productId));
  };

  const updateQuantity = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.product._id === productId) {
        const newQ = item.quantity + delta;
        if (newQ > item.product.stockCount) {
          alert(`Maximum stock reached. Only ${item.product.stockCount} items available.`);
          return item;
        }
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const cartGst = cartTotal * 0.18; // Flat 18% for demo, can be dynamic
  const grandTotal = cartTotal + cartGst;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const apiUrl = getApiUrl();
      
      const payload = {
        items: cart.map(item => ({
          productId: item.product._id,
          vendorId: item.product.vendorId, // include vendor info
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          category: item.product.category
        })),
        totalAmount: cartTotal,
        gstAmount: cartGst,
        grandTotal: grandTotal,
        shippingAddress: {
          street: '123 Restaurant Avenue',
          city: 'Metropolis',
          state: 'State',
          zipCode: '100001',
          contactNumber: '9999999999'
        },
        paymentMethod: 'UPI'
      };

      const res = await axios.post(`${apiUrl}/markethub/orders`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setOrderSuccess(res.data);
      setCart([]);
      fetchProducts(); // Refresh stock
    } catch (error) {
      console.error('Checkout failed', error);
      alert('Checkout failed. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const filteredProducts = activeTab === 'ALL' 
    ? products 
    : products.filter(p => p.category === activeTab);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="market-hub-wrapper relative">
      {/* Premium Header */}
      <div className="mh-header">
        <div className="mh-header-content">
          <div className="mh-title-group">
            <h1 className="mh-title">B2B Market Hub</h1>
            <span className="mh-subtitle-divider hidden md:inline">•</span>
            <p className="mh-subtitle">Equip your restaurant with enterprise-grade hardware, supplies, and integrations.</p>
          </div>
          
          <div className="mh-actions-group">
            {/* Apple-style Segmented Control */}
            <div className="mh-tabs">
              {['ALL', 'HARDWARE', 'SOFTWARE', 'SUPPLIES', 'ORDERS'].map(tab => (
                <button 
                  key={tab}
                  className={`mh-tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0) + tab.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            
            <button className="mh-cart-btn" onClick={() => setIsCartOpen(true)}>
              <ShoppingCart size={20} />
              <span>Cart</span>
              {cartCount > 0 && <span className="mh-cart-badge">{cartCount}</span>}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="mh-error-banner">{error}</div>}

      {/* Order Tracking View */}
      {activeTab === 'ORDERS' && (
        <div className="w-full mt-4">
          <h2 className="text-2xl font-black mb-6 text-gray-900 px-2">Your Orders & Tracking</h2>
          {loadingOrders ? (
             <div className="text-center py-12"><div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div><p className="mt-4 text-gray-500 font-medium">Loading your orders...</p></div>
          ) : (
            <>
              <div className="flex justify-between items-center bg-white border border-gray-200 p-4 rounded-t-xl shadow-sm mb-0">
                <h3 className="text-gray-900 font-bold">Total Orders: {orders.length}</h3>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    Page {orderPage} of {Math.ceil(orders.length / ITEMS_PER_PAGE) || 1}
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setOrderPage(p => Math.max(1, p - 1))} 
                      disabled={orderPage === 1}
                      className="px-3 py-1 bg-gray-100 text-gray-700 font-medium rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      Prev
                    </button>
                    <button 
                      onClick={() => setOrderPage(p => Math.min(Math.ceil(orders.length / ITEMS_PER_PAGE) || 1, p + 1))} 
                      disabled={orderPage >= (Math.ceil(orders.length / ITEMS_PER_PAGE) || 1)}
                      className="px-3 py-1 bg-gray-100 text-gray-700 font-medium rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto bg-white border-x border-b border-gray-200 rounded-b-xl shadow-sm">
                <table className="w-full text-left text-sm text-gray-700">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                    <tr>
                      <th className="px-4 py-3">Order ID</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.slice((orderPage - 1) * ITEMS_PER_PAGE, orderPage * ITEMS_PER_PAGE).map(order => (
                      <tr key={order._id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedOrder(order)}>
                        <td className="px-4 py-3 font-mono font-bold text-gray-900 text-xs">{order._id.substring(0,8).toUpperCase()}</td>
                        <td className="px-4 py-3 text-xs">{new Date(order.createdAt).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-3 text-xs font-medium text-gray-600">
                          {order.trackingHistory && order.trackingHistory.length > 0 && order.trackingHistory[order.trackingHistory.length - 1].location 
                            ? order.trackingHistory[order.trackingHistory.length - 1].location 
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-gray-600 whitespace-nowrap">
                          {order.trackingHistory && order.trackingHistory.length > 0 
                            ? new Date(order.trackingHistory[order.trackingHistory.length - 1].date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata', timeZoneName: 'short' })
                            : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${order.status === 'Processing' ? 'bg-amber-100 text-amber-700 border-amber-200' : order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-black text-indigo-700">₹{order.grandTotal.toLocaleString()}</td>
                        <td className="px-4 py-3 text-center">
                          <a href={getFullInvoiceUrl(order.invoiceUrl)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-[10px] bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white px-2.5 py-1.5 rounded font-bold transition-colors">
                            <Receipt size={12} /> Invoice
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Product Grid */}
      {activeTab !== 'ORDERS' && (
        <div className="w-full mt-4">
          <div className="flex justify-between items-center bg-white border border-gray-200 p-4 rounded-t-xl shadow-sm mb-0">
            <h3 className="text-gray-900 font-bold">Total Products: {filteredProducts.length}</h3>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                Page {productPage} of {Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1}
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setProductPage(p => Math.max(1, p - 1))} 
                  disabled={productPage === 1}
                  className="px-3 py-1 bg-gray-100 text-gray-700 font-medium rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  Prev
                </button>
                <button 
                  onClick={() => setProductPage(p => Math.min(Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1, p + 1))} 
                  disabled={productPage >= (Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1)}
                  className="px-3 py-1 bg-gray-100 text-gray-700 font-medium rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto bg-white border-x border-b border-gray-200 rounded-b-xl shadow-sm">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                <tr>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.slice((productPage - 1) * ITEMS_PER_PAGE, productPage * ITEMS_PER_PAGE).map(product => (
                  <tr key={product._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <span className="line-clamp-1">{product.name}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">{product.category}</td>
                    <td className="px-4 py-3 font-black text-indigo-700">
                      ₹{product.price?.toLocaleString()}
                      {product.originalPrice && <span className="ml-1 text-[10px] text-gray-400 line-through">₹{product.originalPrice.toLocaleString()}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${product.stockCount > 10 ? 'text-emerald-500' : product.stockCount > 0 ? 'text-amber-500' : 'text-red-500'}`}>
                        {product.stockCount > 0 ? `${product.stockCount} in stock` : 'Out of Stock'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        className={`px-3 py-1.5 rounded font-bold text-xs transition-colors border flex items-center justify-center gap-1 mx-auto ${product.stockCount <= 0 ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-600 hover:text-white'}`}
                        onClick={(e) => handleAddToCart(e, product)}
                        disabled={product.stockCount <= 0}
                      >
                        {product.stockCount <= 0 ? 'Out of Stock' : (
                          <>
                            <Plus size={14} /> Add to Cart
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cart Slide-over Overlay */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-fade-in">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col translate-x-0 transition-transform duration-300">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <ShoppingCart className="text-indigo-600" /> Your Cart
              </h2>
              <button onClick={() => setIsCartOpen(false)} className="text-gray-400 hover:text-gray-600 bg-white shadow-sm p-1.5 rounded-lg border">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {orderSuccess ? (
                <div className="text-center py-10">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 border-4 border-emerald-50">
                    <Check size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-2">Order Confirmed!</h3>
                  <p className="text-gray-500 mb-6 font-medium">Your B2B hardware order has been received and is being processed.</p>
                  
                  <div className="bg-gray-50 rounded-xl p-4 text-left border mb-6">
                    <p className="text-sm text-gray-500 mb-1">Order ID</p>
                    <p className="font-mono font-bold text-gray-900">{orderSuccess._id}</p>
                    <div className="h-px bg-gray-200 my-3"></div>
                    <p className="text-sm text-gray-500 mb-1">Amount Paid</p>
                    <p className="font-bold text-gray-900 text-lg">₹{orderSuccess.grandTotal.toLocaleString()}</p>
                  </div>
                  
                  <a href={getFullInvoiceUrl(orderSuccess.invoiceUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 transition-all shadow-[0_5px_15px_rgba(5,150,105,0.3)]">
                    <Receipt size={18} /> Download GST Invoice
                  </a>
                  
                  <button onClick={() => { setOrderSuccess(null); setIsCartOpen(false); }} className="w-full mt-3 bg-white border-2 border-gray-200 text-gray-700 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition-colors">
                    Continue Shopping
                  </button>
                </div>
              ) : cart.length === 0 ? (
                <div className="text-center py-20 text-gray-500 flex flex-col items-center">
                  <ShoppingCart size={48} className="text-gray-300 mb-4" />
                  <p className="font-medium text-lg text-gray-400">Your cart is empty.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex gap-4 items-center bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                      <img src={item.product.images?.[0] || item.product.imageUrl || 'https://via.placeholder.com/80'} alt={item.product.name} className="w-16 h-16 object-cover rounded-lg bg-gray-50" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-gray-900 truncate">{item.product.name}</h4>
                        <p className="text-indigo-600 font-black text-sm">₹{item.product.price.toLocaleString()}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center bg-gray-100 rounded-lg border">
                          <button onClick={() => updateQuantity(item.product._id, -1)} className="px-2.5 py-1 text-gray-600 hover:text-black font-bold border-r">-</button>
                          <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.product._id, 1)} 
                            className={`px-2.5 py-1 font-bold border-l ${item.quantity >= item.product.stockCount ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-black'}`}
                            disabled={item.quantity >= item.product.stockCount}
                          >+</button>
                        </div>
                        <button onClick={() => removeFromCart(item.product._id)} className="text-xs text-red-500 font-medium hover:underline">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!orderSuccess && cart.length > 0 && (
              <div className="p-6 bg-gray-50 border-t">
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-gray-500 text-sm font-medium">
                    <span>Subtotal</span>
                    <span>₹{cartTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-sm font-medium">
                    <span>GST (18%)</span>
                    <span>₹{cartGst.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-900 font-black text-lg pt-3 border-t">
                    <span>Total</span>
                    <span>₹{grandTotal.toLocaleString()}</span>
                  </div>
                </div>
                
                <button 
                  onClick={handleCheckout} 
                  disabled={checkoutLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_5px_20px_rgba(79,70,229,0.4)] disabled:opacity-70"
                >
                  {checkoutLoading ? 'Processing...' : (
                    <>
                      <CreditCard size={20} />
                      Pay ₹{grandTotal.toLocaleString()} & Complete Order
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Tracking Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden relative">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-black text-gray-900">Order Details</h3>
                <p className="text-sm text-gray-500 font-mono mt-1">ID: {selectedOrder._id}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-900 bg-white shadow-sm border border-gray-200 p-2 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 bg-white">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                {/* Status Card */}
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                  <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Current Status</p>
                  <p className="text-2xl font-black text-indigo-700">{selectedOrder.status}</p>
                  <p className="text-sm text-indigo-500/80 font-medium mt-1">Placed on {new Date(selectedOrder.createdAt).toLocaleDateString()}</p>
                </div>
                {/* Total Card */}
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex flex-col justify-center">
                  <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1">Amount Paid</p>
                  <p className="text-2xl font-black text-emerald-700">₹{selectedOrder.grandTotal?.toLocaleString()}</p>
                  <a href={getFullInvoiceUrl(selectedOrder.invoiceUrl)} target="_blank" rel="noreferrer" className="text-emerald-600 font-bold text-sm mt-2 flex items-center gap-1 hover:underline">
                    <Receipt size={14} /> View Invoice
                  </a>
                </div>
              </div>

              {/* Tracking Timeline */}
              <h4 className="font-bold text-gray-900 mb-4 uppercase tracking-wider text-sm flex items-center gap-2">
                <Info size={16} className="text-indigo-500"/> Tracking History
              </h4>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 mb-8">
                {selectedOrder.trackingHistory && selectedOrder.trackingHistory.length > 0 ? (
                  <div className="space-y-6">
                    {[...selectedOrder.trackingHistory].reverse().map((track, i) => (
                      <div key={i} className="flex gap-4 relative">
                        {i !== selectedOrder.trackingHistory.length - 1 && (
                          <div className="absolute top-8 left-3.5 w-0.5 h-full bg-gray-200"></div>
                        )}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${i === 0 ? 'bg-indigo-600 text-white shadow-md ring-4 ring-indigo-50' : 'bg-white border-2 border-gray-200 text-gray-400'}`}>
                          <Check size={14} />
                        </div>
                        <div className="pt-0.5">
                          <p className={`font-bold text-sm ${i === 0 ? 'text-gray-900' : 'text-gray-600'}`}>{track.status}</p>
                          <p className="text-xs text-gray-500 font-medium mt-1 flex items-center gap-2">
                            <span>{new Date(track.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            {track.location && <span className="bg-gray-200 px-2 py-0.5 rounded text-[10px] text-gray-700">{track.location}</span>}
                          </p>
                          {track.note && (
                            <p className="text-sm text-gray-600 mt-2 bg-white p-2.5 rounded-lg border border-gray-100">{track.note}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-500 font-medium">No tracking history available yet.</p>
                    <p className="text-sm text-gray-400 mt-1">Updates will appear here once the vendor processes the order.</p>
                  </div>
                )}
              </div>

              {/* Order Items */}
              <h4 className="font-bold text-gray-900 mb-4 uppercase tracking-wider text-sm flex items-center gap-2">
                <Package size={16} className="text-indigo-500"/> Order Items
              </h4>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3 text-center">Qty</th>
                      <th className="px-4 py-3 text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {selectedOrder.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                        <td className="px-4 py-3 text-center font-bold text-indigo-600">{item.quantity}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-700">₹{(item.price * item.quantity).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Flying Items */}
      {flyingItems.map(item => (
        <div 
          key={item.id} 
          className="flying-item" 
          style={{ 
            left: item.x, 
            top: item.y, 
            '--tx': item.tx, 
            '--ty': item.ty 
          }}
        >
          +1
        </div>
      ))}
    </div>
  );
};

export default MarketHub;
