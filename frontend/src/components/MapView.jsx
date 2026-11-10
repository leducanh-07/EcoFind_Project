import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { Locate, Loader2, AlertCircle, X } from 'lucide-react';
import { getListingsMapApi } from '../api/listings';

// Hàm lấy màu sắc marker theo BR-02
export function getRankBadgeColor(rank) {
  switch (rank) {
    case 'Như mới':
      return { bg: '#10B981', text: '#ffffff', border: '#059669' }; // Emerald
    case 'Tốt':
      return { bg: '#3B82F6', text: '#ffffff', border: '#2563EB' }; // Blue
    case 'Khá':
      return { bg: '#F59E0B', text: '#ffffff', border: '#D97706' }; // Amber
    case 'Cũ':
    default:
      return { bg: '#EF4444', text: '#ffffff', border: '#DC2626' }; // Rose
  }
}

export default function MapView({
  coords,
  loadingLocation,
  locationError,
  isFallback,
  onLocateMe,
  onClearError,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const listingsLayerRef = useRef(null);
  const navigate = useNavigate();

  const [loadingListings, setLoadingListings] = useState(false);
  const [showFallbackBanner, setShowFallbackBanner] = useState(true);

  // Khởi tạo bản đồ Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [coords.lat, coords.lng],
        zoom: 14,
        zoomControl: false, // Tự đặt zoom control góc phải dưới
      });

      // Thêm tile layer OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Thêm zoom control phía dưới bên phải để tránh che thanh tìm kiếm
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Layer nhóm chứa các marker sản phẩm
      const listingsLayer = L.layerGroup().addTo(map);
      listingsLayerRef.current = listingsLayer;

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // Run once on mount

  // Di chuyển tâm bản đồ khi coords thay đổi
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    map.flyTo([coords.lat, coords.lng], 14, {
      duration: 1.0,
      easeLinearity: 0.25,
    });

    // Cập nhật marker vị trí người dùng
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([coords.lat, coords.lng]);
    } else {
      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full ${isFallback ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75"></span>
            <div class="relative w-6 h-6 rounded-full ${isFallback ? 'bg-amber-500' : 'bg-emerald-600'} text-white flex items-center justify-center shadow-lg border-2 border-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([coords.lat, coords.lng], { icon: userIcon }).addTo(map);
      marker.bindPopup(
        isFallback
          ? '<b>Vị trí mặc định (TP.HCM)</b><br><small>Chưa cấp quyền GPS</small>'
          : '<b>Vị trí hiện tại của bạn</b>'
      );
      userMarkerRef.current = marker;
    }
  }, [coords, isFallback]);

  // Tải danh sách tin đăng theo khung nhìn bản đồ (bbox)
  const loadListings = useCallback(async () => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const bounds = map.getBounds();

    // Định dạng bbox: minLng,minLat,maxLng,maxLat
    const minLng = bounds.getWest();
    const minLat = bounds.getSouth();
    const maxLng = bounds.getEast();
    const maxLat = bounds.getNorth();
    const bboxStr = `${minLng},${minLat},${maxLng},${maxLat}`;

    const startTime = performance.now();
    setLoadingListings(true);
    try {
      const data = await getListingsMapApi({ bbox: bboxStr, limit: 50 });

      const elapsed = performance.now() - startTime;
      if (typeof window !== 'undefined' && window.__FIRST_MARKER_LOADED__ === undefined) {
        window.__FIRST_MARKER_LOADED__ = elapsed;
        if (import.meta.env.DEV) {
          console.info(`[NFR-PER-01] First marker batch loaded in ${elapsed.toFixed(1)}ms (target: <= 3000ms)`);
        }
      }

      // Vẽ markers lên bản đồ
      if (listingsLayerRef.current) {
        listingsLayerRef.current.clearLayers();

        (data || []).forEach((item) => {
          const colors = getRankBadgeColor(item.rank);

          const itemIcon = L.divIcon({
            className: 'custom-listing-marker',
            html: `
              <div style="background-color: ${colors.bg}; border-color: ${colors.border};" 
                   class="px-2 py-0.5 rounded-full text-white text-xs font-bold shadow-md border flex items-center gap-1 cursor-pointer transform hover:scale-110 transition-transform">
                <span>${Number(item.totalScore).toFixed(1)}</span>
              </div>
            `,
            iconSize: [42, 24],
            iconAnchor: [21, 12],
          });

          const marker = L.marker([item.lat, item.lng], { icon: itemIcon });

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
                <span style="color: ${colors.border}" class="font-semibold">${item.rank} (${item.totalScore})</span>
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
    } catch {
      // Bỏ qua lỗi map move
    } finally {
      setLoadingListings(false);
    }
  }, [navigate]);

  // Lắng nghe sự kiện kéo/zoom để tải lại tin
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    loadListings();

    let debounceTimer;
    const handleMoveEnd = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadListings();
      }, 400);
    };

    map.on('moveend', handleMoveEnd);

    return () => {
      clearTimeout(debounceTimer);
      map.off('moveend', handleMoveEnd);
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

      {/* Nút điều khiển "Vị trí của tôi" (Floating Button) */}
      <div className="absolute bottom-6 right-6 z-30 flex flex-col gap-2">
        <button
          onClick={onLocateMe}
          disabled={loadingLocation}
          className="w-12 h-12 rounded-2xl bg-white text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200/80 shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-60 cursor-pointer"
          title="Vị trí của tôi"
          aria-label="Vị trí của tôi"
        >
          {loadingLocation ? (
            <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
          ) : (
            <Locate className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Bảng chú thích màu marker theo 4 hạng BR-02 */}
      <div className="absolute bottom-6 left-6 z-30 bg-white/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-200/80 shadow-md hidden sm:flex items-center gap-3 text-[11px] font-medium text-slate-700">
        <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Hạng:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Như mới (≥9.0)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
          <span>Tốt (7.0–8.9)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>Khá (5.0–6.9)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
          <span>Cũ (&lt;5.0)</span>
        </div>
      </div>
    </div>
  );
}
