import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';
import * as adminApi from '../api/admin';
import * as authContext from '../context/AuthContext';

const mockAdminUser = {
  id: 1,
  fullName: 'Admin Quản Trị',
  email: 'admin@ecofind.vn',
  role: 'admin',
};

const mockPendingListings = [
  {
    id: 101,
    title: 'Bàn ghế học sinh gỗ thông',
    price: 350000,
    category_id: 1,
    categoryName: 'Nội thất',
    sellerId: 2,
    sellerName: 'Nguyễn Văn Bán',
    sellerEmail: 'seller1@ecofind.vn',
    sellerPhone: '0901234567',
    scoreAppearance: 8.5,
    scoreFunction: 9.0,
    scoreAccessories: 8.0,
    totalScore: 8.6,
    rank: 'Tốt',
    status: 'pending',
    address: '123 Lê Lợi, Q.1, TP.HCM',
    thumbnailUrl: '/uploads/table.jpg',
    photos: [{ id: 1, url: '/uploads/table.jpg', sort_order: 0 }],
    createdAt: '2026-11-15T10:00:00Z',
  },
  {
    id: 102,
    title: 'Quạt đứng Panasonic cũ',
    price: 0,
    category_id: 2,
    categoryName: 'Đồ điện tử',
    sellerId: 3,
    sellerName: 'Trần Thị Cho',
    sellerEmail: 'cho@ecofind.vn',
    sellerPhone: '0987654321',
    scoreAppearance: 6.0,
    scoreFunction: 7.0,
    scoreAccessories: 5.0,
    totalScore: 6.2,
    rank: 'Khá',
    status: 'pending',
    address: '456 Hai Bà Trưng, Q.3, TP.HCM',
    thumbnailUrl: '/uploads/fan.jpg',
    photos: [{ id: 2, url: '/uploads/fan.jpg', sort_order: 0 }],
    createdAt: '2026-11-15T11:00:00Z',
  },
];

const mockDetail101 = {
  id: 101,
  title: 'Bàn ghế học sinh gỗ thông',
  description: 'Bàn ghế còn chắc chắn, mặt bàn hơi xước dăm nhẹ, tặng kèm đệm ngồi.',
  price: 350000,
  address: '123 Lê Lợi, Q.1, TP.HCM',
  lat: 10.7725,
  lng: 106.6980,
  category_id: 1,
  categoryName: 'Nội thất',
  seller: {
    userId: 2,
    fullName: 'Nguyễn Văn Bán',
    email: 'seller1@ecofind.vn',
    phone: '0901234567',
  },
  scoreAppearance: 8.5,
  scoreFunction: 9.0,
  scoreAccessories: 8.0,
  totalScore: 8.6,
  rank: 'Tốt',
  status: 'pending',
  photos: [
    { id: 1, url: '/uploads/table1.jpg', sort_order: 0 },
    { id: 2, url: '/uploads/table2.jpg', sort_order: 1 },
  ],
  createdAt: '2026-11-15T10:00:00Z',
};

describe('TE9C74A: Giao diện Admin – danh sách chờ duyệt & chi tiết tin (UC-09, FR-13)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: mockAdminUser,
      isAuthenticated: true,
      isAdmin: true,
      loading: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('1. Hiển thị tiêu đề, tabs và tải danh sách tin chờ duyệt từ API', async () => {
    const mockGetListings = vi.spyOn(adminApi, 'getAdminListingsApi').mockResolvedValue(mockPendingListings);

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    // Tiêu đề trang
    expect(screen.getByTestId('admin-page-title')).toHaveTextContent(/Bảng điều khiển Quản trị viên/i);

    // Đợi tải xong
    await waitFor(() => {
      expect(mockGetListings).toHaveBeenCalledWith({ status: 'pending', sort: 'asc' });
    });

    // Huy hiệu số tin chờ duyệt
    const badge = await screen.findByTestId('pending-count-badge');
    expect(badge).toHaveTextContent('2');

    // Bảng danh sách tin
    expect(screen.getByTestId('admin-listings-table')).toBeInTheDocument();
    expect(screen.getByText('Bàn ghế học sinh gỗ thông')).toBeInTheDocument();
    expect(screen.getByText('Quạt đứng Panasonic cũ')).toBeInTheDocument();
    expect(screen.getByText('350.000 đ')).toBeInTheDocument();
    expect(screen.getByText('Cho tặng')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn Bán')).toBeInTheDocument();
    expect(screen.getByText('8.6')).toBeInTheDocument();
    expect(screen.getByText('6.2')).toBeInTheDocument();
  });

  it('2. Hiển thị trạng thái rỗng khi hàng đợi không có tin nào chờ duyệt', async () => {
    vi.spyOn(adminApi, 'getAdminListingsApi').mockResolvedValue([]);

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    const emptyBox = await screen.findByTestId('admin-empty-state');
    expect(emptyBox).toBeInTheDocument();
    expect(emptyBox).toHaveTextContent(/Không có tin đăng nào đang chờ duyệt/i);
  });

  it('3. Bấm "Chi tiết" mở modal hiển thị đầy đủ thông tin tin đăng, người bán, ảnh và 3 điểm thành phần', async () => {
    vi.spyOn(adminApi, 'getAdminListingsApi').mockResolvedValue(mockPendingListings);
    const mockGetDetail = vi.spyOn(adminApi, 'getAdminListingDetailApi').mockResolvedValue(mockDetail101);

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await screen.findByText('Bàn ghế học sinh gỗ thông');

    // Bấm nút Chi tiết của tin 101
    const detailBtn = screen.getByTestId('open-detail-btn-101');
    fireEvent.click(detailBtn);

    // Đợi modal hiển thị
    const modal = await screen.findByTestId('admin-listing-modal');
    expect(modal).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetDetail).toHaveBeenCalledWith(101);
    });

    // Kiểm tra thông tin hiển thị trong modal
    expect(screen.getByTestId('modal-listing-title')).toHaveTextContent('Bàn ghế học sinh gỗ thông');
    expect(screen.getByTestId('modal-listing-price')).toHaveTextContent('350.000 đ');
    expect(screen.getByTestId('modal-category-name')).toHaveTextContent('Nội thất');
    expect(screen.getByTestId('modal-address')).toHaveTextContent('123 Lê Lợi, Q.1, TP.HCM');

    // Thông tin người bán
    expect(screen.getByTestId('modal-seller-name')).toHaveTextContent('Nguyễn Văn Bán');
    expect(screen.getByTestId('modal-seller-email')).toHaveTextContent('seller1@ecofind.vn');
    expect(screen.getByTestId('modal-seller-phone')).toHaveTextContent('0901234567');

    // Mô tả chi tiết
    expect(screen.getByTestId('modal-description')).toHaveTextContent('Bàn ghế còn chắc chắn, mặt bàn hơi xước dăm nhẹ');

    // 3 điểm thành phần tự chấm và điểm tổng / phân hạng
    expect(screen.getByTestId('modal-score-appearance')).toHaveTextContent('8.5');
    expect(screen.getByTestId('modal-score-function')).toHaveTextContent('9.0');
    expect(screen.getByTestId('modal-score-accessories')).toHaveTextContent('8.0');
    expect(screen.getByTestId('modal-total-score')).toHaveTextContent('8.6');
    expect(screen.getByTestId('modal-rank-badge')).toHaveTextContent('Tốt');

    // Đóng modal
    const closeBtn = screen.getByTestId('close-modal-btn');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('admin-listing-modal')).not.toBeInTheDocument();
    });
  });

  it('4. Chuyển tab giữa Chờ duyệt, Đang bán, Đã từ chối gọi API với status tương ứng', async () => {
    const mockGetListings = vi.spyOn(adminApi, 'getAdminListingsApi').mockResolvedValue([]);

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetListings).toHaveBeenCalledWith({ status: 'pending', sort: 'asc' });
    });

    // Chuyển sang tab Đang bán
    const sellingTab = screen.getByTestId('tab-selling');
    fireEvent.click(sellingTab);

    await waitFor(() => {
      expect(mockGetListings).toHaveBeenCalledWith({ status: 'selling', sort: 'desc' });
    });

    // Chuyển sang tab Đã từ chối
    const rejectedTab = screen.getByTestId('tab-rejected');
    fireEvent.click(rejectedTab);

    await waitFor(() => {
      expect(mockGetListings).toHaveBeenCalledWith({ status: 'rejected', sort: 'desc' });
    });
  });

  it('5. Hiển thị banner lỗi khi API bị lỗi và nút Thử lại', async () => {
    const mockGetListings = vi.spyOn(adminApi, 'getAdminListingsApi').mockRejectedValueOnce(
      new Error('Mất kết nối máy chủ')
    );

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    const errorBanner = await screen.findByTestId('admin-error-banner');
    expect(errorBanner).toBeInTheDocument();
    expect(errorBanner).toHaveTextContent(/Mất kết nối máy chủ/i);

    // Bấm Thử lại -> gọi lại API
    mockGetListings.mockResolvedValueOnce(mockPendingListings);
    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Bàn ghế học sinh gỗ thông')).toBeInTheDocument();
    });
  });
});
