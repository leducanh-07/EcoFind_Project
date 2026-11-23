import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Mail,
  Phone,
  Tag,
  MapPin,
  Calendar,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  XCircle,
  TrendingDown,
  Loader2,
  ChevronRight,
  Info,
} from 'lucide-react';
import { calculateTotalScore, getConditionRank } from './ConditionScorer';
import { approveListingApi, rejectListingApi, getAdminListingDetailApi } from '../api/admin';

export default function AdminListingModal({
  listingId,
  initialListing = null,
  isOpen,
  onClose,
  onActionSuccess,
  enableActions = true, // Cho phép thao tác duyệt/từ chối/hạ điểm
}) {
  const [listing, setListing] = useState(initialListing);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Trạng thái thao tác kiểm duyệt (TE9C74B)
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState(null);

  const [enableAdjustment, setEnableAdjustment] = useState(false);
  const [adjustedScores, setAdjustedScores] = useState({
    appearance: '',
    function: '',
    accessories: '',
  });
  const [adjustmentErrors, setAdjustmentErrors] = useState({});
  const [reviewNote, setReviewNote] = useState('');

  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Tải chi tiết tin từ API khi mở modal
  useEffect(() => {
    if (!isOpen || !listingId) return;

    let isMounted = true;
    async function loadDetail() {
      try {
        setLoading(true);
        setFetchError(null);
        const data = await getAdminListingDetailApi(listingId);
        if (isMounted) {
          setListing(data);
          setActivePhotoIdx(0);
          // Khởi tạo điểm hạ nếu có
          const app = data.scoreAppearance ?? data.score_appearance ?? 8.0;
          const fn = data.scoreFunction ?? data.score_function ?? 8.0;
          const acc = data.scoreAccessories ?? data.score_accessories ?? 8.0;
          setAdjustedScores({
            appearance: String(app),
            function: String(fn),
            accessories: String(acc),
          });
        }
      } catch (err) {
        if (isMounted) {
          setFetchError(err.message || 'Không thể tải chi tiết tin đăng');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      isMounted = false;
      setShowRejectForm(false);
      setRejectReason('');
      setRejectError(null);
      setEnableAdjustment(false);
      setActionError(null);
      setAdjustmentErrors({});
    };
  }, [isOpen, listingId]);

  if (!isOpen) return null;

  const photos = listing?.photos || [];
  const currentPhoto = photos[activePhotoIdx]?.url || listing?.thumbnailUrl || listing?.thumbnail_url || 'https://placehold.co/600x400?text=Kh%C3%B4ng+c%C3%B3+%E1%BA%A3nh';

  const origApp = parseFloat(listing?.scoreAppearance ?? listing?.score_appearance ?? 0);
  const origFunc = parseFloat(listing?.scoreFunction ?? listing?.score_function ?? 0);
  const origAcc = parseFloat(listing?.scoreAccessories ?? listing?.score_accessories ?? 0);
  const origTotal = parseFloat(listing?.totalScore ?? listing?.total_score ?? 0);
  const origRank = listing?.rank || getConditionRank(origTotal).rank;

  // Tính điểm tổng và xếp hạng mới nếu có hạ điểm
  const adjApp = adjustedScores.appearance !== '' ? parseFloat(adjustedScores.appearance) : origApp;
  const adjFunc = adjustedScores.function !== '' ? parseFloat(adjustedScores.function) : origFunc;
  const adjAcc = adjustedScores.accessories !== '' ? parseFloat(adjustedScores.accessories) : origAcc;
  const newCalculatedTotal = enableAdjustment ? calculateTotalScore(adjApp, adjFunc, adjAcc) : origTotal;
  const newCalculatedRank = getConditionRank(newCalculatedTotal);

  /**
   * Xử lý duyệt tin đăng (approve)
   */
  const handleApprove = async () => {
    setActionError(null);

    // Kiểm tra ràng buộc hạ điểm: chỉ được phép hạ điểm
    if (enableAdjustment) {
      const errors = {};
      if (adjApp > origApp) {
        errors.appearance = `Chỉ được hạ điểm. Điểm mới (${adjApp}) không được cao hơn ban đầu (${origApp}).`;
      }
      if (adjFunc > origFunc) {
        errors.function = `Chỉ được hạ điểm. Điểm mới (${adjFunc}) không được cao hơn ban đầu (${origFunc}).`;
      }
      if (adjAcc > origAcc) {
        errors.accessories = `Chỉ được hạ điểm. Điểm mới (${adjAcc}) không được cao hơn ban đầu (${origAcc}).`;
      }
      if (adjApp < 0 || adjApp > 10) errors.appearance = 'Điểm từ 0 đến 10.';
      if (adjFunc < 0 || adjFunc > 10) errors.function = 'Điểm từ 0 đến 10.';
      if (adjAcc < 0 || adjAcc > 10) errors.accessories = 'Điểm từ 0 đến 10.';

      if (Object.keys(errors).length > 0) {
        setAdjustmentErrors(errors);
        return;
      }
    }

    setSubmittingAction(true);
    try {
      const payload = {};
      if (enableAdjustment) {
        payload.adjustments = {
          score_appearance: adjApp,
          score_function: adjFunc,
          score_accessories: adjAcc,
        };
        if (reviewNote.trim()) {
          payload.note = reviewNote.trim();
        }
      }

      const res = await approveListingApi(listing.id || listingId, payload);
      if (onActionSuccess) {
        onActionSuccess({
          action: 'approved',
          listingId: listing.id || listingId,
          message: res?.message || 'Duyệt tin thành công',
          newScore: res?.totalScore ?? res?.total_score ?? newCalculatedTotal,
          newRank: res?.rank ?? newCalculatedRank.rank,
        });
      }
      onClose();
    } catch (err) {
      console.error('Lỗi khi duyệt tin:', err);
      // Xử lý lỗi 409 (E2): tin đã được xử lý
      if (err.status === 409 || err.code === 409) {
        setActionError('Tin đăng đã được xử lý bởi quản trị viên khác (Lỗi 409). Danh sách sẽ được làm mới.');
        if (onActionSuccess) {
          setTimeout(() => onActionSuccess({ action: 'conflict', listingId }), 1500);
        }
      } else {
        setActionError(err.message || 'Không thể duyệt tin đăng. Vui lòng thử lại.');
      }
    } finally {
      setSubmittingAction(false);
    }
  };

  /**
   * Xử lý từ chối tin đăng (reject)
   */
  const handleReject = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setActionError(null);
    setRejectError(null);

    if (!rejectReason || !rejectReason.trim()) {
      setRejectError('Vui lòng nhập lý do từ chối tin đăng.');
      return;
    }

    setSubmittingAction(true);
    try {
      const res = await rejectListingApi(listing.id || listingId, {
        reason: rejectReason.trim(),
      });
      if (onActionSuccess) {
        onActionSuccess({
          action: 'rejected',
          listingId: listing.id || listingId,
          message: res?.message || 'Đã từ chối tin đăng',
          reason: rejectReason.trim(),
        });
      }
      onClose();
    } catch (err) {
      console.error('Lỗi khi từ chối tin:', err);
      if (err.status === 409 || err.code === 409) {
        setActionError('Tin đăng đã được xử lý bởi quản trị viên khác (Lỗi 409). Danh sách sẽ được làm mới.');
        if (onActionSuccess) {
          setTimeout(() => onActionSuccess({ action: 'conflict', listingId }), 1500);
        }
      } else {
        setActionError(err.message || 'Không thể từ chối tin đăng. Vui lòng thử lại.');
      }
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-detail-title"
      data-testid="admin-listing-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in"
    >
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200" data-testid="modal-status-badge">
              {listing?.status === 'pending' ? 'Chờ kiểm duyệt' : listing?.status}
            </span>
            <span className="text-xs text-slate-400">Mã tin: #{listing?.id || listingId}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng chi tiết"
            data-testid="close-modal-btn"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* THÂN MODAL */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3" data-testid="modal-loading-spinner">
              <Loader2 size={32} className="animate-spin text-emerald-600" />
              <p className="text-sm font-medium">Đang tải thông tin chi tiết tin đăng...</p>
            </div>
          )}

          {fetchError && (
            <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 text-sm">
              <AlertCircle size={20} className="shrink-0 text-red-600" />
              <div className="flex-1">{fetchError}</div>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  getAdminListingDetailApi(listingId)
                    .then((data) => setListing(data))
                    .catch((e) => setFetchError(e.message))
                    .finally(() => setLoading(false));
                }}
                className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-medium"
              >
                Thử lại
              </button>
            </div>
          )}

          {listing && !loading && (
            <>
              {/* Banner thông báo lỗi thao tác (409 Conflict, 400 Bad Request...) */}
              {actionError && (
                <div role="alert" data-testid="action-error-banner" className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 text-sm">
                  <AlertCircle size={20} className="shrink-0 text-red-600 mt-0.5" />
                  <div className="flex-1 font-medium">{actionError}</div>
                </div>
              )}

              {/* KHỐI 1: HÌNH ẢNH & THÔNG TIN CHÍNH */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* GALLERY HÌNH ẢNH SẢN PHẨM */}
                <div className="space-y-3">
                  <div className="w-full aspect-[4/3] rounded-2xl bg-slate-100 overflow-hidden border border-slate-200 relative">
                    <img
                      src={currentPhoto}
                      alt={listing.title}
                      data-testid="modal-main-photo"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-full bg-slate-900/70 text-white text-[11px] backdrop-blur-sm">
                      {photos.length > 0 ? `${activePhotoIdx + 1}/${photos.length} ảnh` : 'Chưa có ảnh'}
                    </div>
                  </div>

                  {photos.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1" data-testid="modal-photo-thumbnails">
                      {photos.map((p, idx) => (
                        <button
                          key={p.id || idx}
                          type="button"
                          onClick={() => setActivePhotoIdx(idx)}
                          className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                            activePhotoIdx === idx ? 'border-emerald-600 shadow-sm scale-95' : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img src={p.url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* THÔNG TIN SẢN PHẨM & NGƯỜI BÁN */}
                <div className="space-y-4">
                  <div>
                    <h2 id="admin-detail-title" className="text-xl font-bold text-slate-800" data-testid="modal-listing-title">
                      {listing.title}
                    </h2>
                    <p className="text-2xl font-black text-emerald-600 mt-1" data-testid="modal-listing-price">
                      {Number(listing.price) === 0 ? '🎁 Cho tặng (0 đ)' : `${Number(listing.price).toLocaleString('vi-VN')} đ`}
                    </p>
                  </div>

                  {/* Danh mục & Vị trí */}
                  <div className="space-y-2 text-sm text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2">
                      <Tag size={16} className="text-emerald-600 shrink-0" />
                      <span>Danh mục: <strong className="text-slate-800" data-testid="modal-category-name">{listing.categoryName || listing.category_name || 'Đồ cũ'}</strong></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span className="text-xs sm:text-sm">Địa chỉ: <strong className="text-slate-800" data-testid="modal-address">{listing.address}</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                      <Calendar size={14} className="shrink-0" />
                      <span>Ngày gửi: {listing.createdAt || listing.created_at ? new Date(listing.createdAt || listing.created_at).toLocaleString('vi-VN') : 'Mới gửi'}</span>
                    </div>
                  </div>

                  {/* THÔNG TIN NGƯỜI BÁN */}
                  <div className="p-4 rounded-2xl border border-slate-200 space-y-2" data-testid="modal-seller-card">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Thông tin người bán</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-800 font-semibold" data-testid="modal-seller-name">
                      <User size={16} className="text-emerald-600" />
                      <span>{listing.seller?.fullName || listing.seller?.full_name || listing.sellerName || listing.seller_name || 'Người dùng'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600" data-testid="modal-seller-email">
                      <Mail size={14} className="text-slate-400" />
                      <span>{listing.seller?.email || listing.sellerEmail || listing.seller_email || 'Chưa cung cấp'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600" data-testid="modal-seller-phone">
                      <Phone size={14} className="text-slate-400" />
                      <span>{listing.seller?.phone || listing.sellerPhone || listing.seller_phone || 'Chưa có SĐT'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* MÔ TẢ CHI TIẾT */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-800">Mô tả sản phẩm</h3>
                <p className="text-sm text-slate-700 whitespace-pre-line bg-slate-50/50 p-4 rounded-2xl border border-slate-100 leading-relaxed" data-testid="modal-description">
                  {listing.description || 'Không có mô tả chi tiết.'}
                </p>
              </div>

              {/* KHỐI 2: ĐIỂM TÌNH TRẠNG & PHÂN HẠNG (FR-13, FR-14, BR-01, BR-02) */}
              <div className="space-y-4 pt-2 border-t border-slate-100" data-testid="modal-condition-scores-section">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles size={18} className="text-emerald-600" /> Điểm tình trạng do người bán tự chấm
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Điểm tổng:</span>
                    <span className="text-lg font-black text-slate-900" data-testid="modal-total-score">
                      {origTotal.toFixed(1)}/10
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800" data-testid="modal-rank-badge">
                      {origRank}
                    </span>
                  </div>
                </div>

                {/* 3 THẺ ĐIỂM THÀNH PHẦN */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="text-xs font-semibold text-slate-500">Ngoại quan (40%)</div>
                    <div className="text-xl font-bold text-slate-800 mt-1" data-testid="modal-score-appearance">
                      {origApp.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ 10</span>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="text-xs font-semibold text-slate-500">Chức năng (40%)</div>
                    <div className="text-xl font-bold text-slate-800 mt-1" data-testid="modal-score-function">
                      {origFunc.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ 10</span>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="text-xs font-semibold text-slate-500">Phụ kiện (20%)</div>
                    <div className="text-xl font-bold text-slate-800 mt-1" data-testid="modal-score-accessories">
                      {origAcc.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ 10</span>
                    </div>
                  </div>
                </div>

                {/* KHU VỰC THAO TÁC HẠ ĐIỂM (TE9C74B, FR-14, UC-09 A2) */}
                {enableActions && listing.status === 'pending' && (
                  <div className="mt-4 p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm font-semibold text-amber-900 cursor-pointer">
                        <input
                          type="checkbox"
                          data-testid="toggle-adjust-score"
                          checked={enableAdjustment}
                          onChange={(e) => {
                            setEnableAdjustment(e.target.checked);
                            if (!e.target.checked) setAdjustmentErrors({});
                          }}
                          className="w-4 h-4 text-emerald-600 rounded border-amber-300 focus:ring-emerald-500"
                        />
                        <span className="flex items-center gap-1.5">
                          <TrendingDown size={16} className="text-amber-700" />
                          Hạ điểm thành phần nếu người bán tự chấm cao hơn thực tế
                        </span>
                      </label>
                      {enableAdjustment && (
                        <div className="text-xs font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-amber-200">
                          Điểm mới dự kiến: <span data-testid="new-preview-score">{newCalculatedTotal.toFixed(1)}</span> ({newCalculatedRank.rank})
                        </div>
                      )}
                    </div>

                    {enableAdjustment && (
                      <div className="space-y-4 pt-2 border-t border-amber-200/60 animate-in fade-in">
                        <p className="text-xs text-amber-800">
                          * Lưu ý: Quản trị viên chỉ được phép hạ điểm (điểm mới ≤ điểm ban đầu). Điểm tổng và xếp hạng sẽ được tính lại tự động.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Ngoại quan (gốc: {origApp})
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max={origApp}
                              data-testid="input-adj-appearance"
                              value={adjustedScores.appearance}
                              onChange={(e) => {
                                setAdjustedScores((prev) => ({ ...prev, appearance: e.target.value }));
                                if (adjustmentErrors.appearance) setAdjustmentErrors((prev) => ({ ...prev, appearance: null }));
                              }}
                              className={`w-full px-3 py-1.5 rounded-xl border text-sm bg-white ${
                                adjustmentErrors.appearance ? 'border-red-500' : 'border-slate-300'
                              }`}
                            />
                            {adjustmentErrors.appearance && (
                              <p className="text-[11px] text-red-600 mt-0.5">{adjustmentErrors.appearance}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Chức năng (gốc: {origFunc})
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max={origFunc}
                              data-testid="input-adj-function"
                              value={adjustedScores.function}
                              onChange={(e) => {
                                setAdjustedScores((prev) => ({ ...prev, function: e.target.value }));
                                if (adjustmentErrors.function) setAdjustmentErrors((prev) => ({ ...prev, function: null }));
                              }}
                              className={`w-full px-3 py-1.5 rounded-xl border text-sm bg-white ${
                                adjustmentErrors.function ? 'border-red-500' : 'border-slate-300'
                              }`}
                            />
                            {adjustmentErrors.function && (
                              <p className="text-[11px] text-red-600 mt-0.5">{adjustmentErrors.function}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Phụ kiện (gốc: {origAcc})
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max={origAcc}
                              data-testid="input-adj-accessories"
                              value={adjustedScores.accessories}
                              onChange={(e) => {
                                setAdjustedScores((prev) => ({ ...prev, accessories: e.target.value }));
                                if (adjustmentErrors.accessories) setAdjustmentErrors((prev) => ({ ...prev, accessories: null }));
                              }}
                              className={`w-full px-3 py-1.5 rounded-xl border text-sm bg-white ${
                                adjustmentErrors.accessories ? 'border-red-500' : 'border-slate-300'
                              }`}
                            />
                            {adjustmentErrors.accessories && (
                              <p className="text-[11px] text-red-600 mt-0.5">{adjustmentErrors.accessories}</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Ghi chú hạ điểm gửi người bán (tùy chọn)
                          </label>
                          <input
                            type="text"
                            data-testid="input-adj-note"
                            value={reviewNote}
                            onChange={(e) => setReviewNote(e.target.value)}
                            placeholder="VD: Trầy xước góc cạnh và thiếu hộp cáp sạc, hạ điểm ngoại quan và phụ kiện"
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-sm bg-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* FORM NHẬP LÝ DO TỪ CHỐI (TE9C74B, FR-14, TC-11) */}
              {showRejectForm && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-3 animate-in fade-in" data-testid="reject-form-section">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-rose-900 flex items-center gap-1.5">
                      <XCircle size={16} className="text-rose-600" /> Nhập lý do từ chối tin đăng <span className="text-rose-600">*</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowRejectForm(false)}
                      className="text-xs text-rose-700 hover:underline"
                    >
                      Hủy từ chối
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    data-testid="reject-reason-input"
                    value={rejectReason}
                    onChange={(e) => {
                      setRejectReason(e.target.value);
                      if (rejectError) setRejectError(null);
                    }}
                    placeholder="VD: Hình ảnh chụp không rõ sản phẩm thực tế, vi phạm quy định đăng tin..."
                    className={`w-full px-3 py-2 rounded-xl border text-sm bg-white ${
                      rejectError ? 'border-red-500' : 'border-rose-200'
                    }`}
                  />
                  {rejectError && (
                    <p className="text-xs text-red-600 flex items-center gap-1" data-testid="error-reject-reason">
                      <AlertCircle size={13} /> {rejectError}
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={submittingAction}
                      data-testid="confirm-reject-btn"
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      {submittingAction ? 'Đang gửi...' : 'Xác nhận Từ chối tin'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER MODAL: NÚT THAO TÁC */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            data-testid="modal-dismiss-btn"
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-100 transition-colors"
          >
            Đóng
          </button>

          {enableActions && listing?.status === 'pending' && !showRejectForm && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                data-testid="modal-reject-btn"
                onClick={() => setShowRejectForm(true)}
                disabled={submittingAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <XCircle size={16} />
                <span>Từ chối</span>
              </button>
              <button
                type="button"
                data-testid="modal-approve-btn"
                onClick={handleApprove}
                disabled={submittingAction}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
              >
                {submittingAction ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang duyệt...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>{enableAdjustment ? 'Duyệt với điểm mới' : 'Duyệt tin'}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
