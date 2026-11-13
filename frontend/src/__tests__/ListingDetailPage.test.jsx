import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ListingDetailPage from '../pages/ListingDetailPage';
import { AuthProvider } from '../context/AuthContext';
import * as listingsApi from '../api/listings';

describe('ListingDetailPage Component (UC-04, FR-07, BR-01, BR-05, TC-04, TE9C736)', () => {
  const mockListingData = {
    listingId: 10,
    title: 'Bàn học gỗ thông còn rất mới',
    description: 'Bàn học mua được 6 tháng, chuyển nhà nên thanh lý gấp.',
    price: 350000,
    address: '123 Nguyễn Thị Minh Khai, Q1, TP.HCM',
    categoryId: 2,
    categoryName: 'Bàn ghế',
    sellerId: 5,
    sellerName: 'Nguyễn Văn A',
    phone: null,
    scoreAppearance: 9.0,
    scoreFunction: 9.0,
    scoreAccessories: 8.0,
    totalScore: 8.8,
    rank: 'Tốt',
    status: 'available',
    createdAt: '2026-11-09T10:00:00Z',
    photos: [
      { id: 1, url: 'https://example.com/photo1.jpg', isPrimary: true },
      { id: 2, url: 'https://example.com/photo2.jpg', isPrimary: false },
    ],
  };

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderComponent = (listingId = '10') => {
    return render(
      <AuthProvider>
        <MemoryRouter initialEntries={[`/listings/${listingId}`]}>
          <Routes>
            <Route path="/listings/:id" element={<ListingDetailPage />} />
            <Route path="/login" element={<div>Trang đăng nhập</div>} />
            <Route path="/" element={<div>Trang chủ bản đồ</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
  };

  test('1. Hiển thị đầy đủ thông tin tin đăng khi tải thành công', async () => {
    vi.spyOn(listingsApi, 'getListingDetailApi').mockResolvedValue(mockListingData);

    renderComponent();

    // Kiểm tra trạng thái đang tải trước
    expect(screen.getByText(/Đang tải thông tin tin đăng/i)).toBeInTheDocument();

    // Đợi render dữ liệu
    await waitFor(() => {
      expect(screen.getByText('Bàn học gỗ thông còn rất mới')).toBeInTheDocument();
    });

    expect(screen.getByText('350.000 đ')).toBeInTheDocument();
    expect(screen.getByText('Bàn ghế')).toBeInTheDocument();
    expect(screen.getByText(/123 Nguyễn Thị Minh Khai/i)).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText(/Bàn học mua được 6 tháng/i)).toBeInTheDocument();
  });

  test('2. Hiển thị nhãn "Cho tặng" và "Miễn phí" khi giá bằng 0 (BR-05)', async () => {
    const freeItem = {
      ...mockListingData,
      price: 0,
      title: 'Tặng giáo trình kinh tế đại cương',
    };
    vi.spyOn(listingsApi, 'getListingDetailApi').mockResolvedValue(freeItem);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Tặng giáo trình kinh tế đại cương')).toBeInTheDocument();
    });

    expect(screen.getByText('Cho tặng')).toBeInTheDocument();
    expect(screen.getByText('Miễn phí')).toBeInTheDocument();
  });

  test('3. Hiển thị thang điểm tình trạng và giải thích công thức (BR-01, BR-02)', async () => {
    vi.spyOn(listingsApi, 'getListingDetailApi').mockResolvedValue(mockListingData);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('8.8')).toBeInTheDocument();
    });

    expect(screen.getByText('Tốt')).toBeInTheDocument();
    expect(screen.getByText(/1. Ngoại quan/i)).toBeInTheDocument();
    expect(screen.getAllByText('9 / 10').length).toBe(2);
    expect(screen.getByText(/2. Chức năng/i)).toBeInTheDocument();
    expect(screen.getByText(/3. Phụ kiện đi kèm/i)).toBeInTheDocument();
    expect(screen.getByText('8 / 10')).toBeInTheDocument();

    // Công thức BR-01
    expect(
      screen.getByText(/Điểm tổng = 0,4 × Ngoại quan \+ 0,4 × Chức năng \+ 0,2 × Phụ kiện/i)
    ).toBeInTheDocument();
  });

  test('4. Chuyển ảnh trong gallery khi bấm thumbnail và nút Next/Prev', async () => {
    vi.spyOn(listingsApi, 'getListingDetailApi').mockResolvedValue(mockListingData);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Ảnh 1 / 2')).toBeInTheDocument();
    });

    const nextBtn = screen.getByLabelText('Ảnh kế tiếp');
    fireEvent.click(nextBtn);
    expect(screen.getByText('Ảnh 2 / 2')).toBeInTheDocument();

    const prevBtn = screen.getByLabelText('Ảnh trước');
    fireEvent.click(prevBtn);
    expect(screen.getByText('Ảnh 1 / 2')).toBeInTheDocument();
  });

  test('5. Người dùng vãng lai (chưa đăng nhập): ẩn SĐT và có nút chuyển tới /login (TC-04)', async () => {
    vi.spyOn(listingsApi, 'getListingDetailApi').mockResolvedValue({
      ...mockListingData,
      phone: null,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('09•• ••• •••')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Số điện thoại chỉ hiển thị khi bạn đã đăng nhập/i)
    ).toBeInTheDocument();

    const loginBtn = screen.getByRole('button', {
      name: /Đăng nhập để xem số điện thoại/i,
    });
    expect(loginBtn).toBeInTheDocument();

    fireEvent.click(loginBtn);
    expect(await screen.findByText('Trang đăng nhập')).toBeInTheDocument();
  });

  test('6. Người dùng đã đăng nhập: hiển thị số điện thoại thực tế và nút gọi (TC-04)', async () => {
    localStorage.setItem('access_token', 'mock_token');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ userId: 1, email: 'buyer@ecofind.vn', role: 'user' })
    );

    vi.spyOn(listingsApi, 'getListingDetailApi').mockResolvedValue({
      ...mockListingData,
      phone: '0987654321',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('0987654321')).toBeInTheDocument();
    });

    expect(screen.getByText(/Gọi điện cho người bán/i)).toBeInTheDocument();
    expect(screen.queryByText('09•• ••• •••')).not.toBeInTheDocument();
  });

  test('7. Hiển thị thông báo 404 khi tin bị xóa, ẩn hoặc không tìm thấy (UC-04 E1)', async () => {
    vi.spyOn(listingsApi, 'getListingDetailApi').mockRejectedValue(
      new Error('Tin không còn hiển thị')
    );

    renderComponent('999');

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Tin không còn hiển thị/i })
      ).toBeInTheDocument();
    });

    const backBtn = screen.getByRole('link', { name: /Quay về bản đồ/i });
    expect(backBtn).toBeInTheDocument();
  });

  test('8. TE9C73C: Đã đăng nhập: hiển thị đầy đủ SĐT, nút Lưu và nút Báo cáo', async () => {
    localStorage.setItem('access_token', 'mock_token');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ userId: 1, email: 'buyer@ecofind.vn', role: 'user' })
    );

    vi.spyOn(listingsApi, 'getListingDetailApi').mockResolvedValue({
      ...mockListingData,
      phone: '0912345678',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('0912345678')).toBeInTheDocument();
    });

    // Kiểm tra nút Lưu tin và nút Báo cáo
    const saveBtn = screen.getByTestId('btn-save-listing');
    const reportBtn = screen.getByTestId('btn-report-listing');

    expect(saveBtn).toBeInTheDocument();
    expect(saveBtn).toHaveTextContent(/Lưu tin/i);
    expect(reportBtn).toBeInTheDocument();
    expect(reportBtn).toHaveTextContent(/Báo cáo/i);
  });

  test('9. TE9C73C: Bấm nút Lưu tin đổi trạng thái, bấm Báo cáo mở modal báo cáo', async () => {
    localStorage.setItem('access_token', 'mock_token');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ userId: 1, email: 'buyer@ecofind.vn', role: 'user' })
    );

    vi.spyOn(listingsApi, 'getListingDetailApi').mockResolvedValue({
      ...mockListingData,
      phone: '0912345678',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('0912345678')).toBeInTheDocument();
    });

    const saveBtn = screen.getByTestId('btn-save-listing');
    fireEvent.click(saveBtn);
    expect(screen.getByText(/Đã lưu/i)).toBeInTheDocument();

    const reportBtn = screen.getByTestId('btn-report-listing');
    fireEvent.click(reportBtn);

    expect(screen.getByText(/Báo cáo tin đăng vi phạm/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gửi báo cáo/i })).toBeInTheDocument();

    const submitReportBtn = screen.getByRole('button', { name: /Gửi báo cáo/i });
    fireEvent.click(submitReportBtn);

    await waitFor(() => {
      expect(screen.getByText(/Gửi báo cáo thành công/i)).toBeInTheDocument();
    });
  });
});
