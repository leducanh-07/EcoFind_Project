/**
 * FavoritesPage Component (UC-07, E7, FR-11, TE9C752).
 * Màn hình Tin đăng đã lưu yêu thích:
 *  - Hiển thị danh sách các món đồ cũ đã lưu.
 *  - Tin đã bán hoặc bị ẩn có nhãn nổi bật: 'Không còn bán' (E2).
 *  - Thao tác 'Bỏ lưu' (Unfavorite) đồng bộ ngay lập tức.
 *  - Trạng thái rỗng: 'Chưa có tin yêu thích nào' kèm nút khám phá bản đồ.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart,
  Package,
  MapPin,
  Trash2,
  Compass,
  AlertCircle,
  Loader2,
  X,
  CheckCircle2,
} from 'lucide-react';
import { getFavoritesApi, removeFavoriteApi } from '../api/favorites';
import { handleImageError } from '../utils/imageFallback';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFavoritesApi();
      setFavorites(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách tin yêu thích.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const handleRemoveFavorite = async (listingId) => {
    setRemovingId(listingId);
    try {
      await removeFavoriteApi(listingId);
      setFavorites((prev) => prev.filter((item) => item.id !== listingId && item.listingId !== listingId));
      setToastMessage('Đã bỏ lưu tin đăng khỏi danh sách yêu thích.');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      setError(err.message || 'Không thể bỏ lưu tin đăng.');
    } finally {
      setRemovingId(null);
    }
  };

  const renderRankBadge = (rank) => {
    const rankColors = {
      'Như mới': 'bg-emerald-100 text-emerald-800 border-emerald-300',
      'Tốt': 'bg-blue-100 text-blue-800 border-blue-300',
      'Khá': 'bg-amber-100 text-amber-800 border-amber-300',
      'Cũ': 'bg-red-100 text-red-800 border-red-300',
    };
    const colorClass = rankColors[rank] || 'bg-slate-100 text-slate-800 border-slate-300';
    return (
      <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${colorClass}`}>
        {rank}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          data-testid="favorite-toast"
          className="mb-6 p-4 bg-emerald-50 border border-emerald-300 rounded-2xl shadow-sm flex items-center justify-between gap-3 text-emerald-800 text-sm font-medium animate-fadeIn"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 p-1"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          data-testid="favorite-error-banner"
          className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl shadow-sm flex items-center justify-between gap-3 text-rose-800 text-sm"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-600 hover:text-rose-800 p-1"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header Box */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-sm border border-rose-100">
              <Heart size={24} className="fill-rose-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Tin đăng yêu thích</h1>
              <p className="text-xs text-slate-500">
                Danh sách các món đồ bạn đã lưu để theo dõi hoặc liên hệ sau
              </p>
            </div>
          </div>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <Compass size={15} /> Khám phá bản đồ
          </Link>
        </div>

        {/* Danh sách tin yêu thích */}
        <div className="mt-6">
          {loading ? (
            <div data-testid="loading-indicator" className="py-16 text-center text-slate-500 flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin text-rose-500" />
              <p className="text-sm font-medium">Đang tải tin yêu thích...</p>
            </div>
          ) : favorites.length === 0 ? (
            <div data-testid="empty-favorites-state" className="py-16 text-center text-slate-500 space-y-3">
              <Heart size={44} className="mx-auto text-slate-300" />
              <p className="text-base font-bold text-slate-700">Chưa có tin yêu thích nào</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Bấm nút "Lưu tin" hình trái tim trên bất kỳ tin đăng nào để lưu lại và xem lại tại đây bất cứ lúc nào!
              </p>
              <div className="pt-2">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                >
                  <Compass size={16} /> Tìm đồ cũ quanh bạn
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4" data-testid="favorites-container">
              {favorites.map((item) => {
                const listingId = item.listingId || item.id;
                const isUnavailable = !item.isAvailable || item.status !== 'selling';
                const isItemRemoving = removingId === listingId;

                return (
                  <div
                    key={listingId}
                    data-testid={`favorite-card-${listingId}`}
                    className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-slate-100 shrink-0 bg-slate-50"
                          onError={handleImageError}
                        />
                      ) : (
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200/60">
                          <Package size={28} />
                        </div>
                      )}

                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Nhãn 'Không còn bán' (E2) */}
                          {isUnavailable ? (
                            <span
                              data-testid={`badge-unavailable-${listingId}`}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300"
                            >
                              Không còn bán
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Đang bán
                            </span>
                          )}

                          {item.categoryName && (
                            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                              {item.categoryName}
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-slate-800 truncate" title={item.title}>
                          <Link
                            to={`/listings/${listingId}`}
                            className="hover:text-emerald-600 transition-colors"
                          >
                            {item.title}
                          </Link>
                        </h3>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="font-bold text-sm text-emerald-700">
                            {Number(item.price) === 0
                              ? 'Cho tặng miễn phí'
                              : `${Number(item.price).toLocaleString('vi-VN')} đ`}
                          </span>
                          {item.address && (
                            <span className="flex items-center gap-1 truncate max-w-xs text-slate-500">
                              <MapPin size={12} className="shrink-0" /> {item.address}
                            </span>
                          )}
                        </div>

                        {/* Điểm tổng và xếp hạng */}
                        <div className="flex items-center gap-2 pt-1 text-xs">
                          <span className="font-semibold text-slate-700">
                            Điểm: <strong>{item.totalScore?.toFixed(1) || item.total_score}</strong>/10
                          </span>
                          {item.rank && renderRankBadge(item.rank)}
                        </div>
                      </div>
                    </div>

                    {/* Nút Bỏ lưu */}
                    <div className="shrink-0 w-full sm:w-auto flex justify-end pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <button
                        type="button"
                        data-testid={`btn-remove-favorite-${listingId}`}
                        disabled={isItemRemoving}
                        onClick={() => handleRemoveFavorite(listingId)}
                        className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isItemRemoving ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                        <span>Bỏ lưu</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
