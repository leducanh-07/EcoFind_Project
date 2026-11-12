import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Compass, Map, List } from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import MapView from '../components/MapView';
import SearchAndFilterBar, { INITIAL_FILTERS } from '../components/SearchAndFilterBar';
import SearchResultsList from '../components/SearchResultsList';

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
  const [loadingListings, setLoadingListings] = useState(false);
  const [listingsError, setListingsError] = useState(null);
  const [selectedListingId, setSelectedListingId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [mobileTab, setMobileTab] = useState('map'); // 'map' | 'list'

  const handleApplyFilters = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  const handleRetry = useCallback(() => {
    setListingsError(null);
    setReloadKey((k) => k + 1);
  }, []);

  const handleSelectListingOnMap = useCallback((id) => {
    setSelectedListingId(id);
    setMobileTab('map');
  }, []);

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

      {/* Thanh chuyển tab trên mobile (Bản đồ / Danh sách) */}
      <div className="lg:hidden flex items-center justify-center p-1 bg-slate-200/70 rounded-2xl w-full max-w-xs mx-auto">
        <button
          type="button"
          onClick={() => setMobileTab('map')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === 'map'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Map size={14} />
          <span>Bản đồ</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('list')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === 'list'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <List size={14} />
          <span>Danh sách ({listings.length})</span>
        </button>
      </div>

      {/* Khu vực hiển thị: Cột danh sách kết quả cạnh bản đồ (Desktop) & Tab View (Mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 items-start">
        {/* Cột Danh sách kết quả */}
        <div
          className={`lg:col-span-5 xl:col-span-4 h-[calc(100vh-14rem)] min-h-[500px] ${
            mobileTab === 'list' ? 'block' : 'hidden lg:block'
          }`}
        >
          <SearchResultsList
            listings={listings}
            loading={loadingListings}
            error={listingsError}
            onRetry={handleRetry}
            onSelectListing={handleSelectListingOnMap}
            selectedListingId={selectedListingId}
            filters={filters}
            onApplyFilters={handleApplyFilters}
            onResetFilters={handleResetFilters}
          />
        </div>

        {/* Cột Bản đồ */}
        <div
          className={`lg:col-span-7 xl:col-span-8 ${
            mobileTab === 'map' ? 'block' : 'hidden lg:block'
          }`}
        >
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
            onLoadingChange={setLoadingListings}
            reloadKey={reloadKey}
            selectedListingId={selectedListingId}
          />
        </div>
      </div>
    </div>
  );
}
