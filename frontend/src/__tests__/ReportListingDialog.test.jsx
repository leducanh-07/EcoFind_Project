import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ListingDetailPage from '../pages/ListingDetailPage';
import { AuthProvider } from '../context/AuthContext';
import * as listingsApi from '../api/listings';

describe('TE9C754: Form báo cáo tin vi phạm (UC-08, FR-12)', () => {
  const mockListing = {
    id: 100,
    listingId: 100,
    title: 'Bàn phím cơ AKKO cũ 95%',
    description: 'Bàn phím cơ gõ êm, ít dùng còn rất mới.',
    price: 650000,
    address: '789 Điện Biên Phủ, Q.Bình Thạnh, TP.HCM',
    categoryId: 1,
    categoryName: 'Đồ điện tử',
    sellerId: 10,
    sellerName: 'Người Bán 10',
    phone: '0901234567',
    scoreAppearance: 9.0,
    scoreFunction: 9.5,
    scoreAccessories: 8.5,
    totalScore: 9.1,
    rank: 'Rất tốt',
    status: 'selling',
    createdAt: '2026-11-15T08:00:00Z',
    photos: [
      { id: 1, url: 'https://example.com/keyboard.jpg', isPrimary: true },
    ],
  };

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderPage = (listingId = '100') => {
    return render(
      <AuthProvider>
        <MemoryRouter initialEntries={[`/listings/${listingId}`]}>
          <Routes>
            <Route path="/listings/:id" element={<ListingDetailPage />} />
            <Route path="/login" element={<div>Trang đăng nhập</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
  };

  test('1. Ẩn nút Báo cáo với tin của chính mình (E3)', async () => {
    // Đăng nhập với userId = 10 (trùng với sellerId của mockListing)
    localStorage.setItem('access_token', 'mock_seller_token');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ userId: 10, email: 'seller10@ecofind.vn', role: 'user' })
    );

    vi.spyOn(listingsApi, 'getListingDetailApi').mockResolvedValue(mockListing);

    renderPage('100');

    await waitFor(() => {
      expect(screen.getByText('Bàn phím cơ AKKO cũ 95%')).toBeInTheDocument();
    });

    // Nút Lưu tin vẫn có, nhưng nút Báo cáo BỊ ẨN
    expect(screen.getByTestId('btn-save-listing')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-report-listing')).not.toBeInTheDocument();
  });

  test('2. Hiển thị nút Báo cáo khi xem tin của người khác và mở hộp thoại', async () => {
    // Đăng nhập với userId = 20 (khác với sellerId = 10)
    localStorage.setItem('access_token', 'mock_buyer_token');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ userId: 20, email: 'buyer20@ecofind.vn', role: 'user' })
    );

    vi.spyOn(listingsApi, 'getListingDetailApi').mockResolvedValue(mockListing);

    renderPage('100');

    await waitFor(() => {
      expect(screen.getByText('Bàn phím cơ AKKO cũ 95%')).toBeInTheDocument();
    });

    const reportBtn = screen.getByTestId('btn-report-listing');
    expect(reportBtn).toBeInTheDocument();

    // Bấm nút Báo cáo -> mở modal
    fireEvent.click(reportBtn);

    expect(screen.getByTestId('report-listing-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Báo cáo tin đăng vi phạm/i)).toBeInTheDocument();
  });

  test('3. Hộp thoại có đủ 4 lý do lựa chọn: wrong_score, scam, prohibited, other', async () => {
    localStorage.setItem('access_token', 'mock_buyer_token');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ userId: 20, email: 'buyer20@ecofind.vn', role: 'user' })
    );

    vi.spyOn(listingsApi, 'getListingDetailApi').mockResolvedValue(mockListing);

    renderPage('100');

    await waitFor(() => {
      expect(screen.getByText('Bàn phím cơ AKKO cũ 95%')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-report-listing'));

    const reasonSelect = screen.getByTestId('report-reason-select');
    expect(reasonSelect).toBeInTheDocument();

    // Kiểm tra 4 options
    const options = Array.from(reasonSelect.querySelectorAll('option')).map((o) => ({
      value: o.value,
      text: o.textContent,
    }));

    expect(options).toEqual([
      { value: 'wrong_score', text: 'Sai điểm tình trạng' },
      { value: 'scam', text: 'Lừa đảo' },
      { value: 'prohibited', text: 'Hàng cấm' },
      { value: 'other', text: 'Lý do khác' },
    ]);

    // Thử đổi sang lý do 'scam'
    fireEvent.change(reasonSelect, { target: { value: 'scam' } });
    expect(reasonSelect.value).toBe('scam');
  });

  test('4. Ghi chú tùy chọn có bộ đếm ký tự (tối đa 200 ký tự)', async () => {
    localStorage.setItem('access_token', 'mock_buyer_token');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ userId: 20, email: 'buyer20@ecofind.vn', role: 'user' })
    );

    vi.spyOn(listingsApi, 'getListingDetailApi').mockResolvedValue(mockListing);

    renderPage('100');

    await waitFor(() => {
      expect(screen.getByText('Bàn phím cơ AKKO cũ 95%')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-report-listing'));

    const counter = screen.getByTestId('report-note-counter');
    const textarea = screen.getByTestId('report-detail-textarea');

    // Ban đầu bộ đếm là 0/200
    expect(counter).toHaveTextContent('0/200');

    // Nhập nội dung
    fireEvent.change(textarea, { target: { value: 'Nghi ngờ hàng nhái không chính hãng' } });
    expect(counter).toHaveTextContent('35/200');

    // Nhập chuỗi vượt quá 200 ký tự -> bị cắt còn đúng 200
    const overText = 'A'.repeat(250);
    fireEvent.change(textarea, { target: { value: overText } });
    expect(textarea.value.length).toBe(200);
    expect(counter).toHaveTextContent('200/200');
  });

  test('5. Gửi báo cáo thành công: gọi API và hiển thị thông báo đã nhận', async () => {
    localStorage.setItem('access_token', 'mock_buyer_token');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ userId: 20, email: 'buyer20@ecofind.vn', role: 'user' })
    );

    vi.spyOn(listingsApi, 'getListingDetailApi').mockResolvedValue(mockListing);
    const mockReportApi = vi.spyOn(listingsApi, 'reportListingApi').mockResolvedValue({
      reportId: 1,
      listingId: 100,
      status: 'new',
      message: 'Đã gửi báo cáo thành công, Admin sẽ kiểm duyệt.',
    });

    renderPage('100');

    await waitFor(() => {
      expect(screen.getByText('Bàn phím cơ AKKO cũ 95%')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-report-listing'));

    // Chọn lý do scam và nhập ghi chú
    const reasonSelect = screen.getByTestId('report-reason-select');
    fireEvent.change(reasonSelect, { target: { value: 'scam' } });

    const textarea = screen.getByTestId('report-detail-textarea');
    fireEvent.change(textarea, { target: { value: 'Yêu cầu chuyển cọc rồi chặn số' } });

    const submitBtn = screen.getByTestId('btn-submit-report');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockReportApi).toHaveBeenCalledWith('100', {
        reason: 'scam',
        note: 'Yêu cầu chuyển cọc rồi chặn số',
      });
      expect(screen.getByTestId('report-success-state')).toBeInTheDocument();
      expect(screen.getByText(/Gửi báo cáo thành công/i)).toBeInTheDocument();
      expect(screen.getByText(/Thông báo đã nhận/i)).toBeInTheDocument();
    });
  });

  test('6. Xử lý lỗi E1: "Bạn đã báo cáo tin này" khi API trả 409 Conflict', async () => {
    localStorage.setItem('access_token', 'mock_buyer_token');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ userId: 20, email: 'buyer20@ecofind.vn', role: 'user' })
    );

    vi.spyOn(listingsApi, 'getListingDetailApi').mockResolvedValue(mockListing);
    const conflictError = new Error('Bạn đã báo cáo tin đăng này trước đó rồi');
    conflictError.status = 409;
    conflictError.code = 409;
    vi.spyOn(listingsApi, 'reportListingApi').mockRejectedValue(conflictError);

    renderPage('100');

    await waitFor(() => {
      expect(screen.getByText('Bàn phím cơ AKKO cũ 95%')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-report-listing'));

    const submitBtn = screen.getByTestId('btn-submit-report');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const errorBanner = screen.getByTestId('report-error-message');
      expect(errorBanner).toBeInTheDocument();
      expect(errorBanner).toHaveTextContent(/Bạn đã báo cáo tin này/i);
    });
  });

  test('7. Bấm Hủy đóng hộp thoại báo cáo', async () => {
    localStorage.setItem('access_token', 'mock_buyer_token');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ userId: 20, email: 'buyer20@ecofind.vn', role: 'user' })
    );

    vi.spyOn(listingsApi, 'getListingDetailApi').mockResolvedValue(mockListing);

    renderPage('100');

    await waitFor(() => {
      expect(screen.getByText('Bàn phím cơ AKKO cũ 95%')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-report-listing'));
    expect(screen.getByTestId('report-listing-dialog')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Hủy/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByTestId('report-listing-dialog')).not.toBeInTheDocument();
  });
});
