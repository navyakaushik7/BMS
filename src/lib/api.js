import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});

// Attach the JWT (if present) to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('bms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On a 401 (expired/invalid session), clear the stored token so the app
// falls back to the login screen instead of looping on failed requests.
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('bms_token');
      localStorage.removeItem('bms_user');
      // Let the app drop back to Login immediately (e.g. admin revoked this account)
      window.dispatchEvent(new CustomEvent('bms:logout', { detail: { revoked: !!err.response?.data?.revoked } }));
    }
    return Promise.reject(err);
  }
);

// ---- Auth (OTP) ----
export const requestOtp = (phone) => API.post('/auth/request-otp', { phone });
export const verifyOtp = (phone, code) => API.post('/auth/verify-otp', { phone, code });
export const getMe = () => API.get('/auth/me');

// ---- Analytics ----
export const getAnalytics = (params) => API.get('/analytics/overview', { params });

// ---- Voters ----
export const getVoters = (params) => API.get('/voters', { params });
export const getVoterReligions = (params) => API.get('/voters/religions', { params });
export const createVoter = (data) => API.post('/voters', data);
export const updateVoter = (id, data) => API.put(`/voters/${id}`, data);
export const deleteVoter = (id) => API.delete(`/voters/${id}`);

// ---- Booths ----
export const getBooths = (params) => API.get('/booths', { params });
export const createBooth = (data) => API.post('/booths', data);
export const updateBooth = (id, data) => API.put(`/booths/${id}`, data);
export const deleteBooth = (id) => API.delete(`/booths/${id}`);

// ---- Schemes ----
export const getSchemes = (params) => API.get('/schemes', { params });
export const createScheme = (data) => API.post('/schemes', data);
export const updateScheme = (id, data) => API.put(`/schemes/${id}`, data);
export const deleteScheme = (id) => API.delete(`/schemes/${id}`);
export const getSchemeVoters = (id, params) => API.get(`/schemes/${id}/voters`, { params });
export const enrollSchemeVoters = (id, voter_ids) => API.post(`/schemes/${id}/voters`, { voter_ids });
export const unenrollSchemeVoter = (id, voterId) => API.delete(`/schemes/${id}/voters/${voterId}`);
export const getSchemeCaste = (params) => API.get('/analytics/scheme-caste', { params });

// ---- Wards ----
export const getWards = () => API.get('/wards');
export const createWard = (data) => API.post('/wards', data);

// ---- Bulk import (Excel) ----
export const bulkImportVoters = (rows, wardId) => API.post('/voters/bulk-import', { rows, ward_id: wardId });

// ---- Staff (admin only) ----
export const getStaff = () => API.get('/staff');
export const createStaff = (data) => API.post('/staff', data);
export const updateStaff = (id, data) => API.put(`/staff/${id}`, data);
export const deleteStaff = (id) => API.delete(`/staff/${id}`);
export const deactivateStaff = (id) => API.patch(`/staff/${id}/deactivate`);
export const reactivateStaff = (id) => API.patch(`/staff/${id}/reactivate`);

export default API;
