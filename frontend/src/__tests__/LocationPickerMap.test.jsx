import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import LocationPickerMap from '../components/LocationPickerMap';
import PostListingPage from '../pages/PostListingPage';
import { MemoryRouter } from 'react-router-dom';
import * as geocodeModule from '../api/geocode';
import * as categoriesModule from '../api/categories';

// Mock getCategoriesApi cho PostListingPage
vi.mock('../api/categories', () => ({
  getCategoriesApi: vi.fn().mockResolvedValue([
    { id: '1', name: 'Đồ điện tử' },
    { id: '2', name: 'Đồ gia dụng' },
  ]),
}));

describe('TE9C743: Form đăng tin – chọn vị trí trên bản đồ (UC-05, FR-08, UC-05 A1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('1. Hiển thị ô nhập địa chỉ, nút Tìm vị trí, nút Vị trí của tôi và container bản đồ', () => {
    render(
      <LocationPickerMap
        address="123 Nguyễn Huệ, Quận 1"
        lat={10.7769}
        lng={106.7009}
        onAddressChange={vi.fn()}
        onLocationChange={vi.fn()}
      />
    );

    // Kiểm tra ô nhập địa chỉ và nhãn bắt buộc (*)
    expect(screen.getByLabelText(/Địa chỉ giao dịch/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('123 Nguyễn Huệ, Quận 1')).toBeInTheDocument();

    // Nút tìm vị trí và nút vị trí của tôi
    expect(screen.getByTestId('geocode-search-btn')).toBeInTheDocument();
    expect(screen.getByTestId('locate-me-btn')).toBeInTheDocument();

    // Bản đồ và badge tọa độ
    expect(screen.getByTestId('location-picker-map')).toBeInTheDocument();
    expect(screen.getByTestId('selected-coords-badge')).toHaveTextContent('10.7769');
    expect(screen.getByTestId('selected-coords-badge')).toHaveTextContent('106.7009');
  });

  it('2. Nhập địa chỉ và tìm kiếm thành công gọi /api/geocode và cập nhật tọa độ marker', async () => {
    const mockGeocode = vi.spyOn(geocodeModule, 'geocodeAddressApi').mockResolvedValue({
      lat: 10.7725,
      lng: 106.6980,
    });

    const onLocationChange = vi.fn();
    const onAddressChange = vi.fn();

    render(
      <LocationPickerMap
        address="Nhà hát Thành Phố, Quận 1"
        lat={10.7769}
        lng={106.7009}
        onAddressChange={onAddressChange}
        onLocationChange={onLocationChange}
      />
    );

    const searchBtn = screen.getByTestId('geocode-search-btn');
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(mockGeocode).toHaveBeenCalledWith('Nhà hát Thành Phố, Quận 1');
    });

    await waitFor(() => {
      expect(onLocationChange).toHaveBeenCalledWith({
        lat: 10.7725,
        lng: 106.698,
      });
    });

    // Không hiển thị cảnh báo không tìm thấy
    expect(screen.queryByTestId('geocode-not-found-alert')).not.toBeInTheDocument();
  });

  it('3. Ngoại lệ UC-05 A1: Khi không tìm thấy địa chỉ thì hiển thị thông báo và cho phép ghim vị trí thủ công', async () => {
    vi.spyOn(geocodeModule, 'geocodeAddressApi').mockRejectedValue(
      new Error('Không tìm thấy địa chỉ (404 Not Found)')
    );

    const onLocationChange = vi.fn();

    render(
      <LocationPickerMap
        address="Địa chỉ ảo không có thật 99999 xyz"
        lat={10.7769}
        lng={106.7009}
        onAddressChange={vi.fn()}
        onLocationChange={onLocationChange}
      />
    );

    const searchBtn = screen.getByTestId('geocode-search-btn');
    fireEvent.click(searchBtn);

    // Hiển thị thông báo UC-05 A1
    const alertBox = await screen.findByTestId('geocode-not-found-alert');
    expect(alertBox).toBeInTheDocument();
    expect(alertBox).toHaveTextContent(/Không tìm thấy địa chỉ này trên bản đồ/i);
    expect(alertBox).toHaveTextContent(/chạm trực tiếp lên bản đồ hoặc kéo biểu tượng ghim/i);

    // Không crash, bản đồ vẫn hiển thị để người dùng ghim tay
    expect(screen.getByTestId('location-picker-map')).toBeInTheDocument();
  });

  it('4. Hỗ trợ định vị vị trí hiện tại qua nút "Vị trí của tôi"', async () => {
    const mockGetCurrentPosition = vi.fn().mockImplementation((success) => {
      success({
        coords: {
          latitude: 10.762622,
          longitude: 106.682333,
        },
      });
    });

    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: mockGetCurrentPosition,
      },
    });

    const onLocationChange = vi.fn();

    render(
      <LocationPickerMap
        address=""
        lat={10.7769}
        lng={106.7009}
        onAddressChange={vi.fn()}
        onLocationChange={onLocationChange}
      />
    );

    const locateBtn = screen.getByTestId('locate-me-btn');
    fireEvent.click(locateBtn);

    await waitFor(() => {
      expect(mockGetCurrentPosition).toHaveBeenCalled();
      expect(onLocationChange).toHaveBeenCalledWith({
        lat: 10.762622,
        lng: 106.682333,
      });
    });
  });

  it('5. Tích hợp trong Form đăng tin (PostListingPage) - bắt buộc có vị trí trước khi gửi duyệt', async () => {
    render(
      <MemoryRouter>
        <PostListingPage />
      </MemoryRouter>
    );

    // Đợi tải danh mục
    await waitFor(() => {
      expect(screen.getByText('Đồ điện tử')).toBeInTheDocument();
    });

    // LocationPickerMap hiện diện trong trang
    expect(screen.getByTestId('location-picker-map-container')).toBeInTheDocument();

    // Bấm Gửi duyệt khi chưa có địa chỉ -> Báo lỗi E1
    const submitBtn = screen.getByTestId('submit-listing-btn');
    fireEvent.click(submitBtn);

    const errorAddr = await screen.findByTestId('error-address');
    expect(errorAddr).toHaveTextContent(/Vui lòng nhập địa chỉ giao dịch/i);
  });
});
