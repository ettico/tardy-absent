import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 means the stored token is missing/expired/invalid (e.g. the server
// restarted with fresh data). Clear the stale session and send the user
// back to login instead of leaving the page stuck in a broken state.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export function apiErrorMessage(err: unknown, fallback = 'אירעה שגיאה, נסי שוב'): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return 'לא ניתן להתחבר לשרת. יש לוודא שהשרת (npm run dev בתיקיית server) פועל.';
    }
    const data = err.response.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  return fallback;
}
