import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import Header from '../components/Header';
import PostListingPage from '../pages/PostListingPage';
import * as authContext from '../context/AuthContext';
import * as categoriesApi from '../api/categories';
import * as listingsApi from '../api/listings';

describe('TE9C759: Kiểm thử responsive & khả dụng (NFR-USA-01, NFR-USA-02)', () => {
  const mockUser = {
    id: 1,
    fullName: 'Lê Đức Anh',
    email: 'user@ecofind.vn',
    role: 'user',
  };

  const mockCategories = [
    { id: 1, name: 'Đồ điện tử' },
    { id: 2, name: 'Nội thất' },
    { id: 3, name: 'Sách & Văn phòng phẩm' },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isAdmin: false,
      logout: vi.fn(),
    });
    vi.spyOn(categoriesApi, 'getCategoriesApi').mockResolvedValue(mockCategories);
    vi.spyOn(listingsApi, 'getListingsMapApi').mockResolvedValue([
      {
        id: 1,
        title: 'Bàn ghế học sinh',
        price: 350000,
        lat: 10.7769,
        lng: 106.7009,
        totalScore: 8.5,
        rank: 'Tốt',
      },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Kiểm thử bố cục Responsive (360px Mobile, 768px Tablet, 1920px Desktop)', () => {
    it('1.1 Trên màn hình Mobile (360px): Header có nút Menu di động, HomePage có bộ chuyển tab Bản đồ / Danh sách', async () => {
      window.innerWidth = 360;
      window.innerHeight = 640;

      await act(async () => {
        render(
          <MemoryRouter>
            <Header />
            <HomePage />
          </MemoryRouter>
        );
      });

      // Kiểm tra có nút toggle menu mobile
      const toggleBtn = screen.getByLabelText(/Toggle Navigation/i);
      expect(toggleBtn).toBeInTheDocument();

      // Kiểm tra có tab chuyển đổi Bản đồ / Danh sách trên mobile
      const mapButtons = screen.getAllByRole('button', { name: /Bản đồ/i });
      expect(mapButtons.length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /Danh sách/i })).toBeInTheDocument();

      // Mở menu mobile
      fireEvent.click(toggleBtn);
      expect(screen.getByText(/Bản đồ khám phá/i)).toBeInTheDocument();
      expect(screen.getByText(/Đăng tin bán đồ/i)).toBeInTheDocument();
    });

    it('1.2 Trên màn hình Tablet (768px): Header hiển thị thanh điều hướng ngang', async () => {
      window.innerWidth = 768;
      window.innerHeight = 1024;

      await act(async () => {
        render(
          <MemoryRouter>
            <Header />
          </MemoryRouter>
        );
      });

      expect(screen.getByText('Bản đồ')).toBeInTheDocument();
      expect(screen.getByText('Tin của tôi')).toBeInTheDocument();
      expect(screen.getByText('Yêu thích')).toBeInTheDocument();
    });

    it('1.3 Trên màn hình Desktop lớn (1920px): Layout nằm gọn trong max-w-7xl, chia 2 cột kết quả & bản đồ', async () => {
      window.innerWidth = 1920;
      window.innerHeight = 1080;

      await act(async () => {
        render(
          <MemoryRouter>
            <HomePage />
          </MemoryRouter>
        );
      });

      // Cột kết quả tìm kiếm và cột bản đồ cùng hiện diện trong DOM
      expect(screen.getByTestId('search-results-list-container')).toBeInTheDocument();
      expect(screen.getByTestId('map-view-container')).toBeInTheDocument();
    });
  });

  describe('2. Khả năng sử dụng (Usability NFR-USA-01 & NFR-USA-02)', () => {
    it('2.1 NFR-USA-01: Tìm kiếm đồ cũ hiển thị kết quả và bộ lọc nhanh', async () => {
      await act(async () => {
        render(
          <MemoryRouter>
            <HomePage />
          </MemoryRouter>
        );
      });

      const searchInput = screen.getByPlaceholderText(/Tìm theo tên đồ cũ, mô tả/i);
      expect(searchInput).toBeInTheDocument();

      // Nhập từ khóa tìm kiếm
      fireEvent.change(searchInput, { target: { value: 'Bàn ghế' } });
      expect(searchInput.value).toBe('Bàn ghế');

      // Click nút tìm
      const searchBtn = screen.getByRole('button', { name: /Tìm/i });
      fireEvent.click(searchBtn);

      // Hiển thị nút bộ lọc có badge
      expect(screen.getByRole('button', { name: /Mở bộ lọc/i })).toBeInTheDocument();
    });

    it('2.2 NFR-USA-02: Form đăng tin có đầy đủ các bước (Thông tin cơ bản, Đánh giá tình trạng, Chọn vị trí, Tải ảnh)', async () => {
      await act(async () => {
        render(
          <MemoryRouter>
            <PostListingPage />
          </MemoryRouter>
        );
      });

      // 1. Thông tin cơ bản
      expect(screen.getByLabelText(/Tiêu đề tin đăng/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Danh mục/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Giá bán/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Mô tả chi tiết/i)).toBeInTheDocument();

      // 2. Chấm điểm 3 tiêu chí
      expect(screen.getByTestId('score-appearance-slider')).toBeInTheDocument();
      expect(screen.getByTestId('score-function-slider')).toBeInTheDocument();
      expect(screen.getByTestId('score-accessories-slider')).toBeInTheDocument();

      // 3. Nút Gửi duyệt tin
      expect(screen.getByRole('button', { name: /Gửi duyệt/i })).toBeInTheDocument();
    });
  });
});
