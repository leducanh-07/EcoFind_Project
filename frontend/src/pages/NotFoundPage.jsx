import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center mb-4">
        <HelpCircle size={32} />
      </div>
      <h1 className="text-3xl font-extrabold text-slate-800 mb-2">404 - Không tìm thấy trang</h1>
      <p className="text-slate-500 text-sm max-w-sm mb-6">
        Đường dẫn bạn yêu cầu không tồn tại hoặc đã được chuyển sang địa chỉ khác.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors shadow-sm"
      >
        <ArrowLeft size={18} /> Quay về Trang chủ
      </Link>
    </div>
  );
}

