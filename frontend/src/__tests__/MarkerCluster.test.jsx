import React, { act } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MapView from '../components/MapView';
import L from '../utils/leafletCluster';
import * as listingsApi from '../api/listings';

describe('TE9C73D: Gộp cụm marker khi có nhiều tin (UC-02 A2, FR-03)', () => {
  const DEFAULT_COORDS = { lat: 10.7769, lng: 106.7009 };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Khi danh sách có dưới 30 tin: hiển thị từng marker riêng lẻ, không kích hoạt markerClusterGroup', async () => {
    const clusterSpy = vi.spyOn(L, 'markerClusterGroup');

    // Tạo 10 tin đăng (< 30)
    const mockListings = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      title: `Món đồ ${i + 1}`,
      price: 100000 * (i + 1),
      lat: 10.7769 + i * 0.001,
      lng: 106.7009 + i * 0.001,
      totalScore: 8.0,
      rank: 'Tốt',
      address: 'Quận 1, TP.HCM',
    }));

    vi.spyOn(listingsApi, 'getListingsMapApi').mockResolvedValue(mockListings);

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
      expect(clusterSpy).not.toHaveBeenCalled();
    });
  });

  it('2. Khi danh sách có từ 30 tin trở lên: kích hoạt markerClusterGroup để gộp các marker dày đặc', async () => {
    const clusterSpy = vi.spyOn(L, 'markerClusterGroup');

    // Tạo 35 tin đăng (>= 30)
    const mockListings = Array.from({ length: 35 }, (_, i) => ({
      id: i + 1,
      title: `Món đồ ${i + 1}`,
      price: 50000 * (i + 1),
      lat: 10.7769 + (i % 5) * 0.0005,
      lng: 106.7009 + (i % 5) * 0.0005,
      totalScore: 7.5,
      rank: 'Tốt',
      address: 'Quận 1, TP.HCM',
    }));

    vi.spyOn(listingsApi, 'getListingsMapApi').mockResolvedValue(mockListings);

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
      expect(clusterSpy).toHaveBeenCalledTimes(1);
    });

    // Kiểm tra cấu hình cluster có zoomToBoundsOnClick: true
    const clusterOptions = clusterSpy.mock.calls[0][0];
    expect(clusterOptions.zoomToBoundsOnClick).toBe(true);
    expect(typeof clusterOptions.iconCreateFunction).toBe('function');

    // Kiểm tra hàm tạo icon cụm hiển thị đúng số lượng
    const mockCluster = {
      getChildCount: () => 35,
    };
    const createdIcon = clusterOptions.iconCreateFunction(mockCluster);
    expect(createdIcon.options.html).toContain('35');
    expect(createdIcon.options.className).toBe('custom-cluster-marker');
  });
});
