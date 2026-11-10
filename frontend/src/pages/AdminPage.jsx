import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Bảng điều khiển Quản trị viên (Admin)</h1>
          <p className="text-xs text-slate-500">Khu vực kiểm duyệt tin & xử lý báo cáo (UC-09, Sprint 5)</p>
        </div>
      </div>
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm">
        Xin chào <strong>{user?.fullName || user?.email}</strong>. Bạn đang truy cập với quyền hạn Quản trị viên (Role: <code>{user?.role}</code>).
      </div>
    </div>
  );
}

