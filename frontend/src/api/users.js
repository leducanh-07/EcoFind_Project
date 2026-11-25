/**
 * User Profile, Password Security & Public Seller Profile API Service
 */

import { fetchWithAuth } from './client';

export async function getMyProfileApi() {
  return await fetchWithAuth('/api/me/profile', {
    method: 'GET',
  });
}

export async function updateMyProfileApi({ fullName, phone }) {
  return await fetchWithAuth('/api/me/profile', {
    method: 'PUT',
    body: JSON.stringify({ fullName, phone }),
  });
}

export async function changeMyPasswordApi({ currentPassword, newPassword, confirmPassword }) {
  return await fetchWithAuth('/api/me/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
  });
}

export async function getSellerProfileApi(userId) {
  return await fetchWithAuth(`/api/users/${userId}/profile`, {
    method: 'GET',
  });
}
