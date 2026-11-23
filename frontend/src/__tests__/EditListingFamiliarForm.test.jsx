/**
 * Tests for Edit Listing Familiar Form (TE9C750, UC-06, FR-10, UC-06 A1 A2 E2).
 * Acceptance Criteria & Traceability:
 *  1. Mở form điền sẵn dữ liệu (title, category, price, address, description, 3 điểm tình trạng, ảnh).
 *  2. Cảnh báo 'Sửa điểm hoặc ảnh sẽ phải duyệt lại' trước khi lưu.
 *  3. Sửa giá hoặc mô tả lưu ngay, không duyệt lại.
 *  4. Tin rejected có nút Gửi lại (mở form điền sẵn lý do từ chối, nút Gửi lại gọi API và chuyển về pending).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MyListingsPage from '../pages/MyListingsPage';
import * as listingsApi from '../api/listings';
import * as categoriesApi from '../api/categories';

vi.mock('../api/listings', () => ({
  getMyListingsApi: vi.fn(),
  updateListingApi: vi.fn(),
  updateListingStatusApi: vi.fn(),
  uploadPhotosApi: vi.fn(),
}));

vi.mock('../api/categories', () => ({
  getCategoriesApi: vi.fn(),
}));

const mockCategories = [
  { id: 1, name: 'Đồ điện tử' },
  { id: 2, name: 'Đồ gia dụng' },
];

const mockListings = [
  {
    id: 101,
    title: 'Nồi cơm điện Cuckoo',
    price: 350000,
    address: '123 Lê Lợi, Q.1',
    description: 'Nồi nấu ngon, giữ ấm tốt',
    categoryId: 2,
    categoryName: 'Đồ gia dụng',
    status: 'selling',
    hidden_by_admin: false,
    scoreAppearance: 8.0,
    scoreFunction: 9.0,
    scoreAccessories: 8.0,
    totalScore: 8.4,
    rank: 'Tốt',
    photos: [{ id: 1, url: 'https://img.ecofind.vn/cuckoo.jpg', sort_order: 0 }],
  },
  {
    id: 102,
    title: 'Bàn phím cơ hỏng LED',
    price: 150000,
    address: '456 Hai Bà Trưng, Q.3',
    description: 'Bàn phím gõ tốt, mất LED vài phím',
    categoryId: 1,
    categoryName: 'Đồ điện tử',
    status: 'rejected',
    rejectReason: 'Ảnh sản phẩm mờ, không chụp rõ vết trầy xước',
    hidden_by_admin: false,
    scoreAppearance: 6.0,
    scoreFunction: 7.0,
    scoreAccessories: 5.0,
    totalScore: 6.2,
    rank: 'Khá',
    photos: [{ id: 2, url: 'https://img.ecofind.vn/kb.jpg', sort_order: 0 }],
  },
];

describe('TE9C750: Form sửa tin quen thuộc & cảnh báo duyệt lại (UC-06, FR-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    categoriesApi.getCategoriesApi.mockResolvedValue(mockCategories);
    listingsApi.getMyListingsApi.mockResolvedValue(mockListings);
    listingsApi.updateListingStatusApi.mockResolvedValue({ success: true });
    listingsApi.updateListingApi.mockResolvedValue({
      id: 101,
      status: 'selling',
      title: 'Nồi cơm điện Cuckoo',
    });
  });

  it('1. Mở form điền sẵn đầy đủ dữ liệu (title, price, description, address, category, scores)', async () => {
    render(
      <MemoryRouter>
        <MyListingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('btn-edit-101')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-edit-101'));

    // Modal xuất hiện
    expect(screen.getByTestId('edit-listing-modal')).toBeInTheDocument();

    // Điền sẵn tiêu đề
    const titleInput = screen.getByPlaceholderText(/bàn phím cơ/i);
    expect(titleInput.value).toBe('Nồi cơm điện Cuckoo');

    // Điền sẵn giá
    const priceInput = screen.getByPlaceholderText(/cho tặng/i);
    expect(priceInput.value).toBe('350000');

    // Điền sẵn địa chỉ
    const addressInput = screen.getByPlaceholderText(/123 lê lợi/i);
    expect(addressInput.value).toBe('123 Lê Lợi, Q.1');

    // Điền sẵn mô tả
    const descInput = screen.getByPlaceholderText(/mô tả tình trạng/i);
    expect(descInput.value).toBe('Nồi nấu ngon, giữ ấm tốt');

    // Điền sẵn banner cảnh báo duyệt lại
    const warningBanner = screen.getByTestId('edit-warning-banner');
    expect(warningBanner).toHaveTextContent('Sửa điểm hoặc ảnh sẽ phải duyệt lại');
  });

  it('2. Sửa giá hoặc mô tả: hiển thị thông báo lưu ngay không duyệt lại và lưu thành công', async () => {
    listingsApi.updateListingApi.mockResolvedValue({
      id: 101,
      status: 'selling',
      price: 400000,
      description: 'Mô tả mới đã sửa',
    });

    render(
      <MemoryRouter>
        <MyListingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('btn-edit-101')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-edit-101'));

    // Khi chỉ sửa giá hoặc mô tả (không đổi điểm hay ảnh):
    // Hiện thông báo: Sửa giá hoặc mô tả lưu ngay, không duyệt lại
    expect(screen.getByTestId('edit-no-review-notice')).toBeInTheDocument();
    expect(screen.getByTestId('edit-no-review-notice')).toHaveTextContent(
      'Sửa giá hoặc mô tả lưu ngay, không duyệt lại'
    );
    expect(screen.queryByTestId('edit-review-warning')).not.toBeInTheDocument();

    // Thay đổi giá bán
    const priceInput = screen.getByPlaceholderText(/cho tặng/i);
    fireEvent.change(priceInput, { target: { value: '400000' } });

    // Thay đổi mô tả
    const descInput = screen.getByPlaceholderText(/mô tả tình trạng/i);
    fireEvent.change(descInput, { target: { value: 'Mô tả mới đã sửa' } });

    // Vẫn hiển thị lưu ngay không duyệt lại
    expect(screen.getByTestId('edit-no-review-notice')).toBeInTheDocument();

    // Lưu thay đổi
    fireEvent.click(screen.getByTestId('btn-save-edit'));

    await waitFor(() => {
      expect(listingsApi.updateListingApi).toHaveBeenCalledWith(
        101,
        expect.objectContaining({
          price: 400000,
          description: 'Mô tả mới đã sửa',
        })
      );
      expect(screen.getByTestId('success-toast')).toHaveTextContent(
        'Sửa giá hoặc mô tả lưu ngay, không duyệt lại'
      );
    });
  });

  it('3. Sửa điểm tình trạng: hiển thị cảnh báo duyệt lại trước khi lưu và chuyển về pending', async () => {
    listingsApi.updateListingApi.mockResolvedValue({
      id: 101,
      status: 'pending',
      title: 'Nồi cơm điện Cuckoo',
    });

    render(
      <MemoryRouter>
        <MyListingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('btn-edit-101')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-edit-101'));

    // Sửa điểm ngoại quan từ 8 lên 9 bằng slider ConditionScorer
    const appearanceSlider = screen.getByTestId('score-appearance-slider');
    fireEvent.change(appearanceSlider, { target: { value: '9' } });

    // Xuất hiện cảnh báo sửa điểm sẽ phải duyệt lại
    await waitFor(() => {
      expect(screen.getByTestId('edit-review-warning')).toBeInTheDocument();
      expect(screen.getByTestId('edit-review-warning')).toHaveTextContent(
        'Cảnh báo: Sửa điểm hoặc ảnh sẽ phải duyệt lại'
      );
      expect(screen.getByTestId('badge-scores-changed')).toBeInTheDocument();
    });

    // Lưu thay đổi
    fireEvent.click(screen.getByTestId('btn-save-edit'));

    await waitFor(() => {
      expect(listingsApi.updateListingApi).toHaveBeenCalledWith(
        101,
        expect.objectContaining({
          scoreAppearance: 9,
        })
      );
      expect(screen.getByTestId('success-toast')).toHaveTextContent(
        'Do bạn đã sửa điểm hoặc ảnh, tin đã chuyển về Chờ duyệt'
      );
    });
  });

  it('4. Tin rejected có nút Gửi lại: mở form kèm lý do từ chối và nút Gửi lại gọi API thành công', async () => {
    listingsApi.updateListingApi.mockResolvedValue({
      id: 102,
      status: 'pending',
      title: 'Bàn phím cơ hỏng LED',
    });

    render(
      <MemoryRouter>
        <MyListingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Bàn phím cơ hỏng LED')).toBeInTheDocument();
    });

    // 1. Tin rejected có nút Gửi lại
    const resubmitBtn = screen.getByTestId('btn-resubmit-102');
    expect(resubmitBtn).toBeInTheDocument();
    expect(resubmitBtn).toHaveTextContent('Gửi lại');

    // 2. Bấm Gửi lại mở form sửa tin
    fireEvent.click(resubmitBtn);

    expect(screen.getByTestId('edit-listing-modal')).toBeInTheDocument();

    // Hiển thị lý do từ chối trước đó
    const rejectNotice = screen.getByTestId('edit-modal-reject-reason');
    expect(rejectNotice).toBeInTheDocument();
    expect(rejectNotice).toHaveTextContent('Ảnh sản phẩm mờ, không chụp rõ vết trầy xước');

    // Cảnh báo tin gửi lại sẽ chuyển về pending để duyệt lại
    expect(screen.getByTestId('edit-review-warning')).toBeInTheDocument();

    // Nút submit trong modal có nhãn "Gửi lại"
    const saveBtn = screen.getByTestId('btn-save-edit');
    expect(saveBtn).toHaveTextContent('Gửi lại');

    // Bấm Gửi lại
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(listingsApi.updateListingApi).toHaveBeenCalledWith(
        102,
        expect.objectContaining({
          title: 'Bàn phím cơ hỏng LED',
        })
      );
      expect(screen.getByTestId('success-toast')).toHaveTextContent(
        'Đã gửi lại tin đăng thành công'
      );
    });
  });

  it('5. Sửa ảnh sản phẩm: hiển thị badge và cảnh báo duyệt lại', async () => {
    listingsApi.updateListingApi.mockResolvedValue({
      id: 101,
      status: 'pending',
    });

    render(
      <MemoryRouter>
        <MyListingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('btn-edit-101')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-edit-101'));

    // Xóa ảnh đầu tiên trong PhotoUploader
    const deleteBtn = screen.getByTestId('delete-photo-0');
    fireEvent.click(deleteBtn);

    // Xuất hiện badge đã sửa ảnh và cảnh báo duyệt lại
    await waitFor(() => {
      expect(screen.getByTestId('badge-photos-changed')).toHaveTextContent(
        'Đã sửa ảnh (cần duyệt lại)'
      );
      expect(screen.getByTestId('edit-review-warning')).toBeInTheDocument();
    });
  });
});
