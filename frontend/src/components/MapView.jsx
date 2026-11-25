import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import L, { GOOGLE_MAP_TILE_URL, GOOGLE_MAP_TILE_OPTIONS } from '../utils/leafletCluster';
import { Locate, Loader2, AlertCircle, X, Plus, Minus, RotateCw } from 'lucide-react';
import { getListingsMapApi } from '../api/listings';

// Bảng cấu hình màu sắc và ngưỡng điểm theo BR-02
export const RANK_COLORS = {
  LIKE_NEW: { label: 'Như mới', scoreRange: '≥9.0', bg: '#10B981', text: '#ffffff', border: '#059669' },
  GOOD: { label: 'Tốt', scoreRange: '7.0–8.9', bg: '#3B82F6', text: '#ffffff', border: '#2563EB' },
  FAIR: { label: 'Khá', scoreRange: '5.0–6.9', bg: '#F59E0B', text: '#ffffff', border: '#D97706' },
  POOR: { label: 'Cũ', scoreRange: '<5.0', bg: '#EF4444', text: '#ffffff', border: '#DC2626' },
};

// Bảng tọa độ trung tâm các quận/huyện/TP.Thủ Đức phục vụ di chuyển góc nhìn bản đồ khi lọc
export const DISTRICT_CENTERS = {
  'Quận 1': { lat: 10.7757, lng: 106.7004, zoom: 14 },
  'Quận 2': { lat: 10.7873, lng: 106.7498, zoom: 13 },
  'Quận 3': { lat: 10.7844, lng: 106.6844, zoom: 14 },
  'Quận 4': { lat: 10.7578, lng: 106.7013, zoom: 14 },
  'Quận 5': { lat: 10.7540, lng: 106.6634, zoom: 14 },
  'Quận 6': { lat: 10.7481, lng: 106.6352, zoom: 14 },
  'Quận 7': { lat: 10.7340, lng: 106.7216, zoom: 13 },
  'Quận 8': { lat: 10.7241, lng: 106.6286, zoom: 13 },
  'Quận 9': { lat: 10.8428, lng: 106.8287, zoom: 13 },
  'Quận 10': { lat: 10.7746, lng: 106.6680, zoom: 14 },
  'Quận 11': { lat: 10.7628, lng: 106.6501, zoom: 14 },
  'Quận 12': { lat: 10.8672, lng: 106.6413, zoom: 13 },
  'Bình Thạnh': { lat: 10.8106, lng: 106.7091, zoom: 14 },
  'Phú Nhuận': { lat: 10.7992, lng: 106.6803, zoom: 14 },
  'Gò Vấp': { lat: 10.8387, lng: 106.6653, zoom: 14 },
  'Tân Bình': { lat: 10.8015, lng: 106.6526, zoom: 14 },
  'Tân Phú': { lat: 10.7900, lng: 106.6282, zoom: 14 },
  'Bình Tân': { lat: 10.7652, lng: 106.6038, zoom: 13 },
  'Thủ Đức': { lat: 10.8494, lng: 106.7537, zoom: 13 },
  'TP. Thủ Đức': { lat: 10.8494, lng: 106.7537, zoom: 13 },
  'Bình Chánh': { lat: 10.6874, lng: 106.5939, zoom: 12 },
  'Nhà Bè': { lat: 10.6953, lng: 106.7049, zoom: 12 },
  'Hóc Môn': { lat: 10.8862, lng: 106.5954, zoom: 12 },
  'Củ Chi': { lat: 10.9733, lng: 106.4933, zoom: 11 },
  'Cần Giờ': { lat: 10.4112, lng: 106.9547, zoom: 11 },
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
  const isFittingBoundsRef = useRef(false);
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
  const [mapError, setMapError] = useState(null);
  const [showFallbackBanner, setShowFallbackBanner] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  // Khởi tạo bản đồ Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [coords.lat, coords.lng],
        zoom: 14,
        zoomSnap: 1,
        zoomDelta: 1,
        zoomControl: false, // Tự đặt zoom control góc phải dưới
        maxBounds: [
          [-85.06, -180],
          [85.06, 180],
        ],
        maxBoundsViscosity: 1.0,
        worldCopyJump: false,
      });

      // Khóa ngôn ngữ tiếng Việt (hl=vi&gl=VN) trên 1 host đồng bộ để tránh lệch/xé chữ và lẫn chữ Trung
      L.tileLayer(GOOGLE_MAP_TILE_URL, GOOGLE_MAP_TILE_OPTIONS).addTo(map);

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
  const prevCoordsRef = useRef(null);
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const hasCoordsChanged =
      !prevCoordsRef.current ||
      Math.abs(prevCoordsRef.current.lat - coords.lat) > 0.0001 ||
      Math.abs(prevCoordsRef.current.lng - coords.lng) > 0.0001;

    if (hasCoordsChanged) {
      prevCoordsRef.current = coords;
      // Tự động zoom vừa vặn vùng lân cận người dùng (zoom 13) để thấy rõ các tin đăng trong bán kính 10km
      map.flyTo([coords.lat, coords.lng], 13, {
        duration: 0.8,
        easeLinearity: 0.25,
      });
    }

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

  // Tải danh sách tin đăng theo khung nhìn bản đồ (bbox) hoặc theo phạm vi bộ lọc/tìm kiếm chủ động
  const loadListings = useCallback(async (force = false, isFilterTrigger = false) => {
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

    // Xác định tọa độ tham chiếu: ưu tiên tâm quận nếu người dùng lọc theo khu vực quận/huyện
    let targetLat = currentCoords?.lat;
    let targetLng = currentCoords?.lng;
    if (currentFilters.district && DISTRICT_CENTERS[currentFilters.district]) {
      targetLat = DISTRICT_CENTERS[currentFilters.district].lat;
      targetLng = DISTRICT_CENTERS[currentFilters.district].lng;
    }

    const startTime = performance.now();
    setLoadingListings(true);
    setMapError(null);
    if (onLoadingChangeRef.current) {
      onLoadingChangeRef.current(true);
    }
    try {
      // Khi người dùng bấm Tìm kiếm hoặc thay đổi Bộ lọc (isFilterTrigger = true):
      // KHÔNG truyền bbox cũ để tránh bị kẹp cứng vào khung nhìn hiện tại.
      // API sẽ tìm kiếm toàn bộ phạm vi bán kính (hoặc quận/huyện) mà người dùng mong muốn.
      const data = await getListingsMapApi({
        bbox: isFilterTrigger ? undefined : bboxStr,
        q: currentFilters.q || undefined,
        categoryId: currentFilters.categoryId || undefined,
        minScore: currentFilters.minScore || undefined,
        district: currentFilters.district || undefined,
        lat: targetLat,
        lng: targetLng,
        radius: currentFilters.radius || undefined,
        sort: currentFilters.sort || 'distance',
        limit: 50,
      });

      const listingsData = data || [];

      if (onListingsLoadedRef.current) {
        onListingsLoadedRef.current(listingsData);
      }
      if (onFetchErrorRef.current) {
        onFetchErrorRef.current(null);
      }

      // Tự động điều chỉnh góc nhìn bản đồ (camera) khớp với phạm vi lọc/tìm kiếm:
      if (isFilterTrigger && mapInstanceRef.current) {
        if (currentFilters.district && DISTRICT_CENTERS[currentFilters.district]) {
          const d = DISTRICT_CENTERS[currentFilters.district];
          isFittingBoundsRef.current = true;
          map.flyTo([d.lat, d.lng], d.zoom, { duration: 0.8 });
        } else if (listingsData.length > 0) {
          isFittingBoundsRef.current = true;
          if (listingsData.length === 1) {
            map.flyTo([listingsData[0].lat, listingsData[0].lng], 15, { duration: 0.8 });
          } else {
            const points = listingsData.map((item) => [item.lat, item.lng]);
            if (currentCoords?.lat && currentCoords?.lng) {
              points.push([currentCoords.lat, currentCoords.lng]);
            }
            const fitBbox = L.latLngBounds(points);
            map.fitBounds(fitBbox, { padding: [50, 50], maxZoom: 15 });
          }
        } else if (currentFilters.radius && currentCoords?.lat && currentCoords?.lng) {
          isFittingBoundsRef.current = true;
          const circleBounds = L.latLng(currentCoords.lat, currentCoords.lng).toBounds(
            currentFilters.radius * 1000
          );
          map.fitBounds(circleBounds, { maxZoom: 15, duration: 0.8 });
        }
      }

      const elapsed = performance.now() - startTime;
      if (typeof window !== 'undefined' && window.__FIRST_MARKER_LOADED__ === undefined) {
        window.__FIRST_MARKER_LOADED__ = elapsed;
        if (import.meta.env.DEV) {
          console.info(`First marker batch loaded in ${elapsed.toFixed(1)}ms (target: <= 3000ms)`);
        }
      }

      // Vẽ markers lên bản đồ (hỗ trợ gom cụm markercluster khi từ 30 tin trở lên - UC-02 A2, FR-03, TE9C73D)
      if (mapInstanceRef.current) {
        const map = mapInstanceRef.current;
        const listingsData = data || [];
        const shouldCluster = listingsData.length >= 30;
        const currentIsClustered = listingsLayerRef.current?._isClusterGroup;

        // Nếu chưa có layer hoặc chế độ gom cụm thay đổi (từ <30 sang >=30 hoặc ngược lại)
        const needsRecreateLayer = !listingsLayerRef.current || currentIsClustered !== shouldCluster;

        if (needsRecreateLayer) {
          if (listingsLayerRef.current) {
            if (typeof listingsLayerRef.current.clearLayers === 'function') {
              listingsLayerRef.current.clearLayers();
            }
            if (map.hasLayer(listingsLayerRef.current)) {
              map.removeLayer(listingsLayerRef.current);
            }
          }
          markersMapRef.current = {};

          if (shouldCluster && typeof L.markerClusterGroup === 'function') {
            const clusterGroup = L.markerClusterGroup({
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
            });
            clusterGroup._isClusterGroup = true;
            listingsLayerRef.current = clusterGroup.addTo(map);
          } else {
            const standardGroup = L.layerGroup();
            standardGroup._isClusterGroup = false;
            listingsLayerRef.current = standardGroup.addTo(map);
          }
        }

        // Marker Diffing Reconciliation:
        // 1. Tìm các ID hiện có trên map và ID từ API
        const newIds = new Set(listingsData.map((item) => String(item.id)));
        const existingIds = Object.keys(markersMapRef.current);

        // 2. Xóa các marker không còn nằm trong kết quả tìm kiếm mới
        for (const id of existingIds) {
          if (!newIds.has(id)) {
            const marker = markersMapRef.current[id];
            if (marker && listingsLayerRef.current) {
              listingsLayerRef.current.removeLayer(marker);
            }
            delete markersMapRef.current[id];
          }
        }

        // 3. Thêm các marker mới (marker đã có được giữ nguyên trên DOM, loại bỏ 100% hiện tượng nhấp nháy giật hình)
        listingsData.forEach((item) => {
          const itemIdStr = String(item.id);
          if (markersMapRef.current[itemIdStr]) {
            return;
          }

          const colors = getRankBadgeColor(item.rank, item.totalScore);

          const itemIcon = L.divIcon({
            className: 'custom-listing-marker',
            html: `
              <div style="background-color: ${colors.bg}; border-color: ${colors.border};" 
                   class="px-2.5 py-1 rounded-full text-white text-xs font-bold shadow-md border flex items-center gap-1 cursor-pointer transform hover:scale-110 transition-transform select-none"
                   title="${colors.label} - ${Number(item.totalScore).toFixed(1)} điểm">
                <span>${Number(item.totalScore).toFixed(1)}</span>
              </div>
            `,
            iconSize: [44, 26],
            iconAnchor: [22, 13],
          });

          const marker = L.marker([item.lat, item.lng], { icon: itemIcon });
          markersMapRef.current[itemIdStr] = marker;

          const priceColorClass =
            Number(item.price) === 0 ? 'text-emerald-700' : 'text-orange-700';
          const formattedPrice =
            Number(item.price) === 0
              ? 'Cho tặng'
              : `${Number(item.price).toLocaleString('vi-VN')} đ`;

          const popupContent = `
            <div class="p-1 min-w-[200px]">
              <div class="font-bold text-slate-800 text-sm mb-1">${item.title}</div>
              <div class="text-sm font-bold ${priceColorClass} mb-1">${formattedPrice}</div>
              <div class="text-xs text-slate-500 mb-2">${item.address || ''}</div>
              <div class="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100">
                <span style="color: ${colors.border}" class="font-bold">${item.rank || colors.label} (${Number(item.totalScore).toFixed(1)})</span>
                <a href="/listings/${item.id}" data-id="${item.id}" class="listing-link-${item.id} text-emerald-600 font-bold hover:underline inline-flex items-center gap-0.5 cursor-pointer">
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
      const errorMsg = err.message || 'Không thể tải dữ liệu tin đăng trên bản đồ.';
      setMapError(errorMsg);
      if (onFetchErrorRef.current) {
        onFetchErrorRef.current(errorMsg);
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
      loadListings(true, false);
    }
  }, [reloadKey, loadListings]);

  // Khi filterKey thay đổi (người dùng bấm Tìm kiếm hoặc thay đổi bộ lọc), tải lại danh sách theo phạm vi bộ lọc
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    loadListings(true, true);
  }, [filterKey, loadListings]);

  // Lắng nghe sự kiện kéo/zoom để tải lại tin (sự kiện moveend/zoomend có debounce 400ms trong khoảng 300–500ms)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Tải dữ liệu khung nhìn ban đầu
    loadListings(true, false);

    let debounceTimer;
    const handleViewportChange = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isFittingBoundsRef.current) {
          isFittingBoundsRef.current = false;
          return;
        }
        loadListings(false, false);
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
    <div data-testid="map-view-container" className="relative w-full h-[calc(100vh-11.5rem)] min-h-[560px] xl:min-h-[620px] rounded-3xl overflow-hidden border border-slate-200/90 shadow-xs bg-slate-100">
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

      {/* Thông báo lỗi tải dữ liệu bản đồ & nút Thử lại (UC-02 E1, TE9C73E) */}
      {mapError && (
        <div
          data-testid="map-error-banner"
          className="absolute top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-30 bg-rose-50/95 backdrop-blur-sm border border-rose-200 text-rose-900 px-4 py-3 rounded-2xl shadow-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="font-semibold text-rose-900">Không thể tải dữ liệu bản đồ</p>
            <p className="mt-0.5 text-rose-800 leading-relaxed">
              {mapError}
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                data-testid="map-retry-btn"
                onClick={() => {
                  setMapError(null);
                  loadListings(true);
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium text-[11px] transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <RotateCw size={12} />
                <span>Thử lại</span>
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMapError(null)}
            className="text-rose-400 hover:text-rose-700 p-1 -mr-1 cursor-pointer"
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
