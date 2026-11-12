import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SearchResultsList from '../components/SearchResultsList';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('TE9C73B: Danh sách kết quả, trạng thái rỗng & lỗi kết nối (UC-03 E2, E3, FR-05, FR-06)', () => {
  const sampleListings = [
    {
      id: 101,
      title: 'Bàn làm việc gỗ thông',
      price: 450000,
      totalScore: 8.7,
      rank: 'Tốt',
      distance: 1.5,
      address: 'Quận Bình Thạnh, TP.HCM',
      thumbnailUrl: 'https://example.com/ban.jpg',
    },
    {
      id: 102,
      title: 'Tủ sách mini tặng bạn sinh viên',
      price: 0,
      totalScore: 9.2,
      rank: 'Như mới',
      distance: 0.4,
      address: 'Quận 1, TP.HCM',
      thumbnailUrl: null,
    },
    {
      id: 103,
      title: 'Ghế xoay văn phòng cũ',
      price: 150000,
      totalScore: 4.8,
      rank: 'Cũ',
      distance: 5.2,
      address: 'Quận 3, TP.HCM',
      thumbnailUrl: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Tiêu chí: Mỗi dòng gồm tiêu đề, giá, điểm, hạng, khoảng cách; bấm dòng mở chi tiết', () => {
    it('hiển thị đầy đủ danh sách tin đăng cùng số lượng tin và thông tin chi tiết từng dòng', () => {
      render(
        <MemoryRouter>
          <SearchResultsList
            listings={sampleListings}
            loading={false}
            error={null}
            onRetry={vi.fn()}
          />
        </MemoryRouter>
      );

      // Kiểm tra badge số lượng tin
      expect(screen.getByTestId('results-count-badge')).toHaveTextContent('3 tin');

      // Kiểm tra tin 101: Bàn làm việc
      expect(screen.getByText('Bàn làm việc gỗ thông')).toBeInTheDocument();
      expect(screen.getByText('450.000 đ')).toBeInTheDocument();
      expect(screen.getByText('8.7')).toBeInTheDocument();
      expect(screen.getByText('Tốt')).toBeInTheDocument();
      expect(screen.getByTestId('distance-badge-101')).toHaveTextContent('1.5 km');
      expect(screen.getByText('Quận Bình Thạnh, TP.HCM')).toBeInTheDocument();

      // Kiểm tra tin 102: Cho tặng (giá = 0)
      expect(screen.getByText('Tủ sách mini tặng bạn sinh viên')).toBeInTheDocument();
      expect(screen.getByText('Cho tặng')).toBeInTheDocument();
      expect(screen.getByText('9.2')).toBeInTheDocument();
      expect(screen.getByText('Như mới')).toBeInTheDocument();
      expect(screen.getByTestId('distance-badge-102')).toHaveTextContent('400m');
    });

    it('bấm vào dòng tin đăng thì mở chi tiết bằng cách navigate tới /listings/:id', () => {
      render(
        <MemoryRouter>
          <SearchResultsList
            listings={sampleListings}
            loading={false}
            error={null}
          />
        </MemoryRouter>
      );

      const row101 = screen.getByTestId('listing-row-101');
      fireEvent.click(row101);

      expect(mockNavigate).toHaveBeenCalledWith('/listings/101');
    });

    it('bấm vào nút "Xem vị trí trên bản đồ" gọi callback onSelectListing mà không navigate', () => {
      const handleSelect = vi.fn();
      render(
        <MemoryRouter>
          <SearchResultsList
            listings={sampleListings}
            loading={false}
            error={null}
            onSelectListing={handleSelect}
          />
        </MemoryRouter>
      );

      const mapBtn = screen.getByTestId('btn-select-map-101');
      fireEvent.click(mapBtn);

      expect(handleSelect).toHaveBeenCalledWith(101);
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('2. Tiêu chí: Không có kết quả: "Không tìm thấy tin" kèm gợi ý tăng khoảng cách hoặc giảm điểm tối thiểu (UC-03 E2)', () => {
    it('hiển thị thông báo "Không tìm thấy tin" và các gợi ý mở rộng tìm kiếm khi danh sách rỗng', () => {
      render(
        <MemoryRouter>
          <SearchResultsList
            listings={[]}
            loading={false}
            error={null}
          />
        </MemoryRouter>
      );

      expect(screen.getByTestId('empty-results-state')).toBeInTheDocument();
      expect(screen.getByText('Không tìm thấy tin')).toBeInTheDocument();
      expect(screen.getByText(/tăng bán kính lên 20 km/i)).toBeInTheDocument();
      expect(screen.getByText(/bỏ lọc điểm tối thiểu/i)).toBeInTheDocument();
    });

    it('bấm nút "Tăng bán kính lên 20 km" gọi onApplyFilters với radius = 20', () => {
      const handleApplyFilters = vi.fn();
      render(
        <MemoryRouter>
          <SearchResultsList
            listings={[]}
            loading={false}
            error={null}
            filters={{ radius: 5, minScore: '7.0' }}
            onApplyFilters={handleApplyFilters}
          />
        </MemoryRouter>
      );

      const expandBtn = screen.getByRole('button', { name: /Tăng bán kính lên 20 km/i });
      fireEvent.click(expandBtn);

      expect(handleApplyFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          radius: 20,
          minScore: '7.0',
        })
      );
    });

    it('bấm nút "Bỏ lọc điểm tối thiểu" gọi onApplyFilters với minScore = undefined', () => {
      const handleApplyFilters = vi.fn();
      render(
        <MemoryRouter>
          <SearchResultsList
            listings={[]}
            loading={false}
            error={null}
            filters={{ radius: 10, minScore: '8.0' }}
            onApplyFilters={handleApplyFilters}
          />
        </MemoryRouter>
      );

      const clearScoreBtn = screen.getByRole('button', { name: /Bỏ lọc điểm tối thiểu/i });
      fireEvent.click(clearScoreBtn);

      expect(handleApplyFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          radius: 10,
          minScore: undefined,
        })
      );
    });
  });

  describe('3. Tiêu chí: Mất kết nối: thông báo lỗi và nút Thử lại (UC-03 E3)', () => {
    it('hiển thị thông báo lỗi kết nối và nút "Thử lại"', () => {
      const handleRetry = vi.fn();
      render(
        <MemoryRouter>
          <SearchResultsList
            listings={[]}
            loading={false}
            error="Network disconnected"
            onRetry={handleRetry}
          />
        </MemoryRouter>
      );

      expect(screen.getByTestId('connection-error-state')).toBeInTheDocument();
      expect(
        screen.getByText(/Không thể tải danh sách kết quả do lỗi kết nối/i)
      ).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
      expect(retryBtn).toBeInTheDocument();

      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Trạng thái đang tải (Loading state)', () => {
    it('hiển thị skeleton placeholder khi loading = true', () => {
      render(
        <MemoryRouter>
          <SearchResultsList
            listings={[]}
            loading={true}
            error={null}
          />
        </MemoryRouter>
      );

      expect(screen.getByTestId('results-loading-state')).toBeInTheDocument();
    });
  });
});
