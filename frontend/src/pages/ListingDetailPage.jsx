import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getListingDetailApi } from '../api/listings';
import { getRankBadgeColor } from '../components/MapView';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Tag,
  Phone,
  Lock,
  ChevronLeft,
  ChevronRight,
  Heart,
  AlertTriangle,
  Info,
  CheckCircle,
  Copy,
  PackageX,
  Share2,
  Flag,
} from 'lucide-react';

export default function ListingDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Trạng thái Lưu tin & Báo cáo (UC-04, TE9C73C)
  const [isSaved, setIsSaved] = useState(() => {
    try {
      const savedList = JSON.parse(localStorage.getItem('ecofind_saved_listings') || '[]');
      return savedList.includes(String(id));
    } catch {
      return false;
    }
  });
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Thông tin sai sự thật');
  const [reportDetail, setReportDetail] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);

  const handleToggleSave = () => {
    try {
      const savedList = JSON.parse(localStorage.getItem('ecofind_saved_listings') || '[]');
      let nextList;
      if (isSaved) {
        nextList = savedList.filter((savedId) => savedId !== String(id));
        setIsSaved(false);
      } else {
        nextList = [...savedList, String(id)];
        setIsSaved(true);
      }
      localStorage.setItem('ecofind_saved_listings', JSON.stringify(nextList));
    } catch {
      setIsSaved(!isSaved);
    }
  };

  const handleSubmitReport = (e) => {
    e.preventDefault();
    setReportSuccess(true);
    setTimeout(() => {
      setShowReportModal(false);
      setReportSuccess(false);
      setReportDetail('');
    }, 1500);
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    getListingDetailApi(id)
      .then((data) => {
        if (isMounted) {
          setListing(data);
          setActivePhotoIndex(0);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Tin không còn hiển thị hoặc đã bị xóa.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleCopyPhone = (phoneNum) => {
    if (!phoneNum) return;
    navigator.clipboard.writeText(phoneNum);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // 1. Trạng thái Đang tải dữ liệu
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-500 text-sm font-medium">Đang tải thông tin tin đăng...</p>
      </div>
    );
  }

  // 2. Trạng thái Lỗi 404 (Tin không còn hiển thị) (UC-04 E1)
  if (error || !listing) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100 shadow-sm">
          <PackageX size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Tin không còn hiển thị</h2>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          {error || 'Món đồ này có thể đã được bán, bị ẩn bởi người bán hoặc đã bị gỡ bỏ.'}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          <ArrowLeft size={16} /> Quay về bản đồ
        </Link>
      </div>
    );
  }

  const photos = listing.photos || [];
  const currentPhoto = photos[activePhotoIndex]?.url || null;
  const rankColors = getRankBadgeColor(listing.rank);
  const formattedPrice =
    listing.price === 0 ? 'Cho tặng' : `${Number(listing.price).toLocaleString('vi-VN')} đ`;

  const formattedDate = listing.createdAt
    ? new Date(listing.createdAt).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : null;

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-6">
      {/* Nút quay lại */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors"
        >
          <ArrowLeft size={16} /> Quay lại bản đồ
        </Link>
      </div>

      {/* Grid bố cục chính: 2 cột trên Desktop, 1 cột trên Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ================= CỘT TRÁI: GALLERY ẢNH ================= */}
        <div className="lg:col-span-7 space-y-3">
          {/* Khung ảnh chính */}
          <div className="relative aspect-[4/3] w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-200 shadow-sm flex items-center justify-center group">
            {currentPhoto ? (
              <img
                src={currentPhoto}
                alt={listing.title}
                className="w-full h-full object-contain sm:object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400">
                <Tag size={48} className="mb-2 opacity-50" />
                <span className="text-xs">Chưa có ảnh mô tả</span>
              </div>
            )}

            {/* Nút Prev / Next khi có nhiều hơn 1 ảnh */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setActivePhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1))
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white text-slate-800 shadow-md backdrop-blur-sm transition-all focus:outline-none"
                  aria-label="Ảnh trước"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() =>
                    setActivePhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0))
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white text-slate-800 shadow-md backdrop-blur-sm transition-all focus:outline-none"
                  aria-label="Ảnh kế tiếp"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}

            {/* Badge đếm số ảnh */}
            {photos.length > 0 && (
              <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-mono font-medium">
                Ảnh {activePhotoIndex + 1} / {photos.length}
              </div>
            )}
          </div>

          {/* Dải ảnh thu nhỏ (Thumbnails) */}
          {photos.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {photos.map((p, idx) => (
                <button
                  key={p.id || idx}
                  onClick={() => setActivePhotoIndex(idx)}
                  className={`relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                    idx === activePhotoIndex
                      ? 'border-emerald-600 ring-2 ring-emerald-200'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Phần mô tả chi tiết sản phẩm */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900 text-base">Mô tả sản phẩm</h3>
            <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
              {listing.description}
            </p>
          </div>
        </div>

        {/* ================= CỘT PHẢI: THÔNG TIN, ĐIỂM & LIÊN HỆ ================= */}
        <div className="lg:col-span-5 space-y-5">
          {/* Thẻ giá và tiêu đề */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                <Tag size={13} className="text-emerald-600" />
                {listing.categoryName || 'Đồ cũ'}
              </span>

              {formattedDate && (
                <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-mono">
                  <Calendar size={13} /> {formattedDate}
                </span>
              )}
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                {listing.title}
              </h1>
              <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-700 flex items-center gap-2">
                <span>{formattedPrice}</span>
                {listing.price === 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                    Miễn phí
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs sm:text-sm text-slate-600 pt-2 border-t border-slate-100">
              <MapPin size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <span>{listing.address}</span>
            </div>
          </div>

          {/* ================= KHỐI ĐIỂM TÌNH TRẠNG & CÁCH CHẤM (BR-01, BR-02) ================= */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Đánh giá tình trạng</h3>
                <p className="text-xs text-slate-500">Chấm điểm theo tiêu chuẩn BR-01</p>
              </div>

              {/* Huy hiệu điểm tổng */}
              <div
                style={{ backgroundColor: rankColors.bg }}
                className="px-3.5 py-1.5 rounded-2xl text-white text-center shadow-sm"
              >
                <div className="text-lg font-black leading-none">{Number(listing.totalScore).toFixed(1)}</div>
                <div className="text-[10px] font-semibold tracking-wider uppercase mt-0.5">
                  {listing.rank}
                </div>
              </div>
            </div>

            {/* 3 thanh điểm thành phần */}
            <div className="space-y-3 pt-2">
              {/* 1. Ngoại quan */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>1. Ngoại quan (Độ mới, thẩm mỹ)</span>
                  <span className="text-emerald-700">{listing.scoreAppearance} / 10</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${(listing.scoreAppearance / 10) * 100}%` }}
                  />
                </div>
              </div>

              {/* 2. Chức năng */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>2. Chức năng / Độ nguyên vẹn</span>
                  <span className="text-blue-700">{listing.scoreFunction} / 10</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${(listing.scoreFunction / 10) * 100}%` }}
                  />
                </div>
              </div>

              {/* 3. Phụ kiện */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>3. Phụ kiện đi kèm</span>
                  <span className="text-amber-700">{listing.scoreAccessories} / 10</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all"
                    style={{ width: `${(listing.scoreAccessories / 10) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Khung giải thích công thức tính điểm BR-01 */}
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3.5 text-xs text-emerald-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                <Info size={14} className="text-emerald-600" />
                <span>Công thức tính điểm (BR-01):</span>
              </div>
              <p className="font-mono text-[11px] text-emerald-800 bg-white/60 p-1.5 rounded-lg border border-emerald-200/50">
                Điểm tổng = 0,4 × Ngoại quan + 0,4 × Chức năng + 0,2 × Phụ kiện
              </p>
              <p className="text-[11px] text-emerald-800 leading-tight">
                *Với đồ dùng không có vi mạch điện tử (sách, quần áo, nội thất), điểm "Chức năng" thể hiện mức độ nguyên vẹn và khả năng sử dụng của món đồ.
              </p>
            </div>
          </div>

          {/* ================= KHỐI LIÊN HỆ NGƯỜI BÁN & SĐT (FR-07, TC-04) ================= */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Thông tin người bán</h3>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 font-bold text-lg flex items-center justify-center shadow-inner">
                {listing.sellerName ? listing.sellerName[0].toUpperCase() : 'U'}
              </div>
              <div>
                <div className="font-bold text-slate-800">{listing.sellerName}</div>
                <div className="text-xs text-slate-500">Thành viên bán đồ cũ EcoFind</div>
              </div>
            </div>

            {/* Kiểm tra trạng thái đăng nhập để hiện hoặc ẩn SĐT và các nút thao tác (UC-04, TE9C73C) */}
            {isAuthenticated ? (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                {listing.phone ? (
                  <>
                    <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-2xl border border-emerald-200/80">
                      <div className="flex items-center gap-2">
                        <Phone className="w-5 h-5 text-emerald-700" />
                        <span className="font-bold text-emerald-900 font-mono text-base">
                          {listing.phone}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyPhone(listing.phone)}
                        className="p-1.5 text-xs text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                        title="Sao chép số điện thoại"
                      >
                        {copiedPhone ? <CheckCircle size={15} /> : <Copy size={15} />}
                        <span>{copiedPhone ? 'Đã chép' : 'Chép'}</span>
                      </button>
                    </div>

                    <a
                      href={`tel:${listing.phone}`}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                      <Phone size={16} />
                      Gọi điện cho người bán
                    </a>
                  </>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                    Người bán chưa cập nhật số điện thoại
                  </div>
                )}

                {/* Các nút thao tác khi đã đăng nhập: Lưu & Báo cáo (UC-04, TE9C73C) */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    data-testid="btn-save-listing"
                    onClick={handleToggleSave}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSaved
                        ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Heart size={16} className={isSaved ? 'fill-rose-500 text-rose-500' : 'text-slate-500'} />
                    <span>{isSaved ? 'Đã lưu' : 'Lưu tin'}</span>
                  </button>

                  <button
                    type="button"
                    data-testid="btn-report-listing"
                    onClick={() => setShowReportModal(true)}
                    className="py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-200 text-slate-700 hover:text-amber-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Flag size={15} />
                    <span>Báo cáo</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-slate-400 font-mono text-sm mb-1">
                    <Phone size={15} />
                    <span>09•• ••• •••</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Số điện thoại chỉ hiển thị khi bạn đã đăng nhập
                  </p>
                </div>

                <button
                  onClick={() => navigate('/login', { state: { from: location } })}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Lock size={16} />
                  Đăng nhập để xem số điện thoại
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Báo cáo tin vi phạm (UC-04, TE9C73C) */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Flag size={18} className="text-rose-500" />
              <span>Báo cáo tin đăng vi phạm</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Giúp cộng đồng EcoFind duy trì môi trường mua bán minh bạch và an toàn.
            </p>

            {reportSuccess ? (
              <div className="py-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle size={24} />
                </div>
                <div className="font-semibold text-emerald-800 text-sm">Gửi báo cáo thành công</div>
                <p className="text-xs text-slate-500">
                  Cảm ơn bạn đã phản hồi. Ban quản trị sẽ sớm kiểm tra tin này.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Lý do báo cáo
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="Thông tin sai sự thật">Thông tin sai sự thật / Ảnh không đúng</option>
                    <option value="Hàng giả / Hàng cấm">Hàng giả, hàng cấm hoặc không được phép bán</option>
                    <option value="Đã bán nhưng chưa gỡ">Sản phẩm đã bán nhưng chưa được gỡ</option>
                    <option value="Lừa đảo / Spam">Dấu hiệu lừa đảo, quấy rối hoặc spam</option>
                    <option value="Khác">Lý do khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Chi tiết bổ sung (tùy chọn)
                  </label>
                  <textarea
                    rows={3}
                    value={reportDetail}
                    onChange={(e) => setReportDetail(e.target.value)}
                    placeholder="Mô tả cụ thể vấn đề bạn gặp phải với tin đăng này..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition-colors cursor-pointer"
                  >
                    Gửi báo cáo
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
