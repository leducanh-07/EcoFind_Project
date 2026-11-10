import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Search, PlusCircle, Sparkles } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-6">
      {/* Hero / Quick Search Bar Placeholder */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 rounded-3xl p-6 sm:p-10 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-100 text-xs font-semibold backdrop-blur-sm border border-emerald-400/20">
            <Sparkles size={14} /> Chợ đồ cũ thông minh tích hợp bản đồ & điểm tình trạng
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Tìm đồ cũ chất lượng quanh bạn
          </h1>
          <p className="text-emerald-100/90 text-sm sm:text-base leading-relaxed">
            Xem vị trí thực trên bản đồ, điểm tình trạng minh bạch từ 0 đến 10, phân loại theo hạng Như mới, Tốt, Khá.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              to="/post"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-emerald-800 font-semibold hover:bg-emerald-50 transition-all shadow-md text-sm"
            >
              <PlusCircle size={18} /> Đăng tin bán đồ
            </Link>
          </div>
        </div>
      </div>

      {/* Map Placeholder Frame */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center min-h-[420px] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
          <MapPin size={32} />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Bản đồ đồ cũ quanh bạn</h3>
        <p className="text-slate-500 max-w-md text-sm mb-6">
          Khu vực bản đồ tương tác OpenStreetMap & Leaflet sẽ sẵn sàng ở Sprint 2 (Task 16).
        </p>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-700 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200">
          <span>● Trung tâm TP. Hồ Chí Minh • Bán kính 1–20 km</span>
        </div>
      </div>
    </div>
  );
}

