/**
 * PostListingPage Component (UC-05, E5, FR-08, FR-09, BR-01, BR-02, BR-04, BR-05, TC-05, TC-06, TE9C744, TE9C745, TE9C746).
 * Màn hình Đăng tin bán đồ cũ:
 *  - Thông tin cơ bản: Tiêu đề, Danh mục, Giá bán (0đ là Cho tặng), Mô tả.
 *  - Hình ảnh sản phẩm: 1–5 ảnh JPG/PNG, xem trước, đổi thứ tự, xóa (PhotoUploader).
 *  - Vị trí: Địa chỉ và tọa độ (lat, lng).
 *  - Chấm điểm tình trạng: 3 điểm thành phần (0-10) và tính điểm tổng/hạng tự động (ConditionScorer).
 *  - Gửi duyệt & phản hồi kết quả: Gửi multipart/form-data, trạng thái đang gửi, chặn bấm 2 lần,
 *    đánh dấu lỗi 400 theo fields, thông báo 'Đã gửi, chờ duyệt' và chuyển sang Tin của tôi,
 *    tin chưa hiện trên bản đồ (FR-09).
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  Tag,
  DollarSign,
  FileText,
  MapPin,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Loader2,
  Clock,
  EyeOff,
} from 'lucide-react';
import PhotoUploader from '../components/PhotoUploader';
import ConditionScorer, {
  calculateTotalScore,
  getConditionRank,
  validateComponentScore,
} from '../components/ConditionScorer';
import { getCategoriesApi } from '../api/categories';
import { createListingApi } from '../api/listings';

export default function PostListingPage() {
  const navigate = useNavigate();

  // Form State
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(10.7769);
  const [lng, setLng] = useState(106.7009);
  const [photos, setPhotos] = useState([]);

  // 3 Điểm tình trạng tự chấm (BR-01, 0 đến 10)
  const [scores, setScores] = useState({
    appearance: 8.0,
    function: 8.0,
    accessories: 8.0,
  });

  // Categories list
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Errors and submission state
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  // Ref to prevent double submission
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    async function loadCategories() {
      try {
        setLoadingCategories(true);
        const res = await getCategoriesApi();
        if (Array.isArray(res)) {
          setCategories(res);
        } else if (res?.data && Array.isArray(res.data)) {
          setCategories(res.data);
        }
      } catch (err) {
        console.error('Không thể tải danh mục:', err);
      } finally {
        setLoadingCategories(false);
      }
    }
    loadCategories();
  }, []);

  // Tự động chuyển hướng sang "Tin của tôi" khi đăng tin thành công sau 2.5s
  useEffect(() => {
    if (submitSuccess) {
      const timer = setTimeout(() => {
        navigate('/my-listings', {
          state: {
            flashMessage: 'Đã gửi, chờ duyệt',
            newListing: submitSuccess,
          },
        });
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [submitSuccess, navigate]);

  const totalScore = calculateTotalScore(scores.appearance, scores.function, scores.accessories);
  const rank = getConditionRank(totalScore);

  // Client validation
  const validateForm = () => {
    const newErrors = {};

    if (!title.trim()) {
      newErrors.title = 'Vui lòng nhập tiêu đề món đồ (E1).';
    } else if (title.trim().length > 100) {
      newErrors.title = 'Tiêu đề không được vượt quá 100 ký tự.';
    }

    if (!categoryId) {
      newErrors.categoryId = 'Vui lòng chọn danh mục phù hợp (E1).';
    }

    const numPrice = Number(price);
    if (price === '' || isNaN(numPrice)) {
      newErrors.price = 'Vui lòng nhập giá bán (hoặc 0 nếu cho tặng) (E1).';
    } else if (numPrice < 0 || numPrice > 1000000000) {
      newErrors.price = 'Giá bán phải từ 0 đến 1.000.000.000 đ (BR-05, E4).';
    }

    if (!description.trim()) {
      newErrors.description = 'Vui lòng mô tả chi tiết món đồ.';
    }

    // Bắt buộc có ít nhất 1 ảnh (BR-04, UC-05)
    if (!photos || photos.length === 0) {
      newErrors.photos = 'Vui lòng tải lên ít nhất 1 ảnh sản phẩm (BR-04).';
    } else if (photos.length > 5) {
      newErrors.photos = 'Mỗi tin chỉ được tải tối đa 5 ảnh (BR-04).';
    }

    if (!address.trim()) {
      newErrors.address = 'Vui lòng nhập địa chỉ giao dịch (E1).';
    }

    // Kiểm tra 3 điểm thành phần 0-10 (E3)
    const appErr = validateComponentScore(scores.appearance, 'Điểm ngoại quan');
    if (appErr) newErrors.appearance = appErr;

    const funcErr = validateComponentScore(scores.function, 'Điểm chức năng');
    if (funcErr) newErrors.function = funcErr;

    const accErr = validateComponentScore(scores.accessories, 'Điểm phụ kiện');
    if (accErr) newErrors.accessories = accErr;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Xử lý nộp form đăng tin (TE9C746, UC-05, FR-08, FR-09)
   * - Gửi multipart/form-data
   * - Trạng thái đang gửi (loading) và chặn bấm 2 lần
   * - Xử lý lỗi 400: đánh dấu đúng trường theo fields
   * - Thành công: thông báo 'Đã gửi, chờ duyệt' và chuyển sang Tin của tôi
   */
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    // Chặn bấm 2 lần (Double submission prevention)
    if (submitting || isSubmittingRef.current) {
      return;
    }

    setGlobalError(null);

    // Kiểm tra tính hợp lệ dữ liệu phía client trước
    if (!validateForm()) {
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      // Đóng gói multipart/form-data
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('categoryId', String(categoryId));
      formData.append('category_id', String(categoryId));
      formData.append('price', String(price));
      formData.append('description', description.trim());
      formData.append('address', address.trim());
      formData.append('lat', String(lat || 10.7769));
      formData.append('lng', String(lng || 106.7009));
      formData.append('score_appearance', String(scores.appearance));
      formData.append('scoreAppearance', String(scores.appearance));
      formData.append('score_function', String(scores.function));
      formData.append('scoreFunction', String(scores.function));
      formData.append('score_accessories', String(scores.accessories));
      formData.append('scoreAccessories', String(scores.accessories));

      // Đính kèm các tệp ảnh thực tế
      photos.forEach((photo) => {
        if (photo.file) {
          formData.append('photos', photo.file);
        }
      });

      // Gửi API tạo tin
      const res = await createListingApi(formData);

      // Thành công: thông báo 'Đã gửi, chờ duyệt'
      setSubmitSuccess({
        id: res?.id || 'new',
        title: title.trim(),
        price: Number(price),
        address: address.trim(),
        totalScore: res?.total_score ?? res?.totalScore ?? totalScore,
        rank: res?.rank ?? rank.rank,
        photoCount: photos.length,
        status: res?.status || 'pending',
        message: 'Đã gửi, chờ duyệt',
      });
    } catch (err) {
      console.error('Lỗi khi gửi duyệt tin đăng:', err);

      // Xử lý lỗi 400: đánh dấu đúng trường theo fields từ backend
      const serverFields = err.fields || err.data?.fields || {};
      const fieldErrors = {};

      if (serverFields && typeof serverFields === 'object') {
        Object.entries(serverFields).forEach(([fieldKey, msg]) => {
          let normKey = fieldKey;
          if (fieldKey === 'category_id' || fieldKey === 'categoryId') normKey = 'categoryId';
          else if (fieldKey === 'score_appearance' || fieldKey === 'scoreAppearance') normKey = 'appearance';
          else if (fieldKey === 'score_function' || fieldKey === 'scoreFunction') normKey = 'function';
          else if (fieldKey === 'score_accessories' || fieldKey === 'scoreAccessories') normKey = 'accessories';
          else if (fieldKey === 'photos' || fieldKey === 'files') normKey = 'photos';
          else if (fieldKey === 'lat' || fieldKey === 'lng') normKey = 'address';
          fieldErrors[normKey] = msg;
        });
      }

      if (Object.keys(fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
        setGlobalError('Thông tin đăng tin chưa hợp lệ. Vui lòng kiểm tra lại các trường được đánh dấu đỏ.');
      } else {
        setGlobalError(err.message || 'Có lỗi xảy ra khi gửi tin đăng (HTTP 400).');
      }
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Tiêu đề trang */}
      <div className="flex items-center gap-3 mb-8 pb-5 border-b border-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
          <PlusCircle size={26} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Đăng tin bán đồ cũ</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Tải ảnh thực tế, định vị trên bản đồ và tự chấm điểm tình trạng món đồ (UC-05)
          </p>
        </div>
      </div>

      {/* Thông báo thành công: Đã gửi, chờ duyệt (TE9C746, FR-09) */}
      {submitSuccess ? (
        <div
          data-testid="submit-success-card"
          className="bg-white p-8 rounded-3xl border border-emerald-200 shadow-sm text-center space-y-5 animate-in fade-in"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-sm">
            <CheckCircle2 size={36} />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-emerald-800" data-testid="success-status-text">
              Đã gửi, chờ duyệt
            </h2>
            <p className="text-sm font-semibold text-emerald-700">
              Gửi tin đăng thành công!
            </p>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Tin đăng <strong>"{submitSuccess.title}"</strong> ({submitSuccess.photoCount} ảnh) đã được tiếp nhận và chuyển sang trạng thái <strong>Chờ duyệt (Pending)</strong>.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl text-sm font-semibold text-slate-700">
            <span>Điểm đánh giá: {Number(submitSuccess.totalScore).toFixed(1)}/10</span>
            <span className="text-slate-300">•</span>
            <span>Hạng: {submitSuccess.rank}</span>
          </div>

          {/* Banner quy tắc FR-09 */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 max-w-lg mx-auto text-left flex items-start gap-3">
            <EyeOff className="text-amber-600 mt-0.5 shrink-0" size={18} />
            <div className="text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-800">Quy tắc hiển thị (FR-09):</strong> Tin chưa hiện trên bản đồ công khai cho đến khi được Ban quản trị phê duyệt. Bạn có thể theo dõi tiến độ duyệt tin trong mục <strong>Tin của tôi</strong>.
            </div>
          </div>

          <p className="text-xs text-slate-400 italic">
            Tự động chuyển sang trang Tin của tôi sau vài giây...
          </p>

          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                navigate('/my-listings', {
                  state: {
                    flashMessage: 'Đã gửi, chờ duyệt',
                    newListing: submitSuccess,
                  },
                });
              }}
              data-testid="go-to-my-listings-btn"
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/20"
            >
              Chuyển sang Tin của tôi <ArrowRight size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                setSubmitSuccess(null);
                setPhotos([]);
                setTitle('');
                setPrice('');
                setDescription('');
                setAddress('');
                setScores({ appearance: 8.0, function: 8.0, accessories: 8.0 });
                setErrors({});
                setGlobalError(null);
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Đăng thêm tin khác
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
          {/* Banner lỗi tổng quan hoặc lỗi 400 từ server */}
          {globalError && (
            <div
              role="alert"
              data-testid="global-error-banner"
              className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 text-sm shadow-sm"
            >
              <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Không thể gửi duyệt tin đăng (Lỗi 400)</p>
                <p className="text-xs text-red-700 mt-0.5">{globalError}</p>
              </div>
            </div>
          )}

          {/* PHẦN 1: HÌNH ẢNH SẢN PHẨM (TE9C744, BR-04) */}
          <section className="space-y-3 pb-6 border-b border-slate-100">
            <PhotoUploader
              photos={photos}
              onChange={(updatedPhotos) => {
                setPhotos(updatedPhotos);
                if (errors.photos && updatedPhotos.length > 0) {
                  setErrors((prev) => ({ ...prev, photos: null }));
                }
              }}
              error={errors.photos}
              maxPhotos={5}
            />
          </section>

          {/* PHẦN 2: THÔNG TIN CƠ BẢN (STT 32) */}
          <section className="space-y-5 pb-6 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Tag size={18} className="text-emerald-600" /> Thông tin cơ bản
            </h2>

            {/* Tiêu đề */}
            <div>
              <label htmlFor="title-input" className="block text-sm font-semibold text-slate-700 mb-1">
                Tiêu đề tin đăng <span className="text-red-500">*</span>
              </label>
              <input
                id="title-input"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: null }));
                }}
                placeholder="VD: Bàn làm việc gỗ sồi tự nhiên còn mới 90%"
                maxLength={100}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 ${
                  errors.title
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-200'
                }`}
              />
              {errors.title && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1" data-testid="error-title">
                  <AlertCircle size={13} /> {errors.title}
                </p>
              )}
            </div>

            {/* Danh mục và Giá bán */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Danh mục */}
              <div>
                <label htmlFor="category-select" className="block text-sm font-semibold text-slate-700 mb-1">
                  Danh mục hàng hóa / sản phẩm <span className="text-red-500">*</span>
                </label>
                <select
                  id="category-select"
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    if (errors.categoryId) setErrors((prev) => ({ ...prev, categoryId: null }));
                  }}
                  disabled={loadingCategories}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 bg-white ${
                    errors.categoryId
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
                      : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-200'
                  }`}
                >
                  <option value="">-- Chọn danh mục phù hợp --</option>
                  {categories.map((cat) => {
                    const catVal = cat.id || cat.category_id || cat.categoryId;
                    return (
                      <option key={catVal} value={catVal}>
                        {cat.name}
                      </option>
                    );
                  })}
                </select>
                {errors.categoryId && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1" data-testid="error-categoryId">
                    <AlertCircle size={13} /> {errors.categoryId}
                  </p>
                )}
              </div>

              {/* Giá bán (BR-05) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="price-input" className="block text-sm font-semibold text-slate-700">
                    Giá bán (VNĐ) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs text-emerald-600 font-medium">0đ = Cho tặng</span>
                </div>
                <div className="relative">
                  <input
                    id="price-input"
                    type="number"
                    min="0"
                    max="1000000000"
                    step="1000"
                    value={price}
                    onChange={(e) => {
                      setPrice(e.target.value);
                      if (errors.price) setErrors((prev) => ({ ...prev, price: null }));
                    }}
                    placeholder="VD: 250000 (nhập 0 nếu cho tặng)"
                    className={`w-full pl-4 pr-12 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 ${
                      errors.price
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
                        : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-200'
                    }`}
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-semibold text-slate-400">
                    VNĐ
                  </span>
                </div>
                {errors.price && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1" data-testid="error-price">
                    <AlertCircle size={13} /> {errors.price}
                  </p>
                )}
              </div>
            </div>

            {/* Mô tả */}
            <div>
              <label htmlFor="description-input" className="block text-sm font-semibold text-slate-700 mb-1">
                Mô tả chi tiết món đồ <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description-input"
                rows={4}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.description) setErrors((prev) => ({ ...prev, description: null }));
                }}
                placeholder="Mô tả kỹ tình trạng sản phẩm, kích thước, xuất xứ, thời gian đã sử dụng và lý do sang nhượng..."
                className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 resize-none ${
                  errors.description
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-200'
                }`}
              />
              {errors.description && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1" data-testid="error-description">
                  <AlertCircle size={13} /> {errors.description}
                </p>
              )}
            </div>
          </section>

          {/* PHẦN 3: VỊ TRÍ GIAO DỊCH (STT 33) */}
          <section className="space-y-4 pb-6 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <MapPin size={18} className="text-emerald-600" /> Vị trí giao dịch
            </h2>

            <div>
              <label htmlFor="address-input" className="block text-sm font-semibold text-slate-700 mb-1">
                Địa chỉ lấy hàng / giao dịch <span className="text-red-500">*</span>
              </label>
              <input
                id="address-input"
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  if (errors.address) setErrors((prev) => ({ ...prev, address: null }));
                }}
                placeholder="VD: 123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh"
                className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 ${
                  errors.address
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-200'
                }`}
              />
              {errors.address && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1" data-testid="error-address">
                  <AlertCircle size={13} /> {errors.address}
                </p>
              )}
            </div>
          </section>

          {/* PHẦN 4: CHẤM ĐIỂM TÌNH TRẠNG (TE9C745, BR-01, BR-02, E3) */}
          <section className="space-y-4 pb-6 border-b border-slate-100">
            <ConditionScorer
              values={scores}
              onChange={(newScores) => {
                setScores(newScores);
                setErrors((prev) => ({
                  ...prev,
                  appearance: null,
                  function: null,
                  accessories: null,
                }));
              }}
              errors={{
                appearance: errors.appearance,
                function: errors.function,
                accessories: errors.accessories,
              }}
            />
          </section>

          {/* NÚT GỬI DUYỆT TIN (TE9C746) */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="submit-listing-btn"
              aria-busy={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" data-testid="submitting-spinner" />
                  <span>Đang gửi...</span>
                </>
              ) : (
                <>
                  <span>Gửi duyệt</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
