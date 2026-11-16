/**
 * Tests for MyListingsPage (UC-06, E6, FR-10, TE9C74C, TE9C74D, TE9C74F, SDD 4.2).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MyListingsPage from '../pages/MyListingsPage';
import * as listingsApi from '../api/listings';
import * as categoriesApi from '../api/categories';

vi.mock('../api/listings', () => ({
  getMyListingsApi: vi.fn(),
  updateListingApi: vi.fn(),
  updateListingStatusApi: vi.fn(),
}));

vi.mock('../api/categories', () => ({
  getCategoriesApi: vi.fn(),
}));

const mockCategories = [
  { id: 1, name: 'Đồ điện tử' },
  { id: 2, name: 'Đồ gia dụng' },
];

const mockListings = [
  {
    id: 101,
    title: 'Nồi cơm điện Cuckoo cũ',
    price: 350000,
    address: '123 Lê Lợi, Q.1',
    categoryId: 2,
    categoryName: 'Đồ gia dụng',
    status: 'selling',
    hidden_by_admin: false,
    scoreAppearance: 8.0,
    scoreFunction: 9.0,
    scoreAccessories: 8.0,
    totalScore: 8.4,
    rank: 'Tốt',
    photos: [{ id: 1, url: 'https://img.ecofind.vn/cuckoo.jpg', sort_order: 0 }],
  },
  {
    id: 102,
    title: 'Bàn phím cơ hỏng LED',
    price: 150000,
    address: '456 Hai Bà Trưng, Q.3',
    categoryId: 1,
    categoryName: 'Đồ điện tử',
    status: 'rejected',
    rejectReason: 'Ảnh sản phẩm mờ, không chụp rõ vết trầy xước',
    hidden_by_admin: false,
    scoreAppearance: 6.0,
    scoreFunction: 7.0,
    scoreAccessories: 5.0,
    totalScore: 6.2,
    rank: 'Khá',
    photos: [],
  },
  {
    id: 103,
    title: 'Điện thoại xách tay',
    price: 2000000,
    address: '789 Nguyễn Huệ, Q.1',
    categoryId: 1,
    categoryName: 'Đồ điện tử',
    status: 'hidden',
    hidden_by_admin: true,
    scoreAppearance: 7.0,
    scoreFunction: 8.0,
    scoreAccessories: 7.0,
    totalScore: 7.4,
    rank: 'Tốt',
    photos: [],
  },
  {
    id: 104,
    title: 'Ghế xoay văn phòng',
    price: 0,
    address: '102 Điện Biên Phủ, Bình Thạnh',
    categoryId: 2,
    categoryName: 'Đồ gia dụng',
    status: 'pending',
    hidden_by_admin: false,
    scoreAppearance: 8.0,
    scoreFunction: 8.0,
    scoreAccessories: 8.0,
    totalScore: 8.0,
    rank: 'Tốt',
    photos: [],
  },
];

describe('MyListingsPage Component (TE9C74F, UC-06, FR-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    categoriesApi.getCategoriesApi.mockResolvedValue(mockCategories);
    listingsApi.getMyListingsApi.mockResolvedValue(mockListings);
    listingsApi.updateListingStatusApi.mockResolvedValue({ success: true });
    listingsApi.updateListingApi.mockResolvedValue({
      id: 101,
      status: 'pending',
      title: 'Nồi cơm điện Cuckoo cũ đã sửa',
    });
  });

  it('1. Hiển thị 5 tabs trạng thái và gọi API lấy danh sách tin', async () => {
    render(
      <MemoryRouter>
        <MyListingsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('tab-all')).toBeInTheDocument();
    expect(screen.getByTestId('tab-pending')).toBeInTheDocument();
    expect(screen.getByTestId('tab-selling')).toBeInTheDocument();
    expect(screen.getByTestId('tab-rejected')).toBeInTheDocument();
    expect(screen.getByTestId('tab-sold')).toBeInTheDocument();
    expect(screen.getByTestId('tab-hidden')).toBeInTheDocument();

    await waitFor(() => {
      expect(listingsApi.getMyListingsApi).toHaveBeenCalled();
      expect(screen.getByText('Nồi cơm điện Cuckoo cũ')).toBeInTheDocument();
    });
  });

  it('2. Tin bị từ chối hiển thị lý do từ chối và nút Sửa & Gửi lại', async () => {
    render(
      <MemoryRouter>
        <MyListingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Bàn phím cơ hỏng LED')).toBeInTheDocument();
    });

    const rejectBox = screen.getByTestId('reject-reason-box');
    expect(rejectBox).toHaveTextContent('Ảnh sản phẩm mờ, không chụp rõ vết trầy xước');
    expect(screen.getByTestId('btn-resubmit-102')).toBeInTheDocument();
  });

  it('3. Tin do Admin ẩn hiển thị nhãn cảnh báo và KHÔNG có nút Hiện lại', async () => {
    render(
      <MemoryRouter>
        <MyListingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Điện thoại xách tay')).toBeInTheDocument();
    });

    expect(screen.getByTestId('admin-hidden-badge')).toHaveTextContent('Bị Admin ẩn do vi phạm');
    expect(screen.queryByTestId('btn-unhide-103')).not.toBeInTheDocument();
  });

  it('4. Thao tác Ẩn tin gọi updateListingStatusApi và hiển thị thông báo thành công', async () => {
    render(
      <MemoryRouter>
        <MyListingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('btn-hide-101')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-hide-101'));

    await waitFor(() => {
      expect(listingsApi.updateListingStatusApi).toHaveBeenCalledWith(101, 'hidden');
      expect(screen.getByTestId('success-toast')).toHaveTextContent('Đã ẩn tin đăng thành công');
    });
  });

  it('5. Mở form sửa tin, hiển thị cảnh báo duyệt lại và gửi cập nhật thành công', async () => {
    render(
      <MemoryRouter>
        <MyListingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('btn-edit-101')).toBeInTheDocument();
    });

    // Mở modal sửa
    fireEvent.click(screen.getByTestId('btn-edit-101'));

    expect(screen.getByTestId('edit-listing-modal')).toBeInTheDocument();
    expect(screen.getByTestId('edit-warning-banner')).toHaveTextContent(
      'Sửa điểm tình trạng hoặc ảnh sản phẩm sẽ khiến tin chuyển về trạng thái Chờ duyệt'
    );

    // Lưu thay đổi
    fireEvent.click(screen.getByTestId('btn-save-edit'));

    await waitFor(() => {
      expect(listingsApi.updateListingApi).toHaveBeenCalledWith(
        101,
        expect.objectContaining({
          title: 'Nồi cơm điện Cuckoo cũ',
          price: 350000,
        })
      );
      expect(screen.getByTestId('success-toast')).toBeInTheDocument();
    });
  });
});
