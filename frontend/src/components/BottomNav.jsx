import React from 'react';
import { NavLink } from 'react-router-dom';
import { MapPin, PlusCircle, Package, Heart, Shield, User, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function BottomNav() {
  const { isAuthenticated, isAdmin } = useAuth();

  const navLinkClass = ({ isActive }) =>
    `flex flex-col items-center justify-center flex-1 min-h-[44px] min-w-[44px] py-1 px-1 transition-colors select-none ${
      isActive
        ? 'text-emerald-600 font-semibold'
        : 'text-slate-500 hover:text-slate-900'
    }`;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 shadow-lg"
      aria-label="Mobile Bottom Navigation"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* 1. Map (Home) */}
        <NavLink to="/" end className={navLinkClass}>
          <MapPin size={20} className="mb-0.5" />
          <span className="text-[11px] leading-tight">Bản đồ</span>
        </NavLink>

        {/* 2. Post Listing */}
        <NavLink to="/post" className={navLinkClass}>
          <PlusCircle size={20} className="mb-0.5 text-emerald-600" />
          <span className="text-[11px] leading-tight">Đăng tin</span>
        </NavLink>

        {/* 3. My Listings */}
        <NavLink to="/my-listings" className={navLinkClass}>
          <Package size={20} className="mb-0.5" />
          <span className="text-[11px] leading-tight">Tin của tôi</span>
        </NavLink>

        {/* 4. Favorites */}
        <NavLink to="/favorites" className={navLinkClass}>
          <Heart size={20} className="mb-0.5" />
          <span className="text-[11px] leading-tight">Yêu thích</span>
        </NavLink>

        {/* 5. Admin or Profile / Login */}
        {isAdmin ? (
          <NavLink to="/admin" className={navLinkClass}>
            <Shield size={20} className="mb-0.5 text-amber-600" />
            <span className="text-[11px] leading-tight text-amber-700 font-semibold">Admin</span>
          </NavLink>
        ) : isAuthenticated ? (
          <NavLink to="/my-listings" className={navLinkClass}>
            <User size={20} className="mb-0.5" />
            <span className="text-[11px] leading-tight">Tài khoản</span>
          </NavLink>
        ) : (
          <NavLink to="/login" className={navLinkClass}>
            <LogIn size={20} className="mb-0.5" />
            <span className="text-[11px] leading-tight">Đăng nhập</span>
          </NavLink>
        )}
      </div>
    </nav>
  );
}
