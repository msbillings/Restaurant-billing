import React, { useState, useEffect } from 'react';
import { useLanguage } from "../context/LanguageContext";
import { getMenuItems, addMenuItem, bulkAddMenuItems, updateMenuItem, deleteMenuItem, deleteAllMenuItems } from '../api/menu';
import { getAllCategories, createCategory, updateCategory, deleteCategory } from '../api/category';
import { getCachedMenuItems, getCachedCategories } from '../db/offlineDb';
import { getInventory } from '../api/inventory';
import Papa from 'papaparse';
import { Plus, Edit2, Trash2, X, Search, FolderPlus, Folder, FolderOpen, ChevronLeft, ChevronRight, Eye, Download, Upload, ToggleLeft, Loader2, RefreshCw, MoreVertical, Tag, Percent, Hash } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import Toast from './Toast';
import BackButton from './common/BackButton';
import BulkImportModal, { generateExcelWithStyling } from './BulkImportModal';

const formatImageUrl = (url) => {
  if (!url) return '';
  let trimmed = url.trim();

  if (trimmed.includes('google.com/imgres') || trimmed.includes('imgurl=')) {
    try {
      const urlObj = new URL(trimmed);
      const extracted = urlObj.searchParams.get('imgurl');
      if (extracted) trimmed = extracted;
    } catch (e) {
      const match = trimmed.match(/[?&]imgurl=([^&]+)/);
      if (match && match[1]) trimmed = decodeURIComponent(match[1]);
    }
  } else if (trimmed.includes('mediaurl=')) {
    try {
      const urlObj = new URL(trimmed);
      const extracted = urlObj.searchParams.get('mediaurl');
      if (extracted) trimmed = extracted;
    } catch (e) {}
  }

  if (trimmed.startsWith('data:image/') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return trimmed;
  }
  if (/^[A-Za-z0-9+/=]{30,}$/.test(trimmed) || trimmed.startsWith('iVBOR') || trimmed.startsWith('/9j/') || trimmed.startsWith('R0lGOD') || trimmed.startsWith('UklGR')) {
    let mime = 'jpeg';
    if (trimmed.startsWith('iVBOR')) mime = 'png';else
    if (trimmed.startsWith('R0lGOD')) mime = 'gif';else
    if (trimmed.startsWith('UklGR')) mime = 'webp';
    return `data:image/${mime};base64,${trimmed}`;
  }
  return trimmed;
};

// Common restaurant ingredients — shown as suggestions in the recipe builder
// These are frontend-only and do NOT affect other shops' inventory
const COMMON_INGREDIENTS = [
  { name: 'Rice', unit: 'kg' },
  { name: 'Wheat Flour (Maida)', unit: 'kg' },
  { name: 'Atta (Whole Wheat)', unit: 'kg' },
  { name: 'Basmati Rice', unit: 'kg' },
  { name: 'Semolina (Rava)', unit: 'kg' },
  { name: 'Cooking Oil', unit: 'L' },
  { name: 'Ghee', unit: 'kg' },
  { name: 'Butter', unit: 'kg' },
  { name: 'Milk', unit: 'L' },
  { name: 'Cream', unit: 'L' },
  { name: 'Curd / Yogurt', unit: 'kg' },
  { name: 'Paneer', unit: 'kg' },
  { name: 'Onion', unit: 'kg' },
  { name: 'Tomato', unit: 'kg' },
  { name: 'Garlic', unit: 'kg' },
  { name: 'Ginger', unit: 'kg' },
  { name: 'Green Chilli', unit: 'kg' },
  { name: 'Potato', unit: 'kg' },
  { name: 'Cauliflower', unit: 'kg' },
  { name: 'Spinach', unit: 'kg' },
  { name: 'Carrot', unit: 'kg' },
  { name: 'Capsicum', unit: 'kg' },
  { name: 'Lemon', unit: 'pcs' },
  { name: 'Coriander Leaves', unit: 'kg' },
  { name: 'Mint Leaves', unit: 'kg' },
  { name: 'Salt', unit: 'kg' },
  { name: 'Sugar', unit: 'kg' },
  { name: 'Turmeric Powder', unit: 'kg' },
  { name: 'Red Chilli Powder', unit: 'kg' },
  { name: 'Coriander Powder', unit: 'kg' },
  { name: 'Cumin (Jeera)', unit: 'kg' },
  { name: 'Mustard Seeds', unit: 'kg' },
  { name: 'Garam Masala', unit: 'kg' },
  { name: 'Biryani Masala', unit: 'kg' },
  { name: 'Chicken', unit: 'kg' },
  { name: 'Mutton', unit: 'kg' },
  { name: 'Fish', unit: 'kg' },
  { name: 'Prawns', unit: 'kg' },
  { name: 'Eggs', unit: 'pcs' },
  { name: 'Chana Dal', unit: 'kg' },
  { name: 'Urad Dal', unit: 'kg' },
  { name: 'Toor Dal', unit: 'kg' },
  { name: 'Rajma', unit: 'kg' },
  { name: 'Cashews', unit: 'kg' },
  { name: 'Water', unit: 'L' },
];

const MenuManagement = ({ user, onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('items');
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Instant Cache Load (0ms delay)
    getCachedMenuItems().then((cachedItems) => {
      if (cachedItems && Array.isArray(cachedItems) && cachedItems.length > 0) {
        setItems(cachedItems);
        setLoading(false);
      }
    }).catch(() => {});

    getCachedCategories().then((cachedCats) => {
      if (cachedCats && Array.isArray(cachedCats) && cachedCats.length > 0) {
        setCategories(cachedCats);
      }
    }).catch(() => {});

    // 2. Background Revalidation
    fetchItems(true);
    fetchCategories();
    fetchInventory();
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isCategoryViewMode, setIsCategoryViewMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, itemId: null, categoryId: null });
  const [toast, setToast] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('latest');
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  // Per-recipe-row dropdown open state & search query
  const [ingredientDropdown, setIngredientDropdown] = useState({}); // { [rowIndex]: { open: bool, query: string } }

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);
  const itemsPerPage = 20;

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    type: 'veg',
    description: '',
    image: '',
    taxRate: 0,
    hsnCode: '',
    isAvailable: true,
    recipe: [],
    variants: []
  });

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    sortOrder: 0,
    isActive: true
  });

  useEffect(() => {
    fetchItems();
    fetchCategories();
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const data = await getInventory();
      setInventoryItems(data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  const fetchItems = async (isBackground = false) => {
    if (!isBackground && items.length === 0) {
      setLoading(true);
    }
    try {
      const data = await getMenuItems(true);
      setItems(data);
    } catch (error) {
      console.error('Error fetching menu:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await getAllCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleOpenModal = (item = null, viewMode = false) => {
    setIsViewMode(viewMode);
    if (item) {
      setCurrentItem(item);
      setFormData({
        name: item.name,
        category: item.category?.name || item.category || '',
        price: item.price,
        type: item.type || 'veg',
        description: item.description || '',
        image: item.image || '',
        taxRate: item.taxRate || 0,
        hsnCode: item.hsnCode || '',
        isAvailable: item.isAvailable !== false,
        recipe: item.recipe || [],
        variants: item.variants || []
      });
    } else {
      setCurrentItem(null);
      setFormData({
        name: '',
        category: '',
        price: '',
        type: 'veg',
        description: '',
        image: '',
        taxRate: 0,
        hsnCode: '',
        isAvailable: true,
        recipe: [],
        variants: []
      });
    }
    setShowCustomCategoryInput(false);
    setCustomCategoryName('');
    setIsModalOpen(true);
  };

  const handleOpenCategoryModal = (category = null, viewMode = false) => {
    setIsCategoryViewMode(viewMode);
    if (category) {
      setCurrentCategory(category);
      setCategoryFormData({
        name: category.name,
        description: category.description || '',
        sortOrder: category.sortOrder || 0,
        isActive: category.isActive !== false
      });
    } else {
      setCurrentCategory(null);
      setCategoryFormData({
        name: '',
        description: '',
        sortOrder: 0,
        isActive: true
      });
    }
    setIsCategoryModalOpen(true);
  };

  const validateItemForm = () => {
    const errors = {};

    if (!formData.name || formData.name.trim() === '') {
      errors.name = 'Item name is required';
    }

    if (!formData.category || formData.category === '') {
      errors.category = 'Category is required';
    } else if (formData.category === 'CUSTOM_NEW_CATEGORY' && (!customCategoryName || customCategoryName.trim() === '')) {
      errors.category = 'Custom category name is required';
    }

    const price = parseFloat(formData.price);
    if (!formData.price || formData.price === '') {
      errors.price = 'Price is required';
    } else if (isNaN(price) || price <= 0) {
      errors.price = 'Price must be a positive number';
    }

    const taxRate = parseFloat(formData.taxRate);
    if (formData.taxRate !== '' && (isNaN(taxRate) || taxRate < 0)) {
      errors.taxRate = 'Tax rate must be a non-negative number';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateItemForm()) {
      setToast({ message: 'Please fix validation errors', type: 'error' });
      return;
    }

    try {
      let finalCategory = formData.category;
      
      if (showCustomCategoryInput && customCategoryName.trim()) {
        try {
          const newCategory = await createCategory({
            name: customCategoryName.trim(),
            description: '',
            sortOrder: categories.length,
            isActive: true
          });
          finalCategory = newCategory.name;
          setCategories(prev => [...prev, newCategory]);
        } catch (catError) {
          console.error('Error creating custom category:', catError);
          setToast({ message: 'Failed to create new category', type: 'error' });
          return;
        }
      }

      const price = parseFloat(formData.price);
      const taxRate = parseFloat(formData.taxRate) || 0;

      // Sanitize recipe — convert '' ingredientId to null and drop fully empty rows
      const cleanRecipe = (formData.recipe || [])
        .filter(r => r.ingredientId || r.customName?.trim())  // keep only meaningful rows
        .map(r => ({
          ingredientId: r.ingredientId || null,   // empty string → null for Mongoose ObjectId
          customName: r.customName?.trim() || '',
          unit: r.unit?.trim() || '',
          quantityRequired: Number(r.quantityRequired) || 1
        }));

      const itemData = {
        ...formData,
        category: finalCategory,
        image: formatImageUrl(formData.image),
        price,
        taxRate,
        recipe: cleanRecipe
      };

      console.log('Submitting menu item:', itemData);

      if (currentItem) {
        await updateMenuItem(currentItem._id, itemData);
        setToast({ message: 'Item updated successfully', type: 'success' });
      } else {
        await addMenuItem(itemData);
        setToast({ message: 'Item created successfully', type: 'success' });
      }
      fetchItems();
      setIsModalOpen(false);
      setValidationErrors({});
    } catch (error) {
      console.error('Error saving item:', error);

      // Extract meaningful error message
      let errorMessage = 'Failed to save item';

      if (error.response) {
        // Server responded with error status
        errorMessage = error.response.data?.message ||
        error.response.data?.error ||
        `Server error: ${error.response.status}`;
        console.error('Server error details:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        // Request made but no response
        errorMessage = 'No response from server. Please check your connection.';
        console.error('No response received:', error.request);
      } else {
        // Error in request setup
        errorMessage = error.message || 'Failed to save item';
        console.error('Request setup error:', error.message);
      }

      setToast({ message: errorMessage, type: 'error' });
    }
  };

  const fileInputRef = React.useRef(null);

  const handleExportExcel = async () => {
    try {
      const exportItems = items.map((item) => ({
        name: item.name,
        category: item.category?.name || item.category,
        price: item.price,
        type: item.type === 'veg' ? 'Veg' : item.type === 'non-veg' ? 'Non-Veg' : 'Egg',
        description: item.description || '',
        isAvailable: item.isAvailable ? 'TRUE' : 'FALSE',
        taxRate: item.taxRate || 0,
        image: item.image || ''
      }));

      await generateExcelWithStyling(exportItems, 'MS_Billings_Menu_Export.xlsx');
      setToast({ message: 'Menu exported to Excel successfully!', type: 'success' });
    } catch (err) {
      console.error('Export error:', err);
      // Fallback to CSV export
      handleExportCSV();
    }
  };

  const handleExportCSV = () => {
    const csvData = items.map((item) => ({
      Name: item.name,
      Category: item.category?.name || item.category,
      Price: item.price,
      Type: item.type === 'veg' ? 'Veg' : item.type === 'non-veg' ? 'Non-Veg' : 'Egg',
      Description: item.description || '',
      'Is Available': item.isAvailable ? 'Yes' : 'No',
      'Tax Rate': item.taxRate || 0,
      'HSN Code': item.hsnCode || '',
      'Image URL': item.image || '',
      Variants: item.variants && item.variants.length > 0 ? item.variants.map((v) => `${v.name}:${v.price}`).join('|') : ''
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'MS_Billings_Menu_Export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkImportItems = async (validItems) => {
    try {
      const itemsPayload = validItems.map(row => ({
        name: row.name,
        price: row.price,
        category: row.category,
        type: row.type,
        description: row.description || '',
        isAvailable: row.isAvailable !== false,
        taxRate: row.taxRate || 0,
        image: row.image || ''
      }));

      const res = await bulkAddMenuItems(itemsPayload);
      setToast({
        message: res.message || `Bulk Import Complete: ${res.inserted || 0} items added, ${res.updated || 0} items updated.`,
        type: 'success'
      });
      await fetchItems(false);
      await fetchCategories();
    } catch (err) {
      console.error("Failed to bulk import:", err);
      setToast({
        message: 'Bulk import failed: ' + (err.response?.data?.message || err.message),
        type: 'error'
      });
    }
  };

  const handleImportCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data;
          const itemsPayload = [];

          for (const row of rows) {
            if (!row.Name || !row.Price || !row.Category) continue;

            let parsedVariants = [];
            if (row.Variants) {
              parsedVariants = row.Variants.split('|').map((v) => {
                const parts = v.split(':');
                return { name: parts[0] ? parts[0].trim() : '', price: parseFloat(parts[1]) || 0 };
              });
            }

            itemsPayload.push({
              name: row.Name.trim(),
              price: parseFloat(row.Price) || 0,
              category: row.Category.trim(),
              type: row.Type && row.Type.toLowerCase().includes('non') ? 'non-veg' : 'veg',
              description: row.Description || '',
              isAvailable: row['Is Available'] ? row['Is Available'].toLowerCase() === 'yes' : true,
              taxRate: parseFloat(row['Tax Rate']) || 0,
              hsnCode: row['HSN Code'] || '',
              image: row['Image URL'] || '',
              variants: parsedVariants
            });
          }

          if (itemsPayload.length === 0) {
            setToast({ message: 'No valid items found in CSV file', type: 'error' });
            return;
          }

          const res = await bulkAddMenuItems(itemsPayload);
          setToast({
            message: res.message || `Imported ${res.inserted || 0} items successfully, updated ${res.updated || 0}.`,
            type: 'success'
          });
          await fetchItems(false);
          await fetchCategories();
        } catch (error) {
          setToast({ message: 'Error processing CSV file: ' + (error.response?.data?.message || error.message), type: 'error' });
        } finally {
          setLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        setToast({ message: 'Failed to parse CSV file', type: 'error' });
        setLoading(false);
      }
    });
  };

  const handleDeleteClick = (id) => {
    setDeleteModal({ isOpen: true, itemId: id });
  };

  const handleToggleAvailability = async (item) => {
    try {
      const updated = await updateMenuItem(item._id, { isAvailable: !item.isAvailable });
      setItems((prev) => prev.map((i) => i._id === item._id ? { ...i, isAvailable: !item.isAvailable } : i));
      setToast({ message: `"${item.name}" marked as ${!item.isAvailable ? 'Available' : 'Unavailable'}`, type: 'success' });
    } catch (error) {
      setToast({ message: 'Failed to update availability', type: 'error' });
    }
  };

  const confirmDelete = async () => {
    if (deleteModal.deleteAll) {
      try {
        await deleteAllMenuItems();
        fetchItems();
        setDeleteModal({ isOpen: false, itemId: null, categoryId: null, deleteAll: false });
        setToast({ message: 'All items deleted successfully', type: 'success' });
      } catch (error) {
        console.error('Error deleting all items:', error);
        setToast({ message: 'Failed to delete all items', type: 'error' });
      }
    } else if (deleteModal.itemId) {
      try {
        await deleteMenuItem(deleteModal.itemId);
        fetchItems();
        setDeleteModal({ isOpen: false, itemId: null, categoryId: null, deleteAll: false });
        setToast({ message: 'Item deleted successfully', type: 'success' });
      } catch (error) {
        console.error('Error deleting item:', error);
        setToast({ message: error.response?.data?.message || 'Failed to delete item', type: 'error' });
      }
    } else if (deleteModal.categoryId) {
      try {
        await deleteCategory(deleteModal.categoryId);
        fetchCategories();
        fetchItems(); // Refresh items as categories might be referenced
        setDeleteModal({ isOpen: false, itemId: null, categoryId: null });
        setToast({ message: 'Category deleted successfully', type: 'success' });
      } catch (error) {
        console.error('Error deleting category:', error);
        setToast({ message: error.response?.data?.message || 'Failed to delete category', type: 'error' });
      }
    }
  };

  const validateCategoryForm = () => {
    const errors = {};

    if (!categoryFormData.name || categoryFormData.name.trim() === '') {
      errors.name = 'Category name is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();

    if (!validateCategoryForm()) {
      setToast({ message: 'Please fix validation errors', type: 'error' });
      return;
    }

    try {
      console.log('Submitting category:', categoryFormData);

      if (currentCategory) {
        await updateCategory(currentCategory._id, categoryFormData);
        setToast({ message: 'Category updated successfully', type: 'success' });
      } else {
        await createCategory(categoryFormData);
        setToast({ message: 'Category created successfully', type: 'success' });
      }
      fetchCategories();
      setIsCategoryModalOpen(false);
      setValidationErrors({});
    } catch (error) {
      console.error('Error saving category:', error);

      // Extract meaningful error message
      let errorMessage = 'Failed to save category';

      if (error.response) {
        errorMessage = error.response.data?.message ||
        error.response.data?.error ||
        `Server error: ${error.response.status}`;
        console.error('Server error details:', {
          status: error.response.status,
          data: error.response.data
        });
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your connection.';
        console.error('No response received:', error.request);
      } else {
        errorMessage = error.message || 'Failed to save category';
        console.error('Request setup error:', error.message);
      }

      setToast({ message: errorMessage, type: 'error' });
    }
  };

  const handleDeleteCategoryClick = (id) => {
    setDeleteModal({ isOpen: true, itemId: null, categoryId: id });
  };

  const filteredItems = items.filter((item) =>
  item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  (item.category?.name || item.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    switch (sortBy) {
      case 'latest':
        return new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0);
      case 'oldest':
        return new Date(a.createdAt || a.updatedAt || 0) - new Date(b.createdAt || b.updatedAt || 0);
      case 'alphaAsc':
        return a.name.localeCompare(b.name);
      case 'alphaDesc':
        return b.name.localeCompare(a.name);
      case 'priceAsc':
        return a.price - b.price;
      case 'priceDesc':
        return b.price - a.price;
      default:
        return 0;
    }
  });

  const filteredCategories = categories.filter((category) =>
  category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  (category.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination logic
  const itemsTotalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const categoriesTotalPages = Math.ceil(filteredCategories.length / itemsPerPage);

  const itemsStartIndex = (currentPage - 1) * itemsPerPage;
  const itemsEndIndex = itemsStartIndex + itemsPerPage;
  const paginatedItems = filteredItems.slice(itemsStartIndex, itemsEndIndex);

  const categoriesStartIndex = (currentPage - 1) * itemsPerPage;
  const categoriesEndIndex = categoriesStartIndex + itemsPerPage;
    const paginatedCategories = filteredCategories.slice(categoriesStartIndex, categoriesEndIndex);

  if (loading) return <div className="flex items-center justify-center h-full text-text-muted">{t("Loading...")}</div>;

  return (
    <div className="h-full flex flex-col bg-background p-1.5 sm:p-2.5 md:p-3 overflow-hidden">
      {/* Responsive Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-2.5 mb-2 sm:mb-2.5 p-2 sm:p-2.5 bg-surface rounded-2xl border border-border shrink-0 shadow-2xs">
        {/* Title + Mobile Controls */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <BackButton onClick={onGoBack} className="shrink-0" />
            <div>
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-text-main leading-tight whitespace-nowrap">{t("Menu Management")}</h1>
              <p className="text-[10px] sm:text-xs text-text-muted hidden xs:block">{t("Manage your restaurant's menu items and categories")}</p>
            </div>
          </div>
          
          {/* Mobile Right: Tab Switcher + 3 Dots Button */}
          <div className="flex sm:hidden items-center gap-1.5 shrink-0">
            <div className="flex bg-background p-0.5 rounded-xl border border-border shrink-0">
              <button
                onClick={() => setActiveTab('items')}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'items'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main hover:bg-surface'
                }`}
              >
                {t("Items")}
              </button>
              <button
                onClick={() => setActiveTab('categories')}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'categories'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main hover:bg-surface'
                }`}
              >
                {t("Categories")}
              </button>
            </div>

            <button 
              onClick={() => setShowMobileActions(!showMobileActions)}
              className="p-1.5 bg-background hover:bg-surface-hover border border-border rounded-xl text-text-main transition-colors shrink-0 shadow-2xs"
              title={t("More Options")}
            >
              <MoreVertical size={16} />
            </button>
          </div>
        </div>

        {/* Desktop & Tablet Action Controls Toolbar (Hidden on Mobile) */}
        <div className="hidden sm:flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 w-auto">
          {/* Tab Switcher Pills */}
          <div className="flex bg-background p-0.5 rounded-xl border border-border shrink-0">
            <button
              onClick={() => setActiveTab('items')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'items'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main hover:bg-surface'
              }`}
            >
              {t("Menu Items")}
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'categories'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main hover:bg-surface'
              }`}
            >
              {t("Categories")}
            </button>
          </div>

          {/* Action Buttons: Compact */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleImportCSV}
              className="hidden" />

            {user?.role === 'Admin' && activeTab === 'items' && (
              <>
                <button
                  onClick={() => setIsBulkImportModalOpen(true)}
                  className="flex items-center gap-1 bg-background text-text-muted px-2 py-1 rounded-xl hover:bg-surface-hover hover:text-text-main transition-colors border border-border text-xs font-semibold shadow-2xs"
                  title={t("Bulk Import (.xlsx, .csv)")}
                >
                  <Download size={13} />
                  <span className="hidden xs:inline">{t("Import")}</span>
                </button>
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1 bg-background text-text-muted px-2 py-1 rounded-xl hover:bg-surface-hover hover:text-text-main transition-colors border border-border text-xs font-semibold shadow-2xs"
                  title={t("Export Excel / CSV")}
                >
                  <Upload size={13} />
                  <span className="hidden xs:inline">{t("Export")}</span>
                </button>
                <button
                  onClick={() => setDeleteModal({ isOpen: true, itemId: null, categoryId: null, deleteAll: true })}
                  className="flex items-center gap-1 bg-danger/10 text-danger px-2 py-1 rounded-xl hover:bg-danger/20 transition-colors border border-danger/20 text-xs font-semibold"
                  title={t("Delete All Items")}
                >
                  <Trash2 size={13} />
                  <span className="hidden sm:inline">{t("Delete All")}</span>
                </button>
              </>
            )}

            {user?.role === 'Admin' && activeTab === 'items' && (
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center gap-1 bg-primary text-white px-2.5 sm:px-3 py-1 rounded-xl hover:bg-primary-hover transition-colors shadow-xs text-xs font-bold whitespace-nowrap"
              >
                <Plus size={14} />
                <span>{t("Add Item")}</span>
              </button>
            )}

            {user?.role === 'Admin' && activeTab === 'categories' && (
              <button
                onClick={() => handleOpenCategoryModal()}
                className="flex items-center gap-1 bg-secondary text-white px-2.5 sm:px-3 py-1 rounded-xl hover:bg-accent transition-colors shadow-xs text-xs font-bold whitespace-nowrap"
              >
                <FolderPlus size={14} />
                <span>{t("Add Category")}</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Dropdown Actions Drawer when 3 dots toggled */}
        {showMobileActions && (
          <div className="sm:hidden flex flex-wrap gap-1.5 w-full pt-2 border-t border-border mt-1 animate-in fade-in slide-in-from-top-1">
            {user?.role === 'Admin' && activeTab === 'items' && (
              <>
                <button
                  onClick={() => { setIsBulkImportModalOpen(true); setShowMobileActions(false); }}
                  className="flex items-center gap-1 bg-background text-text-muted px-2.5 py-1.5 rounded-xl hover:bg-surface-hover hover:text-text-main transition-colors border border-border text-xs font-semibold shadow-2xs flex-1 justify-center"
                >
                  <Download size={13} />
                  <span>{t("Import")}</span>
                </button>
                <button
                  onClick={() => { handleExportExcel(); setShowMobileActions(false); }}
                  className="flex items-center gap-1 bg-background text-text-muted px-2.5 py-1.5 rounded-xl hover:bg-surface-hover hover:text-text-main transition-colors border border-border text-xs font-semibold shadow-2xs flex-1 justify-center"
                >
                  <Upload size={13} />
                  <span>{t("Export")}</span>
                </button>
                <button
                  onClick={() => { setDeleteModal({ isOpen: true, itemId: null, categoryId: null, deleteAll: true }); setShowMobileActions(false); }}
                  className="flex items-center gap-1 bg-danger/10 text-danger px-2.5 py-1.5 rounded-xl hover:bg-danger/20 transition-colors border border-danger/20 text-xs font-semibold flex-1 justify-center"
                >
                  <Trash2 size={13} />
                  <span>{t("Delete All")}</span>
                </button>
              </>
            )}

            {user?.role === 'Admin' && activeTab === 'items' && (
              <button
                onClick={() => { handleOpenModal(); setShowMobileActions(false); }}
                className="w-full flex items-center justify-center gap-1 bg-primary text-white py-1.5 rounded-xl hover:bg-primary-hover transition-colors shadow-xs text-xs font-bold"
              >
                <Plus size={14} />
                <span>{t("Add Item")}</span>
              </button>
            )}

            {user?.role === 'Admin' && activeTab === 'categories' && (
              <button
                onClick={() => { handleOpenCategoryModal(); setShowMobileActions(false); }}
                className="w-full flex items-center justify-center gap-1 bg-secondary text-white py-1.5 rounded-xl hover:bg-accent transition-colors shadow-xs text-xs font-bold"
              >
                <FolderPlus size={14} />
                <span>{t("Add Category")}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Search, Sort & Top Pagination */}
      <div className="mb-2 sm:mb-2.5 flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" size={13} />
          <input
            type="text"
            placeholder={`Search ${activeTab === 'items' ? 'items' : 'categories'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary transition-colors text-xs text-text-main shadow-2xs font-medium" />
        </div>

        {/* Sort Filter */}
        {activeTab === 'items' && (
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-28 sm:w-36 md:w-44 px-2.5 py-1.5 border border-border rounded-xl bg-surface text-text-main text-xs focus:outline-none focus:border-primary transition-colors shadow-2xs cursor-pointer shrink-0 font-medium"
          >
            <option value="latest">{t("Added: Latest")}</option>
            <option value="oldest">{t("Added: Oldest")}</option>
            <option value="alphaAsc">{t("Alphabetical (A-Z)")}</option>
            <option value="alphaDesc">{t("Alphabetical (Z-A)")}</option>
            <option value="priceAsc">{t("Price: Low to High")}</option>
            <option value="priceDesc">{t("Price: High to Low")}</option>
          </select>
        )}

        {/* Top Pagination Controls */}
        {(activeTab === 'items' ? itemsTotalPages : categoriesTotalPages) > 1 && (
          <div className="flex items-center gap-0.5 bg-surface border border-border rounded-xl px-1.5 py-1 shrink-0 shadow-2xs">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-0.5 rounded-lg text-text-muted hover:text-text-main hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title={t("Previous Page")}
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-[10px] sm:text-[11px] font-bold text-text-main px-1 select-none whitespace-nowrap">
              {currentPage} / {activeTab === 'items' ? itemsTotalPages : categoriesTotalPages}
            </span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(activeTab === 'items' ? itemsTotalPages : categoriesTotalPages, p + 1))}
              disabled={currentPage === (activeTab === 'items' ? itemsTotalPages : categoriesTotalPages)}
              className="p-0.5 rounded-lg text-text-muted hover:text-text-main hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title={t("Next Page")}
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Table Container */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden flex-1 flex flex-col shadow-sm">
        <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
          <div className="min-w-[620px]">
            {activeTab === 'items' ? (
              <table className="w-full text-left border-collapse">
                <thead className="bg-background sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border">{t("Name")}</th>
                    <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border">{t("Category")}</th>
                    <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border">{t("Type")}</th>
                    <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border">{t("Price")}</th>
                    <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border text-right">{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {loading && items.length === 0 ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i} className="border-b border-border animate-pulse">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-surface-hover shrink-0"></div>
                            <div className="w-28 h-3.5 bg-surface-hover rounded"></div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5"><div className="w-16 h-3.5 bg-surface-hover rounded"></div></td>
                        <td className="px-3 py-2.5"><div className="w-12 h-3.5 bg-surface-hover rounded-full"></div></td>
                        <td className="px-3 py-2.5"><div className="w-10 h-3.5 bg-surface-hover rounded"></div></td>
                        <td className="px-3 py-2.5 text-right"><div className="w-16 h-3.5 bg-surface-hover rounded ml-auto"></div></td>
                      </tr>
                    ))
                  ) : paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-10 text-center text-text-muted">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 size={24} className={loading ? "animate-spin text-primary" : "hidden"} />
                          <span className="font-medium text-xs">
                            {loading ? t("Loading items...") : t("No menu items found")}
                          </span>
                          {!loading && (
                            <button
                              onClick={() => fetchItems(false)}
                              className="mt-1 px-2.5 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                            >
                              <RefreshCw size={13} /> {t("Refresh")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item) => (
                      <tr key={item._id} className="hover:bg-surface-hover transition-colors group">
                        <td className="px-3 py-2 font-medium text-text-main whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            {formatImageUrl(item.image) ? (
                              <div className="w-8 h-8 rounded-lg overflow-hidden bg-background border border-border shrink-0 shadow-2xs relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface-hover to-surface animate-pulse rounded-lg" />
                                <img
                                  src={formatImageUrl(item.image)}
                                  alt={item.name}
                                  className="w-8 h-8 object-cover relative z-10"
                                  onLoad={(e) => { e.target.previousSibling.style.display = 'none'; }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.previousSibling.style.display = 'none';
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                {item.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="font-semibold">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-text-muted whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-background rounded-md border border-border text-[11px]">
                            {item.category?.name || item.category}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.type === 'veg' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                            {item.type === 'veg' ? 'Veg' : 'Non-Veg'}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-bold text-text-main whitespace-nowrap">₹{item.price}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1.5 items-center">
                            <button
                              onClick={() => handleToggleAvailability(item)}
                              title={item.isAvailable ? t("Mark Unavailable") : t("Mark Available")}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0 ${item.isAvailable ? 'bg-green-500' : 'bg-gray-300'}`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${item.isAvailable ? 'translate-x-4.5' : 'translate-x-1'}`} />
                            </button>
                            <button
                              onClick={() => handleOpenModal(item, true)}
                              className="p-1 hover:bg-background rounded-lg text-primary transition-colors"
                              title={t("View Details")}
                            >
                              <Eye size={15} />
                            </button>
                            {user?.role === 'Admin' && (
                              <>
                                <button
                                  onClick={() => handleOpenModal(item, false)}
                                  className="p-1 hover:bg-background rounded-lg text-primary transition-colors"
                                  title={t("Edit Item")}
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(item._id)}
                                  className="p-1 hover:bg-background rounded-lg text-danger transition-colors"
                                  title={t("Delete Item")}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-background sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border">{t("Name")}</th>
                    <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border">{t("Description")}</th>
                    <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border">{t("Sort Order")}</th>
                    <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border">{t("Status")}</th>
                    <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border text-right">{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {paginatedCategories.map((category) => (
                    <tr key={category._id} className="hover:bg-surface-hover transition-colors group">
                      <td className="px-3 py-2 font-semibold text-text-main whitespace-nowrap">{category.name}</td>
                      <td className="px-3 py-2 text-text-muted max-w-[200px] truncate">{category.description || '-'}</td>
                      <td className="px-3 py-2 text-text-muted whitespace-nowrap">{category.sortOrder}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${category.isActive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                          {category.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenCategoryModal(category, true)}
                            className="p-1 hover:bg-background rounded-lg text-primary transition-colors" title={t("View Details")}>
                            <Eye size={15} />
                          </button>
                          {user?.role === 'Admin' && (
                            <>
                              <button
                                onClick={() => handleOpenCategoryModal(category, false)}
                                className="p-1 hover:bg-background rounded-lg text-primary transition-colors" title={t("Edit Category")}>
                                <Edit2 size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteCategoryClick(category._id)}
                                className="p-1 hover:bg-background rounded-lg text-danger transition-colors" title={t("Delete Category")}>
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Pagination Controls - Visible on desktop, mobile uses compact top toolbar pagination */}
        {(activeTab === 'items' && itemsTotalPages > 1 || activeTab === 'categories' && categoriesTotalPages > 1) && (
          <div className="hidden md:flex p-3 border-t border-border items-center justify-between bg-background text-xs">
            <div className="text-text-muted font-medium">
              {t("Showing")}{' '}
              {activeTab === 'items' ? itemsStartIndex + 1 : categoriesStartIndex + 1} {t("to")}{' '}
              {activeTab === 'items'
                ? Math.min(itemsEndIndex, filteredItems.length)
                : Math.min(categoriesEndIndex, filteredCategories.length)
              } {t("of")}{' '}
              {activeTab === 'items' ? filteredItems.length : filteredCategories.length}{' '}
              {activeTab === 'items' ? t('items') : t('categories')}
            </div>
            <div className="flex items-center gap-2">
              <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-border bg-surface text-text-main disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-hover transition-colors">
              
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-1">
                {[...Array(activeTab === 'items' ? itemsTotalPages : categoriesTotalPages)].map((_, i) => {
                const page = i + 1;
                const totalPages = activeTab === 'items' ? itemsTotalPages : categoriesTotalPages;
                if (
                page === 1 ||
                page === totalPages ||
                page >= currentPage - 1 && page <= currentPage + 1)
                {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentPage === page ?
                      'bg-primary text-white' :
                      'bg-surface text-text-muted hover:bg-surface-hover hover:text-text-main border border-border'}`
                      }>
                      
                        {page}
                      </button>);

                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page} className="px-2 text-text-muted">...</span>;
                }
                return null;
              })}
              </div>
              <button
              onClick={() => setCurrentPage((prev) => Math.min(activeTab === 'items' ? itemsTotalPages : categoriesTotalPages, prev + 1))}
              disabled={currentPage === (activeTab === 'items' ? itemsTotalPages : categoriesTotalPages)}
              className="p-2 rounded-lg border border-border bg-surface text-text-main disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-hover transition-colors">
              
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Product Overview Modal (View Mode) */}
      {isModalOpen && isViewMode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-2.5 border-b border-border bg-background/50">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-primary/10 text-primary rounded-lg">
                  
                </span>
                <h2 className="text-sm sm:text-base font-bold text-text-main">
                  {t("Product Overview")}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body - Structured & Compact without scrolling */}
            <div className="p-3.5 space-y-2.5">
              {/* Visual Hero Showcase */}
              <div className="relative w-full h-48 sm:h-56 rounded-xl overflow-hidden bg-background border border-border flex items-center justify-center shadow-inner group">
                {formatImageUrl(formData.image || currentItem?.image) ? (
                  <img
                    src={formatImageUrl(formData.image || currentItem?.image)}
                    alt={formData.name || currentItem?.name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1 text-primary/80">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center font-black text-xl">
                      {(formData.name || currentItem?.name || 'M').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[10px] text-text-muted font-medium">{t("No image uploaded")}</span>
                  </div>
                )}

                {/* Overlays on Image */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/30 pointer-events-none" />

                {/* Top Badges */}
                <div className="absolute top-2 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm backdrop-blur-md ${
                    (formData.type || currentItem?.type) === 'veg'
                      ? 'bg-emerald-600/90 text-white'
                      : 'bg-rose-600/90 text-white'
                  }`}>
                    {(formData.type || currentItem?.type) === 'veg' ? '● Veg' : '▲ Non-Veg'}
                  </span>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm backdrop-blur-md ${
                    (formData.isAvailable ?? currentItem?.isAvailable ?? true)
                      ? 'bg-emerald-600/90 text-white'
                      : 'bg-red-600/90 text-white'
                  }`}>
                    {(formData.isAvailable ?? currentItem?.isAvailable ?? true) ? t('Available') : t('Unavailable')}
                  </span>
                </div>

                {/* Bottom Overlay Title & Price */}
                <div className="absolute bottom-2 left-2.5 right-2.5 flex items-end justify-between text-white">
                  <div className="min-w-0 pr-2">
                    <h3 className="text-sm sm:text-base font-bold truncate leading-tight drop-shadow-md">
                      {formData.name || currentItem?.name}
                    </h3>
                    <p className="text-[11px] text-white/80 font-medium truncate">
                      {formData.category || currentItem?.category?.name || currentItem?.category || t('General')}
                    </p>
                  </div>
                  <div className="text-right shrink-0 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/20 shadow-sm">
                    <span className="text-xs sm:text-sm font-black text-amber-300">
                      ₹{parseFloat(formData.price || currentItem?.price || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Information Grid: Compact Stat Pills */}
              <div className="grid grid-cols-3 gap-2">
                {/* Category */}
                <div className="bg-background p-2 rounded-xl border border-border flex flex-col justify-center shadow-2xs">
                  <span className="text-[10px] text-text-muted font-medium flex items-center gap-1">
                    <Tag size={10} className="text-primary shrink-0" /> {t("Category")}
                  </span>
                  <span className="text-xs font-bold text-text-main truncate mt-0.5">
                    {formData.category || currentItem?.category?.name || currentItem?.category || '-'}
                  </span>
                </div>

                {/* GST / Tax */}
                <div className="bg-background p-2 rounded-xl border border-border flex flex-col justify-center shadow-2xs">
                  <span className="text-[10px] text-text-muted font-medium flex items-center gap-1">
                    <Percent size={10} className="text-primary shrink-0" /> {t("GST Rate")}
                  </span>
                  <span className="text-xs font-bold text-text-main mt-0.5">
                    {formData.taxRate || currentItem?.taxRate || 0}%
                  </span>
                </div>

                {/* HSN Code */}
                <div className="bg-background p-2 rounded-xl border border-border flex flex-col justify-center shadow-2xs">
                  <span className="text-[10px] text-text-muted font-medium flex items-center gap-1">
                    <Hash size={10} className="text-primary shrink-0" /> {t("HSN Code")}
                  </span>
                  <span className="text-xs font-bold text-text-main font-mono mt-0.5 truncate">
                    {formData.hsnCode || currentItem?.hsnCode || '-'}
                  </span>
                </div>
              </div>

              {/* Variants Section (if available) */}
              {((formData.variants && formData.variants.length > 0) || (currentItem?.variants && currentItem.variants.length > 0)) && (
                <div className="bg-background p-2 rounded-xl border border-border">
                  <span className="text-[10px] text-text-muted font-semibold block mb-1">
                    {t("Variants & Pricing")}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(formData.variants?.length ? formData.variants : currentItem?.variants || []).map((v, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 bg-surface px-2 py-0.5 rounded-lg border border-border text-[11px] font-bold text-text-main shadow-2xs">
                        <span>{v.name}:</span>
                        <span className="text-primary font-black">₹{parseFloat(v.price).toFixed(2)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description (if available) */}
              {(formData.description || currentItem?.description) && (
                <div className="bg-background p-2 rounded-xl border border-border">
                  <span className="text-[10px] text-text-muted font-semibold block mb-0.5">
                    {t("Description")}
                  </span>
                  <p className="text-xs text-text-main line-clamp-2 italic">
                    "{formData.description || currentItem?.description}"
                  </p>
                </div>
              )}

              {/* Raw Materials Recipe (if available) */}
              {(() => {
                const recipeList = formData.recipe?.length ? formData.recipe : (currentItem?.recipe || []);
                // Filter only entries that have a meaningful ingredient reference
                const visibleRecipe = recipeList.filter(r => {
                  if (!r) return false;
                  // Inventory-linked (could be populated object or just id string)
                  if (r.ingredientId) return true;
                  // Custom-name ingredient
                  if (r.customName) return true;
                  return false;
                });
                if (visibleRecipe.length === 0) return null;
                return (
                  <div className="bg-background p-2 rounded-xl border border-border">
                    <span className="text-[10px] text-text-muted font-semibold block mb-1">
                      {t("Recipe Ingredients")}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {visibleRecipe.map((r, idx) => {
                        // Handle populated object (DB returns { _id, name, unit }) or plain id string
                        const populated = typeof r.ingredientId === 'object' && r.ingredientId !== null && r.ingredientId.name;
                        let label;
                        if (populated) {
                          label = `${r.ingredientId.name} (${r.quantityRequired} ${r.ingredientId.unit || 'unit'})`;
                        } else {
                          const inv = inventoryItems.find(i => i._id === r.ingredientId);
                          label = inv
                            ? `${inv.name} (${r.quantityRequired} ${inv.unit})`
                            : r.customName
                              ? `${r.customName} (${r.quantityRequired} ${r.unit || 'qty'})`
                              : null;
                        }
                        if (!label) return null;
                        return (
                          <span key={idx} className="bg-surface px-1.5 py-0.5 rounded-md border border-border text-[10px] text-text-muted font-medium">
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-2.5 sm:p-3 border-t border-border bg-background/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const item = currentItem;
                    if (!item?._id) return;
                    const newVal = !(formData.isAvailable ?? item.isAvailable ?? true);
                    // Optimistic update — both form state and currentItem
                    setFormData(prev => ({ ...prev, isAvailable: newVal }));
                    setCurrentItem(prev => ({ ...prev, isAvailable: newVal }));
                    try {
                      await updateMenuItem(item._id, { isAvailable: newVal });
                      setItems(prev => prev.map(i => i._id === item._id ? { ...i, isAvailable: newVal } : i));
                      setToast({ message: `"${item.name}" marked as ${newVal ? 'Available' : 'Unavailable'}`, type: 'success' });
                    } catch (err) {
                      // Revert on failure
                      setFormData(prev => ({ ...prev, isAvailable: !newVal }));
                      setCurrentItem(prev => ({ ...prev, isAvailable: !newVal }));
                      setToast({ message: 'Failed to update availability', type: 'error' });
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all border shadow-2xs cursor-pointer ${
                    (formData.isAvailable ?? currentItem?.isAvailable ?? true)
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    (formData.isAvailable ?? currentItem?.isAvailable ?? true) ? 'bg-emerald-500' : 'bg-red-500'
                  }`} />
                  <span>{(formData.isAvailable ?? currentItem?.isAvailable ?? true) ? t("Available") : t("Unavailable")}</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {user?.role === 'Admin' && (
                  <button
                    onClick={() => setIsViewMode(false)}
                    className="flex items-center gap-1 bg-primary text-white px-3 py-1 rounded-xl hover:bg-primary-hover transition-colors text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Edit2 size={12} />
                    <span>{t("Edit Item")}</span>
                  </button>
                )}
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1 bg-surface text-text-main border border-border hover:bg-surface-hover rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  {t("Close")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Add Item Form Modal */}
      {isModalOpen && !isViewMode && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center p-5 border-b border-border">
              <h2 className="text-lg sm:text-xl font-bold text-text-main">
                {currentItem ? t('Edit Item') : t('Add New Item')}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text-main transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto">
              <div className="space-y-1">
                <label className="text-xs sm:text-sm font-medium text-text-muted">{t("Item Name")}</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (validationErrors.name) setValidationErrors({ ...validationErrors, name: null });
                  }}
                  className={`w-full bg-background border rounded-xl px-3.5 py-2 text-xs sm:text-sm text-text-main focus:outline-none focus:border-primary ${validationErrors.name ? 'border-danger' : 'border-border'}`}
                  placeholder={t("e.g. Butter Chicken")}
                />
                {validationErrors.name && (
                  <p className="text-xs text-danger">{validationErrors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs sm:text-sm font-medium text-text-muted">{t("Category")}</label>
                  {!showCustomCategoryInput ? (
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'CUSTOM_NEW_CATEGORY') {
                          setShowCustomCategoryInput(true);
                          setFormData({ ...formData, category: val });
                        } else {
                          setFormData({ ...formData, category: val });
                        }
                        if (validationErrors.category) setValidationErrors({ ...validationErrors, category: null });
                      }}
                      className={`w-full bg-background border rounded-xl px-3 py-2 text-xs sm:text-sm text-text-main focus:outline-none focus:border-primary ${validationErrors.category ? 'border-danger' : 'border-border'}`}
                    >
                      <option value="">{t("Select Category")}</option>
                      {categories.map((cat) => (
                        <option key={cat._id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                      <option value="CUSTOM_NEW_CATEGORY" className="font-bold text-primary">+ {t("Add Custom Category")}</option>
                    </select>
                  ) : (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder={t("Enter category name")}
                        value={customCategoryName}
                        onChange={(e) => {
                          setCustomCategoryName(e.target.value);
                          if (validationErrors.category) setValidationErrors({ ...validationErrors, category: null });
                        }}
                        className={`w-full bg-background border rounded-xl px-3 py-2 text-xs sm:text-sm text-text-main focus:outline-none focus:border-primary ${validationErrors.category ? 'border-danger' : 'border-border'}`}
                        autoFocus
                      />
                      <button 
                        type="button" 
                        onClick={() => {
                          setShowCustomCategoryInput(false);
                          setCustomCategoryName('');
                          setFormData({ ...formData, category: '' });
                        }}
                        className="p-2 border border-border rounded-xl hover:bg-surface-hover text-text-muted shrink-0 flex items-center justify-center cursor-pointer"
                        title={t("Cancel")}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  {validationErrors.category && (
                    <p className="text-xs text-danger">{validationErrors.category}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs sm:text-sm font-medium text-text-muted">{t("Price (₹)")}</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => {
                      setFormData({ ...formData, price: e.target.value });
                      if (validationErrors.price) setValidationErrors({ ...validationErrors, price: null });
                    }}
                    className={`w-full bg-background border rounded-xl px-3 py-2 text-xs sm:text-sm text-text-main focus:outline-none focus:border-primary ${validationErrors.price ? 'border-danger' : 'border-border'}`}
                    placeholder="0.00"
                  />
                  {validationErrors.price && (
                    <p className="text-xs text-danger">{validationErrors.price}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs sm:text-sm font-medium text-text-muted">{t("HSN Code")}</label>
                  <input
                    type="text"
                    value={formData.hsnCode}
                    onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs sm:text-sm text-text-main focus:outline-none focus:border-primary"
                    placeholder={t("e.g. 2106")}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs sm:text-sm font-medium text-text-muted">{t("GST Rate (%)")}</label>
                  <select
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs sm:text-sm text-text-main focus:outline-none focus:border-primary"
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              {/* Variants Section */}
              <div className="space-y-2 p-3 bg-background rounded-xl border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs sm:text-sm font-bold text-text-main">{t("Item Variants (Sizes/Types)")}</label>
                    <p className="text-[10px] sm:text-xs text-text-muted">{t("E.g., Mini, Half, Full. Overrides base price.")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, variants: [...(formData.variants || []), { name: '', price: '' }] })}
                    className="flex items-center gap-1 text-[11px] bg-primary/10 text-primary px-2.5 py-1 rounded-lg hover:bg-primary/20 transition-colors font-bold cursor-pointer"
                  >
                    <Plus size={13} /> {t("Add Variant")}
                  </button>
                </div>
                {formData.variants && formData.variants.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {formData.variants.map((variant, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder={t("Variant Name (e.g. Half)")}
                          value={variant.name}
                          onChange={(e) => {
                            const newVariants = [...formData.variants];
                            newVariants[index].name = e.target.value;
                            setFormData({ ...formData, variants: newVariants });
                          }}
                          className="flex-1 bg-surface border border-border rounded-xl px-3 py-1.5 text-xs text-text-main focus:border-primary focus:outline-none"
                        />
                        <input
                          type="number"
                          placeholder={t("Price (₹)")}
                          value={variant.price}
                          min="0"
                          step="0.01"
                          onChange={(e) => {
                            const newVariants = [...formData.variants];
                            newVariants[index].price = e.target.value;
                            setFormData({ ...formData, variants: newVariants });
                          }}
                          className="w-24 bg-surface border border-border rounded-xl px-3 py-1.5 text-xs text-text-main focus:border-primary focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newVariants = formData.variants.filter((_, i) => i !== index);
                            setFormData({ ...formData, variants: newVariants });
                          }}
                          className="p-1.5 text-danger hover:bg-danger/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs sm:text-sm font-medium text-text-muted">{t("Type")}</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm">
                    <input
                      type="radio"
                      name="type"
                      value="veg"
                      checked={formData.type === 'veg'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-text-main font-medium">{t("Veg")}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm">
                    <input
                      type="radio"
                      name="type"
                      value="non-veg"
                      checked={formData.type === 'non-veg'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-text-main font-medium">{t("Non-Veg")}</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-medium text-text-muted">{t("Item Image (Optional)")}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: formatImageUrl(e.target.value) })}
                    className="flex-1 bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-text-main focus:outline-none focus:border-primary"
                    placeholder={t("Paste image URL or upload file...")}
                  />
                  <label className="bg-surface hover:bg-surface-hover text-text-main px-3 py-1.5 rounded-xl cursor-pointer flex items-center gap-1 text-xs border border-border shrink-0 transition-colors shadow-2xs font-medium">
                    <span>{t("Upload")}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = (event) => {
                            const img = new Image();
                            img.onload = () => {
                              const canvas = document.createElement('canvas');
                              const MAX_WIDTH = 400;
                              const MAX_HEIGHT = 400;
                              let width = img.width;
                              let height = img.height;

                              if (width > height) {
                                if (width > MAX_WIDTH) {
                                  height = Math.round(height * MAX_WIDTH / width);
                                  width = MAX_WIDTH;
                                }
                              } else {
                                if (height > MAX_HEIGHT) {
                                  width = Math.round(width * MAX_HEIGHT / height);
                                  height = MAX_HEIGHT;
                                }
                              }

                              canvas.width = width;
                              canvas.height = height;
                              const ctx = canvas.getContext('2d');
                              ctx.drawImage(img, 0, 0, width, height);
                              const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
                              setFormData({ ...formData, image: compressedDataUrl });
                            };
                            img.src = event.target.result;
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
                {formatImageUrl(formData.image) && (
                  <div className="relative mt-2 w-full h-28 rounded-xl overflow-hidden bg-background border border-border flex items-center justify-center">
                    <img src={formatImageUrl(formData.image)} alt="Preview" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, image: '' })}
                      className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full hover:bg-black/80 transition-colors text-xs cursor-pointer"
                      title={t("Remove image")}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs sm:text-sm font-medium text-text-muted">{t("Description")}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs sm:text-sm text-text-main focus:outline-none focus:border-primary h-20 resize-none"
                  placeholder={t("Item description...")}
                />
              </div>

              {/* Recipe Builder */}
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs sm:text-sm font-medium text-text-muted">{t("Recipe (Raw Materials)")}</label>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, recipe: [...formData.recipe, { ingredientId: '', customName: '', unit: '', quantityRequired: 1 }] });
                    }}
                    className="text-xs text-primary font-bold hover:underline cursor-pointer"
                  >
                    {t("+ Add Ingredient")}
                  </button>
                </div>
                {formData.recipe.map((ingredient, index) => {
                  const ddState = ingredientDropdown[index] || { open: false, query: '' };
                  const query = ddState.query.toLowerCase();

                  // Filter inventory items
                  const filteredInv = inventoryItems.filter(inv =>
                    !query || inv.name.toLowerCase().includes(query)
                  );

                  // Filter common ingredients — exclude ones already in inventory by name
                  const inventoryNames = inventoryItems.map(i => i.name.toLowerCase());
                  const filteredCommon = COMMON_INGREDIENTS.filter(c =>
                    !inventoryNames.includes(c.name.toLowerCase()) &&
                    (!query || c.name.toLowerCase().includes(query))
                  );

                  // Current display label for this row
                  const invMatch = inventoryItems.find(i => i._id === ingredient.ingredientId);
                  const displayLabel = invMatch
                    ? `${invMatch.name} (${invMatch.unit})`
                    : ingredient.customName
                      ? `${ingredient.customName}${ingredient.unit ? ` (${ingredient.unit})` : ''}`
                      : '';

                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex gap-2 items-center">
                        {/* Hybrid combobox */}
                        <div className="relative flex-1">
                          <input
                            type="text"
                            placeholder={t("Search or type ingredient...")}
                            value={ddState.open ? ddState.query : displayLabel}
                            onFocus={(e) => {
                              setIngredientDropdown(prev => ({
                                ...prev,
                                [index]: { open: true, query: displayLabel }
                              }));
                              // Scroll the modal's scroll container so the input + dropdown below it are visible
                              setTimeout(() => {
                                try {
                                  // Walk up the DOM to find the nearest scrollable ancestor (the form)
                                  let el = e.target.parentElement;
                                  while (el && el !== document.body) {
                                    const style = window.getComputedStyle(el);
                                    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                                      // Scroll to bottom so the dropdown (below the input) is visible
                                      el.scrollTop = el.scrollHeight;
                                      break;
                                    }
                                    el = el.parentElement;
                                  }
                                } catch (_) {}
                              }, 30);
                            }}
                            onChange={(e) => setIngredientDropdown(prev => ({
                              ...prev,
                              [index]: { open: true, query: e.target.value }
                            }))}
                            className="w-full bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:border-primary"
                          />
                          {ddState.open && (
                            <>
                              {/* Click-outside overlay */}
                              <div
                                className="fixed inset-0 z-[60]"
                                onClick={() => setIngredientDropdown(prev => ({
                                  ...prev,
                                  [index]: { open: false, query: '' }
                                }))}
                              />
                              <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-2xl z-[61] max-h-52 overflow-y-auto">
                                {/* Free-type custom option if query has text and no exact match */}
                                {ddState.query.trim() && !inventoryItems.some(i => i.name.toLowerCase() === ddState.query.toLowerCase()) && !COMMON_INGREDIENTS.some(c => c.name.toLowerCase() === ddState.query.toLowerCase()) && (
                                  <button
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10 border-b border-border flex items-center gap-2 cursor-pointer"
                                    onClick={() => {
                                      const newRecipe = [...formData.recipe];
                                      // Set unit to '' so user is prompted to fill it
                                      newRecipe[index] = { ...newRecipe[index], ingredientId: '', customName: ddState.query.trim(), unit: '' };
                                      setFormData({ ...formData, recipe: newRecipe });
                                      setIngredientDropdown(prev => ({ ...prev, [index]: { open: false, query: '' } }));
                                    }}
                                  >
                                    <Plus size={11} /> Add "{ddState.query.trim()}" as custom
                                  </button>
                                )}

                                {/* Inventory items section */}
                                {filteredInv.length > 0 && (
                                  <>
                                    <div className="px-3 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider bg-background/60 sticky top-0">
                                      Your Inventory
                                    </div>
                                    {filteredInv.map(inv => (
                                      <button
                                        key={inv._id}
                                        type="button"
                                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-primary/10 flex items-center justify-between cursor-pointer ${
                                          ingredient.ingredientId === inv._id ? 'bg-primary/10 font-bold text-primary' : 'text-text-main'
                                        }`}
                                        onClick={() => {
                                          const newRecipe = [...formData.recipe];
                                          newRecipe[index] = { ...newRecipe[index], ingredientId: inv._id, customName: '', unit: inv.unit };
                                          setFormData({ ...formData, recipe: newRecipe });
                                          setIngredientDropdown(prev => ({ ...prev, [index]: { open: false, query: '' } }));
                                        }}
                                      >
                                        <span>{inv.name}</span>
                                        <span className="text-text-muted text-[10px]">{inv.unit}</span>
                                      </button>
                                    ))}
                                  </>
                                )}

                                {/* Common ingredients section */}
                                {filteredCommon.length > 0 && (
                                  <>
                                    <div className="px-3 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider bg-background/60 sticky top-0">
                                      Common Ingredients
                                    </div>
                                    {filteredCommon.map((c, ci) => (
                                      <button
                                        key={`common-${ci}`}
                                        type="button"
                                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-primary/10 flex items-center justify-between cursor-pointer ${
                                          ingredient.customName === c.name ? 'bg-primary/10 font-bold text-primary' : 'text-text-main'
                                        }`}
                                        onClick={() => {
                                          const newRecipe = [...formData.recipe];
                                          newRecipe[index] = { ...newRecipe[index], ingredientId: '', customName: c.name, unit: c.unit };
                                          setFormData({ ...formData, recipe: newRecipe });
                                          setIngredientDropdown(prev => ({ ...prev, [index]: { open: false, query: '' } }));
                                        }}
                                      >
                                        <span>{c.name}</span>
                                        <span className="text-text-muted text-[10px]">{c.unit}</span>
                                      </button>
                                    ))}
                                  </>
                                )}

                                {filteredInv.length === 0 && filteredCommon.length === 0 && !ddState.query.trim() && (
                                  <p className="px-3 py-3 text-xs text-text-muted text-center">Type to search or add custom ingredient</p>
                                )}
                                {filteredInv.length === 0 && filteredCommon.length === 0 && ddState.query.trim() && (
                                  <p className="px-3 py-2 text-xs text-text-muted text-center">No matches — use the "Add custom" option above</p>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Qty input */}
                        <div className="flex flex-col items-center gap-0.5 shrink-0">
                          <span className="text-[9px] text-text-muted font-medium">Qty</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={ingredient.quantityRequired}
                            onChange={(e) => {
                              const newRecipe = [...formData.recipe];
                              newRecipe[index].quantityRequired = Number(e.target.value);
                              setFormData({ ...formData, recipe: newRecipe });
                            }}
                            className="w-14 bg-background border border-border rounded-xl px-2 py-1.5 text-xs text-center"
                          />
                        </div>

                        {/* Unit — editable for custom, badge for inventory/common */}
                        <div className="flex flex-col items-center gap-0.5 shrink-0">
                          <span className="text-[9px] text-text-muted font-medium">Unit</span>
                          {invMatch ? (
                            // Inventory item — unit is fixed from inventory
                            <span className="inline-flex items-center h-[30px] px-2 text-[11px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-xl">
                              {invMatch.unit}
                            </span>
                          ) : (
                            // Custom / common ingredient — unit is editable
                            <input
                              type="text"
                              placeholder="kg"
                              value={ingredient.unit || ''}
                              onChange={(e) => {
                                const newRecipe = [...formData.recipe];
                                newRecipe[index].unit = e.target.value.trim();
                                setFormData({ ...formData, recipe: newRecipe });
                              }}
                              className={`w-14 bg-background border rounded-xl px-2 py-1.5 text-xs text-center ${
                                !ingredient.unit ? 'border-amber-400 focus:border-primary' : 'border-border focus:border-primary'
                              } focus:outline-none`}
                            />
                          )}
                        </div>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => {
                            const newRecipe = formData.recipe.filter((_, i) => i !== index);
                            setFormData({ ...formData, recipe: newRecipe });
                            setIngredientDropdown(prev => {
                              const next = { ...prev };
                              delete next[index];
                              return next;
                            });
                          }}
                          className="text-danger p-1 cursor-pointer shrink-0 mt-3"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full bg-primary text-white py-2.5 rounded-xl font-bold hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20 text-xs sm:text-sm cursor-pointer"
                >
                  {currentItem ? t('Update Item') : t('Create Item')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen &&
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-xl font-bold text-text-main">
                {isCategoryViewMode ? 'View Category' : currentCategory ? 'Edit Category' : 'Add New Category'}
              </h2>
              <button
              onClick={() => setIsCategoryModalOpen(false)}
              className="text-text-muted hover:text-text-main transition-colors">
              
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <label className="text-sm font-medium text-text-muted">{t("Category Name")}</label>
                <input
                type="text"
                required
                value={categoryFormData.name}
                onChange={(e) => {
                  setCategoryFormData({ ...categoryFormData, name: e.target.value });
                  if (validationErrors.name) setValidationErrors({ ...validationErrors, name: null });
                }}
                className={`w-full bg-background border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-primary ${validationErrors.name ? 'border-danger' : 'border-border'}`
                } placeholder={t("e.g. Main Course")} />

              
                {validationErrors.name &&
              <p className="text-xs text-danger">{validationErrors.name}</p>
              }
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-text-muted">{t("Description")}</label>
                <textarea
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-primary h-24 resize-none" placeholder={t("Category description...")} />

              
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-text-muted">{t("Sort Order")}</label>
                <input
                type="number"
                value={categoryFormData.sortOrder}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, sortOrder: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-primary"
                placeholder="0" />
              
              </div>

              {!isCategoryViewMode &&
            <div className="pt-4">
                  <button
                type="submit"
                className="w-full bg-secondary text-white py-3 rounded-xl font-bold hover:bg-accent transition-colors shadow-lg shadow-secondary/20">
                
                    {currentCategory ? 'Update Category' : 'Create Category'}
                  </button>
                </div>
            }
            </form>
          </div>
        </div>
      }

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, itemId: null, categoryId: null, deleteAll: false })}
        onConfirm={confirmDelete}
        title={deleteModal.deleteAll ? "Delete All Items" : deleteModal.itemId ? "Delete Item" : "Delete Category"}
        message={deleteModal.deleteAll ? "Are you sure you want to delete ALL menu items? This action cannot be undone and will empty your entire menu." : `Are you sure you want to delete this ${deleteModal.itemId ? 'menu item' : 'category'}? This action cannot be undone.`}
        confirmText="Delete"
        isDanger={true} />

      <BulkImportModal
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        onImportSuccess={handleBulkImportItems} />
      

      {toast &&
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(null)} />

      }
    </div>);

};

export default MenuManagement;