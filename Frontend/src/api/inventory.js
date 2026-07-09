import api from './axios';

export const getInventory = async () => {
  const response = await api.get('/inventory');
  return response.data;
};

export const addInventoryItem = async (itemData) => {
  const response = await api.post('/inventory', itemData);
  return response.data;
};

export const updateInventoryItem = async (id, itemData) => {
  const response = await api.put(`/inventory/${id}`, itemData);
  return response.data;
};

export const deleteInventoryItem = async (id) => {
  const response = await api.delete(`/inventory/${id}`);
  return response.data;
};

export const stockIn = async (data) => {
  const response = await api.post('/inventory/stock-in', data);
  return response.data;
};

export const recordWastage = async (data) => {
  const response = await api.post('/inventory/wastage', data);
  return response.data;
};

export const getRecipes = async () => {
  const response = await api.get('/inventory/recipes');
  return response.data;
};

export const saveRecipe = async (data) => {
  const response = await api.post('/inventory/recipes', data);
  return response.data;
};

export const deleteRecipe = async (id) => {
  const response = await api.delete(`/inventory/recipes/${id}`);
  return response.data;
};

export const getInventoryLogs = async () => {
  const response = await api.get('/inventory/logs');
  return response.data;
};

export const getRestockPredictions = async () => {
  const response = await api.get('/inventory/predictions');
  return response.data;
};
