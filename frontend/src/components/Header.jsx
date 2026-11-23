import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  MapPin,
  PlusCircle,
  Package,
  Heart,
  Shield,
  LogOut,
  User,
  LogIn,
  UserPlus,
  Menu,
  X,
  Compass,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export default function Header() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutToast, setLogoutToast] = useState(null);

  // Đóng modal khi bấm ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showLogoutModal && !isLoggingOut) {
        setShowLogoutModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLogoutModal, isLoggingOut]);

  const handleOpenLogoutModal = () => {
    setShowLogoutModal(true);
    setMobileMenuOpen(false);
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Hiệu ứng loading 450ms tạo độ chuyển cảnh mượt mà
      await new Promise((resolve) => setTimeout(resolve, 450));

      // Dọn sạch token, user, dữ liệu offline và cookie
      logout();
      try {
        localStorage.removeItem('ecofind_saved_listings');
        document.cookie.split(';').forEach((c) => {
          document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
        });
      } catch {
        // Bỏ qua lỗi storage quota
      }

      setShowLogoutModal(false);
      navigate('/');

      setLogoutToast('Đã đăng xuất thành công');
      setTimeout(() => {
        setLogoutToast(null);
      }, 3000);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const navItemClass = ({ isActive }) =>
    `inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl transition-all duration-150 active:scale-95 ${isActive
      ? 'bg-teal-50 text-teal-800 font-bold shadow-xs'
      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
    }`;

  const mobileNavItemClass = ({ isActive }) =>
    `flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-150 active:scale-95 ${isActive
      ? 'bg-teal-50 text-teal-800 font-bold'
      : 'text-slate-700 hover:bg-slate-100'
    }`;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-[1600px] 2xl:max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Logo Brand */}
          <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white shadow-xs group-hover:scale-105 active:scale-95 transition-all duration-200">
              <Compass size={24} className="stroke-[2.2]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-none flex items-center gap-1.5">
                EcoFind
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold text-teal-700 tracking-wider uppercase mt-1">
                Chợ đồ cũ thông minh
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            <NavLink to="/" end className={navItemClass}>
              <MapPin size={18} />
              <span>Bản đồ</span>
            </NavLink>
            <NavLink to="/my-listings" className={navItemClass}>
              <Package size={18} />
              <span>Tin của tôi</span>
            </NavLink>
            <NavLink to="/favorites" className={navItemClass}>
              <Heart size={18} />
              <span>Yêu thích</span>
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={navItemClass}>
                <Shield size={18} className="text-amber-600" />
                <span className="text-amber-700 font-bold">Quản trị</span>
              </NavLink>
            )}
          </nav>

          {/* Desktop Right Auth Section */}
          <div className="hidden md:flex items-center gap-3">
            {/* Primary Action Button: Đăng tin */}
            <Link
              to="/post"
              className="h-10 px-4 inline-flex items-center gap-2 rounded-xl text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 font-bold text-sm shadow-xs hover:shadow-md active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <PlusCircle size={18} />
              <span>Đăng tin</span>
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                {/* Thẻ thông tin tài khoản: Chiều cao h-10, bo góc rounded-xl đồng bộ */}
                <div className="h-10 px-3 bg-slate-50/90 hover:bg-slate-100/80 border border-slate-200/80 rounded-xl flex items-center gap-2.5 transition-colors shadow-2xs">
                  <div className="relative shrink-0">
                    <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                      {user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                  </div>
                  <div className="flex flex-col text-left">
                    <span
                      className="text-xs font-bold text-slate-800 leading-tight max-w-[120px] 2xl:max-w-[150px] truncate"
                      title={user?.fullName || user?.email}
                    >
                      {user?.fullName || user?.email}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                      {user?.role === 'admin' ? (
                        <span className="text-amber-700 bg-amber-50 px-1 py-0.2 rounded font-bold">Admin</span>
                      ) : (
                        'Thành viên'
                      )}
                    </span>
                  </div>
                </div>

                {/* Nút Đăng xuất: Thiết kế đồng bộ h-10, chữ rõ ràng, phân cấp thứ cấp tinh tế */}
                <button
                  type="button"
                  onClick={handleOpenLogoutModal}
                  className="h-10 px-3.5 inline-flex items-center gap-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100/90 active:bg-rose-200/80 border border-rose-200/80 hover:border-rose-300 shadow-2xs transition-all duration-150 active:scale-95 cursor-pointer"
                  title="Đăng xuất khỏi hệ thống"
                >
                  <LogOut size={15} className="text-rose-600 shrink-0" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                <Link
                  to="/login"
                  className="h-10 px-3.5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-teal-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <LogIn size={15} />
                  <span>Đăng nhập</span>
                </Link>
                <Link
                  to="/register"
                  className="h-10 px-3.5 inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 hover:text-teal-700 border border-slate-200 hover:border-teal-300 rounded-xl transition-all shadow-2xs"
                >
                  <UserPlus size={15} />
                  <span>Đăng ký</span>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              to="/post"
              className="p-2 text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl active:scale-95 transition-all"
              title="Đăng tin"
            >
              <PlusCircle size={22} />
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-700 hover:bg-slate-100 rounded-xl active:scale-95 transition-all"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3 shadow-lg animate-in slide-in-from-top-2 duration-150">
          <nav className="flex flex-col gap-1.5">
            <NavLink
              to="/"
              end
              onClick={() => setMobileMenuOpen(false)}
              className={mobileNavItemClass}
            >
              <MapPin size={18} />
              Bản đồ khám phá
            </NavLink>
            <NavLink
              to="/post"
              onClick={() => setMobileMenuOpen(false)}
              className={mobileNavItemClass}
            >
              <PlusCircle size={18} />
              Đăng tin bán đồ
            </NavLink>
            <NavLink
              to="/my-listings"
              onClick={() => setMobileMenuOpen(false)}
              className={mobileNavItemClass}
            >
              <Package size={18} />
              Tin của tôi
            </NavLink>
            <NavLink
              to="/favorites"
              onClick={() => setMobileMenuOpen(false)}
              className={mobileNavItemClass}
            >
              <Heart size={18} />
              Yêu thích
            </NavLink>
            {isAdmin && (
              <NavLink
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className={mobileNavItemClass}
              >
                <Shield size={18} className="text-amber-600" />
                Kiểm duyệt Admin
              </NavLink>
            )}
          </nav>

          <div className="pt-3 border-t border-slate-100">
            {isAuthenticated ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl">
                  <div className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm">
                    {user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">
                      {user?.fullName || 'Người dùng EcoFind'}
                    </div>
                    <div className="text-xs text-slate-500">{user?.email}</div>
                  </div>
                </div>
                <button
                  onClick={handleOpenLogoutModal}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all active:scale-95 cursor-pointer"
                >
                  <LogOut size={15} />
                  Đăng xuất tài khoản
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  <LogIn size={15} />
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs"
                >
                  <UserPlus size={15} />
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN ĐĂNG XUẤT (Sử dụng createPortal gắn vào document.body để thoát khỏi backdrop-filter của header) */}
      {showLogoutModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => !isLoggingOut && setShowLogoutModal(false)}
        >
          <div
            className="w-full max-w-sm sm:max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-modal-title"
          >
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-2xs">
              <LogOut size={26} className="translate-x-0.5" />
            </div>

            <h3 id="logout-modal-title" className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
              Xác nhận đăng xuất
            </h3>

            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-6 max-w-xs mx-auto">
              Bạn có chắc chắn muốn đăng xuất không? Thông tin tra cứu hiện tại sẽ được đặt lại về mặc định.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
                className="flex-1 h-11 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-bold text-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                Hủy
              </button>

              <button
                type="button"
                data-testid="confirm-logout-btn"
                onClick={handleConfirmLogout}
                disabled={isLoggingOut}
                className="flex-1 h-11 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-sm shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <span>Đăng xuất</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* TOAST THÔNG BÁO ĐĂNG XUẤT THÀNH CÔNG (Portal vào document.body) */}
      {logoutToast && typeof document !== 'undefined' && createPortal(
        <div
          role="status"
          data-testid="logout-toast"
          className="fixed top-6 right-6 z-[9999] bg-teal-800/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold animate-in slide-in-from-top-3 duration-300 border border-teal-700"
        >
          <CheckCircle2 size={18} className="text-teal-300 shrink-0" />
          <span>{logoutToast}</span>
        </div>,
        document.body
      )}
    </header>
  );
}
