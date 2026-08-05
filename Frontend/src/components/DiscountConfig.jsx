import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit2, Tags, ArrowLeft } from 'lucide-react';
import BackButton from './common/BackButton';

const DiscountConfig = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'percentage',
    value: '',
    isActive: true
  });

  const fetchDiscounts = async () => {
    try {
      const response = await axios.get(`${getApiUrl()}/discounts`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setDiscounts(response.data);
    } catch (error) {
      console.error('Error fetching discounts', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDiscount) {
        await axios.put(`${getApiUrl()}/discounts/${editingDiscount._id}`, formData, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      } else {
        await axios.post(`${getApiUrl()}/discounts`, formData, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      }
      setIsModalOpen(false);
      setEditingDiscount(null);
      setFormData({ name: '', type: 'percentage', value: '', isActive: true });
      fetchDiscounts();
    } catch (error) {
      console.error('Error saving discount', error);
      alert('Error saving discount');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this discount?')) {
      try {
        await axios.delete(`${getApiUrl()}/discounts/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        fetchDiscounts();
      } catch (error) {
        console.error('Error deleting discount', error);
        alert('Error deleting discount');
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-y-auto">
      <div className="flex items-center gap-4 mb-2">
        <BackButton onClick={onGoBack} />
      </div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t("Discount Configuration")}</h1>
            <p className="text-sm text-gray-500">{t("Manage promo codes and discounts")}</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingDiscount(null);
            setFormData({ name: '', type: 'percentage', value: '', isActive: true });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-sm">
          
          <Plus size={20} />{t("Add Discount")}
        </button>
      </div>

      {loading ?
      <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div> :

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">{t("Discount Name")}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">{t("Type")}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">{t("Value")}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">{t("Status")}</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {discounts.length === 0 ?
            <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">{t("No discounts configured yet.")}</td>
                </tr> :

            discounts.map((discount) =>
            <tr key={discount._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-800 flex items-center gap-2">
                      <Tags size={16} className="text-primary" /> {discount.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-medium uppercase tracking-wider">
                        {discount.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-semibold">
                      {discount.type === 'percentage' ? `${discount.value}%` : `₹${discount.value}`}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium uppercase tracking-wider ${discount.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {discount.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                    onClick={() => {
                      setEditingDiscount(discount);
                      setFormData({ name: discount.name, type: discount.type, value: discount.value, isActive: discount.isActive });
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    
                          <Edit2 size={18} />
                        </button>
                        <button
                    onClick={() => handleDelete(discount._id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
            )
            }
            </tbody>
          </table>
        </div>
      }

      {/* Modal */}
      {isModalOpen &&
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">{editingDiscount ? 'Edit Discount' : 'Add New Discount'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("Discount Name (e.g. SUMMER20 or Staff 10%)")}</label>
                <input
                type="text" required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder={t("Staff Discount")} />

              
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("Type")}</label>
                  <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none bg-white">
                  
                    <option value="percentage">{t("Percentage (%)")}</option>
                    <option value="flat">{t("Flat Amount (₹)")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("Value")}</label>
                  <input
                  type="number" required min="0" step={formData.type === 'percentage' ? '0.1' : '1'}
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  placeholder="10" />
                
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                type="checkbox" id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-5 h-5 text-primary rounded focus:ring-primary" />
              
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700 cursor-pointer">{t("Discount is currently active")}</label>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">{t("Cancel")}</button>
                <button type="submit" className="flex-1 py-3 text-white bg-primary hover:bg-primary-hover rounded-xl font-medium shadow-lg shadow-primary/30 transition-all">{t("Save Discount")}</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>);

};

export default DiscountConfig;