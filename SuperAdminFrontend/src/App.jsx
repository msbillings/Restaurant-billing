import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Shield, Key, Users, RefreshCw, AlertTriangle, Search, Activity, Power, Edit3, TrendingUp, Clock, LogOut, Fingerprint, Globe, MapPin, Radio, Plus, Trash2, CheckCircle, XCircle, Image, Upload, ExternalLink } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Login from './Login';
import { startRegistration } from '@simplewebauthn/browser';

// Axios Interceptor for JWT
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('superadmin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

function App() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [signupsFilter, setSignupsFilter] = useState('7days');
  const [currentTab, setCurrentTab] = useState('Dashboard');
  const [token, setToken] = useState(localStorage.getItem('superadmin_token'));
  const [adminUser, setAdminUser] = useState(JSON.parse(localStorage.getItem('superadmin_user') || 'null'));
  
  // Global Analytics State
  const [globalStats, setGlobalStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  
  // Modal State
  const [licenseModal, setLicenseModal] = useState({ isOpen: false, clientId: null, licenseKey: '', validUntil: '', resetHardware: false });
  const [createClientModal, setCreateClientModal] = useState({ isOpen: false, restaurantName: '', ownerName: '', email: '', password: '', plan: 'Yearly', customDays: '', staffAccounts: [] });
  const [featuresModal, setFeaturesModal] = useState({ isOpen: false, clientId: null, features: {} });
  const [viewStaffModal, setViewStaffModal] = useState({ isOpen: false, staffAccounts: [], restaurantName: '' });

  // Broadcast State
  const [broadcasts, setBroadcasts] = useState([]);
  const [newBroadcast, setNewBroadcast] = useState({ title: '', message: '', imageUrl: '' });

  const fetchBroadcasts = async () => {
    try {
      const response = await axios.get('https://restaurant-superadmin-api-maheer.vercel.app/api/broadcasts');
      setBroadcasts(response.data);
    } catch (error) {
      console.error('Error fetching broadcasts:', error);
    }
  };

  const fetchClients = async () => {
    setLoading(true);
    try {
      const response = await axios.get('https://restaurant-superadmin-api-maheer.vercel.app/api/clients');
      setClients(response.data);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalStats = async () => {
    setLoadingStats(true);
    try {
      const response = await axios.get('https://restaurant-superadmin-api-maheer.vercel.app/api/analytics/global');
      setGlobalStats(response.data);
    } catch (error) {
      console.error('Error fetching global stats:', error);
      alert('Failed to calculate global stats.');
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchClients();
      fetchBroadcasts();
    }
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('superadmin_token');
    localStorage.removeItem('superadmin_user');
    setToken(null);
    setAdminUser(null);
  };

  if (!token) {
    return <Login onLogin={(t) => setToken(t)} />;
  }

  const handleRegisterFingerprint = async () => {
    try {
      // 1. Get registration options
      const resp = await axios.get('https://restaurant-superadmin-api-maheer.vercel.app/api/auth/webauthn/register/generate');
      const options = resp.data;

      // 2. Start biometric prompt
      const attResp = await startRegistration(options);

      // 3. Verify registration
      const verificationResp = await axios.post('https://restaurant-superadmin-api-maheer.vercel.app/api/auth/webauthn/register/verify', attResp);

      if (verificationResp.data.verified) {
        alert('🎉 Fingerprint registered successfully! You can now use TouchID to login.');
      } else {
        alert('Failed to register fingerprint.');
      }
    } catch (err) {
      console.error(err);
      const backendErr = err.response?.data?.details || err.message;
      alert(`Error registering fingerprint: ${backendErr}`);
    }
  };

  const handleOverridePassword = async (id, name) => {
    const newPassword = prompt(`Enter new password for ${name}:`);
    if (!newPassword) return;

    try {
      await axios.put(`https://restaurant-superadmin-api-maheer.vercel.app/api/clients/${id}/password`, { newPassword });
      fetchClients();
      alert('Password overridden successfully!');
    } catch (error) {
      alert('Failed to override password.');
    }
  };

  const openLicenseModal = (client) => {
    setLicenseModal({
      isOpen: true,
      clientId: client._id,
      licenseKey: client.licenseKey || '',
      validUntil: client.validUntil ? new Date(client.validUntil).toISOString().split('T')[0] : '',
      resetHardware: false
    });
  };

  const handleSaveLicense = async () => {
    try {
      await axios.put(`https://restaurant-superadmin-api-maheer.vercel.app/api/clients/${licenseModal.clientId}/license`, {
        licenseKey: licenseModal.licenseKey,
        validUntil: licenseModal.validUntil,
        resetHardware: licenseModal.resetHardware
      });
      alert('License updated successfully!');
      setLicenseModal({ isOpen: false, clientId: null, licenseKey: '', validUntil: '', resetHardware: false });
      fetchClients();
    } catch (error) {
      alert('Failed to update license.');
      console.error(error);
    }
  };

  const openFeaturesModal = (client) => {
    setFeaturesModal({
      isOpen: true,
      clientId: client._id,
      features: client.features || {
        kds: true, inventory: true, crm: true, staff: true, 
        analytics: true, daybook: true, qrcode: true, delivery: true, expenses: true
      }
    });
  };

  const handleSaveFeatures = async () => {
    try {
      await axios.put(`https://restaurant-superadmin-api-maheer.vercel.app/api/clients/${featuresModal.clientId}/features`, {
        features: featuresModal.features
      });
      alert('Features updated successfully!');
      setFeaturesModal({ isOpen: false, clientId: null, features: {} });
      fetchClients();
    } catch (error) {
      alert('Failed to update features.');
      console.error(error);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Quick validation
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Compress image if it's too large (optional, but good practice for Base64)
      const img = document.createElement('img');
      img.src = reader.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        setNewBroadcast({ ...newBroadcast, imageUrl: compressedBase64 });
      };
    };
  };

  const handleCreateBroadcast = async (e) => {
    e.preventDefault();
    try {
      await axios.post('https://restaurant-superadmin-api-maheer.vercel.app/api/broadcasts', newBroadcast);
      setNewBroadcast({ title: '', message: '', imageUrl: '' });
      fetchBroadcasts();
      alert('Broadcast created successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to create broadcast. ' + (err.response?.data?.message || err.message));
    }
  };

  const toggleBroadcast = async (id) => {
    try {
      await axios.put(`https://restaurant-superadmin-api-maheer.vercel.app/api/broadcasts/${id}/toggle`);
      fetchBroadcasts();
    } catch (err) {
      alert('Failed to toggle broadcast');
    }
  };

  const deleteBroadcast = async (id) => {
    if (!window.confirm('Are you sure you want to delete this broadcast?')) return;
    try {
      await axios.delete(`https://restaurant-superadmin-api-maheer.vercel.app/api/broadcasts/${id}`);
      fetchBroadcasts();
    } catch (err) {
      alert('Failed to delete broadcast');
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    if (!confirm(`Are you sure you want to change this client's status to ${newStatus}?`)) return;

    try {
      await axios.put(`https://restaurant-superadmin-api-maheer.vercel.app/api/clients/${id}/status`, { status: newStatus });
      fetchClients();
    } catch (error) {
      alert('Failed to update status.');
      console.error(error);
    }
  };

  const exportToCSV = () => {
    const headers = ['Restaurant Name', 'Email', 'License Key', 'Plan', 'Status', 'Expires At', 'Hardware ID'];
    const csvRows = [headers.join(',')];

    clients.forEach(c => {
      const row = [
        `"${c.restaurantName || ''}"`,
        `"${c.email || ''}"`,
        `"${c.licenseKey || ''}"`,
        `"${c.plan || 'Unknown'}"`,
        `"${c.status || 'Active'}"`,
        `"${c.validUntil ? new Date(c.validUntil).toLocaleDateString() : 'N/A'}"`,
        `"${c.hardwareId || 'Not Activated'}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `msbilling_clients_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      await axios.post('https://restaurant-superadmin-api-maheer.vercel.app/api/clients', createClientModal);
      alert('Client and License generated successfully!');
      setCreateClientModal({ isOpen: false, restaurantName: '', ownerName: '', email: '', password: '', plan: 'Yearly', customDays: '', staffAccounts: [] });
      fetchClients();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create client');
    }
  };

  const filteredClients = clients.filter(c => {
    const locString = c.location ? `${c.location.city}, ${c.location.country}`.toLowerCase() : 'unknown location';
    const matchesSearch = c.restaurantName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          locString.includes(searchTerm.toLowerCase());
    const matchesPlan = filterPlan === 'All' || c.plan === filterPlan || (filterPlan === 'Custom' && !['Monthly', 'Yearly', 'Lifetime'].includes(c.plan));
    const matchesStatus = filterStatus === 'All' || c.status === filterStatus;
    
    // Check expiry for "Expired" status filter if we add it, but currently using DB status which is 'Active' or 'Suspended'
    if (filterStatus === 'Expired') {
      const isExpired = c.validUntil && new Date(c.validUntil) < new Date();
      return matchesSearch && matchesPlan && isExpired;
    }
    
    return matchesSearch && matchesPlan && matchesStatus;
  });

  // --- ANALYTICS CALCULATIONS ---
  const { totalRevenue, expiringSoon, planData, monthlyData, geographicData } = useMemo(() => {
    let rev = 0;
    const expiring = [];
    const planCounts = { Monthly: 0, Yearly: 0, Lifetime: 0, Custom: 0 };
    const geoCounts = {};
    
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const mData = [];
    if (signupsFilter === '7days') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const name = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
        mData.push({ name, signups: 0, dateKey: name });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today);
        d.setMonth(d.getMonth() - i);
        const name = d.toLocaleDateString('default', { month: 'short', year: '2-digit' });
        mData.push({ name, signups: 0, _month: d.getMonth(), _year: d.getFullYear() });
      }
    }

    clients.forEach(c => {
      // Revenue (Estimated placeholders: Monthly=500, Yearly=5000, Lifetime=20000)
      if (c.plan === 'Monthly') rev += 500;
      else if (c.plan === 'Yearly') rev += 5000;
      else if (c.plan === 'Lifetime') rev += 20000;
      
      // Plan counts
      if (planCounts[c.plan] !== undefined) planCounts[c.plan]++;
      else planCounts['Custom']++;

      // Expiry alerts
      if (c.validUntil) {
        const expiry = new Date(c.validUntil);
        if (expiry > today && expiry <= thirtyDaysFromNow) {
          expiring.push(c);
        } else if (expiry <= today) {
          expiring.push(c);
        }
      }

      // Signups logic
      const dateString = c.licenseCreatedAt || c.createdAt;
      if (dateString) {
        const date = new Date(dateString);
        if (signupsFilter === '7days') {
          const name = date.toLocaleDateString('default', { month: 'short', day: 'numeric' });
          const item = mData.find(m => m.dateKey === name);
          if (item) item.signups++;
        } else {
          const m = date.getMonth();
          const y = date.getFullYear();
          const item = mData.find(x => x._month === m && x._year === y);
          if (item) item.signups++;
        }
      }

      // Geo Data
      if (c.location && c.location.city && c.location.country) {
        const key = `${c.location.city}, ${c.location.country}`;
        geoCounts[key] = (geoCounts[key] || 0) + 1;
      } else {
        geoCounts['Unknown Location'] = (geoCounts['Unknown Location'] || 0) + 1;
      }
    });

    const pData = [
      { name: 'Monthly', value: planCounts.Monthly, color: '#3b82f6' },
      { name: 'Yearly', value: planCounts.Yearly, color: '#10b981' },
      { name: 'Lifetime', value: planCounts.Lifetime, color: '#f59e0b' },
      { name: 'Custom', value: planCounts.Custom, color: '#8b5cf6' }
    ].filter(d => d.value > 0);

    const gData = Object.keys(geoCounts)
      .map(k => ({ name: k, value: geoCounts[k] }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 5);

    return { totalRevenue: rev, expiringSoon: expiring, planData: pData, monthlyData: mData, geographicData: gData };
  }, [clients, signupsFilter]);

  return (
    <div className="min-h-screen bg-background text-white font-sans selection:bg-primary/30">
      
      {/* Top Navbar */}
      <nav className="bg-surface border-b border-border sticky top-0 z-50">
        <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between py-3 min-h-[4rem] gap-y-4">
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30 flex-shrink-0 shadow-[0_0_15px_rgba(255,92,53,0.3)]">
                  <Shield className="text-primary w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="font-black text-lg sm:text-xl tracking-tight whitespace-nowrap">MS<span className="text-primary">BILLING</span> <span className="font-medium text-gray-400 hidden sm:inline">SUPER ADMIN</span></span>
              </div>
              
              <div className="flex sm:hidden items-center gap-2">
                <button onClick={handleRegisterFingerprint} title="Register Fingerprint" className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition">
                  <Fingerprint className="w-4 h-4" />
                </button>
                <button onClick={handleLogout} title="Logout" className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <div className="bg-background/50 px-3 py-1.5 rounded-full border border-border flex items-center gap-2 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs sm:text-sm font-medium text-gray-300">System Online</span>
              </div>
              <div className="hidden sm:flex items-center gap-3 border-l border-border pl-4">
                <div className="text-right">
                  <p className="text-sm font-bold truncate max-w-[120px]">{adminUser?.name || 'Admin'}</p>
                  <p className="text-xs text-gray-500">{adminUser?.role || 'SuperAdmin'}</p>
                </div>
                <button onClick={handleRegisterFingerprint} title="Register Fingerprint" className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition">
                  <Fingerprint className="w-5 h-5" />
                </button>
                <button onClick={handleLogout} title="Logout" className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Tabs */}
      <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex gap-4 border-b border-border">
          <button 
            onClick={() => setCurrentTab('Dashboard')}
            className={`px-4 py-2 font-bold transition-colors ${currentTab === 'Dashboard' ? 'border-b-2 border-primary text-primary' : 'text-gray-400 hover:text-white'}`}
          >
            Client Database
          </button>
          <button 
            onClick={() => setCurrentTab('Insights')}
            className={`px-4 py-2 font-bold transition-colors ${currentTab === 'Insights' ? 'border-b-2 border-primary text-primary' : 'text-gray-400 hover:text-white'}`}
          >
            Global Insights
          </button>
          <button 
            onClick={() => setCurrentTab('Broadcasts')}
            className={`px-4 py-2 font-bold transition-colors ${currentTab === 'Broadcasts' ? 'border-b-2 border-primary text-primary' : 'text-gray-400 hover:text-white'}`}
          >
            Broadcasts (In-App)
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {currentTab === 'Dashboard' && (
          <>
            {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-surface rounded-2xl p-6 border border-border shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Users className="w-24 h-24 text-white" />
            </div>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Total Clients</p>
            <h3 className="text-4xl font-black">{clients.length}</h3>
          </div>
          <div className="bg-surface rounded-2xl p-6 border border-border shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Key className="w-24 h-24 text-white" />
            </div>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Active Licenses</p>
            <h3 className="text-4xl font-black text-primary">{clients.filter(c => c.status === 'Active').length}</h3>
          </div>
          <div className="bg-surface rounded-2xl p-6 border border-border shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp className="w-24 h-24 text-white" />
            </div>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Est. Revenue</p>
            <h3 className="text-4xl font-black text-green-400">₹{totalRevenue.toLocaleString()}</h3>
          </div>
          <div className="bg-surface rounded-2xl p-6 border border-border shadow-lg relative overflow-hidden group flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Generate New Key</p>
              <button onClick={() => setCreateClientModal({ ...createClientModal, isOpen: true })} className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-6 rounded-xl transition-all shadow-lg shadow-primary/20">
                + New Client
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Charts & Alerts Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Expiry Alerts Panel */}
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl flex flex-col max-h-96">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
              <AlertTriangle className="text-amber-500 w-5 h-5" /> 
              Expiry Alerts
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {expiringSoon.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-8">All subscriptions are healthy.</div>
              ) : (
                expiringSoon.map(client => {
                  const isExpired = new Date(client.validUntil) < new Date();
                  return (
                    <div key={client._id} className="bg-background border border-border rounded-lg p-3 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-sm">{client.restaurantName}</p>
                        <p className={`text-xs font-mono ${isExpired ? 'text-red-400' : 'text-amber-400'}`}>
                          {isExpired ? 'Expired' : 'Expiring'}: {new Date(client.validUntil).toLocaleDateString()}
                        </p>
                      </div>
                      <button onClick={() => openLicenseModal(client)} className="text-xs bg-surface border border-border px-2 py-1 rounded hover:bg-gray-700 transition">Extend</button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Growth Chart */}
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl lg:col-span-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2"><TrendingUp className="text-primary w-5 h-5"/> New Signups</h3>
              <select 
                value={signupsFilter} 
                onChange={e => setSignupsFilter(e.target.value)}
                className="bg-background border border-border rounded-lg py-1 px-2 text-xs text-white focus:outline-none focus:border-primary"
              >
                <option value="7days">Last 7 Days</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: '#374151'}} contentStyle={{backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff'}} />
                  <Bar dataKey="signups" fill="#ff5c35" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Plan Distribution */}
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Key className="text-green-500 w-5 h-5"/> Plan Distribution</h3>
            <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={planData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                    {planData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff'}} />
                </PieChart>
              </ResponsiveContainer>
              {/* Custom Legend */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <p className="text-2xl font-black">{clients.length}</p>
                <p className="text-xs text-gray-400">Clients</p>
              </div>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {planData.map(plan => (
                <div key={plan.name} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plan.color }}></div>
                  <span className="text-xs text-gray-300 font-medium">{plan.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Geographic Distribution Row */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl w-full">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Globe className="text-blue-400 w-5 h-5"/> Geographic Distribution <span className="text-xs font-normal text-gray-400 ml-2">(Auto-detected via POS IP)</span></h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {geographicData.length === 0 ? (
                 <div className="col-span-full text-center text-gray-500 py-4 text-sm">Waiting for clients to sync locations...</div>
              ) : (
                geographicData.map((geo, index) => {
                  const isUnknown = geo.name === 'Unknown Location';
                  const mapsUrl = isUnknown ? '#' : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(geo.name)}`;
                  
                  return (
                    <div 
                      key={geo.name} 
                      onClick={() => !isUnknown && setSearchTerm(geo.name.split(',')[0])}
                      className={`relative bg-background border border-border rounded-xl p-4 flex flex-col justify-center items-center text-center transition-all ${!isUnknown ? 'hover:border-blue-500 hover:bg-blue-500/10 cursor-pointer shadow-sm hover:shadow-blue-500/20 hover:-translate-y-1' : 'hover:border-blue-500/50 cursor-default'}`}
                    >
                      {!isUnknown && (
                        <a 
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="absolute top-2 right-2 text-gray-500 hover:text-blue-400 transition-colors"
                          title="View on Google Maps"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <MapPin className="text-blue-400 w-6 h-6 mb-2" />
                      <h4 className={`text-white font-bold text-sm mb-1`}>{geo.name}</h4>
                      <span className="text-xs font-black bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">{geo.value} {geo.value === 1 ? 'Client' : 'Clients'}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Search Bar & Filters */}
        <div className="bg-surface p-4 rounded-t-2xl border border-border border-b-0 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div className="flex items-center justify-between w-full xl:w-auto">
            <h2 className="text-lg font-bold">Client Database</h2>
            <button onClick={exportToCSV} className="text-xs bg-gray-700 hover:bg-gray-600 border border-gray-600 px-3 py-1.5 rounded transition font-medium flex items-center gap-2 whitespace-nowrap">
              Export CSV
            </button>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
            <div className="flex gap-3 w-full sm:w-auto">
              <select 
                value={filterPlan} 
                onChange={e => setFilterPlan(e.target.value)}
                className="w-full sm:w-auto bg-background border border-border rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-primary"
              >
                <option value="All">All Plans</option>
                <option value="Monthly">Monthly</option>
                <option value="Yearly">Yearly</option>
                <option value="Lifetime">Lifetime</option>
                <option value="Custom">Custom</option>
              </select>
              
              <select 
                value={filterStatus} 
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full sm:w-auto bg-background border border-border rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-primary"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Expired">Expired</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-gray-500" />
              </div>
              <input 
                type="text" 
                placeholder="Search restaurant or email..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-background border border-border rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-surface border border-border rounded-b-2xl shadow-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background/50 text-gray-400 text-xs uppercase tracking-wider font-bold">
                <th className="p-4 border-b border-border">Restaurant</th>
                <th className="p-4 border-b border-border">Email</th>
                <th className="p-4 border-b border-border">License Key</th>
                <th className="p-4 border-b border-border">Expires</th>
                <th className="p-4 border-b border-border bg-red-900/10 text-red-400">Plain Password</th>
                <th className="p-4 border-b border-border">HWID Binding</th>
                <th className="p-4 border-b border-border text-center">Status</th>
                <th className="p-4 border-b border-border text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading database...
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-gray-500">No clients found matching your search.</td>
                </tr>
              ) : (
                filteredClients.map(client => (
                  <tr key={client._id} className="hover:bg-background/30 transition-colors">
                    <td className="p-4 font-bold">{client.restaurantName}</td>
                    <td className="p-4 text-gray-300">{client.email}</td>
                    <td className="p-4">
                      <span className="font-mono bg-background px-2 py-1 rounded text-primary text-xs font-bold border border-primary/20 whitespace-nowrap">
                        {client.licenseKey}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-gray-300 text-xs">
                      {client.validUntil ? new Date(client.validUntil).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        <span className="font-mono text-red-400 font-bold bg-red-400/10 px-2 py-1 rounded border border-red-400/20">
                          {client.plainTextPassword}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      {client.hardwareId ? (
                        <span className="text-green-400 text-xs font-mono bg-green-400/10 px-2 py-1 rounded border border-green-400/20" title={client.hardwareId}>
                          {client.hardwareId.substring(0, 10)}...
                        </span>
                      ) : (
                        <span className="text-gray-500 text-xs italic">Not Activated Yet</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        client.status === 'Active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
                        client.status === 'Suspended' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                        'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {client.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex flex-wrap gap-2 justify-end min-w-[200px]">
                        <button 
                          onClick={() => handleToggleStatus(client._id, client.status)}
                          className={`flex items-center gap-1 text-xs font-bold ${client.status === 'Active' ? 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border-orange-500/30' : 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/30'} border px-3 py-1.5 rounded transition-colors`}
                        >
                          <Power className="w-3 h-3" /> {client.status === 'Active' ? 'Suspend' : 'Activate'}
                        </button>
                        <button 
                          onClick={() => openLicenseModal(client)}
                          className="flex items-center gap-1 text-xs font-bold bg-primary hover:bg-primary-hover text-white px-3 py-1.5 rounded transition-colors"
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                        <button 
                          onClick={() => openFeaturesModal(client)}
                          className="flex items-center gap-1 text-xs font-bold bg-accent hover:bg-accent/80 text-white px-3 py-1.5 rounded transition-colors"
                        >
                          Features
                        </button>
                        <button 
                          onClick={() => setViewStaffModal({ isOpen: true, staffAccounts: client.staffAccounts || [], restaurantName: client.restaurantName })}
                          className="flex items-center gap-1 text-xs font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 px-3 py-1.5 rounded transition-colors"
                        >
                          <Users className="w-3 h-3" /> Staff
                        </button>
                        <button 
                          onClick={() => handleOverridePassword(client._id, client.restaurantName)}
                          className="text-xs font-bold bg-surface border border-border hover:bg-gray-700 hover:text-white px-3 py-1.5 rounded transition-colors"
                        >
                          Reset Pwd
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </>)}

        {currentTab === 'Insights' && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-surface p-6 rounded-2xl border border-border shadow-xl">
              <div className="w-full xl:w-auto">
                <h2 className="text-2xl font-black mb-2">Global Platform Analytics</h2>
                <p className="text-gray-400 text-sm">Extracts data directly from all isolated tenant databases across the platform.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                <button 
                  onClick={() => window.open('https://restaurant-superadmin-api-maheer.vercel.app/api/analytics/customers/export', '_blank')}
                  className="w-full sm:w-auto bg-surface hover:bg-gray-700 border border-border text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  Export All Customers (CSV)
                </button>
                <button 
                  onClick={fetchGlobalStats}
                  disabled={loadingStats}
                  className="w-full sm:w-auto bg-primary hover:bg-primary-hover disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {loadingStats ? <RefreshCw className="w-5 h-5 animate-spin flex-shrink-0" /> : <Activity className="w-5 h-5 flex-shrink-0" />}
                  <span>{loadingStats ? 'Calculating Global Data...' : 'Calculate Global Stats'}</span>
                </button>
              </div>
            </div>

            {globalStats ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-surface rounded-2xl p-6 border border-border shadow-lg">
                    <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Total GMV Processed</p>
                    <h3 className="text-4xl font-black text-green-400">₹{globalStats.totalGMV.toLocaleString()}</h3>
                  </div>
                  <div className="bg-surface rounded-2xl p-6 border border-border shadow-lg">
                    <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Total Orders</p>
                    <h3 className="text-4xl font-black text-blue-400">{globalStats.totalOrders.toLocaleString()}</h3>
                  </div>
                  <div className="bg-surface rounded-2xl p-6 border border-border shadow-lg">
                    <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Avg Order Value</p>
                    <h3 className="text-4xl font-black text-amber-400">₹{Math.round(globalStats.aov).toLocaleString()}</h3>
                  </div>
                  <div className="bg-surface rounded-2xl p-6 border border-border shadow-lg">
                    <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Total End Customers</p>
                    <h3 className="text-4xl font-black text-purple-400">{globalStats.totalCustomers.toLocaleString()}</h3>
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-primary">
                    Most Ordered Items Globally
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={globalStats.topItems} layout="vertical" margin={{ top: 0, right: 0, left: 40, bottom: 0 }}>
                        <XAxis type="number" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} width={100} />
                        <Tooltip cursor={{fill: '#374151'}} contentStyle={{backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff'}} />
                        <Bar dataKey="quantity" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-2xl p-16 text-center shadow-xl">
                <Activity className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-400">No Analytics Loaded</h3>
                <p className="text-gray-500 mt-2">Click the Calculate button above to query all tenant databases.</p>
              </div>
            )}
          </div>
        )}

        {currentTab === 'Broadcasts' && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-surface p-6 rounded-2xl border border-border shadow-xl">
              <div className="w-full xl:w-auto">
                <h2 className="text-2xl font-black mb-2 flex items-center gap-2"><Radio className="text-primary w-6 h-6"/> Global Broadcast System</h2>
                <p className="text-gray-400 text-sm">Push announcements, greetings, and alerts instantly to every active POS client globally.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Composer */}
              <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl lg:col-span-1 h-fit">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-primary"/> New Broadcast</h3>
                <form onSubmit={handleCreateBroadcast} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1 font-medium">Title</label>
                    <input 
                      type="text" 
                      required
                      value={newBroadcast.title}
                      onChange={e => setNewBroadcast({...newBroadcast, title: e.target.value})}
                      placeholder="e.g. Happy Ugadi!"
                      className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1 font-medium">Message</label>
                    <textarea 
                      required
                      value={newBroadcast.message}
                      onChange={e => setNewBroadcast({...newBroadcast, message: e.target.value})}
                      placeholder="e.g. Wishing you and your family a prosperous Ugadi!"
                      className="w-full bg-background border border-border rounded-lg p-3 text-white h-24 resize-none focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1 font-medium">Upload Image (Optional)</label>
                    <div className="relative">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="broadcast-image-upload"
                      />
                      <label 
                        htmlFor="broadcast-image-upload"
                        className="w-full bg-background border border-border border-dashed rounded-lg p-4 text-gray-400 hover:text-white hover:border-primary transition-colors flex flex-col items-center justify-center cursor-pointer min-h-[100px]"
                      >
                        {newBroadcast.imageUrl ? (
                          <div className="relative w-full h-32 rounded bg-black/50 overflow-hidden flex items-center justify-center group">
                            <img src={newBroadcast.imageUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-white text-sm flex items-center gap-2"><Upload className="w-4 h-4"/> Change Image</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            <Image className="w-6 h-6 mb-2" />
                            <span className="text-sm">Click to upload image</span>
                            <span className="text-xs opacity-50 mt-1">JPG, PNG, GIF up to 5MB</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
                    <Radio className="w-5 h-5" />
                    Broadcast Now
                  </button>
                </form>
              </div>

              {/* Active Broadcasts List */}
              <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl lg:col-span-2">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-blue-400"/> Active & Past Broadcasts</h3>
                <div className="space-y-4">
                  {broadcasts.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-background rounded-xl border border-border border-dashed">
                      <Radio className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      No broadcasts found. Create one to notify your clients.
                    </div>
                  ) : (
                    broadcasts.map(b => (
                      <div key={b._id} className={`flex flex-col sm:flex-row gap-4 p-4 rounded-xl border transition-all ${b.active ? 'bg-primary/5 border-primary/30' : 'bg-background border-border opacity-60'}`}>
                        {b.imageUrl && (
                          <div className="w-full sm:w-32 h-24 rounded-lg bg-gray-800 overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                            <img 
                              src={b.imageUrl} 
                              alt={b.title} 
                              className="w-full h-full object-cover" 
                              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            />
                            <div className="hidden absolute inset-0 items-center justify-center text-red-400 flex-col gap-1">
                              <AlertTriangle className="w-6 h-6" />
                              <span className="text-[10px] uppercase font-bold tracking-wider">Broken Image</span>
                            </div>
                          </div>
                        )}
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-bold text-lg">{b.title}</h4>
                              <div className="flex items-center gap-2">
                                <button onClick={() => toggleBroadcast(b._id)} className={`text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1 transition-colors ${b.active ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                                  {b.active ? <CheckCircle className="w-3 h-3"/> : <XCircle className="w-3 h-3"/>}
                                  {b.active ? 'Active' : 'Inactive'}
                                </button>
                                <button onClick={() => deleteBroadcast(b._id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <p className="text-gray-400 text-sm">{b.message}</p>
                          </div>
                          <p className="text-xs text-gray-500 mt-2 font-mono">{new Date(b.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* License Edit Modal */}
      {licenseModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-2xl max-w-md w-full m-4">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Key className="text-primary w-5 h-5"/> Edit License</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">License Key</label>
                <input 
                  type="text" 
                  value={licenseModal.licenseKey}
                  onChange={(e) => setLicenseModal({...licenseModal, licenseKey: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Expiration Date</label>
                <input 
                  type="date" 
                  value={licenseModal.validUntil}
                  onChange={(e) => setLicenseModal({...licenseModal, validUntil: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex items-center gap-2 bg-background p-3 rounded-lg border border-border">
                <input 
                  type="checkbox" 
                  id="resetHardware"
                  checked={licenseModal.resetHardware}
                  onChange={(e) => setLicenseModal({...licenseModal, resetHardware: e.target.checked})}
                  className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                />
                <label htmlFor="resetHardware" className="text-sm font-medium">Clear Hardware Binding (Allows install on new PC)</label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setLicenseModal({ isOpen: false, clientId: null, licenseKey: '', validUntil: '', resetHardware: false })}
                className="px-4 py-2 bg-background border border-border rounded-lg hover:bg-gray-700 transition-colors text-sm font-bold"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveLicense}
                className="px-4 py-2 bg-primary hover:bg-primary-hover rounded-lg transition-colors text-white text-sm font-bold shadow-lg shadow-primary/20"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Client Modal */}
      {createClientModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface p-8 rounded-2xl w-full max-w-md border border-border shadow-2xl relative">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
              <Users className="text-primary" />
              Create New Client
            </h2>
            <form onSubmit={handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">Restaurant Name (Used for DB)</label>
                <input 
                  type="text" 
                  required
                  value={createClientModal.restaurantName}
                  onChange={e => setCreateClientModal({...createClientModal, restaurantName: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">Owner Name</label>
                <input 
                  type="text" 
                  required
                  value={createClientModal.ownerName}
                  onChange={e => setCreateClientModal({...createClientModal, ownerName: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">Email</label>
                <input 
                  type="email" 
                  required
                  value={createClientModal.email}
                  onChange={e => setCreateClientModal({...createClientModal, email: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">Password</label>
                <input 
                  type="text" 
                  required
                  value={createClientModal.password}
                  onChange={e => setCreateClientModal({...createClientModal, password: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">License Plan</label>
                <select 
                  value={createClientModal.plan}
                  onChange={e => setCreateClientModal({...createClientModal, plan: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-primary"
                >
                  <option value="Monthly">Monthly (Demo - 30 Days)</option>
                  <option value="Yearly">Yearly</option>
                  <option value="Lifetime">Lifetime</option>
                  <option value="Custom">Custom (Specify Days)</option>
                </select>
              </div>

              {createClientModal.plan === 'Custom' && (
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-1">Custom Days</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    placeholder="e.g. 15, 45, 90"
                    value={createClientModal.customDays}
                    onChange={e => setCreateClientModal({...createClientModal, customDays: e.target.value})}
                    className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              {/* Staff Accounts Dynamic Section */}
              <div className="border border-border p-4 rounded-xl bg-background mt-4">
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-bold text-gray-400">POS Staff Accounts (Optional)</label>
                  <button 
                    type="button" 
                    onClick={() => setCreateClientModal({
                      ...createClientModal, 
                      staffAccounts: [...(createClientModal.staffAccounts || []), { role: 'Cashier', username: '', plainTextPassword: '' }]
                    })}
                    className="text-xs bg-primary/20 text-primary px-2 py-1 rounded hover:bg-primary/30"
                  >
                    + Add Staff
                  </button>
                </div>
                {createClientModal.staffAccounts?.map((staff, index) => (
                  <div key={index} className="flex gap-2 mb-2 items-end border-b border-border/50 pb-2">
                    <div className="flex-1">
                      <select 
                        value={staff.role} 
                        onChange={(e) => {
                          const newStaff = [...createClientModal.staffAccounts];
                          newStaff[index].role = e.target.value;
                          setCreateClientModal({...createClientModal, staffAccounts: newStaff});
                        }}
                        className="w-full bg-surface border border-border rounded p-2 text-xs text-white"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Cashier">Cashier</option>
                        <option value="Captain">Captain</option>
                        <option value="Waiter">Waiter</option>
                        <option value="KDS">KDS</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <input 
                        type="text" placeholder="Username" required value={staff.username}
                        onChange={(e) => {
                          const newStaff = [...createClientModal.staffAccounts];
                          newStaff[index].username = e.target.value;
                          setCreateClientModal({...createClientModal, staffAccounts: newStaff});
                        }}
                        className="w-full bg-surface border border-border rounded p-2 text-xs text-white"
                      />
                    </div>
                    <div className="flex-1">
                      <input 
                        type="text" placeholder="Password" required value={staff.plainTextPassword}
                        onChange={(e) => {
                          const newStaff = [...createClientModal.staffAccounts];
                          newStaff[index].plainTextPassword = e.target.value;
                          setCreateClientModal({...createClientModal, staffAccounts: newStaff});
                        }}
                        className="w-full bg-surface border border-border rounded p-2 text-xs text-white"
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        const newStaff = createClientModal.staffAccounts.filter((_, i) => i !== index);
                        setCreateClientModal({...createClientModal, staffAccounts: newStaff});
                      }}
                      className="p-2 text-red-400 hover:bg-red-400/10 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {(!createClientModal.staffAccounts || createClientModal.staffAccounts.length === 0) && (
                  <p className="text-xs text-gray-500 italic">No additional staff accounts will be created automatically.</p>
                )}
              </div>
              
              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setCreateClientModal({ isOpen: false, restaurantName: '', ownerName: '', email: '', password: '', plan: 'Yearly', customDays: '', staffAccounts: [] })} 
                  className="flex-1 bg-background hover:bg-gray-800 text-white font-bold py-3 px-4 rounded-xl transition-all border border-border"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary/20"
                >
                  Generate & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Features Toggle Modal */}
      {featuresModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-2xl max-w-md w-full m-4">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Power className="text-primary w-5 h-5"/> Manage Features</h3>
            
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {[
                { key: 'inventory', label: 'Inventory Management' },
                { key: 'kds', label: 'Kitchen Display (KDS)' },
                { key: 'crm', label: 'Customer CRM' },
                { key: 'staff', label: 'Staff HR' },
                { key: 'analytics', label: 'Analytics' },
                { key: 'daybook', label: 'DayBook' },
                { key: 'qrcode', label: 'QR Menu Generator' },
                { key: 'delivery', label: 'Delivery Orders' },
                { key: 'expenses', label: 'Petty Cash & Expenses' }
              ].map(feature => (
                <div key={feature.key} className="flex items-center justify-between bg-background p-3 rounded-lg border border-border">
                  <span className="text-sm font-bold text-gray-300">{feature.label}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={featuresModal.features[feature.key]}
                      onChange={(e) => setFeaturesModal({
                        ...featuresModal, 
                        features: { ...featuresModal.features, [feature.key]: e.target.checked }
                      })}
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setFeaturesModal({ isOpen: false, clientId: null, features: {} })}
                className="px-4 py-2 bg-background border border-border rounded-lg hover:bg-gray-700 transition-colors text-sm font-bold"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveFeatures}
                className="px-4 py-2 bg-primary hover:bg-primary-hover rounded-lg transition-colors text-white text-sm font-bold shadow-lg shadow-primary/20"
              >
                Save Features
              </button>
            </div>
          </div>
        </div>
      )}
      {/* View Staff Modal */}
      {viewStaffModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-2xl max-w-md w-full m-4">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Users className="text-primary w-5 h-5"/> Staff Accounts</h3>
            <p className="text-sm text-gray-400 mb-4">Accounts for {viewStaffModal.restaurantName}</p>
            
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {viewStaffModal.staffAccounts.length === 0 ? (
                <p className="text-gray-500 italic text-center py-4">No pre-configured staff accounts found.</p>
              ) : (
                viewStaffModal.staffAccounts.map((staff, idx) => (
                  <div key={idx} className="bg-background border border-border p-3 rounded-lg flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-white">{staff.username}</span>
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded uppercase tracking-wider">{staff.role}</span>
                    </div>
                    <div className="text-xs font-mono text-gray-400 flex items-center gap-2">
                      Password: <span className="text-white">{staff.plainTextPassword}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setViewStaffModal({ isOpen: false, staffAccounts: [], restaurantName: '' })}
                className="px-4 py-2 bg-primary hover:bg-primary-hover rounded-lg transition-colors text-white text-sm font-bold shadow-lg shadow-primary/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
