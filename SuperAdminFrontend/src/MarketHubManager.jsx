import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import BulkProductImportModal from './components/BulkProductImportModal';
import { ShoppingCart, Plus, Edit3, Tag, Image as ImageIcon, Box, Package, Loader2, X, IndianRupee, AlertTriangle, BarChart2, Upload } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { API_BASE_URL } from './config';

const MarketHubManager = () => {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('adminMarketHubTab') || 'Dashboard';
  });

  useEffect(() => {
    localStorage.setItem('adminMarketHubTab', activeTab);
  }, [activeTab]); // 'Dashboard', 'Products', or 'Orders'
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [imageError, setImageError] = useState('');
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusForm, setStatusForm] = useState({
    status: 'Processing',
    location: '',
    note: ''
  });
  const imageInputRef = useRef(null);
  
  const initialForm = {
    name: '',
    description: '',
    category: 'Hardware',
    price: '',
    currency: 'INR',
    stockCount: '',
    imageUrl: '',
    features: [''],
    isActive: true,
    vendorName: 'Internal',
    supplierPrice: '',
    allowedVendors: []
  };
  const [formData, setFormData] = useState(initialForm);
  const [productPage, setProductPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('superadmin_token');
      const res = await axios.get(`${API_BASE_URL}/markethub/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(res.data);
    } catch (error) {
      console.error('Error fetching products', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('superadmin_token');
      const res = await axios.get(`${API_BASE_URL}/markethub/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(res.data);
    } catch (error) {
      console.error('Error fetching orders', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const token = localStorage.getItem('superadmin_token');
      const res = await axios.get(`${API_BASE_URL}/vendors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVendors(res.data);
    } catch (error) {
      console.warn('Could not fetch vendors (might be a vendor user)', error.message);
    }
  };

  useEffect(() => {
    // Fetch both to populate KPI stats
    const loadData = async () => {
      fetchProducts();
      fetchOrders();
      fetchVendors();
    };
    loadData();
  }, []);

  const handleBulkImportData = async (validItems) => {
    try {
      const token = localStorage.getItem('superadmin_token');
      await axios.post(`${API_BASE_URL}/markethub/products/bulk`, { products: validItems }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`Successfully imported ${validItems.length} products!`);
      fetchProducts();
    } catch (error) {
      console.error('Error importing CSV/Excel:', error);
      throw new Error('Failed to import products to database.', { cause: error });
    }
  };

  const stats = React.useMemo(() => {
    const totalProducts = products.length;
    const lowStock = products.filter(p => p.stockCount < 10 && p.isActive).length;
    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const pendingOrders = orders.filter(o => o.status === 'Processing' || o.status === 'Pending').length;
    
    // Generate actual graph data based on orders (Last 6 months)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const chartDataMap = {};
    const today = new Date();
    
    // Initialize last 6 months to ensure they show up even if 0
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      chartDataMap[key] = { name: monthNames[d.getMonth()], sales: 0 };
    }

    orders.forEach(order => {
      if (!order.createdAt) return;
      const orderDate = new Date(order.createdAt);
      const key = `${orderDate.getFullYear()}-${orderDate.getMonth()}`;
      if (chartDataMap[key]) {
        chartDataMap[key].sales += (order.totalAmount || 0);
      }
    });

    const chartData = Object.values(chartDataMap);

    return { totalProducts, lowStock, totalRevenue, pendingOrders, chartData };
  }, [products, orders]);

  const handleOpenAdd = () => {
    setIsEdit(false);
    setImageError('');
    setFormData(initialForm);
    setModalOpen(true);
  };

  const handleOpenEdit = (product) => {
    setIsEdit(true);
    setImageError('');
    setFormData({
      ...product,
      price: product.price,
      stockCount: product.stockCount,
      imageUrl: product.images && product.images.length > 0 ? product.images[0] : '',
      allowedVendors: product.allowedVendors || []
    });
    setModalOpen(true);
  };

  const handleImageUpload = (e) => {
    setImageError('');
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setImageError('File size exceeds the strict 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, imageUrl: reader.result });
    };
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const preventNegativeAndScroll = {
    onWheel: (e) => e.target.blur(),
    onKeyDown: (e) => {
      if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
        e.preventDefault();
      }
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      const token = localStorage.getItem('superadmin_token');
      await axios.delete(`${API_BASE_URL}/markethub/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product', error);
    }
  };

  const handleFeatureChange = (index, value) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData({ ...formData, features: newFeatures });
  };

  const addFeatureField = () => {
    setFormData({ ...formData, features: [...formData.features, ''] });
  };

  const removeFeatureField = (index) => {
    const newFeatures = formData.features.filter((_, i) => i !== index);
    setFormData({ ...formData, features: newFeatures });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('superadmin_token');
      const payload = {
        ...formData,
        category: formData.category ? formData.category.toUpperCase() : 'HARDWARE',
        price: Number(formData.price),
        supplierPrice: formData.supplierPrice ? Number(formData.supplierPrice) : undefined,
        stockCount: Number(formData.stockCount),
        features: formData.features.filter(f => f.trim() !== ''),
        images: formData.imageUrl ? [formData.imageUrl] : []
      };

      if (isEdit) {
        await axios.put(`${API_BASE_URL}/markethub/products/${formData._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_BASE_URL}/markethub/products`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setModalOpen(false);
      fetchProducts();
    } catch (error) {
      console.error('Error saving product', error);
      alert('Failed to save product');
    }
  };

  const openStatusModal = (order) => {
    setSelectedOrder(order);
    setStatusForm({
      status: order.status || 'Processing',
      location: '',
      note: ''
    });
    setStatusModalOpen(true);
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('superadmin_token');
      await axios.put(`${API_BASE_URL}/markethub/orders/${selectedOrder._id}/status`, statusForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Order status updated successfully!');
      setStatusModalOpen(false);
      fetchOrders();
    } catch (error) {
      console.error('Error updating status', error);
      alert(`Failed to update status: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleClearOrders = async () => {
    if (!window.confirm('Are you sure you want to completely remove all orders for this restaurant?')) return;
    try {
      const token = localStorage.getItem('superadmin_token');
      await axios.delete(`${API_BASE_URL}/markethub/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Orders completely removed from the database for this restaurant.');
      fetchOrders();
    } catch (error) {
      console.error('Error clearing orders', error);
      alert('Failed to clear orders');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <BulkProductImportModal 
        isOpen={isBulkImportOpen} 
        onClose={() => setIsBulkImportOpen(false)} 
        onImportSuccess={handleBulkImportData} 
      />
      
      {/* Compact Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 bg-surface border border-border p-3 sm:p-4 rounded-2xl shadow-sm">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-fuchsia-500/10 rounded-xl border border-fuchsia-500/20">
            <ShoppingCart className="text-fuchsia-500 w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none hidden sm:block">Market Hub</h2>
        </div>
        
        {/* Tabs and Actions Row */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Tabs */}
          <div className="flex bg-gray-900/50 p-1 rounded-xl border border-border/50">
            {['Dashboard', 'Products', 'Orders'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all duration-300 ${activeTab === tab ? 'bg-fuchsia-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
              >
                {tab === 'Products' ? 'Catalog' : tab}
              </button>
            ))}
          </div>

          {/* Action Buttons (Visible only on Catalog tab) */}
          {activeTab === 'Products' && (
            <div className="flex items-center gap-2">
              <button onClick={() => setIsBulkImportOpen(true)} className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold py-1.5 px-3 sm:py-2 sm:px-4 text-xs sm:text-sm rounded-lg transition-all flex items-center gap-2 border border-gray-700">
                <Upload size={16} />
                <span className="hidden sm:inline">Bulk Import</span>
              </button>
              <button
                className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-1.5 px-3 sm:py-2 sm:px-4 text-xs sm:text-sm rounded-lg transition-all shadow-[0_0_15px_rgba(217,70,239,0.3)] flex items-center gap-2"
                onClick={handleOpenAdd}
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Add Product</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'Dashboard' && (
        <div className="animate-fade-in-up">
          {/* KPI Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface border border-border p-5 rounded-2xl shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total Sales</p>
              <h3 className="text-2xl font-black text-white">₹{stats.totalRevenue.toLocaleString()}</h3>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
              <IndianRupee size={20} />
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-2xl shadow-lg relative overflow-hidden group hover:border-blue-500/30 transition-colors">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Pending Orders</p>
              <h3 className="text-2xl font-black text-white">{stats.pendingOrders}</h3>
            </div>
            <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
              <Package size={20} />
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-2xl shadow-lg relative overflow-hidden group hover:border-fuchsia-500/30 transition-colors">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-fuchsia-500/10 rounded-full blur-2xl group-hover:bg-fuchsia-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Active Listings</p>
              <h3 className="text-2xl font-black text-white">{stats.totalProducts}</h3>
            </div>
            <div className="p-2.5 bg-fuchsia-500/10 rounded-xl border border-fuchsia-500/20 text-fuchsia-400">
              <Tag size={20} />
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-2xl shadow-lg relative overflow-hidden group hover:border-red-500/30 transition-colors">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Low Stock Alerts</p>
              <h3 className="text-2xl font-black text-white">{stats.lowStock}</h3>
            </div>
            <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20 text-red-400">
              <AlertTriangle size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-6 shadow-lg relative overflow-hidden group">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <BarChart2 className="text-fuchsia-400" />
                Revenue Overview
              </h3>
              <p className="text-sm text-gray-400 mt-1">Monthly B2B hardware and software sales</p>
            </div>
          </div>
          <div className="h-[300px] w-full relative rounded-xl overflow-hidden">
            {stats.totalRevenue === 0 ? (
              <div className="absolute inset-0 bg-background/50 border border-border/50 rounded-xl flex flex-col items-center justify-center p-6 text-center shadow-inner">
                <div className="w-16 h-16 bg-fuchsia-500/10 rounded-full flex items-center justify-center mb-4 border border-fuchsia-500/20 shadow-[0_0_30px_rgba(217,70,239,0.15)]">
                  <BarChart2 className="text-fuchsia-400 w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-white mb-2">Analytics Locked</h4>
                <p className="text-gray-400 text-sm max-w-[250px] mb-6">
                  Your revenue overview will automatically generate as soon as your clients start placing orders.
                </p>
                <button 
                  onClick={() => { setActiveTab('Products'); handleOpenAdd(); }}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600 font-bold py-2 px-6 rounded-xl transition-colors text-sm flex items-center gap-2"
                >
                  <Plus size={16} /> Add Product to Catalog
                </button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d946ef" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#d946ef" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="name" stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '0.75rem', color: '#fff' }}
                    itemStyle={{ color: '#d946ef', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#d946ef" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-white mb-6">Quick Actions</h3>
          <div className="space-y-4">
            <button onClick={() => { setActiveTab('Products'); handleOpenAdd(); }} className="w-full flex items-center justify-between p-4 bg-gray-900/50 hover:bg-gray-800 rounded-xl border border-border/50 hover:border-fuchsia-500/30 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-fuchsia-500/10 rounded-lg text-fuchsia-400 group-hover:scale-110 transition-transform"><Plus size={18} /></div>
                <span className="font-bold text-gray-300 group-hover:text-white">Add New Product</span>
              </div>
            </button>
            <button onClick={() => setActiveTab('Orders')} className="w-full flex items-center justify-between p-4 bg-gray-900/50 hover:bg-gray-800 rounded-xl border border-border/50 hover:border-blue-500/30 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 group-hover:scale-110 transition-transform"><Package size={18} /></div>
                <span className="font-bold text-gray-300 group-hover:text-white">Process Orders</span>
              </div>
            </button>
            <button onClick={() => setActiveTab('Products')} className="w-full flex items-center justify-between p-4 bg-gray-900/50 hover:bg-gray-800 rounded-xl border border-border/50 hover:border-emerald-500/30 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 group-hover:scale-110 transition-transform"><Tag size={18} /></div>
                <span className="font-bold text-gray-300 group-hover:text-white">Manage Catalog</span>
              </div>
            </button>
          </div>
        </div>
      </div>
      </div>
      )}

      {activeTab === 'Orders' && (
        /* Compact Orders View */
        <div className="space-y-4 animate-fade-in-up">
          {loading ? (
            <div className="flex justify-center items-center py-20 bg-surface rounded-2xl border border-border shadow-lg">
              <Loader2 className="w-10 h-10 text-fuchsia-500 animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center p-12 bg-surface rounded-2xl border border-border shadow-lg">
              <Package className="w-16 h-16 text-gray-600 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-bold text-white mb-2">No Orders Yet</h3>
              <p className="text-gray-400 max-w-sm mx-auto">Orders placed by your restaurant clients will appear here automatically.</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center bg-surface border border-border p-4 rounded-t-xl shadow-sm">
                <h3 className="text-white font-bold">Total Orders: {orders.length}</h3>
                <div className="flex items-center gap-4">
                  <button onClick={handleClearOrders} className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded font-bold transition-colors shadow-lg">Clear All</button>
                  <span className="text-sm text-gray-400">
                    Page {orderPage} of {Math.ceil(orders.length / ITEMS_PER_PAGE)}
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setOrderPage(p => Math.max(1, p - 1))} 
                      disabled={orderPage === 1}
                      className="px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button 
                      onClick={() => setOrderPage(p => Math.min(Math.ceil(orders.length / ITEMS_PER_PAGE), p + 1))} 
                      disabled={orderPage === Math.ceil(orders.length / ITEMS_PER_PAGE)}
                      className="px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto bg-surface border-x border-b border-border rounded-b-xl shadow-sm">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="bg-gray-800/50 text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3">Order ID</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Restaurant</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {orders.slice((orderPage - 1) * ITEMS_PER_PAGE, orderPage * ITEMS_PER_PAGE).map(order => (
                      <tr key={order._id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-white text-xs">{order._id.substring(0,8).toUpperCase()}</td>
                        <td className="px-4 py-3 text-xs">{new Date(order.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-medium text-white">{order.restaurantName}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {order.trackingHistory && order.trackingHistory.length > 0 && order.trackingHistory[order.trackingHistory.length - 1].location 
                            ? order.trackingHistory[order.trackingHistory.length - 1].location 
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {order.trackingHistory && order.trackingHistory.length > 0 
                            ? new Date(order.trackingHistory[order.trackingHistory.length - 1].date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata', timeZoneName: 'short' })
                            : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${order.status === 'Processing' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : order.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-400">₹{order.grandTotal?.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => openStatusModal(order)} className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded text-xs font-bold hover:bg-indigo-500/20 transition-colors">Update</button>
                            <a href={order.invoiceUrl} target="_blank" rel="noreferrer" className="px-3 py-1 bg-gray-800 text-gray-300 rounded text-xs font-bold hover:bg-gray-700 transition-colors">Invoice</a>
                          </div>
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
      
      {activeTab === 'Products' && (
      /* Grid of Products */
      <div className="animate-fade-in-up">

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="bg-gradient-to-b from-surface to-background border border-border rounded-2xl overflow-hidden min-h-[450px] flex items-center justify-center shadow-lg relative mt-2">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
          <div className="text-center p-8 relative z-10">
            <div className="w-24 h-24 bg-fuchsia-500/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_50px_rgba(217,70,239,0.2)] border border-fuchsia-500/20">
              <Box className="w-12 h-12 text-fuchsia-400" />
            </div>
            <h3 className="text-3xl font-black text-white mb-3">Your Catalog is Empty</h3>
            <p className="text-gray-400 max-w-md mx-auto mb-8 leading-relaxed">
              Start adding POS terminals, thermal printers, QR code stands, and premium software add-ons to monetize your client base.
            </p>
            <button
              className="bg-fuchsia-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-fuchsia-500 transition-all shadow-[0_0_20px_rgba(217,70,239,0.3)] flex items-center gap-2 mx-auto"
              onClick={handleOpenAdd}
            >
              <Plus size={20} />
              Add First Product
            </button>
          </div>
        </div>
      ) : (
          <>
            <div className="flex justify-between items-center bg-surface border border-border p-4 rounded-t-xl shadow-sm">
              <h3 className="text-white font-bold">Total Products: {products.length}</h3>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400">
                  Page {productPage} of {Math.ceil(products.length / ITEMS_PER_PAGE) || 1}
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setProductPage(p => Math.max(1, p - 1))} 
                    disabled={productPage === 1}
                    className="px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button 
                    onClick={() => setProductPage(p => Math.min(Math.ceil(products.length / ITEMS_PER_PAGE) || 1, p + 1))} 
                    disabled={productPage >= (Math.ceil(products.length / ITEMS_PER_PAGE) || 1)}
                    className="px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto bg-surface border-x border-b border-border rounded-b-xl shadow-sm">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-gray-800/50 text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {products.slice((productPage - 1) * ITEMS_PER_PAGE, productPage * ITEMS_PER_PAGE).map(product => (
                    <tr key={product._id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">
                        <span className="line-clamp-1">{product.name}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">{product.category}</td>
                      <td className="px-4 py-3 font-bold text-emerald-400">
                        {product.currency === 'INR' ? '₹' : '$'}{product.price?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${product.stockCount > 10 ? 'text-blue-400' : product.stockCount > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                          {product.stockCount}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {product.isActive ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Active</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-red-500/10 text-red-400 border-red-500/20">Hidden</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => handleOpenEdit(product)} className="px-3 py-1 bg-gray-800 text-white rounded text-xs font-bold hover:bg-gray-700 transition-colors border border-gray-700">Edit</button>
                          <button onClick={() => handleDelete(product._id)} className="px-3 py-1 bg-red-500/10 text-red-400 rounded text-xs font-bold hover:bg-red-500/20 transition-colors border border-red-500/20">Delete</button>
                        </div>
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

      {/* Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
            <div className="flex justify-between items-center p-5 border-b border-border bg-background/50">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                {isEdit ? <Edit3 className="text-indigo-400 w-5 h-5" /> : <Plus className="text-indigo-400 w-5 h-5" />}
                {isEdit ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="product-form" onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Product Name</label>
                    <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-background border border-border rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="e.g. MS Billing Thermal Printer" />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Category</label>
                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-background border border-border rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors">
                      <option value="Hardware">Hardware (Printers, POS, Scanners)</option>
                      <option value="Software">Software (Add-ons, Integrations)</option>
                      <option value="Service">Service (Setup, Maintenance)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Description</label>
                  <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-background border border-border rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors min-h-[100px]" placeholder="Detailed product description..."></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-3.5 text-gray-500 font-bold">₹</span>
                      <input type="number" min="0" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} {...preventNegativeAndScroll} className="w-full bg-background border border-border rounded-xl p-3 pl-8 text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="0" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Stock Count</label>
                    <input type="number" min="0" required value={formData.stockCount} onChange={e => setFormData({...formData, stockCount: e.target.value})} {...preventNegativeAndScroll} className="w-full bg-background border border-border rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="Quantity" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Status</label>
                    <div className="flex items-center h-12 bg-background border border-border rounded-xl px-4">
                      <label className="relative inline-flex items-center cursor-pointer w-full justify-between">
                        <span className="text-sm font-medium text-white">{formData.isActive ? 'Active (Visible)' : 'Draft (Hidden)'}</span>
                        <input type="checkbox" className="sr-only peer" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[22px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 flex justify-between">
                    <span>Product Image</span>
                    {imageError && <span className="text-red-400 text-[10px] animate-pulse">{imageError}</span>}
                  </label>
                  <div className="flex flex-col gap-3">
                    <div className="relative flex gap-3">
                      <input type="file" accept="image/*" ref={imageInputRef} hidden onChange={handleImageUpload} />
                      <button type="button" onClick={() => imageInputRef.current.click()} className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 px-4 rounded-xl border border-gray-700 transition-all flex items-center justify-center gap-2 whitespace-nowrap">
                        <Upload size={16} /> Upload Photo
                      </button>
                      <div className="relative flex-1">
                        <ImageIcon className="absolute left-3 top-3.5 text-gray-500 w-5 h-5" />
                        <input type="url" value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className="w-full bg-background border border-border rounded-xl p-3 pl-10 text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="Or paste direct URL..." />
                      </div>
                    </div>
                    {formData.imageUrl && (
                      <div className="p-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl flex justify-center items-center shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all animate-fade-in relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none"></div>
                        <img src={formData.imageUrl} alt="Preview" className="h-40 max-w-full object-contain drop-shadow-2xl rounded-lg relative z-10" />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1.5">JPG, PNG, GIF up to 5MB strict limit.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 border border-indigo-500/30 bg-indigo-500/5 rounded-xl">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-indigo-400 mb-1.5 flex items-center gap-1">
                      <Tag size={12} /> Supplier / Vendor Name
                    </label>
                    <input type="text" value={formData.vendorName} onChange={e => setFormData({...formData, vendorName: e.target.value})} className="w-full bg-background border border-border rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="e.g. Shreyans, Passiflow" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-indigo-400 mb-1.5">Supplier Wholesale Price (₹)</label>
                    <input type="number" min="0" value={formData.supplierPrice} onChange={e => setFormData({...formData, supplierPrice: e.target.value})} {...preventNegativeAndScroll} className="w-full bg-background border border-border rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="Wholesale cost" />
                    {formData.price && formData.supplierPrice && (
                      <p className="text-xs text-emerald-400 mt-2 font-bold flex justify-between">
                        <span>Your Commission:</span>
                        <span>₹{Number(formData.price) - Number(formData.supplierPrice)}</span>
                      </p>
                    )}
                  </div>
                </div>

                {vendors.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Vendor Permissions (Who can see/sell this)</label>
                    <div className="grid grid-cols-2 gap-2 bg-background p-3 rounded-xl border border-border">
                      {vendors.map(vendor => (
                        <label key={vendor._id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-900"
                            checked={formData.allowedVendors.includes(vendor._id)}
                            onChange={(e) => {
                              const newVendors = e.target.checked 
                                ? [...formData.allowedVendors, vendor._id] 
                                : formData.allowedVendors.filter(id => id !== vendor._id);
                              setFormData({ ...formData, allowedVendors: newVendors });
                            }}
                          />
                          {vendor.vendorCompanyName || vendor.name}
                        </label>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1.5">Select which vendors can access this product.</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 flex justify-between items-center">
                    <span>Bullet Features</span>
                    <button type="button" onClick={addFeatureField} className="text-indigo-400 flex items-center gap-1 hover:text-indigo-300"><Plus size={14}/> Add Feature</button>
                  </label>
                  <div className="space-y-3">
                    {formData.features.map((feature, index) => (
                      <div key={index} className="flex gap-2">
                        <input type="text" value={feature} onChange={e => handleFeatureChange(index, e.target.value)} className="flex-1 bg-background border border-border rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder={`Feature ${index + 1}...`} />
                        <button type="button" onClick={() => removeFeatureField(index)} className="p-2.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors">
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-5 border-t border-border bg-background/50 flex gap-3">
              <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl transition-colors border border-gray-700">Cancel</button>
              <button type="submit" form="product-form" className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] border border-indigo-500">
                {isEdit ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Status Update Modal */}
      {statusModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-fade-in">
            <div className="flex justify-between items-center p-5 border-b border-border bg-background/50">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Package className="text-indigo-400 w-5 h-5" /> Update Tracking
              </h3>
              <button onClick={() => setStatusModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6">
              <form id="status-form" onSubmit={handleUpdateStatus} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">New Status</label>
                  <select 
                    value={statusForm.status} 
                    onChange={e => setStatusForm({...statusForm, status: e.target.value})} 
                    className="w-full bg-background border border-border rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Processing">Processing</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Out for Delivery">Out for Delivery</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Location (Optional)</label>
                  <input 
                    type="text" 
                    value={statusForm.location} 
                    onChange={e => setStatusForm({...statusForm, location: e.target.value})} 
                    className="w-full bg-background border border-border rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500" 
                    placeholder="e.g. Mumbai Sorting Facility" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Note / Driver Info (Optional)</label>
                  <input 
                    type="text" 
                    value={statusForm.note} 
                    onChange={e => setStatusForm({...statusForm, note: e.target.value})} 
                    className="w-full bg-background border border-border rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500" 
                    placeholder="e.g. Handed over to delivery agent" 
                  />
                </div>
              </form>
            </div>
            
            <div className="p-5 border-t border-border bg-background/50 flex gap-3">
              <button type="button" onClick={() => setStatusModalOpen(false)} className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl border border-gray-700">Cancel</button>
              <button type="submit" form="status-form" className="flex-[2] py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.3)] border border-indigo-500">
                Update Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketHubManager;
