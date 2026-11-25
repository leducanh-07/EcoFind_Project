/**
 * Geocoding API Service
 * UC-05, FR-08
 */

import { fetchWithAuth } from './client';

/**
 * Tra cứu tọa độ (lat, lng) từ địa chỉ văn bản
 * @param {string} address - Địa chỉ cần tra cứu
 * @param {string} [magicKey] - Mã định danh gợi ý từ API suggest (nếu chọn từ dropdown)
 * @returns {Promise<{ lat: number, lng: number, matched_address?: string, accuracy?: string, provider?: string }>}
 */
export async function geocodeAddressApi(address, magicKey) {
  if (!address || !address.trim()) {
    throw new Error('Vui lòng nhập địa chỉ cần tìm kiếm.');
  }

  const params = { address: address.trim() };
  if (magicKey) {
    params.magic_key = magicKey;
  }
  const query = new URLSearchParams(params).toString();
  return await fetchWithAuth(`/api/geocode?${query}`, {
    method: 'GET',
  });
}

/**
 * Lấy danh sách gợi ý địa chỉ tự động khi đang gõ (Autocomplete)
 * @param {string} q - Từ khóa địa chỉ
 * @param {number} [limit=5] - Số lượng gợi ý tối đa
 * @returns {Promise<{ suggestions: Array<{ text: string, magic_key?: string }> }>}
 */
export async function suggestAddressesApi(q, limit = 5) {
  if (!q || q.trim().length < 2) {
    return { suggestions: [] };
  }
  const query = new URLSearchParams({
    q: q.trim(),
    limit: String(limit),
  }).toString();
  return await fetchWithAuth(`/api/geocode/suggest?${query}`, {
    method: 'GET',
  });
}

/**
 * Chuyển đổi ngược tọa độ GPS hiện tại thành địa chỉ văn bản
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{ address: string }>}
 */
export async function reverseGeocodeApi(lat, lng) {
  const query = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  }).toString();
  return await fetchWithAuth(`/api/geocode/reverse?${query}`, {
    method: 'GET',
  });
}
