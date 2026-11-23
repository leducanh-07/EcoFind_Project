import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Compass,
  AlertTriangle,
  RotateCw,
  SearchX,
  SlidersHorizontal,
  ChevronRight,
  Eye,
  Sparkles,
} from 'lucide-react';
import { getRankBadgeColor } from './MapView';
import { handleImageError } from '../utils/imageFallback';

/**
 * SearchResultsList Component
 * Mã task: TE9C73B (UC-03 E2, E3, FR-05, FR-06)
 *
 * Tiêu chí:
 * - Mỗi dòng gồm: tiêu đề, giá, điểm, hạng, khoảng cách; bấm dòng mở chi tiết.
 * - Trạng thái rỗng (E2): 'Không tìm thấy tin' kèm gợi ý tăng khoảng cách hoặc giảm điểm tối thiểu.
 * - Lỗi kết nối (E3): 'Không thể tải danh sách kết quả do lỗi kết nối' kèm nút 'Thử lại'.
 */
export default function SearchResultsList({
  listings = [],
  loading = false,
  error = null,
  onRetry,
  onSelectListing,
  selectedListingId,
  filters = {},
  onApplyFilters,
  onResetFilters,
  className = '',
}) {
  const navigate = useNavigate();

  // Xử lý bấm vào dòng tin đăng để mở chi tiết
  const handleItemClick = (id) => {
    navigate(`/listings/${id}`);
  };

  // Định dạng hiển thị giá (0 đ -> Cho tặng)
  const formatPrice = (price) => {
    const num = Number(price);
    if (num === 0) {
      return <span className="text-emerald-600 font-extrabold text-sm sm:text-base">Cho tặng</span>;
    }
    return (
      <span className="font-extrabold text-teal-700 text-sm sm:text-base">
        {num.toLocaleString('vi-VN')} đ
      </span>
    );
  };

  // Định dạng hiển thị khoảng cách
  const formatDistance = (dist) => {
    if (dist === null || dist === undefined || Number.isNaN(Number(dist))) {
      return null;
    }
    const d = Number(dist);
    if (d < 1) {
      return `${Math.round(d * 1000)}m`;
    }
    return `${d.toFixed(1)} km`;
  };

  // Xử lý gợi ý tăng khoảng cách lên 20km (UC-03 E2)
  const handleExpandRadius = () => {
    if (onApplyFilters) {
      onApplyFilters({
        ...filters,
        radius: 20,
      });
    }
  };

  // Xử lý gợi ý bỏ lọc điểm tối thiểu (UC-03 E2)
  const handleClearMinScore = () => {
    if (onApplyFilters) {
      onApplyFilters({
        ...filters,
        minScore: undefined,
      });
    }
  };

  return (
    <div
      data-testid="search-results-list-container"
      className={`flex flex-col bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden h-full ${className}`}
    >
      {/* Header danh sách */}
      <div className="px-4 py-3 sm:py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-slate-900 text-sm sm:text-base">Kết quả tìm kiếm</span>
          {!loading && !error && (
            <span
              data-testid="results-count-badge"
              className="text-xs sm:text-sm bg-teal-100/80 text-teal-800 px-3 py-0.5 rounded-full font-bold"
            >
              {listings.length} tin
            </span>
          )}
        </div>

        {/* Nút lọc nhanh / reset nếu có bộ lọc */}
        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="text-xs sm:text-sm font-semibold text-slate-500 hover:text-teal-700 flex items-center gap-1.5 transition-colors active:scale-95 cursor-pointer select-none"
            title="Đặt lại bộ lọc"
          >
            <SlidersHorizontal size={14} />
            <span>Đặt lại</span>
          </button>
        )}
      </div>

      {/* Loading progress bar indicator (chống giật, báo hiệu ngầm khi kéo map) */}
      <div className="h-0.5 w-full bg-transparent overflow-hidden">
        {loading && listings.length > 0 && (
          <div className="h-full bg-teal-500 animate-pulse w-full"></div>
        )}
      </div>

      {/* Thân danh sách */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-3.5 space-y-3">
        {/* 1. Trạng thái Đang tải Skeleton ban đầu (Chỉ hiển thị khi danh sách chưa có dữ liệu) */}
        {loading && listings.length === 0 && (
          <div data-testid="results-loading-state" className="space-y-3 py-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="animate-pulse flex gap-3.5 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100"
              >
                <div className="w-26 h-26 sm:w-32 sm:h-32 bg-slate-200 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-3 py-2">
                  <div className="h-5 bg-slate-200 rounded-md w-3/4" />
                  <div className="h-4 bg-slate-200 rounded-md w-1/3" />
                  <div className="h-3.5 bg-slate-200 rounded-md w-1/2 pt-2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. Trạng thái Lỗi kết nối (UC-03 E3) */}
        {!loading && error && (
          <div
            data-testid="connection-error-state"
            className="py-12 px-4 text-center flex flex-col items-center justify-center my-auto"
          >
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-3 shadow-xs">
              <AlertTriangle size={26} />
            </div>
            <h3 className="font-bold text-slate-800 text-base mb-1">
              Không thể tải danh sách kết quả do lỗi kết nối
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-xs mb-4 leading-relaxed">
              Vui lòng kiểm tra lại kết nối mạng của bạn hoặc thử kết nối lại với máy chủ.
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl text-sm font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <RotateCw size={15} />
                <span>Thử lại</span>
              </button>
            )}
          </div>
        )}

        {/* 3. Trạng thái Không có kết quả / Rỗng (UC-03 E2) */}
        {!loading && !error && listings.length === 0 && (
          <div
            data-testid="empty-results-state"
            className="py-12 px-4 text-center flex flex-col items-center justify-center my-auto"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-3 shadow-xs">
              <SearchX size={26} />
            </div>
            <h3 className="font-bold text-slate-800 text-base mb-1">Không tìm thấy tin</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-xs mb-4 leading-relaxed">
              Không tìm thấy tin đăng nào trong khu vực này. Bạn có thể thử mở rộng bán kính tìm kiếm
              hoặc giảm điều kiện điểm tình trạng tối thiểu để xem thêm tin.
            </p>

            {/* Các nút hành động gợi ý theo tiêu chí UC-03 E2 */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={handleExpandRadius}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer"
              >
                <Compass size={15} />
                <span>Tăng bán kính lên 20 km</span>
              </button>
              <button
                type="button"
                onClick={handleClearMinScore}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                <Sparkles size={15} />
                <span>Bỏ lọc điểm tối thiểu</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. Danh sách các dòng tin đăng (Giữ ổn định khi nạp lại dữ liệu, chống nhấp nháy giật giao diện) */}
        {!error && listings.length > 0 && (
          <div className={`space-y-3 transition-opacity duration-200 ${loading ? 'opacity-75' : 'opacity-100'}`}>
            {listings.map((item) => {
              const score = Number(item.totalScore ?? item.total_score ?? 0);
              const rankColor = getRankBadgeColor(item.rank, score);
              const isSelected = selectedListingId === item.id;
              const distanceStr = formatDistance(item.distance);
              const thumb = item.thumbnailUrl || item.thumbnail_url;

              return (
                <div
                  key={item.id}
                  data-testid={`listing-row-${item.id}`}
                  onClick={() => handleItemClick(item.id)}
                  className={`group relative flex gap-3.5 p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] select-none ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/40 shadow-sm ring-1 ring-teal-400'
                      : 'border-slate-200/80 bg-white hover:border-teal-300 hover:bg-slate-50/60 shadow-2xs'
                  }`}
                >
                  {/* Thumbnail ảnh kích thước chuẩn rõ nét */}
                  <div className="relative w-26 h-26 sm:w-32 sm:h-32 rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200/80 shadow-xs">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={handleImageError}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                        <Compass size={28} className="mb-1 opacity-40 text-slate-400" />
                        <span className="font-bold text-xs">EcoFind</span>
                      </div>
                    )}

                    {/* Badge điểm tình trạng trên ảnh */}
                    <div
                      style={{ backgroundColor: rankColor.bg }}
                      className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded-lg text-xs font-black text-white shadow-md flex items-center gap-0.5"
                      title={`Điểm tình trạng: ${score.toFixed(1)}/10`}
                    >
                      <span>{score.toFixed(1)}</span>
                    </div>
                  </div>

                  {/* Thông tin tin đăng */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                      {/* Tiêu đề & Cụm nhãn hạng + Nút định vị bản đồ (Xếp ngang hàng, không đè lên nhau) */}
                      <div className="flex items-start justify-between gap-2.5 mb-1.5">
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-teal-700 transition-colors">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            style={{
                              color: rankColor.border,
                              borderColor: rankColor.border,
                            }}
                            className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg border bg-white shadow-2xs"
                          >
                            {item.rank || rankColor.label}
                          </span>

                          {onSelectListing && (
                            <button
                              type="button"
                              data-testid={`btn-select-map-${item.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectListing(item.id);
                              }}
                              title="Xem vị trí trên bản đồ"
                              aria-label="Xem vị trí trên bản đồ"
                              className="p-1 rounded-lg bg-slate-50 hover:bg-teal-50 text-slate-400 hover:text-teal-700 border border-slate-200 hover:border-teal-300 transition-all cursor-pointer active:scale-90 shadow-2xs"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Giá */}
                      <div className="mb-2">{formatPrice(item.price)}</div>
                    </div>

                    {/* Vị trí & Khoảng cách */}
                    <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 truncate max-w-[68%]">
                        <MapPin size={14} className="shrink-0 text-teal-600" />
                        <span className="truncate font-medium">{item.address || 'TP. Hồ Chí Minh'}</span>
                      </div>

                      {distanceStr && (
                        <span
                          data-testid={`distance-badge-${item.id}`}
                          className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-lg shrink-0 border border-teal-200/70"
                        >
                          {distanceStr}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
