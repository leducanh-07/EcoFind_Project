import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle2,
  ClipboardList,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Package,
  Phone,
  Save,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Tag,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  changeMyPasswordApi,
  getMyProfileApi,
  getSellerProfileApi,
  updateMyProfileApi,
} from '../api/users';

const RANK_STYLE_MAP = {
  'Như mới': 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Tốt: 'bg-teal-50 text-teal-800 border-teal-200',
  Khá: 'bg-amber-50 text-amber-800 border-amber-200',
  Cũ: 'bg-rose-50 text-rose-800 border-rose-200',
};

export default function ProfilePage() {
  const { userId } = useParams();
  const isPublicMode = Boolean(userId);
  const navigate = useNavigate();
  const { user: authUser, updateUserProfile } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tab điều khiển trong trang cá nhân (/profile): 'overview' | 'edit' | 'security'
  const [activeTab, setActiveTab] = useState('overview');

  // Form cập nhật Họ tên & SĐT (SDD 6.1)
  const [formState, setFormState] = useState({ fullName: '', phone: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(null);

  // Form Đổi mật khẩu (áp dụng cho cả User và Admin)
  const [pwdState, setPwdState] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPwd, setShowPwd] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState(null);
  const [pwdSuccess, setPwdSuccess] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      setProfileSuccess(null);
      setProfileError(null);
      setPwdSuccess(null);
      setPwdError(null);
      setActiveTab('overview');

      try {
        const data = isPublicMode
          ? await getSellerProfileApi(userId)
          : await getMyProfileApi();
        if (cancelled) return;
        setProfile(data);
        setFormState({
          fullName: data.fullName || '',
          phone: data.phone || '',
        });
        if (!isPublicMode) {
          updateUserProfile?.({
            fullName: data.fullName,
            phone: data.phone,
            role: data.role,
          });
        }
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || 'Không thể tải thông tin trang cá nhân.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [isPublicMode, userId, updateUserProfile]);

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
    if (profileError) setProfileError(null);
    if (profileSuccess) setProfileSuccess(null);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const cleanName = formState.fullName.trim();
    if (cleanName.length < 2) {
      setProfileError('Họ và tên phải có ít nhất 2 ký tự.');
      return;
    }

    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const updated = await updateMyProfileApi({
        fullName: cleanName,
        phone: formState.phone.trim() || null,
      });
      setProfile(updated);
      setFormState({
        fullName: updated.fullName || '',
        phone: updated.phone || '',
      });
      updateUserProfile?.({
        fullName: updated.fullName,
        phone: updated.phone,
      });
      setProfileSuccess('Đã cập nhật thông tin cá nhân thành công.');
    } catch (err) {
      setProfileError(err?.message || 'Không thể cập nhật thông tin. Vui lòng thử lại.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePwdChange = (e) => {
    const { name, value } = e.target;
    setPwdState((prev) => ({ ...prev, [name]: value }));
    if (pwdError) setPwdError(null);
    if (pwdSuccess) setPwdSuccess(null);
  };

  const handleSubmitPassword = async (e) => {
    e.preventDefault();
    if (!pwdState.currentPassword) {
      setPwdError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (pwdState.newPassword.length < 8) {
      setPwdError('Mật khẩu mới phải chứa ít nhất 8 ký tự.');
      return;
    }
    if (pwdState.newPassword !== pwdState.confirmPassword) {
      setPwdError('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }

    setSavingPwd(true);
    setPwdError(null);
    setPwdSuccess(null);

    try {
      const res = await changeMyPasswordApi(pwdState);
      setPwdSuccess(res?.message || 'Đổi mật khẩu thành công.');
      setPwdState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwdError(err?.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại.');
    } finally {
      setSavingPwd(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-16 flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
        <p className="text-sm font-medium">Đang tải thông tin trang cá nhân...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 shadow-sm my-6">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-4">
          <UserX size={28} />
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Không tìm thấy trang cá nhân</h1>
        <p className="text-sm text-slate-500 mb-6">
          {error || 'Tài khoản này hiện không tồn tại hoặc đã bị gỡ.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors cursor-pointer"
        >
          Về bản đồ trang chủ
        </button>
      </div>
    );
  }

  const isAccountAdmin = profile.role === 'admin';
  const isOwnPublicProfile =
    isPublicMode && authUser && Number(authUser.userId) === Number(profile.userId);
  const avatarInitial = profile.fullName ? profile.fullName[0].toUpperCase() : 'U';
  const roleBadgeLabel = isAccountAdmin ? 'Admin' : 'Thành viên';
  const activityRoleText =
    profile.activityRole ||
    (isAccountAdmin ? 'Quản trị viên kiểm duyệt & vận hành hệ thống' : 'Thành viên EcoFind');

  // Chế độ xem trang người bán công khai (/sellers/:userId)
  if (isPublicMode) {
    return (
      <div className="max-w-5xl mx-auto py-4 sm:py-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-emerald-800 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Quay lại</span>
          </button>

          {isOwnPublicProfile && (
            <Link
              to="/profile"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 rounded-xl border border-emerald-200 transition-colors"
            >
              <Edit3 size={14} />
              <span>Quản lý trang cá nhân</span>
            </Link>
          )}
        </div>

        {/* Thẻ hồ sơ công khai - avatar tách lớp rõ ràng không bị banner đè chữ */}
        <section className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="h-24 sm:h-28 bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950" />
          <div className="px-6 sm:px-8 pb-7">
            <div className="relative z-10 -mt-10 w-20 h-20 rounded-2xl bg-emerald-600 text-white border-4 border-white shadow-md flex items-center justify-center text-3xl font-bold">
              {avatarInitial}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1
                    className="text-2xl font-bold text-emerald-950"
                    data-testid="profile-full-name"
                  >
                    {profile.fullName}
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      isAccountAdmin
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    <Shield size={12} />
                    <span>{roleBadgeLabel}</span>
                  </span>
                </div>

                <div
                  className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-teal-900 bg-teal-50/90 border border-teal-200/80 px-3 py-1 rounded-xl"
                  data-testid="profile-activity-role"
                >
                  <Sparkles size={15} className="text-teal-700 shrink-0" />
                  <span>{activityRoleText}</span>
                </div>

                {profile.topCategories && profile.topCategories.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {profile.topCategories.map((cat) => (
                      <span
                        key={cat.name}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg"
                      >
                        <Tag size={12} className="text-emerald-700" />
                        <span>
                          {cat.name} ({cat.count})
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 shrink-0">
                <div className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
                  <div className="text-[11px] font-medium text-slate-500">Đang bán</div>
                  <div className="text-lg font-bold text-emerald-800">
                    {profile.stats?.sellingCount ?? 0}
                  </div>
                </div>
                <div className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
                  <div className="text-[11px] font-medium text-slate-500">Đã bán</div>
                  <div className="text-lg font-bold text-slate-800">
                    {profile.stats?.soldCount ?? 0}
                  </div>
                </div>
                <div className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
                  <div className="text-[11px] font-medium text-slate-500">Điểm TB</div>
                  <div className="text-lg font-bold text-teal-800 flex items-center justify-center gap-1">
                    <Star size={14} className="text-amber-500" />
                    <span>
                      {profile.stats?.avgScore != null ? profile.stats.avgScore.toFixed(1) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Danh sách tin đang bán công khai của người bán */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-emerald-950">
            Tin đang bán từ {profile.fullName} ({profile.listings?.length || 0})
          </h2>

          {!profile.listings || profile.listings.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center text-sm text-slate-500">
              Người dùng này hiện chưa có món đồ nào đang mở bán.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {profile.listings.map((item) => {
                const isFree = Number(item.price) === 0;
                const rankBadgeClass =
                  RANK_STYLE_MAP[item.rank] || 'bg-slate-100 text-slate-700 border-slate-200';
                return (
                  <Link
                    key={item.id}
                    to={`/listings/${item.id}`}
                    className="group bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col"
                  >
                    <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <Package size={32} />
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm line-clamp-2 group-hover:text-emerald-700 transition-colors">
                          {item.title}
                        </h3>
                        <p
                          className={`font-bold text-base mt-1 ${
                            isFree ? 'text-emerald-700' : 'text-orange-700'
                          }`}
                        >
                          {isFree ? 'Cho tặng' : `${Number(item.price).toLocaleString('vi-VN')} đ`}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-semibold ${rankBadgeClass}`}
                        >
                          <Award size={12} />
                          <span>
                            {item.totalScore} • {item.rank}
                          </span>
                        </span>
                        {item.address && (
                          <span className="text-slate-500 truncate flex items-center gap-1">
                            <MapPin size={12} className="shrink-0" />
                            <span className="truncate">{item.address}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  // Chế độ Trang cá nhân của chính tài khoản đăng nhập (/profile)
  return (
    <div className="max-w-6xl mx-auto py-4 sm:py-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-emerald-800 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Quay lại</span>
        </button>

        {!isAccountAdmin && (
          <Link
            to={`/sellers/${profile.userId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 rounded-xl border border-emerald-200 transition-colors"
          >
            <ExternalLink size={14} />
            <span>Xem trang người bán công khai</span>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cột trái (5 cột): Hồ sơ định danh & chi tiết SDD 6.1 */}
        <section className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950" />

          <div className="px-6 pb-6">
            {/* Avatar chồng ranh giới dải màu; Tên & Badge nằm trọn trên nền trắng bên dưới */}
            <div className="relative z-10 -mt-10 w-20 h-20 rounded-2xl bg-emerald-600 text-white border-4 border-white shadow-md flex items-center justify-center text-3xl font-bold">
              {avatarInitial}
            </div>

            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className="text-xl font-bold text-emerald-950"
                  data-testid="profile-full-name"
                >
                  {profile.fullName}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    isAccountAdmin
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                >
                  <Shield size={12} />
                  <span>{roleBadgeLabel}</span>
                </span>
              </div>

              <div
                className="mt-2.5 inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-teal-900 bg-teal-50/80 border border-teal-200/80 px-3 py-1.5 rounded-xl"
                data-testid="profile-activity-role"
              >
                <Sparkles size={14} className="text-teal-700 shrink-0" />
                <span>{activityRoleText}</span>
              </div>
            </div>

            {/* Thông tin chi tiết cố định theo SDD 6.1 (không hiển thị mã userId) */}
            <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50/90 border border-slate-200/60">
                <Mail size={17} className="text-emerald-700 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Email đăng nhập
                  </div>
                  <div className="text-sm font-semibold text-slate-800 break-all mt-0.5">
                    {profile.email}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50/90 border border-slate-200/60">
                <Phone size={17} className="text-emerald-700 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Số điện thoại liên hệ
                  </div>
                  <div className="text-sm font-semibold text-slate-800 mt-0.5">
                    {profile.phone || 'Chưa cập nhật số điện thoại'}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50/90 border border-slate-200/60">
                <UserCheck size={17} className="text-emerald-700 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Quyền hạn tài khoản
                  </div>
                  <div className="text-sm font-semibold text-slate-800 mt-0.5">
                    {isAccountAdmin
                      ? 'Quản trị viên (Kiểm duyệt & Xử lý vi phạm)'
                      : 'Thành viên EcoFind (Mua & Đăng bán đồ cũ)'}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50/90 border border-slate-200/60">
                <ShieldCheck size={17} className="text-emerald-700 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Trạng thái bảo mật
                  </div>
                  <div className="text-sm font-semibold text-slate-800 mt-0.5">
                    {profile.isLocked
                      ? profile.lockedUntil
                        ? `Đang tạm khóa đến ${new Date(profile.lockedUntil).toLocaleString('vi-VN')}`
                        : 'Tài khoản đang tạm khóa'
                      : 'Hoạt động bình thường · Bảo vệ xác thực'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Cột phải (7 cột): Tabs Hoạt động/Thống kê, Chỉnh sửa thông tin & Đổi mật khẩu */}
        <section className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-7 space-y-6">
          <div
            role="tablist"
            aria-label="Tùy chọn trang cá nhân"
            className="flex flex-wrap gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/70"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              className={`flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-white text-emerald-950 shadow-xs'
                  : 'text-slate-600 hover:text-emerald-900'
              }`}
            >
              {isAccountAdmin ? <Shield size={15} /> : <Store size={15} />}
              <span>{isAccountAdmin ? 'Thống kê kiểm duyệt' : 'Hồ sơ giao dịch'}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'edit'}
              data-testid="tab-edit-profile"
              onClick={() => setActiveTab('edit')}
              className={`flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'edit'
                  ? 'bg-white text-emerald-950 shadow-xs'
                  : 'text-slate-600 hover:text-emerald-900'
              }`}
            >
              <Edit3 size={15} />
              <span>Cập nhật hồ sơ</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'security'}
              data-testid="tab-change-password"
              onClick={() => setActiveTab('security')}
              className={`flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-white text-emerald-950 shadow-xs'
                  : 'text-slate-600 hover:text-emerald-900'
              }`}
            >
              <KeyRound size={15} />
              <span>Đổi mật khẩu</span>
            </button>
          </div>

          {/* TAB 1A: THỐNG KÊ HỆ THỐNG DÀNH CHO ADMIN */}
          {activeTab === 'overview' && isAccountAdmin && (
            <div className="space-y-5" data-testid="admin-profile-overview">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-emerald-950">
                  Tổng quan điều phối & kiểm duyệt toàn hệ thống
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Số liệu thời gian thực phục vụ kiểm duyệt tin đăng và xử lý báo cáo vi phạm.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-amber-900">Tin chờ kiểm duyệt</div>
                    <div className="text-2xl font-bold text-amber-800 mt-1">
                      {profile.adminStats?.pendingListingsCount ?? 0}
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <ClipboardList size={22} />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-rose-900">Báo cáo vi phạm mới</div>
                    <div className="text-2xl font-bold text-rose-700 mt-1">
                      {profile.adminStats?.openReportsCount ?? 0}
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                    <Flag size={22} />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-emerald-900">Tin đang bán toàn sàn</div>
                    <div className="text-2xl font-bold text-emerald-800 mt-1">
                      {profile.adminStats?.activeSellingCount ?? 0}
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Package size={22} />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-700">Thành viên đã đăng ký</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                      {profile.adminStats?.totalMembersCount ?? 0}
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-slate-200/80 text-slate-700 flex items-center justify-center">
                    <Users size={22} />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  to="/admin"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold shadow-sm transition-colors"
                >
                  <Shield size={16} />
                  <span>Mở Bảng điều khiển Quản trị</span>
                </Link>
              </div>
            </div>
          )}

          {/* TAB 1B: HỒ SƠ UY TÍN & SẢN PHẨM NỔI BẬT DÀNH CHO USER */}
          {activeTab === 'overview' && !isAccountAdmin && (
            <div className="space-y-5" data-testid="user-profile-overview">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-emerald-950">
                  Lĩnh vực hoạt động & Tin nổi bật
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Tổng hợp tự động từ danh mục mặt hàng và điểm thẩm định chất lượng của bạn.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
                  <div className="text-xs font-medium text-emerald-900">Điểm chất lượng TB</div>
                  <div className="text-xl font-bold text-emerald-800 mt-1 flex items-center gap-1.5">
                    <Star size={18} className="text-amber-500" />
                    <span>
                      {profile.stats?.avgScore != null ? `${profile.stats.avgScore.toFixed(1)} / 10` : 'Chưa có'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <div className="text-xs font-medium text-slate-600">Giao dịch đã bán</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {profile.stats?.soldCount ?? 0} món
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <div className="text-xs font-medium text-slate-600">Danh mục chính</div>
                  <div className="text-sm font-bold text-slate-900 mt-1.5 truncate">
                    {profile.topCategories?.length > 0
                      ? profile.topCategories.map((c) => c.name).join(', ')
                      : 'Chưa phát sinh tin đăng'}
                  </div>
                </div>
              </div>

              {profile.topCategories && profile.topCategories.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {profile.topCategories.map((cat) => (
                    <span
                      key={cat.name}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700"
                    >
                      <Tag size={12} className="text-emerald-700" />
                      <span>
                        {cat.name}: {cat.count} tin
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {profile.featuredListings && profile.featuredListings.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">
                      Một số tin đang mở bán ({profile.featuredListings.length})
                    </h3>
                    <Link
                      to={`/sellers/${profile.userId}`}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                    >
                      Xem tất cả →
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {profile.featuredListings.map((item) => {
                      const isFree = Number(item.price) === 0;
                      return (
                        <Link
                          key={item.id}
                          to={`/listings/${item.id}`}
                          className="group flex items-center gap-3 p-3 rounded-2xl border border-slate-200/80 hover:border-emerald-300 hover:shadow-xs transition-all bg-white"
                        >
                          <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                            {item.thumbnailUrl ? (
                              <img
                                src={item.thumbnailUrl}
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <Package size={20} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-800 truncate group-hover:text-emerald-700">
                              {item.title}
                            </div>
                            <div
                              className={`text-sm font-bold mt-0.5 ${
                                isFree ? 'text-emerald-700' : 'text-orange-700'
                              }`}
                            >
                              {isFree
                                ? 'Cho tặng'
                                : `${Number(item.price).toLocaleString('vi-VN')} đ`}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {item.totalScore} điểm · {item.rank}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs sm:text-sm text-slate-600">
                  Bạn chưa đăng bán món đồ nào; hiện đang theo dõi{' '}
                  {profile.stats?.favoritesCount ?? 0} tin đã lưu trên bản đồ EcoFind.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CẬP NHẬT HỌ TÊN & SỐ ĐIỆN THOẠI */}
          {activeTab === 'edit' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-emerald-950">
                  Cập nhật thông tin tài khoản
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Email đăng nhập và quyền hệ thống được giữ cố định; bạn có thể cập nhật tên hiển
                  thị và số điện thoại liên hệ.
                </p>
              </div>

              {profileSuccess && (
                <div
                  role="status"
                  data-testid="profile-save-success"
                  className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center gap-2.5"
                >
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {profileError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tên hiển thị <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formState.fullName}
                    onChange={handleEditChange}
                    placeholder="Trần Minh Khôi"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Số điện thoại liên hệ
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formState.phone}
                    onChange={handleEditChange}
                    placeholder="0908 456 789"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  data-testid="save-profile-btn"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold shadow-sm disabled:opacity-60 cursor-pointer"
                >
                  {savingProfile ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  <span>{savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: ĐỔI MẬT KHẨU CHO MỌI TÀI KHOẢN */}
          {activeTab === 'security' && (
            <form onSubmit={handleSubmitPassword} className="space-y-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-emerald-950">
                  Đổi mật khẩu tài khoản
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Sử dụng mật khẩu tối thiểu 8 ký tự để bảo vệ tài khoản EcoFind của bạn.
                </p>
              </div>

              {pwdSuccess && (
                <div
                  role="status"
                  data-testid="password-save-success"
                  className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center gap-2.5"
                >
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  <span>{pwdSuccess}</span>
                </div>
              )}

              {pwdError && (
                <div
                  data-testid="password-save-error"
                  className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2"
                >
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{pwdError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mật khẩu hiện tại <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type={showPwd.current ? 'text' : 'password'}
                    name="currentPassword"
                    value={pwdState.currentPassword}
                    onChange={handlePwdChange}
                    placeholder="••••••••"
                    data-testid="input-current-password"
                    className="w-full pl-10 pr-11 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                  <button
                    type="button"
                    aria-label={showPwd.current ? 'Ẩn mật khẩu hiện tại' : 'Hiện mật khẩu hiện tại'}
                    onClick={() => setShowPwd((p) => ({ ...p, current: !p.current }))}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPwd.current ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Mật khẩu mới <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type={showPwd.next ? 'text' : 'password'}
                      name="newPassword"
                      value={pwdState.newPassword}
                      onChange={handlePwdChange}
                      placeholder="••••••••"
                      data-testid="input-new-password"
                      className="w-full pl-10 pr-11 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    />
                    <button
                      type="button"
                      aria-label={showPwd.next ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                      onClick={() => setShowPwd((p) => ({ ...p, next: !p.next }))}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPwd.next ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type={showPwd.confirm ? 'text' : 'password'}
                      name="confirmPassword"
                      value={pwdState.confirmPassword}
                      onChange={handlePwdChange}
                      placeholder="••••••••"
                      data-testid="input-confirm-password"
                      className="w-full pl-10 pr-11 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    />
                    <button
                      type="button"
                      aria-label={
                        showPwd.confirm ? 'Ẩn xác nhận mật khẩu' : 'Hiện xác nhận mật khẩu'
                      }
                      onClick={() => setShowPwd((p) => ({ ...p, confirm: !p.confirm }))}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPwd.confirm ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingPwd}
                  data-testid="save-password-btn"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold shadow-sm disabled:opacity-60 cursor-pointer"
                >
                  {savingPwd ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <KeyRound size={16} />
                  )}
                  <span>{savingPwd ? 'Đang cập nhật...' : 'Đổi mật khẩu'}</span>
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
