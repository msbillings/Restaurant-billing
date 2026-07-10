import React, { useState, useEffect } from 'react';
import { getMenuItems, addMenuItem, updateMenuItem, deleteMenuItem, deleteAllMenuItems } from '../api/menu';
import { getAllCategories, createCategory, updateCategory, deleteCategory } from '../api/category';
import { getInventory } from '../api/inventory';
import Papa from 'papaparse';
import { Plus, Edit2, Trash2, X, Search, FolderPlus, Folder, FolderOpen, ChevronLeft, ChevronRight, Eye, Download, Upload } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import Toast from './Toast';

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
    if (trimmed.startsWith('iVBOR')) mime = 'png';
    else if (trimmed.startsWith('R0lGOD')) mime = 'gif';
    else if (trimmed.startsWith('UklGR')) mime = 'webp';
    return `data:image/${mime};base64,${trimmed}`;
  }
  return trimmed;
};

const MenuManagement = ({ user }) => {
  const [activeTab, setActiveTab] = useState('items');
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [currentPage, setCurrentPage] = useState(1);

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
    recipe: []
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

  const fetchItems = async () => {
    try {
      const data = await getMenuItems();
      setItems(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching menu:', error);
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
        recipe: item.recipe || []
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
        recipe: []
      });
    }
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
      const price = parseFloat(formData.price);
      const taxRate = parseFloat(formData.taxRate) || 0;

      const itemData = {
        ...formData,
        image: formatImageUrl(formData.image),
        price,
        taxRate
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

  const handleExportCSV = () => {
    const csvData = items.map(item => ({
      Name: item.name,
      Category: item.category?.name || item.category,
      Price: item.price,
      Type: item.type === 'veg' ? 'Veg' : 'Non-Veg',
      Description: item.description || '',
      'Is Available': item.isAvailable ? 'Yes' : 'No',
      'Tax Rate': item.taxRate || 0,
      'HSN Code': item.hsnCode || '',
      'Image URL': item.image || ''
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'menu_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          let successCount = 0;
          let errorCount = 0;
          
          for (const row of rows) {
            try {
              if (!row.Name || !row.Price || !row.Category) continue;

              const itemData = {
                name: row.Name.trim(),
                price: parseFloat(row.Price) || 0,
                category: row.Category.trim(),
                type: (row.Type && row.Type.toLowerCase().includes('non')) ? 'non-veg' : 'veg',
                description: row.Description || '',
                isAvailable: row['Is Available'] ? row['Is Available'].toLowerCase() === 'yes' : true,
                taxRate: parseFloat(row['Tax Rate']) || 0,
                hsnCode: row['HSN Code'] || '',
                image: row['Image URL'] || ''
              };

              await addMenuItem(itemData);
              successCount++;
            } catch (err) {
              console.error("Failed to import row:", row, err);
              errorCount++;
            }
          }
          setToast({ message: `Imported ${successCount} items successfully. ${errorCount ? `${errorCount} failed.` : ''}`, type: 'success' });
          fetchItems();
          fetchCategories();
        } catch (error) {
          setToast({ message: 'Error processing CSV file', type: 'error' });
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

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.category?.name || item.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCategories = categories.filter(category =>
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

  if (loading) return <div className="flex items-center justify-center h-full text-text-muted">Loading...</div>;

  return (
    <div className="h-full flex flex-col bg-background p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl border border-border/50">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main">Menu Management</h1>
          <p className="text-xs sm:text-sm text-text-muted">Manage your restaurant's menu items and categories</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleImportCSV}
            className="hidden"
          />
          {user?.role === 'Admin' && activeTab === 'items' && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-surface text-text-muted px-4 py-2 rounded-lg hover:bg-surface-hover transition-colors border border-border"
                title="Import CSV"
              >
                <Upload size={20} />
                <span className="hidden sm:inline">Import</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 bg-surface text-text-muted px-4 py-2 rounded-lg hover:bg-surface-hover transition-colors border border-border"
                title="Export CSV"
              >
                <Download size={20} />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button
                onClick={() => setDeleteModal({ isOpen: true, itemId: null, categoryId: null, deleteAll: true })}
                className="flex items-center gap-2 bg-danger/10 text-danger px-4 py-2 rounded-lg hover:bg-danger/20 transition-colors border border-danger/20"
                title="Delete All Items"
              >
                <Trash2 size={20} />
                <span className="hidden sm:inline">Delete All</span>
              </button>
            </>
          )}
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'categories' ? 'bg-primary text-white' : 'bg-surface text-text-muted hover:bg-surface-hover'}`}
          >
            Categories
          </button>
          <button
            onClick={() => setActiveTab('items')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'items' ? 'bg-primary text-white' : 'bg-surface text-text-muted hover:bg-surface-hover'}`}
          >
            Menu Items
          </button>
          {user?.role === 'Admin' && activeTab === 'items' && (
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
            >
              <Plus size={20} />
              <span>Add Item</span>
            </button>
          )}
          {user?.role === 'Admin' && activeTab === 'categories' && (
            <button
              onClick={() => handleOpenCategoryModal()}
              className="flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-lg hover:bg-accent transition-colors shadow-lg shadow-secondary/20"
            >
              <FolderPlus size={20} />
              <span>Add Category</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
        <input
          type="text"
          placeholder={`Search ${activeTab === 'items' ? 'items' : 'categories'}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary text-text-main"
        />
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden flex-1 flex flex-col shadow-sm">
        <div className="overflow-y-auto flex-1">
          {activeTab === 'items' ? (
            <table className="w-full text-left border-collapse">
              <thead className="bg-background sticky top-0 z-10">
                <tr>
                  <th className="p-4 font-semibold text-text-muted border-b border-border">Name</th>
                  <th className="p-4 font-semibold text-text-muted border-b border-border">Category</th>
                  <th className="p-4 font-semibold text-text-muted border-b border-border">Type</th>
                  <th className="p-4 font-semibold text-text-muted border-b border-border">Price</th>
                  <th className="p-4 font-semibold text-text-muted border-b border-border text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map(item => (
                  <tr key={item._id} className="border-b border-border hover:bg-surface-hover transition-colors group">
                    <td className="p-4 font-medium text-text-main">
                      <div className="flex items-center gap-3">
                        {formatImageUrl(item.image) ? (
                          <img
                            src={formatImageUrl(item.image)}
                            alt={item.name}
                            className="w-10 h-10 rounded-xl object-cover bg-background border border-border shrink-0 shadow-sm"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                            {item.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-text-muted">
                      <span className="px-2 py-1 bg-background rounded-md border border-border text-xs">
                        {item.category?.name || item.category}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.type === 'veg' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                        }`}>
                        {item.type === 'veg' ? 'Veg' : 'Non-Veg'}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-text-main">₹{item.price}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(item, true)}
                          className="p-2 hover:bg-background rounded-lg text-primary transition-colors"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        {user?.role === 'Admin' && (
                          <>
                            <button
                              onClick={() => handleOpenModal(item, false)}
                              className="p-2 hover:bg-background rounded-lg text-primary transition-colors"
                              title="Edit Item"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(item._id)}
                              className="p-2 hover:bg-background rounded-lg text-danger transition-colors"
                              title="Delete Item"
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-background sticky top-0 z-10">
                <tr>
                  <th className="p-4 font-semibold text-text-muted border-b border-border">Name</th>
                  <th className="p-4 font-semibold text-text-muted border-b border-border">Description</th>
                  <th className="p-4 font-semibold text-text-muted border-b border-border">Sort Order</th>
                  <th className="p-4 font-semibold text-text-muted border-b border-border">Status</th>
                  <th className="p-4 font-semibold text-text-muted border-b border-border text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCategories.map(category => (
                  <tr key={category._id} className="border-b border-border hover:bg-surface-hover transition-colors group">
                    <td className="p-4 font-medium text-text-main">{category.name}</td>
                    <td className="p-4 text-text-muted">{category.description || '-'}</td>
                    <td className="p-4 text-text-muted">{category.sortOrder}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${category.isActive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                        }`}>
                        {category.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenCategoryModal(category, true)}
                          className="p-2 hover:bg-background rounded-lg text-primary transition-colors"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        {user?.role === 'Admin' && (
                          <>
                            <button
                              onClick={() => handleOpenCategoryModal(category, false)}
                              className="p-2 hover:bg-background rounded-lg text-primary transition-colors"
                              title="Edit Category"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDeleteCategoryClick(category._id)}
                              className="p-2 hover:bg-background rounded-lg text-danger transition-colors"
                              title="Delete Category"
                            >
                              <Trash2 size={18} />
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

        {/* Pagination Controls */}
        {((activeTab === 'items' && itemsTotalPages > 1) || (activeTab === 'categories' && categoriesTotalPages > 1)) && (
          <div className="p-4 border-t border-border flex items-center justify-between bg-background">
            <div className="text-sm text-text-muted">
              Showing {activeTab === 'items' ? itemsStartIndex + 1 : categoriesStartIndex + 1} to{' '}
              {activeTab === 'items'
                ? Math.min(itemsEndIndex, filteredItems.length)
                : Math.min(categoriesEndIndex, filteredCategories.length)
              } of{' '}
              {activeTab === 'items' ? filteredItems.length : filteredCategories.length}{' '}
              {activeTab === 'items' ? 'items' : 'categories'}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-border bg-surface text-text-main disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-hover transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-1">
                {[...Array(activeTab === 'items' ? itemsTotalPages : categoriesTotalPages)].map((_, i) => {
                  const page = i + 1;
                  const totalPages = activeTab === 'items' ? itemsTotalPages : categoriesTotalPages;
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentPage === page
                          ? 'bg-primary text-white'
                          : 'bg-surface text-text-muted hover:bg-surface-hover hover:text-text-main border border-border'
                          }`}
                      >
                        {page}
                      </button>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return <span key={page} className="px-2 text-text-muted">...</span>;
                  }
                  return null;
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(activeTab === 'items' ? itemsTotalPages : categoriesTotalPages, prev + 1))}
                disabled={currentPage === (activeTab === 'items' ? itemsTotalPages : categoriesTotalPages)}
                className="p-2 rounded-lg border border-border bg-surface text-text-main disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-hover transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-xl font-bold text-text-main">
                {isViewMode ? 'View Item' : currentItem ? 'Edit Item' : 'Add New Item'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text-main transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <label className="text-sm font-medium text-text-muted">Item Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (validationErrors.name) setValidationErrors({ ...validationErrors, name: null });
                  }}
                  className={`w-full bg-background border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-primary ${validationErrors.name ? 'border-danger' : 'border-border'
                    }`}
                  placeholder="e.g. Butter Chicken"
                />
                {validationErrors.name && (
                  <p className="text-xs text-danger">{validationErrors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text-muted">Category</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => {
                      setFormData({ ...formData, category: e.target.value });
                      if (validationErrors.category) setValidationErrors({ ...validationErrors, category: null });
                    }}
                    className={`w-full bg-background border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-primary ${validationErrors.category ? 'border-danger' : 'border-border'
                      }`}
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat._id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  {validationErrors.category && (
                    <p className="text-xs text-danger">{validationErrors.category}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text-muted">Price (₹)</label>
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
                    className={`w-full bg-background border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-primary ${validationErrors.price ? 'border-danger' : 'border-border'
                      }`}
                    placeholder="0.00"
                  />
                  {validationErrors.price && (
                    <p className="text-xs text-danger">{validationErrors.price}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text-muted">HSN Code</label>
                  <input
                    type="text"
                    value={formData.hsnCode}
                    onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-primary"
                    placeholder="e.g. 2106"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text-muted">GST Rate (%)</label>
                  <select
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-primary"
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-text-muted">Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="veg"
                      checked={formData.type === 'veg'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-text-main">Veg</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="non-veg"
                      checked={formData.type === 'non-veg'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-text-main">Non-Veg</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text-muted">Item Image (Optional)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: formatImageUrl(e.target.value) })}
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-primary text-sm"
                    placeholder="Paste image URL or upload file..."
                  />
                  <label className="bg-surface-hover hover:bg-border text-text-main px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1 text-sm border border-border shrink-0 transition-colors">
                    <span>Upload</span>
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
                              const MAX_WIDTH = 600;
                              const MAX_HEIGHT = 600;
                              let width = img.width;
                              let height = img.height;

                              if (width > height) {
                                if (width > MAX_WIDTH) {
                                  height = Math.round((height * MAX_WIDTH) / width);
                                  width = MAX_WIDTH;
                                }
                              } else {
                                if (height > MAX_HEIGHT) {
                                  width = Math.round((width * MAX_HEIGHT) / height);
                                  height = MAX_HEIGHT;
                                }
                              }

                              canvas.width = width;
                              canvas.height = height;
                              const ctx = canvas.getContext('2d');
                              ctx.drawImage(img, 0, 0, width, height);
                              const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
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
                  <div className="relative mt-2 w-full h-32 rounded-xl overflow-hidden bg-background border border-border flex items-center justify-center">
                    <img src={formatImageUrl(formData.image)} alt="Preview" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, image: '' })}
                      className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80 transition-colors text-xs"
                      title="Remove image"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-text-muted">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-primary h-24 resize-none"
                  placeholder="Item description..."
                />
              </div>

              {/* Recipe Builder */}
              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-text-muted">Recipe (Raw Materials)</label>
                  {!isViewMode && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, recipe: [...formData.recipe, { ingredientId: '', quantityRequired: 1 }] })}
                      className="text-xs text-primary font-bold hover:underline"
                    >
                      + Add Ingredient
                    </button>
                  )}
                </div>
                {formData.recipe.map((ingredient, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <select
                      value={ingredient.ingredientId || (ingredient.ingredientId && ingredient.ingredientId._id)}
                      onChange={(e) => {
                        const newRecipe = [...formData.recipe];
                        newRecipe[index].ingredientId = e.target.value;
                        setFormData({ ...formData, recipe: newRecipe });
                      }}
                      className="flex-1 bg-background border border-border rounded-lg px-2 py-1.5 text-sm"
                      disabled={isViewMode}
                    >
                      <option value="">Select Ingredient...</option>
                      {inventoryItems.map(inv => (
                        <option key={inv._id} value={inv._id}>{inv.name} ({inv.unit})</option>
                      ))}
                    </select>
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
                      className="w-20 bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-center"
                      disabled={isViewMode}
                    />
                    {!isViewMode && (
                      <button
                        type="button"
                        onClick={() => {
                          const newRecipe = formData.recipe.filter((_, i) => i !== index);
                          setFormData({ ...formData, recipe: newRecipe });
                        }}
                        className="text-danger p-1"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {!isViewMode && (
                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
                  >
                    {currentItem ? 'Update Item' : 'Create Item'}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-xl font-bold text-text-main">
                {isCategoryViewMode ? 'View Category' : currentCategory ? 'Edit Category' : 'Add New Category'}
              </h2>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-text-muted hover:text-text-main transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <label className="text-sm font-medium text-text-muted">Category Name</label>
                <input
                  type="text"
                  required
                  value={categoryFormData.name}
                  onChange={(e) => {
                    setCategoryFormData({ ...categoryFormData, name: e.target.value });
                    if (validationErrors.name) setValidationErrors({ ...validationErrors, name: null });
                  }}
                  className={`w-full bg-background border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-primary ${validationErrors.name ? 'border-danger' : 'border-border'
                    }`}
                  placeholder="e.g. Main Course"
                />
                {validationErrors.name && (
                  <p className="text-xs text-danger">{validationErrors.name}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-text-muted">Description</label>
                <textarea
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-primary h-24 resize-none"
                  placeholder="Category description..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-text-muted">Sort Order</label>
                <input
                  type="number"
                  value={categoryFormData.sortOrder}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, sortOrder: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-primary"
                  placeholder="0"
                />
              </div>

              {!isCategoryViewMode && (
                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full bg-secondary text-white py-3 rounded-xl font-bold hover:bg-accent transition-colors shadow-lg shadow-secondary/20"
                  >
                    {currentCategory ? 'Update Category' : 'Create Category'}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, itemId: null, categoryId: null, deleteAll: false })}
        onConfirm={confirmDelete}
        title={deleteModal.deleteAll ? "Delete All Items" : deleteModal.itemId ? "Delete Item" : "Delete Category"}
        message={deleteModal.deleteAll ? "Are you sure you want to delete ALL menu items? This action cannot be undone and will empty your entire menu." : `Are you sure you want to delete this ${deleteModal.itemId ? 'menu item' : 'category'}? This action cannot be undone.`}
        confirmText="Delete"
        isDanger={true}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default MenuManagement;

