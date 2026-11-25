import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get, post, put, del, fetchWithAuth, resolveUrl, ApiError } from '../api/client';
import { AUTH_EXPIRED_EVENT } from '../utils/authToken';

describe('API Client Layer (src/api/client.js)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('attaches Authorization header when token is present', async () => {
    localStorage.setItem('token', 'mock_jwt_token_123');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    const res = await get('/test');
    expect(res).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock_jwt_token_123',
        }),
      })
    );
  });

  it('handles 401 response and clears token and emits auth expired event', async () => {
    localStorage.setItem('token', 'expired_token');
    const expiredListener = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, expiredListener);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Unauthorized' } }),
    });

    await expect(get('/protected')).rejects.toThrow(ApiError);
    expect(localStorage.getItem('token')).toBeNull();
    expect(expiredListener).toHaveBeenCalledTimes(1);
    expect(expiredListener.mock.calls[0][0].detail).toEqual({
      reason: 'expired',
      endpoint: '/protected',
    });

    window.removeEventListener(AUTH_EXPIRED_EVENT, expiredListener);
  });

  it('does not emit auth expired event when login credentials fail with 401', async () => {
    const expiredListener = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, expiredListener);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Sai mật khẩu' } }),
    });

    await expect(post('/api/auth/login', { email: 'a@b.vn', password: 'wrong' })).rejects.toThrow(ApiError);
    expect(expiredListener).not.toHaveBeenCalled();

    window.removeEventListener(AUTH_EXPIRED_EVENT, expiredListener);
  });

  it('exports helper methods: get, post, put, del', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    await get('/endpoint');
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ method: 'GET' })
    );

    await post('/endpoint', { name: 'test' });
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      })
    );

    await put('/endpoint', { name: 'updated' });
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'updated' }),
      })
    );

    await del('/endpoint');
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('resolves API endpoints correctly ensuring /api prefix matches backend router', () => {
    // Both /api/auth/login and /auth/login resolve to URL with /api/auth/login
    const url1 = resolveUrl('/api/auth/login');
    const url2 = resolveUrl('/auth/login');
    const url3 = resolveUrl('auth/login');

    expect(url1).toBe('http://localhost:8000/api/auth/login');
    expect(url2).toBe('http://localhost:8000/api/auth/login');
    expect(url3).toBe('http://localhost:8000/api/auth/login');

    // Absolute URLs remain untouched
    expect(resolveUrl('https://example.com/api/test')).toBe('https://example.com/api/test');
  });
});
