import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, Users, Shield, Plus, Edit2, Trash2, Key, Eye, EyeOff } from 'lucide-react';

const AdminDashboard = ({ onNavigate }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ username: '', password: '', role: 'Cashier' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:5002/api/admin/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users', error);
      alert('Failed to fetch users. You might not have Admin privileges.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // If editing, only send password if it was changed
        const updateData = { username: formData.username, role: formData.role };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await axios.put(`http://localhost:5002/api/admin/users/${editingUser._id}`, updateData, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      } else {
        await axios.post('http://localhost:5002/api/admin/users', formData, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error saving user', error);
      alert(error.response?.data?.message || 'Error saving user');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await axios.delete(`http://localhost:5002/api/admin/users/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting user');
    }
  };

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({ username: '', password: '', role: 'Cashier' });
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({ username: user.username, password: '', role: user.role });
    setShowPassword(false);
    setIsModalOpen(true);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('operations')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Shield className="text-primary" /> Admin Control Panel
            </h1>
            <p className="text-sm text-gray-500">Manage login access (Cashiers, Captains, Admins)</p>
          </div>
        </div>
        <button 
          onClick={openAddModal}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm"
        >
          <Plus size={18} />
          Create User Login
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500">
                <th className="p-4 font-bold">Username</th>
                <th className="p-4 font-bold">Role</th>
                <th className="p-4 font-bold">Created At</th>
                <th className="p-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(user => (
                <tr key={user._id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-gray-800">{user.username}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      user.role === 'Admin' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                      user.role === 'Captain' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                      'bg-green-100 text-green-700 border border-green-200'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEditModal(user)} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(user._id)} className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                {editingUser ? <Edit2 className="text-blue-500" /> : <Plus className="text-green-500" />}
                {editingUser ? 'Edit User' : 'Create New User'}
              </h2>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Username</label>
                <input 
                  type="text" 
                  value={formData.username} 
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-primary"
                  required 
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1 flex justify-between">
                  <span>Password</span>
                  {editingUser && <span className="text-xs text-gray-400 font-normal">(Leave blank to keep current)</span>}
                </label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={formData.password} 
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-primary pr-10"
                    required={!editingUser} 
                    minLength="4"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Role</label>
                <select 
                  value={formData.role} 
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="Cashier">Cashier (Can bill & print)</option>
                  <option value="Captain">Captain (Can take orders via tablet)</option>
                  <option value="Admin">Admin (Full Control)</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl transition-colors shadow-md"
                >
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
