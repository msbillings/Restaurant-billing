import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShoppingCart, Package, Info, Tag, Plus, Check, Star, X, CreditCard, Receipt } from 'lucide-react';
import './MarketHub.css';
import { getApiUrl } from '../config';

const MarketHub = ({ onNavigate }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  
  // Phase 2 Cart & Checkout States
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);

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
      
      if (response.data.length === 0) {
        setProducts([
          {
            _id: '1',
            name: 'Epson TM-T82X POS Printer',
            category: 'HARDWARE',
            price: 11500,
            originalPrice: 14000,
            stockCount: 50,
            description: 'Industry standard thermal receipt printer. USB + Serial interface, fast printing speed of 200mm/s.',
            images: ['https://m.media-amazon.com/images/I/51r-88aZheL._SX679_.jpg'],
            features: ['200mm/s Print Speed', 'Auto Cutter', 'USB + Ethernet']
          },
          {
            _id: '2',
            name: 'Thermal Paper Rolls (Box of 50)',
            category: 'SUPPLIES',
            price: 2500,
            originalPrice: 3000,
            stockCount: 500,
            description: 'Premium quality 3-inch (80mm) thermal paper rolls. High brightness and long-lasting print.',
            images: ['https://m.media-amazon.com/images/I/71Yv3P0p-QL._SX679_.jpg'],
            features: ['80mm Width', 'BPA Free', 'Dark Print']
          }
        ]);
      } else {
        setProducts(response.data);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching products', err);
      setError('Failed to load Market Hub catalog. Please try again.');
      setLoading(false);
    }
  };

  const handleAddToCart = (e, product) => {
    e.stopPropagation();
    setCart(prev => {
      const existing = prev.find(item => item.product._id === product._id);
      if (existing) {
        return prev.map(item => item.product._id === product._id ? { ...item, quantity: item.quantity + 1 } : item);
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
          <div>
            <h1 className="mh-title">B2B Market Hub</h1>
            <p className="mh-subtitle">Equip your restaurant with enterprise-grade hardware, supplies, and integrations.</p>
          </div>
          <button className="mh-cart-btn" onClick={() => setIsCartOpen(true)}>
            <ShoppingCart size={20} />
            <span>Cart</span>
            {cartCount > 0 && <span className="mh-cart-badge">{cartCount}</span>}
          </button>
        </div>
        
        {/* Apple-style Segmented Control */}
        <div className="mh-tabs">
          {['ALL', 'HARDWARE', 'SOFTWARE', 'SUPPLIES'].map(tab => (
            <button 
              key={tab}
              className={`mh-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mh-error-banner">{error}</div>}

      {/* Product Grid */}
      <div className="mh-grid">
        {filteredProducts.map((product) => (
          <div key={product._id} className="mh-card group">
            {product.originalPrice && (
              <div className="mh-discount-badge">
                Save ₹{product.originalPrice - product.price}
              </div>
            )}
            
            <div className="mh-image-container">
              <img 
                src={product.images?.[0] || product.imageUrl || 'https://via.placeholder.com/300?text=No+Image'} 
                alt={product.name} 
                className="mh-image"
                onError={(e) => { e.target.src = 'https://via.placeholder.com/300?text=Image+Not+Found' }}
              />
            </div>
            
            <div className="mh-info">
              <div className="mh-category">
                <Tag size={14} />
                <span>{product.category}</span>
              </div>
              <h3 className="mh-name">{product.name}</h3>
              <p className="mh-desc">{product.description}</p>
              
              <div className="mh-features">
                {product.features?.map((f, i) => (
                  <span key={i} className="mh-feature-pill">
                    <Check size={12} className="text-emerald-500" /> {f}
                  </span>
                ))}
              </div>
            </div>

            <div className="mh-footer">
              <div className="mh-pricing">
                <span className="mh-price">₹{product.price.toLocaleString('en-IN')}</span>
                {product.originalPrice && (
                  <span className="mh-original-price">₹{product.originalPrice.toLocaleString('en-IN')}</span>
                )}
                {product.category !== 'SOFTWARE' && <span className="mh-tax-info">+ GST</span>}
                {product.category === 'SOFTWARE' && <span className="mh-tax-info">/ month</span>}
              </div>
              
              <button 
                className={`mh-add-btn ${product.stockCount <= 0 ? 'disabled' : ''}`}
                onClick={(e) => handleAddToCart(e, product)}
                disabled={product.stockCount <= 0}
              >
                {product.stockCount <= 0 ? 'Out of Stock' : (
                  <>
                    <Plus size={18} /> Add
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

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
                  
                  <a href={orderSuccess.invoiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 transition-all shadow-[0_5px_15px_rgba(5,150,105,0.3)]">
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
                          <button onClick={() => updateQuantity(item.product._id, 1)} className="px-2.5 py-1 text-gray-600 hover:text-black font-bold border-l">+</button>
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
    </div>
  );
};

export default MarketHub;
