import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Tag } from 'lucide-react';

export default function ListingDetailPage() {
  const { id } = useParams();

  return (
    <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-emerald-700 mb-6">
        <ArrowLeft size={16} /> Quay lại danh sách
      </Link>
      <div className="flex items-center gap-3 mb-4">
        <Tag className="text-emerald-600" />
        <h1 className="text-2xl font-bold text-slate-900">Chi tiết tin đăng #{id}</h1>
      </div>
      <p className="text-sm text-slate-600">
        Nội dung chi tiết món đồ, bộ sưu tập ảnh và điểm tình trạng sẽ được hoàn thiện trong Task 20.
      </p>
    </div>
  );
}

