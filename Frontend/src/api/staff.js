import api from './axios';

export const getStaff = async () => {
  const response = await api.get('/staff');
  return response.data;
};

export const addStaff = async (staffData) => {
  const response = await api.post('/staff', staffData);
  return response.data;
};

export const updateStaff = async (id, staffData) => {
  const response = await api.put(`/staff/${id}`, staffData);
  return response.data;
};

export const deleteStaff = async (id) => {
  const response = await api.delete(`/staff/${id}`);
  return response.data;
};

export const clockInOut = async (pin, action) => {
  const response = await api.post('/staff/attendance', { pin, action });
  return response.data;
};
