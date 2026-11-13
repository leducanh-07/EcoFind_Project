import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import L from '../utils/leafletCluster';
import { Locate, Loader2, AlertCircle, X, Plus, Minus } from 'lucide-react';
import { getListingsMapApi } from '../api/listings';

// Bảng cấu hình màu sắc và ngưỡng điểm theo BR-02
export const RANK_COLORS = {
  LIKE_NEW: { label: 'Như mới', scoreRange: '≥9.0', bg: '#10B981', text: '#ffffff', border: '#059669' },
  GOOD: { label: 'Tốt', scoreRange: '7.0–8.9', bg: '#3B82F6', text: '#ffffff', border: '#2563EB' },
  FAIR: { label: 'Khá', scoreRange: '5.0–6.9', bg: '#F59E0B', text: '#ffffff', border: '#D97706' },
  POOR: { label: 'Cũ', scoreRange: '<5.0', bg: '#EF4444', text: '#ffffff', border: '#DC2626' },
};

// Hàm lấy màu sắc marker theo BR-02 (hỗ trợ cả rank string và fallback totalScore)
export function getRankBadgeColor(rank, score) {
  let resolvedRank = rank;
  if (!resolvedRank && typeof score === 'number') {
    if (score >= 9.0) resolvedRank = 'Như mới';
    else if (score >= 7.0) resolvedRank = 'Tốt';
    else if (score >= 5.0) resolvedRank = 'Khá';
    else resolvedRank = 'Cũ';
  }
  switch (resolvedRank) {
    case 'Như mới':
      return RANK_COLORS.LIKE_NEW;
    case 'Tốt':
      return RANK_COLORS.GOOD;
    case 'Khá':
      return RANK_COLORS.FAIR;
    case 'Cũ':
    default:
      return RANK_COLORS.POOR;
  }
}

const EMPTY_FILTERS = {};

export default function MapView({
  coords,
  loadingLocation,
  locationError,
  isFallback,
  onLocateMe,
  onClearError,
  filters = EMPTY_FILTERS,
  onListingsLoaded,
  onFetchError,
  onLoadingChange,
  reloadKey = 0,
  selectedListingId,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const listingsLayerRef = useRef(null);
  const markersMapRef = useRef({});
  const lastBboxRef = useRef(null);
  const isFirstMountRef = useRef(true);
  const navigate = useNavigate();

  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const coordsRef = useRef(coords);
  coordsRef.current = coords;
  const onListingsLoadedRef = useRef(onListingsLoaded);
  onListingsLoadedRef.current = onListingsLoaded;
  const onFetchErrorRef = useRef(onFetchError);
  onFetchErrorRef.current = onFetchError;
  const onLoadingChangeRef = useRef(onLoadingChange);
  onLoadingChangeRef.current = onLoadingChange;

  const filterKey = JSON.stringify(filters || {});

  const [loadingListings, setLoadingListings] = useState(false);
  const [showFallbackBanner, setShowFallbackBanner] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  // Khởi tạo bản đồ Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [coords.lat, coords.lng],
        zoom: 14,
        zoomControl: false, // Tự đặt zoom control góc phải dưới
        maxBounds: [
          [-85.06, -180],
          [85.06, 180],
        ],
        maxBoundsViscosity: 1.0,
        worldCopyJump: false,
      });

      // Thêm tile layer Google Maps (đường phố tiêu chuẩn, CDN máy chủ đặt tại VN cực nhanh, không giật lag)
      L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3'],
        attribution: '&copy; Google Maps',
      }).addTo(map);

      // Kích hoạt tính lại kích thước để tránh hiện tượng khung xám khi layout render
      setTimeout(() => {
        map.invalidateSize();
      }, 200);

      // Layer nhóm chứa các marker sản phẩm
      const listingsLayer = L.layerGroup().addTo(map);
      listingsLayerRef.current = listingsLayer;

      mapInstanceRef.current = map;
    }

    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      if (listingsLayerRef.current) {
        listingsLayerRef.current.clearLayers();
        listingsLayerRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // Run once on mount

  // Di chuyển tâm bản đồ khi coords thay đổi và cập nhật GPS blue dot marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Tự động zoom gần vào vị trí người dùng (zoom 16) để thấy rõ đường phố xung quanh
    map.flyTo([coords.lat, coords.lng], 16, {
      duration: 1.0,
      easeLinearity: 0.25,
    });

    // Tạo icon chấm tròn xanh Google Maps GPS Blue Dot kinh điển
    const userIcon = L.divIcon({
      className: 'custom-google-user-marker',
      html: `
        <div class="relative flex items-center justify-center w-8 h-8" style="transform: translate3d(0, 0, 0);">
          <span class="absolute w-8 h-8 rounded-full ${isFallback ? 'bg-amber-400' : 'bg-blue-500'} opacity-35 animate-ping"></span>
          <span class="absolute w-6 h-6 rounded-full ${isFallback ? 'bg-amber-400' : 'bg-blue-400'} opacity-30 animate-pulse"></span>
          <div class="relative w-5 h-5 rounded-full bg-white shadow-lg flex items-center justify-center border border-slate-200">
            <div class="w-3.5 h-3.5 rounded-full ${isFallback ? 'bg-amber-500' : 'bg-[#1a73e8]'} shadow-inner"></div>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    // Đảm bảo marker luôn được vẽ lên map (tránh lỗi mồ côi ref khi React unmount/remount)
    if (userMarkerRef.current && map.hasLayer(userMarkerRef.current)) {
      userMarkerRef.current.setLatLng([coords.lat, coords.lng]);
      userMarkerRef.current.setIcon(userIcon);
    } else {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
      }
      const marker = L.marker([coords.lat, coords.lng], {
        icon: userIcon,
        zIndexOffset: 1000, // Luôn hiển thị trên các marker sản phẩm
      }).addTo(map);

      marker.bindPopup(
        isFallback
          ? '<b>Vị trí mặc định (TP.HCM)</b><br><small>Chưa cấp quyền GPS</small>'
          : '<b>Vị trí hiện tại của bạn</b>'
      );
      userMarkerRef.current = marker;
    }
  }, [coords, isFallback]);

  // Tải danh sách tin đăng theo khung nhìn bản đồ (bbox) và các tiêu chí lọc
  const loadListings = useCallback(async (force = false) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const bounds = map.getBounds();

    // Định dạng bbox: minLng,minLat,maxLng,maxLat (chuẩn hóa giới hạn [-180, 180] và [-90, 90])
    const minLng = Math.max(-180, Math.min(180, bounds.getWest()));
    const minLat = Math.max(-90, Math.min(90, bounds.getSouth()));
    const maxLng = Math.max(-180, Math.min(180, bounds.getEast()));
    const maxLat = Math.max(-90, Math.min(90, bounds.getNorth()));

    const currentFilters = filtersRef.current || {};
    const currentCoords = coordsRef.current;
    // Chuẩn hóa key kiểm tra thay đổi khung nhìn hoặc bộ lọc (~1 mét)
    const currentFilterKey = JSON.stringify(currentFilters);
    const bboxKey = `${minLng.toFixed(5)},${minLat.toFixed(5)},${maxLng.toFixed(5)},${maxLat.toFixed(5)}_${currentFilterKey}`;

    // Tiêu chí chấp nhận: Không gọi lại khi khung nhìn và bộ lọc không đổi
    if (!force && lastBboxRef.current === bboxKey) {
      return;
    }
    lastBboxRef.current = bboxKey;

    const bboxStr = `${minLng},${minLat},${maxLng},${maxLat}`;

    const startTime = performance.now();
    setLoadingListings(true);
    if (onLoadingChangeRef.current) {
      onLoadingChangeRef.current(true);
    }
    try {
      const data = await getListingsMapApi({
        bbox: bboxStr,
        q: currentFilters.q || undefined,
        categoryId: currentFilters.categoryId || undefined,
        minScore: currentFilters.minScore || undefined,
        district: currentFilters.district || undefined,
        lat: currentCoords?.lat,
        lng: currentCoords?.lng,
        radius: currentFilters.radius || undefined,
        sort: currentFilters.sort || 'distance',
        limit: 50,
      });

      if (onListingsLoadedRef.current) {
        onListingsLoadedRef.current(data || []);
      }
      if (onFetchErrorRef.current) {
        onFetchErrorRef.current(null);
      }

      const elapsed = performance.now() - startTime;
      if (typeof window !== 'undefined' && window.__FIRST_MARKER_LOADED__ === undefined) {
        window.__FIRST_MARKER_LOADED__ = elapsed;
        if (import.meta.env.DEV) {
          console.info(`[NFR-PER-01] First marker batch loaded in ${elapsed.toFixed(1)}ms (target: <= 3000ms)`);
        }
      }

      // Vẽ markers lên bản đồ (hỗ trợ gom cụm markercluster khi từ 30 tin trở lên - UC-02 A2, FR-03, TE9C73D)
      if (mapInstanceRef.current) {
        const map = mapInstanceRef.current;
        const listingsData = data || [];
        const shouldCluster = listingsData.length >= 30;

        // Xóa layer cũ nếu có trên map
        if (listingsLayerRef.current) {
          if (typeof listingsLayerRef.current.clearLayers === 'function') {
            listingsLayerRef.current.clearLayers();
          }
          if (map.hasLayer(listingsLayerRef.current)) {
            map.removeLayer(listingsLayerRef.current);
          }
        }
        markersMapRef.current = {};

        // Khởi tạo cluster group khi từ 30 tin trở lên (hoặc layerGroup thông thường khi dưới 30 tin)
        if (shouldCluster && typeof L.markerClusterGroup === 'function') {
          listingsLayerRef.current = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            iconCreateFunction: (cluster) => {
              const count = cluster.getChildCount();
              let size = 36;
              let bg = '#059669'; // emerald-600
              if (count >= 100) {
                size = 46;
                bg = '#0f766e'; // teal-700
              } else if (count >= 50) {
                size = 42;
                bg = '#047857'; // emerald-700
              }
              return L.divIcon({
                html: `
                  <div style="background-color: ${bg}; width: ${size}px; height: ${size}px;" 
                       class="rounded-full text-white font-bold font-mono text-xs flex items-center justify-center shadow-lg border-2 border-white ring-2 ring-emerald-400/40 cursor-pointer hover:scale-110 transition-transform"
                       title="${count} tin đăng trong khu vực này">
                    <span>${count}</span>
                  </div>
                `,
                className: 'custom-cluster-marker',
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
              });
            },
          }).addTo(map);
        } else {
          listingsLayerRef.current = L.layerGroup().addTo(map);
        }

        listingsData.forEach((item) => {
          const colors = getRankBadgeColor(item.rank, item.totalScore);

          const itemIcon = L.divIcon({
            className: 'custom-listing-marker',
            html: `
              <div style="background-color: ${colors.bg}; border-color: ${colors.border};" 
                   class="px-2 py-0.5 rounded-full text-white text-xs font-bold shadow-md border flex items-center gap-1 cursor-pointer transform hover:scale-110 transition-transform"
                   title="${colors.label} - ${Number(item.totalScore).toFixed(1)} điểm">
                <span>${Number(item.totalScore).toFixed(1)}</span>
              </div>
            `,
            iconSize: [42, 24],
            iconAnchor: [21, 12],
          });

          const marker = L.marker([item.lat, item.lng], { icon: itemIcon });
          markersMapRef.current[item.id] = marker;

          const formattedPrice =
            Number(item.price) === 0
              ? '<span class="text-emerald-600 font-bold">Cho tặng</span>'
              : `${Number(item.price).toLocaleString('vi-VN')} đ`;

          const popupContent = `
            <div class="p-1 min-w-[180px]">
              <div class="font-bold text-slate-800 text-sm mb-1">${item.title}</div>
              <div class="text-sm font-semibold text-emerald-700 mb-1">${formattedPrice}</div>
              <div class="text-xs text-slate-500 mb-2">${item.address || ''}</div>
              <div class="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                <span style="color: ${colors.border}" class="font-semibold">${item.rank || colors.label} (${Number(item.totalScore).toFixed(1)})</span>
                <a href="/listings/${item.id}" data-id="${item.id}" class="listing-link-${item.id} text-emerald-600 font-medium hover:underline inline-flex items-center gap-0.5 cursor-pointer">
                  Xem chi tiết →
                </a>
              </div>
            </div>
          `;

          marker.bindPopup(popupContent);
          marker.on('popupopen', () => {
            const link = document.querySelector(`.listing-link-${item.id}`);
            if (link) {
              link.onclick = (e) => {
                e.preventDefault();
                navigate(`/listings/${item.id}`);
              };
            }
          });

          listingsLayerRef.current.addLayer(marker);
        });
      }
    } catch (err) {
      if (onFetchErrorRef.current) {
        onFetchErrorRef.current(err.message || 'Lỗi kết nối khi tải danh sách tin đăng');
      }
    } finally {
      setLoadingListings(false);
      if (onLoadingChangeRef.current) {
        onLoadingChangeRef.current(false);
      }
    }
  }, [navigate]);

  // Di chuyển và mở popup khi chọn một tin đăng từ danh sách
  useEffect(() => {
    if (!selectedListingId || !mapInstanceRef.current) return;
    const marker = markersMapRef.current[selectedListingId];
    if (marker) {
      if (listingsLayerRef.current && typeof listingsLayerRef.current.zoomToShowLayer === 'function') {
        listingsLayerRef.current.zoomToShowLayer(marker, () => {
          marker.openPopup();
        });
      } else {
        const latlng = marker.getLatLng();
        mapInstanceRef.current.flyTo(latlng, 16, { duration: 0.8 });
        marker.openPopup();
      }
    }
  }, [selectedListingId]);

  // Hỗ trợ kích hoạt tải lại thủ công từ bên ngoài (ví dụ: nút Thử lại lỗi kết nối)
  useEffect(() => {
    if (reloadKey > 0) {
      loadListings(true);
    }
  }, [reloadKey, loadListings]);

  // Khi filterKey thay đổi (ngoại trừ mount ban đầu), tải lại danh sách
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    loadListings(true);
  }, [filterKey, loadListings]);

  // Lắng nghe sự kiện kéo/zoom để tải lại tin (sự kiện moveend/zoomend có debounce 400ms trong khoảng 300–500ms)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Tải dữ liệu khung nhìn ban đầu
    loadListings(true);

    let debounceTimer;
    const handleViewportChange = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadListings();
      }, 400); // Debounce 400ms theo tiêu chí 300-500ms
    };

    map.on('moveend', handleViewportChange);
    map.on('zoomend', handleViewportChange);

    return () => {
      clearTimeout(debounceTimer);
      map.off('moveend', handleViewportChange);
      map.off('zoomend', handleViewportChange);
    };
  }, [loadListings]);

  return (
    <div className="relative w-full h-[calc(100vh-10rem)] min-h-[480px] rounded-3xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
      {/* Container Leaflet map */}
      <div ref={mapContainerRef} className="w-full h-full z-0" tabIndex={0} />

      {/* Loading listings spinner indicator */}
      {loadingListings && (
        <div className="absolute top-4 left-4 z-30 bg-white/90 backdrop-blur-sm border border-slate-200 px-3 py-1.5 rounded-xl shadow flex items-center gap-2 text-xs text-slate-700 animate-in fade-in duration-200">
          <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
          <span>Đang tải tin đăng...</span>
        </div>
      )}

      {/* Banner thông báo phương án dự phòng (UC-02 A1, FR-04) */}
      {isFallback && showFallbackBanner && (
        <div className="absolute top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-30 bg-amber-50/95 backdrop-blur-sm border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl shadow-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="font-semibold">Vị trí mặc định tại trung tâm TP.HCM</p>
            <p className="mt-0.5 text-amber-800 leading-relaxed">
              {locationError || 'Không thể xác định GPS thiết bị. Bạn có thể bật GPS và thử lại.'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={onLocateMe}
                disabled={loadingLocation}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-[11px] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loadingLocation ? 'Đang dò vị trí...' : 'Thử lại định vị'}
              </button>
            </div>
          </div>
          <button
            onClick={() => {
              setShowFallbackBanner(false);
              if (onClearError) onClearError();
            }}
            className="text-amber-500 hover:text-amber-800 p-1 -mr-1 cursor-pointer"
            title="Đóng thông báo"
            aria-label="Đóng thông báo"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Cụm công cụ điều khiển bản đồ góc phải dưới: Vị trí của tôi & Phóng to / Thu nhỏ (chuẩn UX Google Maps, không bị đè nhau) */}
      <div className="absolute bottom-8 right-3.5 sm:right-4 z-30 flex flex-col items-center gap-2">
        {/* Nút điều khiển "Vị trí của tôi" */}
        <button
          onClick={onLocateMe}
          disabled={loadingLocation}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200/90 shadow-md flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-60 cursor-pointer"
          title="Vị trí của tôi"
          aria-label="Vị trí của tôi"
        >
          {loadingLocation ? (
            <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
          ) : (
            <Locate className="w-5 h-5 text-slate-700" />
          )}
        </button>

        {/* Cụm nút Phóng to / Thu nhỏ đồng bộ */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-200/90 overflow-hidden flex flex-col">
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="w-10 h-10 sm:w-11 sm:h-10 flex items-center justify-center text-slate-700 hover:bg-slate-50 hover:text-emerald-700 border-b border-slate-100 transition-colors cursor-pointer"
            title="Phóng to"
            aria-label="Phóng to"
          >
            <Plus size={18} />
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="w-10 h-10 sm:w-11 sm:h-10 flex items-center justify-center text-slate-700 hover:bg-slate-50 hover:text-emerald-700 transition-colors cursor-pointer"
            title="Thu nhỏ"
            aria-label="Thu nhỏ"
          >
            <Minus size={18} />
          </button>
        </div>
      </div>

      {/* Bảng chú thích màu marker theo 4 hạng BR-02 (Tối ưu mobile-first 360–430px & desktop) */}
      <div className="absolute bottom-6 left-4 sm:left-6 z-30 flex flex-col gap-1.5 max-w-[calc(100vw-6rem)] sm:max-w-none">
        {showLegend ? (
          <div
            data-testid="color-legend"
            className="bg-white/95 backdrop-blur-md px-3 sm:px-3.5 py-2 rounded-2xl border border-slate-200/80 shadow-md flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 text-[11px] font-medium text-slate-700 animate-in fade-in slide-in-from-bottom-2"
          >
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Hạng:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
              <span>Như mới (≥9.0)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
              <span>Tốt (7.0–8.9)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
              <span>Khá (5.0–6.9)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
              <span>Cũ (&lt;5.0)</span>
            </div>
            <button
              onClick={() => setShowLegend(false)}
              className="sm:hidden text-slate-400 hover:text-slate-600 ml-auto p-1 cursor-pointer"
              title="Thu nhỏ chú thích màu"
              aria-label="Thu nhỏ chú thích màu"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowLegend(true)}
            className="sm:hidden bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-200/80 shadow-md text-[11px] font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer hover:bg-slate-50"
            aria-label="Hiện chú thích màu"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Chú thích màu</span>
          </button>
        )}
      </div>
    </div>
  );
}
