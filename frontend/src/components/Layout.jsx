import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 w-full overflow-x-hidden">
      {/* Top Header */}
      <Header />

      {/* Main Content (Spacious container up to 1720px on desktop, responsive full-width on mobile) */}
      <main className="flex-1 w-full max-w-[1600px] 2xl:max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-3 sm:py-5 pb-20 md:pb-8">
        <div key={location.pathname} className="animate-page-enter">
          <Outlet />
        </div>
      </main>

      {/* Desktop Footer — giữ nguyên bố cục gọn 2 dòng, đồng bộ tông xanh với Header */}
      <footer className="hidden md:block bg-gradient-to-r from-emerald-950 via-teal-950 to-emerald-900 border-t border-emerald-800/80 py-6 text-center text-xs text-emerald-100">
        <div className="max-w-[1600px] 2xl:max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
          <p>© 2026 EcoFind — Nền tảng Chợ đồ cũ thông minh tích hợp bản đồ & đánh giá tình trạng.</p>
          <p className="mt-1 text-emerald-200/80">Định vị khoảng cách thực tế • Thẩm định chất lượng minh bạch</p>
        </div>
      </footer>

      {/* Mobile Bottom Navigation (One-hand use, 360-430px touch target >= 44px) */}
      <BottomNav />
    </div>
  );
}

