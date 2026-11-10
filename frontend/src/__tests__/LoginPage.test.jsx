import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import { AuthProvider } from '../context/AuthContext';
import * as authApi from '../api/auth';
import { ApiError } from '../api/client';

describe('LoginPage Component (UC-01, FR-02, TE9C72F)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderLoginPage = () => {
    return render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    );
  };

  test('Hiển thị form đăng nhập đầy đủ 2 trường và nút đăng nhập', () => {
    renderLoginPage();

    expect(screen.getByPlaceholderText(/vidu@ecofind.vn/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đăng nhập/i })).toBeInTheDocument();
  });

  test('Kiểm tra lỗi client-side khi để trống hoặc nhập sai định dạng email/mật khẩu ngắn', async () => {
    renderLoginPage();

    const submitBtn = screen.getByRole('button', { name: /đăng nhập/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Vui lòng nhập địa chỉ email/i)).toBeInTheDocument();
    expect(await screen.findByText(/Vui lòng nhập mật khẩu/i)).toBeInTheDocument();

    const emailInput = screen.getByPlaceholderText(/vidu@ecofind.vn/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Email không đúng định dạng/i)).toBeInTheDocument();
    expect(await screen.findByText(/Mật khẩu phải chứa ít nhất 8 ký tự/i)).toBeInTheDocument();
  });

  test('Hiển thị thông báo lỗi E1 khi API trả về 401 Unauthorized', async () => {
    vi.spyOn(authApi, 'loginApi').mockRejectedValue(
      new ApiError('Email hoặc mật khẩu không đúng', 401, 401)
    );

    renderLoginPage();

    fireEvent.change(screen.getByPlaceholderText(/vidu@ecofind.vn/i), {
      target: { value: 'user@ecofind.vn' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: 'WrongPassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /đăng nhập/i }));

    expect(
      await screen.findByText(/Email hoặc mật khẩu không đúng/i)
    ).toBeInTheDocument();
  });

  test('Hiển thị thông báo lỗi E2 khi tài khoản bị khóa 15 phút (HTTP 423 Locked)', async () => {
    vi.spyOn(authApi, 'loginApi').mockRejectedValue(
      new ApiError(
        'Tài khoản tạm thời bị khóa 15 phút do nhập sai mật khẩu quá 5 lần',
        423,
        423
      )
    );

    renderLoginPage();

    fireEvent.change(screen.getByPlaceholderText(/vidu@ecofind.vn/i), {
      target: { value: 'user@ecofind.vn' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /đăng nhập/i }));

    expect(
      await screen.findByText(/Tài khoản tạm khóa \(423\)/i)
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/khóa 15 phút do nhập sai mật khẩu quá 5 lần/i)
    ).toBeInTheDocument();
  });

  test('Đăng nhập thành công: lưu token vào localStorage', async () => {
    vi.spyOn(authApi, 'loginApi').mockResolvedValue({
      accessToken: 'jwt_mock_token_123',
      tokenType: 'bearer',
      role: 'user',
      user: {
        userId: 1,
        fullName: 'Nguyễn Văn A',
        email: 'user@ecofind.vn',
        role: 'user',
      },
    });

    renderLoginPage();

    fireEvent.change(screen.getByPlaceholderText(/vidu@ecofind.vn/i), {
      target: { value: 'user@ecofind.vn' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: 'Password123@' },
    });
    fireEvent.click(screen.getByRole('button', { name: /đăng nhập/i }));

    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBe('jwt_mock_token_123');
    });
  });
});

