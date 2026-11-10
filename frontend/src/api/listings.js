/**
 * Listings API Service
 * UC-02, UC-03, UC-04, FR-03, FR-07
 */

import { fetchWithAuth } from './client';

export async function getListingsMapApi({ bbox, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (bbox) params.append('bbox', bbox);
  if (limit) params.append('limit', String(limit));

  const query = params.toString();
  const endpoint = `/api/listings${query ? `?${query}` : ''}`;
  return await fetchWithAuth(endpoint, { method: 'GET' });
}

export async function getListingDetailApi(id) {
  return await fetchWithAuth(`/api/listings/${id}`, { method: 'GET' });
}
