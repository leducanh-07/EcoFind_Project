import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';
import * as adminApi from '../api/admin';
import * as authContext from '../context/AuthContext';

const mockAdminUser = {
  userId: 1,
  fullName: 'Quản trị viên Hệ thống',
  email: 'admin@ecofind.vn',
  role: 'admin',
};

describe('AdminPage Extended Management Features (KPI, Hidden Tab, Users Management)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: mockAdminUser,
      isAuthenticated: true,
      isAdmin: true,
      loading: false,
    });
    vi.spyOn(adminApi, 'getAdminStatsApi').mockResolvedValue({
      counts: {
        pending: 3,
        selling: 12,
        hidden: 1,
        rejected: 2,
        sold: 4,
        reportsNew: 2,
        reportsResolved: 5,
        usersTotal: 4,
        usersLocked: 1,
      },
      avgSellingScore: 8.5,
      categories: [{ categoryId: 2, name: 'Đồ điện tử', count: 8 }],
    });
    vi.spyOn(adminApi, 'getAdminReportsApi').mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('Hiển thị hàng thẻ KPI tổng quan và phân bổ danh mục', async () => {
    vi.spyOn(adminApi, 'getAdminListingsApi').mockResolvedValue([]);

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('admin-kpi-section')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-pending')).toHaveTextContent('3');
    expect(screen.getByTestId('kpi-selling')).toHaveTextContent('12');
    expect(screen.getByTestId('kpi-users')).toHaveTextContent('4');
    expect(screen.getByText('Đồ điện tử')).toBeInTheDocument();
  });

  it('Tab Đang bán & Tab Đã ẩn hỗ trợ ẩn trực tiếp và khôi phục tin', async () => {
    const getListingsSpy = vi
      .spyOn(adminApi, 'getAdminListingsApi')
      .mockImplementation(async ({ status }) => {
        if (status === 'selling') {
          return [
            {
              id: 50,
              title: 'Tai nghe Sony XM4',
              price: 3200000,
              categoryName: 'Đồ điện tử',
              sellerName: 'Nguyễn Văn Hùng',
              totalScore: 8.8,
              status: 'selling',
            },
          ];
        }
        if (status === 'hidden') {
          return [
            {
              id: 60,
              title: 'Máy ảnh cũ giá nghi vấn',
              price: 500000,
              categoryName: 'Đồ điện tử',
              sellerName: 'Trần Thị Mai',
              totalScore: 7.0,
              status: 'hidden',
              hiddenByAdmin: true,
            },
          ];
        }
        return [];
      });

    const hideSpy = vi.spyOn(adminApi, 'hideAdminListingApi').mockResolvedValue({
      id: 50,
      status: 'hidden',
      message: 'Đã ẩn tin đăng vi phạm',
    });
    const restoreSpy = vi.spyOn(adminApi, 'restoreAdminListingApi').mockResolvedValue({
      id: 60,
      status: 'selling',
      message: 'Đã khôi phục tin đăng',
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    // Chuyển sang Tab Đang bán -> bấm Ẩn tin
    fireEvent.click(await screen.findByTestId('tab-selling'));
    expect(await screen.findByText('Tai nghe Sony XM4')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-admin-hide-50'));
    fireEvent.change(screen.getByTestId('input-admin-hide-reason'), {
      target: { value: 'Tin trùng lặp' },
    });
    fireEvent.click(screen.getByTestId('confirm-resolve-btn'));

    await waitFor(() => {
      expect(hideSpy).toHaveBeenCalledWith(50, { reason: 'Tin trùng lặp' });
    });

    // Chuyển sang Tab Đã ẩn -> thấy nhãn Admin ẩn -> Khôi phục
    fireEvent.click(screen.getByTestId('tab-hidden'));
    await waitFor(() => expect(getListingsSpy).toHaveBeenCalledWith({ status: 'hidden', sort: 'desc' }));
    expect(await screen.findByText('Máy ảnh cũ giá nghi vấn')).toBeInTheDocument();
    expect(screen.getByText('Admin ẩn')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('btn-admin-restore-60'));
    fireEvent.click(screen.getByTestId('confirm-resolve-btn'));

    await waitFor(() => {
      expect(restoreSpy).toHaveBeenCalledWith(60);
    });
  });

  it('Tab Thành viên cho phép xem danh sách, khóa và mở khóa tài khoản user', async () => {
    vi.spyOn(adminApi, 'getAdminListingsApi').mockResolvedValue([]);
    vi.spyOn(adminApi, 'getAdminUsersApi').mockResolvedValue([
      {
        userId: 3,
        fullName: 'Nguyễn Văn Hùng',
        email: 'seller1@ecofind.vn',
        phone: '0901234567',
        role: 'user',
        isLocked: false,
        listingsCount: 10,
        sellingCount: 8,
        hiddenByAdminCount: 0,
        reportsReceivedCount: 1,
      },
      {
        userId: 4,
        fullName: 'Trần Văn Vi Phạm',
        email: 'spam@ecofind.vn',
        phone: '0999888777',
        role: 'user',
        isLocked: true,
        lockedUntil: '2026-12-01T00:00:00Z',
        listingsCount: 2,
        sellingCount: 0,
        hiddenByAdminCount: 2,
        reportsReceivedCount: 3,
      },
    ]);

    const lockSpy = vi.spyOn(adminApi, 'lockAdminUserApi').mockResolvedValue({
      userId: 3,
      isLocked: true,
      lockedUntil: '2026-12-02T00:00:00Z',
      message: 'Đã khóa tài khoản Nguyễn Văn Hùng (7 ngày)',
    });
    const unlockSpy = vi.spyOn(adminApi, 'unlockAdminUserApi').mockResolvedValue({
      userId: 4,
      isLocked: false,
      lockedUntil: null,
      message: 'Đã mở khóa tài khoản Trần Văn Vi Phạm',
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByTestId('tab-users'));
    expect(await screen.findByTestId('admin-users-table')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn Hùng')).toBeInTheDocument();
    expect(screen.getByText('Trần Văn Vi Phạm')).toBeInTheDocument();

    // Khóa user 3
    fireEvent.click(screen.getByTestId('btn-lock-user-3'));
    fireEvent.click(screen.getByTestId('confirm-resolve-btn'));
    await waitFor(() => {
      expect(lockSpy).toHaveBeenCalledWith(3, { durationHours: 168 });
    });

    // Mở khóa user 4
    fireEvent.click(screen.getByTestId('btn-unlock-user-4'));
    fireEvent.click(screen.getByTestId('confirm-resolve-btn'));
    await waitFor(() => {
      expect(unlockSpy).toHaveBeenCalledWith(4);
    });
  });
});
