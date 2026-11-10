import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

  test('Khi đã đăng nhập: Header hiển thị tên người dùng và nút Đăng xuất', () => {
    render(
      <TestApp
        initialRoute="/"
        prefillAuth={{
          token: 'token_user_1',
          user: { userId: 1, fullName: 'Nguyễn Văn A', email: 'user@ecofind.vn', role: 'user' },
        }}
      />
    );

    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đăng xuất/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /đăng nhập/i })).not.toBeInTheDocument();
  });

  test('Bấm Đăng xuất thì xóa token khỏi localStorage và quay về trạng thái chưa đăng nhập', () => {
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

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('auth_user')).toBeNull();
    expect(screen.getAllByRole('link', { name: /đăng nhập/i })[0]).toBeInTheDocument();
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

  test('Quản trị viên role admin truy cập /admin thành công', () => {
    render(
      <TestApp
        initialRoute="/admin"
        prefillAuth={{
          token: 'token_admin',
          user: { userId: 99, fullName: 'Admin EcoFind', email: 'admin@ecofind.vn', role: 'admin' },
        }}
      />
    );

    expect(screen.getByText(/Bảng điều khiển Quản trị viên/i)).toBeInTheDocument();
  });
});

