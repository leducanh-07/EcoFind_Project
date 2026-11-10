import React from 'react';
import { render, screen, fireEvent, renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useGeolocation, DEFAULT_HCMC_COORDS, STORAGE_LOCATION_KEY } from '../hooks/useGeolocation';
import MapView, { getRankBadgeColor } from '../components/MapView';

describe('useGeolocation Hook (UC-02, FR-04, UC-02 A1, TE9C734)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('lấy vị trí thành công khi người dùng cấp quyền geolocation', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success) => {
        success({
          coords: {
            latitude: 10.755,
            longitude: 106.685,
          },
        });
      }),
    };
    vi.stubGlobal('navigator', { geolocation: mockGeolocation });

    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => {
      expect(result.current.coords.lat).toBe(10.755);
      expect(result.current.coords.lng).toBe(106.685);
      expect(result.current.isFallback).toBe(false);
      expect(result.current.error).toBeNull();
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_LOCATION_KEY));
    expect(stored.lat).toBe(10.755);
    expect(stored.lng).toBe(106.685);
  });

  it('kích hoạt phương án dự phòng (fallback về trung tâm TP.HCM) khi bị từ chối quyền', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((_, error) => {
        error({
          code: 1, // PERMISSION_DENIED
          PERMISSION_DENIED: 1,
        });
      }),
    };
    vi.stubGlobal('navigator', { geolocation: mockGeolocation });

    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => {
      expect(result.current.coords.lat).toBe(DEFAULT_HCMC_COORDS.lat);
      expect(result.current.coords.lng).toBe(DEFAULT_HCMC_COORDS.lng);
      expect(result.current.isFallback).toBe(true);
      expect(result.current.error).toContain('từ chối chia sẻ vị trí');
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_LOCATION_KEY));
    expect(stored.lat).toBe(DEFAULT_HCMC_COORDS.lat);
    expect(stored.isFallback).toBe(true);
  });

  it('kích hoạt phương án dự phòng khi quá thời gian định vị (TIMEOUT)', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((_, error) => {
        error({
          code: 3, // TIMEOUT
          TIMEOUT: 3,
        });
      }),
    };
    vi.stubGlobal('navigator', { geolocation: mockGeolocation });

    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => {
      expect(result.current.coords).toEqual(DEFAULT_HCMC_COORDS);
      expect(result.current.isFallback).toBe(true);
      expect(result.current.error).toContain('Quá thời gian lấy vị trí GPS');
    });
  });
});

describe('MapView & Rank Colors (BR-02, TE9C734)', () => {
  it('phân loại màu sắc marker theo 4 hạng BR-02', () => {
    expect(getRankBadgeColor('Như mới').bg).toBe('#10B981');
    expect(getRankBadgeColor('Tốt').bg).toBe('#3B82F6');
    expect(getRankBadgeColor('Khá').bg).toBe('#F59E0B');
    expect(getRankBadgeColor('Cũ').bg).toBe('#EF4444');
  });

  it('hiển thị nút "Vị trí của tôi" và banner dự phòng khi isFallback = true', () => {
    const handleLocateMe = vi.fn();

    render(
      <MemoryRouter>
        <MapView
          coords={DEFAULT_HCMC_COORDS}
          loadingLocation={false}
          locationError="Bạn đã từ chối chia sẻ vị trí."
          isFallback={true}
          onLocateMe={handleLocateMe}
        />
      </MemoryRouter>
    );

    // Kiểm tra nút Vị trí của tôi
    const locateBtn = screen.getByRole('button', { name: /vị trí của tôi/i });
    expect(locateBtn).toBeInTheDocument();

    fireEvent.click(locateBtn);
    expect(handleLocateMe).toHaveBeenCalledTimes(1);

    // Kiểm tra thông báo dự phòng
    expect(screen.getByText(/Vị trí mặc định tại trung tâm TP.HCM/i)).toBeInTheDocument();
    expect(screen.getByText(/Bạn đã từ chối chia sẻ vị trí/i)).toBeInTheDocument();
  });
});
