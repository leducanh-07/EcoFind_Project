import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Package, CheckCircle2, Clock, MapPin, EyeOff, PlusCircle } from 'lucide-react';

export default function MyListingsPage() {
  const location = useLocation();
  const flashMessage = location.state?.flashMessage;
  const newListing = location.state?.newListing;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Banner thông báo thành công: Đã gửi, chờ duyệt (TE9C746, FR-09) */}
      {flashMessage && (
        <div
          role="status"
          data-testid="flash-success-banner"
          className="mb-6 p-5 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm flex items-start gap-4 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-emerald-900">{flashMessage}</h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                <Clock size={12} /> Chờ duyệt
              </span>
            </div>
            <p className="text-sm text-emerald-800 mt-1">
              Tin đăng của bạn đã được gửi thành công đến hệ thống và đang chờ quản trị viên phê duyệt.
            </p>
            <div className="mt-2.5 flex items-center gap-2 text-xs font-medium text-emerald-700 bg-white/70 px-3 py-1.5 rounded-lg border border-emerald-200/60 inline-flex">
              <EyeOff size={14} className="text-amber-600" />
              <span>
                <strong>Quy tắc FR-09:</strong> Tin chưa hiện trên bản đồ cho đến khi được duyệt.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tiêu đề trang */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-sm">
              <Package size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Quản lý tin của tôi</h1>
              <p className="text-xs text-slate-500">Xem và theo dõi trạng thái các tin bạn đã đăng (UC-06)</p>
            </div>
          </div>
          <Link
            to="/post"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <PlusCircle size={16} /> Đăng tin mới
          </Link>
        </div>

        {/* Danh sách tin đăng */}
        <div className="mt-6 space-y-4">
          {newListing && (
            <div
              data-testid="pending-listing-card"
              className="p-4 sm:p-5 rounded-2xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                    <Clock size={11} /> Chờ duyệt (Pending)
                  </span>
                  <span className="text-xs text-slate-500">Mã tin: #{newListing.id || 'Mới'}</span>
                </div>
                <h3 className="text-base font-bold text-slate-800">{newListing.title || 'Món đồ vừa đăng'}</h3>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  {newListing.price !== undefined && (
                    <span className="font-semibold text-emerald-700">
                      {Number(newListing.price) === 0
                        ? 'Cho tặng miễn phí'
                        : `${Number(newListing.price).toLocaleString('vi-VN')} đ`}
                    </span>
                  )}
                  {newListing.address && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {newListing.address}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-100/60 px-3 py-1.5 rounded-xl border border-amber-200">
                <EyeOff size={13} />
                <span>Chưa hiện trên bản đồ (FR-09)</span>
              </div>
            </div>
          )}

          {!newListing && !flashMessage && (
            <div className="py-12 text-center text-slate-500 space-y-3">
              <Package size={40} className="mx-auto text-slate-300" />
              <p className="text-sm font-medium">Bạn chưa có tin đăng nào đang hiển thị.</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Hãy bấm "Đăng tin mới" để chia sẻ những món đồ cũ hữu ích tới mọi người xung quanh!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


