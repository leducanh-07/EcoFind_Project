-- =============================================================================
-- EcoFind - SecondHand Map Platform
-- Script cài đặt pg_trgm & tạo chỉ mục GIN cho tìm kiếm từ khóa (Task STT 57, TE9C757)
-- Tuân thủ SDD mục 6.2, NFR-PER-02, TC-03
--
-- Mục đích:
-- Khi khối lượng dữ liệu đạt 10.000+ tin, các truy vấn tìm kiếm ILIKE '%keyword%'
-- có thể mất thời gian nếu phải quét tuần tự (Seq Scan).
-- Chỉ mục GIN với extension pg_trgm cho phép PostgreSQL sử dụng Bitmap Index Scan
-- với độ phức tạp tìm kiếm chuỗi con đạt thời gian phản hồi << 2 giây (NFR-PER-02).
-- =============================================================================

SET client_encoding = 'UTF8';

-- 1. Kích hoạt extension pg_trgm trên PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Tạo chỉ mục GIN (Trigram Index) trên tiêu đề (title) cho các tin 'selling'
CREATE INDEX IF NOT EXISTS idx_listings_title_trgm
ON listings USING gin (title gin_trgm_ops)
WHERE status = 'selling';

-- 3. Tạo chỉ mục GIN (Trigram Index) trên mô tả (description) cho các tin 'selling'
CREATE INDEX IF NOT EXISTS idx_listings_description_trgm
ON listings USING gin (description gin_trgm_ops)
WHERE status = 'selling';

-- 4. Tạo chỉ mục GIN kết hợp title và description để tối ưu truy vấn tổng hợp
CREATE INDEX IF NOT EXISTS idx_listings_search_trgm
ON listings USING gin ((title || ' ' || description) gin_trgm_ops)
WHERE status = 'selling';
