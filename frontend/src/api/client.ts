import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('revnow_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('revnow_token');
      localStorage.removeItem('revnow_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
