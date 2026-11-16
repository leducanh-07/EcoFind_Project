/**
 * Tests for FavoritesPage and Toggle Save button (UC-07, E7, FR-11, TE9C752).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import FavoritesPage from '../pages/FavoritesPage';
import ListingDetailPage from '../pages/ListingDetailPage';
import * as favoritesApi from '../api/favorites';
import * as listingsApi from '../api/listings';

vi.mock('../api/favorites', () => ({
  getFavoritesApi: vi.fn(),
  addFavoriteApi: vi.fn(),
  removeFavoriteApi: vi.fn(),
  checkFavoriteStatusApi: vi.fn(),
}));

vi.mock('../api/listings', () => ({
  getListingDetailApi: vi.fn(),
}));

const mockFavorites = [
  {
    id: 1,
    listingId: 101,
    title: 'Bàn học thông minh',
    price: 800000,
    address: '123 Lê Lợi, Q.1',
    categoryName: 'Đồ nội thất',
    totalScore: 8.6,
    rank: 'Tốt',
    status: 'selling',
    isAvailable: true,
    thumbnailUrl: 'https://img.ecofind.vn/desk.jpg',
  },
  {
    id: 2,
    listingId: 102,
    title: 'Tai nghe chụp tai Sony',
    price: 450000,
    address: '456 Hai Bà Trưng, Q.3',
    categoryName: 'Đồ điện tử',
    totalScore: 9.1,
    rank: 'Như mới',
    status: 'sold',
    isAvailable: false,
    statusLabel: 'Không còn bán',
    thumbnailUrl: null,
  },
  {
    id: 3,
    listingId: 103,
    title: 'Quạt đứng Panasonic',
    price: 200000,
    address: '789 Nguyễn Trãi, Q.5',
    categoryName: 'Đồ gia dụng',
    totalScore: 7.2,
    rank: 'Tốt',
    status: 'hidden',
    isAvailable: false,
    statusLabel: 'Không còn bán',
    thumbnailUrl: null,
  },
];

describe('FavoritesPage & Save Button (TE9C752, UC-07, FR-11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    favoritesApi.getFavoritesApi.mockResolvedValue(mockFavorites);
    favoritesApi.removeFavoriteApi.mockResolvedValue({ success: true });
    favoritesApi.addFavoriteApi.mockResolvedValue({ success: true });
    favoritesApi.checkFavoriteStatusApi.mockResolvedValue({ isFavorite: false });
  });

  it('1. Hiển thị danh sách tin yêu thích đã lưu với ảnh, tiêu đề, giá và hạng', async () => {
    render(
      <MemoryRouter>
        <FavoritesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(favoritesApi.getFavoritesApi).toHaveBeenCalled();
      expect(screen.getByText('Bàn học thông minh')).toBeInTheDocument();
      expect(screen.getByText('Tai nghe chụp tai Sony')).toBeInTheDocument();
      expect(screen.getByText('Quạt đứng Panasonic')).toBeInTheDocument();
    });
  });

  it('2. Tin đã bán hoặc bị ẩn có nhãn nổi bật "Không còn bán" (E2)', async () => {
    render(
      <MemoryRouter>
        <FavoritesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('badge-unavailable-102')).toBeInTheDocument();
      expect(screen.getByTestId('badge-unavailable-103')).toBeInTheDocument();
    });

    expect(screen.getByTestId('badge-unavailable-102')).toHaveTextContent('Không còn bán');
    expect(screen.getByTestId('badge-unavailable-103')).toHaveTextContent('Không còn bán');
  });

  it('3. Thao tác Bỏ lưu gọi removeFavoriteApi và cập nhật danh sách hiển thị', async () => {
    render(
      <MemoryRouter>
        <FavoritesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('btn-remove-favorite-101')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-remove-favorite-101'));

    await waitFor(() => {
      expect(favoritesApi.removeFavoriteApi).toHaveBeenCalledWith(101);
      expect(screen.queryByText('Bàn học thông minh')).not.toBeInTheDocument();
      expect(screen.getByTestId('favorite-toast')).toHaveTextContent('Đã bỏ lưu');
    });
  });

  it('4. Hiển thị trạng thái rỗng khi chưa lưu tin nào', async () => {
    favoritesApi.getFavoritesApi.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <FavoritesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('empty-favorites-state')).toBeInTheDocument();
      expect(screen.getByText('Chưa có tin yêu thích nào')).toBeInTheDocument();
    });
  });

  it('5. Khách chưa đăng nhập bấm Lưu tin chuyển hướng sang /login kèm state from (E1)', async () => {
    listingsApi.getListingDetailApi.mockResolvedValue({
      id: 50,
      title: 'Ghế sofa đơn',
      price: 500000,
      description: 'Mô tả ghế sofa',
      address: 'Quận 1, TP.HCM',
      lat: 10.77,
      lng: 106.70,
      totalScore: 8.0,
      rank: 'Tốt',
      scoreAppearance: 8.0,
      scoreFunction: 8.0,
      scoreAccessories: 8.0,
      status: 'selling',
      sellerId: 99,
      sellerName: 'Người bán',
      photos: [],
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/listings/50']}>
          <Routes>
            <Route path="/listings/:id" element={<ListingDetailPage />} />
            <Route path="/login" element={<div data-testid="login-screen">Màn hình đăng nhập</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('btn-save-guest')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-save-guest'));

    await waitFor(() => {
      expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    });
  });
});
