import { useState, useEffect, useCallback } from 'react';

// Tọa độ trung tâm mặc định: TP. Hồ Chí Minh (Quận 1 / Bến Thành)
export const DEFAULT_HCMC_COORDS = {
  lat: 10.7769,
  lng: 106.7009,
};

export const STORAGE_LOCATION_KEY = 'user_location';

/**
 * Hook useGeolocation (UC-02, FR-04, UC-02 A1, TE9C734)
 * - Tự động xin quyền và lấy vị trí GPS người dùng khi mở ứng dụng.
 * - Cho phép: Bản đồ đưa về vị trí hiện tại.
 * - Từ chối / lỗi / quá thời gian: Mở tại trung tâm TP.HCM và báo thông tin dự phòng (isFallback: true).
 * - Lưu tọa độ vào localStorage để tái sử dụng tính toán khoảng cách ở các bộ lọc (FR-06).
 */
export function useGeolocation() {
  const [coords, setCoords] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LOCATION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.lat && parsed?.lng) {
          return { lat: parsed.lat, lng: parsed.lng };
        }
      }
    } catch {
      // Fallback nếu parse lỗi
    }
    return DEFAULT_HCMC_COORDS;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFallback, setIsFallback] = useState(false);

  const requestLocation = useCallback((forceFresh = false) => {
    // 1. Kiểm tra hỗ trợ Geolocation API của trình duyệt
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setCoords(DEFAULT_HCMC_COORDS);
      setIsFallback(true);
      setError('Trình duyệt của bạn không hỗ trợ định vị GPS. Đang hiển thị trung tâm TP.HCM.');
      return;
    }

    setLoading(true);
    setError(null);

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 8000, // 8 giây tối đa
      maximumAge: forceFresh ? 0 : 60000, // Cho phép dùng cache 1 phút nếu không force fresh
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCoords(newCoords);
        setIsFallback(false);
        setError(null);
        setLoading(false);

        // Lưu vào localStorage cho các tính năng lọc khoảng cách
        try {
          localStorage.setItem(
            STORAGE_LOCATION_KEY,
            JSON.stringify({ ...newCoords, isFallback: false, timestamp: Date.now() })
          );
        } catch {
          // Bỏ qua lỗi storage quota
        }
      },
      (geoError) => {
        let msg = 'Không thể lấy vị trí hiện tại. Đang hiển thị vị trí tại trung tâm TP.HCM.';
        if (geoError.code === geoError.PERMISSION_DENIED) {
          msg = 'Bạn đã từ chối chia sẻ vị trí. Đang hiển thị khu vực trung tâm TP. Hồ Chí Minh.';
        } else if (geoError.code === geoError.TIMEOUT) {
          msg = 'Quá thời gian lấy vị trí GPS. Đang hiển thị khu vực trung tâm TP. Hồ Chí Minh.';
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          msg = 'Không tìm thấy tín hiệu định vị GPS. Đang hiển thị khu vực trung tâm TP. Hồ Chí Minh.';
        }

        setCoords(DEFAULT_HCMC_COORDS);
        setIsFallback(true);
        setError(msg);
        setLoading(false);

        try {
          localStorage.setItem(
            STORAGE_LOCATION_KEY,
            JSON.stringify({ ...DEFAULT_HCMC_COORDS, isFallback: true, timestamp: Date.now() })
          );
        } catch {
          // Bỏ qua
        }
      },
      geoOptions
    );
  }, []);

  // Tự động gọi định vị khi khởi tạo
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return {
    coords,
    loading,
    error,
    isFallback,
    requestLocation,
    clearError: () => setError(null),
  };
}
