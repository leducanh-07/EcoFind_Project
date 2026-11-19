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

/**
 * Tạo mới tin đăng bán đồ cũ (STT 31, 36, TE9C746, UC-05, FR-08, FR-09).
 * Gửi form multipart/form-data chứa thông tin tin đăng, ảnh và 3 điểm tình trạng.
 */
export async function createListingApi(formData) {
  return await fetchWithAuth('/api/listings', {
    method: 'POST',
    body: formData,
  });
}

/**
 * Lấy danh sách tin đăng của chính người dùng theo trạng thái (TE9C74C, UC-06, FR-10)
 * @param {Object} options
 * @param {string} [options.status] - pending, selling, rejected, sold, hidden
 */
export async function getMyListingsApi({ status } = {}) {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  const query = params.toString();
  return await fetchWithAuth(`/api/me/listings${query ? `?${query}` : ''}`, {
    method: 'GET',
  });
}

/**
 * Chỉnh sửa tin đăng của chính mình (TE9C74D, UC-06, FR-10)
 * @param {number|string} id - Listing ID
 * @param {Object} data - Các trường cần cập nhật
 */
export async function updateListingApi(id, data) {
  return await fetchWithAuth(`/api/listings/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Cập nhật trạng thái tin đăng: ẩn, hiện lại hoặc đánh dấu đã bán (TE9C74E, UC-06, FR-10, SDD 4.2)
 * @param {number|string} id - Mã tin đăng
 * @param {string} status - hidden, selling, sold
 */
export async function updateListingStatusApi(id, status) {
  return await fetchWithAuth(`/api/listings/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
}

/**
 * Gửi báo cáo tin đăng vi phạm (TE9C753, TE9C754, UC-08, FR-12, TC-09)
 * @param {number|string} id - Mã tin đăng
 * @param {Object} data
 * @param {string} data.reason - wrong_score, scam, prohibited, other
 * @param {string} [data.note] - Ghi chú tối đa 200 ký tự
 */
export async function reportListingApi(id, { reason, note } = {}) {
  return await fetchWithAuth(`/api/listings/${id}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason, note: note || null }),
  });
}


