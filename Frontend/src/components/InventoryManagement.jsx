import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import { getCachedInventory, cacheInventory } from '../db/offlineDb';
import {
  Package, Plus, Search, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Trash2, Edit3, CheckCircle, RefreshCw, Layers, DollarSign, Clock,
  Filter, Utensils, ShieldAlert, FileText, ChevronRight, Brain, TrendingUp } from
'lucide-react';
import Toast from './Toast';
import BackButton from './common/BackButton';

const API_BASE_URL = getApiUrl();

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
  'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
});

const InventoryManagement = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'recipes' | 'logs' | 'predictions'
  const [items, setItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [predictions, setPredictions] = useState(null);
  const [predictionsLoading, setPredictionsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    // 1. Instant Cache Load (0ms delay) on mount
    getCachedInventory().then((cached) => {
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setItems(cached);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    fetchInventoryData(true);
  }, []);

  const fetchInventoryData = async (isBackground = false) => {
    if (!isBackground && items.length === 0) {
      setLoading(true);
    }
    try {
      const [itemsRes, recipesRes, menuRes, logsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/inventory`, { headers: getHeaders() }),
      fetch(`${API_BASE_URL}/inventory/recipes`, { headers: getHeaders() }),
      fetch(`${API_BASE_URL}/menu`, { headers: getHeaders() }),
      fetch(`${API_BASE_URL}/inventory/logs`, { headers: getHeaders() })]
      );

      if (itemsRes.ok) {
        const fetchedItems = await itemsRes.json();
        setItems(fetchedItems);
        cacheInventory(fetchedItems).catch(() => {});
      }
      if (recipesRes.ok) setRecipes(await recipesRes.json());
      if (menuRes.ok) setMenuItems(await menuRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch (err) {
      console.error('Error fetching inventory data:', err);
      setToast({ message: 'Failed to load inventory data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [restockItem, setRestockItem] = useState(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockCost, setRestockCost] = useState('');
  const [restockNotes, setRestockNotes] = useState('');

  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawItem, setWithdrawItem] = useState(null);
  const [withdrawQty, setWithdrawQty] = useState('');
  const [withdrawStaffName, setWithdrawStaffName] = useState('');
  const [withdrawDesignation, setWithdrawDesignation] = useState('Head Chef');
  const [withdrawNotes, setWithdrawNotes] = useState('');

  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);

  // Form State for Add/Edit Stock Item
  const [formData, setFormData] = useState({
    name: '',
    category: 'Other',
    unit: 'kg',
    currentStock: '',
    minStockAlert: '5',
    unitCost: ''
  });
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  // Recipe Mapping State
  const [selectedMenuId, setSelectedMenuId] = useState('');
  const [recipeIngredients, setRecipeIngredients] = useState([]);

  const defaultCategories = [
  'All', 'Meat & Poultry', 'Grains & Pulses', 'Dairy & Beverages',
  'Spices & Condiments', 'Vegetables & Fruits', 'Packaging & Supplies', 'Other'];
  
  const categories = [...new Set([...defaultCategories, ...items.map(i => i.category).filter(Boolean)])];


  const units = ['kg', 'g', 'L', 'ml', 'pcs', 'packs'];

  const fetchPredictions = async () => {
    setPredictionsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/predictions`, { headers: getHeaders() });
      if (res.ok) setPredictions(await res.json());
    } catch (err) {
      console.error('Error fetching predictions:', err);
    } finally {
      setPredictionsLoading(false);
    }
  };

  // Handle Add/Edit Submit
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!formData.name) return;

    try {
      const url = editingItem ?
      `${API_BASE_URL}/inventory/${editingItem._id}` :
      `${API_BASE_URL}/inventory`;

      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setToast({ message: `Item ${editingItem ? 'updated' : 'added'} successfully!`, type: 'success' });
        setIsAddModalOpen(false);
        setEditingItem(null);
        resetForm();
        fetchInventoryData();
      } else {
        const err = await res.json();
        setToast({ message: err.message || 'Error saving item', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Network error occurred', type: 'error' });
    }
  };

  const handleDeleteItem = (item) => {
    setDeleteConfirmItem(item);
  };

  const confirmDeleteItem = async () => {
    if (!deleteConfirmItem) return;
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/${deleteConfirmItem._id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        setToast({ message: 'Item deleted successfully', type: 'success' });
        setDeleteConfirmItem(null);
        fetchInventoryData();
      } else {
        const err = await res.json();
        setToast({ message: err.message || 'Failed to delete item', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Failed to delete item', type: 'error' });
    }
  };

  // Handle Quick Restock (Stock-In)
  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!restockItem || !restockQty) return;

    try {
      const res = await fetch(`${API_BASE_URL}/inventory/${restockItem._id}/stock-in`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          quantity: Number(restockQty),
          unitCost: restockCost ? Number(restockCost) : undefined,
          notes: restockNotes || 'Supplier Delivery / Quick Restock'
        })
      });

      if (res.ok) {
        setToast({ message: `Restocked ${restockQty} ${restockItem.unit} of ${restockItem.name}!`, type: 'success' });
        setIsRestockModalOpen(false);
        setRestockItem(null);
        setRestockQty('');
        setRestockCost('');
        setRestockNotes('');
        fetchInventoryData();
      } else {
        const err = await res.json();
        setToast({ message: err.message || 'Error restocking item', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Network error occurred', type: 'error' });
    }
  };

  // Handle Staff Withdrawal
  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    if (!withdrawItem || !withdrawQty || !withdrawStaffName || !withdrawDesignation) return;

    if (Number(withdrawQty) > withdrawItem.currentStock) {
      setToast({ message: 'Cannot withdraw more than current stock!', type: 'error' });
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/inventory/${withdrawItem._id}/withdraw`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          quantity: Number(withdrawQty),
          staffName: withdrawStaffName,
          designation: withdrawDesignation,
          notes: withdrawNotes || `Stock taken by ${withdrawStaffName}`
        })
      });

      if (res.ok) {
        setToast({ message: `Withdrew ${withdrawQty} ${withdrawItem.unit} of ${withdrawItem.name}!`, type: 'success' });
        setIsWithdrawModalOpen(false);
        setWithdrawItem(null);
        setWithdrawQty('');
        setWithdrawStaffName('');
        setWithdrawNotes('');
        fetchInventoryData();
      } else {
        const err = await res.json();
        setToast({ message: err.message || 'Restock failed', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Error restocking item', type: 'error' });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'Other',
      unit: 'kg',
      currentStock: '',
      minStockAlert: '5',
      unitCost: ''
    });
    setIsCustomCategory(false);
  };

  // Recipe Selection Handler
  const handleSelectMenuForRecipe = (menuId) => {
    setSelectedMenuId(menuId);
    const existingRecipe = recipes.find((r) => (r.menuItem?._id || r.menuItem) === menuId);
    if (existingRecipe && existingRecipe.ingredients) {
      setRecipeIngredients(existingRecipe.ingredients.map((i) => ({
        inventoryItem: i.inventoryItem?._id || i.inventoryItem,
        quantity: i.quantity
      })));
    } else {
      setRecipeIngredients([]);
    }
  };

  const handleAddIngredientToRecipe = () => {
    if (items.length === 0) return;
    setRecipeIngredients([...recipeIngredients, { inventoryItem: items[0]._id, quantity: 1 }]);
  };

  const handleRemoveIngredientFromRecipe = (index) => {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index));
  };

  const handleIngredientChange = (index, field, val) => {
    const updated = [...recipeIngredients];
    updated[index][field] = val;
    setRecipeIngredients(updated);
  };

  const handleSaveRecipeMap = async () => {
    if (!selectedMenuId || recipeIngredients.length === 0) {
      setToast({ message: 'Please select a dish and add at least one ingredient', type: 'error' });
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/inventory/recipes`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          menuItem: selectedMenuId,
          ingredients: recipeIngredients.map((i) => ({
            inventoryItem: i.inventoryItem,
            quantity: Number(i.quantity)
          }))
        })
      });

      if (res.ok) {
        setToast({ message: 'Recipe map & dish costing saved successfully!', type: 'success' });
        fetchInventoryData();
      } else {
        const err = await res.json();
        setToast({ message: err.message || 'Error saving recipe', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Error saving recipe', type: 'error' });
    }
  };

  // Calculations
  const totalStockValue = items.reduce((acc, item) => acc + Number(item.currentStock || 0) * Number(item.unitCost || 0), 0);
  const lowStockItems = items.filter((item) => Number(item.currentStock) <= Number(item.minStockAlert));

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Calculate selected recipe costing
  const selectedMenuObj = menuItems.find((m) => m._id === selectedMenuId);
  const totalRecipeCost = recipeIngredients.reduce((acc, ing) => {
    const invItem = items.find((i) => i._id === ing.inventoryItem);
    return acc + (invItem ? Number(invItem.unitCost || 0) * Number(ing.quantity || 0) : 0);
  }, 0);
  const dishSellingPrice = selectedMenuObj ? Number(selectedMenuObj.price || 0) : 0;
  const grossProfit = dishSellingPrice - totalRecipeCost;
  const foodCostPercent = dishSellingPrice > 0 ? (totalRecipeCost / dishSellingPrice * 100).toFixed(1) : 0;

  return (
    <div className="p-1.5 sm:p-2.5 md:p-3 w-full mx-auto space-y-2 sm:space-y-2.5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3 bg-gradient-to-r from-amber-600 to-amber-700 p-2.5 sm:p-3 rounded-2xl text-white shadow-md">
        <div className="flex items-start gap-2 sm:gap-2.5">
          <BackButton onClick={onGoBack} className="shrink-0 mt-0.5 invert" />
          <div>
            <h1 className="text-base sm:text-xl md:text-2xl font-bold flex items-center gap-1.5 sm:gap-2">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 shrink-0" />
              <span>{t("Inventory & Stock Management")}</span>
            </h1>
            <p className="text-amber-100 text-[10px] sm:text-xs mt-0.5 line-clamp-1 sm:line-clamp-none">
              {t("Track raw ingredients, manage recipe costing, and monitor real-time stock deductions.")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <button
            onClick={fetchInventoryData}
            className="flex-1 md:flex-none px-3 py-1.5 sm:py-2 bg-white/10 hover:bg-white/20 rounded-xl transition flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t("Refresh")}</span>
          </button>
          <button
            onClick={() => {resetForm();setEditingItem(null);setIsAddModalOpen(true);}}
            className="flex-1 md:flex-none px-3.5 py-1.5 sm:py-2 bg-white text-amber-700 font-bold rounded-xl hover:bg-amber-50 transition shadow-sm flex items-center justify-center gap-1.5 text-xs sm:text-sm cursor-pointer whitespace-nowrap">
            <Plus className="w-3.5 h-3.5" />
            <span>{t("Add Raw Material")}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards - 3 tiles */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
        <div className="bg-white p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2">
          <div className="min-w-0 w-full">
            <p className="text-[10px] sm:text-xs font-bold text-gray-400 truncate">{t("Total Items")}</p>
            <h3 className="text-base sm:text-xl md:text-2xl font-black text-gray-900 mt-0.5">{items.length}</h3>
          </div>
          <div className="p-1 sm:p-2.5 bg-amber-50 text-amber-600 rounded-lg sm:rounded-xl shrink-0">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="bg-white p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2">
          <div className="min-w-0 w-full">
            <p className="text-[10px] sm:text-xs font-bold text-gray-400 truncate">{t("Low Stock")}</p>
            <h3 className="text-base sm:text-xl md:text-2xl font-black text-red-600 mt-0.5">{lowStockItems.length}</h3>
          </div>
          <div className="p-1 sm:p-2.5 bg-red-50 text-red-600 rounded-lg sm:rounded-xl shrink-0">
            <AlertTriangle className={`w-4 h-4 sm:w-5 sm:h-5 ${lowStockItems.length > 0 ? 'animate-bounce' : ''}`} />
          </div>
        </div>

        <div className="bg-white p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2">
          <div className="min-w-0 w-full">
            <p className="text-[10px] sm:text-xs font-bold text-gray-400 truncate">{t("Stock Value")}</p>
            <h3 className="text-xs sm:text-lg md:text-2xl font-black text-emerald-600 mt-0.5 font-mono truncate">₹{totalStockValue.toLocaleString()}</h3>
          </div>
          <div className="p-1 sm:p-2.5 bg-emerald-50 text-emerald-600 rounded-lg sm:rounded-xl shrink-0">
            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-2 sm:px-3 rounded-t-2xl overflow-x-auto shrink-0 flex-nowrap">
        <button
          onClick={() => setActiveTab('stock')}
          className={`py-2.5 sm:py-3 px-2.5 sm:px-4 font-semibold text-xs sm:text-sm flex items-center gap-1.5 border-b-2 transition whitespace-nowrap shrink-0 cursor-pointer ${
          activeTab === 'stock' ?
          'border-amber-600 text-amber-600' :
          'border-transparent text-gray-500 hover:text-gray-700'}`
          }>
          <Package className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden lg:inline">{t("Stock Room (Raw Materials)")}</span>
          <span className="lg:hidden">{t("Stock Room")}</span>
        </button>
        <button
          onClick={() => setActiveTab('recipes')}
          className={`py-2.5 sm:py-3 px-2.5 sm:px-4 font-semibold text-xs sm:text-sm flex items-center gap-1.5 border-b-2 transition whitespace-nowrap shrink-0 cursor-pointer ${
          activeTab === 'recipes' ?
          'border-amber-600 text-amber-600' :
          'border-transparent text-gray-500 hover:text-gray-700'}`
          }>
          <Utensils className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden lg:inline">{t("Recipe Mapping & Costing")}</span>
          <span className="lg:hidden">{t("Recipe Costing")}</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`py-2.5 sm:py-3 px-2.5 sm:px-4 font-semibold text-xs sm:text-sm flex items-center gap-1.5 border-b-2 transition whitespace-nowrap shrink-0 cursor-pointer ${
          activeTab === 'logs' ?
          'border-amber-600 text-amber-600' :
          'border-transparent text-gray-500 hover:text-gray-700'}`
          }>
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden lg:inline">{t("Stock Audit Logs")}</span>
          <span className="lg:hidden">{t("Audit Logs")}</span>
        </button>
        <button
          onClick={() => {setActiveTab('predictions');fetchPredictions();}}
          className={`py-2.5 sm:py-3 px-2.5 sm:px-4 font-semibold text-xs sm:text-sm flex items-center gap-1.5 border-b-2 transition whitespace-nowrap shrink-0 cursor-pointer ${
          activeTab === 'predictions' ?
          'border-purple-600 text-purple-600' :
          'border-transparent text-gray-500 hover:text-gray-700'}`
          }>
          <Brain className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden lg:inline">{t("🤖 AI Restock Prediction")}</span>
          <span className="lg:hidden">{t("🤖 AI Restock")}</span>
        </button>
      </div>

      {/* TAB 1: STOCK ROOM */}
      {activeTab === 'stock' &&
      <div className="bg-white p-2.5 sm:p-3.5 rounded-b-2xl shadow-sm border border-gray-100 space-y-2.5 sm:space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
            <div className="relative flex-1 sm:max-w-xs md:max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t("Search raw ingredients...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs sm:text-sm" />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 shrink-0">
              {categories.map((cat) =>
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 sm:px-3 py-1 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                  selectedCategory === cat ?
                  'bg-amber-600 text-white shadow-sm' :
                  'bg-gray-100 text-gray-600 hover:bg-gray-200'}`
                  }>
                  {t(cat)}
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto overflow-y-auto max-h-[60vh] rounded-xl border border-gray-100">
            <table className="w-full text-left relative">
              <thead className="bg-gray-50/90 backdrop-blur-sm sticky top-0 shadow-xs z-20">
                <tr>
                  <th className="px-2.5 sm:px-3.5 py-2.5 text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider rounded-tl-xl whitespace-nowrap">{t("Item Details")}</th>
                  <th className="px-2.5 sm:px-3.5 py-2.5 text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{t("Current Stock")}</th>
                  <th className="px-2.5 sm:px-3.5 py-2.5 text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{t("Purchased Stock")}</th>
                  <th className="px-2.5 sm:px-3.5 py-2.5 text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{t("Used Stock")}</th>
                  <th className="px-2.5 sm:px-3.5 py-2.5 text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{t("Unit Cost")}</th>
                  <th className="px-2.5 sm:px-3.5 py-2.5 text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{t("Total Value")}</th>
                  <th className="px-2.5 sm:px-3.5 py-2.5 text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{t("Status")}</th>
                  <th className="px-2.5 sm:px-3.5 py-2.5 text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider text-right rounded-tr-xl whitespace-nowrap">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                {filteredItems.length === 0 ?
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">{t("No items found matching your filters.")}</td>
                </tr> :
                filteredItems.map((item) => {
                  const isLowStock = Number(item.currentStock) <= Number(item.minStockAlert);
                  return (
                    <tr key={item._id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="p-2.5 sm:p-3.5">
                        <div className="font-bold text-gray-900">{t(item.name)}</div>
                        <div className="text-[11px] text-gray-500">{t(item.category)}</div>
                      </td>
                      <td className="p-2.5 sm:p-3.5 font-extrabold text-gray-900 whitespace-nowrap">
                        {item.currentStock} {item.unit}
                      </td>
                      <td className="p-2.5 sm:p-3.5 font-bold text-emerald-600 whitespace-nowrap">
                        {item.totalPurchased || 0} {item.unit}
                      </td>
                      <td className="p-2.5 sm:p-3.5 font-bold text-rose-600 whitespace-nowrap">
                        {item.totalUsed || 0} {item.unit}
                      </td>
                      <td className="p-2.5 sm:p-3.5 text-gray-600 whitespace-nowrap">₹{Number(item.unitCost || 0).toFixed(2)} / {item.unit}</td>
                      <td className="p-2.5 sm:p-3.5 font-semibold text-gray-900 whitespace-nowrap">
                        ₹{(Number(item.currentStock || 0) * Number(item.unitCost || 0)).toLocaleString()}
                      </td>
                      <td className="p-2.5 sm:p-3.5 whitespace-nowrap">
                        {isLowStock ?
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-100 text-red-700 font-bold text-[11px] rounded-full animate-pulse whitespace-nowrap">
                            <AlertTriangle className="w-3 h-3" />{t("Low Stock")}
                          </span> :
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-700 font-semibold text-[11px] rounded-full whitespace-nowrap">
                            <CheckCircle className="w-3 h-3" />{t("In Stock")}
                          </span>
                        }
                      </td>
                      <td className="p-2.5 sm:p-3.5 text-right space-x-1 sm:space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setRestockItem(item);
                            setRestockCost(item.unitCost || '');
                            setIsRestockModalOpen(true);
                          }}
                          className="px-2 sm:px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-[11px] sm:text-xs rounded-lg transition inline-flex items-center gap-1 cursor-pointer">
                          <ArrowUpRight className="w-3 h-3" />
                          <span>{t("Refill")}</span>
                        </button>
                        <button
                          onClick={() => {
                            setWithdrawItem(item);
                            setIsWithdrawModalOpen(true);
                          }}
                          className="px-2 sm:px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-[11px] sm:text-xs rounded-lg transition inline-flex items-center gap-1 cursor-pointer">
                          <ArrowDownRight className="w-3 h-3" />
                          <span>{t("Use")}</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setFormData({
                              name: item.name,
                              category: item.category,
                              unit: item.unit,
                              currentStock: item.currentStock,
                              minStockAlert: item.minStockAlert,
                              unitCost: item.unitCost
                            });
                            setIsAddModalOpen(true);
                          }}
                          className="p-1 text-gray-400 hover:text-amber-600 transition inline-block align-middle cursor-pointer">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item)}
                          className="p-1 text-gray-400 hover:text-red-600 transition cursor-pointer inline-block align-middle">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      }

      {/* TAB 2: RECIPE MAPPING */}
      {activeTab === 'recipes' &&
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {/* Left: Dish Selector */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 md:col-span-1 space-y-4">
            <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
              <Utensils className="w-5 h-5 text-amber-600" />{t("1. Select Dish")}
          </h3>
            <p className="text-xs text-gray-500">{t("Choose a dish from your menu to configure its Bill of Materials (BOM) recipe map.")}

          </p>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {menuItems.map((dish) => {
              const hasRecipe = recipes.some((r) => (r.menuItem?._id || r.menuItem) === dish._id);
              const isSelected = selectedMenuId === dish._id;
              return (
                <button
                  key={dish._id}
                  onClick={() => handleSelectMenuForRecipe(dish._id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition flex items-center justify-between ${
                  isSelected ?
                  'border-amber-600 bg-amber-50/50 shadow-sm' :
                  'border-gray-100 hover:bg-gray-50'}`
                  }>
                  
                    <div>
                      <p className={`font-bold text-sm ${isSelected ? 'text-amber-900' : 'text-gray-800'}`}>
                        {dish.name}
                      </p>
                      <p className="text-xs text-gray-500">₹{dish.price} • {dish.category?.name || 'Menu Dish'}</p>
                    </div>
                    {hasRecipe ?
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-md">{t("Mapped")}

                  </span> :

                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-md">{t("Unmapped")}

                  </span>
                  }
                  </button>);

            })}
            </div>
          </div>

          {/* Right: Ingredients & Costing */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 md:col-span-2 space-y-6">
            {!selectedMenuId ?
          <div className="h-full flex flex-col items-center justify-center text-center p-12 text-gray-400">
                <Utensils className="w-16 h-16 mb-3 opacity-30" />
                <h4 className="font-bold text-gray-700 text-lg">{t("No Dish Selected")}</h4>
                <p className="text-sm max-w-sm mt-1">{t("Please select a menu dish from the left sidebar to map its raw ingredients and view real-time food costing.")}

            </p>
              </div> :

          <>
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="font-bold text-xl text-gray-900">{selectedMenuObj?.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{t("Configure exact quantities deducted automatically when this dish is billed.")}

                </p>
                  </div>
                  <button
                onClick={handleAddIngredientToRecipe}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm">
                
                    <Plus className="w-4 h-4" />{t("Add Ingredient")}
              </button>
                </div>

                {/* Ingredients List */}
                <div className="space-y-3">
                  {recipeIngredients.length === 0 ?
              <div className="p-8 text-center bg-gray-50 rounded-xl text-gray-400 text-sm">{t("No ingredients mapped yet. Click \"+ Add Ingredient\" above!")}

              </div> :

              recipeIngredients.map((ing, idx) => {
                const invObj = items.find((i) => i._id === ing.inventoryItem);
                const cost = invObj ? Number(invObj.unitCost || 0) * Number(ing.quantity || 0) : 0;
                return (
                  <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="flex-1 w-full">
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">{t("Raw Material")}</label>
                            <select
                        value={ing.inventoryItem}
                        onChange={(e) => handleIngredientChange(idx, 'inventoryItem', e.target.value)}
                        className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold">
                        
                              {items.map((item) =>
                        <option key={item._id} value={item._id}>
                                  {item.name} ({item.unit}) - ₹{item.unitCost}/{item.unit}
                                </option>
                        )}
                            </select>
                          </div>
                          <div className="w-full sm:w-36">
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">{t("Qty (")}
                        {invObj?.unit || 'unit'})
                            </label>
                            <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={ing.quantity}
                        onChange={(e) => handleIngredientChange(idx, 'quantity', e.target.value)}
                        className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm font-bold" />
                      
                          </div>
                          <div className="w-full sm:w-28 text-right sm:pt-5 font-bold text-gray-800">
                            ₹{cost.toFixed(2)}
                          </div>
                          <button
                      onClick={() => handleRemoveIngredientFromRecipe(idx)}
                      className="p-2 text-gray-400 hover:text-red-600 sm:pt-5">
                      
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>);

              })
              }
                </div>

                {/* Costing Summary Card */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-2xl text-white space-y-4 shadow-md">
                  <div className="flex items-center justify-between border-b border-gray-700 pb-3">
                    <span className="text-sm text-gray-400">{t("Menu Selling Price")}</span>
                    <span className="text-lg font-bold">₹{dishSellingPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-gray-700 pb-3">
                    <span className="text-sm text-gray-400">{t("Total Raw Material Cost")}</span>
                    <span className="text-lg font-bold text-amber-400">₹{totalRecipeCost.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-300 font-semibold block">{t("Gross Profit per Dish")}</span>
                      <span className="text-xs text-gray-500">{t("Food Cost:")}{foodCostPercent}%</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-extrabold text-emerald-400">₹{grossProfit.toFixed(2)}</span>
                      <span className={`block text-xs font-bold mt-0.5 ${
                  Number(foodCostPercent) > 40 ? 'text-red-400' : 'text-emerald-400'}`
                  }>
                        {Number(foodCostPercent) > 40 ? '⚠️ High Food Cost' : '✨ Optimal Margin'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                onClick={handleSaveRecipeMap}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl shadow-lg transition flex items-center gap-2">
                
                    <CheckCircle className="w-5 h-5" />{t("Save Recipe Map & Costing")}
              </button>
                </div>
              </>
          }
          </div>
        </div>
      }

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'logs' &&
      <div className="bg-white p-3 sm:p-4 rounded-b-2xl shadow-sm border border-gray-100 space-y-3 sm:space-y-4">
          <div>
            <h3 className="font-bold text-base sm:text-lg text-gray-900">{t("Stock Movement & Audit Trail")}</h3>
            <p className="text-[11px] sm:text-xs text-gray-500">{t("Real-time record of vendor deliveries, kitchen wastage adjustments, and automatic POS billing deductions.")}</p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-[11px] sm:text-xs uppercase font-bold text-gray-500">
                  <th className="px-3 py-2.5 rounded-tl-xl whitespace-nowrap">{t("Date & Time")}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t("Item Name")}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t("Transaction Type")}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t("Qty Change")}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t("Final Stock")}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t("Notes")}</th>
                  <th className="px-3 py-2.5 rounded-tr-xl whitespace-nowrap">{t("Performed By")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                {logs.length === 0 ?
                <tr>
                  <td colSpan="7" className="p-8 text-center text-gray-400">{t("No stock movement logs recorded yet.")}</td>
                </tr> :
                logs.map((log) => {
                  let badgeClass = 'bg-gray-100 text-gray-700';
                  if (log.type === 'Stock-In') badgeClass = 'bg-emerald-100 text-emerald-700';
                  if (log.type === 'POS Deduction') badgeClass = 'bg-blue-100 text-blue-700';
                  if (log.type === 'Wastage/Adjustment') badgeClass = 'bg-red-100 text-red-700';

                  return (
                    <tr key={log._id} className="hover:bg-gray-50 transition">
                      <td className="p-2.5 sm:p-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-2.5 sm:p-3 font-bold text-gray-900 whitespace-nowrap">{log.itemName}</td>
                      <td className="p-2.5 sm:p-3 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${badgeClass}`}>
                          {log.type}
                        </span>
                      </td>
                      <td className={`p-2.5 sm:p-3 font-extrabold whitespace-nowrap ${log.quantityChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {log.quantityChange >= 0 ? `+${log.quantityChange}` : log.quantityChange} {log.unit}
                      </td>
                      <td className="p-2.5 sm:p-3 font-bold text-gray-800 whitespace-nowrap">{log.finalStock} {log.unit}</td>
                      <td className="p-2.5 sm:p-3 text-gray-600 text-xs max-w-xs truncate">{log.notes}</td>
                      <td className="p-2.5 sm:p-3 text-gray-500 text-xs whitespace-nowrap">{log.performedBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      }

      {/* TAB 4: AI PREDICTIONS */}
      {activeTab === 'predictions' &&
      <div className="bg-white p-6 rounded-b-2xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                <Brain className="w-6 h-6 text-purple-600" />{t("Smart Restock Predictor")}

            </h3>
              <p className="text-sm text-gray-500 mt-1">{t("AI analyzes your last 7 days of raw material usage to predict exactly what you need to buy for tomorrow.")}

            </p>
            </div>
            {predictions?.meta?.isWeekend &&
          <div className="bg-orange-100 text-orange-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />{t("Weekend Surge Detected (")}
            {Math.round((predictions.meta.weekendMultiplier - 1) * 100)}{t("% boost)")}
          </div>
          }
          </div>

          {predictionsLoading ?
        <div className="py-20 flex flex-col items-center justify-center">
              <RefreshCw className="w-10 h-10 text-purple-500 animate-spin" />
              <p className="text-gray-500 font-medium mt-4">{t("Analyzing historical stock data...")}</p>
            </div> :
        predictions?.predictions?.length > 0 ?
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {predictions.predictions.map((p, idx) =>
          <div key={idx} className={`border rounded-2xl p-5 shadow-sm relative overflow-hidden ${p.urgency === 'critical' ? 'bg-red-50/50 border-red-200' : p.urgency === 'low' ? 'bg-orange-50/50 border-orange-200' : 'bg-white border-gray-100'}`}>
                  {p.urgency === 'critical' && <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase">{t("Critical Outage")}</div>}
                  {p.urgency === 'low' && <div className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase">{t("Buy Soon")}</div>}
                  {p.urgency === 'ok' && <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase">{t("Well Stocked")}</div>}
                  
                  <h4 className="font-bold text-lg text-gray-900 mt-2">{p.itemName}</h4>
                  
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-gray-500">{t("Current Stock")}</p>
                      <p className={`text-xl font-extrabold ${p.currentStock <= 0 ? 'text-red-600' : 'text-gray-900'}`}>{p.currentStock} <span className="text-sm font-medium">{p.unit}</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-purple-600">{t("Predicted Need")}</p>
                      <p className="text-xl font-extrabold text-purple-700">{p.predictedTomorrow} <span className="text-sm font-medium">{p.unit}</span></p>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-gray-100/80">
                    {p.deficit > 0 ?
              <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-gray-600">{t("Suggested Action:")}</span>
                        <span className="font-bold text-red-600 flex items-center gap-1">{t("Buy")}{p.deficit} {p.unit} <Plus className="w-3 h-3" /></span>
                      </div> :

              <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-gray-600">{t("Suggested Action:")}</span>
                        <span className="font-bold text-emerald-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" />{t("No action needed")}</span>
                      </div>
              }
                    <p className="text-[10px] text-gray-400 mt-2">{t("Based on")}{p.avgDailyUsage} {p.unit}{t("/day avg usage")}</p>
                  </div>
                </div>
          )}
            </div> :

        <div className="py-20 text-center">
              <p className="text-gray-500">{t("Not enough stock data yet to make predictions.")}</p>
              <p className="text-xs text-gray-400 mt-2">{t("The AI needs at least 1 day of POS billing activity to generate predictions.")}</p>
            </div>
        }
        </div>
      }

      {/* MODAL 1: ADD/EDIT RAW MATERIAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-surface rounded-t-3xl sm:rounded-2xl max-w-lg w-full shadow-2xl border-t sm:border border-border max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-primary/10 to-transparent p-4 sm:p-5 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 sm:p-2.5 bg-primary/20 rounded-xl text-primary shrink-0">
                  <Package size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-base sm:text-xl font-black text-text-main">
                    {editingItem ? t('Edit Raw Material') : t('Add Raw Material')}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-text-muted mt-0.5 font-medium">{t("Track your inventory precisely to manage costs.")}</p>
                </div>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-text-muted hover:text-text-main p-1 text-lg leading-none cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleSaveItem} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-bold tracking-wide text-text-muted mb-1 block uppercase">{t("Item Name")}<span className="text-danger">*</span></label>
                <input
                  type="text"
                  required
                  placeholder={t("e.g., Basmati Rice, Chicken, Cooking Oil")}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-background border border-border/80 rounded-xl text-xs sm:text-sm font-semibold text-text-main placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                <div>
                  <label className="text-xs font-bold tracking-wide text-text-muted mb-1 block uppercase">{t("Category")}</label>
                  {isCustomCategory ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder={t("Custom category")}
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 bg-background border border-border/80 rounded-xl text-xs sm:text-sm font-semibold text-text-main focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => { setIsCustomCategory(false); setFormData({ ...formData, category: 'Other' }); }}
                        className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 border border-gray-200 rounded-xl transition flex items-center justify-center shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formData.category}
                      onChange={(e) => {
                        if (e.target.value === 'custom_add_new') {
                          setIsCustomCategory(true);
                          setFormData({ ...formData, category: '' });
                        } else {
                          setFormData({ ...formData, category: e.target.value });
                        }
                      }}
                      className="w-full px-3 py-2.5 bg-background border border-border/80 rounded-xl text-xs sm:text-sm font-semibold text-text-main focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all hover:border-border appearance-none cursor-pointer"
                    >
                      {categories.filter((c) => c !== 'All').map((c) =>
                        <option key={c} value={c}>{c}</option>
                      )}
                      <option value="custom_add_new">+ {t("Add Custom...")}</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold tracking-wide text-text-muted mb-1 block uppercase">{t("Unit")}</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2.5 bg-background border border-border/80 rounded-xl text-xs sm:text-sm font-semibold text-text-main focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all hover:border-border appearance-none cursor-pointer"
                  >
                    {units.map((u) =>
                      <option key={u} value={u}>{u}</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div>
                  <label className="text-[10px] sm:text-xs font-bold tracking-wide text-text-muted mb-1 block uppercase truncate">{t("Initial Stock")}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                    className="w-full px-2.5 sm:px-3.5 py-2 sm:py-2.5 bg-background border border-border/80 rounded-xl text-xs sm:text-sm font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] sm:text-xs font-bold tracking-wide text-text-muted mb-1 block flex items-center gap-0.5 uppercase truncate">
                    <span>{t("Alert")}</span>
                    <AlertTriangle size={11} className="text-danger shrink-0" />
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="5"
                    value={formData.minStockAlert}
                    onChange={(e) => setFormData({ ...formData, minStockAlert: e.target.value })}
                    className="w-full px-2.5 sm:px-3.5 py-2 sm:py-2.5 bg-danger/5 border border-danger/20 rounded-xl text-xs sm:text-sm font-bold text-danger focus:outline-none focus:ring-2 focus:ring-danger/40 focus:border-danger transition-all placeholder-danger/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] sm:text-xs font-bold tracking-wide text-text-muted mb-1 block flex items-center gap-0.5 uppercase truncate">
                    <span>{t("Cost")}</span>
                    <DollarSign size={11} className="text-success shrink-0" />
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.unitCost}
                    onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                    className="w-full px-2.5 sm:px-3.5 py-2 sm:py-2.5 bg-success/5 border border-success/20 rounded-xl text-xs sm:text-sm font-bold text-success focus:outline-none focus:ring-2 focus:ring-success/40 focus:border-success transition-all placeholder-success/30"
                  />
                </div>
              </div>

              <div className="shrink-0 flex justify-end gap-2.5 pt-4 mt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 bg-background hover:bg-surface-hover border border-border text-text-main font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer">
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-initial px-5 sm:px-8 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                  <CheckCircle size={16} />
                  <span>{editingItem ? t('Update Material') : t('Save Material')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: QUICK RESTOCK (STOCK-IN) */}
      {isRestockModalOpen && restockItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full shadow-2xl border-t sm:border border-gray-100 max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-1.5">
                  <ArrowUpRight className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{t("Restock:")} {restockItem.name}</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t("Current Stock:")} <strong className="text-gray-800 font-mono">{restockItem.currentStock} {restockItem.unit}</strong>
                </p>
              </div>
              <button onClick={() => setIsRestockModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 text-lg leading-none cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleRestockSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  {t("Add Quantity (")} {restockItem.unit}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder={t("e.g., 25")}
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-base font-extrabold text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  {t("Unit Cost (₹) /")} {restockItem.unit}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={t("Optional cost update")}
                  value={restockCost}
                  onChange={(e) => setRestockCost(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">{t("Notes / Supplier Details")}</label>
                <input
                  type="text"
                  placeholder={t("e.g., Invoice #9821")}
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsRestockModalOpen(false)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer">
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer">
                  <CheckCircle className="w-4 h-4" />
                  <span>{t("Confirm Restock")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: WITHDRAW STOCK */}
      {isWithdrawModalOpen && withdrawItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full shadow-2xl border-t sm:border border-gray-100 max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-1.5">
                  <ArrowDownRight className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>{t("Take / Withdraw Stock")}</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t("Current Stock:")} <strong className="text-gray-800 font-mono">{withdrawItem.currentStock} {withdrawItem.unit}</strong>
                </p>
              </div>
              <button onClick={() => setIsWithdrawModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 text-lg leading-none cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">
                  {t("Withdraw Quantity (")} {withdrawItem.unit}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={withdrawItem.currentStock}
                  required
                  placeholder={t("e.g., 5")}
                  value={withdrawQty}
                  onChange={(e) => setWithdrawQty(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-base font-extrabold text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">{t("Staff Name *")}</label>
                <input
                  type="text"
                  required
                  placeholder={t("e.g., Anand")}
                  value={withdrawStaffName}
                  onChange={(e) => setWithdrawStaffName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">{t("Designation")}</label>
                <select
                  value={withdrawDesignation}
                  onChange={(e) => setWithdrawDesignation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold bg-white"
                >
                  <option value="Head Chef">{t("Head Chef")}</option>
                  <option value="Sous Chef">{t("Sous Chef")}</option>
                  <option value="Kitchen Staff">{t("Kitchen Staff")}</option>
                  <option value="Manager">{t("Manager")}</option>
                  <option value="Other">{t("Other")}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">{t("Notes / Reason")}</label>
                <input
                  type="text"
                  placeholder={t("e.g., Taken for weekend prep")}
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer">
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer">
                  <CheckCircle className="w-4 h-4" />
                  <span>{t("Confirm Withdrawal")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE CONFIRMATION */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-sm w-full shadow-2xl border-t sm:border border-gray-100 p-4 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">{t("Delete Raw Material?")}</h3>
                <p className="text-xs text-gray-500">{t("This cannot be undone.")}</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-gray-600">
              {t("Are you sure you want to delete")} <strong className="text-gray-900">"{deleteConfirmItem.name}"</strong>? {t("This will remove it from inventory calculations and recipes.")}
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer">
                {t("Cancel")}
              </button>
              <button
                type="button"
                onClick={confirmDeleteItem}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer">
                <Trash2 size={15} />
                <span>{t("Delete")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default InventoryManagement;