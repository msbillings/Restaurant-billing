import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Clock, CheckCircle } from 'lucide-react';
import { getStaff, addStaff, updateStaff, deleteStaff } from '../api/staff';
import Toast from './Toast';

const StaffManagement = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    role: 'Waiter',
    phone: '',
    pin: '',
    baseSalary: '',
    salaryType: 'Monthly'
  });

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const data = await getStaff();
      setStaff(data);
    } catch (err) {
      setToast({ message: 'Failed to load staff', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingStaff) {
        await updateStaff(editingStaff._id, formData);
        setToast({ message: 'Staff updated', type: 'success' });
      } else {
        await addStaff(formData);
        setToast({ message: 'Staff added', type: 'success' });
      }
      setIsModalOpen(false);
      fetchStaff();
    } catch (err) {
      setToast({ message: 'Failed to save staff', type: 'error' });
    }
  };

  const openAddModal = () => {
    setEditingStaff(null);
    setFormData({ name: '', role: 'Waiter', phone: '', pin: '', baseSalary: '', salaryType: 'Monthly' });
    setIsModalOpen(true);
  };

  const openEditModal = (s) => {
    setEditingStaff(s);
    setFormData({ 
      name: s.name, 
      role: s.role, 
      phone: s.phone || '', 
      pin: s.pin, 
      baseSalary: s.baseSalary || '', 
      salaryType: s.salaryType 
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this staff member?')) return;
    try {
      await deleteStaff(id);
      setToast({ message: 'Staff deleted', type: 'success' });
      fetchStaff();
    } catch (err) {
      setToast({ message: 'Failed to delete staff', type: 'error' });
    }
  };

  return (
    <div className="h-full flex flex-col bg-background p-4 sm:p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <h1 className="text-2xl font-black text-text-main flex items-center gap-2">
          <Users className="text-primary" /> STAFF MANAGEMENT
        </h1>
        <button 
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold hover:opacity-90 transition-opacity"
        >
          <Plus size={18} /> Add Staff
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-surface border border-border rounded-xl shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-background sticky top-0 z-10">
            <tr>
              <th className="p-4 font-bold text-text-muted border-b border-border">Name</th>
              <th className="p-4 font-bold text-text-muted border-b border-border">Role</th>
              <th className="p-4 font-bold text-text-muted border-b border-border">PIN</th>
              <th className="p-4 font-bold text-text-muted border-b border-border">Today's Status</th>
              <th className="p-4 font-bold text-text-muted border-b border-border text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="p-4 text-center">Loading...</td></tr>
            ) : staff.map(s => {
              const today = new Date().setHours(0,0,0,0);
              const todayAttendance = s.attendance?.find(a => new Date(a.date).getTime() === today);
              
              return (
                <tr key={s._id} className="border-b border-border hover:bg-surface-hover">
                  <td className="p-4 font-medium text-text-main">{s.name}</td>
                  <td className="p-4 text-text-muted">{s.role}</td>
                  <td className="p-4 font-mono tracking-widest text-primary">{s.pin}</td>
                  <td className="p-4">
                    {todayAttendance ? (
                      todayAttendance.clockOut ? (
                        <span className="text-xs bg-gray-500/10 text-gray-500 px-2 py-1 rounded-md">Clocked Out</span>
                      ) : (
                        <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-md">Clocked In</span>
                      )
                    ) : (
                      <span className="text-xs bg-danger/10 text-danger px-2 py-1 rounded-md">Not Clocked In</span>
                    )}
                  </td>
                  <td className="p-4 text-center flex justify-center gap-2">
                    <button onClick={() => openEditModal(s)} className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(s._id)} className="p-2 text-danger hover:bg-danger/10 rounded-lg"><Trash2 size={16} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-surface p-6 rounded-2xl w-full max-w-md border border-border">
            <h2 className="text-xl font-bold mb-4">{editingStaff ? 'Edit Staff' : 'Add Staff'}</h2>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-background border border-border rounded-xl p-2 text-text-main" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Role</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-background border border-border rounded-xl p-2 text-text-main">
                    <option>Waiter</option>
                    <option>Chef</option>
                    <option>Manager</option>
                    <option>Cleaner</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">PIN (4 digits)</label>
                  <input required type="text" maxLength="4" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} className="w-full bg-background border border-border rounded-xl p-2 text-text-main font-mono" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-border rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-xl font-bold">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default StaffManagement;
