import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  Flag,
  AlertTriangle,
  EyeOff,
  Check,
  Search,
  RotateCcw,
  Users,
  Lock,
  Unlock,
  Star,
  Tag,
  Shield,
  BarChart3,
} from 'lucide-react';
import {
  getAdminListingsApi,
  getAdminReportsApi,
  getAdminStatsApi,
  getAdminUsersApi,
  hideAdminListingApi,
  lockAdminUserApi,
  resolveAdminReportApi,
  restoreAdminListingApi,
  unlockAdminUserApi,
} from '../api/admin';
import AdminListingModal from '../components/AdminListingModal';
import { getConditionRank } from '../components/ConditionScorer';
import { DEFAULT_FALLBACK_IMAGE, handleImageError } from '../utils/imageFallback';

const REASON_LABELS = {
  wrong_score: {
    label: 'Sai điểm tình trạng',
    color: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  scam: { label: 'Lừa đảo', color: 'bg-rose-50 text-rose-800 border-rose-200' },
  prohibited: { label: 'Hàng cấm', color: 'bg-rose-50 text-rose-800 border-rose-200' },
  other: { label: 'Lý do khác', color: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const LOCK_DURATIONS = [
  { label: '24 giờ', hours: 24 },
  { label: '7 ngày', hours: 168 },
  { label: '30 ngày', hours: 720 },
  { label: 'Dài hạn (10 năm)', hours: 87600 },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'selling' | 'hidden' | 'rejected' | 'reports' | 'users'
  const [listings, setListings] = useState([]);
  const [reports, setReports] = useState([]);
  const [reportFilterStatus, setReportFilterStatus] = useState('new'); // 'new' | 'resolved'
  const [reportsCount, setReportsCount] = useState(0);
  const [usersList, setUsersList] = useState([]);
  const [stats, setStats] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Thanh tìm kiếm & lọc theo danh mục ngay trên bảng Admin
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal xem chi tiết & kiểm duyệt tin
  const [selectedListingId, setSelectedListingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalEnableActions, setModalEnableActions] = useState(true);

  // Flash message toast
  const [toastMessage, setToastMessage] = useState(null);

  // Dialog xác nhận chung cho xử lý báo cáo, ẩn/khôi phục tin, khóa/mở khóa tài khoản
  const [confirmDialog, setConfirmDialog] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const loadOverviewStats = useCallback(async () => {
    try {
      const data = await getAdminStatsApi();
      if (data && typeof data === 'object' && data.counts) {
        setStats(data);
        if (typeof data.counts.reportsNew === 'number') {
          setReportsCount(data.counts.reportsNew);
        }
      }
    } catch {
      // Bỏ qua lỗi nền khi test chỉ mock các endpoint hàng đợi cơ bản
    }
  }, []);

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
    loadOverviewStats();
  }, [loadReportsCount, loadOverviewStats]);

  const loadData = useCallback(
    async (tabToLoad, reportStatusOverride) => {
      try {
        setLoading(true);
        setError(null);

        if (tabToLoad === 'reports') {
          const targetStatus = reportStatusOverride || reportFilterStatus || 'new';
          const data = await getAdminReportsApi({ status: targetStatus });
          const items = Array.isArray(data) ? data : [];
          setReports(items);
          if (targetStatus === 'new') {
            setReportsCount(items.length);
          }
        } else if (tabToLoad === 'users') {
          const data = await getAdminUsersApi();
          setUsersList(Array.isArray(data) ? data : []);
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
    [reportFilterStatus]
  );

  useEffect(() => {
    setSearchTerm('');
    setCategoryFilter('all');
    loadData(activeTab);
  }, [activeTab, loadData]);

  const handleRefreshAll = () => {
    loadOverviewStats();
    loadData(activeTab);
  };

  const handleActionSuccess = ({ action, listingId, message }) => {
    if (action === 'conflict') {
      loadData(activeTab);
      loadOverviewStats();
      return;
    }

    showToast(
      message || (action === 'approved' ? 'Duyệt tin thành công!' : 'Đã từ chối tin đăng!')
    );

    if (activeTab === 'pending') {
      setListings((prev) => prev.filter((item) => (item.id || item.listing_id) !== listingId));
    } else {
      loadData(activeTab);
    }
    loadOverviewStats();
  };

  const openDetail = (id) => {
    setSelectedListingId(id);
    setModalEnableActions(activeTab === 'pending');
    setIsModalOpen(true);
  };

  const openReportedListing = (listingId) => {
    setSelectedListingId(listingId);
    setModalEnableActions(false);
    setIsModalOpen(true);
  };

  const promptResolveReport = (report, type) => {
    setConfirmDialog({
      isOpen: true,
      mode: 'report',
      type, // 'hide' | 'dismiss'
      report,
      submitting: false,
      error: null,
    });
  };

  const promptListingModeration = (item, type) => {
    setConfirmDialog({
      isOpen: true,
      mode: 'listing',
      type, // 'hide_listing' | 'restore_listing'
      listing: item,
      reason: '',
      submitting: false,
      error: null,
    });
  };

  const promptUserLockAction = (member, type) => {
    setConfirmDialog({
      isOpen: true,
      mode: 'user',
      type, // 'lock_user' | 'unlock_user'
      member,
      durationHours: 168, // mặc định 7 ngày
      submitting: false,
      error: null,
    });
  };

  const handleConfirmDialogAction = async () => {
    if (!confirmDialog) return;

    // 1. Xử lý báo cáo vi phạm (hide / dismiss)
    if (confirmDialog.mode === 'report' && confirmDialog.report) {
      const { report, type } = confirmDialog;
      const reportId = report.id || report.report_id;

      try {
        setConfirmDialog((prev) => ({ ...prev, submitting: true, error: null }));
        await resolveAdminReportApi(reportId, { action: type });

        setConfirmDialog(null);
        setReports((prev) => prev.filter((r) => (r.id || r.report_id) !== reportId));
        setReportsCount((c) => Math.max(0, c - 1));
        loadOverviewStats();

        showToast(
          type === 'hide'
            ? 'Đã ẩn tin vi phạm và đóng báo cáo thành công!'
            : 'Đã bỏ qua báo cáo vi phạm.'
        );
      } catch (err) {
        if (err.status === 409 || err.code === 409) {
          setConfirmDialog(null);
          showToast('Báo cáo này đã được quản trị viên khác xử lý trước đó.');
          loadData('reports');
          loadOverviewStats();
        } else {
          setConfirmDialog((prev) => ({
            ...prev,
            submitting: false,
            error: err.message || 'Không thể xử lý báo cáo. Vui lòng thử lại.',
          }));
        }
      }
      return;
    }

    // 2. Ẩn trực tiếp / Khôi phục tin đăng
    if (confirmDialog.mode === 'listing' && confirmDialog.listing) {
      const { listing, type, reason } = confirmDialog;
      const listingId = listing.id || listing.listing_id;

      try {
        setConfirmDialog((prev) => ({ ...prev, submitting: true, error: null }));
        const res =
          type === 'hide_listing'
            ? await hideAdminListingApi(listingId, { reason })
            : await restoreAdminListingApi(listingId);

        setConfirmDialog(null);
        setListings((prev) => prev.filter((item) => (item.id || item.listing_id) !== listingId));
        loadOverviewStats();
        showToast(
          res?.message ||
            (type === 'hide_listing'
              ? 'Đã ẩn tin đăng khỏi bản đồ.'
              : 'Đã khôi phục tin đăng thành công!')
        );
      } catch (err) {
        setConfirmDialog((prev) => ({
          ...prev,
          submitting: false,
          error: err.message || 'Không thể cập nhật trạng thái tin đăng.',
        }));
      }
      return;
    }

    // 3. Khóa / Mở khóa tài khoản thành viên
    if (confirmDialog.mode === 'user' && confirmDialog.member) {
      const { member, type, durationHours } = confirmDialog;
      const memberId = member.userId || member.user_id;

      try {
        setConfirmDialog((prev) => ({ ...prev, submitting: true, error: null }));
        const res =
          type === 'lock_user'
            ? await lockAdminUserApi(memberId, { durationHours })
            : await unlockAdminUserApi(memberId);

        setConfirmDialog(null);
        setUsersList((prev) =>
          prev.map((u) => {
            const uid = u.userId || u.user_id;
            if (uid !== memberId) return u;
            return {
              ...u,
              isLocked: Boolean(res?.isLocked ?? type === 'lock_user'),
              lockedUntil: res?.lockedUntil || null,
              failedAttempts: type === 'unlock_user' ? 0 : u.failedAttempts,
            };
          })
        );
        loadOverviewStats();
        showToast(res?.message || 'Đã cập nhật trạng thái tài khoản.');
      } catch (err) {
        setConfirmDialog((prev) => ({
          ...prev,
          submitting: false,
          error: err.message || 'Không thể thay đổi trạng thái tài khoản.',
        }));
      }
    }
  };

  // Danh sách danh mục xuất hiện trong tab hiện tại phục vụ select lọc nhanh
  const availableCategories = useMemo(() => {
    const names = new Set();
    listings.forEach((item) => {
      const cname = item.categoryName || item.category_name;
      if (cname) names.add(cname);
    });
    return Array.from(names);
  }, [listings]);

  const filteredListings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return listings.filter((item) => {
      const cname = item.categoryName || item.category_name || 'Đồ cũ';
      if (categoryFilter !== 'all' && cname !== categoryFilter) {
        return false;
      }
      if (!term) return true;
      const sellerName = (
        item.sellerName ||
        item.seller_name ||
        item.seller?.fullName ||
        item.seller?.full_name ||
        ''
      ).toLowerCase();
      const sellerEmail = (
        item.sellerEmail ||
        item.seller_email ||
        item.seller?.email ||
        ''
      ).toLowerCase();
      const title = (item.title || '').toLowerCase();
      return title.includes(term) || sellerName.includes(term) || sellerEmail.includes(term);
    });
  }, [listings, searchTerm, categoryFilter]);

  const filteredReports = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return reports;
    return reports.filter((r) => {
      const title = (r.listing_title || r.listingTitle || '').toLowerCase();
      const sellerName = (r.seller_name || r.sellerName || '').toLowerCase();
      const reporterName = (
        r.reporter_name ||
        r.reporterName ||
        r.reporter_email ||
        r.reporterEmail ||
        ''
      ).toLowerCase();
      return title.includes(term) || sellerName.includes(term) || reporterName.includes(term);
    });
  }, [reports, searchTerm]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return usersList;
    return usersList.filter((u) => {
      const name = (u.fullName || u.full_name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      return name.includes(term) || email.includes(term) || phone.includes(term);
    });
  }, [usersList, searchTerm]);

  const isListingTab =
    activeTab === 'pending' ||
    activeTab === 'selling' ||
    activeTab === 'hidden' ||
    activeTab === 'rejected';

  const totalCatCount = useMemo(
    () => (stats?.categories || []).reduce((acc, c) => acc + (c.count || 0), 0),
    [stats]
  );

  return (
    <div className="max-w-[1600px] 2xl:max-w-[1720px] mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-6">
      {/* HEADER QUẢN TRỊ VIÊN (gọn gàng, không lặp pill tên user dưới Header chính) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shadow-xs shrink-0">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-emerald-950" data-testid="admin-page-title">
              Bảng điều khiển Quản trị viên
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Kiểm duyệt tin đăng, xử lý báo cáo vi phạm, quản lý thành viên và theo dõi số liệu toàn sàn
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="admin-refresh-btn"
            onClick={handleRefreshAll}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            title="Làm mới danh sách và thống kê"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-emerald-700' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* HÀNG THẺ KPI TỔNG QUAN + PHÂN BỔ DANH MỤC (hiển thị khi stats tải xong) */}
      {stats?.counts && (
        <section className="space-y-4" data-testid="admin-kpi-section">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className="text-left bg-white hover:border-amber-300 border border-slate-200/90 rounded-2xl p-4 shadow-2xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Tin chờ duyệt</span>
                <Clock size={16} className="text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-amber-700 mt-1.5" data-testid="kpi-pending">
                {stats.counts.pending ?? 0}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 group-hover:text-amber-700">
                Bấm để mở hàng đợi duyệt →
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className="text-left bg-white hover:border-rose-300 border border-slate-200/90 rounded-2xl p-4 shadow-2xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Báo cáo mới / Đã xử lý</span>
                <Flag size={16} className="text-rose-600" />
              </div>
              <div className="text-2xl font-bold text-rose-700 mt-1.5" data-testid="kpi-reports">
                {stats.counts.reportsNew ?? 0}{' '}
                <span className="text-sm font-medium text-slate-400">
                  / {stats.counts.reportsResolved ?? 0}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 group-hover:text-rose-700">
                Kiểm tra khiếu nại cộng đồng →
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('selling')}
              className="text-left bg-white hover:border-emerald-300 border border-slate-200/90 rounded-2xl p-4 shadow-2xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Đang bán · Điểm TB</span>
                <Star size={16} className="text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-800 mt-1.5 flex items-baseline gap-2" data-testid="kpi-selling">
                <span>{stats.counts.selling ?? 0}</span>
                {stats.avgSellingScore != null && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    TB {stats.avgSellingScore.toFixed(1)}/10
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 group-hover:text-emerald-700">
                Đã ẩn: {stats.counts.hidden ?? 0} · Đã bán: {stats.counts.sold ?? 0}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className="text-left bg-white hover:border-teal-300 border border-slate-200/90 rounded-2xl p-4 shadow-2xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Thành viên sàn</span>
                <Users size={16} className="text-teal-700" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1.5" data-testid="kpi-users">
                {stats.counts.usersTotal ?? 0}
                {(stats.counts.usersLocked ?? 0) > 0 && (
                  <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 align-middle">
                    {stats.counts.usersLocked} đang khóa
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 group-hover:text-teal-700">
                Quản lý tài khoản & trạng thái →
              </div>
            </button>
          </div>

          {/* Phân bổ danh mục toàn sàn */}
          {stats.categories && stats.categories.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 px-4 py-3 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 mr-1">
                <BarChart3 size={14} className="text-emerald-700" />
                <span>Phân bổ danh mục ({totalCatCount} tin):</span>
              </span>
              {stats.categories.map((cat) => (
                <span
                  key={cat.categoryId || cat.name}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-700"
                >
                  <Tag size={11} className="text-emerald-600" />
                  <span className="font-medium">{cat.name}</span>
                  <span className="font-bold text-emerald-800">{cat.count}</span>
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* FLASH TOAST NOTIFICATION */}
      {toastMessage && (
        <div
          role="status"
          data-testid="admin-toast-message"
          className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-900 text-sm shadow-xs animate-in fade-in"
        >
          <CheckCircle size={20} className="text-emerald-600 shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* TAB NAVIGATION: 6 TABS */}
      <div
        className="flex items-center gap-1.5 sm:gap-2 border-b border-slate-200 overflow-x-auto no-scrollbar pb-px"
        data-testid="admin-tabs"
      >
        <button
          type="button"
          data-testid="tab-pending"
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-4 sm:px-5 py-3 border-b-2 text-sm font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'pending'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/60 rounded-t-xl'
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
          className={`flex items-center gap-2 px-4 sm:px-5 py-3 border-b-2 text-sm font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'selling'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/60 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <CheckCircle size={16} />
          <span>Đang bán (Đã duyệt)</span>
        </button>

        <button
          type="button"
          data-testid="tab-hidden"
          onClick={() => setActiveTab('hidden')}
          className={`flex items-center gap-2 px-4 sm:px-5 py-3 border-b-2 text-sm font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'hidden'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/60 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <EyeOff size={16} />
          <span>Đã ẩn</span>
        </button>

        <button
          type="button"
          data-testid="tab-rejected"
          onClick={() => setActiveTab('rejected')}
          className={`flex items-center gap-2 px-4 sm:px-5 py-3 border-b-2 text-sm font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'rejected'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/60 rounded-t-xl'
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
          className={`flex items-center gap-2 px-4 sm:px-5 py-3 border-b-2 text-sm font-semibold transition-all cursor-pointer shrink-0 ${
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

        <button
          type="button"
          data-testid="tab-users"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 sm:px-5 py-3 border-b-2 text-sm font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'users'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/60 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users size={16} />
          <span>Thành viên</span>
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
        {/* Thanh công cụ tìm kiếm & bộ lọc con trên từng tab */}
        {!loading && (
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3.5 top-2.5 text-slate-400" />
              <input
                type="text"
                data-testid="admin-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  activeTab === 'users'
                    ? 'Tìm thành viên theo tên, email hoặc SĐT...'
                    : activeTab === 'reports'
                    ? 'Tìm báo cáo theo tiêu đề, người bán, người tố cáo...'
                    : 'Tìm nhanh theo tiêu đề, tên hoặc email người bán...'
                }
                className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            {isListingTab && availableCategories.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Danh mục:</span>
                <select
                  data-testid="admin-category-filter"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600"
                >
                  <option value="all">Tất cả ({listings.length})</option>
                  {availableCategories.map((catName) => (
                    <option key={catName} value={catName}>
                      {catName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="inline-flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl">
                <button
                  type="button"
                  data-testid="filter-reports-new"
                  onClick={() => {
                    setReportFilterStatus('new');
                    loadData('reports', 'new');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    reportFilterStatus === 'new'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Chờ xử lý
                </button>
                <button
                  type="button"
                  data-testid="filter-reports-resolved"
                  onClick={() => {
                    setReportFilterStatus('resolved');
                    loadData('reports', 'resolved');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    reportFilterStatus === 'resolved'
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Đã xử lý
                </button>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div
            data-testid="admin-loading-spinner"
            className="py-24 flex flex-col items-center justify-center text-slate-500 gap-3"
          >
            <Loader2 size={36} className="animate-spin text-emerald-700" />
            <p className="text-sm font-medium">Đang tải danh sách kiểm duyệt...</p>
          </div>
        ) : activeTab === 'users' ? (
          /* ================================================================ */
          /* TAB QUẢN LÝ THÀNH VIÊN                                           */
          /* ================================================================ */
          filteredUsers.length === 0 ? (
            <div
              data-testid="admin-empty-state"
              className="py-20 flex flex-col items-center justify-center text-center px-4"
            >
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
                <Users size={30} />
              </div>
              <h3 className="text-base font-bold text-slate-800">Không tìm thấy thành viên phù hợp</h3>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse" data-testid="admin-users-table">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-4 px-5">Thành viên</th>
                    <th className="py-4 px-5">Liên hệ</th>
                    <th className="py-4 px-5">Hoạt động tin</th>
                    <th className="py-4 px-5">Báo cáo nhận</th>
                    <th className="py-4 px-5">Trạng thái</th>
                    <th className="py-4 px-5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredUsers.map((member) => {
                    const memberId = member.userId || member.user_id;
                    const memberName = member.fullName || member.full_name || 'Thành viên';
                    const isMemberAdmin = member.role === 'admin';
                    const isLocked = Boolean(member.isLocked || member.is_locked);
                    const lockedUntil = member.lockedUntil || member.locked_until;
                    const listingsCount = member.listingsCount ?? member.listings_count ?? 0;
                    const sellingCount = member.sellingCount ?? member.selling_count ?? 0;
                    const hiddenCount = member.hiddenByAdminCount ?? member.hidden_by_admin_count ?? 0;
                    const repCount = member.reportsReceivedCount ?? member.reports_received_count ?? 0;

                    return (
                      <tr
                        key={memberId}
                        data-testid={`admin-user-row-${memberId}`}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-sm flex items-center justify-center shrink-0">
                              {memberName[0]?.toUpperCase() || 'U'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 flex items-center gap-2">
                                <span>{memberName}</span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                                    isMemberAdmin
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {isMemberAdmin ? 'Admin' : 'Thành viên'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-5 text-xs">
                          <div className="font-medium text-slate-700">{member.email}</div>
                          <div className="text-slate-400 mt-0.5">
                            {member.phone || 'Chưa cập nhật SĐT'}
                          </div>
                        </td>

                        <td className="py-4 px-5 text-xs text-slate-600">
                          <div>
                            Tổng: <strong className="text-slate-800">{listingsCount}</strong> · Đang bán:{' '}
                            <strong className="text-emerald-700">{sellingCount}</strong>
                          </div>
                          {hiddenCount > 0 && (
                            <div className="text-rose-600 mt-0.5 font-medium">
                              Bị Admin ẩn: {hiddenCount}
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-5">
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                              repCount > 0
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-50 text-slate-500 border-slate-200'
                            }`}
                          >
                            {repCount} báo cáo
                          </span>
                        </td>

                        <td className="py-4 px-5">
                          {isLocked ? (
                            <div className="inline-flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold w-fit">
                                <Lock size={12} /> Đang bị khóa
                              </span>
                              {lockedUntil && (
                                <span className="text-[11px] text-slate-400">
                                  Đến {new Date(lockedUntil).toLocaleDateString('vi-VN')}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                              <CheckCircle size={12} /> Hoạt động
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-5 text-right">
                          {isMemberAdmin ? (
                            <span className="text-xs text-slate-400 italic">Tài khoản quản trị</span>
                          ) : isLocked ? (
                            <button
                              type="button"
                              data-testid={`btn-unlock-user-${memberId}`}
                              onClick={() => promptUserLockAction(member, 'unlock_user')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <Unlock size={13} />
                              <span>Mở khóa</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              data-testid={`btn-lock-user-${memberId}`}
                              onClick={() => promptUserLockAction(member, 'lock_user')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <Lock size={13} />
                              <span>Khóa TK</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'reports' ? (
          /* ================================================================ */
          /* TAB BÁO CÁO VI PHẠM (TE9C756, UC-09, FR-15)                        */
          /* ================================================================ */
          filteredReports.length === 0 ? (
            <div
              data-testid="admin-empty-state"
              className="py-20 flex flex-col items-center justify-center text-center px-4"
            >
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
                <Inbox size={32} />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                {reportFilterStatus === 'resolved'
                  ? 'Chưa có lịch sử báo cáo nào đã xử lý'
                  : 'Không có báo cáo vi phạm nào cần xử lý'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Tất cả các tin bị báo cáo đã được giải quyết hoặc không khớp điều kiện tìm kiếm.
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
                  {filteredReports.map((report) => {
                    const reportId = report.id || report.report_id;
                    const listingId = report.listing_id || report.listingId;
                    const title =
                      report.listing_title || report.listingTitle || `Tin đăng #${listingId}`;
                    const price = report.listing_price ?? report.listingPrice;
                    const thumb =
                      report.listing_thumbnail ||
                      report.listingThumbnail ||
                      DEFAULT_FALLBACK_IMAGE;
                    const sellerName = report.seller_name || report.sellerName || 'Người bán';
                    const reporterName =
                      report.reporter_name ||
                      report.reporterName ||
                      report.reporter_email ||
                      'Người dùng';
                    const reporterEmail = report.reporter_email || report.reporterEmail || '';
                    const reasonInfo = REASON_LABELS[report.reason] || {
                      label: report.reason_label || report.reason,
                      color: 'bg-slate-100 text-slate-700 border-slate-200',
                    };
                    const isResolved = report.status === 'resolved' || reportFilterStatus === 'resolved';

                    return (
                      <tr
                        key={reportId}
                        data-testid={`report-row-${reportId}`}
                        className="hover:bg-slate-50/60 transition-colors group"
                      >
                        <td className="py-4 px-5 max-w-xs">
                          <div className="flex items-center gap-3">
                            <div className="w-13 h-13 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                              <img
                                src={thumb}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={handleImageError}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 text-xs sm:text-sm line-clamp-1 group-hover:text-teal-700 transition-colors">
                                {title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span
                                  className={`text-xs font-semibold ${
                                    price === 0 || price === '0'
                                      ? 'text-emerald-700'
                                      : price
                                      ? 'text-orange-700'
                                      : 'text-slate-400'
                                  }`}
                                >
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

                        <td className="py-4 px-5">
                          <p className="font-semibold text-slate-800 text-xs">{reporterName}</p>
                          {reporterEmail && (
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                              {reporterEmail}
                            </p>
                          )}
                        </td>

                        <td className="py-4 px-5">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${reasonInfo.color}`}
                          >
                            {reasonInfo.label}
                          </span>
                        </td>

                        <td className="py-4 px-5 max-w-xs text-xs text-slate-600">
                          {report.note ? (
                            <p className="line-clamp-2 bg-slate-50 p-2 rounded-xl border border-slate-100 italic">
                              "{report.note}"
                            </p>
                          ) : (
                            <span className="text-slate-400 italic">Không có ghi chú thêm</span>
                          )}
                        </td>

                        <td className="py-4 px-5 text-xs text-slate-500">
                          {report.created_at || report.createdAt ? (
                            <div className="flex items-center gap-1">
                              <Calendar size={13} className="shrink-0 text-slate-400" />
                              <span>
                                {new Date(
                                  report.created_at || report.createdAt
                                ).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                          ) : (
                            'Vừa xong'
                          )}
                        </td>

                        <td className="py-4 px-5 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
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

                            {isResolved ? (
                              <span className="px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                                Đã xử lý
                              </span>
                            ) : (
                              <>
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
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : filteredListings.length === 0 ? (
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
                : activeTab === 'hidden'
                ? 'Không có tin nào đang bị ẩn'
                : 'Không có tin nào bị từ chối'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {activeTab === 'pending' && listings.length === 0
                ? 'Tất cả các tin mới đã được kiểm duyệt xong. Hệ thống sẽ tự động cập nhật khi có người bán gửi tin mới.'
                : 'Không có dữ liệu khớp với bộ lọc hiện tại.'}
            </p>
          </div>
        ) : (
          /* ================================================================ */
          /* BẢNG DANH SÁCH TIN ĐĂNG (Chờ duyệt, Đang bán, Đã ẩn, Đã từ chối)   */
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
                {filteredListings.map((item) => {
                  const id = item.id || item.listing_id;
                  const thumb =
                    item.thumbnailUrl ||
                    item.thumbnail_url ||
                    (item.photos && item.photos[0]?.url) ||
                    DEFAULT_FALLBACK_IMAGE;
                  const sellerName =
                    item.sellerName ||
                    item.seller_name ||
                    item.seller?.fullName ||
                    item.seller?.full_name ||
                    'Người bán';
                  const sellerEmail =
                    item.sellerEmail || item.seller_email || item.seller?.email || '';
                  const totalScore = parseFloat(item.totalScore ?? item.total_score ?? 0);
                  const rankInfo = getConditionRank(totalScore);
                  const rank = item.rank || rankInfo.rank;
                  const isHiddenByAdmin = Boolean(item.hiddenByAdmin ?? item.hidden_by_admin);

                  return (
                    <tr
                      key={id}
                      data-testid={`admin-listing-row-${id}`}
                      className="hover:bg-slate-50/60 transition-colors group"
                    >
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

                      <td className="py-3.5 px-5 max-w-xs">
                        <p className="font-bold text-slate-800 line-clamp-1 group-hover:text-emerald-700 transition-colors">
                          {item.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span
                            className={`text-xs font-bold ${
                              Number(item.price) === 0 ? 'text-emerald-700' : 'text-orange-700'
                            }`}
                          >
                            {Number(item.price) === 0
                              ? 'Cho tặng'
                              : `${Number(item.price).toLocaleString('vi-VN')} đ`}
                          </span>
                          <span className="text-[11px] text-slate-400">•</span>
                          <span className="text-xs text-slate-500">
                            {item.categoryName || item.category_name || 'Đồ cũ'}
                          </span>
                          {activeTab === 'hidden' && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${
                                isHiddenByAdmin
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {isHiddenByAdmin ? 'Admin ẩn' : 'Người bán ẩn'}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
                        <p className="font-semibold text-slate-800 text-xs sm:text-sm">{sellerName}</p>
                        {sellerEmail && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{sellerEmail}</p>
                        )}
                      </td>

                      <td className="py-3.5 px-5 text-xs text-slate-500">
                        {item.createdAt || item.created_at ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} className="shrink-0 text-slate-400" />
                            <span>
                              {new Date(item.createdAt || item.created_at).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        ) : (
                          'Mới gửi'
                        )}
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-slate-800">
                            {totalScore.toFixed(1)}
                          </span>
                          <span
                            className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${rankInfo.badgeBg}`}
                          >
                            {rank}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            data-testid={`open-detail-btn-${id}`}
                            onClick={() => openDetail(id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
                          >
                            <Eye size={14} />
                            <span>Chi tiết</span>
                          </button>

                          {activeTab === 'selling' && (
                            <button
                              type="button"
                              data-testid={`btn-admin-hide-${id}`}
                              onClick={() => promptListingModeration(item, 'hide_listing')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors cursor-pointer"
                              title="Ẩn tin đăng vi phạm"
                            >
                              <EyeOff size={13} />
                              <span>Ẩn tin</span>
                            </button>
                          )}

                          {activeTab === 'hidden' && (
                            <button
                              type="button"
                              data-testid={`btn-admin-restore-${id}`}
                              onClick={() => promptListingModeration(item, 'restore_listing')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-colors cursor-pointer"
                              title="Khôi phục hiển thị tin đăng"
                            >
                              <RotateCcw size={13} />
                              <span>Khôi phục</span>
                            </button>
                          )}
                        </div>
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

      {/* CONFIRMATION DIALOG CHUNG: BÁO CÁO / ẨN-KHÔI PHỤC TIN / KHÓA-MỞ KHÓA USER */}
      {confirmDialog?.isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
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
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmDialog.type === 'hide' ||
                  confirmDialog.type === 'hide_listing' ||
                  confirmDialog.type === 'lock_user'
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {confirmDialog.type === 'hide' || confirmDialog.type === 'hide_listing' ? (
                  <EyeOff size={24} />
                ) : confirmDialog.type === 'restore_listing' ? (
                  <RotateCcw size={24} />
                ) : confirmDialog.type === 'lock_user' ? (
                  <Lock size={24} />
                ) : confirmDialog.type === 'unlock_user' ? (
                  <Unlock size={24} />
                ) : (
                  <AlertTriangle size={24} />
                )}
              </div>
              <div>
                <h3 className="font-bold text-emerald-950 text-lg">
                  {confirmDialog.type === 'hide'
                    ? 'Xác nhận ẩn tin vi phạm'
                    : confirmDialog.type === 'dismiss'
                    ? 'Xác nhận bỏ qua báo cáo'
                    : confirmDialog.type === 'hide_listing'
                    ? 'Ẩn trực tiếp tin đang bán'
                    : confirmDialog.type === 'restore_listing'
                    ? 'Khôi phục tin đăng đang ẩn'
                    : confirmDialog.type === 'lock_user'
                    ? 'Khóa tài khoản thành viên'
                    : 'Mở khóa tài khoản thành viên'}
                </h3>
                <p className="text-xs text-slate-500">
                  {confirmDialog.mode === 'user'
                    ? `Tài khoản: ${confirmDialog.member?.fullName || confirmDialog.member?.email}`
                    : confirmDialog.mode === 'listing'
                    ? confirmDialog.listing?.title
                    : 'Hành động này sẽ cập nhật trạng thái báo cáo vi phạm'}
                </p>
              </div>
            </div>

            {confirmDialog.mode === 'report' && (
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {confirmDialog.type === 'hide' ? (
                  <>
                    Bạn có chắc chắn muốn <strong>ẩn tin đăng này</strong> khỏi hệ thống không?
                    Tin sẽ bị gỡ khỏi bản đồ công khai và báo cáo sẽ được chuyển sang trạng thái{' '}
                    <em>Đã xử lý</em>.
                  </>
                ) : (
                  <>
                    Bạn có chắc chắn muốn <strong>bỏ qua báo cáo này</strong> không? Tin đăng sẽ được{' '}
                    <em>giữ nguyên trạng thái</em> hiển thị trên hệ thống.
                  </>
                )}
              </p>
            )}

            {confirmDialog.type === 'hide_listing' && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Lý do ẩn tin (tùy chọn)
                </label>
                <textarea
                  rows={2}
                  data-testid="input-admin-hide-reason"
                  value={confirmDialog.reason || ''}
                  onChange={(e) =>
                    setConfirmDialog((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="VD: Tin trùng lặp, giá không hợp lệ hoặc hình ảnh không phù hợp..."
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600"
                />
              </div>
            )}

            {confirmDialog.type === 'restore_listing' && (
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Tin đăng sẽ được đưa trở lại trạng thái <strong>Đang bán</strong> và hiển thị công
                khai trên bản đồ EcoFind.
              </p>
            )}

            {confirmDialog.type === 'lock_user' && (
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Chọn thời hạn tạm khóa tài khoản
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {LOCK_DURATIONS.map((opt) => (
                    <button
                      key={opt.hours}
                      type="button"
                      onClick={() =>
                        setConfirmDialog((prev) => ({ ...prev, durationHours: opt.hours }))
                      }
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        confirmDialog.durationHours === opt.hours
                          ? 'bg-rose-50 border-rose-400 text-rose-800'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {confirmDialog.type === 'unlock_user' && (
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Tài khoản sẽ được mở khóa ngay lập tức và đặt lại bộ đếm đăng nhập sai về 0.
              </p>
            )}

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
                onClick={handleConfirmDialogAction}
                disabled={confirmDialog.submitting}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer ${
                  confirmDialog.type === 'hide' ||
                  confirmDialog.type === 'hide_listing' ||
                  confirmDialog.type === 'lock_user'
                    ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                    : 'bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950'
                }`}
              >
                {confirmDialog.submitting && <Loader2 size={13} className="animate-spin" />}
                <span>
                  {confirmDialog.type === 'hide' || confirmDialog.type === 'hide_listing'
                    ? 'Đồng ý ẩn tin'
                    : confirmDialog.type === 'restore_listing'
                    ? 'Khôi phục tin'
                    : confirmDialog.type === 'lock_user'
                    ? 'Xác nhận khóa'
                    : confirmDialog.type === 'unlock_user'
                    ? 'Mở khóa ngay'
                    : 'Đồng ý bỏ qua'}
                </span>
              </button>
            </div>
          </div>
        </div>,
        document.body
        )}
    </div>
  );
}
