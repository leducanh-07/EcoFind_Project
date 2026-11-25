import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import ProtectedRoute from '../components/ProtectedRoute';
import AdminRoute from '../components/AdminRoute';
import PostListingPage from '../pages/PostListingPage';
import MyListingsPage from '../pages/MyListingsPage';
import FavoritesPage from '../pages/FavoritesPage';
import AdminPage from '../pages/AdminPage';
import LoginPage from '../pages/LoginPage';
import { get } from '../api/client';

function createFakeJwt(expSecondsFromNow) {
  const encode = (obj) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ sub: '1', exp: Math.floor(Date.now() / 1000) + expSecondsFromNow });
  return `${header}.${payload}.signature`;
}

function TestApp({ initialRoute = '/', prefillAuth = null }) {
  if (prefillAuth) {
    localStorage.setItem('access_token', prefillAuth.token);
    localStorage.setItem('auth_user', JSON.stringify(prefillAuth.user));
  } else {
    localStorage.clear();
  }

  return (
    <AuthProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Header />
        <Routes>
          <Route path="/" element={<div>Trang chủ</div>} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/post"
            element={
              <ProtectedRoute>
                <PostListingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-listings"
            element={
              <ProtectedRoute>
                <MyListingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/favorites"
            element={
              <ProtectedRoute>
                <FavoritesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Auth State, Logout & Route Guard (FR-02, NFR-SEC-03, TE9C730)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('Khi chưa đăng nhập: Header hiển thị Đăng nhập / Đăng ký', () => {
    render(<TestApp initialRoute="/" />);

    expect(screen.getAllByRole('link', { name: /đăng nhập/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /đăng ký/i })[0]).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /đăng xuất/i })).not.toBeInTheDocument();
  });

  test('Khi đã đăng nhập: Header hiển thị tên người dùng, link Trang cá nhân và nút Đăng xuất', () => {
    render(
      <TestApp
        initialRoute="/"
        prefillAuth={{
          token: 'token_user_1',
          user: { userId: 1, fullName: 'Nguyễn Văn A', email: 'user@ecofind.vn', role: 'user' },
        }}
      />
    );

    expect(screen.getAllByText('Nguyễn Văn A').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Tài khoản:/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /trang cá nhân/i })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('button', { name: /đăng xuất/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /đăng nhập/i })).not.toBeInTheDocument();
  });

  test('Bấm Đăng xuất thì xóa token khỏi localStorage và quay về trạng thái chưa đăng nhập', async () => {
    render(
      <TestApp
        initialRoute="/"
        prefillAuth={{
          token: 'token_user_1',
          user: { userId: 1, fullName: 'Nguyễn Văn A', email: 'user@ecofind.vn', role: 'user' },
        }}
      />
    );

    const logoutBtn = screen.getByRole('button', { name: /đăng xuất/i });
    fireEvent.click(logoutBtn);

    // Xác nhận trong hộp thoại đăng xuất
    const confirmBtn = screen.getByTestId('confirm-logout-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('auth_user')).toBeNull();
      expect(screen.getAllByRole('link', { name: /đăng nhập/i })[0]).toBeInTheDocument();
    });
  });

  test('Chưa đăng nhập truy cập /post bị chuyển hướng về /login', () => {
    render(<TestApp initialRoute="/post" />);

    expect(screen.getByRole('heading', { name: /đăng nhập tài khoản/i })).toBeInTheDocument();
  });

  test('Chưa đăng nhập truy cập /my-listings bị chuyển hướng về /login', () => {
    render(<TestApp initialRoute="/my-listings" />);

    expect(screen.getByRole('heading', { name: /đăng nhập tài khoản/i })).toBeInTheDocument();
  });

  test('Chưa đăng nhập truy cập /favorites bị chuyển hướng về /login', () => {
    render(<TestApp initialRoute="/favorites" />);

    expect(screen.getByRole('heading', { name: /đăng nhập tài khoản/i })).toBeInTheDocument();
  });

  test('Người dùng role user truy cập /admin bị chặn 403 Forbidden', () => {
    render(
      <TestApp
        initialRoute="/admin"
        prefillAuth={{
          token: 'token_user_normal',
          user: { userId: 3, fullName: 'Người dùng B', email: 'b@ecofind.vn', role: 'user' },
        }}
      />
    );

    expect(screen.getByText(/Truy cập bị từ chối \(403\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Khu vực này chỉ dành riêng cho Quản trị viên hệ thống/i)).toBeInTheDocument();
    expect(screen.queryByText(/Bảng điều khiển Quản trị viên/i)).not.toBeInTheDocument();
  });

  test('Quản trị viên role admin truy cập /admin thành công và ẩn nút Đăng tin trên Header', () => {
    render(
      <TestApp
        initialRoute="/admin"
        prefillAuth={{
          token: 'token_admin',
          user: {
            userId: 99,
            fullName: 'Quản trị viên Hệ thống',
            email: 'admin@ecofind.vn',
            role: 'admin',
          },
        }}
      />
    );

    expect(screen.getByText(/Bảng điều khiển Quản trị viên/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /đăng tin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /tin của tôi/i })).not.toBeInTheDocument();
    const adminLinks = screen.getAllByRole('link', { name: /quản trị$/i });
    expect(adminLinks.length).toBeGreaterThanOrEqual(1);
    adminLinks.forEach((link) => expect(link).toHaveAttribute('href', '/admin'));
  });

  test('Token JWT đã hết hạn trong localStorage: vào /post bị đá về /login kèm thông báo hết phiên', () => {
    const expiredJwt = createFakeJwt(-3600);
    render(
      <TestApp
        initialRoute="/post"
        prefillAuth={{
          token: expiredJwt,
          user: { userId: 1, fullName: 'Nguyễn Văn A', email: 'user@ecofind.vn', role: 'user' },
        }}
      />
    );

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(screen.getByRole('heading', { name: /đăng nhập tài khoản/i })).toBeInTheDocument();
    expect(screen.getByTestId('session-expired-banner')).toHaveTextContent(/Phiên đăng nhập đã hết hạn/i);
  });

  test('Token JWT đã hết hạn trong localStorage: vào Trang chủ (/) tự dọn session và giữ ở chế độ Khách', () => {
    const expiredJwt = createFakeJwt(-3600);
    render(
      <TestApp
        initialRoute="/"
        prefillAuth={{
          token: expiredJwt,
          user: { userId: 1, fullName: 'Nguyễn Văn A', email: 'user@ecofind.vn', role: 'user' },
        }}
      />
    );

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(screen.getByText('Trang chủ')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /đăng nhập/i })[0]).toBeInTheDocument();
  });

  test('Đang ở trang bảo vệ mà API trả về 401: tự động xóa session và chuyển hướng về /login', async () => {
    const validJwt = createFakeJwt(3600);
    const prevFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Phiên làm việc (token) đã hết hạn' } }),
    });

    try {
      render(
        <TestApp
          initialRoute="/post"
          prefillAuth={{
            token: validJwt,
            user: { userId: 1, fullName: 'Nguyễn Văn A', email: 'user@ecofind.vn', role: 'user' },
          }}
        />
      );

      // Đang ở /post trước khi API trả 401
      expect(screen.getByText(/Đăng tin bán đồ cũ/i)).toBeInTheDocument();

      // Gọi một API bảo vệ bị trả 401
      await act(async () => {
        await expect(get('/api/geocode?address=test')).rejects.toThrow();
      });

      await waitFor(() => {
        expect(localStorage.getItem('access_token')).toBeNull();
        expect(screen.getByRole('heading', { name: /đăng nhập tài khoản/i })).toBeInTheDocument();
        expect(screen.getByTestId('session-expired-banner')).toBeInTheDocument();
      });
    } finally {
      global.fetch = prevFetch;
    }
  });
});

