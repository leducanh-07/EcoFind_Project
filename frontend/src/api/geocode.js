/**
 * Geocoding API Service
 * UC-05, FR-08
 */

import { fetchWithAuth } from './client';

/**
 * Tra cứu tọa độ (lat, lng) từ địa chỉ văn bản
 * @param {string} address - Địa chỉ cần tra cứu
 * @returns {Promise<{ lat: number, lng: number }>}
 */
export async function geocodeAddressApi(address) {
  if (!address || !address.trim()) {
    throw new Error('Vui lòng nhập địa chỉ cần tìm kiếm.');
  }

  const query = new URLSearchParams({ address: address.trim() }).toString();
  return await fetchWithAuth(`/api/geocode?${query}`, {
    method: 'GET',
  });
}
