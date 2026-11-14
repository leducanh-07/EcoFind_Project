/**
 * EcoFind Unified API Client
 * SDD 7.1, 7.2: Unified API client with JWT Bearer auth, standardized error formatting,
 * and HTTP helper methods (get, post, put, delete).
 */

const RAW_API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:8000';

export function resolveUrl(endpoint) {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  const base = RAW_API_BASE_URL.replace(/\/+$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (base.endsWith('/api')) {
    if (path.startsWith('/api/')) {
      return `${base}${path.slice(4)}`;
    }
    return `${base}${path}`;
  }

  if (!path.startsWith('/api/') && path !== '/api') {
    return `${base}/api${path}`;
  }

  return `${base}${path}`;
}

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

  const url = resolveUrl(endpoint);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // 204 No Content
    if (response.status === 204) {
      return null;
    }

    const data = await response.json().catch(() => null);

    // Handle 401 Unauthorized: clear stored tokens
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('user');
    }

    if (!response.ok) {
      const errorObj = data?.error || {};
      let fields = errorObj.fields || data?.fields || null;
      let message =
        errorObj.message ||
        (typeof data?.detail === 'string' ? data.detail : null) ||
        `Request failed with status ${response.status}`;

      if (Array.isArray(data?.detail)) {
        if (!fields) fields = {};
        data.detail.forEach((errItem) => {
          const loc = errItem.loc || [];
          const fieldName = loc.length > 0 ? String(loc[loc.length - 1]) : 'general';
          if (!fields[fieldName]) {
            fields[fieldName] = errItem.msg;
          }
        });
        message = data.detail.map((d) => d.msg).join(', ');
      }

      const code = errorObj.code || response.status;
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
