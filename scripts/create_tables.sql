-- =============================================================================
-- EcoFind - SecondHand Map Platform
-- PostgreSQL Database Initialization Script - 6 Tables (Task STT 2 - Day 1 - Sprint 1)
-- Adhering to System Design Document (SDD 6.1) and SRS 3.4
--
-- Technical Specifications:
-- 1. Idempotency: Script can be safely re-executed without errors.
-- 2. Complete PK/FK, UNIQUE email, UNIQUE category name.
-- 3. CHECK price constraint: 0 - 1,000,000,000 (BR-05).
-- 4. CHECK score constraint: 0 - 10 for appearance, function, accessories, and total score.
-- 5. CHECK status constraint: {pending, selling, rejected, sold, hidden}.
-- 6. Full UTF-8 support for Vietnamese text.
-- =============================================================================

SET client_encoding = 'UTF8';

-- -----------------------------------------------------------------------------
-- 0. Clean up existing tables in reverse dependency order (Idempotent cleanup)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS favorites CASCADE;
DROP TABLE IF EXISTS listing_photos CASCADE;
DROP TABLE IF EXISTS listings CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- -----------------------------------------------------------------------------
-- 1. USERS: User account and administrator management
-- Traceability: SDD 6.1, FR-01, FR-02, NFR-SEC-01
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(10) NOT NULL DEFAULT 'user',
    failed_attempts SMALLINT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    CONSTRAINT pk_users PRIMARY KEY (user_id),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT chk_users_role CHECK (role IN ('user', 'admin')),
    CONSTRAINT chk_users_failed_attempts CHECK (failed_attempts >= 0)
);

-- -----------------------------------------------------------------------------
-- 2. CATEGORIES: Second-hand item categories (furniture, electronics, books, etc.)
-- Traceability: SDD 6.1, SRS 3.4
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    category_id SERIAL,
    name VARCHAR(50) NOT NULL,
    CONSTRAINT pk_categories PRIMARY KEY (category_id),
    CONSTRAINT uq_categories_name UNIQUE (name)
);

-- -----------------------------------------------------------------------------
-- 3. LISTINGS: Second-hand item listings
-- Traceability: SDD 6.1, FR-08, BR-01, BR-02, BR-03, BR-05, SRS 3.4
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listings (
    listing_id SERIAL,
    seller_id INT NOT NULL,
    category_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC(12, 0) NOT NULL,
    address VARCHAR(255) NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    score_appearance NUMERIC(3, 1) NOT NULL,
    score_function NUMERIC(3, 1) NOT NULL,
    score_accessories NUMERIC(3, 1) NOT NULL,
    total_score NUMERIC(3, 1) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'pending',
    reject_reason TEXT,
    hidden_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by INT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_listings PRIMARY KEY (listing_id),
    CONSTRAINT fk_listings_seller FOREIGN KEY (seller_id)
        REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_listings_category FOREIGN KEY (category_id)
        REFERENCES categories (category_id) ON DELETE RESTRICT,
    CONSTRAINT fk_listings_reviewed_by FOREIGN KEY (reviewed_by)
        REFERENCES users (user_id) ON DELETE SET NULL,
    CONSTRAINT chk_listings_price CHECK (price >= 0 AND price <= 1000000000),
    CONSTRAINT chk_listings_score_appearance CHECK (score_appearance >= 0.0 AND score_appearance <= 10.0),
    CONSTRAINT chk_listings_score_function CHECK (score_function >= 0.0 AND score_function <= 10.0),
    CONSTRAINT chk_listings_score_accessories CHECK (score_accessories >= 0.0 AND score_accessories <= 10.0),
    CONSTRAINT chk_listings_total_score CHECK (total_score >= 0.0 AND total_score <= 10.0),
    CONSTRAINT chk_listings_status CHECK (status IN ('pending', 'selling', 'rejected', 'sold', 'hidden'))
);

-- -----------------------------------------------------------------------------
-- 4. LISTING_PHOTOS: Item photo URLs (1 to 5 photos per listing)
-- Traceability: SDD 6.1, BR-04, SRS 3.4
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listing_photos (
    photo_id SERIAL,
    listing_id INT NOT NULL,
    url VARCHAR(500) NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    CONSTRAINT pk_listing_photos PRIMARY KEY (photo_id),
    CONSTRAINT fk_listing_photos_listing FOREIGN KEY (listing_id)
        REFERENCES listings (listing_id) ON DELETE CASCADE,
    CONSTRAINT chk_listing_photos_sort_order CHECK (sort_order >= 0)
);

-- -----------------------------------------------------------------------------
-- 5. FAVORITES: Saved listings bookmarked by users
-- Traceability: SDD 6.1, FR-11, SRS 3.4
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favorites (
    user_id INT NOT NULL,
    listing_id INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_favorites PRIMARY KEY (user_id, listing_id),
    CONSTRAINT fk_favorites_user FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_favorites_listing FOREIGN KEY (listing_id)
        REFERENCES listings (listing_id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 6. REPORTS: User violation reports for listings
-- Traceability: SDD 6.1, FR-12, FR-15, SRS 3.4
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    report_id SERIAL,
    listing_id INT NOT NULL,
    reporter_id INT NOT NULL,
    reason VARCHAR(20) NOT NULL,
    note VARCHAR(200),
    status VARCHAR(10) NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_reports PRIMARY KEY (report_id),
    CONSTRAINT fk_reports_listing FOREIGN KEY (listing_id)
        REFERENCES listings (listing_id) ON DELETE CASCADE,
    CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id)
        REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT uq_reports_reporter_listing UNIQUE (reporter_id, listing_id),
    CONSTRAINT chk_reports_status CHECK (status IN ('new', 'resolved')),
    CONSTRAINT chk_reports_reason CHECK (reason IN ('wrong_score', 'scam', 'prohibited', 'other'))
);
