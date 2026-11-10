import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginApi } from '../api/auth';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Clock, ArrowRight, MapPin } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // URL ban đầu người dùng định truy cập (nếu bị ProtectedRoute redirect)
  const from = location.state?.from?.pathname || '/';

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [clientErrors, setClientErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errors = {};
    if (!formData.email.trim()) {
      errors.email = 'Vui lòng nhập địa chỉ email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Email không đúng định dạng';
    }

    if (!formData.password) {
      errors.password = 'Vui lòng nhập mật khẩu';
    } else if (formData.password.length < 8) {
      errors.password = 'Mật khẩu phải chứa ít nhất 8 ký tự';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Xóa lỗi trường tương ứng khi người dùng nhập lại
    if (clientErrors[name]) {
      setClientErrors((prev) => ({ ...prev, [name]: null }));
    }
    if (apiError) setApiError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setApiError(null);
    setIsLocked(false);

    try {
      const response = await loginApi(formData.email.trim(), formData.password);
      // Lưu JWT và thông tin người dùng
      login(response);
      // Quay về màn hình trước đó
      navigate(from, { replace: true });
    } catch (err) {
      if (err.status === 423 || err.code === 423) {
        setIsLocked(true);
        setApiError(err.message || 'Tài khoản tạm thời bị khóa 15 phút do nhập sai mật khẩu quá 5 lần.');
      } else if (err.status === 401 || err.code === 401) {
        setApiError(err.message || 'Email hoặc mật khẩu không đúng');
      } else if (err.fields) {
        setClientErrors(err.fields);
        setApiError(err.message || 'Dữ liệu nhập không hợp lệ');
      } else {
        setApiError(err.message || 'Đăng nhập không thành công. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] py-8 px-4 sm:px-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <MapPin size={28} className="stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Đăng nhập tài khoản</h1>
          <p className="text-sm text-slate-500 mt-1">
            Chào mừng bạn quay trở lại với Chợ đồ cũ EcoFind
          </p>
        </div>

        {/* Thông báo lỗi từ API (E1, E2, E4) */}
        {apiError && (
          <div
            className={`p-4 rounded-xl mb-6 text-sm flex items-start gap-3 border ${
              isLocked
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {isLocked ? (
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <span className="font-semibold block">
                {isLocked ? 'Tài khoản tạm khóa (423)' : 'Đăng nhập thất bại'}
              </span>
              <p className="mt-0.5 leading-relaxed">{apiError}</p>
            </div>
          </div>
        )}

        {/* Form đăng nhập 2 trường */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email đăng nhập <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail size={18} />
              </div>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="vidu@ecofind.vn"
                autoComplete="email"
                autoFocus
                className={`w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border rounded-xl focus:bg-white focus:outline-none transition-all ${
                  clientErrors.email
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-200'
                    : 'border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100'
                }`}
              />
            </div>
            {clientErrors.email && (
              <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                <AlertCircle size={12} /> {clientErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Mật khẩu <span className="text-rose-500">*</span>
              </label>
              <span className="text-xs text-slate-400">Tối thiểu 8 ký tự</span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                autoComplete="current-password"
                className={`w-full pl-10 pr-11 py-2.5 text-sm bg-slate-50 border rounded-xl focus:bg-white focus:outline-none transition-all ${
                  clientErrors.password
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-200'
                    : 'border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {clientErrors.password && (
              <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                <AlertCircle size={12} /> {clientErrors.password}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <>
                  <span>Đăng nhập</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer Links */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-center space-y-3">
          <p className="text-sm text-slate-600">
            Chưa có tài khoản?{' '}
            <Link
              to="/register"
              state={{ from: location.state?.from }}
              className="font-semibold text-emerald-600 hover:text-emerald-700 underline underline-offset-4"
            >
              Đăng ký ngay
            </Link>
          </p>
          <div>
            <Link
              to="/"
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              ← Tiếp tục xem bản đồ không cần đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

