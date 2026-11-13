import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MapView from '../components/MapView';
import * as listingsApi from '../api/listings';

describe('TE9C73E: Thông báo lỗi tải bản đồ & nút Thử lại (UC-02 E1)', () => {
  const DEFAULT_COORDS = { lat: 10.7769, lng: 106.7009 };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Khi API lỗi: hiển thị thông báo lỗi và nút Thử lại trên bản đồ, trang không bị trắng', async () => {
    vi.spyOn(listingsApi, 'getListingsMapApi').mockRejectedValue(
      new Error('Mất kết nối tới máy chủ')
    );

    const handleFetchError = vi.fn();

    await act(async () => {
      render(
        <MemoryRouter>
          <MapView
            coords={DEFAULT_COORDS}
            loadingLocation={false}
            locationError={null}
            isFallback={false}
            onLocateMe={vi.fn()}
            onFetchError={handleFetchError}
          />
        </MemoryRouter>
      );
    });

    // Bản đồ vẫn render bình thường, trang không bị trắng
    expect(screen.getByRole('button', { name: /^Thu nhỏ$/i })).toBeInTheDocument();

    // Hiển thị banner lỗi và nút Thử lại
    await waitFor(() => {
      expect(screen.getByTestId('map-error-banner')).toBeInTheDocument();
    });

    expect(screen.getByText('Không thể tải dữ liệu bản đồ')).toBeInTheDocument();
    expect(screen.getByText('Mất kết nối tới máy chủ')).toBeInTheDocument();

    const retryBtn = screen.getByTestId('map-retry-btn');
    expect(retryBtn).toBeInTheDocument();
    expect(retryBtn).toHaveTextContent(/Thử lại/i);

    expect(handleFetchError).toHaveBeenCalledWith('Mất kết nối tới máy chủ');
  });

  it('2. Bấm nút "Thử lại" gọi lại API tải danh sách tin và ẩn banner lỗi khi thành công', async () => {
    const mockGetListings = vi
      .spyOn(listingsApi, 'getListingsMapApi')
      .mockRejectedValueOnce(new Error('Lỗi timeout'))
      .mockResolvedValueOnce([
        {
          id: 1,
          title: 'Xe đạp học sinh',
          price: 200000,
          lat: 10.7769,
          lng: 106.7009,
          totalScore: 8.0,
          rank: 'Tốt',
          address: 'Quận 1, TP.HCM',
        },
      ]);

    await act(async () => {
      render(
        <MemoryRouter>
          <MapView
            coords={DEFAULT_COORDS}
            loadingLocation={false}
            locationError={null}
            isFallback={false}
            onLocateMe={vi.fn()}
          />
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('map-error-banner')).toBeInTheDocument();
    });

    // Bấm nút Thử lại
    const retryBtn = screen.getByTestId('map-retry-btn');
    await act(async () => {
      fireEvent.click(retryBtn);
    });

    // API được gọi lại
    expect(mockGetListings).toHaveBeenCalledTimes(2);

    // Banner lỗi biến mất khi tải lại thành công
    await waitFor(() => {
      expect(screen.queryByTestId('map-error-banner')).not.toBeInTheDocument();
    });
  });

  it('3. Bấm nút đóng (X) trên banner lỗi thì ẩn banner đi', async () => {
    vi.spyOn(listingsApi, 'getListingsMapApi').mockRejectedValue(
      new Error('Lỗi máy chủ 500')
    );

    await act(async () => {
      render(
        <MemoryRouter>
          <MapView
            coords={DEFAULT_COORDS}
            loadingLocation={false}
            locationError={null}
            isFallback={false}
            onLocateMe={vi.fn()}
          />
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('map-error-banner')).toBeInTheDocument();
    });

    const closeBtn = screen.getByRole('button', { name: /Đóng thông báo/i });
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    expect(screen.queryByTestId('map-error-banner')).not.toBeInTheDocument();
  });
});
