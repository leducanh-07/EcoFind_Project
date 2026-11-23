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

const mockReportsList = [
  {
    id: 1,
    report_id: 1,
    listing_id: 101,
    listing_title: 'iPhone 11 Pro Max cũ pin 85%',
    listing_price: 6500000,
    listing_status: 'selling',
    listing_thumbnail: '/uploads/iphone.jpg',
    seller_id: 2,
    seller_name: 'Trần Văn Bán',
    reporter_id: 3,
    reporter_name: 'Nguyễn Tố Cáo',
    reporter_email: 'reporter@ecofind.vn',
    reason: 'wrong_score',
    reason_label: 'Sai điểm tình trạng',
    note: 'Người bán khai điểm ngoại hình 9.5 nhưng viền bị cấn móp nặng',
    status: 'new',
    created_at: '2026-11-20T10:00:00Z',
  },
  {
    id: 2,
    report_id: 2,
    listing_id: 102,
    listing_title: 'Bộ máy ảnh Canon lừa đảo cọc',
    listing_price: 3000000,
    listing_status: 'selling',
    listing_thumbnail: '/uploads/camera.jpg',
    seller_id: 4,
    seller_name: 'Lê Scam',
    reporter_id: 5,
    reporter_name: 'Phạm Nạn Nhân',
    reporter_email: 'victim@ecofind.vn',
    reason: 'scam',
    reason_label: 'Lừa đảo',
    note: 'Bắt chuyển cọc trước rồi chặn số liên lạc',
    status: 'new',
    created_at: '2026-11-21T14:30:00Z',
  },
];

describe('TE9C756: Giao diện Admin: tab Báo cáo (UC-09, FR-15)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: mockAdminUser,
      isAuthenticated: true,
      isAdmin: true,
    });
    vi.spyOn(adminApi, 'getAdminListingsApi').mockResolvedValue([]);
    vi.spyOn(adminApi, 'getAdminReportsApi').mockResolvedValue(mockReportsList);
    vi.spyOn(adminApi, 'resolveAdminReportApi').mockResolvedValue({
      report_id: 1,
      action: 'hide',
    });
    vi.spyOn(adminApi, 'getAdminListingDetailApi').mockResolvedValue({
      id: 101,
      title: 'iPhone 11 Pro Max cũ pin 85%',
      description: 'Mô tả chi tiết',
      price: 6500000,
      photos: [],
      scoreAppearance: 9.5,
      scoreFunction: 9.0,
      scoreAccessories: 8.0,
      totalScore: 9.0,
      rank: 'Như mới',
      seller: { fullName: 'Trần Văn Bán', email: 'seller@ecofind.vn', phone: '0901234567' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Hiển thị tab "Báo cáo vi phạm" và huy hiệu số lượng báo cáo mới', async () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    const tabReports = await screen.findByTestId('tab-reports');
    expect(tabReports).toBeInTheDocument();
    expect(tabReports).toHaveTextContent(/Báo cáo vi phạm/i);

    const badge = await screen.findByTestId('reports-count-badge');
    expect(badge).toHaveTextContent('2');
  });

  it('2. Chuyển sang tab Báo cáo hiển thị bảng danh sách các tin bị báo cáo vi phạm', async () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    const tabReports = await screen.findByTestId('tab-reports');
    fireEvent.click(tabReports);

    await waitFor(() => {
      expect(screen.getByTestId('admin-reports-table')).toBeInTheDocument();
    });

    // Kiểm tra dòng báo cáo 1
    expect(screen.getByText('iPhone 11 Pro Max cũ pin 85%')).toBeInTheDocument();
    expect(screen.getByText('Sai điểm tình trạng')).toBeInTheDocument();
    expect(screen.getByText(/Người bán khai điểm ngoại hình 9.5/i)).toBeInTheDocument();

    // Kiểm tra dòng báo cáo 2
    expect(screen.getByText('Bộ máy ảnh Canon lừa đảo cọc')).toBeInTheDocument();
    expect(screen.getByText('Lừa đảo')).toBeInTheDocument();
  });

  it('3. Bấm nút "Xem tin" mở modal chi tiết tin đăng bị báo cáo ở chế độ xem', async () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByTestId('tab-reports'));

    const btnView = await screen.findByTestId('btn-view-reported-listing-1');
    fireEvent.click(btnView);

    await waitFor(() => {
      expect(adminApi.getAdminListingDetailApi).toHaveBeenCalledWith(101);
    });
  });

  it('4. Bấm "Ẩn tin" hiển thị hộp thoại xác nhận và gọi API ẩn tin thành công', async () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByTestId('tab-reports'));

    const btnHide = await screen.findByTestId('btn-hide-reported-listing-1');
    fireEvent.click(btnHide);

    // Hộp thoại xác nhận xuất hiện
    expect(screen.getByText(/Xác nhận ẩn tin vi phạm/i)).toBeInTheDocument();
    const confirmBtn = screen.getByTestId('confirm-resolve-btn');
    expect(confirmBtn).toHaveTextContent(/Đồng ý ẩn tin/i);

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(adminApi.resolveAdminReportApi).toHaveBeenCalledWith(1, { action: 'hide' });
    });

    // Dòng báo cáo 1 bị xóa khỏi bảng và hiển thị toast
    await waitFor(() => {
      expect(screen.queryByTestId('report-row-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('admin-toast-message')).toHaveTextContent(/Đã ẩn tin vi phạm/i);
    });
  });

  it('5. Bấm "Bỏ qua" hiển thị hộp thoại xác nhận và gọi API bỏ qua báo cáo thành công', async () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByTestId('tab-reports'));

    const btnDismiss = await screen.findByTestId('btn-dismiss-report-2');
    fireEvent.click(btnDismiss);

    expect(screen.getByText(/Xác nhận bỏ qua báo cáo/i)).toBeInTheDocument();
    const confirmBtn = screen.getByTestId('confirm-resolve-btn');
    expect(confirmBtn).toHaveTextContent(/Đồng ý bỏ qua/i);

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(adminApi.resolveAdminReportApi).toHaveBeenCalledWith(2, { action: 'dismiss' });
    });

    await waitFor(() => {
      expect(screen.queryByTestId('report-row-2')).not.toBeInTheDocument();
      expect(screen.getByTestId('admin-toast-message')).toHaveTextContent(/Đã bỏ qua báo cáo/i);
    });
  });

  it('6. Hiển thị empty state khi không có báo cáo vi phạm nào', async () => {
    vi.spyOn(adminApi, 'getAdminReportsApi').mockResolvedValue([]);

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByTestId('tab-reports'));

    await waitFor(() => {
      expect(screen.getByTestId('admin-empty-state')).toBeInTheDocument();
      expect(screen.getByText(/Không có báo cáo vi phạm nào cần xử lý/i)).toBeInTheDocument();
    });
  });
});
