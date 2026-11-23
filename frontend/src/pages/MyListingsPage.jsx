/**
 * MyListingsPage Component (UC-06, E6, FR-10, TE9C74C, TE9C74D, TE9C74F, SDD 4.2).
 * Màn hình Quản lý tin của tôi:
 *  - Phân loại tin theo 5 trạng thái: Chờ duyệt (pending), Đang bán (selling),
 *    Bị từ chối (rejected), Đã bán (sold), Đã ẩn (hidden).
 *  - Nút thao tác theo trạng thái: Sửa, Ẩn, Hiện lại, Đã bán.
 *  - Tin bị từ chối hiển thị nổi bật lý do từ chối (reject_reason) và nút 'Sửa & Gửi lại'.
 *  - Tin do Admin ẩn (hidden_by_admin) có nhãn cảnh báo riêng và KHÔNG có nút 'Hiện lại'.
 *  - Modal sửa tin: Điền sẵn dữ liệu, cảnh báo trước khi lưu: 'Sửa điểm hoặc ảnh sẽ phải duyệt lại'.
 *  - Thông báo phản hồi sau mỗi thao tác thành công.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Package,
  CheckCircle2,
  Clock,
  MapPin,
  EyeOff,
  Eye,
  PlusCircle,
  Edit3,
  Check,
  AlertCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  X,
  Sparkles,
  Tag,
  DollarSign,
  FileText,
  RotateCcw,
} from 'lucide-react';
import {
  getMyListingsApi,
  updateListingApi,
  updateListingStatusApi,
  uploadPhotosApi,
} from '../api/listings';
import { getCategoriesApi } from '../api/categories';
import ConditionScorer, { calculateTotalScore, getConditionRank } from '../components/ConditionScorer';
import PhotoUploader from '../components/PhotoUploader';
import { handleImageError } from '../utils/imageFallback';

const STATUS_TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ duyệt', icon: Clock, color: 'amber' },
  { key: 'selling', label: 'Đang bán', icon: CheckCircle2, color: 'emerald' },
  { key: 'rejected', label: 'Bị từ chối', icon: XCircle, color: 'rose' },
  { key: 'sold', label: 'Đã bán', icon: Check, color: 'blue' },
  { key: 'hidden', label: 'Đã ẩn', icon: EyeOff, color: 'slate' },
];

export default function MyListingsPage() {
  const location = useLocation();
  const flashMessage = location.state?.flashMessage;
  const newListing = location.state?.newListing;

  const [activeTab, setActiveTab] = useState('all');
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Edit modal state
  const [editingListing, setEditingListing] = useState(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    categoryId: '',
    price: '',
    description: '',
    address: '',
    scoreAppearance: 8.0,
    scoreFunction: 8.0,
    scoreAccessories: 8.0,
  });
  const [editPhotos, setEditPhotos] = useState([]);
  const [originalPhotos, setOriginalPhotos] = useState([]);
  const [editPhotoError, setEditPhotoError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Fetch categories once
  useEffect(() => {
    async function loadCategories() {
      try {
        const cats = await getCategoriesApi();
        if (Array.isArray(cats)) setCategories(cats);
      } catch (err) {
        console.error('Không thể tải danh mục:', err);
      }
    }
    loadCategories();
  }, []);

  // Fetch my listings
  const fetchListings = useCallback(async (status) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyListingsApi({
        status: status === 'all' ? undefined : status,
      });
      setListings(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách tin của bạn.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings(activeTab);
  }, [activeTab, fetchListings]);

  // Handle status update (hidden, selling, sold)
  const handleStatusChange = async (listingId, newStatus) => {
    setActionLoadingId(listingId);
    setError(null);
    try {
      await updateListingStatusApi(listingId, newStatus);
      const actionMap = {
        hidden: 'Đã ẩn tin đăng thành công.',
        selling: 'Đã mở lại tin đăng thành công.',
        sold: 'Đã đánh dấu tin đăng là đã bán thành công.',
      };
      setSuccessToast(actionMap[newStatus] || 'Cập nhật trạng thái thành công.');
      setTimeout(() => setSuccessToast(null), 4000);
      await fetchListings(activeTab);
    } catch (err) {
      setError(err.message || 'Thao tác không thành công.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open edit modal
  const handleOpenEdit = (listing) => {
    setEditingListing(listing);
    setEditError(null);
    setEditPhotoError(null);
    setEditFormData({
      title: listing.title || '',
      categoryId: listing.categoryId || listing.category_id || '',
      price: listing.price !== undefined ? listing.price : '',
      description: listing.description || '',
      address: listing.address || '',
      scoreAppearance: listing.scoreAppearance ?? listing.score_appearance ?? 8.0,
      scoreFunction: listing.scoreFunction ?? listing.score_function ?? 8.0,
      scoreAccessories: listing.scoreAccessories ?? listing.score_accessories ?? 8.0,
    });

    const mappedPhotos = (listing.photos || []).map((p, idx) => {
      const url = typeof p === 'string' ? p : (p.url || p.previewUrl || '');
      return {
        id: typeof p === 'object' && p.id ? String(p.id) : `photo-${idx}`,
        previewUrl: url,
        url: url,
        sortOrder: typeof p === 'object' && p.sort_order !== undefined ? p.sort_order + 1 : idx + 1,
        name: typeof p === 'object' && p.name ? p.name : `Ảnh ${idx + 1}`,
        size: typeof p === 'object' && p.size ? p.size : 0,
      };
    });
    setEditPhotos(mappedPhotos);
    setOriginalPhotos(mappedPhotos);
  };

  // Calculate change flags for review warning
  const origApp = Number(editingListing?.scoreAppearance ?? editingListing?.score_appearance ?? 8.0);
  const origFunc = Number(editingListing?.scoreFunction ?? editingListing?.score_function ?? 8.0);
  const origAcc = Number(editingListing?.scoreAccessories ?? editingListing?.score_accessories ?? 8.0);

  const currApp = Number(editFormData.scoreAppearance);
  const currFunc = Number(editFormData.scoreFunction);
  const currAcc = Number(editFormData.scoreAccessories);

  const hasScoresChanged = Boolean(
    editingListing &&
    (origApp !== currApp || origFunc !== currFunc || origAcc !== currAcc)
  );

  const origPhotoUrls = (originalPhotos || []).map((p) => p.url || p.previewUrl || '');
  const currPhotoUrls = (editPhotos || []).map((p) => p.url || p.previewUrl || '');
  const hasPhotosChanged = Boolean(
    editingListing &&
    (origPhotoUrls.length !== currPhotoUrls.length ||
      origPhotoUrls.some((u, i) => u !== currPhotoUrls[i]) ||
      editPhotos.some((p) => p.file))
  );

  const willRequireReview = hasScoresChanged || hasPhotosChanged || editingListing?.status === 'rejected';

  // Submit edit form
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingListing) return;

    if (editPhotos.length === 0 && (editingListing.photos && editingListing.photos.length > 0)) {
      setEditPhotoError('Vui lòng giữ lại ít nhất 1 ảnh sản phẩm.');
      return;
    }

    setEditSaving(true);
    setEditError(null);
    setEditPhotoError(null);

    try {
      // 1. Upload ảnh mới nếu có file
      const newFiles = editPhotos.filter((p) => p.file).map((p) => p.file);
      let uploadedUrls = [];
      if (newFiles.length > 0) {
        const uploadRes = await uploadPhotosApi(newFiles);
        uploadedUrls = Array.isArray(uploadRes)
          ? uploadRes.map((item) => (typeof item === 'string' ? item : item.url))
          : Array.isArray(uploadRes?.urls)
          ? uploadRes.urls
          : Array.isArray(uploadRes?.photos)
          ? uploadRes.photos.map((item) => (typeof item === 'string' ? item : item.url))
          : [];
      }

      let uploadIdx = 0;
      const finalPhotoUrls = editPhotos.map((p) => {
        if (p.file) {
          const url = uploadedUrls[uploadIdx] || p.previewUrl || '';
          uploadIdx++;
          return url;
        }
        return p.url || p.previewUrl || '';
      });

      const payload = {
        title: editFormData.title.trim(),
        categoryId: editFormData.categoryId ? Number(editFormData.categoryId) : undefined,
        price: Number(editFormData.price),
        description: editFormData.description.trim(),
        address: editFormData.address.trim(),
        scoreAppearance: Number(editFormData.scoreAppearance),
        scoreFunction: Number(editFormData.scoreFunction),
        scoreAccessories: Number(editFormData.scoreAccessories),
      };

      if (finalPhotoUrls.length > 0 || hasPhotosChanged) {
        payload.photos = finalPhotoUrls;
      }

      const updated = await updateListingApi(editingListing.id, payload);
      const wasStatusReset = updated.status === 'pending' && editingListing.status !== 'pending';

      if (editingListing.status === 'rejected') {
        setSuccessToast(
          'Đã gửi lại tin đăng thành công! Tin đã chuyển về Chờ duyệt để Admin kiểm duyệt.'
        );
      } else if (wasStatusReset) {
        setSuccessToast(
          'Cập nhật thành công! Do bạn đã sửa điểm hoặc ảnh, tin đã chuyển về Chờ duyệt để Admin kiểm duyệt lại.'
        );
      } else {
        setSuccessToast(
          'Cập nhật tin đăng thành công! Sửa giá hoặc mô tả lưu ngay, không duyệt lại.'
        );
      }

      setTimeout(() => setSuccessToast(null), 5000);
      setEditingListing(null);
      await fetchListings(activeTab);
    } catch (err) {
      setEditError(err.message || 'Cập nhật tin đăng thất bại.');
    } finally {
      setEditSaving(false);
    }
  };

  // Helper badge renderers
  const renderStatusBadge = (listing) => {
    const s = listing.status;
    if (s === 'pending') {
      return (
        <span
          data-testid="status-badge-pending"
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200"
        >
          <Clock size={12} /> Chờ duyệt
        </span>
      );
    }
    if (s === 'selling') {
      return (
        <span
          data-testid="status-badge-selling"
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"
        >
          <CheckCircle2 size={12} /> Đang bán
        </span>
      );
    }
    if (s === 'rejected') {
      return (
        <span
          data-testid="status-badge-rejected"
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200"
        >
          <XCircle size={12} /> Bị từ chối
        </span>
      );
    }
    if (s === 'sold') {
      return (
        <span
          data-testid="status-badge-sold"
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200"
        >
          <Check size={12} /> Đã bán
        </span>
      );
    }
    if (s === 'hidden') {
      return (
        <span
          data-testid="status-badge-hidden"
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200"
        >
          <EyeOff size={12} /> Đã ẩn
        </span>
      );
    }
    return null;
  };

  // Helper score rank badge
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
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Banner thông báo thành công: Đã gửi, chờ duyệt (TE9C746, FR-09) */}
      {flashMessage && (
        <div
          role="status"
          data-testid="flash-success-banner"
          className="mb-6 p-5 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm flex items-start gap-4 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-emerald-900">{flashMessage}</h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                <Clock size={12} /> Chờ duyệt
              </span>
            </div>
            <p className="text-sm text-emerald-800 mt-1">
              Tin đăng của bạn đã được gửi thành công đến hệ thống và đang chờ quản trị viên phê duyệt.
            </p>
            <div className="mt-2.5 flex items-center gap-2 text-xs font-medium text-emerald-700 bg-white/70 px-3 py-1.5 rounded-lg border border-emerald-200/60 inline-flex">
              <EyeOff size={14} className="text-amber-600" />
              <span>
                <strong>Quy tắc hiển thị:</strong> Tin chưa hiện trên bản đồ cho đến khi được duyệt.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Card tin đăng vừa nộp (pending) nếu có từ điều hướng đăng tin */}
      {newListing && (
        <div
          data-testid="pending-listing-card"
          className="mb-6 p-4 sm:p-5 rounded-2xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                <Clock size={11} /> Chờ duyệt (Pending)
              </span>
              <span className="text-xs text-slate-500">Mã tin: #{newListing.id || 'Mới'}</span>
            </div>
            <h3 className="text-base font-bold text-slate-800">{newListing.title || 'Món đồ vừa đăng'}</h3>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {newListing.price !== undefined && (
                <span className="font-semibold text-emerald-700">
                  {Number(newListing.price) === 0
                    ? 'Cho tặng miễn phí'
                    : `${Number(newListing.price).toLocaleString('vi-VN')} đ`}
                </span>
              )}
              {newListing.address && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} /> {newListing.address}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-100/60 px-3 py-1.5 rounded-xl border border-amber-200">
            <EyeOff size={13} />
            <span>Chưa hiện trên bản đồ</span>
          </div>
        </div>
      )}

      {/* Success Toast / Notification */}
      {successToast && (
        <div
          role="status"
          data-testid="success-toast"
          className="mb-6 p-4 bg-emerald-50 border border-emerald-300 rounded-2xl shadow-sm flex items-center justify-between gap-3 text-emerald-800 text-sm font-medium animate-fadeIn"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
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
          data-testid="error-banner"
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

      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-sm">
              <Package size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Quản lý tin của tôi</h1>
              <p className="text-xs text-slate-500">Xem, chỉnh sửa và quản lý trạng thái các tin bạn đã đăng</p>
            </div>
          </div>
          <Link
            to="/post"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <PlusCircle size={17} /> Đăng tin mới
          </Link>
        </div>

        {/* 5 Tabs phân loại trạng thái */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-2 border-b border-slate-100 text-sm">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                data-testid={`tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-xl font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-800'
                }`}
              >
                {tab.icon && <tab.icon size={15} />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content list */}
        <div className="mt-6">
          {loading ? (
            <div data-testid="loading-indicator" className="py-16 text-center text-slate-500 flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin text-emerald-600" />
              <p className="text-sm font-medium">Đang tải danh sách tin của bạn...</p>
            </div>
          ) : listings.length === 0 ? (
            <div data-testid="empty-listings-state" className="py-16 text-center text-slate-500 space-y-3">
              <Package size={44} className="mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">Chưa có tin đăng nào trong mục này.</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Khi bạn đăng tin hoặc các tin thay đổi trạng thái, danh sách sẽ được cập nhật tự động tại đây.
              </p>
            </div>
          ) : (
            <div className="space-y-4" data-testid="listings-container">
              {listings.map((item) => {
                const isActionLoading = actionLoadingId === item.id;
                const photoUrl = item.thumbnailUrl || (item.photos && item.photos[0]?.url);

                return (
                  <div
                    key={item.id}
                    data-testid={`listing-card-${item.id}`}
                    className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
                  >
                    {/* Thông tin tin đăng */}
                    <div className="flex items-start gap-4 flex-1">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
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
                          {renderStatusBadge(item)}
                          {item.hidden_by_admin && (
                            <span
                              data-testid="admin-hidden-badge"
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300"
                            >
                              <AlertTriangle size={12} /> Bị Admin ẩn do vi phạm
                            </span>
                          )}
                          <span className="text-xs text-slate-400">Mã: #{item.id}</span>
                          {item.categoryName && (
                            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                              {item.categoryName}
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-slate-800 truncate" title={item.title}>
                          <Link to={`/listings/${item.id}`} className="hover:text-emerald-600 transition-colors">
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
                          <span className="text-slate-400 hidden sm:inline">
                            (Ngoại quan: {item.scoreAppearance ?? item.score_appearance}, Chức năng: {item.scoreFunction ?? item.score_function}, Phụ kiện: {item.scoreAccessories ?? item.score_accessories})
                          </span>
                        </div>

                        {/* Tin bị từ chối: Hiển thị lý do từ chối nổi bật */}
                        {item.status === 'rejected' && item.rejectReason && (
                          <div
                            data-testid="reject-reason-box"
                            className="mt-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2"
                          >
                            <AlertCircle size={15} className="shrink-0 text-rose-600 mt-0.5" />
                            <div>
                              <strong className="font-semibold">Lý do từ chối:</strong> {item.rejectReason}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Nút hành động theo trạng thái */}
                    <div className="flex flex-wrap sm:flex-col md:flex-row items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {/* Trạng thái SELLING: Sửa, Ẩn, Đã bán */}
                      {item.status === 'selling' && (
                        <>
                          <button
                            data-testid={`btn-edit-${item.id}`}
                            onClick={() => handleOpenEdit(item)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          >
                            <Edit3 size={13} /> Sửa
                          </button>
                          <button
                            data-testid={`btn-hide-${item.id}`}
                            disabled={isActionLoading}
                            onClick={() => handleStatusChange(item.id, 'hidden')}
                            className="px-3 py-1.5 rounded-xl border border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <EyeOff size={13} /> Ẩn tin
                          </button>
                          <button
                            data-testid={`btn-sold-${item.id}`}
                            disabled={isActionLoading}
                            onClick={() => handleStatusChange(item.id, 'sold')}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <Check size={13} /> Đã bán
                          </button>
                        </>
                      )}

                      {/* Trạng thái HIDDEN: Sửa, Hiện lại (chỉ khi không bị admin ẩn), Đã bán */}
                      {item.status === 'hidden' && (
                        <>
                          <button
                            data-testid={`btn-edit-${item.id}`}
                            onClick={() => handleOpenEdit(item)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          >
                            <Edit3 size={13} /> Sửa
                          </button>
                          {!item.hidden_by_admin && (
                            <button
                              data-testid={`btn-unhide-${item.id}`}
                              disabled={isActionLoading}
                              onClick={() => handleStatusChange(item.id, 'selling')}
                              className="px-3 py-1.5 rounded-xl border border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                              <Eye size={13} /> Hiện lại
                            </button>
                          )}
                          <button
                            data-testid={`btn-sold-${item.id}`}
                            disabled={isActionLoading}
                            onClick={() => handleStatusChange(item.id, 'sold')}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <Check size={13} /> Đã bán
                          </button>
                        </>
                      )}

                      {/* Trạng thái REJECTED: Nút Gửi lại */}
                      {item.status === 'rejected' && (
                        <button
                          data-testid={`btn-resubmit-${item.id}`}
                          onClick={() => handleOpenEdit(item)}
                          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                          title="Gửi lại tin bị từ chối"
                          aria-label="Gửi lại"
                        >
                          <RotateCcw size={13} /> Gửi lại
                        </button>
                      )}

                      {/* Trạng thái PENDING: Sửa, Ẩn tin */}
                      {item.status === 'pending' && (
                        <>
                          <button
                            data-testid={`btn-edit-${item.id}`}
                            onClick={() => handleOpenEdit(item)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          >
                            <Edit3 size={13} /> Sửa
                          </button>
                          <button
                            data-testid={`btn-hide-${item.id}`}
                            disabled={isActionLoading}
                            onClick={() => handleStatusChange(item.id, 'hidden')}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <EyeOff size={13} /> Ẩn tin
                          </button>
                        </>
                      )}

                      {/* Trạng thái SOLD: Đã hoàn tất */}
                      {item.status === 'sold' && (
                        <span className="text-xs text-slate-400 italic">Giao dịch hoàn tất</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal (Form sửa tin - R47) */}
      {editingListing && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="edit-listing-modal"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit3 size={20} className="text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-800">
                  {editingListing.status === 'rejected' ? 'Sửa & Gửi lại tin đăng' : 'Chỉnh sửa tin đăng'}
                </h2>
              </div>
              <button
                onClick={() => setEditingListing(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tin rejected: Hiển thị lý do từ chối để người bán biết cần sửa gì */}
            {editingListing.status === 'rejected' && editingListing.rejectReason && (
              <div
                data-testid="edit-modal-reject-reason"
                className="mt-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2"
              >
                <AlertCircle size={16} className="shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <strong className="font-semibold text-rose-900">Lý do từ chối trước đó:</strong> {editingListing.rejectReason}
                  <p className="mt-0.5 text-rose-700">Vui lòng chỉnh sửa nội dung vi phạm rồi bấm &apos;Gửi lại&apos; để Admin kiểm duyệt lại.</p>
                </div>
              </div>
            )}

            {/* Cảnh báo quan trọng: Sửa điểm hoặc ảnh sẽ phải duyệt lại */}
            <div
              data-testid="edit-warning-banner"
              className="mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5"
            >
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-amber-950">Lưu ý kiểm duyệt:</strong> Sửa điểm hoặc ảnh sẽ phải duyệt lại. Sửa điểm tình trạng hoặc ảnh sản phẩm sẽ khiến tin chuyển về trạng thái{' '}
                <span className="font-semibold underline">Chờ duyệt (Pending)</span> để Quản trị viên duyệt lại trước khi hiện trên bản đồ. Nếu chỉ sửa tiêu đề, giá, mô tả hoặc địa chỉ, tin vẫn giữ nguyên trạng thái hiện tại.
              </div>
            </div>

            {editError && (
              <div
                role="alert"
                className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2"
              >
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="mt-5 space-y-4">
              {/* Hình ảnh sản phẩm (PhotoUploader) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Ảnh sản phẩm (1–5 ảnh) <span className="text-rose-500">*</span>
                  </label>
                  {hasPhotosChanged && (
                    <span
                      data-testid="badge-photos-changed"
                      className="text-[11px] text-amber-800 font-semibold bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md"
                    >
                      Đã sửa ảnh (cần duyệt lại)
                    </span>
                  )}
                </div>
                <PhotoUploader
                  photos={editPhotos}
                  onChange={(updatedPhotos) => {
                    setEditPhotos(updatedPhotos);
                    if (editPhotoError) setEditPhotoError(null);
                  }}
                  error={editPhotoError}
                  maxPhotos={5}
                />
              </div>

              {/* Tiêu đề */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tiêu đề tin đăng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  placeholder="Ví dụ: Bàn phím cơ Leopold FC900R cũ còn tốt"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Danh mục & Giá bán */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Danh mục</label>
                  <select
                    value={editFormData.categoryId}
                    onChange={(e) => setEditFormData({ ...editFormData, categoryId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="">Chọn danh mục</option>
                    {categories.map((c) => (
                      <option key={c.id || c.category_id} value={c.id || c.category_id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Giá bán (VNĐ) <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, price: 0 })}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold underline"
                    >
                      Cho tặng (0đ)
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="1000000000"
                    required
                    value={editFormData.price}
                    onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })}
                    placeholder="0 đ (cho tặng) hoặc số tiền"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Địa chỉ */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Địa chỉ giao dịch</label>
                <input
                  type="text"
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  placeholder="Ví dụ: 123 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Mô tả */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả chi tiết</label>
                <textarea
                  rows={3}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  placeholder="Mô tả tình trạng, lý do thanh lý, lưu ý khi nhận hàng..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* 3 Điểm tình trạng */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">
                    Đánh giá tình trạng (Ngoại quan, Chức năng, Phụ kiện)
                  </span>
                  {hasScoresChanged && (
                    <span
                      data-testid="badge-scores-changed"
                      className="text-[11px] text-amber-800 font-semibold bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md"
                    >
                      Đã sửa điểm (cần duyệt lại)
                    </span>
                  )}
                </div>
                <ConditionScorer
                  appearanceScore={editFormData.scoreAppearance}
                  functionScore={editFormData.scoreFunction}
                  accessoriesScore={editFormData.scoreAccessories}
                  onChange={({ appearance, functionScore, accessories }) => {
                    setEditFormData((prev) => ({
                      ...prev,
                      scoreAppearance: appearance,
                      scoreFunction: functionScore,
                      scoreAccessories: accessories,
                    }));
                  }}
                />
              </div>

              {/* Cảnh báo trước khi lưu */}
              {willRequireReview ? (
                <div
                  data-testid="edit-review-warning"
                  className="p-3.5 rounded-xl bg-amber-100/80 border border-amber-300 text-xs text-amber-950 flex items-start gap-2.5 font-medium animate-fadeIn"
                >
                  <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-950">
                      Cảnh báo: Sửa điểm hoặc ảnh sẽ phải duyệt lại!
                    </p>
                    <p className="text-amber-800 mt-0.5">
                      {editingListing.status === 'rejected'
                        ? 'Tin bị từ chối khi gửi lại sẽ được chuyển về trạng thái Chờ duyệt để Admin kiểm duyệt lại.'
                        : 'Do bạn đã thay đổi điểm tình trạng hoặc ảnh sản phẩm, tin đăng sẽ chuyển về trạng thái Chờ duyệt (Pending) sau khi lưu.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  data-testid="edit-no-review-notice"
                  className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5 font-medium animate-fadeIn"
                >
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  <span>
                    <strong>Lưu ý:</strong> Sửa giá hoặc mô tả lưu ngay, không duyệt lại. Tin vẫn giữ nguyên trạng thái đang hiển thị.
                  </span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingListing(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-semibold transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  data-testid="btn-save-edit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {editSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Đang lưu...
                    </>
                  ) : editingListing.status === 'rejected' ? (
                    <>
                      <RotateCcw size={16} /> Gửi lại
                    </>
                  ) : (
                    'Lưu thay đổi'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
