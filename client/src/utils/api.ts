import axios, { type AxiosError } from 'axios';

// Accept VITE_API_URL with or without a trailing slash or the /api suffix,
// so "https://host.onrender.com" and "https://host.onrender.com/api/" both work.
const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

const api = axios.create({
  baseURL: apiBase.endsWith('/api') ? apiBase : `${apiBase}/api`,
});

// Attach JWT token to every request if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If server returns 401, clear stale token and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
