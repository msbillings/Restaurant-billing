import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, Printer, Save, CheckCircle, Network, Usb, Bluetooth, ReceiptText, ChefHat, Plus, Trash2, Edit, X } from 'lucide-react';
import BackButton from './common/BackButton';

const PrinterConfig = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'kot',
    assignTo: '',
    ipAddress: '',
    port: 9100,
    connectionType: 'network',
    paperWidth: '80mm',
    isActive: true,
    autoPrintKOT: true,
    printHeader: '',
    printFooter: ''
  });

  const fetchConfigs = async () => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await axios.get(`${getApiUrl()}/printer-configs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfigs(response.data);
    } catch (error) {
      console.error('Error fetching printer configs', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const openAddModal = () => {
    setFormData({
      name: '',
      type: 'kot',
      assignTo: '',
      ipAddress: '',
      port: 9100,
      connectionType: 'network',
      paperWidth: '80mm',
      isActive: true,
      autoPrintKOT: true,
      printHeader: '',
      printFooter: ''
    });
    setEditingConfig(null);
    setIsModalOpen(true);
  };

  const openEditModal = (config) => {
    setFormData({ ...config });
    setEditingConfig(config);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingConfig(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (editingConfig) {
        await axios.put(`${getApiUrl()}/printer-configs/${editingConfig._id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${getApiUrl()}/printer-configs`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      closeModal();
      fetchConfigs();
    } catch (error) {
      console.error('Error saving config', error);
      alert('Failed to save printer configuration');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this printer?')) {
      try {
        const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
        await axios.delete(`${getApiUrl()}/printer-configs/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchConfigs();
      } catch (error) {
        console.error('Error deleting printer', error);
        alert('Failed to delete printer');
      }
    }
  };

  const handleTestPrint = async (id) => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      await axios.post(`${getApiUrl()}/printer-configs/${id}/test`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Test print sent successfully!');
    } catch (error) {
      console.error('Error testing printer', error);
      alert('Failed to connect to printer');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-3 sm:p-6 overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div className="flex items-center gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-base sm:text-xl font-bold text-gray-800">{t("Printer Configuration")}</h1>
            <p className="text-xs text-gray-500">{t("Manage ESC/POS thermal printers for Bills and Kitchen Orders")}</p>
          </div>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 bg-[#d83c31] hover:bg-[#c22e23] text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors shadow-sm self-end sm:self-auto">
          
          <Plus size={16} />{t("Add Printer")}

        </button>
      </div>

      {loading ?
      <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div> :

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="px-6 py-4 text-sm font-semibold text-gray-700">{t("Printer Name")}</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-700">{t("Printer Type")}</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-700">{t("Connection")}</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-700 text-center">{t("Action")}</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-700 text-center">{t("Printer Assign")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {configs.length === 0 ?
              <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-gray-500">{t("No printers configured yet. Click \"Add Printer\" to get started.")}

                </td>
                  </tr> :

              configs.map((config) =>
              <tr key={config._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${config.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          <span className="font-medium text-gray-800">{config.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 capitalize">
                        {config.type === 'receipt' ? 'Receipt Printer' : config.type === 'kot' ? 'KOT Printer' : 'General'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-700 uppercase">{config.connectionType}</span>
                          {config.connectionType === 'network' &&
                    <span className="text-xs text-gray-500">{config.ipAddress}:{config.port}</span>
                    }
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-3">
                          <button onClick={() => handleTestPrint(config._id)} className="text-gray-500 hover:text-blue-600 transition-colors" title={t("Test Print")}>
                            <Printer size={18} />
                          </button>
                          <button onClick={() => openEditModal(config)} className="text-gray-500 hover:text-orange-500 transition-colors" title={t("Edit")}>
                            <Edit size={18} />
                          </button>
                          <button onClick={() => handleDelete(config._id)} className="text-gray-500 hover:text-red-600 transition-colors" title={t("Delete")}>
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {config.type === 'kot' ?
                  <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-md border border-gray-200">
                            {config.assignTo || 'Unassigned'}
                          </span> :

                  <span className="text-gray-400 text-sm">-</span>
                  }
                      </td>
                    </tr>
              )
              }
              </tbody>
            </table>
          </div>
        </div>
      }

      {/* Add / Edit Modal */}
      {isModalOpen &&
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-800">{editingConfig ? 'Edit Printer' : 'Add New Printer'}</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-800 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="printer-form" onSubmit={handleSave} className="space-y-6">
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("Printer Name *")}</label>
                    <input
                    type="text"
                    name="name"
                    required placeholder={t("e.g. Kitchen 1, Main Biller")}

                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("Printer Type *")}</label>
                    <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                    
                      <option value="receipt">{t("Receipt (Bill)")}</option>
                      <option value="kot">{t("KOT (Kitchen Order)")}</option>
                      <option value="general">{t("General Report")}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("Connection Type")}</label>
                    <select
                    name="connectionType"
                    value={formData.connectionType}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                    
                      <option value="network">{t("LAN / WiFi (Network)")}</option>
                      <option value="usb">{t("USB")}</option>
                      <option value="bluetooth">{t("Bluetooth")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("Paper Width")}</label>
                    <select
                    name="paperWidth"
                    value={formData.paperWidth}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                    
                      <option value="80mm">{t("80mm (Standard)")}</option>
                      <option value="58mm">{t("58mm (Small)")}</option>
                    </select>
                  </div>
                </div>

                {formData.connectionType === 'network' &&
              <div className="grid grid-cols-3 gap-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("IP Address")}</label>
                      <input
                    type="text"
                    name="ipAddress" placeholder={t("e.g. 192.168.1.100")}

                    value={formData.ipAddress}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("Port")}</label>
                      <input
                    type="number"
                    name="port"
                    value={formData.port}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  
                    </div>
                  </div>
              }

                {formData.type === 'kot' &&
              <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("Assign To Department")}</label>
                    <input
                  type="text"
                  name="assignTo" placeholder={t("e.g. Hot Kitchen, Beverages, Bar")}

                  value={formData.assignTo}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                
                    <p className="text-xs text-gray-500 mt-1">{t("Specify which items this printer should print based on their category/department.")}</p>
                  </div>
              }

                {formData.type === 'receipt' &&
              <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("Bill Header Text")}</label>
                      <textarea
                    name="printHeader"
                    rows="2" placeholder={t("e.g. Welcome to MS Billings Cafe!")}

                    value={formData.printHeader}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" />
                  
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("Bill Footer Text")}</label>
                      <textarea
                    name="printFooter"
                    rows="2" placeholder={t("e.g. Thank you! Visit Again.")}

                    value={formData.printFooter}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" />
                  
                    </div>
                  </div>
              }

                <div className="flex items-center gap-2">
                  <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary" />
                
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700 cursor-pointer">{t("Printer is Active")}

                </label>
                </div>

              </form>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 mt-auto">
              <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 font-medium transition-colors">{t("Cancel")}


            </button>
              <button
              type="submit"
              form="printer-form"
              className="px-6 py-2 text-white bg-primary hover:bg-primary-hover rounded-md font-medium transition-colors shadow-sm">
              
                {editingConfig ? 'Save Changes' : 'Add Printer'}
              </button>
            </div>
          </div>
        </div>
      }

    </div>);

};

export default PrinterConfig;