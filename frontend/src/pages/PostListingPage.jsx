import React from 'react';
import { PlusCircle } from 'lucide-react';

export default function PostListingPage() {
  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <PlusCircle size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Đăng tin bán đồ cũ</h1>
          <p className="text-xs text-slate-500">Màn hình yêu cầu đăng nhập (UC-05, Sprint 4)</p>
        </div>
      </div>
      <p className="text-sm text-slate-600">
        Bạn đã đăng nhập thành công và truy cập đúng quyền vào trang Đăng tin!
      </p>
    </div>
  );
}

