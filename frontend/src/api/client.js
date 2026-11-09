/**
 * EcoFind Unified API Client
 * SDD 7.1, 7.2: Unified API client with JWT Bearer auth, standardized error formatting,
 * and HTTP helper methods (get, post, put, delete).
 */

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:8000';

export class ApiError extends Error {
  constructor(message, status = 400, code = 400, fields = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields || {};
  }
}

export async function fetchWithAuth(endpoint, options = {}) {
  // Read token from localStorage (support both 'token' and 'access_token')
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If body is FormData, delete Content-Type so browser sets boundary
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 Unauthorized: clear stored token
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
    }

    // 204 No Content
    if (response.status === 204) {
      return null;
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorObj = data?.error || {};
      const message =
        errorObj.message ||
        data?.detail ||
        `Request failed with status ${response.status}`;
      const code = errorObj.code || response.status;
      const fields = errorObj.fields || null;

      throw new ApiError(message, response.status, code, fields);
    }

    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    // Network or other unexpected error
    throw new ApiError(
      err.message || 'Cannot connect to server. Please try again!',
      0,
      'NETWORK_ERROR'
    );
  }
}

// Export get/post/put/delete helpers
export async function get(endpoint, options = {}) {
  return fetchWithAuth(endpoint, { ...options, method: 'GET' });
}

export async function post(endpoint, body = {}, options = {}) {
  return fetchWithAuth(endpoint, {
    ...options,
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

export async function put(endpoint, body = {}, options = {}) {
  return fetchWithAuth(endpoint, {
    ...options,
    method: 'PUT',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

export async function del(endpoint, options = {}) {
  return fetchWithAuth(endpoint, { ...options, method: 'DELETE' });
}

// Export alias for 'delete'
export { del as delete };
