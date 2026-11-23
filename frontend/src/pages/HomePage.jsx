import React, { useState, useCallback } from 'react';
import { Compass, Map, List, MapPin, RefreshCw, AlertCircle } from 'lucide-react';
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
    <div className="space-y-2.5">
      {/* Top Context Sub-header: Subtle, informative & non-intrusive */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
            </span>
            <span className="font-semibold text-slate-800">
              {isFallback ? 'Vị trí mặc định: TP. Hồ Chí Minh' : 'Định vị GPS thực tế'}
            </span>
          </div>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500 hidden sm:inline">
            Khám phá món đồ cũ chất lượng theo khoảng cách & điểm tình trạng (0–10)
          </span>
        </div>

        {/* Location refresh / GPS indicator */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {loadingLocation && (
            <span className="inline-flex items-center gap-1 text-[11px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-medium">
              <RefreshCw size={11} className="animate-spin" /> Đang lấy vị trí...
            </span>
          )}
          {isFallback && !loadingLocation && (
            <button
              type="button"
              onClick={() => requestLocation(true)}
              className="inline-flex items-center gap-1 text-[11px] text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer"
              title="Kích hoạt định vị chính xác vị trí của bạn"
            >
              <MapPin size={12} /> Bật GPS của tôi
            </button>
          )}
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
      <div className="lg:hidden flex items-center justify-center p-1 bg-slate-200/60 rounded-2xl w-full max-w-xs mx-auto shadow-inner">
        <button
          type="button"
          onClick={() => setMobileTab('map')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === 'map'
              ? 'bg-white text-teal-800 shadow-xs'
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
              ? 'bg-white text-teal-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <List size={14} />
          <span>Danh sách ({listings.length})</span>
        </button>
      </div>

      {/* Khu vực hiển thị: Cột danh sách kết quả cạnh bản đồ (Desktop) & Tab View (Mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-3.5 items-start">
        {/* Cột Danh sách kết quả */}
        <div
          className={`lg:col-span-5 xl:col-span-4 h-[calc(100vh-12.5rem)] min-h-[520px] ${
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
