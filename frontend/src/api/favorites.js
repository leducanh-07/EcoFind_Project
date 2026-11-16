/**
 * Favorites API Service (UC-07, FR-11, TE9C751, TE9C752)
 */

import { fetchWithAuth } from './client';

/**
 * Lấy danh sách tin yêu thích của người dùng hiện tại (GET /api/me/favorites)
 */
export async function getFavoritesApi() {
  return await fetchWithAuth('/api/me/favorites', { method: 'GET' });
}

/**
 * Lưu tin vào danh sách yêu thích (PUT /api/listings/{id}/favorite)
 */
export async function addFavoriteApi(listingId) {
  return await fetchWithAuth(`/api/listings/${listingId}/favorite`, {
    method: 'PUT',
  });
}

/**
 * Bỏ lưu tin khỏi danh sách yêu thích (DELETE /api/listings/{id}/favorite)
 */
export async function removeFavoriteApi(listingId) {
  return await fetchWithAuth(`/api/listings/${listingId}/favorite`, {
    method: 'DELETE',
  });
}

/**
 * Kiểm tra trạng thái tin đã lưu hay chưa (GET /api/listings/{id}/favorite)
 */
export async function checkFavoriteStatusApi(listingId) {
  return await fetchWithAuth(`/api/listings/${listingId}/favorite`, {
    method: 'GET',
  });
}
