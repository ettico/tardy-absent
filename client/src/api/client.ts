import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
