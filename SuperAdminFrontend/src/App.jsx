import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Shield, Key, Users, RefreshCw, AlertTriangle, Search, Activity, Power, Edit3, TrendingUp, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

function App() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [licenseModal, setLicenseModal] = useState({ isOpen: false, clientId: null, licenseKey: '', validUntil: '', resetHardware: false });
  const [createClientModal, setCreateClientModal] = useState({ isOpen: false, restaurantName: '', ownerName: '', email: '', password: '', plan: 'Yearly' });
  const [featuresModal, setFeaturesModal] = useState({ isOpen: false, clientId: null, features: {} });

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

  useEffect(() => {
    fetchClients();
  }, []);

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

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      await axios.post('https://restaurant-superadmin-api-maheer.vercel.app/api/clients', createClientModal);
      alert('Client and License generated successfully!');
      setCreateClientModal({ isOpen: false, restaurantName: '', ownerName: '', email: '', password: '', plan: 'Yearly' });
      fetchClients();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create client');
    }
  };

  const filteredClients = clients.filter(c => 
    c.restaurantName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- ANALYTICS CALCULATIONS ---
  const { totalRevenue, expiringSoon, planData, monthlyData } = useMemo(() => {
    let rev = 0;
    const expiring = [];
    const planCounts = { Monthly: 0, Yearly: 0, Lifetime: 0, Custom: 0 };
    const months = {};

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const today = new Date();

    clients.forEach(c => {
      // Revenue (Estimated placeholders: Monthly=500, Yearly=5000, Lifetime=20000)
      if (c.plan === 'Monthly') rev += 500;
      else if (c.plan === 'Yearly') rev += 5000;
      else if (c.plan === 'Lifetime') rev += 20000;
      
      // Plan counts
      if (planCounts[c.plan] !== undefined) planCounts[c.plan]++;
      else planCounts['Custom']++;

      // Expiry alerts (expiring in less than 30 days and not already expired long ago)
      if (c.validUntil) {
        const expiry = new Date(c.validUntil);
        if (expiry > today && expiry <= thirtyDaysFromNow) {
          expiring.push(c);
        } else if (expiry <= today) {
          // You might also want to flag already expired ones
          expiring.push(c);
        }
      }

      // Monthly Signups (based on createdAt)
      const dateString = c.licenseCreatedAt || c.createdAt;
      if (dateString) {
        const date = new Date(dateString);
        const monthYear = date.toLocaleString('default', { month: 'short', year: '2-digit' });
        months[monthYear] = (months[monthYear] || 0) + 1;
      }
    });

    const pData = [
      { name: 'Monthly', value: planCounts.Monthly, color: '#3b82f6' },
      { name: 'Yearly', value: planCounts.Yearly, color: '#10b981' },
      { name: 'Lifetime', value: planCounts.Lifetime, color: '#f59e0b' },
      { name: 'Custom', value: planCounts.Custom, color: '#8b5cf6' }
    ].filter(d => d.value > 0);

    const mData = Object.keys(months).map(k => ({ name: k, signups: months[k] })).reverse();

    return { totalRevenue: rev, expiringSoon: expiring, planData: pData, monthlyData: mData };
  }, [clients]);

  return (
    <div className="min-h-screen bg-background text-white font-sans selection:bg-primary/30">
      
      {/* Top Navbar */}
      <nav className="bg-surface border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30 shadow-[0_0_15px_rgba(255,92,53,0.3)]">
                <Shield className="text-primary w-5 h-5" />
              </div>
              <span className="font-black text-xl tracking-tight">MS<span className="text-primary">BILLING</span> <span className="font-medium text-gray-400">SUPER ADMIN</span></span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-full border border-border">
                <Activity className="w-4 h-4 text-green-500 animate-pulse" />
                <span className="text-sm font-medium text-gray-300">System Online</span>
              </div>
              <button onClick={fetchClients} className="p-2 bg-surface hover:bg-gray-700 rounded-lg border border-border transition-colors">
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-primary' : 'text-gray-300'}`} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
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
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl lg:col-span-1">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><TrendingUp className="text-primary w-5 h-5"/> New Signups</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: '#374151'}} contentStyle={{backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff'}} />
                  <Bar dataKey="signups" fill="#ff5c35" radius={[4, 4, 0, 0]} />
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

        {/* Search Bar */}
        <div className="bg-surface p-4 rounded-t-2xl border border-border border-b-0 flex justify-between items-center">
          <h2 className="text-lg font-bold">Client Management Database</h2>
          <div className="relative w-72">
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
                      <span className="font-mono bg-background px-2 py-1 rounded text-primary text-xs font-bold border border-primary/20">
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
                      <div className="flex gap-2 justify-end">
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
                </select>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setCreateClientModal({ isOpen: false, restaurantName: '', ownerName: '', email: '', password: '', plan: 'Yearly' })} 
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
    </div>
  );
}

export default App;
