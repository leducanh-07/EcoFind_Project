import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import ProfilePage from '../pages/ProfilePage';
import { AuthProvider } from '../context/AuthContext';
import * as usersApi from '../api/users';

describe('ProfilePage Component (SDD 6.1 Profile, Change Password, Admin Stats & Seller View)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  test('Hiển thị trang cá nhân User, cập nhật Họ tên/SĐT và đổi mật khẩu', async () => {
    localStorage.setItem('access_token', 'token_seller_1');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({
        userId: 3,
        fullName: 'Nguyễn Văn Hùng',
        email: 'seller1@ecofind.vn',
        role: 'user',
      })
    );

    vi.spyOn(usersApi, 'getMyProfileApi').mockResolvedValue({
      userId: 3,
      fullName: 'Nguyễn Văn Hùng',
      email: 'seller1@ecofind.vn',
      phone: '0901234567',
      role: 'user',
      failedAttempts: 0,
      isLocked: false,
      activityRole: 'Người bán · Chuyên Đồ điện tử',
      topCategories: [{ name: 'Đồ điện tử', count: 4 }],
      stats: {
        sellingCount: 4,
        pendingCount: 1,
        soldCount: 2,
        totalListings: 7,
        favoritesCount: 0,
        reportsCount: 0,
        avgScore: 8.6,
      },
      adminStats: null,
      featuredListings: [
        {
          id: 122,
          title: 'Laptop Dell Latitude 7490',
          price: 6800000,
          totalScore: 9.1,
          rank: 'Như mới',
          thumbnailUrl: 'https://example.com/laptop.jpg',
        },
      ],
    });

    const updateSpy = vi.spyOn(usersApi, 'updateMyProfileApi').mockResolvedValue({
      userId: 3,
      fullName: 'Nguyễn Văn Hùng',
      email: 'seller1@ecofind.vn',
      phone: '0908 456 789',
      role: 'user',
      failedAttempts: 0,
      isLocked: false,
      activityRole: 'Người bán · Chuyên Đồ điện tử',
      topCategories: [{ name: 'Đồ điện tử', count: 4 }],
      stats: { avgScore: 8.6, soldCount: 2 },
      adminStats: null,
      featuredListings: [],
    });

    const pwdSpy = vi.spyOn(usersApi, 'changeMyPasswordApi').mockResolvedValue({
      message: 'Đổi mật khẩu thành công',
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/profile']}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByTestId('profile-full-name')).toHaveTextContent('Nguyễn Văn Hùng');
    expect(screen.getByTestId('profile-activity-role')).toHaveTextContent(
      'Người bán · Chuyên Đồ điện tử'
    );
    expect(screen.queryByText(/Mã thành viên/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Thao tác nhanh trên EcoFind/i)).not.toBeInTheDocument();
    expect(screen.getByText('Laptop Dell Latitude 7490')).toBeInTheDocument();

    // Tab cập nhật hồ sơ
    fireEvent.click(screen.getByTestId('tab-edit-profile'));
    fireEvent.change(screen.getByPlaceholderText('0908 456 789'), {
      target: { value: '0908 456 789' },
    });
    fireEvent.click(screen.getByTestId('save-profile-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        fullName: 'Nguyễn Văn Hùng',
        phone: '0908 456 789',
      });
    });
    expect(await screen.findByTestId('profile-save-success')).toBeInTheDocument();

    // Tab đổi mật khẩu
    fireEvent.click(screen.getByTestId('tab-change-password'));
    fireEvent.change(screen.getByTestId('input-current-password'), {
      target: { value: 'Demo@1234' },
    });
    fireEvent.change(screen.getByTestId('input-new-password'), {
      target: { value: 'NewPass@2026' },
    });
    fireEvent.change(screen.getByTestId('input-confirm-password'), {
      target: { value: 'NewPass@2026' },
    });
    fireEvent.click(screen.getByTestId('save-password-btn'));

    await waitFor(() => {
      expect(pwdSpy).toHaveBeenCalledWith({
        currentPassword: 'Demo@1234',
        newPassword: 'NewPass@2026',
        confirmPassword: 'NewPass@2026',
      });
    });
    expect(await screen.findByTestId('password-save-success')).toHaveTextContent(
      'Đổi mật khẩu thành công'
    );
  });

  test('Hiển thị Trang cá nhân Admin với tên Quản trị viên Hệ thống, thống kê kiểm duyệt và tab Đổi mật khẩu', async () => {
    localStorage.setItem('access_token', 'token_admin');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({
        userId: 1,
        fullName: 'Quản trị viên Hệ thống',
        email: 'admin@ecofind.vn',
        role: 'admin',
      })
    );

    vi.spyOn(usersApi, 'getMyProfileApi').mockResolvedValue({
      userId: 1,
      fullName: 'Quản trị viên Hệ thống',
      email: 'admin@ecofind.vn',
      phone: '0900000001',
      role: 'admin',
      failedAttempts: 0,
      isLocked: false,
      activityRole: 'Quản trị viên kiểm duyệt & vận hành hệ thống',
      topCategories: [],
      stats: { sellingCount: 0, pendingCount: 0, soldCount: 0, totalListings: 0 },
      adminStats: {
        pendingListingsCount: 3,
        activeSellingCount: 28,
        openReportsCount: 4,
        totalMembersCount: 5,
      },
      featuredListings: [],
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/profile']}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByTestId('profile-full-name')).toHaveTextContent(
      'Quản trị viên Hệ thống'
    );
    expect(screen.getByTestId('admin-profile-overview')).toBeInTheDocument();
    expect(screen.getByText('Tin chờ kiểm duyệt')).toBeInTheDocument();
    expect(screen.getByText('Báo cáo vi phạm mới')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mở Bảng điều khiển Quản trị/i })).toHaveAttribute(
      'href',
      '/admin'
    );
    expect(screen.getByTestId('tab-change-password')).toBeInTheDocument();
  });

  test('Hiển thị trang cá nhân người bán công khai kèm chuyên mục trên /sellers/:userId', async () => {
    vi.spyOn(usersApi, 'getSellerProfileApi').mockResolvedValue({
      userId: 4,
      fullName: 'Trần Thị Mai',
      role: 'user',
      activityRole: 'Người bán · Chuyên Đồ gia dụng & Nội thất',
      topCategories: [
        { name: 'Đồ gia dụng', count: 5 },
        { name: 'Nội thất', count: 4 },
      ],
      stats: {
        sellingCount: 1,
        soldCount: 2,
        avgScore: 9.0,
      },
      listings: [
        {
          id: 10,
          title: 'Bàn làm việc gỗ thông',
          price: 750000,
          totalScore: 9.0,
          rank: 'Như mới',
          address: 'Quận Phú Nhuận, TP.HCM',
          thumbnailUrl: 'https://example.com/desk.jpg',
        },
      ],
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/sellers/4']}>
          <Routes>
            <Route path="/sellers/:userId" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByTestId('profile-full-name')).toHaveTextContent('Trần Thị Mai');
    expect(screen.getByTestId('profile-activity-role')).toHaveTextContent(
      'Người bán · Chuyên Đồ gia dụng & Nội thất'
    );
    expect(screen.getByText('Bàn làm việc gỗ thông')).toBeInTheDocument();
    expect(screen.getByText('750.000 đ')).toBeInTheDocument();
  });
});
