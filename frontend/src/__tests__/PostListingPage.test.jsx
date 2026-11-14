/**
 * Tests for PostListingPage & MyListingsPage (UC-05, FR-08, FR-09, BR-01, BR-02, BR-04, BR-05, TE9C744, TE9C745, TE9C746).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PostListingPage from '../pages/PostListingPage';
import MyListingsPage from '../pages/MyListingsPage';
import * as categoriesApi from '../api/categories';
import * as listingsApi from '../api/listings';
import { ApiError } from '../api/client';

describe('PostListingPage & TE9C746: Gửi duyệt & Phản hồi kết quả', () => {
  const mockCategories = [
    { categoryId: 1, name: 'Đồ điện tử' },
    { categoryId: 2, name: 'Bàn ghế nội thất' },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(categoriesApi, 'getCategoriesApi').mockResolvedValue(mockCategories);
  });

  const renderPage = (initialEntries = ['/post']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/post" element={<PostListingPage />} />
          <Route path="/my-listings" element={<MyListingsPage />} />
        </Routes>
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

    // Bấm Gửi duyệt
    const submitBtn = screen.getByTestId('submit-listing-btn');
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Vui lòng tải lên ít nhất 1 ảnh sản phẩm \(BR-04\)/i)).toBeInTheDocument();
  });

  test('Chặn gửi tin và báo lỗi E3 khi điểm thành phần ngoài khoảng 0–10', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Đồ điện tử')).toBeInTheDocument();
    });

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

    const mockFile = new File(['valid content'], 'keyboard.jpg', { type: 'image/jpeg' });
    const fileInput = screen.getByTestId('photo-file-input');
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Nhập điểm ngoại quan không hợp lệ (15 > 10)
    const appInput = screen.getByTestId('score-appearance-input');
    fireEvent.change(appInput, { target: { value: '15' } });

    const submitBtn = screen.getByTestId('submit-listing-btn');
    fireEvent.click(submitBtn);

    expect(screen.queryByText(/Đã gửi, chờ duyệt/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('e3-error-alert')).toBeInTheDocument();
    expect(screen.getByTestId('e3-error-alert')).toHaveTextContent(/từ 0 đến 10/i);
  });

  test('TE9C746: Nút Gửi duyệt gửi multipart, có trạng thái đang gửi và chặn bấm 2 lần', async () => {
    let resolveApi;
    const apiPromise = new Promise((resolve) => {
      resolveApi = resolve;
    });
    const mockCreate = vi.spyOn(listingsApi, 'createListingApi').mockReturnValue(apiPromise);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Đồ điện tử')).toBeInTheDocument();
    });

    // Điền form hợp lệ
    fireEvent.change(screen.getByLabelText(/Tiêu đề tin đăng/i), {
      target: { value: 'Laptop Dell Latitude cũ' },
    });
    fireEvent.change(screen.getByLabelText(/Danh mục hàng hóa/i), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText(/Giá bán/i), {
      target: { value: '4500000' },
    });
    fireEvent.change(screen.getByLabelText(/Mô tả chi tiết/i), {
      target: { value: 'Máy cấu hình core i5, pin còn 3 tiếng.' },
    });
    fireEvent.change(screen.getByLabelText(/Địa chỉ/i), {
      target: { value: '12 Nguyễn Huệ, Quận 1' },
    });

    const mockFile = new File(['laptop image'], 'dell.jpg', { type: 'image/jpeg' });
    const fileInput = screen.getByTestId('photo-file-input');
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    const submitBtn = screen.getByTestId('submit-listing-btn');
    expect(submitBtn).toBeEnabled();

    // Bấm nút lần 1
    fireEvent.click(submitBtn);

    // Tiêu chí 1: Trạng thái đang gửi (loading spinner, disabled, text "Đang gửi...")
    expect(submitBtn).toBeDisabled();
    expect(screen.getByTestId('submitting-spinner')).toBeInTheDocument();
    expect(screen.getByText(/Đang gửi.../i)).toBeInTheDocument();

    // Tiêu chí 2: Chặn bấm 2 lần
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    // Kiểm tra gửi multipart với FormData
    const sentFormData = mockCreate.mock.calls[0][0];
    expect(sentFormData).toBeInstanceOf(FormData);
    expect(sentFormData.get('title')).toBe('Laptop Dell Latitude cũ');
    expect(sentFormData.get('price')).toBe('4500000');
    expect(sentFormData.get('categoryId')).toBe('1');

    // Cho API hoàn tất thành công
    await act(async () => {
      resolveApi({
        id: 99,
        status: 'pending',
        totalScore: 8.0,
        rank: 'Tốt',
        message: 'Đã gửi, chờ duyệt',
      });
    });

    // Tiêu chí 3: Thông báo 'Đã gửi, chờ duyệt'
    expect(await screen.findByTestId('success-status-text')).toHaveTextContent(/Đã gửi, chờ duyệt/i);
    // Tiêu chí 4: Tin chưa hiện trên bản đồ (FR-09)
    expect(screen.getByText(/Tin chưa hiện trên bản đồ công khai/i)).toBeInTheDocument();
  });

  test('TE9C746: Lỗi 400 từ server đánh dấu đúng trường theo fields', async () => {
    // Giả lập server trả 400 kèm fields
    const serverError = new ApiError('Dữ liệu không hợp lệ', 400, 400, {
      title: 'Tiêu đề vi phạm từ cấm quảng cáo',
      price: 'Giá bán phải từ 0 đến 1.000.000.000 đ (BR-05)',
      description: 'Mô tả quá ngắn',
    });
    vi.spyOn(listingsApi, 'createListingApi').mockRejectedValue(serverError);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Đồ điện tử')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Tiêu đề tin đăng/i), {
      target: { value: 'Bàn phím cơ' },
    });
    fireEvent.change(screen.getByLabelText(/Danh mục hàng hóa/i), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText(/Giá bán/i), {
      target: { value: '200000' },
    });
    fireEvent.change(screen.getByLabelText(/Mô tả chi tiết/i), {
      target: { value: 'Mô tả sản phẩm' },
    });
    fireEvent.change(screen.getByLabelText(/Địa chỉ/i), {
      target: { value: '123 Lê Duẩn, Quận 1' },
    });

    const mockFile = new File(['sample'], 'photo.jpg', { type: 'image/jpeg' });
    const fileInput = screen.getByTestId('photo-file-input');
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    const submitBtn = screen.getByTestId('submit-listing-btn');
    fireEvent.click(submitBtn);

    // Tiêu chí: Lỗi 400 đánh dấu đúng trường theo fields
    expect(await screen.findByTestId('global-error-banner')).toBeInTheDocument();
    expect(screen.getByTestId('error-title')).toHaveTextContent(/Tiêu đề vi phạm từ cấm/i);
    expect(screen.getByTestId('error-price')).toHaveTextContent(/Giá bán phải từ 0 đến 1.000.000.000 đ/i);
    expect(screen.getByTestId('error-description')).toHaveTextContent(/Mô tả quá ngắn/i);
  });

  test('TE9C746: Nộp thành công hiển thị nút chuyển sang Tin của tôi và điều hướng chính xác', async () => {
    vi.spyOn(listingsApi, 'createListingApi').mockResolvedValue({
      id: 88,
      status: 'pending',
      totalScore: 8.5,
      rank: 'Tốt',
      message: 'Đã gửi, chờ duyệt',
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Đồ điện tử')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Tiêu đề tin đăng/i), {
      target: { value: 'Tủ lạnh mini Aqua 90L' },
    });
    fireEvent.change(screen.getByLabelText(/Danh mục hàng hóa/i), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText(/Giá bán/i), {
      target: { value: '800000' },
    });
    fireEvent.change(screen.getByLabelText(/Mô tả chi tiết/i), {
      target: { value: 'Tủ dùng tốt cho sinh viên.' },
    });
    fireEvent.change(screen.getByLabelText(/Địa chỉ/i), {
      target: { value: '99 Hoàng Diệu, Quận 4' },
    });

    const mockFile = new File(['fridge'], 'fridge.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('photo-file-input');
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    const submitBtn = screen.getByTestId('submit-listing-btn');
    fireEvent.click(submitBtn);

    // Hiển thị card thành công
    expect(await screen.findByText(/Đã gửi, chờ duyệt/i)).toBeInTheDocument();
    expect(screen.getByTestId('go-to-my-listings-btn')).toBeInTheDocument();

    // Bấm nút chuyển sang "Tin của tôi"
    fireEvent.click(screen.getByTestId('go-to-my-listings-btn'));

    // Chuyển sang màn hình Tin của tôi
    expect(await screen.findByText(/Quản lý tin của tôi/i)).toBeInTheDocument();
    expect(screen.getByTestId('flash-success-banner')).toHaveTextContent(/Đã gửi, chờ duyệt/i);
    expect(screen.getByText(/Quy tắc FR-09:/i)).toBeInTheDocument();
    expect(screen.getByTestId('pending-listing-card')).toHaveTextContent(/Tủ lạnh mini Aqua 90L/i);
  });
});
