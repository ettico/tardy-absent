import { api } from '../api/client';

export async function downloadExcel(path: string, params: Record<string, string | undefined>, filename: string) {
  const res = await api.get(path, { params: { ...params, format: 'xlsx' }, responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
