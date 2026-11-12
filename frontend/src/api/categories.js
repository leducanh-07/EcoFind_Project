import { fetchWithAuth } from './client';

export async function getCategoriesApi() {
  return await fetchWithAuth('/api/categories', { method: 'GET' });
}

