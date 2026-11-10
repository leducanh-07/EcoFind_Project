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
    `inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
      isActive
        ? 'bg-emerald-50 text-emerald-700 font-semibold'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
    }`;

  const mobileNavItemClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 text-base font-medium rounded-xl transition-colors ${
      isActive
        ? 'bg-emerald-50 text-emerald-700 font-semibold'
        : 'text-slate-700 hover:bg-slate-100'
    }`;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo Brand */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
              <MapPin size={22} className="stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-slate-900 leading-none flex items-center gap-1">
                EcoFind
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-medium text-emerald-600 tracking-wider uppercase">
                Chợ đồ cũ thông minh
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/" end className={navItemClass}>
              <MapPin size={16} />
              Bản đồ
            </NavLink>
            <NavLink to="/post" className={navItemClass}>
              <PlusCircle size={16} />
              Đăng tin
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
                <span className="text-amber-700">Quản trị</span>
              </NavLink>
            )}
          </nav>

          {/* Desktop Right Auth Section */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 pl-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold text-sm">
                    {user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-medium text-slate-900 leading-tight">
                      {user?.fullName || user?.email}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {user?.role === 'admin' ? (
                        <span className="text-amber-600 font-semibold">Admin</span>
                      ) : (
                        'Thành viên'
                      )}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200"
                  title="Đăng xuất khỏi hệ thống"
                >
                  <LogOut size={14} />
                  Đăng xuất
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-emerald-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <LogIn size={16} />
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm hover:shadow"
                >
                  <UserPlus size={16} />
                  Đăng ký
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 animate-in slide-in-from-top duration-200">
          <nav className="space-y-1">
            <NavLink
              to="/"
              end
              onClick={() => setMobileMenuOpen(false)}
              className={mobileNavItemClass}
            >
              <MapPin size={20} className="text-emerald-600" />
              Bản đồ khám phá
            </NavLink>
            <NavLink
              to="/post"
              onClick={() => setMobileMenuOpen(false)}
              className={mobileNavItemClass}
            >
              <PlusCircle size={20} className="text-emerald-600" />
              Đăng tin bán đồ
            </NavLink>
            <NavLink
              to="/my-listings"
              onClick={() => setMobileMenuOpen(false)}
              className={mobileNavItemClass}
            >
              <Package size={20} className="text-emerald-600" />
              Quản lý tin của tôi
            </NavLink>
            <NavLink
              to="/favorites"
              onClick={() => setMobileMenuOpen(false)}
              className={mobileNavItemClass}
            >
              <Heart size={20} className="text-emerald-600" />
              Tin đã lưu yêu thích
            </NavLink>
            {isAdmin && (
              <NavLink
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className={mobileNavItemClass}
              >
                <Shield size={20} className="text-amber-600" />
                Kiểm duyệt Admin
              </NavLink>
            )}
          </nav>

          <div className="pt-3 border-t border-slate-100">
            {isAuthenticated ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                    {user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">
                      {user?.fullName || 'Người dùng EcoFind'}
                    </div>
                    <div className="text-xs text-slate-500">{user?.email}</div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
                >
                  <LogOut size={16} />
                  Đăng xuất tài khoản
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  <LogIn size={16} />
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm"
                >
                  <UserPlus size={16} />
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

