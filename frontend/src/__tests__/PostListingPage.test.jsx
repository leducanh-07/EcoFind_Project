/**
 * Tests for PostListingPage (UC-05, FR-08, BR-04, BR-05, TE9C744, TE9C745).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PostListingPage from '../pages/PostListingPage';
import * as categoriesApi from '../api/categories';

describe('PostListingPage Component (UC-05, TE9C744, TE9C745)', () => {
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

  test('Hiển thị form đăng tin cùng thành phần tải ảnh PhotoUploader và ConditionScorer', async () => {
    renderPage();

    expect(screen.getByText(/Đăng tin bán đồ cũ/i)).toBeInTheDocument();
    expect(screen.getByText(/Hình ảnh sản phẩm/i)).toBeInTheDocument();
    expect(screen.getByText(/Đánh giá tình trạng món đồ/i)).toBeInTheDocument();
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

  test('Chặn gửi tin và báo lỗi E3 khi điểm thành phần ngoài khoảng 0–10', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Đồ điện tử')).toBeInTheDocument();
    });

    // Điền đầy đủ thông tin
    fireEvent.change(screen.getByLabelText(/Tiêu đề tin đăng/i), {
      target: { value: 'Bàn phím cơ Bluetooth' },
    });
    fireEvent.change(screen.getByLabelText(/Danh mục hàng hóa/i), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText(/Giá bán/i), {
      target: { value: '350000' },
    });
    fireEvent.change(screen.getByLabelText(/Mô tả chi tiết/i), {
      target: { value: 'Phím gõ tốt, đầy đủ kết nối.' },
    });
    fireEvent.change(screen.getByLabelText(/Địa chỉ/i), {
      target: { value: '789 Võ Văn Ngân, TP. Thủ Đức' },
    });

    // Tải 1 ảnh hợp lệ
    const mockFile = new File(['valid content'], 'keyboard.jpg', { type: 'image/jpeg' });
    const fileInput = screen.getByTestId('photo-file-input');
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Nhập điểm ngoại quan không hợp lệ (15 > 10)
    const appInput = screen.getByTestId('score-appearance-input');
    fireEvent.change(appInput, { target: { value: '15' } });

    // Bấm Gửi duyệt
    const submitBtn = screen.getByTestId('submit-listing-btn');
    fireEvent.click(submitBtn);

    // Phải chặn lại và hiển thị lỗi E3
    expect(screen.queryByText(/Gửi tin đăng thành công!/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('e3-error-alert')).toBeInTheDocument();
    expect(screen.getByTestId('e3-error-alert')).toHaveTextContent(/từ 0 đến 10/i);
  });

  test('Gửi tin thành công khi có đủ thông tin, ảnh và 3 điểm thành phần hợp lệ (BR-01, BR-02)', async () => {
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

    // Chỉnh điểm thành phần (9, 8, 7 -> tổng 8.2 Hạng Tốt theo TC-05)
    fireEvent.change(screen.getByTestId('score-appearance-input'), { target: { value: '9' } });
    fireEvent.change(screen.getByTestId('score-function-input'), { target: { value: '8' } });
    fireEvent.change(screen.getByTestId('score-accessories-input'), { target: { value: '7' } });

    // Bấm gửi duyệt
    const submitBtn = screen.getByTestId('submit-listing-btn');
    fireEvent.click(submitBtn);

    // Màn hình thông báo thành công hiển thị điểm 8.2 và hạng Tốt
    expect(await screen.findByText(/Gửi tin đăng thành công!/i)).toBeInTheDocument();
    expect(screen.getByText(/Điểm đánh giá: 8.2\/10/i)).toBeInTheDocument();
    expect(screen.getByText(/Hạng: Tốt/i)).toBeInTheDocument();
    expect(screen.getByText(/Chờ duyệt \(Pending\)/i)).toBeInTheDocument();
  });
});
