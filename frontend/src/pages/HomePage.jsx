import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Compass,
  Map,
  List,
  MapPin,
  RefreshCw,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import MapView from '../components/MapView';
import SearchAndFilterBar, { INITIAL_FILTERS } from '../components/SearchAndFilterBar';
import SearchResultsList from '../components/SearchResultsList';

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const prevAuthRef = useRef(isAuthenticated);
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

  // Khi người dùng đăng xuất: Reset toàn bộ bộ lọc và từ khóa về mặc định
  useEffect(() => {
    if (prevAuthRef.current && !isAuthenticated) {
      setFilters(INITIAL_FILTERS);
      setSelectedListingId(null);
      setReloadKey((k) => k + 1);
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

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
      {/* Top Context Sub-header: Tinh gọn, rõ ràng, phong cách Modern Clean */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
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
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg font-medium border border-emerald-200/60">
              <RefreshCw size={11} className="animate-spin" /> Đang lấy vị trí...
            </span>
          )}
          {isFallback && !loadingLocation && (
            <button
              type="button"
              onClick={() => requestLocation(true)}
              className="inline-flex items-center gap-1 text-[11px] text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-lg font-bold border border-emerald-200/80 transition-colors cursor-pointer shadow-2xs"
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
              ? 'bg-white text-emerald-800 shadow-2xs'
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
              ? 'bg-white text-emerald-800 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <List size={14} />
          <span>Danh sách ({listings.length})</span>
        </button>
      </div>

      {/* Khu vực hiển thị: Cột danh sách kết quả cạnh bản đồ (Desktop 45/55 Split cố định) & Tab View (Mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 items-start">
        {/* Cột Danh sách kết quả: Chiếm 5/12 (~42-45%) rộng rãi cho thẻ ngang */}
        <div
          className={`h-[calc(100vh-9.5rem)] min-h-[600px] xl:min-h-[680px] lg:col-span-5 xl:col-span-5 2xl:col-span-5 ${
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

        {/* Cột Bản đồ: Chiếm 7/12 (~55-58%) hiển thị ổn định, không bị lỗi kích thước */}
        <div
          className={`h-[calc(100vh-9.5rem)] min-h-[600px] xl:min-h-[680px] lg:col-span-7 xl:col-span-7 2xl:col-span-7 ${
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
