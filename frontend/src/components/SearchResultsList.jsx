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
      return <span className="text-emerald-600 font-bold">Cho tặng</span>;
    }
    return <span className="font-bold text-slate-800">{num.toLocaleString('vi-VN')} đ</span>;
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
      className={`flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-full ${className}`}
    >
      {/* Header danh sách */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800 text-sm">Kết quả tìm kiếm</span>
          {!loading && !error && (
            <span
              data-testid="results-count-badge"
              className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium"
            >
              {listings.length} tin
            </span>
          )}
        </div>

        {/* Nút lọc nhanh / reset nếu có bộ lọc */}
        {onResetFilters && (
          <button
            onClick={onResetFilters}
            className="text-[11px] text-slate-500 hover:text-emerald-700 flex items-center gap-1 transition-colors cursor-pointer"
            title="Đặt lại bộ lọc"
          >
            <SlidersHorizontal size={12} />
            <span>Đặt lại</span>
          </button>
        )}
      </div>

      {/* Thân danh sách */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {/* 1. Trạng thái Đang tải (Loading Skeleton) */}
        {loading && (
          <div data-testid="results-loading-state" className="space-y-3 py-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="animate-pulse flex gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100"
              >
                <div className="w-20 h-20 bg-slate-200 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/3" />
                  <div className="h-3 bg-slate-200 rounded w-1/2 pt-2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. Trạng thái Lỗi kết nối (UC-03 E3) */}
        {!loading && error && (
          <div
            data-testid="connection-error-state"
            className="py-10 px-4 text-center flex flex-col items-center justify-center my-auto"
          >
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-3">
              <AlertTriangle size={28} />
            </div>
            <h3 className="font-bold text-slate-800 text-base mb-1">
              Không thể tải danh sách kết quả do lỗi kết nối
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mb-4 leading-relaxed">
              Vui lòng kiểm tra lại kết nối mạng của bạn hoặc thử kết nối lại với máy chủ.
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <RotateCw size={14} />
                <span>Thử lại</span>
              </button>
            )}
          </div>
        )}

        {/* 3. Trạng thái Không có kết quả / Rỗng (UC-03 E2) */}
        {!loading && !error && listings.length === 0 && (
          <div
            data-testid="empty-results-state"
            className="py-10 px-4 text-center flex flex-col items-center justify-center my-auto"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-3">
              <SearchX size={28} />
            </div>
            <h3 className="font-bold text-slate-800 text-base mb-1">Không tìm thấy tin</h3>
            <p className="text-xs text-slate-500 max-w-xs mb-4 leading-relaxed">
              Không tìm thấy tin đăng nào trong khu vực này. Bạn có thể thử mở rộng bán kính tìm kiếm
              hoặc giảm điều kiện điểm tình trạng tối thiểu để xem thêm tin.
            </p>

            {/* Các nút hành động gợi ý theo tiêu chí UC-03 E2 */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <button
                onClick={handleExpandRadius}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                <Compass size={13} />
                <span>Tăng bán kính lên 20 km</span>
              </button>
              <button
                onClick={handleClearMinScore}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                <Sparkles size={13} />
                <span>Bỏ lọc điểm tối thiểu</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. Danh sách các dòng tin đăng */}
        {!loading && !error && listings.length > 0 && (
          <div className="space-y-2">
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
                  className={`group relative flex gap-3 p-2.5 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-400'
                      : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  {/* Thumbnail ảnh */}
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-[10px]">
                        <Compass size={20} className="mb-0.5 opacity-40" />
                        <span>EcoFind</span>
                      </div>
                    )}

                    {/* Badge điểm tình trạng trên ảnh */}
                    <div
                      style={{ backgroundColor: rankColor.bg }}
                      className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white shadow-sm flex items-center gap-0.5"
                      title={`Điểm tình trạng: ${score.toFixed(1)}/10`}
                    >
                      <span>{score.toFixed(1)}</span>
                    </div>
                  </div>

                  {/* Thông tin tin đăng */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                      {/* Tiêu đề & Hạng */}
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <h4 className="text-xs font-semibold text-slate-800 truncate group-hover:text-emerald-700 transition-colors">
                          {item.title}
                        </h4>
                        <span
                          style={{
                            color: rankColor.border,
                            borderColor: rankColor.border,
                          }}
                          className="shrink-0 text-[10px] font-semibold px-1.5 py-0.2 rounded border bg-white"
                        >
                          {item.rank || rankColor.label}
                        </span>
                      </div>

                      {/* Giá */}
                      <div className="text-xs">{formatPrice(item.price)}</div>
                    </div>

                    {/* Vị trí & Khoảng cách */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 mt-1 border-t border-slate-100/80">
                      <div className="flex items-center gap-1 truncate max-w-[70%]">
                        <MapPin size={11} className="shrink-0 text-slate-400" />
                        <span className="truncate">{item.address || 'TP. Hồ Chí Minh'}</span>
                      </div>

                      {distanceStr && (
                        <span
                          data-testid={`distance-badge-${item.id}`}
                          className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0"
                        >
                          {distanceStr}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Nút xem trên map khi hover */}
                  {onSelectListing && (
                    <button
                      type="button"
                      data-testid={`btn-select-map-${item.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectListing(item.id);
                      }}
                      title="Xem vị trí trên bản đồ"
                      className="hidden sm:flex absolute top-2 right-2 p-1 rounded-lg bg-white/90 border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm cursor-pointer"
                    >
                      <Eye size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
