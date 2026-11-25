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
 * Lấy thông tin chi tiết một tin đăng (TE9C747, FR-13)
 * @param {number|string} id
 */
export async function getAdminListingDetailApi(id) {
  return await fetchWithAuth(`/api/admin/listings/${id}`, {
    method: 'GET',
  });
}

/**
 * Duyệt tin đăng và điều chỉnh hạ điểm nếu có (TE9C748, TE9C74B, FR-14)
 */
export async function approveListingApi(id, { adjustments, note } = {}) {
  return await fetchWithAuth(`/api/admin/listings/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ adjustments, note }),
  });
}

/**
 * Từ chối tin đăng kèm lý do bắt buộc (TE9C749, TE9C74B, FR-14)
 */
export async function rejectListingApi(id, { reason }) {
  return await fetchWithAuth(`/api/admin/listings/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/**
 * Admin ẩn trực tiếp tin đăng vi phạm khỏi bản đồ
 */
export async function hideAdminListingApi(id, { reason } = {}) {
  return await fetchWithAuth(`/api/admin/listings/${id}/hide`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || null }),
  });
}

/**
 * Admin khôi phục tin đăng đang ẩn về lại Đang bán
 */
export async function restoreAdminListingApi(id) {
  return await fetchWithAuth(`/api/admin/listings/${id}/restore`, {
    method: 'POST',
  });
}

/**
 * Lấy số liệu thống kê KPI và phân bổ danh mục toàn sàn cho Admin Dashboard
 */
export async function getAdminStatsApi() {
  return await fetchWithAuth('/api/admin/stats', {
    method: 'GET',
  });
}

/**
 * Lấy danh sách báo cáo vi phạm (new | resolved)
 */
export async function getAdminReportsApi({ status = 'new' } = {}) {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  const query = params.toString();
  return await fetchWithAuth(`/api/admin/reports${query ? `?${query}` : ''}`, {
    method: 'GET',
  });
}

/**
 * Xử lý báo cáo vi phạm: action = 'hide' hoặc 'dismiss' (TE9C755, UC-09, FR-15)
 */
export async function resolveAdminReportApi(id, { action }) {
  return await fetchWithAuth(`/api/admin/reports/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

/**
 * Lấy danh sách tài khoản thành viên kèm thống kê tin/báo cáo
 */
export async function getAdminUsersApi() {
  return await fetchWithAuth('/api/admin/users', {
    method: 'GET',
  });
}

/**
 * Khóa tài khoản thành viên theo thời hạn (giờ)
 */
export async function lockAdminUserApi(userId, { durationHours }) {
  return await fetchWithAuth(`/api/admin/users/${userId}/lock`, {
    method: 'POST',
    body: JSON.stringify({ durationHours }),
  });
}

/**
 * Mở khóa tài khoản thành viên
 */
export async function unlockAdminUserApi(userId) {
  return await fetchWithAuth(`/api/admin/users/${userId}/unlock`, {
    method: 'POST',
  });
}
