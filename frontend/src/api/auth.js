/**
 * Authentication API Service
 * UC-01, FR-01, FR-02
 * Endpoints matched with FastAPI Backend (app/routers/auth.py at /api/auth)
 */

import { fetchWithAuth } from './client';

export async function loginApi(email, password) {
  return await fetchWithAuth('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function registerApi({ fullName, email, phone, password }) {
  return await fetchWithAuth('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName,
      email,
      phone,
      password,
    }),
  });
}
