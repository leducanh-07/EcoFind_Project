-- =============================================================================
-- EcoFind - SecondHand Map Platform
-- Script tạo 7 chỉ mục truy vấn CSDL PostgreSQL (Task STT 3 - Ngày 1 - Sprint 1)
-- Tuân thủ tài liệu thiết kế hệ thống SDD mục 6.2 và yêu cầu NFR-PER-01, NFR-PER-02
--
-- Danh sách 7 chỉ mục theo SDD 6.2:
-- 1. idx_listings_map       : listings(lat, lng) WHERE status = 'selling'
-- 2. idx_listings_category  : listings(category_id) WHERE status = 'selling'
-- 3. idx_listings_seller    : listings(seller_id, status)
-- 4. idx_listings_pending   : listings(created_at) WHERE status = 'pending'
-- 5. idx_reports_queue      : reports(status, created_at)
-- 6. idx_favorites_listing  : favorites(listing_id)
-- 7. users_email_key        : users(email) UNIQUE
-- =============================================================================

SET client_encoding = 'UTF8';

-- -----------------------------------------------------------------------------
-- 1. Chỉ mục cho bản đồ và lọc khoảng cách theo khung nhìn (Bounding Box)
-- Mục đích: Tải marker theo khung nhìn và lọc khoảng cách (UC-02, UC-03, BR-03).
-- Đảm bảo thời gian hiển thị marker đầu tiên <= 3 giây trên mạng 4G (NFR-PER-01)
-- và truy vấn trong <= 2 giây với 10.000 tin (NFR-PER-02).
-- Sử dụng Partial Index chỉ đánh chỉ mục các tin có trạng thái 'selling'.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_listings_map 
ON listings (lat, lng) 
WHERE status = 'selling';

-- -----------------------------------------------------------------------------
-- 2. Chỉ mục lọc theo danh mục
-- Mục đích: Tối ưu hóa truy vấn lọc tin theo danh mục sản phẩm (UC-03).
-- Sử dụng Partial Index chỉ với các tin đang bán (status = 'selling').
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_listings_category 
ON listings (category_id) 
WHERE status = 'selling';

-- -----------------------------------------------------------------------------
-- 3. Chỉ mục cho tính năng "Tin của tôi" (My Listings)
-- Mục đích: Người bán truy vấn nhanh danh sách tin của chính mình theo từng trạng thái (UC-06, FR-10).
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_listings_seller 
ON listings (seller_id, status);

-- -----------------------------------------------------------------------------
-- 4. Chỉ mục hàng đợi kiểm duyệt tin của Admin
-- Mục đích: Admin truy vấn danh sách tin chờ duyệt (status = 'pending') sắp xếp theo thời gian gửi (UC-09, FR-13).
-- Sử dụng Partial Index chỉ với các tin chờ duyệt.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_listings_pending 
ON listings (created_at) 
WHERE status = 'pending';

-- -----------------------------------------------------------------------------
-- 5. Chỉ mục hàng đợi báo cáo vi phạm
-- Mục đích: Admin truy vấn nhanh hàng đợi báo cáo mới cần xử lý (status = 'new') sắp xếp theo thời gian (FR-15, UC-09 A3).
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reports_queue 
ON reports (status, created_at);

-- -----------------------------------------------------------------------------
-- 6. Chỉ mục kiểm tra và đếm tin yêu thích
-- Mục đích: Kiểm tra số lượt yêu thích và kiểm tra trạng thái lưu tin của một tin đăng (FR-11, UC-07).
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_favorites_listing 
ON favorites (listing_id);

-- -----------------------------------------------------------------------------
-- 7. Chỉ mục duy nhất cho email người dùng (Đăng nhập và chống trùng email)
-- Mục đích: Tối ưu hóa đăng nhập và đảm bảo tính duy nhất của email (FR-01, FR-02, NFR-SEC-01).
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key 
ON users (email);

-- =============================================================================
-- TRUY VẤN MẪU KIỂM CHỨNG EXPLAIN (Tiêu chí: EXPLAIN truy vấn khung nhìn dùng Index Scan)
-- =============================================================================
-- Ví dụ kiểm tra Index Scan cho truy vấn khung nhìn bản đồ (bbox):
-- EXPLAIN SELECT listing_id, title, price, lat, lng, total_score 
-- FROM listings 
-- WHERE status = 'selling' 
--   AND lat BETWEEN 10.700000 AND 10.850000 
--   AND lng BETWEEN 106.600000 AND 106.750000;
--
-- Ví dụ kiểm tra Index Scan cho hàng đợi duyệt của Admin:
-- EXPLAIN SELECT listing_id, title, created_at 
-- FROM listings 
-- WHERE status = 'pending' 
-- ORDER BY created_at ASC;
