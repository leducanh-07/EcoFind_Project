/**
 * PostListingPage Component (UC-05, E5, FR-08, BR-04, BR-05, TC-05, TC-06, TE9C744, TE9C745).
 * Màn hình Đăng tin bán đồ cũ:
 *  - Thông tin cơ bản: Tiêu đề, Danh mục, Giá bán (0đ là Cho tặng), Mô tả.
 *  - Hình ảnh sản phẩm: 1–5 ảnh JPG/PNG, xem trước, đổi thứ tự, xóa (PhotoUploader).
 *  - Vị trí: Địa chỉ và tọa độ.
 *  - Chấm điểm tình trạng: 3 điểm thành phần (0-10) và tính điểm tổng/hạng tự động (ConditionScorer).
 */

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import PhotoUploader from '../components/PhotoUploader';
import ConditionScorer, {
  calculateTotalScore,
  getConditionRank,
  validateComponentScore,
} from '../components/ConditionScorer';
import { getCategoriesApi } from '../api/categories';

export default function PostListingPage() {
  const navigate = useNavigate();

  // Form State
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
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
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      setSubmitSuccess({
        title,
        totalScore,
        rank: rank.rank,
        photoCount: photos.length,
      });
    } catch (err) {
      setErrors({ form: err.message || 'Có lỗi xảy ra khi gửi tin đăng' });
    } finally {
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

      {submitSuccess ? (
        <div className="bg-white p-8 rounded-2xl border border-emerald-200 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Gửi tin đăng thành công!</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Tin đăng "{submitSuccess.title}" với {submitSuccess.photoCount} ảnh đã được tiếp nhận và chuyển sang trạng thái <strong>Chờ duyệt (Pending)</strong>.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl text-sm font-semibold text-slate-700">
            <span>Điểm đánh giá: {submitSuccess.totalScore}/10</span>
            <span className="text-slate-300">•</span>
            <span>Hạng: {submitSuccess.rank}</span>
          </div>
          <div className="pt-4 flex justify-center gap-3">
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
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Đăng tin khác
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors shadow-sm"
            >
              Về trang chủ bản đồ
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
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
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-200'
                }`}
              />
              {errors.title && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle size={13} /> {errors.title}
                </p>
              )}
            </div>

            {/* Danh mục & Giá bán */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="category-select" className="block text-sm font-semibold text-slate-700 mb-1">
                  Danh mục hàng hóa <span className="text-red-500">*</span>
                </label>
                <select
                  id="category-select"
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    if (errors.categoryId) setErrors((prev) => ({ ...prev, categoryId: null }));
                  }}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 bg-white ${
                    errors.categoryId
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                      : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-200'
                  }`}
                >
                  <option value="">-- Chọn danh mục --</option>
                  {categories.map((c) => (
                    <option key={c.categoryId || c.id} value={c.categoryId || c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.categoryId && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={13} /> {errors.categoryId}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="price-input" className="block text-sm font-semibold text-slate-700">
                    Giá bán (VNĐ) <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPrice('0');
                      if (errors.price) setErrors((prev) => ({ ...prev, price: null }));
                    }}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
                  >
                    Cho tặng (0đ)
                  </button>
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
                    placeholder="0 (cho tặng) hoặc nhập số tiền"
                    className={`w-full pl-4 pr-12 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 ${
                      errors.price
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
                        : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-200'
                    }`}
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-semibold text-slate-400">
                    đ
                  </span>
                </div>
                {errors.price && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
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
                placeholder="Mô tả nguồn gốc, hiện trạng sử dụng, kích thước, lý do nhượng lại..."
                className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 ${
                  errors.description
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-200'
                }`}
              />
              {errors.description && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle size={13} /> {errors.description}
                </p>
              )}
            </div>
          </section>

          {/* PHẦN 3: ĐỊA CHỈ & VỊ TRÍ */}
          <section className="space-y-4 pb-6 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <MapPin size={18} className="text-emerald-600" /> Địa điểm giao dịch
            </h2>
            <div>
              <label htmlFor="address-input" className="block text-sm font-semibold text-slate-700 mb-1">
                Địa chỉ (số nhà, tên đường, phường/xã, quận/huyện) <span className="text-red-500">*</span>
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
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-200'
                }`}
              />
              {errors.address && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
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

          {/* NÚT GỬI DUYỆT TIN */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
              data-testid="submit-listing-btn"
            >
              {submitting ? 'Đang gửi tin...' : 'Gửi duyệt tin đăng'}
              <ArrowRight size={18} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
