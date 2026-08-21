import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit2, Percent, ArrowLeft } from 'lucide-react';
import BackButton from './common/BackButton';

const TaxConfig = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    percentage: '',
    type: 'exclusive',
    isActive: true
  });

  const fetchTaxes = async () => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await axios.get(`${getApiUrl()}/taxes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTaxes(response.data);
    } catch (error) {
      console.error('Error fetching taxes', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaxes();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (editingTax) {
        await axios.put(`${getApiUrl()}/taxes/${editingTax._id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${getApiUrl()}/taxes`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setIsModalOpen(false);
      setEditingTax(null);
      setFormData({ name: '', percentage: '', type: 'exclusive', isActive: true });
      fetchTaxes();
    } catch (error) {
      console.error('Error saving tax', error);
      alert('Error saving tax');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this tax?')) {
      try {
        const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
        await axios.delete(`${getApiUrl()}/taxes/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchTaxes();
      } catch (error) {
        console.error('Error deleting tax', error);
        alert('Error deleting tax');
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-3 sm:p-6 overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-base sm:text-xl font-bold text-gray-800">{t("Tax Configuration")}</h1>
            <p className="text-xs text-gray-500">{t("Manage taxes applied to your bills")}</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingTax(null);
            setFormData({ name: '', percentage: '', type: 'exclusive', isActive: true });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-3 py-2 rounded-lg transition-colors text-xs sm:text-sm font-bold shadow-sm self-end sm:self-auto">
          
          <Plus size={16} />{t("Add Tax")}
        </button>
      </div>

      {loading ?
      <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div> :

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">{t("Tax Name")}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">{t("Percentage")}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">{t("Type")}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">{t("Status")}</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {taxes.length === 0 ?
            <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">{t("No taxes configured yet.")}</td>
                </tr> :

            taxes.map((tax) =>
            <tr key={tax._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-800 flex items-center gap-2">
                      <Percent size={16} className="text-primary" /> {tax.name}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{tax.percentage}%</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-medium uppercase tracking-wider">
                        {tax.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium uppercase tracking-wider ${tax.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {tax.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                    onClick={() => {
                      setEditingTax(tax);
                      setFormData({ name: tax.name, percentage: tax.percentage, type: tax.type, isActive: tax.isActive });
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    
                          <Edit2 size={18} />
                        </button>
                        <button
                    onClick={() => handleDelete(tax._id)}
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
              <h2 className="text-xl font-bold text-gray-800">{editingTax ? 'Edit Tax' : 'Add New Tax'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("Tax Name (e.g. CGST @ 2.5%)")}</label>
                <input
                type="text" required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder={t("CGST @ 2.5%")} />

              
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("Percentage (%)")}</label>
                  <input
                  type="number" required min="0" step="0.01"
                  value={formData.percentage}
                  onChange={(e) => setFormData({ ...formData, percentage: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  placeholder="2.5" />
                
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("Type")}</label>
                  <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none bg-white">
                  
                    <option value="exclusive">{t("Exclusive")}</option>
                    <option value="inclusive">{t("Inclusive")}</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                type="checkbox" id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-5 h-5 text-primary rounded focus:ring-primary" />
              
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700 cursor-pointer">{t("Tax is currently active")}</label>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">{t("Cancel")}</button>
                <button type="submit" className="flex-1 py-3 text-white bg-primary hover:bg-primary-hover rounded-xl font-medium shadow-lg shadow-primary/30 transition-all">{t("Save Tax")}</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>);

};

export default TaxConfig;