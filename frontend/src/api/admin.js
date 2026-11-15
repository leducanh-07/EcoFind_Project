import { fetchWithAuth } from './client';

/**
 * Lấy danh sách tin đăng trong hàng đợi kiểm duyệt của Admin (TE9C747, FR-13)
 * @param {Object} options
 * @param {string} [options.status='pending']
 * @param {string} [options.sort='asc']
 */
export async function getAdminListingsApi({ status = 'pending', sort = 'asc' } = {}) {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (sort) params.append('sort', sort);

  const query = params.toString();
  return await fetchWithAuth(`/api/admin/listings${query ? `?${query}` : ''}`, {
    method: 'GET',
  });
}

/**
 * Lấy thông tin chi tiết một tin đăng chờ duyệt (TE9C747, FR-13)
 * @param {number|string} id
 */
export async function getAdminListingDetailApi(id) {
  return await fetchWithAuth(`/api/admin/listings/${id}`, {
    method: 'GET',
  });
}

/**
 * Duyệt tin đăng và điều chỉnh hạ điểm nếu có (TE9C748, TE9C74B, FR-14)
 * @param {number|string} id
 * @param {Object} payload
 * @param {Object} [payload.adjustments]
 * @param {string} [payload.note]
 */
export async function approveListingApi(id, { adjustments, note } = {}) {
  return await fetchWithAuth(`/api/admin/listings/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ adjustments, note }),
  });
}

/**
 * Từ chối tin đăng kèm lý do bắt buộc (TE9C749, TE9C74B, FR-14)
 * @param {number|string} id
 * @param {Object} payload
 * @param {string} payload.reason
 */
export async function rejectListingApi(id, { reason }) {
  return await fetchWithAuth(`/api/admin/listings/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
