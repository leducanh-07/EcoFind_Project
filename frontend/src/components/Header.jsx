import React, { useState } from 'react';
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
} from 'lucide-react';

export default function Header() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/');
  };

  const navItemClass = ({ isActive }) =>
    `inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl transition-all ${
      isActive
        ? 'bg-teal-50 text-teal-800 font-semibold shadow-xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
    }`;

  const mobileNavItemClass = ({ isActive }) =>
    `flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-xl transition-all ${
      isActive
        ? 'bg-teal-50 text-teal-800 font-semibold'
        : 'text-slate-700 hover:bg-slate-100'
    }`;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo Brand */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform duration-200">
              <Compass size={22} className="stroke-[2.2]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight text-slate-900 leading-none flex items-center gap-1">
                EcoFind
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
              </span>
              <span className="text-[10px] font-semibold text-teal-700 tracking-wider uppercase mt-0.5">
                Chợ đồ cũ thông minh
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1.5">
            <NavLink to="/" end className={navItemClass}>
              <MapPin size={16} />
              Bản đồ
            </NavLink>
            <NavLink to="/my-listings" className={navItemClass}>
              <Package size={16} />
              Tin của tôi
            </NavLink>
            <NavLink to="/favorites" className={navItemClass}>
              <Heart size={16} />
              Yêu thích
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={navItemClass}>
                <Shield size={16} className="text-amber-600" />
                <span className="text-amber-700 font-semibold">Quản trị</span>
              </NavLink>
            )}
          </nav>

          {/* Desktop Right Auth Section */}
          <div className="hidden md:flex items-center gap-3">
            {/* Primary Action Button: Đăng tin */}
            <Link
              to="/post"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 shadow-xs hover:shadow transition-all"
            >
              <PlusCircle size={16} />
              Đăng tin
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
                <div className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs ring-2 ring-teal-200/60">
                    {user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold text-slate-800 leading-tight max-w-[120px] truncate">
                      {user?.fullName || user?.email}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {user?.role === 'admin' ? (
                        <span className="text-amber-600 font-bold">Admin</span>
                      ) : (
                        'Thành viên'
                      )}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                  title="Đăng xuất khỏi hệ thống"
                >
                  <LogOut size={14} />
                  <span className="hidden lg:inline">Đăng xuất</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-teal-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <LogIn size={15} />
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-teal-700 border border-slate-200 hover:border-teal-300 rounded-xl transition-all"
                >
                  <UserPlus size={15} />
                  Đăng ký
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              to="/post"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl text-white bg-teal-600 hover:bg-teal-700"
            >
              <PlusCircle size={14} />
              Đăng tin
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 animate-in slide-in-from-top duration-200 shadow-md">
          <nav className="space-y-1">
            <NavLink
              to="/"
              end
              onClick={() => setMobileMenuOpen(false)}
              className={mobileNavItemClass}
            >
              <MapPin size={18} className="text-teal-600" />
              Bản đồ khám phá
            </NavLink>
            <NavLink
              to="/post"
              onClick={() => setMobileMenuOpen(false)}
              className={mobileNavItemClass}
            >
              <PlusCircle size={18} className="text-teal-600" />
              Đăng tin bán đồ
            </NavLink>
            <NavLink
              to="/my-listings"
              onClick={() => setMobileMenuOpen(false)}
              className={mobileNavItemClass}
            >
              <Package size={18} className="text-teal-600" />
              Quản lý tin của tôi
            </NavLink>
            <NavLink
              to="/favorites"
              onClick={() => setMobileMenuOpen(false)}
              className={mobileNavItemClass}
            >
              <Heart size={18} className="text-teal-600" />
              Tin đã lưu yêu thích
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
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
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
    </header>
  );
}
