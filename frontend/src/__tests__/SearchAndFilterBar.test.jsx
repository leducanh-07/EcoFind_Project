import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SearchAndFilterBar, { INITIAL_FILTERS } from '../components/SearchAndFilterBar';
import * as categoriesApi from '../api/categories';

describe('TE9C73A: Thanh tìm kiếm & bộ lọc trên bản đồ (UC-03, FR-05, FR-06)', () => {
  const mockCategories = [
    { id: 1, name: 'Đồ điện tử' },
    { id: 2, name: 'Bàn ghế' },
    { id: 3, name: 'Sách vở' },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(categoriesApi, 'getCategoriesApi').mockResolvedValue(mockCategories);
  });

  it('1. Hiển thị ô tìm kiếm, nút tìm và nút mở bộ lọc', async () => {
    const handleApply = vi.fn();
    await act(async () => {
      render(
        <SearchAndFilterBar
          filters={INITIAL_FILTERS}
          onApplyFilters={handleApply}
          totalResults={10}
        />
      );
    });

    expect(screen.getByPlaceholderText(/Tìm theo tên đồ cũ, mô tả/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mở bộ lọc/i })).toBeInTheDocument();
  });

  it('2. Báo lỗi E1 khi từ khóa vượt quá 100 ký tự (UC-03 E1)', async () => {
    const handleApply = vi.fn();
    await act(async () => {
      render(
        <SearchAndFilterBar
          filters={INITIAL_FILTERS}
          onApplyFilters={handleApply}
          totalResults={10}
        />
      );
    });

    const input = screen.getByPlaceholderText(/Tìm theo tên đồ cũ, mô tả/i);
    const longText = 'a'.repeat(101);

    await act(async () => {
      fireEvent.change(input, { target: { value: longText } });
    });

    expect(
      screen.getByText(/Từ khóa không được vượt quá 100 ký tự/i)
    ).toBeInTheDocument();
    expect(handleApply).not.toHaveBeenCalled();
  });

  it('3. Nhập từ khóa hợp lệ và submit tìm kiếm', async () => {
    const handleApply = vi.fn();
    await act(async () => {
      render(
        <SearchAndFilterBar
          filters={INITIAL_FILTERS}
          onApplyFilters={handleApply}
          totalResults={10}
        />
      );
    });

    const input = screen.getByPlaceholderText(/Tìm theo tên đồ cũ, mô tả/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Bàn làm việc' } });
    });

    const searchBtn = screen.getByRole('button', { name: /Tìm/i });
    await act(async () => {
      fireEvent.click(searchBtn);
    });

    expect(handleApply).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'Bàn làm việc',
      })
    );
  });

  it('4. Nút xóa (X) làm sạch từ khóa và gọi lại tìm kiếm rỗng', async () => {
    const handleApply = vi.fn();
    await act(async () => {
      render(
        <SearchAndFilterBar
          filters={{ ...INITIAL_FILTERS, q: 'Ghế xoay' }}
          onApplyFilters={handleApply}
          totalResults={5}
        />
      );
    });

    const clearBtn = screen.getByRole('button', { name: /Xóa từ khóa/i });
    await act(async () => {
      fireEvent.click(clearBtn);
    });

    expect(handleApply).toHaveBeenCalledWith(
      expect.objectContaining({
        q: '',
      })
    );
  });

  it('5. Mở modal bộ lọc và áp dụng các tiêu chí lọc: danh mục, khu vực, bán kính, điểm tối thiểu', async () => {
    const handleApply = vi.fn();
    await act(async () => {
      render(
        <SearchAndFilterBar
          filters={INITIAL_FILTERS}
          onApplyFilters={handleApply}
          totalResults={20}
        />
      );
    });

    // Mở modal bộ lọc
    const filterBtn = screen.getByRole('button', { name: /Mở bộ lọc/i });
    await act(async () => {
      fireEvent.click(filterBtn);
    });

    expect(screen.getByTestId('filter-panel')).toBeInTheDocument();

    // Chọn danh mục
    await waitFor(() => {
      expect(screen.getByText('Đồ điện tử')).toBeInTheDocument();
    });
    const categorySelect = screen.getByLabelText(/Chọn danh mục/i);
    await act(async () => {
      fireEvent.change(categorySelect, { target: { value: '1' } });
    });

    // Chọn khu vực
    const districtSelect = screen.getByLabelText(/Chọn khu vực/i);
    await act(async () => {
      fireEvent.change(districtSelect, { target: { value: 'Quận 1' } });
    });

    // Chọn điểm tối thiểu ≥ 7.0 (Tốt)
    const minScoreBtn = screen.getByRole('button', { name: /≥ 7.0 \(Tốt\)/i });
    await act(async () => {
      fireEvent.click(minScoreBtn);
    });

    // Bấm Áp dụng bộ lọc
    const applyBtn = screen.getByRole('button', { name: /Áp dụng bộ lọc/i });
    await act(async () => {
      fireEvent.click(applyBtn);
    });

    expect(handleApply).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: '1',
        district: 'Quận 1',
        minScore: '7.0',
      })
    );
  });

  it('6. Nút "Xóa bộ lọc" đưa tất cả bộ lọc về trạng thái ban đầu', async () => {
    const handleApply = vi.fn();
    const handleReset = vi.fn();
    await act(async () => {
      render(
        <SearchAndFilterBar
          filters={{
            q: 'test',
            categoryId: '2',
            district: 'Bình Thạnh',
            radius: 15,
            minScore: '5.0',
            sort: 'score',
          }}
          onApplyFilters={handleApply}
          onResetFilters={handleReset}
          totalResults={5}
        />
      );
    });

    // Mở modal bộ lọc
    const filterBtn = screen.getByRole('button', { name: /Mở bộ lọc/i });
    await act(async () => {
      fireEvent.click(filterBtn);
    });

    const resetBtn = screen.getByRole('button', { name: /Xóa bộ lọc/i });
    await act(async () => {
      fireEvent.click(resetBtn);
    });

    expect(handleReset).toHaveBeenCalledTimes(1);
  });
});

