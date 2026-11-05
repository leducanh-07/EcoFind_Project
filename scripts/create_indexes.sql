-- =============================================================================
-- EcoFind (SecondHand Map) - Performance Indexes Script (Task 3 - SDD 6.2)
-- Task Code: TE9C723
-- Traceability: NFR-PER-01, NFR-PER-02, UC-01, UC-02, UC-03, UC-06, UC-07, UC-09
-- =============================================================================

-- 1. Chỉ mục tải marker bản đồ theo khung nhìn và lọc khoảng cách (UC-02, UC-03, BR-03, NFR-PER-01, NFR-PER-02)
-- Partial Index lọc riêng các tin có trạng thái selling
CREATE INDEX IF NOT EXISTS idx_listings_map
ON listings (lat, lng)
WHERE status = 'selling';

-- 2. Chỉ mục lọc theo danh mục cho các tin đang bán (UC-03, BR-03)
-- Partial Index tối ưu dung lượng và tốc độ lọc danh mục
CREATE INDEX IF NOT EXISTS idx_listings_category
ON listings (category_id)
WHERE status = 'selling';

-- 3. Chỉ mục cho màn hình "Tin của tôi" của người bán (UC-06, FR-10)
-- Composite Index hỗ trợ lọc tin của người dùng theo trạng thái
CREATE INDEX IF NOT EXISTS idx_listings_seller
ON listings (seller_id, status);

-- 4. Chỉ mục cho hàng đợi kiểm duyệt tin của Admin (UC-09, FR-13)
-- Partial Index trên created_at với các tin pending
CREATE INDEX IF NOT EXISTS idx_listings_pending
ON listings (created_at)
WHERE status = 'pending';

-- 5. Chỉ mục cho hàng đợi xử lý báo cáo vi phạm của Admin (UC-09, FR-15)
-- Composite Index lọc theo trạng thái báo cáo và thời gian tạo
CREATE INDEX IF NOT EXISTS idx_reports_queue
ON reports (status, created_at);

-- 6. Chỉ mục đếm và kiểm tra tin yêu thích (UC-07, FR-11)
CREATE INDEX IF NOT EXISTS idx_favorites_listing
ON favorites (listing_id);

-- 7. Chỉ mục Unique Email xác thực tài khoản & đăng nhập (UC-01, FR-01, FR-02)
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key
ON users (email);

-- =============================================================================
-- MẪU KIỂM CHỨNG EXPLAIN (Dùng kiểm tra Index Scan sau khi đã có dữ liệu mẫu):
-- =============================================================================
-- EXPLAIN ANALYZE
-- SELECT listing_id, title, price, lat, lng, total_score
-- FROM listings
-- WHERE status = 'selling'
--   AND lat BETWEEN 10.70 AND 10.85
--   AND lng BETWEEN 106.60 AND 106.75;
-- -> Kết quả mong đợi: Dùng Bitmap Index Scan hoặc Index Scan trên idx_listings_map
