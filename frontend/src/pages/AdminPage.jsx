import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  AlertCircle,
  Loader2,
  Calendar,
  Inbox,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAdminListingsApi } from '../api/admin';
import AdminListingModal from '../components/AdminListingModal';

export default function AdminPage() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'selling' | 'rejected'
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal xem chi tiết & kiểm duyệt
  const [selectedListingId, setSelectedListingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Flash message toast
  const [toastMessage, setToastMessage] = useState(null);

  /**
   * Tải danh sách tin theo tab từ API (TE9C747, FR-13)
   */
  const loadListings = useCallback(async (statusToLoad) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminListingsApi({
        status: statusToLoad,
        sort: statusToLoad === 'pending' ? 'asc' : 'desc',
      });
      setListings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Không thể tải danh sách tin admin:', err);
      setError(err.message || 'Có lỗi xảy ra khi tải danh sách kiểm duyệt.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadListings(activeTab);
  }, [activeTab, loadListings]);

  /**
   * Xử lý khi thao tác duyệt hoặc từ chối thành công trong modal (TE9C74B)
   */
  const handleActionSuccess = ({ action, listingId, message }) => {
    if (action === 'conflict') {
      // Tin đã bị người khác xử lý (409) -> tải lại toàn bộ
      loadListings(activeTab);
      return;
    }

    // Hiển thị toast thông báo
    setToastMessage(message || (action === 'approved' ? 'Duyệt tin thành công!' : 'Đã từ chối tin đăng!'));
    setTimeout(() => setToastMessage(null), 3500);

    // Cập nhật danh sách: nếu đang ở tab pending, gỡ tin đã duyệt/từ chối khỏi bảng
    if (activeTab === 'pending') {
      setListings((prev) => prev.filter((item) => (item.id || item.listing_id) !== listingId));
    } else {
      loadListings(activeTab);
    }
  };

  const openDetail = (id) => {
    setSelectedListingId(id);
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* HEADER QUẢN TRỊ VIÊN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center border border-amber-500/20 shadow-sm">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800" data-testid="admin-page-title">
              Bảng điều khiển Quản trị viên (Admin)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Kiểm duyệt tin đăng: hàng đợi kiểm tra thông tin, 3 điểm thành phần và duyệt tin (FR-13, FR-14)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="admin-refresh-btn"
            onClick={() => loadListings(activeTab)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
            title="Làm mới danh sách"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-emerald-600' : ''} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5">
            <User size={14} className="text-emerald-600" />
            <span>{user?.fullName || user?.email}</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] uppercase font-bold">Admin</span>
          </div>
        </div>
      </div>

      {/* FLASH TOAST NOTIFICATION */}
      {toastMessage && (
        <div
          role="status"
          data-testid="admin-toast-message"
          className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm shadow-sm animate-in fade-in"
        >
          <CheckCircle size={20} className="text-emerald-600 shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* TAB NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px" data-testid="admin-tabs">
        <button
          type="button"
          data-testid="tab-pending"
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'pending'
              ? 'border-emerald-600 text-emerald-600 bg-emerald-50/40 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock size={16} />
          <span>Chờ duyệt</span>
          {activeTab === 'pending' && !loading && (
            <span
              data-testid="pending-count-badge"
              className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800"
            >
              {listings.length}
            </span>
          )}
        </button>

        <button
          type="button"
          data-testid="tab-selling"
          onClick={() => setActiveTab('selling')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'selling'
              ? 'border-emerald-600 text-emerald-600 bg-emerald-50/40 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <CheckCircle size={16} />
          <span>Đang bán (Đã duyệt)</span>
        </button>

        <button
          type="button"
          data-testid="tab-rejected"
          onClick={() => setActiveTab('rejected')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'rejected'
              ? 'border-emerald-600 text-emerald-600 bg-emerald-50/40 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <XCircle size={16} />
          <span>Đã từ chối</span>
        </button>
      </div>

      {/* BANNER BÁO LỖI */}
      {error && (
        <div
          role="alert"
          data-testid="admin-error-banner"
          className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-3 text-red-800 text-sm"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle size={20} className="text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadListings(activeTab)}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-semibold"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* NỘI DUNG CHÍNH: BẢNG DANH SÁCH TIN (TE9C74A, FR-13) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div
            data-testid="admin-loading-spinner"
            className="py-24 flex flex-col items-center justify-center text-slate-500 gap-3"
          >
            <Loader2 size={36} className="animate-spin text-emerald-600" />
            <p className="text-sm font-medium">Đang tải danh sách tin kiểm duyệt...</p>
          </div>
        ) : listings.length === 0 ? (
          <div
            data-testid="admin-empty-state"
            className="py-20 flex flex-col items-center justify-center text-center px-4"
          >
            <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
              <Inbox size={32} />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {activeTab === 'pending'
                ? 'Không có tin đăng nào đang chờ duyệt'
                : activeTab === 'selling'
                ? 'Không có tin nào đang hiển thị'
                : 'Không có tin nào bị từ chối'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {activeTab === 'pending'
                ? 'Tất cả các tin mới đã được kiểm duyệt xong. Hệ thống sẽ tự động cập nhật khi có người bán gửi tin mới (FR-13).'
                : 'Hàng đợi đang trống.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" data-testid="admin-listings-table">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-4 px-5">Ảnh</th>
                  <th className="py-4 px-5">Tiêu đề & Danh mục</th>
                  <th className="py-4 px-5">Người bán</th>
                  <th className="py-4 px-5">Ngày gửi</th>
                  <th className="py-4 px-5">Điểm tổng & Hạng</th>
                  <th className="py-4 px-5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {listings.map((item) => {
                  const id = item.id || item.listing_id;
                  const thumb = item.thumbnailUrl || item.thumbnail_url || (item.photos && item.photos[0]?.url) || 'https://placehold.co/100x100?text=No+Pic';
                  const sellerName = item.sellerName || item.seller_name || item.seller?.fullName || item.seller?.full_name || 'Người bán';
                  const sellerEmail = item.sellerEmail || item.seller_email || item.seller?.email || '';
                  const totalScore = parseFloat(item.totalScore ?? item.total_score ?? 0);
                  const rank = item.rank || 'Tốt';

                  return (
                    <tr
                      key={id}
                      data-testid={`admin-listing-row-${id}`}
                      className="hover:bg-slate-50/60 transition-colors group"
                    >
                      {/* CỘT 1: ẢNH SẢN PHẨM */}
                      <td className="py-3.5 px-5">
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                          <img
                            src={thumb}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                      </td>

                      {/* CỘT 2: TIÊU ĐỀ & GIÁ & DANH MỤC */}
                      <td className="py-3.5 px-5 max-w-xs">
                        <p className="font-semibold text-slate-800 line-clamp-1 group-hover:text-emerald-700 transition-colors">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-emerald-600">
                            {Number(item.price) === 0 ? 'Cho tặng' : `${Number(item.price).toLocaleString('vi-VN')} đ`}
                          </span>
                          <span className="text-[11px] text-slate-400">•</span>
                          <span className="text-xs text-slate-500">
                            {item.categoryName || item.category_name || 'Đồ cũ'}
                          </span>
                        </div>
                      </td>

                      {/* CỘT 3: NGƯỜI BÁN */}
                      <td className="py-3.5 px-5">
                        <p className="font-medium text-slate-800 text-xs sm:text-sm">{sellerName}</p>
                        {sellerEmail && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{sellerEmail}</p>
                        )}
                      </td>

                      {/* CỘT 4: NGÀY GỬI */}
                      <td className="py-3.5 px-5 text-xs text-slate-500">
                        {item.createdAt || item.created_at ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} className="shrink-0 text-slate-400" />
                            <span>{new Date(item.createdAt || item.created_at).toLocaleDateString('vi-VN')}</span>
                          </div>
                        ) : (
                          'Mới gửi'
                        )}
                      </td>

                      {/* CỘT 5: ĐIỂM TỔNG & HẠNG */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-slate-800">
                            {totalScore.toFixed(1)}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {rank}
                          </span>
                        </div>
                      </td>

                      {/* CỘT 6: NÚT XEM CHI TIẾT */}
                      <td className="py-3.5 px-5 text-right">
                        <button
                          type="button"
                          data-testid={`open-detail-btn-${id}`}
                          onClick={() => openDetail(id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                        >
                          <Eye size={14} />
                          <span>Chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL CHI TIẾT VÀ KIỂM DUYỆT TIN */}
      <AdminListingModal
        listingId={selectedListingId}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedListingId(null);
        }}
        onActionSuccess={handleActionSuccess}
        enableActions={true}
      />
    </div>
  );
}
