import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from '../utils/leafletCluster';
import { Search, MapPin, Locate, AlertCircle, Loader2, Info } from 'lucide-react';
import { geocodeAddressApi } from '../api/geocode';

/**
 * Custom Pin Icon cho vị trí được chọn
 */
const createPickerIcon = () =>
  L.divIcon({
    className: 'picker-custom-pin',
    html: `
      <div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; cursor: grab;">
        <div style="background-color: #059669; color: white; border-radius: 9999px; padding: 5px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -2px rgba(0, 0, 0, 0.2); border: 2px solid white;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
        <div style="width: 8px; height: 8px; background-color: #059669; border-radius: 50%; margin-top: -2px; border: 1.5px solid white;"></div>
      </div>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
  });

/**
 * LocationPickerMap component (TE9C743, UC-05, FR-08, UC-05 A1)
 * Cho phép người bán nhập địa chỉ tra cứu tọa độ qua /api/geocode,
 * hoặc chọn vị trí thủ công qua click/kéo ghim marker trên bản đồ.
 */
export default function LocationPickerMap({
  address = '',
  onAddressChange,
  lat = 10.7769,
  lng = 106.7009,
  onLocationChange,
  error = null,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const [searching, setSearching] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const [geocodeNotFound, setGeocodeNotFound] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  const initialLat = Number(lat) || 10.7769;
  const initialLng = Number(lng) || 106.7009;

  // Khởi tạo bản đồ Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 15,
        zoomControl: true,
        maxBounds: [
          [-85.06, -180],
          [85.06, 180],
        ],
        maxBoundsViscosity: 1.0,
      });

      // Google Maps Tile layer
      L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3'],
        attribution: '&copy; Google Maps',
      }).addTo(map);

      // Marker có thể kéo thả (Draggable Marker)
      const marker = L.marker([initialLat, initialLng], {
        icon: createPickerIcon(),
        draggable: true,
        autoPan: true,
      }).addTo(map);

      marker.on('dragend', (event) => {
        const position = event.target.getLatLng();
        const newLat = Number(position.lat.toFixed(6));
        const newLng = Number(position.lng.toFixed(6));
        if (onLocationChange) {
          onLocationChange({ lat: newLat, lng: newLng });
        }
      });

      // Lắng nghe sự kiện click trên bản đồ để di chuyển marker
      map.on('click', (event) => {
        const { lat: clickLat, lng: clickLng } = event.latlng;
        const newLat = Number(clickLat.toFixed(6));
        const newLng = Number(clickLng.toFixed(6));
        marker.setLatLng([newLat, newLng]);
        if (onLocationChange) {
          onLocationChange({ lat: newLat, lng: newLng });
        }
      });

      setTimeout(() => {
        map.invalidateSize();
      }, 200);

      markerRef.current = marker;
      mapInstanceRef.current = map;
    }

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Đồng bộ vị trí marker khi lat / lng bên ngoài thay đổi
  useEffect(() => {
    if (markerRef.current && typeof lat === 'number' && typeof lng === 'number') {
      const currentPos = markerRef.current.getLatLng();
      if (Math.abs(currentPos.lat - lat) > 0.00001 || Math.abs(currentPos.lng - lng) > 0.00001) {
        markerRef.current.setLatLng([lat, lng]);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], mapInstanceRef.current.getZoom());
        }
      }
    }
  }, [lat, lng]);

  /**
   * Xử lý tra cứu địa chỉ qua /api/geocode (UC-05, UC-05 A1)
   */
  const handleSearchAddress = useCallback(
    async (e) => {
      if (e && e.preventDefault) e.preventDefault();
      if (!address || !address.trim()) return;

      setSearching(true);
      setGeocodeNotFound(false);
      setGpsError(null);

      try {
        const result = await geocodeAddressApi(address.trim());
        if (result && typeof result.lat === 'number' && typeof result.lng === 'number') {
          const newLat = Number(result.lat.toFixed(6));
          const newLng = Number(result.lng.toFixed(6));

          if (markerRef.current) {
            markerRef.current.setLatLng([newLat, newLng]);
          }
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([newLat, newLng], 16);
          }
          if (onLocationChange) {
            onLocationChange({ lat: newLat, lng: newLng });
          }
        } else {
          setGeocodeNotFound(true);
        }
      } catch (err) {
        // Luồng ngoại lệ UC-05 A1: Không tìm thấy địa chỉ -> Báo và cho phép ghim tay
        setGeocodeNotFound(true);
      } finally {
        setSearching(false);
      }
    },
    [address, onLocationChange]
  );

  /**
   * Định vị vị trí hiện tại qua GPS trình duyệt
   */
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }

    setLocatingGps(true);
    setGpsError(null);
    setGeocodeNotFound(false);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const curLat = Number(pos.coords.latitude.toFixed(6));
        const curLng = Number(pos.coords.longitude.toFixed(6));

        if (markerRef.current) {
          markerRef.current.setLatLng([curLat, curLng]);
        }
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([curLat, curLng], 16);
        }
        if (onLocationChange) {
          onLocationChange({ lat: curLat, lng: curLng });
        }
        setLocatingGps(false);
      },
      (err) => {
        console.warn('Lỗi lấy GPS:', err);
        setGpsError('Không thể lấy vị trí hiện tại. Vui lòng cấp quyền truy cập vị trí hoặc chọn thủ công trên bản đồ.');
        setLocatingGps(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, [onLocationChange]);

  return (
    <div className="space-y-3" data-testid="location-picker-map-container">
      {/* Ô nhập địa chỉ và nút Tìm vị trí */}
      <div>
        <label htmlFor="address-input" className="block text-sm font-semibold text-slate-700 mb-1">
          Địa chỉ giao dịch <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              id="address-input"
              type="text"
              value={address}
              onChange={(e) => {
                if (onAddressChange) onAddressChange(e.target.value);
                if (geocodeNotFound) setGeocodeNotFound(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearchAddress();
                }
              }}
              placeholder="VD: 123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh"
              className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 ${
                error
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
                  : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-200'
              }`}
            />
          </div>
          <button
            type="button"
            data-testid="geocode-search-btn"
            onClick={handleSearchAddress}
            disabled={searching || !address?.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            title="Định vị địa chỉ trên bản đồ"
          >
            {searching ? (
              <>
                <Loader2 size={16} className="animate-spin" data-testid="geocode-searching-spinner" />
                <span className="hidden sm:inline">Đang tìm...</span>
              </>
            ) : (
              <>
                <Search size={16} />
                <span className="hidden sm:inline">Tìm vị trí</span>
              </>
            )}
          </button>
          <button
            type="button"
            data-testid="locate-me-btn"
            onClick={handleLocateMe}
            disabled={locatingGps}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
            title="Sử dụng vị trí hiện tại của bạn"
          >
            {locatingGps ? (
              <Loader2 size={16} className="animate-spin text-emerald-600" />
            ) : (
              <Locate size={16} className="text-emerald-600" />
            )}
            <span className="hidden sm:inline">Vị trí của tôi</span>
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-600 mt-1 flex items-center gap-1" data-testid="error-address">
            <AlertCircle size={13} /> {error}
          </p>
        )}
      </div>

      {/* Thông báo ngoại lệ UC-05 A1: Không tìm thấy địa chỉ -> Cho phép ghim tay */}
      {geocodeNotFound && (
        <div
          role="alert"
          data-testid="geocode-not-found-alert"
          className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-800 text-xs animate-in fade-in"
        >
          <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Không tìm thấy địa chỉ này trên bản đồ (UC-05 A1).</span>
            <p className="mt-0.5 text-amber-700">
              Bạn có thể chạm trực tiếp lên bản đồ hoặc kéo biểu tượng ghim xanh đến vị trí chính xác của món đồ.
            </p>
          </div>
        </div>
      )}

      {/* Thông báo lỗi GPS */}
      {gpsError && (
        <div
          role="alert"
          data-testid="gps-error-alert"
          className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-800 text-xs"
        >
          <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p>{gpsError}</p>
          </div>
        </div>
      )}

      {/* Vùng bản đồ tương tác chọn vị trí */}
      <div className="relative">
        <div
          ref={mapContainerRef}
          data-testid="location-picker-map"
          className="h-64 sm:h-72 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner z-0"
        />

        {/* Badge hiển thị tọa độ đã chọn & hướng dẫn */}
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-[400] flex flex-wrap items-center gap-2 pointer-events-none">
          <div
            data-testid="selected-coords-badge"
            className="px-3 py-1.5 rounded-lg bg-white/95 backdrop-blur-sm border border-slate-200 shadow-sm text-xs font-medium text-slate-700 flex items-center gap-1.5"
          >
            <MapPin size={13} className="text-emerald-600 shrink-0" />
            <span>
              Tọa độ: <strong className="text-slate-900">{Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}</strong>
            </span>
          </div>
          <div className="hidden sm:inline-block px-2.5 py-1 rounded-lg bg-slate-900/80 text-white text-[11px] backdrop-blur-sm shadow-sm">
            Kéo ghim hoặc bấm bản đồ để chỉnh
          </div>
        </div>
      </div>
    </div>
  );
}
