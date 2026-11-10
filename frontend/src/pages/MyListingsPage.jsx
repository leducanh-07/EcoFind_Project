import React from 'react';
import { Package } from 'lucide-react';

export default function MyListingsPage() {
  return (
    <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <Package size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Quản lý tin của tôi</h1>
          <p className="text-xs text-slate-500">Màn hình yêu cầu đăng nhập (UC-06, Sprint 5)</p>
        </div>
      </div>
      <p className="text-sm text-slate-600">
        Bạn đã đăng nhập thành công và có thể quản lý các tin đăng của mình tại đây.
      </p>
    </div>
  );
}

