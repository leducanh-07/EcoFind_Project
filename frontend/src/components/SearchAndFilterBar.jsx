import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, X, AlertCircle, RotateCcw, Check } from 'lucide-react';
import { getCategoriesApi } from '../api/categories';

export const HCM_DISTRICTS = [
  'Quận 1',
  'Quận 3',
  'Quận 4',
  'Quận 5',
  'Quận 6',
  'Quận 7',
  'Quận 8',
  'Quận 10',
  'Quận 11',
  'Quận 12',
  'Bình Thạnh',
  'Phú Nhuận',
  'Gò Vấp',
  'Tân Bình',
  'Tân Phú',
  'Bình Tân',
  'Thủ Đức',
];

export const INITIAL_FILTERS = {
  q: '',
  categoryId: '',
  district: '',
  radius: 10, // 10 km
  minScore: '',
  sort: 'distance',
};

export default function SearchAndFilterBar({
  filters,
  onApplyFilters,
  onResetFilters,
  totalResults,
}) {
  const [keyword, setKeyword] = useState(filters.q || '');
  const [keywordError, setKeywordError] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Draft filters inside the modal
  const [draftFilters, setDraftFilters] = useState(filters);

  // Sync draft filters when props change
  useEffect(() => {
    setDraftFilters(filters);
    setKeyword(filters.q || '');
  }, [filters]);

  // Load categories from API on mount
  useEffect(() => {
    let isMounted = true;
    setLoadingCategories(true);
    getCategoriesApi()
      .then((data) => {
        if (isMounted) {
          setCategories(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {
        // Fallback categories nếu API lỗi
        if (isMounted) {
          setCategories([
            { id: 1, name: 'Đồ điện tử' },
            { id: 2, name: 'Bàn ghế' },
            { id: 3, name: 'Sách vở' },
            { id: 4, name: 'Gia dụng' },
          ]);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingCategories(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Đếm số lượng bộ lọc đang kích hoạt (khác mặc định)
  const activeFilterCount = [
    Boolean(filters.categoryId),
    Boolean(filters.district),
    filters.radius !== 10,
    Boolean(filters.minScore),
    filters.sort && filters.sort !== 'distance',
  ].filter(Boolean).length;

  const handleKeywordChange = (e) => {
    const val = e.target.value;
    setKeyword(val);
    if (val.length > 100) {
      setKeywordError('Từ khóa không được vượt quá 100 ký tự (UC-03 E1)');
    } else {
      setKeywordError('');
    }
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    if (keyword.length > 100) {
      setKeywordError('Từ khóa không được vượt quá 100 ký tự (UC-03 E1)');
      return;
    }
    setKeywordError('');
    onApplyFilters({
      ...filters,
      q: keyword.trim(),
    });
  };

  const handleClearKeyword = () => {
    setKeyword('');
    setKeywordError('');
    onApplyFilters({
      ...filters,
      q: '',
    });
  };

  const handleOpenModal = () => {
    setDraftFilters({ ...filters });
    setShowFilterModal(true);
  };

  const handleApplyModal = () => {
    onApplyFilters({
      ...draftFilters,
      q: keyword.trim(),
    });
    setShowFilterModal(false);
  };

  const handleResetModal = () => {
    const resetState = { ...INITIAL_FILTERS, q: '' };
    setDraftFilters(resetState);
    setKeyword('');
    setKeywordError('');
    if (onResetFilters) {
      onResetFilters();
    } else {
      onApplyFilters(resetState);
    }
    setShowFilterModal(false);
  };

  return (
    <div className="relative z-20 space-y-1.5">
      {/* Thanh tìm kiếm & Nút mở bộ lọc (Floating Toolbar) */}
      <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/90 shadow-sm">
        {/* Form Ô tìm kiếm */}
        <form onSubmit={handleSearchSubmit} className="flex-1 relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={keyword}
            onChange={handleKeywordChange}
            placeholder="Tìm theo tên đồ cũ, mô tả..."
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-transparent rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 placeholder:text-slate-400"
            aria-label="Ô tìm kiếm từ khóa"
          />
          {keyword && (
            <button
              type="button"
              onClick={handleClearKeyword}
              className="absolute right-2 text-slate-400 hover:text-slate-600 p-1"
              aria-label="Xóa từ khóa"
            >
              <X size={14} />
            </button>
          )}
        </form>

        {/* Nút Tìm kiếm */}
        <button
          type="button"
          onClick={handleSearchSubmit}
          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
        >
          <Search size={14} />
          <span className="hidden sm:inline">Tìm</span>
        </button>

        {/* Nút Bộ lọc kèm Badge số lượng */}
        <button
          type="button"
          onClick={handleOpenModal}
          className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border ${
            activeFilterCount > 0
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm'
              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
          }`}
          aria-label="Mở bộ lọc"
        >
          <SlidersHorizontal size={14} />
          <span className="hidden sm:inline">Bộ lọc</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Thông báo lỗi vượt quá 100 ký tự (UC-03 E1) */}
      {keywordError && (
        <div
          data-testid="search-error-e1"
          className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 animate-in fade-in"
        >
          <AlertCircle size={14} className="shrink-0" />
          <span>{keywordError}</span>
        </div>
      )}

      {/* MODAL / DRAWER BỘ LỌC CHI TIẾT */}
      {showFilterModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setShowFilterModal(false)}
        >
          <div
            className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom duration-250"
            onClick={(e) => e.stopPropagation()}
            data-testid="filter-panel"
          >
            {/* Header Modal */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-emerald-700" />
                <h3 className="font-bold text-slate-800 text-base">Bộ lọc tìm kiếm đồ cũ</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Đóng bộ lọc"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body Modal (Cuộn nội dung) */}
            <div className="p-5 space-y-5 overflow-y-auto">
              {/* 1. Danh mục sản phẩm */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Danh mục sản phẩm
                </label>
                <select
                  value={draftFilters.categoryId || ''}
                  onChange={(e) =>
                    setDraftFilters({ ...draftFilters, categoryId: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  aria-label="Chọn danh mục"
                >
                  <option value="">Tất cả danh mục</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Khu vực / Quận huyện TP.HCM */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Khu vực (Quận / Huyện TP.HCM)
                </label>
                <select
                  value={draftFilters.district || ''}
                  onChange={(e) =>
                    setDraftFilters({ ...draftFilters, district: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  aria-label="Chọn khu vực"
                >
                  <option value="">Tất cả khu vực (Theo định vị)</option>
                  {HCM_DISTRICTS.map((dist) => (
                    <option key={dist} value={dist}>
                      {dist}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Bán kính khoảng cách (1 - 20 km) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Bán kính khoảng cách
                  </label>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    {draftFilters.radius || 10} km
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={draftFilters.radius || 10}
                  onChange={(e) =>
                    setDraftFilters({ ...draftFilters, radius: Number(e.target.value) })
                  }
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  aria-label="Thanh trượt bán kính"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                  <span>1 km</span>
                  <span>5 km</span>
                  <span>10 km</span>
                  <span>15 km</span>
                  <span>20 km</span>
                </div>
              </div>

              {/* 4. Điểm tình trạng tối thiểu (BR-02) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Điểm tình trạng tối thiểu
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { val: '', label: 'Tất cả' },
                    { val: '5.0', label: '≥ 5.0 (Khá)' },
                    { val: '7.0', label: '≥ 7.0 (Tốt)' },
                    { val: '9.0', label: '≥ 9.0 (Như mới)' },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setDraftFilters({ ...draftFilters, minScore: opt.val })}
                      className={`py-2 px-2.5 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                        (draftFilters.minScore || '') === opt.val
                          ? 'bg-emerald-600 border-emerald-600 text-white font-bold shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Tiêu chuẩn sắp xếp */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Sắp xếp kết quả
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'distance', label: 'Gần tôi nhất' },
                    { val: 'score', label: 'Điểm cao nhất' },
                    { val: 'newest', label: 'Mới đăng' },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setDraftFilters({ ...draftFilters, sort: opt.val })}
                      className={`py-2 px-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                        (draftFilters.sort || 'distance') === opt.val
                          ? 'bg-emerald-600 border-emerald-600 text-white font-bold shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Modal: Đặt lại & Áp dụng */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetModal}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw size={14} />
                <span>Xóa bộ lọc</span>
              </button>

              <button
                type="button"
                onClick={handleApplyModal}
                className="flex-1 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Check size={16} />
                <span>Áp dụng bộ lọc</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

