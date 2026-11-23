/**
 * EcoFind - Image Fallback Utility
 * Cung cấp SVG Data URI dự phòng và handler xử lý lỗi ảnh cho các component.
 * Đảm bảo 100% không bao giờ bị vỡ ảnh hoặc xuất hiện icon broken-image trên giao diện.
 */

export const DEFAULT_FALLBACK_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="100%" height="100%" fill="%23f1f5f9"/><rect x="24" y="24" width="552" height="352" rx="20" fill="%23f8fafc" stroke="%23cbd5e1" stroke-width="2" stroke-dasharray="8 8"/><circle cx="300" cy="175" r="44" fill="%230d9488" opacity="0.12"/><polygon points="300,145 315,190 285,190" fill="%230d9488"/><circle cx="300" cy="180" r="5" fill="%230f766e"/><text x="300" y="255" font-family="system-ui,-apple-system,sans-serif" font-size="20" font-weight="700" fill="%230f766e" text-anchor="middle">EcoFind</text><text x="300" y="282" font-family="system-ui,-apple-system,sans-serif" font-size="13" font-weight="500" fill="%2364748b" text-anchor="middle">H%C3%ACnh+%E1%BA%A3nh+%C4%91%E1%BB%93+c%C5%A9</text></svg>';

/**
 * Xử lý sự kiện onError của thẻ <img> để thay thế bằng ảnh fallback.
 * Ngăn chặn lỗi lặp vô hạn nếu ảnh fallback cũng gặp sự cố.
 */
export const handleImageError = (e, fallback = DEFAULT_FALLBACK_IMAGE) => {
  if (e && e.currentTarget) {
    e.currentTarget.onerror = null;
    e.currentTarget.src = fallback;
  }
};
