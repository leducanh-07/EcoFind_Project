import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PostListingPage from '../pages/PostListingPage';
import * as categoriesApi from '../api/categories';

describe('TE9C742: Form đăng tin – thông tin cơ bản (UC-05, FR-08, BR-05)', () => {
  const mockCategories = [
    { id: 1, name: 'Đồ điện tử' },
    { id: 2, name: 'Bàn ghế nội thất' },
    { id: 3, name: 'Sách & Giáo trình' },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(categoriesApi, 'getCategoriesApi').mockResolvedValue(mockCategories);
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <PostListingPage />
      </MemoryRouter>
    );
  };

  it('1. Đánh dấu đầy đủ ký hiệu bắt buộc (*) trên tất cả các trường cơ bản', async () => {
    renderComponent();

    // Tiêu đề *
    const titleLabel = screen.getByText(/Tiêu đề tin đăng/i);
    expect(titleLabel).toBeInTheDocument();
    expect(titleLabel.innerHTML).toContain('*');

    // Danh mục *
    const categoryLabel = screen.getByText(/Danh mục hàng hóa \/ sản phẩm/i);
    expect(categoryLabel).toBeInTheDocument();
    expect(categoryLabel.innerHTML).toContain('*');

    // Giá bán *
    const priceLabel = screen.getByText(/Giá bán \(VNĐ\)/i);
    expect(priceLabel).toBeInTheDocument();
    expect(priceLabel.innerHTML).toContain('*');

    // Mô tả *
    const descLabel = screen.getByText(/Mô tả chi tiết món đồ/i);
    expect(descLabel).toBeInTheDocument();
    expect(descLabel.innerHTML).toContain('*');
  });

  it('2. Danh mục sản phẩm được tải và hiển thị từ /api/categories', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Đồ điện tử' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Bàn ghế nội thất' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Sách & Giáo trình' })).toBeInTheDocument();
    });

    const categorySelect = screen.getByLabelText(/Danh mục hàng hóa/i);
    fireEvent.change(categorySelect, { target: { value: '2' } });
    expect(categorySelect.value).toBe('2');
  });

  it('3. Giá bán hỗ trợ 0 (Cho tặng) với nút gợi ý nhanh và định dạng giá hiển thị', async () => {
    renderComponent();

    const priceInput = screen.getByPlaceholderText(/VD: 250000/i);
    const quickFreeBtn = screen.getByTestId('quick-free-btn');

    // Bấm nút gợi ý Cho tặng (0 đ)
    fireEvent.click(quickFreeBtn);
    expect(priceInput.value).toBe('0');
    expect(screen.getByTestId('price-formatted-hint')).toHaveTextContent(/Cho tặng \(Miễn phí\)/i);

    // Nhập giá số nguyên bình thường (ví dụ: 350.000 đ)
    fireEvent.change(priceInput, { target: { value: '350000' } });
    expect(priceInput.value).toBe('350000');
    expect(screen.getByTestId('price-formatted-hint')).toHaveTextContent('350.000 đ');
  });

  it('4. Đánh dấu lỗi (E1, E4) phía client và giữ nguyên dữ liệu đã nhập', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Đồ điện tử')).toBeInTheDocument();
    });

    const titleInput = screen.getByPlaceholderText(/VD: Bàn làm việc/i);
    const priceInput = screen.getByPlaceholderText(/VD: 250000/i);
    const descInput = screen.getByPlaceholderText(/Mô tả kỹ tình trạng sản phẩm/i);
    const submitBtn = screen.getByTestId('submit-listing-btn');

    // 1. Submit khi để trống hoàn toàn -> Đánh dấu lỗi E1
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('error-title')).toHaveTextContent(/tiêu đề/i);
    expect(screen.getByTestId('error-categoryId')).toHaveTextContent(/danh mục/i);
    expect(screen.getByTestId('error-price')).toHaveTextContent(/giá/i);
    expect(screen.getByTestId('error-description')).toHaveTextContent(/mô tả/i);

    // 2. Nhập tiêu đề quá 100 ký tự -> Báo lỗi E1
    const longTitle = 'a'.repeat(101);
    fireEvent.change(titleInput, { target: { value: longTitle } });
    fireEvent.click(submitBtn);
    expect(screen.getByTestId('error-title')).toHaveTextContent(/không được vượt quá 100 ký tự/i);

    // 3. Nhập giá ngoài khoảng cho phép (âm hoặc > 1 tỷ) -> Báo lỗi E4 (BR-05)
    fireEvent.change(priceInput, { target: { value: '2000000000' } }); // 2 tỷ
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByTestId('error-price')).toHaveTextContent(/0 đến 1.000.000.000/i);
    });

    // 4. Kiểm tra dữ liệu đã nhập được giữ nguyên (không bị reset)
    expect(titleInput.value).toBe(longTitle);
    expect(priceInput.value).toBe('2000000000');

    // Nhập mô tả hợp lệ, giá trị vẫn lưu trong state
    fireEvent.change(descInput, { target: { value: 'Mô tả bàn học gỗ thông chắc chắn' } });
    expect(descInput.value).toBe('Mô tả bàn học gỗ thông chắc chắn');
  });
});
