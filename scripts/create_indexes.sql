-- =============================================================================
-- EcoFind - SecondHand Map Platform
-- PostgreSQL Database Index Creation Script - 7 Indexes (Task STT 3 - Day 1 - Sprint 1)
-- Adhering to System Design Document (SDD 6.2) and NFR-PER-01, NFR-PER-02
--
-- List of 7 Indexes (SDD 6.2):
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
-- 1. Index for map viewport and distance filtering (Bounding Box)
-- Purpose: Fast marker fetching within map viewport and distance filter (UC-02, UC-03, BR-03).
-- Ensures first marker loads within <= 3s on 4G (NFR-PER-01) and query <= 2s for 10k items (NFR-PER-02).
-- Uses Partial Index on 'selling' status only.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_listings_map 
ON listings (lat, lng) 
WHERE status = 'selling';

-- -----------------------------------------------------------------------------
-- 2. Index for category filtering
-- Purpose: Optimize listing search filtered by category (UC-03).
-- Uses Partial Index on 'selling' status only.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_listings_category 
ON listings (category_id) 
WHERE status = 'selling';

-- -----------------------------------------------------------------------------
-- 3. Index for "My Listings" screen
-- Purpose: Sellers query their own listings efficiently grouped by status (UC-06, FR-10).
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_listings_seller 
ON listings (seller_id, status);

-- -----------------------------------------------------------------------------
-- 4. Index for Admin moderation queue
-- Purpose: Admin queries pending listings ordered by submission timestamp (UC-09, FR-13).
-- Uses Partial Index on 'pending' status only.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_listings_pending 
ON listings (created_at) 
WHERE status = 'pending';

-- -----------------------------------------------------------------------------
-- 5. Index for violation report queue
-- Purpose: Admin queries incoming reports ordered by timestamp (FR-15, UC-09 A3).
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reports_queue 
ON reports (status, created_at);

-- -----------------------------------------------------------------------------
-- 6. Index for counting and checking listing favorites
-- Purpose: Check favorite count and verify if a listing is saved (FR-11, UC-07).
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_favorites_listing 
ON favorites (listing_id);

-- -----------------------------------------------------------------------------
-- 7. Unique index for user email (Login & duplicate prevention)
-- Purpose: Fast login lookup and unique constraint enforcement (FR-01, FR-02, NFR-SEC-01).
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key 
ON users (email);

-- =============================================================================
-- SAMPLE QUERIES FOR EXPLAIN VERIFICATION (Criterion: EXPLAIN map query uses Index Scan)
-- =============================================================================
-- Example: Verify Index Scan for map bounding box query:
-- EXPLAIN SELECT listing_id, title, price, lat, lng, total_score 
-- FROM listings 
-- WHERE status = 'selling' 
--   AND lat BETWEEN 10.700000 AND 10.850000 
--   AND lng BETWEEN 106.600000 AND 106.750000;
--
-- Example: Verify Index Scan for Admin pending moderation queue:
-- EXPLAIN SELECT listing_id, title, created_at 
-- FROM listings 
-- WHERE status = 'pending' 
-- ORDER BY created_at ASC;
