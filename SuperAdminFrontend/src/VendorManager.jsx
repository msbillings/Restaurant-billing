import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getApiBaseUrl } from './config';
import { Shield, Plus, Trash2, Loader2, Edit3, Key, Eye, EyeOff } from 'lucide-react';

const API_BASE_URL = getApiBaseUrl();

export default function VendorManager() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    vendorCompanyName: '',
    email: '',
    password: ''
  });

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const token = localStorage.getItem('superadmin_token');
      const res = await axios.get(`${API_BASE_URL}/vendors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVendors(res.data);
    } catch (error) {
      console.error('Failed to fetch vendors', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const openEditModal = (vendor) => {
    setIsEdit(true);
    setEditId(vendor._id);
    setFormData({
      name: vendor.name || '',
      vendorCompanyName: vendor.vendorCompanyName || '',
      email: vendor.email || '',
      password: vendor.plainTextPassword || ''
    });
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setIsEdit(false);
    setEditId(null);
    setFormData({ name: '', vendorCompanyName: '', email: '', password: '' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('superadmin_token');
      if (isEdit) {
        await axios.put(`${API_BASE_URL}/vendors/${editId}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Vendor Partner updated successfully!');
      } else {
        await axios.post(`${API_BASE_URL}/vendors`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Vendor Partner created successfully!');
      }
      setIsModalOpen(false);
      setFormData({ name: '', vendorCompanyName: '', email: '', password: '' });
      fetchVendors();
    } catch (error) {
      console.error('Error saving vendor', error);
      alert(error.response?.data?.message || error.message || 'Failed to save vendor.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this vendor account? They will lose access.')) return;
    try {
      const token = localStorage.getItem('superadmin_token');
      await axios.delete(`${API_BASE_URL}/vendors/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchVendors();
    } catch (error) {
      console.error('Error deleting vendor', error);
      alert('Failed to delete vendor.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-surface p-6 rounded-2xl border border-border shadow-xl">
        <div className="w-full xl:w-auto">
          <h2 className="text-2xl font-black mb-2 flex items-center gap-2 text-fuchsia-400">
            <Shield className="w-6 h-6" /> Vendor Partner Management
          </h2>
          <p className="text-gray-400 text-sm">Provision dedicated portals for hardware suppliers and third-party dropshippers.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="w-full xl:w-auto bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <Plus className="w-5 h-5" /> Add New Vendor
        </button>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-10 h-10 text-fuchsia-500 animate-spin" />
          </div>
        ) : vendors.length === 0 ? (
          <div className="text-center p-12">
            <h3 className="text-xl font-bold text-white mb-2">No Vendors Provisioned</h3>
            <p className="text-gray-400 max-w-sm mx-auto">Create a vendor account to let them log in and manage their Market Hub inventory.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="bg-background text-xs uppercase text-gray-500 font-bold border-b border-border">
                <tr>
                  <th className="px-6 py-4">Company Name</th>
                  <th className="px-6 py-4">Admin Name</th>
                  <th className="px-6 py-4">Email / Login</th>
                  <th className="px-6 py-4">Password</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {vendors.map(vendor => (
                  <tr key={vendor._id} className="hover:bg-background/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white text-base">{vendor.vendorCompanyName}</div>
                    </td>
                    <td className="px-6 py-4 text-white font-medium">{vendor.name}</td>
                    <td className="px-6 py-4 font-mono text-gray-300">{vendor.email}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 font-mono text-gray-400 bg-gray-800/50 px-2 py-1 rounded w-max text-xs border border-gray-700">
                          <Key className="w-3 h-3 text-fuchsia-400" />
                          {visiblePasswords[vendor._id] ? (vendor.plainTextPassword || 'N/A') : '••••••••'}
                        </div>
                        <button 
                          onClick={() => togglePasswordVisibility(vendor._id)}
                          className="text-gray-500 hover:text-white transition"
                        >
                          {visiblePasswords[vendor._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs">{new Date(vendor.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => openEditModal(vendor)}
                          className="p-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition"
                          title="Edit Vendor"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(vendor._id)}
                          className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition"
                          title="Delete Vendor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-white mb-6">
              {isEdit ? 'Edit Vendor Account' : 'Provision Vendor Account'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Vendor Company Name</label>
                <input 
                  type="text" 
                  required
                  value={formData.vendorCompanyName}
                  onChange={e => setFormData({...formData, vendorCompanyName: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl p-3 text-white focus:outline-none focus:border-fuchsia-500"
                  placeholder="e.g. Passiflow Printers Ltd"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Contact Person Name</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl p-3 text-white focus:outline-none focus:border-fuchsia-500"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Login Email</label>
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl p-3 text-white focus:outline-none focus:border-fuchsia-500"
                  placeholder="vendor@company.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">
                  {isEdit ? 'Change Password (leave blank to keep current)' : 'Temporary Password'}
                </label>
                <input 
                  type="text" 
                  required={!isEdit}
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl p-3 text-white font-mono focus:outline-none focus:border-fuchsia-500"
                  placeholder="e.g. Vendor@123"
                />
              </div>
              <div className="flex gap-3 pt-4 mt-6 border-t border-border">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-background hover:bg-gray-800 text-white font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-xl shadow-lg shadow-fuchsia-500/20 transition"
                >
                  {isEdit ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
