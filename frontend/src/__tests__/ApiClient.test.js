import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get, post, put, del, fetchWithAuth, ApiError } from '../api/client';

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

  it('handles 401 response and clears token', async () => {
    localStorage.setItem('token', 'expired_token');

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Unauthorized' } }),
    });

    await expect(get('/protected')).rejects.toThrow(ApiError);
    expect(localStorage.getItem('token')).toBeNull();
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
});
