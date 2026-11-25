/**
 * Tiện ích xử lý JWT token phía client:
 *  - Giải mã payload JWT và kiểm tra hết hạn (exp) an toàn.
 *  - Giữ tương thích với các mock token chuỗi đơn giản trong unit test.
 *  - Phát sự kiện đồng bộ khi backend trả 401 Unauthorized.
 */

export const AUTH_EXPIRED_EVENT = 'ecofind:auth-expired';

const AUTH_STORAGE_KEYS = ['token', 'access_token', 'auth_user', 'user'];

export function parseJwtPayload(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = atob(padded);
    const jsonStr = decodeURIComponent(
      decoded
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonStr);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Kiểm tra JWT đã hết hạn hay chưa.
 * Chỉ đánh dấu hết hạn nếu chuỗi là JWT chuẩn có claim `exp` dạng số.
 */
export function isTokenExpired(token, skewSeconds = 10) {
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') {
    return false;
  }
  return Date.now() >= payload.exp * 1000 - skewSeconds * 1000;
}

/**
 * Trả về số mili-giây còn lại trước khi token hết hạn (hoặc null nếu không có exp).
 */
export function getRemainingTokenMs(token, skewSeconds = 10) {
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') {
    return null;
  }
  return payload.exp * 1000 - skewSeconds * 1000 - Date.now();
}

/**
 * Xóa toàn bộ thông tin phiên đăng nhập khỏi localStorage.
 */
export function clearStoredAuth() {
  if (typeof localStorage === 'undefined') return;
  AUTH_STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key);
  });
}

/**
 * Phát sự kiện để AuthContext đồng bộ đăng xuất và chuyển hướng về /login.
 */
export function emitAuthExpired(detail = {}) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail }));
}
