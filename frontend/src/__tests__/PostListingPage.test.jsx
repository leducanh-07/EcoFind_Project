/**
 * Tests for PostListingPage (UC-05, FR-08, BR-04, BR-05, TE9C744).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PostListingPage from '../pages/PostListingPage';
import * as categoriesApi from '../api/categories';

describe('PostListingPage Component (UC-05, TE9C744)', () => {
  const mockCategories = [
    { categoryId: 1, name: 'Đồ điện tử' },
    { categoryId: 2, name: 'Bàn ghế nội thất' },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(categoriesApi, 'getCategoriesApi').mockResolvedValue(mockCategories);
  });

  const renderPage = () => {
    return render(
      <MemoryRouter initialEntries={['/post']}>
        <PostListingPage />
      </MemoryRouter>
    );
  };

  test('Hiển thị form đăng tin cùng thành phần tải ảnh PhotoUploader', async () => {
    renderPage();

    expect(screen.getByText(/Đăng tin bán đồ cũ/i)).toBeInTheDocument();
    expect(screen.getByText(/Hình ảnh sản phẩm/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tiêu đề tin đăng/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Danh mục hàng hóa/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Giá bán/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Đồ điện tử')).toBeInTheDocument();
    });
  });

  test('Chặn gửi tin và báo lỗi khi chưa tải lên ảnh nào (Bắt buộc ít nhất 1 ảnh - BR-04)', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Đồ điện tử')).toBeInTheDocument();
    });

    // Điền các trường cơ bản nhưng bỏ trống ảnh
    fireEvent.change(screen.getByLabelText(/Tiêu đề tin đăng/i), {
      target: { value: 'Bàn học sinh thanh lý' },
    });
    fireEvent.change(screen.getByLabelText(/Danh mục hàng hóa/i), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText(/Giá bán/i), {
      target: { value: '150000' },
    });
    fireEvent.change(screen.getByLabelText(/Mô tả chi tiết/i), {
      target: { value: 'Bàn còn chắc chắn, dùng tốt.' },
    });
    fireEvent.change(screen.getByLabelText(/Địa chỉ/i), {
      target: { value: '123 Lê Duẩn, Quận 1' },
    });

    // Bấm Gửi duyệt tin đăng
    const submitBtn = screen.getByTestId('submit-listing-btn');
    fireEvent.click(submitBtn);

    // Phải hiển thị lỗi bắt buộc tải ít nhất 1 ảnh (BR-04)
    expect(await screen.findByText(/Vui lòng tải lên ít nhất 1 ảnh sản phẩm \(BR-04\)/i)).toBeInTheDocument();
  });

  test('Gửi tin thành công khi có đủ thông tin và đã tải ảnh', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Đồ điện tử')).toBeInTheDocument();
    });

    // Điền thông tin
    fireEvent.change(screen.getByLabelText(/Tiêu đề tin đăng/i), {
      target: { value: 'Nồi chiên không dầu Philips' },
    });
    fireEvent.change(screen.getByLabelText(/Danh mục hàng hóa/i), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText(/Giá bán/i), {
      target: { value: '500000' },
    });
    fireEvent.change(screen.getByLabelText(/Mô tả chi tiết/i), {
      target: { value: 'Đang dùng bình thường, chuyển nhà cần thanh lý.' },
    });
    fireEvent.change(screen.getByLabelText(/Địa chỉ/i), {
      target: { value: '456 Hai Bà Trưng, Quận 3' },
    });

    // Tải lên 1 ảnh hợp lệ
    const mockFile = new File(['valid content'], 'airfryer.jpg', { type: 'image/jpeg' });
    const fileInput = screen.getByTestId('photo-file-input');
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Kiểm tra ảnh đã được thêm
    expect(screen.getByTestId('photo-counter')).toHaveTextContent('1/5 ảnh');

    // Bấm gửi duyệt
    const submitBtn = screen.getByTestId('submit-listing-btn');
    fireEvent.click(submitBtn);

    // Màn hình thông báo thành công
    expect(await screen.findByText(/Gửi tin đăng thành công!/i)).toBeInTheDocument();
    expect(screen.getByText(/Chờ duyệt \(Pending\)/i)).toBeInTheDocument();
  });
});
