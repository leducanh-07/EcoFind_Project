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

const mockListing = {
  id: 201,
  title: 'Tủ sách gỗ ép 3 tầng',
  description: 'Tủ sách còn dùng tốt, có trầy nhẹ ở góc dưới bên trái.',
  price: 200000,
  category_id: 1,
  categoryName: 'Nội thất',
  seller: {
    userId: 5,
    fullName: 'Lê Hoàng Nam',
    email: 'nam@ecofind.vn',
    phone: '0912345678',
  },
  scoreAppearance: 8.0,
  scoreFunction: 9.0,
  scoreAccessories: 8.0,
  totalScore: 8.4,
  rank: 'Tốt',
  status: 'pending',
  photos: [{ id: 10, url: '/uploads/bookshelf.jpg', sort_order: 0 }],
  createdAt: '2026-11-15T09:00:00Z',
};

describe('TE9C74B: Giao diện Admin – duyệt / từ chối / hạ điểm (UC-09, FR-14, TC-11)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: mockAdminUser,
      isAuthenticated: true,
      isAdmin: true,
      loading: false,
    });
    vi.spyOn(adminApi, 'getAdminListingsApi').mockResolvedValue([mockListing]);
    vi.spyOn(adminApi, 'getAdminListingDetailApi').mockResolvedValue(mockListing);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('1. Duyệt tin thành công (Approve) không hạ điểm: gọi API approve, đóng modal và loại bỏ tin khỏi hàng đợi', async () => {
    const mockApprove = vi.spyOn(adminApi, 'approveListingApi').mockResolvedValue({
      id: 201,
      status: 'selling',
      totalScore: 8.4,
      rank: 'Tốt',
      message: 'Duyệt tin thành công',
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    // Mở chi tiết tin
    const detailBtn = await screen.findByTestId('open-detail-btn-201');
    fireEvent.click(detailBtn);

    // Đợi modal hiển thị
    await screen.findByTestId('admin-listing-modal');

    // Bấm nút Duyệt tin
    const approveBtn = screen.getByTestId('modal-approve-btn');
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(mockApprove).toHaveBeenCalledWith(201, {});
    });

    // Modal đóng lại
    await waitFor(() => {
      expect(screen.queryByTestId('admin-listing-modal')).not.toBeInTheDocument();
    });

    // Thông báo toast thành công
    const toast = await screen.findByTestId('admin-toast-message');
    expect(toast).toHaveTextContent(/Duyệt tin thành công/i);

    // Tin đã duyệt bị gỡ khỏi hàng đợi pending
    expect(screen.queryByTestId('admin-listing-row-201')).not.toBeInTheDocument();
  });

  it('2. Từ chối tin (Reject): bắt buộc nhập lý do (E1), gửi API reject và làm mới danh sách', async () => {
    const mockReject = vi.spyOn(adminApi, 'rejectListingApi').mockResolvedValue({
      id: 201,
      status: 'rejected',
      message: 'Đã từ chối tin đăng',
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    const detailBtn = await screen.findByTestId('open-detail-btn-201');
    fireEvent.click(detailBtn);

    await screen.findByTestId('admin-listing-modal');

    // Bấm nút Từ chối trong modal
    const rejectBtn = screen.getByTestId('modal-reject-btn');
    fireEvent.click(rejectBtn);

    // Form nhập lý do xuất hiện
    const rejectSection = await screen.findByTestId('reject-form-section');
    expect(rejectSection).toBeInTheDocument();

    const confirmRejectBtn = screen.getByTestId('confirm-reject-btn');

    // 1. Bấm xác nhận khi chưa nhập lý do -> Báo lỗi E1 (TC-11)
    fireEvent.click(confirmRejectBtn);

    const errorMsg = await screen.findByTestId('error-reject-reason');
    expect(errorMsg).toHaveTextContent(/Vui lòng nhập lý do từ chối/i);
    expect(mockReject).not.toHaveBeenCalled();

    // 2. Nhập lý do từ chối hợp lệ
    const reasonInput = screen.getByTestId('reject-reason-input');
    fireEvent.change(reasonInput, {
      target: { value: 'Hình ảnh không rõ món đồ, vui lòng chụp ảnh thực tế đầy đủ' },
    });

    fireEvent.click(confirmRejectBtn);

    await waitFor(() => {
      expect(mockReject).toHaveBeenCalledWith(201, {
        reason: 'Hình ảnh không rõ món đồ, vui lòng chụp ảnh thực tế đầy đủ',
      });
    });

    // Modal đóng lại
    await waitFor(() => {
      expect(screen.queryByTestId('admin-listing-modal')).not.toBeInTheDocument();
    });

    // Toast thông báo từ chối
    const toast = await screen.findByTestId('admin-toast-message');
    expect(toast).toHaveTextContent(/Đã từ chối tin đăng/i);
  });

  it('3. Hạ điểm thành phần: hiển thị điểm tổng mới dự kiến, chỉ cho phép hạ điểm và gửi adjustments kèm ghi chú', async () => {
    const mockApprove = vi.spyOn(adminApi, 'approveListingApi').mockResolvedValue({
      id: 201,
      status: 'selling',
      totalScore: 5.6,
      rank: 'Khá',
      message: 'Duyệt tin thành công kèm hạ điểm',
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    const detailBtn = await screen.findByTestId('open-detail-btn-201');
    fireEvent.click(detailBtn);

    await screen.findByTestId('admin-listing-modal');

    // Bật checkbox hạ điểm
    const toggleAdjust = screen.getByTestId('toggle-adjust-score');
    fireEvent.click(toggleAdjust);

    const appInput = screen.getByTestId('input-adj-appearance');
    const funcInput = screen.getByTestId('input-adj-function');
    const accInput = screen.getByTestId('input-adj-accessories');
    const noteInput = screen.getByTestId('input-adj-note');
    const approveBtn = screen.getByTestId('modal-approve-btn');

    // 1. Thử tăng điểm ngoại quan lên 9.5 (> 8.0) -> Báo lỗi client và chặn gửi
    fireEvent.change(appInput, { target: { value: '9.5' } });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(screen.getByText(/Chỉ được hạ điểm/i)).toBeInTheDocument();
    });
    expect(mockApprove).not.toHaveBeenCalled();

    // 2. Hạ điểm hợp lệ: Ngoại quan = 5.0, Chức năng = 6.0, Phụ kiện = 6.0
    // Điểm tổng mới = 0.4*5 + 0.4*6 + 0.2*6 = 2.0 + 2.4 + 1.2 = 5.6 (Khá)
    fireEvent.change(appInput, { target: { value: '5.0' } });
    fireEvent.change(funcInput, { target: { value: '6.0' } });
    fireEvent.change(accInput, { target: { value: '6.0' } });

    // Kiểm tra xem trước điểm mới
    const previewScore = screen.getByTestId('new-preview-score');
    expect(previewScore).toHaveTextContent('5.6');

    // Nhập ghi chú
    fireEvent.change(noteInput, {
      target: { value: 'Chân tủ bị lung lay và trầy xước mặt gỗ, hạ điểm ngoại quan và chức năng' },
    });

    // Bấm Duyệt với điểm mới
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(mockApprove).toHaveBeenCalledWith(201, {
        adjustments: {
          score_appearance: 5.0,
          score_function: 6.0,
          score_accessories: 6.0,
        },
        note: 'Chân tủ bị lung lay và trầy xước mặt gỗ, hạ điểm ngoại quan và chức năng',
      });
    });
  });

  it('4. Xử lý lỗi 409 Conflict (E2): tin đã được xử lý bởi admin khác -> hiển thị cảnh báo và làm mới danh sách', async () => {
    const conflictError = new Error('Tin đăng đã được xử lý');
    conflictError.status = 409;
    conflictError.code = 409;

    vi.spyOn(adminApi, 'approveListingApi').mockRejectedValue(conflictError);

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    const detailBtn = await screen.findByTestId('open-detail-btn-201');
    fireEvent.click(detailBtn);

    await screen.findByTestId('admin-listing-modal');

    const approveBtn = screen.getByTestId('modal-approve-btn');
    fireEvent.click(approveBtn);

    // Hiển thị banner lỗi 409
    const errorBanner = await screen.findByTestId('action-error-banner');
    expect(errorBanner).toHaveTextContent(/Tin đăng đã được xử lý bởi quản trị viên khác \(Lỗi 409\)/i);
  });
});
