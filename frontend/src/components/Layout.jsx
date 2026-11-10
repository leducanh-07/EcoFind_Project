import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 w-full overflow-x-hidden">
      {/* Top Header */}
      <Header />

      {/* Main Content (Container max-width 7xl on desktop, full-width responsive on mobile 360-430px) */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20 md:pb-8">
        <Outlet />
      </main>

      {/* Desktop Footer */}
      <footer className="hidden md:block bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 EcoFind — Nền tảng Chợ đồ cũ tích hợp bản đồ & đánh giá tình trạng.</p>
          <p className="mt-1 text-slate-400">Kiến trúc chuẩn IEEE SRS/SDD • Tối ưu trải nghiệm 360px – 1920px</p>
        </div>
      </footer>

      {/* Mobile Bottom Navigation (One-hand use, 360-430px touch target >= 44px) */}
      <BottomNav />
    </div>
  );
}

