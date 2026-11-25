import React, { useEffect, useRef, useState, useCallback } from 'react';
import L, { GOOGLE_MAP_TILE_URL, GOOGLE_MAP_TILE_OPTIONS } from '../utils/leafletCluster';
import {
  Search,
  MapPin,
  Locate,
  AlertCircle,
  Loader2,
  Info,
  CheckCircle2,
} from 'lucide-react';
import {
  geocodeAddressApi,
  suggestAddressesApi,
  reverseGeocodeApi,
} from '../api/geocode';

/**
 * LocationPickerMap component (TE9C743, UC-05, FR-08, UC-05 A1)
 * Cho phép người bán:
 *  - Gõ địa chỉ có Autocomplete gợi ý địa điểm thực tế
 *  - Nhấn Tìm vị trí để nhảy tới tọa độ chính xác
 *  - Di chuyển bản đồ quanh ghim cố định ở tâm (kiểu Shopee / Google Maps)
 *  - Dùng "Vị trí của tôi" (tự điền địa chỉ nếu ô nhập đang trống)
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
  const suggestWrapperRef = useRef(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const onAddressChangeRef = useRef(onAddressChange);
  const suppressSuggestRef = useRef(false);
  const isUserDragRef = useRef(false);

  const [searching, setSearching] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const [geocodeNotFound, setGeocodeNotFound] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [isMapMoving, setIsMapMoving] = useState(false);
  const [matchNotice, setMatchNotice] = useState(null);

  // Autocomplete suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    onAddressChangeRef.current = onAddressChange;
  }, [onAddressChange]);

  const initialLat = Number(lat) || 10.7769;
  const initialLng = Number(lng) || 106.7009;

  // Khởi tạo bản đồ Leaflet với tâm ghim cố định
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 15,
        zoomSnap: 1,
        zoomDelta: 1,
        zoomControl: true,
        maxBounds: [
          [-85.06, -180],
          [85.06, 180],
        ],
        maxBoundsViscosity: 1.0,
      });

      L.tileLayer(GOOGLE_MAP_TILE_URL, GOOGLE_MAP_TILE_OPTIONS).addTo(map);

      const marker = L.marker([initialLat, initialLng], {
        opacity: 0,
        interactive: false,
      }).addTo(map);

      map.on('dragstart', () => {
        isUserDragRef.current = true;
      });

      map.on('movestart', () => {
        setIsMapMoving(true);
      });

      map.on('moveend', () => {
        setIsMapMoving(false);
        const center = map.getCenter();
        const newLat = Number(center.lat.toFixed(6));
        const newLng = Number(center.lng.toFixed(6));
        marker.setLatLng([newLat, newLng]);
        if (isUserDragRef.current) {
          isUserDragRef.current = false;
          setMatchNotice(null);
        }
        if (onLocationChangeRef.current) {
          onLocationChangeRef.current({ lat: newLat, lng: newLng });
        }
      });

      map.on('click', (event) => {
        isUserDragRef.current = true;
        const { lat: clickLat, lng: clickLng } = event.latlng;
        map.panTo([clickLat, clickLng], { animate: true });
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

  // Đóng dropdown gợi ý khi bấm ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestWrapperRef.current && !suggestWrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounce gọi API gợi ý địa chỉ khi người dùng gõ
  useEffect(() => {
    if (suppressSuggestRef.current) {
      suppressSuggestRef.current = false;
      return;
    }

    const trimmed = (address || '').trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (typeof suggestAddressesApi !== 'function') return;
      try {
        setLoadingSuggestions(true);
        const res = await suggestAddressesApi(trimmed, 5);
        if (!cancelled && res && Array.isArray(res.suggestions)) {
          setSuggestions(res.suggestions);
          setActiveSuggestionIdx(-1);
          setShowSuggestions(res.suggestions.length > 0);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSuggestions(false);
        }
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [address]);

  /**
   * Di chuyển tâm bản đồ và cập nhật tọa độ chọn
   */
  const moveMapToLocation = useCallback((targetLat, targetLng, zoomLevel = 17) => {
    const newLat = Number(Number(targetLat).toFixed(6));
    const newLng = Number(Number(targetLng).toFixed(6));
    isUserDragRef.current = false;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
      mapInstanceRef.current.setView([newLat, newLng], zoomLevel, { animate: true });
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([newLat, newLng]);
    }
    if (onLocationChangeRef.current) {
      onLocationChangeRef.current({ lat: newLat, lng: newLng });
    }
  }, []);

  /**
   * Thực thi tra cứu tọa độ từ chuỗi địa chỉ (có thể kèm magicKey từ Autocomplete)
   */
  const executeGeocodeLookup = useCallback(
    async (queryText, magicKey = null) => {
      const cleaned = (queryText || '').trim();
      if (!cleaned) return;

      setSearching(true);
      setGeocodeNotFound(false);
      setGpsError(null);
      setShowSuggestions(false);

      try {
        const result = magicKey
          ? await geocodeAddressApi(cleaned, magicKey)
          : await geocodeAddressApi(cleaned);

        if (result && typeof result.lat === 'number' && typeof result.lng === 'number') {
          moveMapToLocation(result.lat, result.lng, result.accuracy === 'exact' ? 18 : 16);
          const matchedAddr = result.matchedAddress || result.matched_address;
          // Chỉ hiển thị lưu ý nhẹ khi mới định vị tới đoạn đường chứ chưa có số nhà cụ thể;
          // nếu đã khớp chính xác (exact) thì không hiển thị banner thừa bên dưới ô nhập.
          if (result.accuracy && result.accuracy !== 'exact') {
            setMatchNotice({
              accuracy: result.accuracy,
              matchedAddress: matchedAddr || cleaned,
            });
          } else {
            setMatchNotice(null);
          }
        } else {
          setGeocodeNotFound(true);
          setMatchNotice(null);
        }
      } catch {
        setGeocodeNotFound(true);
        setMatchNotice(null);
      } finally {
        setSearching(false);
      }
    },
    [moveMapToLocation]
  );

  /**
   * Xử lý bấm nút "Tìm vị trí" hoặc Enter (UC-05, UC-05 A1)
   */
  const handleSearchAddress = useCallback(
    async (e) => {
      if (e && e.preventDefault) e.preventDefault();
      await executeGeocodeLookup(address);
    },
    [address, executeGeocodeLookup]
  );

  /**
   * Chọn một gợi ý từ Autocomplete dropdown
   */
  const handleSelectSuggestion = useCallback(
    async (item) => {
      if (!item || !item.text) return;
      suppressSuggestRef.current = true;
      setShowSuggestions(false);
      setSuggestions([]);
      if (onAddressChangeRef.current) {
        onAddressChangeRef.current(item.text);
      }
      await executeGeocodeLookup(item.text, item.magicKey || item.magic_key || null);
    },
    [executeGeocodeLookup]
  );

  /**
   * Định vị vị trí hiện tại qua GPS trình duyệt; luôn tự động điền địa chỉ tương ứng vào thanh tìm kiếm
   */
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }

    setLocatingGps(true);
    setGpsError(null);
    setGeocodeNotFound(false);
    setMatchNotice(null);
    setSuggestions([]);
    setShowSuggestions(false);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const curLat = Number(pos.coords.latitude.toFixed(6));
        const curLng = Number(pos.coords.longitude.toFixed(6));

        moveMapToLocation(curLat, curLng, 17);

        // Luôn tự động reverse-geocode điền chính xác địa chỉ hiện tại lên thanh tìm kiếm
        if (typeof reverseGeocodeApi === 'function') {
          try {
            const rev = await reverseGeocodeApi(curLat, curLng);
            if (rev && rev.address) {
              suppressSuggestRef.current = true;
              if (onAddressChangeRef.current) {
                onAddressChangeRef.current(rev.address);
              }
            }
          } catch {
            // Không chặn định vị GPS nếu reverse geocode lỗi
          }
        }

        setLocatingGps(false);
      },
      (err) => {
        console.warn('Lỗi lấy GPS:', err);
        setGpsError(
          'Không thể lấy vị trí hiện tại. Vui lòng cấp quyền truy cập vị trí hoặc chọn thủ công trên bản đồ.'
        );
        setLocatingGps(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, [moveMapToLocation]);

  const handleInputKeyDown = (e) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIdx((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIdx((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
      if (e.key === 'Enter' && activeSuggestionIdx >= 0) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[activeSuggestionIdx]);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchAddress();
    }
  };

  return (
    <div className="space-y-3" data-testid="location-picker-map-container">
      {/* Ô nhập địa chỉ (kèm Autocomplete) và nút Tìm vị trí */}
      <div>
        <label htmlFor="address-input" className="block text-sm font-semibold text-slate-700 mb-1">
          Địa chỉ giao dịch <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1" ref={suggestWrapperRef}>
            <input
              id="address-input"
              type="text"
              autoComplete="off"
              value={address}
              onChange={(e) => {
                if (onAddressChange) onAddressChange(e.target.value);
                if (geocodeNotFound) setGeocodeNotFound(false);
                if (matchNotice) setMatchNotice(null);
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="VD: 142 Lê Văn Việt, Tăng Nhơn Phú, TP. Hồ Chí Minh"
              className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 ${
                error
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
                  : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-200'
              }`}
            />

            {loadingSuggestions && (
              <Loader2
                size={14}
                className="animate-spin text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
            )}

            {/* Dropdown gợi ý địa chỉ (Autocomplete) */}
            {showSuggestions && suggestions.length > 0 && (
              <ul
                role="listbox"
                data-testid="address-suggestions-list"
                className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-[500] max-h-60 overflow-y-auto divide-y divide-slate-100"
              >
                {suggestions.map((item, idx) => (
                  <li
                    key={`${item.text}-${idx}`}
                    role="option"
                    aria-selected={idx === activeSuggestionIdx}
                    data-testid={`address-suggestion-item-${idx}`}
                    onMouseDown={(ev) => {
                      ev.preventDefault();
                      handleSelectSuggestion(item);
                    }}
                    className={`px-3.5 py-2.5 text-xs sm:text-sm cursor-pointer flex items-start gap-2.5 transition-colors ${
                      idx === activeSuggestionIdx
                        ? 'bg-emerald-50 text-emerald-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <MapPin size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-snug">{item.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            data-testid="geocode-search-btn"
            onClick={handleSearchAddress}
            disabled={searching || !address?.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
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

      {/* Thông báo lưu ý khi mới định vị được tới đoạn đường (chưa có số nhà cụ thể) */}
      {matchNotice && matchNotice.accuracy !== 'exact' && !geocodeNotFound && (
        <div
          data-testid="geocode-accuracy-notice"
          className="p-2.5 rounded-xl border bg-amber-50 border-amber-200 text-amber-800 flex items-start gap-2 text-xs"
        >
          <Info size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <span>
              Mới định vị tới đoạn đường (<strong>{matchNotice.matchedAddress}</strong>) do bản đồ chưa có số nhà cụ thể — bạn có thể kéo bản đồ để chỉnh ghim chuẩn hơn.
            </span>
          </div>
        </div>
      )}

      {/* Thông báo ngoại lệ UC-05 A1: Không tìm thấy địa chỉ -> Cho phép ghim tay */}
      {geocodeNotFound && (
        <div
          role="alert"
          data-testid="geocode-not-found-alert"
          className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-800 text-xs animate-in fade-in"
        >
          <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Không tìm thấy địa chỉ này trên bản đồ.</span>
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

        {/* Ghim giọt nước thanh mảnh cố định ở chính giữa tâm bản đồ */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-[400] pointer-events-none flex flex-col items-center select-none transition-transform duration-200 ${
            isMapMoving ? '-translate-y-[115%] scale-105' : ''
          }`}
          aria-hidden="true"
        >
          <svg
            width="30"
            height="40"
            viewBox="0 0 30 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-md"
          >
            <path
              d="M15 0C6.71573 0 0 6.71573 0 15C0 24.5 13.5 38.5 14.15 39.15C14.6 39.6 15.4 39.6 15.85 39.15C16.5 38.5 30 24.5 30 15C30 6.71573 23.2843 0 15 0Z"
              fill="url(#pinGradient)"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <circle cx="15" cy="14" r="5" fill="#ffffff" />
            <circle cx="15" cy="14" r="2.5" fill="#047857" />
            <defs>
              <linearGradient id="pinGradient" x1="0" y1="0" x2="30" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#10b981" />
                <stop offset="1" stopColor="#047857" />
              </linearGradient>
            </defs>
          </svg>

          <div
            className={`rounded-full bg-slate-900/30 blur-[1px] transition-all duration-200 ${
              isMapMoving ? 'w-2.5 h-1 mt-2.5 opacity-30 scale-75' : 'w-4 h-1 mt-0.5 opacity-60'
            }`}
          ></div>
        </div>

        {/* Badge hiển thị tọa độ đã chọn & hướng dẫn */}
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-[400] flex flex-wrap items-center gap-2 pointer-events-none">
          <div
            data-testid="selected-coords-badge"
            className="px-3 py-1.5 rounded-lg bg-white/95 backdrop-blur-sm border border-slate-200 shadow-sm text-xs font-medium text-slate-700 flex items-center gap-1.5"
          >
            <MapPin size={13} className="text-emerald-600 shrink-0" />
            <span>
              Tọa độ: <strong className="text-slate-800">{Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}</strong>
            </span>
          </div>
          <div className="hidden sm:inline-block px-2.5 py-1 rounded-lg bg-emerald-950/80 text-white text-[11px] backdrop-blur-sm shadow-sm">
            Di chuyển bản đồ để điều chỉnh vị trí ghim
          </div>
        </div>
      </div>
    </div>
  );
}
