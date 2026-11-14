/**
 * Listings API Service
 * UC-02, UC-03, UC-04, FR-03, FR-07
 */

import { fetchWithAuth } from './client';

export async function getListingsMapApi({
  bbox,
  q,
  categoryId,
  minScore,
  district,
  lat,
  lng,
  radius,
  sort,
  limit = 50,
} = {}) {
  const params = new URLSearchParams();
  if (bbox) params.append('bbox', bbox);
  if (q) params.append('q', q);
  if (categoryId) params.append('category_id', String(categoryId));
  if (minScore !== undefined && minScore !== null && minScore !== '') {
    params.append('min_score', String(minScore));
  }
  if (district) params.append('district', district);
  if (lat !== undefined && lat !== null && lat !== '') params.append('lat', String(lat));
  if (lng !== undefined && lng !== null && lng !== '') params.append('lng', String(lng));
  if (radius) params.append('radius', String(radius));
  if (sort) params.append('sort', sort);
  if (limit) params.append('limit', String(limit));

  const query = params.toString();
  const endpoint = `/api/listings${query ? `?${query}` : ''}`;
  return await fetchWithAuth(endpoint, { method: 'GET' });
}

export const getMapListings = async (bbox) => {
  return await getListingsMapApi({ bbox });
};

export async function getListingDetailApi(id) {
  return await fetchWithAuth(`/api/listings/${id}`, { method: 'GET' });
}

export async function uploadPhotosApi(files) {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });
  return await fetchWithAuth('/api/upload/images', {
    method: 'POST',
    body: formData,
  });
}
