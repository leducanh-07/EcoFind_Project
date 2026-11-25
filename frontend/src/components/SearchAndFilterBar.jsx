import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  SlidersHorizontal,
  X,
  AlertCircle,
  RotateCcw,
  Check,
  Sparkles,
  MapPin,
  Layers,
  ChevronRight,
} from 'lucide-react';
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
  const [headerSlot, setHeaderSlot] = useState(null);

  // Tìm slot gắn trên header nếu trên desktop (>= 768px)
  useEffect(() => {
    const updateSlot = () => {
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        const slot = document.getElementById('header-search-slot');
        setHeaderSlot(slot);
      } else {
        setHeaderSlot(null);
      }
    };
    updateSlot();
    window.addEventListener('resize', updateSlot);
    return () => window.removeEventListener('resize', updateSlot);
  }, []);

  // Draft filters inside the modal
  const [draftFilters, setDraftFilters] = useState(filters);

  // Đóng modal bộ lọc khi bấm ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showFilterModal) {
        setShowFilterModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFilterModal]);

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
            { id: 1, name: 'Đồ điện tử & Công nghệ' },
            { id: 2, name: 'Nội thất & Gia dụng' },
            { id: 3, name: 'Xe cộ & Phụ tùng' },
            { id: 4, name: 'Sách & Đồ học tập' },
            { id: 5, name: 'Thời trang & Phụ kiện' },
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

  // Xử lý thay đổi ô tìm kiếm từ khóa (giới hạn 100 ký tự)
  const handleKeywordChange = (e) => {
    const val = e.target.value;
    if (val.length > 100) {
      setKeywordError('Từ khóa không được vượt quá 100 ký tự');
      return;
    }
    setKeywordError('');
    setKeyword(val);
  };

  // Submit tìm kiếm từ khóa
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (keyword.length > 100) {
      setKeywordError('Từ khóa không được vượt quá 100 ký tự');
      return;
    }
    setKeywordError('');
    if (onApplyFilters) {
      onApplyFilters({
        ...filters,
        q: keyword.trim(),
      });
    }
  };

  const handleClearKeyword = () => {
    setKeyword('');
    setKeywordError('');
    if (onApplyFilters) {
      onApplyFilters({
        ...filters,
        q: '',
      });
    }
  };

  // Chọn nhanh danh mục từ thanh Quick Category Chips
  const handleQuickCategorySelect = (catId) => {
    const newCatId = filters.categoryId === catId ? '' : catId;
    if (onApplyFilters) {
      onApplyFilters({
        ...filters,
        categoryId: newCatId,
      });
    }
  };

  // Tính số lượng bộ lọc đang được kích hoạt (khác mặc định)
  const activeFilterCount = [
    Boolean(filters.categoryId),
    Boolean(filters.district),
    Boolean(filters.radius && filters.radius !== 10),
    Boolean(filters.minScore),
    Boolean(filters.sort && filters.sort !== 'distance'),
  ].filter(Boolean).length;

  const handleOpenModal = () => {
    setDraftFilters(filters);
    setShowFilterModal(true);
  };

  const handleApplyModal = () => {
    if (onApplyFilters) {
      onApplyFilters({
        ...draftFilters,
        q: keyword.trim(),
      });
    }
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

  // Khối Toolbar thanh tìm kiếm trên Header
  const searchToolbarContent = (
    <div className="flex items-center gap-2 bg-white hover:bg-white focus-within:bg-white p-1 sm:p-1.5 rounded-2xl border border-white/40 shadow-md focus-within:ring-2 focus-within:ring-emerald-300 transition-all w-full">
      {/* Form Ô tìm kiếm */}
      <form onSubmit={handleSearchSubmit} className="flex-1 relative flex items-center">
        <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 absolute left-3 sm:left-3.5 pointer-events-none" />
        <input
          type="text"
          value={keyword}
          onChange={handleKeywordChange}
          placeholder="Tìm theo tên đồ cũ, mô tả..."
          className="w-full pl-9 sm:pl-11 pr-8 py-2 sm:py-2.5 text-xs sm:text-sm bg-transparent border-none focus:outline-none text-slate-800 placeholder:text-slate-400 font-medium transition-all"
          aria-label="Ô tìm kiếm từ khóa"
        />
        {keyword && (
          <button
            type="button"
            onClick={handleClearKeyword}
            className="absolute right-2 text-slate-400 hover:text-slate-600 p-1 rounded-lg active:scale-90 transition-transform cursor-pointer"
            aria-label="Xóa từ khóa"
          >
            <X size={15} />
          </button>
        )}
      </form>

      {/* Nút Tìm kiếm: Tông Xanh ngọc nổi bật trên nền trắng của thanh search */}
      <button
        type="button"
        onClick={handleSearchSubmit}
        className="px-4 sm:px-6 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs hover:shadow active:scale-95 select-none"
      >
        <Search size={15} />
        <span className="hidden sm:inline">Tìm</span>
      </button>
    </div>
  );

  return (
    <div className="relative z-20 space-y-2">
      {/* 1. Thanh Search Toolbar: Nếu slot trên Header tồn tại thì portal lên Header, ngược lại hiển thị tại chỗ */}
      {headerSlot ? createPortal(searchToolbarContent, headerSlot) : searchToolbarContent}

      {/* Thông báo lỗi vượt quá 100 ký tự (UC-03 E1) */}
      {keywordError && (
        <div
          data-testid="search-error-e1"
          className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 px-3.5 py-2 rounded-xl border border-rose-200 animate-in fade-in"
        >
          <AlertCircle size={14} className="shrink-0" />
          <span>{keywordError}</span>
        </div>
      )}

      {/* Hàng Quick Category Chips: Lọc nhanh 1-chạm theo danh mục kèm Nút Bộ lọc nâng cao ở đầu hàng */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar select-none text-xs">
        {/* Nút Mở bộ lọc nâng cao chuyển về đầu hàng công cụ */}
        <button
          type="button"
          onClick={handleOpenModal}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all duration-150 flex items-center gap-1.5 cursor-pointer shrink-0 border select-none active:scale-95 shadow-2xs ${
            activeFilterCount > 0
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100/70'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
          }`}
          aria-label="Mở bộ lọc"
        >
          <SlidersHorizontal size={14} className={activeFilterCount > 0 ? 'text-emerald-700' : 'text-slate-500'} />
          <span>Bộ lọc</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-emerald-700 text-white text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        <span className="h-4 w-[1px] bg-slate-200 mx-0.5 shrink-0" aria-hidden="true"></span>

        <button
          type="button"
          onClick={() => handleQuickCategorySelect('')}
          className={`px-3 py-1.5 rounded-xl font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
            !filters.categoryId
              ? 'bg-emerald-800 text-white shadow-2xs'
              : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/80 shadow-2xs'
          }`}
        >
          <span className="opacity-70">#</span>
          <span>Tất cả</span>
        </button>
        {categories.map((cat) => {
          const isCatSelected = String(filters.categoryId) === String(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleQuickCategorySelect(cat.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                isCatSelected
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 shadow-2xs'
              }`}
            >
              <span>#{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* MODAL / DRAWER BỘ LỌC CHI TIẾT (Portal ra document.body) */}
      {showFilterModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setShowFilterModal(false)}
        >
          <div
            className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom duration-250"
            onClick={(e) => e.stopPropagation()}
            data-testid="filter-panel"
          >
            {/* Header Modal */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-2xs">
                  <SlidersHorizontal size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-950 text-base">Bộ lọc tìm kiếm</h3>
                  <p className="text-[11px] text-slate-500">Tùy chỉnh khoảng cách, danh mục và chất lượng đồ cũ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Đóng bộ lọc"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body Modal */}
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
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
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
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
                          ? 'bg-emerald-700 border-emerald-700 text-white font-bold shadow-xs'
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
                          ? 'bg-emerald-700 border-emerald-700 text-white font-bold shadow-xs'
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
                className="px-4 py-2.5 rounded-xl border border-slate-300/80 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 hover:border-rose-300 text-xs font-bold flex items-center gap-2 transition-all shadow-2xs active:scale-95 cursor-pointer"
              >
                <RotateCcw size={14} className="text-slate-500 hover:text-rose-600 transition-colors" />
                <span>Xóa bộ lọc</span>
              </button>

              <button
                type="button"
                onClick={handleApplyModal}
                className="flex-1 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Check size={16} />
                <span>Áp dụng bộ lọc</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
