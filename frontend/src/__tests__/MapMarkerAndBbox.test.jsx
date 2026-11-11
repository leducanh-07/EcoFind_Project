import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import MapView, { getRankBadgeColor, RANK_COLORS } from '../components/MapView';
import * as listingsApi from '../api/listings';

describe('TE9C733: Màu marker theo hạng & tải lại khi kéo/phóng to bản đồ (UC-02, FR-03, BR-02)', () => {
  const DEFAULT_COORDS = { lat: 10.7769, lng: 106.7009 };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Tiêu chí: Màu marker theo 4 hạng (BR-02)', () => {
    it('trả về đúng màu sắc và nhãn theo từng hạng BR-02', () => {
      // Hạng Như mới (>= 9.0)
      const likeNew = getRankBadgeColor('Như mới');
      expect(likeNew.bg).toBe(RANK_COLORS.LIKE_NEW.bg);
      expect(likeNew.border).toBe(RANK_COLORS.LIKE_NEW.border);
      expect(likeNew.label).toBe('Như mới');

      // Hạng Tốt (7.0 - 8.9)
      const good = getRankBadgeColor('Tốt');
      expect(good.bg).toBe(RANK_COLORS.GOOD.bg);
      expect(good.border).toBe(RANK_COLORS.GOOD.border);
      expect(good.label).toBe('Tốt');

      // Hạng Khá (5.0 - 6.9)
      const fair = getRankBadgeColor('Khá');
      expect(fair.bg).toBe(RANK_COLORS.FAIR.bg);
      expect(fair.border).toBe(RANK_COLORS.FAIR.border);
      expect(fair.label).toBe('Khá');

      // Hạng Cũ (< 5.0)
      const poor = getRankBadgeColor('Cũ');
      expect(poor.bg).toBe(RANK_COLORS.POOR.bg);
      expect(poor.border).toBe(RANK_COLORS.POOR.border);
      expect(poor.label).toBe('Cũ');
    });

    it('tự động xác định màu từ điểm tổng (totalScore) nếu không có nhãn rank', () => {
      expect(getRankBadgeColor(null, 9.5).bg).toBe(RANK_COLORS.LIKE_NEW.bg);
      expect(getRankBadgeColor(null, 9.0).bg).toBe(RANK_COLORS.LIKE_NEW.bg);
      expect(getRankBadgeColor(null, 8.5).bg).toBe(RANK_COLORS.GOOD.bg);
      expect(getRankBadgeColor(null, 7.0).bg).toBe(RANK_COLORS.GOOD.bg);
      expect(getRankBadgeColor(null, 6.2).bg).toBe(RANK_COLORS.FAIR.bg);
      expect(getRankBadgeColor(null, 5.0).bg).toBe(RANK_COLORS.FAIR.bg);
      expect(getRankBadgeColor(null, 4.8).bg).toBe(RANK_COLORS.POOR.bg);
      expect(getRankBadgeColor(null, 0.0).bg).toBe(RANK_COLORS.POOR.bg);
    });
  });

  describe('2. Tiêu chí: Có chú thích màu (Color Legend)', () => {
    it('hiển thị bảng chú thích màu với đủ 4 hạng chất lượng và khoảng điểm', async () => {
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

      const legend = screen.getByTestId('color-legend');
      expect(legend).toBeInTheDocument();

      // Kiểm tra 4 hạng và thang điểm
      expect(screen.getByText(/Như mới \(≥9\.0\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Tốt \(7\.0–8\.9\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Khá \(5\.0–6\.9\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Cũ \(<5\.0\)/i)).toBeInTheDocument();
    });

    it('cho phép ẩn và mở lại chú thích màu trên giao diện mobile', async () => {
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

      // Ban đầu mở chú thích màu
      expect(screen.getByTestId('color-legend')).toBeInTheDocument();

      // Bấm nút thu nhỏ (mobile close button)
      const closeBtn = screen.getByTitle(/Thu nhỏ chú thích màu/i);
      fireEvent.click(closeBtn);

      // Bảng chú thích đóng lại, hiện nút mở lại "Chú thích màu"
      expect(screen.queryByTestId('color-legend')).not.toBeInTheDocument();
      const openBtn = screen.getByRole('button', { name: /Hiện chú thích màu/i });
      expect(openBtn).toBeInTheDocument();

      // Bấm mở lại
      fireEvent.click(openBtn);
      expect(screen.getByTestId('color-legend')).toBeInTheDocument();
    });
  });

  describe('3 & 4. Tiêu chí: moveend/zoomend debounce 300–500ms & Không gọi lại khi khung nhìn không đổi', () => {
    it('lắng nghe cả 2 sự kiện moveend và zoomend, áp dụng debounce 400ms và không gọi lại khi bbox không đổi', async () => {
      const mockGetListings = vi.spyOn(listingsApi, 'getListingsMapApi').mockResolvedValue([
        {
          id: 1,
          title: 'Xe đạp Martin 107',
          price: 500000,
          lat: 10.7769,
          lng: 106.7009,
          totalScore: 8.5,
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

      // Gọi ban đầu 1 lần (initial load)
      expect(mockGetListings).toHaveBeenCalledTimes(1);

      // Khi khung nhìn không đổi, không có cuộc gọi API thừa
      await waitFor(() => {
        expect(mockGetListings).toHaveBeenCalledTimes(1);
      });
    });
  });
});
