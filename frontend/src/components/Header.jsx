import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  Sparkles,
} from 'lucide-react';

export default function Header() {
  const { user, isAuthenticated, isAdmin, logout, clearSessionExpired } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutToast, setLogoutToast] = useState(null);
  const dropdownRef = useRef(null);

  // Đóng modal khi bấm ESC và click ngoài để đóng dropdown
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showLogoutModal && !isLoggingOut) setShowLogoutModal(false);
        if (userDropdownOpen) setUserDropdownOpen(false);
      }
    };

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLogoutModal, isLoggingOut, userDropdownOpen]);

  const handleOpenLogoutModal = () => {
    setShowLogoutModal(true);
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 450));

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

  const mobileNavItemClass = ({ isActive }) =>
    `flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-150 active:scale-95 ${
      isActive
        ? 'bg-emerald-50 text-emerald-800 font-bold ring-1 ring-emerald-200/60'
        : 'text-slate-700 hover:bg-slate-100'
    }`;

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 text-white border-b border-emerald-800/80 shadow-md">
      <div className="max-w-[1600px] 2xl:max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex items-center justify-between min-h-[76px] sm:min-h-[84px] py-2 gap-2 sm:gap-4">
          {/* Logo Brand */}
          <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group select-none shrink-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-xs flex items-center justify-center text-emerald-300 shadow-md group-hover:scale-105 active:scale-95 transition-all duration-200">
              <Compass size={24} className="stroke-[2.3]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-bold tracking-normal text-white leading-none flex items-center gap-1.5">
                EcoFind
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-200/90 tracking-wider uppercase mt-1">
                Chợ đồ cũ TP.HCM
              </span>
            </div>
          </Link>

          {/* Vị trí Trung tâm Header: Slot gắn Thanh Tìm Kiếm Pill Mở rộng (Chuẩn Airbnb / Shopee) */}
          <div
            id="header-search-slot"
            className="hidden md:flex flex-1 max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-3 sm:mx-6 items-center justify-center transition-all"
          >
            {/* Thanh SearchAndFilterBar sẽ tự động portal vào đây trên desktop khi ở Trang chủ */}
          </div>

          {/* Cụm hành động bên phải: Đăng tin (hoặc Quản trị cho Admin) + Menu Người dùng Profile */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {isAdmin ? (
              <Link
                to="/admin"
                className="h-10 px-4.5 inline-flex items-center gap-2 rounded-xl text-amber-950 bg-amber-100 hover:bg-amber-200 font-bold text-sm shadow-sm hover:shadow-md border border-amber-300/80 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                <Shield size={17} className="text-amber-700" />
                <span>Quản trị</span>
              </Link>
            ) : (
              <Link
                to="/post"
                className="h-10 px-4.5 inline-flex items-center gap-2 rounded-xl text-emerald-900 bg-white hover:bg-emerald-50 active:bg-emerald-100 font-bold text-sm shadow-sm hover:shadow-md border border-white/80 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                <PlusCircle size={18} className="text-emerald-700" />
                <span>Đăng tin</span>
              </Link>
            )}

            {isAuthenticated ? (
              <div className="flex items-center gap-2 pl-2 relative" ref={dropdownRef}>
                {/* Profile Trigger: Glass Pill on Dark Green Header */}
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="h-10 px-3 bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/20 rounded-xl flex items-center gap-2.5 transition-all shadow-2xs backdrop-blur-sm cursor-pointer select-none"
                  aria-expanded={userDropdownOpen}
                >
                  <div className="relative shrink-0">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500 text-emerald-950 flex items-center justify-center font-bold text-xs shadow-2xs">
                      {user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-900"></span>
                  </div>
                  <div className="flex flex-col text-left">
                    <span
                      className="text-xs font-bold text-white leading-tight max-w-[120px] 2xl:max-w-[150px] truncate"
                      title={user?.fullName || user?.email}
                    >
                      {user?.fullName || user?.email}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-200/90 flex items-center gap-1">
                      {user?.role === 'admin' ? (
                        <span className="text-amber-300 bg-amber-950/60 border border-amber-500/30 px-1 py-0.2 rounded font-bold">Admin</span>
                      ) : (
                        'Thành viên'
                      )}
                    </span>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`text-emerald-300 transition-transform duration-200 ${
                      userDropdownOpen ? 'rotate-180 text-white' : ''
                    }`}
                  />
                </button>

                {/* Profile Dropdown Menu: Chứa toàn bộ các mục cá nhân + Đăng xuất */}
                <div
                  className={`absolute right-0 top-12 mt-1 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 transition-all duration-150 ${
                    userDropdownOpen
                      ? 'opacity-100 translate-y-0 pointer-events-auto'
                      : 'opacity-0 -translate-y-2 pointer-events-none'
                  }`}
                >
                  <div className="p-3 border-b border-slate-100 mb-1">
                    <div className="font-bold text-slate-800 text-sm truncate" title={user?.fullName || user?.email}>
                      {user?.fullName || 'Người dùng EcoFind'}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{user?.email}</div>
                    <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                      {user?.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
                    </div>
                  </div>

                  <div className="space-y-0.5 py-1">
                    <Link
                      to="/profile"
                      onClick={() => setUserDropdownOpen(false)}
                      className="group flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50/70 hover:text-emerald-950 rounded-xl transition-colors"
                    >
                      <User size={15} className="text-slate-400 group-hover:text-emerald-700 transition-colors" />
                      <span>Trang cá nhân</span>
                    </Link>
                    <Link
                      to="/"
                      onClick={() => setUserDropdownOpen(false)}
                      className="group flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50/70 hover:text-emerald-950 rounded-xl transition-colors"
                    >
                      <MapPin size={15} className="text-slate-400 group-hover:text-emerald-700 transition-colors" />
                      <span>Bản đồ</span>
                    </Link>
                    {!isAdmin && (
                      <>
                        <Link
                          to="/my-listings"
                          onClick={() => setUserDropdownOpen(false)}
                          className="group flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50/70 hover:text-emerald-950 rounded-xl transition-colors"
                        >
                          <Package size={15} className="text-slate-400 group-hover:text-emerald-700 transition-colors" />
                          <span>Tin của tôi</span>
                        </Link>
                        <Link
                          to="/favorites"
                          onClick={() => setUserDropdownOpen(false)}
                          className="group flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50/70 hover:text-emerald-950 rounded-xl transition-colors"
                        >
                          <Heart size={15} className="text-slate-400 group-hover:text-emerald-700 transition-colors" />
                          <span>Yêu thích</span>
                        </Link>
                      </>
                    )}
                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setUserDropdownOpen(false)}
                        className="group flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-950 rounded-xl transition-colors"
                      >
                        <Shield size={15} className="text-amber-600 transition-colors" />
                        <span>Quản trị</span>
                      </Link>
                    )}
                  </div>

                  <div className="pt-2 mt-1.5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleOpenLogoutModal}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50/90 hover:bg-rose-100 border border-rose-200/80 shadow-2xs transition-all active:scale-98 cursor-pointer group"
                      aria-label="Đăng xuất"
                    >
                      <div className="flex items-center gap-2">
                        <LogOut size={15} className="text-rose-600 group-hover:translate-x-0.5 transition-transform" />
                        <span>Đăng xuất tài khoản</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-3 border-l border-white/20">
                <Link
                  to="/login"
                  onClick={() => clearSessionExpired?.()}
                  className="h-10 px-3.5 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-100 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                >
                  <LogIn size={15} />
                  <span>Đăng nhập</span>
                </Link>
                <Link
                  to="/register"
                  className="h-10 px-3.5 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-950 bg-white hover:bg-emerald-50 rounded-xl transition-all shadow-sm"
                >
                  <UserPlus size={15} className="text-emerald-700" />
                  <span>Đăng ký</span>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            {isAdmin ? (
              <Link
                to="/admin"
                className="p-2 text-amber-950 bg-amber-100 hover:bg-amber-200 rounded-xl active:scale-95 transition-all shadow-sm"
                title="Quản trị"
              >
                <Shield size={22} className="text-amber-700" />
              </Link>
            ) : (
              <Link
                to="/post"
                className="p-2 text-emerald-950 bg-white hover:bg-emerald-50 rounded-xl active:scale-95 transition-all shadow-sm"
                title="Đăng tin"
              >
                <PlusCircle size={22} className="text-emerald-700" />
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-white hover:bg-white/10 rounded-xl active:scale-95 transition-all"
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
              <MapPin size={18} className="text-emerald-600" />
              Bản đồ khám phá
            </NavLink>
            {!isAdmin && (
              <>
                <NavLink
                  to="/post"
                  onClick={() => setMobileMenuOpen(false)}
                  className={mobileNavItemClass}
                >
                  <PlusCircle size={18} className="text-emerald-600" />
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
              </>
            )}
            {isAuthenticated && (
              <NavLink
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className={mobileNavItemClass}
              >
                <User size={18} />
                Trang cá nhân
              </NavLink>
            )}
            {isAdmin && (
              <NavLink
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className={mobileNavItemClass}
              >
                <Shield size={18} className="text-amber-600" />
                Quản trị
              </NavLink>
            )}
          </nav>

          <div className="pt-3 border-t border-slate-100">
            {isAuthenticated ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl">
                  <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
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
                  onClick={() => {
                    clearSessionExpired?.();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  <LogIn size={15} />
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
                >
                  <UserPlus size={15} />
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN ĐĂNG XUẤT */}
      {showLogoutModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
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

            <h3 id="logout-modal-title" className="text-lg sm:text-xl font-bold text-slate-800 mb-2">
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

      {/* TOAST THÔNG BÁO ĐĂNG XUẤT THÀNH CÔNG */}
      {logoutToast && typeof document !== 'undefined' && createPortal(
        <div
          role="status"
          data-testid="logout-toast"
          className="fixed top-6 right-6 z-[9999] bg-emerald-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold animate-in slide-in-from-top-3 duration-300 border border-emerald-700"
        >
          <CheckCircle2 size={18} className="text-emerald-300 shrink-0" />
          <span>{logoutToast}</span>
        </div>,
        document.body
      )}
    </header>
  );
}
