import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Compass } from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import MapView from '../components/MapView';
import SearchAndFilterBar, { INITIAL_FILTERS } from '../components/SearchAndFilterBar';

export default function HomePage() {
  const {
    coords,
    loading: loadingLocation,
    error: locationError,
    isFallback,
    requestLocation,
    clearError,
  } = useGeolocation();

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [listings, setListings] = useState([]);
  const [listingsError, setListingsError] = useState(null);
  const [selectedListingId, setSelectedListingId] = useState(null);

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  return (
    <div className="space-y-3">
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

      {/* Thanh tìm kiếm & Bộ lọc nâng cao */}
      <SearchAndFilterBar
        filters={filters}
        onApplyFilters={handleApplyFilters}
        onResetFilters={handleResetFilters}
        totalResults={listings.length}
      />

      {/* Bản đồ chính */}
      <MapView
        coords={coords}
        loadingLocation={loadingLocation}
        locationError={locationError}
        isFallback={isFallback}
        onLocateMe={() => requestLocation(true)}
        onClearError={clearError}
        filters={filters}
        onListingsLoaded={setListings}
        onFetchError={setListingsError}
        selectedListingId={selectedListingId}
      />
    </div>
  );
}
