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
  Flag,
  AlertTriangle,
  EyeOff,
  Check,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getAdminListingsApi,
  getAdminReportsApi,
  resolveAdminReportApi,
} from '../api/admin';
import AdminListingModal from '../components/AdminListingModal';
import { handleImageError } from '../utils/imageFallback';

const REASON_LABELS = {
  wrong_score: { label: 'Sai điểm tình trạng', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  scam: { label: 'Lừa đảo', color: 'bg-rose-50 text-rose-800 border-rose-200' },
  prohibited: { label: 'Hàng cấm', color: 'bg-rose-50 text-rose-800 border-rose-200' },
  other: { label: 'Lý do khác', color: 'bg-slate-100 text-slate-700 border-slate-200' },
};

export default function AdminPage() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'selling' | 'rejected' | 'reports'
  const [listings, setListings] = useState([]);
  const [reports, setReports] = useState([]);
  const [reportsCount, setReportsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal xem chi tiết & kiểm duyệt
  const [selectedListingId, setSelectedListingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalEnableActions, setModalEnableActions] = useState(true);

  // Flash message toast
  const [toastMessage, setToastMessage] = useState(null);

  // Confirmation dialog for Report Resolution (Hide or Dismiss)
  const [confirmDialog, setConfirmDialog] = useState(null); // { isOpen: bool, type: 'hide' | 'dismiss', report: Object, submitting: bool, error: null }

  /**
   * Tải số lượng báo cáo mới trong nền để hiển thị badge
   */
  const loadReportsCount = useCallback(async () => {
    try {
      const data = await getAdminReportsApi({ status: 'new' });
      if (Array.isArray(data)) {
        setReportsCount(data.length);
      }
    } catch {
      // bỏ qua lỗi đếm nền
    }
  }, []);

  useEffect(() => {
    loadReportsCount();
  }, [loadReportsCount]);

  /**
   * Tải dữ liệu theo tab (Tin đăng hoặc Báo cáo)
   */
  const loadData = useCallback(
    async (tabToLoad) => {
      try {
        setLoading(true);
        setError(null);

        if (tabToLoad === 'reports') {
          const data = await getAdminReportsApi({ status: 'new' });
          const items = Array.isArray(data) ? data : [];
          setReports(items);
          setReportsCount(items.length);
        } else {
          const data = await getAdminListingsApi({
            status: tabToLoad,
            sort: tabToLoad === 'pending' ? 'asc' : 'desc',
          });
          setListings(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Không thể tải dữ liệu admin:', err);
        setError(err.message || 'Có lỗi xảy ra khi tải danh sách kiểm duyệt.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab, loadData]);

  /**
   * Xử lý khi thao tác duyệt hoặc từ chối thành công trong modal (TE9C74B)
   */
  const handleActionSuccess = ({ action, listingId, message }) => {
    if (action === 'conflict') {
      loadData(activeTab);
      return;
    }

    setToastMessage(message || (action === 'approved' ? 'Duyệt tin thành công!' : 'Đã từ chối tin đăng!'));
    setTimeout(() => setToastMessage(null), 3500);

    if (activeTab === 'pending') {
      setListings((prev) => prev.filter((item) => (item.id || item.listing_id) !== listingId));
    } else {
      loadData(activeTab);
    }
  };

  /**
   * Xem chi tiết tin từ danh sách tin kiểm duyệt
   */
  const openDetail = (id) => {
    setSelectedListingId(id);
    setModalEnableActions(activeTab === 'pending');
    setIsModalOpen(true);
  };

  /**
   * Xem nhanh tin đăng liên quan đến báo cáo (TE9C756, UC-09)
   */
  const openReportedListing = (listingId) => {
    setSelectedListingId(listingId);
    setModalEnableActions(false); // Chế độ chỉ xem cho tin bị báo cáo
    setIsModalOpen(true);
  };

  /**
   * Mở hộp thoại xác nhận xử lý báo cáo (Ẩn tin hoặc Bỏ qua)
   */
  const promptResolveReport = (report, type) => {
    setConfirmDialog({
      isOpen: true,
      type, // 'hide' | 'dismiss'
      report,
      submitting: false,
      error: null,
    });
  };

  /**
   * Thực hiện xử lý báo cáo sau khi xác nhận (TE9C756, FR-15)
   */
  const handleConfirmResolve = async () => {
    if (!confirmDialog?.report) return;
    const { report, type } = confirmDialog;
    const reportId = report.id || report.report_id;

    try {
      setConfirmDialog((prev) => ({ ...prev, submitting: true, error: null }));
      await resolveAdminReportApi(reportId, { action: type });

      // Thành công: Đóng dialog, xóa khỏi danh sách, cập nhật badge
      setConfirmDialog(null);
      setReports((prev) => prev.filter((r) => (r.id || r.report_id) !== reportId));
      setReportsCount((c) => Math.max(0, c - 1));

      const successMsg =
        type === 'hide'
          ? 'Đã ẩn tin vi phạm và đóng báo cáo thành công!'
          : 'Đã bỏ qua báo cáo vi phạm.';
      setToastMessage(successMsg);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      if (err.status === 409 || err.code === 409) {
        setConfirmDialog(null);
        setToastMessage('Báo cáo này đã được quản trị viên khác xử lý trước đó.');
        setTimeout(() => setToastMessage(null), 3500);
        loadData('reports');
      } else {
        setConfirmDialog((prev) => ({
          ...prev,
          submitting: false,
          error: err.message || 'Không thể xử lý báo cáo. Vui lòng thử lại.',
        }));
      }
    }
  };

  return (
    <div className="max-w-[1600px] 2xl:max-w-[1720px] mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-6">
      {/* HEADER QUẢN TRỊ VIÊN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200 shadow-xs">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight" data-testid="admin-page-title">
              Bảng điều khiển Quản trị viên
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Kiểm duyệt tin đăng, đối soát 3 điểm tình trạng và xử lý báo cáo vi phạm cộng đồng
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="admin-refresh-btn"
            onClick={() => loadData(activeTab)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            title="Làm mới danh sách"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-teal-600' : ''} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-200/60">
            <User size={14} className="text-teal-600" />
            <span className="max-w-[140px] truncate">{user?.fullName || user?.email}</span>
            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] uppercase font-bold">Admin</span>
          </div>
        </div>
      </div>

      {/* FLASH TOAST NOTIFICATION */}
      {toastMessage && (
        <div
          role="status"
          data-testid="admin-toast-message"
          className="p-4 bg-teal-50 border border-teal-200 rounded-2xl flex items-center gap-3 text-teal-900 text-sm shadow-xs animate-in fade-in"
        >
          <CheckCircle size={20} className="text-teal-600 shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* TAB NAVIGATION: 4 TABS (Chờ duyệt, Đang bán, Đã từ chối, Báo cáo vi phạm) */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto no-scrollbar pb-px" data-testid="admin-tabs">
        <button
          type="button"
          data-testid="tab-pending"
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'pending'
              ? 'border-teal-600 text-teal-700 bg-teal-50/50 rounded-t-xl'
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
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'selling'
              ? 'border-teal-600 text-teal-700 bg-teal-50/50 rounded-t-xl'
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
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'rejected'
              ? 'border-teal-600 text-teal-700 bg-teal-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <XCircle size={16} />
          <span>Đã từ chối</span>
        </button>

        <button
          type="button"
          data-testid="tab-reports"
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'reports'
              ? 'border-rose-600 text-rose-700 bg-rose-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Flag size={16} className={activeTab === 'reports' ? 'text-rose-600' : 'text-slate-400'} />
          <span>Báo cáo vi phạm</span>
          {reportsCount > 0 && (
            <span
              data-testid="reports-count-badge"
              className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800"
            >
              {reportsCount}
            </span>
          )}
        </button>
      </div>

      {/* BANNER BÁO LỖI */}
      {error && (
        <div
          role="alert"
          data-testid="admin-error-banner"
          className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-rose-900 text-sm"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle size={20} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadData(activeTab)}
            className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* NỘI DUNG CHÍNH */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {loading ? (
          <div
            data-testid="admin-loading-spinner"
            className="py-24 flex flex-col items-center justify-center text-slate-500 gap-3"
          >
            <Loader2 size={36} className="animate-spin text-teal-600" />
            <p className="text-sm font-medium">Đang tải danh sách kiểm duyệt...</p>
          </div>
        ) : activeTab === 'reports' ? (
          /* ================================================================ */
          /* TAB BÁO CÁO VI PHẠM (TE9C756, UC-09, FR-15)                        */
          /* ================================================================ */
          reports.length === 0 ? (
            <div
              data-testid="admin-empty-state"
              className="py-20 flex flex-col items-center justify-center text-center px-4"
            >
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
                <Inbox size={32} />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Không có báo cáo vi phạm nào cần xử lý
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Tất cả các tin bị báo cáo đã được giải quyết hoặc chưa có khiếu nại mới từ người dùng.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse" data-testid="admin-reports-table">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-4 px-5">Tin bị báo cáo</th>
                    <th className="py-4 px-5">Người báo cáo</th>
                    <th className="py-4 px-5">Lý do vi phạm</th>
                    <th className="py-4 px-5">Ghi chú của người dùng</th>
                    <th className="py-4 px-5">Thời gian gửi</th>
                    <th className="py-4 px-5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {reports.map((report) => {
                    const reportId = report.id || report.report_id;
                    const listingId = report.listing_id || report.listingId;
                    const title = report.listing_title || report.listingTitle || `Tin đăng #${listingId}`;
                    const price = report.listing_price ?? report.listingPrice;
                    const thumb = report.listing_thumbnail || report.listingThumbnail || 'https://placehold.co/100x100?text=No+Pic';
                    const sellerName = report.seller_name || report.sellerName || 'Người bán';
                    const reporterName = report.reporter_name || report.reporterName || report.reporter_email || 'Người dùng';
                    const reporterEmail = report.reporter_email || report.reporterEmail || '';
                    const reasonInfo = REASON_LABELS[report.reason] || {
                      label: report.reason_label || report.reason,
                      color: 'bg-slate-100 text-slate-700 border-slate-200',
                    };

                    return (
                      <tr
                        key={reportId}
                        data-testid={`report-row-${reportId}`}
                        className="hover:bg-slate-50/60 transition-colors group"
                      >
                        {/* 1. Tin đăng bị báo cáo */}
                        <td className="py-4 px-5 max-w-xs">
                          <div className="flex items-center gap-3">
                            <div className="w-13 h-13 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                              <img src={thumb} alt="" className="w-full h-full object-cover" onError={handleImageError} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 text-xs sm:text-sm line-clamp-1 group-hover:text-teal-700 transition-colors">
                                {title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-semibold text-emerald-700">
                                  {price === 0 || price === '0'
                                    ? 'Cho tặng'
                                    : price
                                    ? `${Number(price).toLocaleString('vi-VN')} đ`
                                    : '—'}
                                </span>
                                <span className="text-[10px] text-slate-400">•</span>
                                <span className="text-[11px] text-slate-500 truncate">
                                  Bán bởi: {sellerName}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Người báo cáo */}
                        <td className="py-4 px-5">
                          <p className="font-semibold text-slate-800 text-xs">{reporterName}</p>
                          {reporterEmail && (
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{reporterEmail}</p>
                          )}
                        </td>

                        {/* 3. Lý do vi phạm */}
                        <td className="py-4 px-5">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${reasonInfo.color}`}
                          >
                            {reasonInfo.label}
                          </span>
                        </td>

                        {/* 4. Ghi chú của người dùng */}
                        <td className="py-4 px-5 max-w-xs text-xs text-slate-600">
                          {report.note ? (
                            <p className="line-clamp-2 bg-slate-50 p-2 rounded-xl border border-slate-100 italic">
                              "{report.note}"
                            </p>
                          ) : (
                            <span className="text-slate-400 italic">Không có ghi chú thêm</span>
                          )}
                        </td>

                        {/* 5. Thời gian */}
                        <td className="py-4 px-5 text-xs text-slate-500">
                          {report.created_at || report.createdAt ? (
                            <div className="flex items-center gap-1">
                              <Calendar size={13} className="shrink-0 text-slate-400" />
                              <span>
                                {new Date(report.created_at || report.createdAt).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                          ) : (
                            'Vừa xong'
                          )}
                        </td>

                        {/* 6. Thao tác: Xem tin, Ẩn tin vi phạm, Bỏ qua */}
                        <td className="py-4 px-5 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {/* Nút Xem nhanh tin */}
                            <button
                              type="button"
                              data-testid={`btn-view-reported-listing-${reportId}`}
                              onClick={() => openReportedListing(listingId)}
                              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                              title="Xem chi tiết tin đăng"
                            >
                              <Eye size={13} />
                              <span className="hidden lg:inline">Xem tin</span>
                            </button>

                            {/* Nút Ẩn tin vi phạm (action: hide) */}
                            <button
                              type="button"
                              data-testid={`btn-hide-reported-listing-${reportId}`}
                              onClick={() => promptResolveReport(report, 'hide')}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                              title="Ẩn tin đăng vi phạm"
                            >
                              <EyeOff size={13} />
                              <span>Ẩn tin</span>
                            </button>

                            {/* Nút Bỏ qua báo cáo (action: dismiss) */}
                            <button
                              type="button"
                              data-testid={`btn-dismiss-report-${reportId}`}
                              onClick={() => promptResolveReport(report, 'dismiss')}
                              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title="Bỏ qua báo cáo (giữ nguyên tin)"
                            >
                              <Check size={13} />
                              <span>Bỏ qua</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : listings.length === 0 ? (
          /* ================================================================ */
          /* EMPTY STATE CỦA TAB TIN ĐĂNG                                       */
          /* ================================================================ */
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
                ? 'Tất cả các tin mới đã được kiểm duyệt xong. Hệ thống sẽ tự động cập nhật khi có người bán gửi tin mới.'
                : 'Hàng đợi đang trống.'}
            </p>
          </div>
        ) : (
          /* ================================================================ */
          /* BẢNG DANH SÁCH TIN ĐĂNG (Chờ duyệt, Đang bán, Đã từ chối)           */
          /* ================================================================ */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" data-testid="admin-listings-table">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-500">
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
                  const thumb =
                    item.thumbnailUrl ||
                    item.thumbnail_url ||
                    (item.photos && item.photos[0]?.url) ||
                    'https://placehold.co/100x100?text=No+Pic';
                  const sellerName =
                    item.sellerName ||
                    item.seller_name ||
                    item.seller?.fullName ||
                    item.seller?.full_name ||
                    'Người bán';
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
                            onError={handleImageError}
                          />
                        </div>
                      </td>

                      {/* CỘT 2: TIÊU ĐỀ & GIÁ & DANH MỤC */}
                      <td className="py-3.5 px-5 max-w-xs">
                        <p className="font-bold text-slate-800 line-clamp-1 group-hover:text-teal-700 transition-colors">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-emerald-700">
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
                        <p className="font-semibold text-slate-800 text-xs sm:text-sm">{sellerName}</p>
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
                          <span className="text-base font-extrabold text-slate-800">
                            {totalScore.toFixed(1)}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-sky-50 text-sky-700 border border-sky-200">
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
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
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
        enableActions={modalEnableActions}
      />

      {/* CONFIRMATION DIALOG CHO XỬ LÝ BÁO CÁO (TE9C756, FR-15) */}
      {confirmDialog?.isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => !confirmDialog.submitting && setConfirmDialog(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  confirmDialog.type === 'hide'
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {confirmDialog.type === 'hide' ? <EyeOff size={24} /> : <AlertTriangle size={24} />}
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg">
                  {confirmDialog.type === 'hide' ? 'Xác nhận ẩn tin vi phạm' : 'Xác nhận bỏ qua báo cáo'}
                </h3>
                <p className="text-xs text-slate-500">Hành động này sẽ cập nhật trạng thái báo cáo vi phạm</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {confirmDialog.type === 'hide' ? (
                <>
                  Bạn có chắc chắn muốn <strong>ẩn tin đăng này</strong> khỏi hệ thống không?
                  Tin sẽ bị gỡ khỏi bản đồ công khai và báo cáo sẽ được chuyển sang trạng thái <em>Đã xử lý</em>.
                </>
              ) : (
                <>
                  Bạn có chắc chắn muốn <strong>bỏ qua báo cáo này</strong> không?
                  Tin đăng sẽ được <em>giữ nguyên trạng thái</em> hiển thị trên hệ thống.
                </>
              )}
            </p>

            {confirmDialog.error && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                {confirmDialog.error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                data-testid="cancel-resolve-btn"
                onClick={() => setConfirmDialog(null)}
                disabled={confirmDialog.submitting}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                data-testid="confirm-resolve-btn"
                onClick={handleConfirmResolve}
                disabled={confirmDialog.submitting}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer ${
                  confirmDialog.type === 'hide'
                    ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                    : 'bg-slate-800 hover:bg-slate-900 active:bg-slate-950'
                }`}
              >
                {confirmDialog.submitting && <Loader2 size={13} className="animate-spin" />}
                <span>
                  {confirmDialog.type === 'hide' ? 'Đồng ý ẩn tin' : 'Đồng ý bỏ qua'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
