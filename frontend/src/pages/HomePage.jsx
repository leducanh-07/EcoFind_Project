import React from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Sparkles, Compass } from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import MapView from '../components/MapView';

export default function HomePage() {
  const {
    coords,
    loading: loadingLocation,
    error: locationError,
    isFallback,
    requestLocation,
    clearError,
  } = useGeolocation();

  return (
    <div className="space-y-4">
      {/* Top Banner / Hero Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 rounded-2xl px-5 py-3.5 text-white shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-emerald-200">
            <Compass size={18} />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight">
              Bản đồ đồ cũ quanh bạn
            </h1>
            <p className="text-[11px] text-emerald-100/80">
              Khám phá món đồ cũ chất lượng theo vị trí GPS thực tế & điểm tình trạng (0–10)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/post"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-emerald-800 text-xs font-semibold hover:bg-emerald-50 transition-colors shadow-sm"
          >
            <PlusCircle size={15} /> Đăng tin bán
          </Link>
        </div>
      </div>

      {/* Main Interactive Leaflet Map */}
      <MapView
        coords={coords}
        loadingLocation={loadingLocation}
        locationError={locationError}
        isFallback={isFallback}
        onLocateMe={() => requestLocation(true)}
        onClearError={clearError}
      />
    </div>
  );
}
