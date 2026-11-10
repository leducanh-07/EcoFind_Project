import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from '../pages/RegisterPage';
import { AuthProvider } from '../context/AuthContext';
import * as authApi from '../api/auth';
import { ApiError } from '../api/client';

describe('RegisterPage Component (UC-01, FR-01, TE9C72F)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderRegisterPage = () => {
    return render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/register']}>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    );
  };

  test('Hiển thị form đăng ký đầy đủ 4 trường', () => {
    renderRegisterPage();

    expect(screen.getByPlaceholderText(/Nguyễn Văn A/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/vidu@ecofind.vn/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/0912345678/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /đăng ký tài khoản/i })
    ).toBeInTheDocument();
  });

  test('Kiểm tra lỗi client-side khi để trống các trường bắt buộc', async () => {
    renderRegisterPage();

    const submitBtn = screen.getByRole('button', { name: /đăng ký tài khoản/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Vui lòng nhập họ và tên của bạn/i)).toBeInTheDocument();
    expect(await screen.findByText(/Vui lòng nhập địa chỉ email/i)).toBeInTheDocument();
    expect(await screen.findByText(/Vui lòng nhập số điện thoại liên hệ/i)).toBeInTheDocument();
    expect(await screen.findByText(/Vui lòng nhập mật khẩu/i)).toBeInTheDocument();
  });

  test('Hiển thị thông báo lỗi E3 khi email đã tồn tại (HTTP 409 Conflict)', async () => {
    vi.spyOn(authApi, 'registerApi').mockRejectedValue(
      new ApiError('Email đã được đăng ký trong hệ thống', 409, 409)
    );

    renderRegisterPage();

    fireEvent.change(screen.getByPlaceholderText(/Nguyễn Văn A/i), {
      target: { value: 'Trần Thị B' },
    });
    fireEvent.change(screen.getByPlaceholderText(/vidu@ecofind.vn/i), {
      target: { value: 'user@ecofind.vn' },
    });
    fireEvent.change(screen.getByPlaceholderText(/0912345678/i), {
      target: { value: '0987654321' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: 'Password123@' },
    });
    fireEvent.click(screen.getByRole('button', { name: /đăng ký tài khoản/i }));

    expect(
      await screen.findByText(/Email này đã được sử dụng/i)
    ).toBeInTheDocument();
  });

  test('Đăng ký thành công: lưu token JWT và tự động đăng nhập', async () => {
    vi.spyOn(authApi, 'registerApi').mockResolvedValue({
      accessToken: 'jwt_mock_token_register',
      tokenType: 'bearer',
      role: 'user',
      user: {
        userId: 2,
        fullName: 'Trần Thị B',
        email: 'user.b@ecofind.vn',
        role: 'user',
      },
    });

    renderRegisterPage();

    fireEvent.change(screen.getByPlaceholderText(/Nguyễn Văn A/i), {
      target: { value: 'Trần Thị B' },
    });
    fireEvent.change(screen.getByPlaceholderText(/vidu@ecofind.vn/i), {
      target: { value: 'user.b@ecofind.vn' },
    });
    fireEvent.change(screen.getByPlaceholderText(/0912345678/i), {
      target: { value: '0987654321' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: 'Password123@' },
    });
    fireEvent.click(screen.getByRole('button', { name: /đăng ký tài khoản/i }));

    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBe('jwt_mock_token_register');
    });
  });
});

